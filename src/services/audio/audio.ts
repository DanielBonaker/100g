/**
 * Audio service — WebAudio synthesised tones (no real audio files required).
 *
 * Approach: all sounds are generated via oscillators with exponential gain
 * envelopes. This bypasses asset-licensing concerns entirely. Real assets
 * can replace the synthesised tones in a later polish issue — the architecture
 * (enable / mute / play / persist) stays identical.
 *
 * Autoplay-safe: AudioContext is created lazily on the first call to enable(),
 * which must be wired to a user-gesture handler in main.ts.
 */

import type { Persistence } from "../persistence/types.ts";
import type { Audio } from "./types.ts";

export interface AudioOptions {
  readonly persistence: Persistence;
  readonly storageKey?: string;
  readonly audioContextFactory?: () => AudioContext;
}

interface PersistedShape {
  readonly muted: boolean;
}

// Per-sound synthesis parameters
const SOUND_PARAMS: Record<
  string,
  { freq: number; duration: number; gainStart: number }
> = {
  "dd-block-land": { freq: 220, duration: 0.08, gainStart: 0.1 },
  "dd-row-clear": { freq: 440, duration: 0.2, gainStart: 0.15 },
  "dd-impact-boom": { freq: 80, duration: 0.3, gainStart: 0.25 },
  "dd-melt-splash": { freq: 660, duration: 0.18, gainStart: 0.1 },
  "dd-rain-patter": { freq: 1200, duration: 0.05, gainStart: 0.05 },
  "dd-shop-ambient": { freq: 330, duration: 0.5, gainStart: 0.05 },
  "kg-tap": { freq: 880, duration: 0.04, gainStart: 0.08 },
};

const DEFAULT_PARAMS: { freq: number; duration: number; gainStart: number } = {
  freq: 220,
  duration: 0.08,
  gainStart: 0.1,
};

export const createAudio = async (opts: AudioOptions): Promise<Audio> => {
  const storageKey = opts.storageKey ?? "audio";

  // Hydrate muted state; default to muted (browser autoplay policy)
  const stored = await opts.persistence.load<PersistedShape>(storageKey);
  let muted = stored?.muted ?? true;

  let ctx: AudioContext | null = null;

  const persist = (): void => {
    void opts.persistence.save(storageKey, { muted }, { debounceMs: 100 });
  };

  const enable = async (): Promise<void> => {
    if (ctx !== null) return; // idempotent

    // Graceful fallback for environments without WebAudio (e.g. test env
    // without an explicit factory, or non-browser runtimes).
    if (
      typeof AudioContext === "undefined" &&
      opts.audioContextFactory === undefined
    ) {
      return;
    }

    const factory = opts.audioContextFactory ?? (() => new AudioContext());
    ctx = factory();

    if (ctx.state === "suspended") {
      await ctx.resume();
    }
    // No preload needed — we synthesise tones on demand.
  };

  const setMuted = (newMuted: boolean): void => {
    muted = newMuted;
    persist();
  };

  const play = (soundId: string): void => {
    if (muted) return;
    if (ctx === null) return; // not yet enabled — silent

    const p = SOUND_PARAMS[soundId] ?? DEFAULT_PARAMS;

    const oscillator = ctx.createOscillator();
    const gain = ctx.createGain();

    oscillator.connect(gain);
    gain.connect(ctx.destination);

    oscillator.frequency.value = p.freq;
    gain.gain.value = p.gainStart;
    gain.gain.exponentialRampToValueAtTime(
      0.0001,
      ctx.currentTime + p.duration,
    );

    oscillator.start();
    oscillator.stop(ctx.currentTime + p.duration);
  };

  const isMuted = (): boolean => muted;

  return { enable, setMuted, play, isMuted };
};
