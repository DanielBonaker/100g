import { describe, it, expect, vi } from "vitest";
import { createAudio } from "./audio.ts";
import type { Audio } from "./types.ts";

// ---------------------------------------------------------------------------
// Fake AudioContext factory — no real WebAudio in test environment
// ---------------------------------------------------------------------------

const makeFakeOscillator = () => ({
  frequency: { value: 0 },
  connect: vi.fn(),
  start: vi.fn(),
  stop: vi.fn(),
});

const makeFakeGain = () => ({
  gain: { value: 0, exponentialRampToValueAtTime: vi.fn() },
  connect: vi.fn(),
});

const makeFakeAudioContext = () => ({
  state: "running" as AudioContextState,
  currentTime: 0,
  destination: {},
  resume: vi.fn().mockResolvedValue(undefined),
  createOscillator: vi.fn(() => makeFakeOscillator()),
  createGain: vi.fn(() => makeFakeGain()),
});

// ---------------------------------------------------------------------------
// Fake persistence — in-memory store, no IndexedDB needed
// ---------------------------------------------------------------------------

import type { Persistence } from "../persistence/types.ts";

interface FakePersistence extends Persistence {
  saveSpy: ReturnType<typeof vi.fn>;
  _store: Map<string, unknown>;
}

const makeFakePersistence = (): FakePersistence => {
  const store = new Map<string, unknown>();
  const saveSpy = vi.fn((key: string, value: unknown): Promise<void> => {
    store.set(key, value);
    return Promise.resolve();
  });

  const persistence: FakePersistence = {
    saveSpy,
    _store: store,
    save: saveSpy,
    load: <T>(key: string): Promise<T | null> => {
      return Promise.resolve((store.get(key) as T | undefined) ?? null);
    },
    delete: (key: string): Promise<void> => {
      store.delete(key);
      return Promise.resolve();
    },
  };
  return persistence;
};

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("createAudio — construction", () => {
  it("returns an Audio object", async () => {
    const persistence = makeFakePersistence();
    const audio: Audio = await createAudio({ persistence });
    expect(typeof audio.enable).toBe("function");
    expect(typeof audio.setMuted).toBe("function");
    expect(typeof audio.play).toBe("function");
    expect(typeof audio.isMuted).toBe("function");
  });

  it("starts muted by default when no persisted state", async () => {
    const persistence = makeFakePersistence();
    const audio = await createAudio({ persistence });
    expect(audio.isMuted()).toBe(true);
  });

  it("hydrates muted=false from persistence", async () => {
    const persistence = makeFakePersistence();
    await persistence.save("audio", { muted: false });
    const audio = await createAudio({ persistence });
    expect(audio.isMuted()).toBe(false);
  });

  it("hydrates muted=true from persistence", async () => {
    const persistence = makeFakePersistence();
    await persistence.save("audio", { muted: true });
    const audio = await createAudio({ persistence });
    expect(audio.isMuted()).toBe(true);
  });
});

describe("createAudio — enable()", () => {
  it("creates AudioContext on first enable()", async () => {
    const persistence = makeFakePersistence();
    let factoryCalls = 0;
    const factory = () => {
      factoryCalls++;
      return makeFakeAudioContext() as unknown as AudioContext;
    };

    const audio = await createAudio({
      persistence,
      audioContextFactory: factory,
    });
    expect(factoryCalls).toBe(0); // lazy — no context yet

    await audio.enable();
    expect(factoryCalls).toBe(1);
  });

  it("enable() is idempotent — second call does not create a second context", async () => {
    const persistence = makeFakePersistence();
    let factoryCalls = 0;
    const factory = () => {
      factoryCalls++;
      return makeFakeAudioContext() as unknown as AudioContext;
    };

    const audio = await createAudio({
      persistence,
      audioContextFactory: factory,
    });

    await audio.enable();
    await audio.enable(); // second call
    expect(factoryCalls).toBe(1);
  });

  it("enable() calls ctx.resume() when context state is suspended", async () => {
    const persistence = makeFakePersistence();
    const fakeCtx = makeFakeAudioContext();
    fakeCtx.state = "suspended";

    const audio = await createAudio({
      persistence,
      audioContextFactory: () => fakeCtx as unknown as AudioContext,
    });

    await audio.enable();
    expect(fakeCtx.resume).toHaveBeenCalledTimes(1);
  });

  it("enable() does NOT call ctx.resume() when context is already running", async () => {
    const persistence = makeFakePersistence();
    const fakeCtx = makeFakeAudioContext();
    fakeCtx.state = "running";

    const audio = await createAudio({
      persistence,
      audioContextFactory: () => fakeCtx as unknown as AudioContext,
    });

    await audio.enable();
    expect(fakeCtx.resume).not.toHaveBeenCalled();
  });

  it("enable() no-ops gracefully when AudioContext is unavailable and no factory", async () => {
    const persistence = makeFakePersistence();
    // No audioContextFactory — simulates an environment without WebAudio
    const audio = await createAudio({ persistence });
    // Should not throw
    await expect(audio.enable()).resolves.toBeUndefined();
  });
});

describe("createAudio — setMuted()", () => {
  it("setMuted(false) changes isMuted() to false", async () => {
    const persistence = makeFakePersistence();
    const audio = await createAudio({ persistence });
    expect(audio.isMuted()).toBe(true); // default

    audio.setMuted(false);
    expect(audio.isMuted()).toBe(false);
  });

  it("setMuted(true) changes isMuted() to true", async () => {
    const persistence = makeFakePersistence();
    await persistence.save("audio", { muted: false });
    const audio = await createAudio({ persistence });
    expect(audio.isMuted()).toBe(false);

    audio.setMuted(true);
    expect(audio.isMuted()).toBe(true);
  });

  it("setMuted persists the muted state via persistence.save", async () => {
    const persistence = makeFakePersistence();
    const audio = await createAudio({ persistence });
    audio.setMuted(false);

    // Flush any debounce by awaiting a microtask
    await Promise.resolve();

    // Verify save was called with the correct key and value
    expect(persistence.saveSpy).toHaveBeenCalled();
    const [savedKey, savedValue] = persistence.saveSpy.mock.calls[0] as [
      string,
      { muted: boolean },
      unknown,
    ];
    expect(savedKey).toBe("audio");
    expect(savedValue).toStrictEqual({ muted: false });
  });
});

describe("createAudio — play()", () => {
  it("play() while muted does not call createOscillator", async () => {
    const persistence = makeFakePersistence();
    const fakeCtx = makeFakeAudioContext();
    const audio = await createAudio({
      persistence,
      audioContextFactory: () => fakeCtx as unknown as AudioContext,
    });

    await audio.enable();
    // still muted (default)
    audio.play("dd-block-land");

    expect(fakeCtx.createOscillator).not.toHaveBeenCalled();
  });

  it("play() while unmuted but not enabled — silent (no context calls)", async () => {
    const persistence = makeFakePersistence();
    await persistence.save("audio", { muted: false });
    const fakeCtx = makeFakeAudioContext();
    let factoryUsed = false;
    const audio = await createAudio({
      persistence,
      audioContextFactory: () => {
        factoryUsed = true;
        return fakeCtx as unknown as AudioContext;
      },
    });

    // NOT calling enable() — context should not be created
    audio.play("dd-block-land");

    expect(factoryUsed).toBe(false);
    expect(fakeCtx.createOscillator).not.toHaveBeenCalled();
  });

  it("play() while unmuted + enabled calls createOscillator and createGain", async () => {
    const persistence = makeFakePersistence();
    await persistence.save("audio", { muted: false });
    const fakeCtx = makeFakeAudioContext();
    const audio = await createAudio({
      persistence,
      audioContextFactory: () => fakeCtx as unknown as AudioContext,
    });

    await audio.enable();
    audio.play("dd-block-land");

    expect(fakeCtx.createOscillator).toHaveBeenCalledTimes(1);
    expect(fakeCtx.createGain).toHaveBeenCalledTimes(1);
  });

  it("play() connects oscillator → gain → destination", async () => {
    const persistence = makeFakePersistence();
    await persistence.save("audio", { muted: false });
    const fakeCtx = makeFakeAudioContext();
    const fakeOsc = makeFakeOscillator();
    const fakeGain = makeFakeGain();
    fakeCtx.createOscillator.mockReturnValueOnce(fakeOsc);
    fakeCtx.createGain.mockReturnValueOnce(fakeGain);

    const audio = await createAudio({
      persistence,
      audioContextFactory: () => fakeCtx as unknown as AudioContext,
    });

    await audio.enable();
    audio.play("dd-block-land");

    expect(fakeOsc.connect).toHaveBeenCalledWith(fakeGain);
    expect(fakeGain.connect).toHaveBeenCalledWith(fakeCtx.destination);
  });

  it("play() schedules oscillator start and stop", async () => {
    const persistence = makeFakePersistence();
    await persistence.save("audio", { muted: false });
    const fakeCtx = makeFakeAudioContext();
    const fakeOsc = makeFakeOscillator();
    fakeCtx.createOscillator.mockReturnValueOnce(fakeOsc);

    const audio = await createAudio({
      persistence,
      audioContextFactory: () => fakeCtx as unknown as AudioContext,
    });

    await audio.enable();
    audio.play("dd-row-clear");

    expect(fakeOsc.start).toHaveBeenCalledTimes(1);
    expect(fakeOsc.stop).toHaveBeenCalledTimes(1);
  });

  it("play() with unknown soundId falls back to default parameters (no throw)", async () => {
    const persistence = makeFakePersistence();
    await persistence.save("audio", { muted: false });
    const fakeCtx = makeFakeAudioContext();
    const audio = await createAudio({
      persistence,
      audioContextFactory: () => fakeCtx as unknown as AudioContext,
    });

    await audio.enable();
    // Should not throw even for unknown IDs
    expect(() => {
      audio.play("unknown-sound-id");
    }).not.toThrow();
    expect(fakeCtx.createOscillator).toHaveBeenCalledTimes(1);
  });
});

describe("createAudio — custom storageKey", () => {
  it("uses the provided storageKey for persistence read/write", async () => {
    const persistence = makeFakePersistence();
    await persistence.save("my-audio-key", { muted: false });

    const audio = await createAudio({
      persistence,
      storageKey: "my-audio-key",
    });
    expect(audio.isMuted()).toBe(false);
  });
});

describe("createAudio — round-trip persistence", () => {
  it("setMuted(false) then new instance reads back false", async () => {
    const persistence = makeFakePersistence();
    const audio1 = await createAudio({ persistence });
    expect(audio1.isMuted()).toBe(true);

    audio1.setMuted(false);
    await Promise.resolve(); // flush microtask

    // Simulate a page reload — new instance reads from same persistence
    const audio2 = await createAudio({ persistence });
    expect(audio2.isMuted()).toBe(false);
  });
});
