import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { createInput } from "./index.ts";
import type { DragEvent, KeyEvent, TapEvent } from "./index.ts";

const dispatchPointer = (
  el: Element,
  type: "pointerdown" | "pointermove" | "pointerup" | "pointercancel",
  init: { pointerId: number; clientX: number; clientY: number },
): void => {
  el.dispatchEvent(
    new PointerEvent(type, {
      pointerId: init.pointerId,
      clientX: init.clientX,
      clientY: init.clientY,
      bubbles: true,
    }),
  );
};

const dispatchKey = (
  el: Element | Document,
  type: "keydown" | "keyup",
  init: { key: string; repeat?: boolean },
): void => {
  el.dispatchEvent(
    new KeyboardEvent(type, {
      key: init.key,
      repeat: init.repeat ?? false,
      bubbles: true,
    }),
  );
};

let host: HTMLElement;

beforeEach(() => {
  host = document.createElement("div");
  document.body.appendChild(host);
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
  host.remove();
});

describe("createInput — surface", () => {
  it("returns an Input with onTap, onDrag, onKey methods", () => {
    const input = createInput(host);
    expect(typeof input.onTap).toBe("function");
    expect(typeof input.onDrag).toBe("function");
    expect(typeof input.onKey).toBe("function");
  });
});

describe("createInput — tap", () => {
  it("fires on pointerdown→pointerup with no movement", () => {
    const input = createInput(host);
    const tap = vi.fn<(e: TapEvent) => void>();
    input.onTap(tap);

    dispatchPointer(host, "pointerdown", {
      pointerId: 1,
      clientX: 50,
      clientY: 60,
    });
    dispatchPointer(host, "pointerup", {
      pointerId: 1,
      clientX: 50,
      clientY: 60,
    });

    expect(tap).toHaveBeenCalledTimes(1);
    expect(tap.mock.calls[0]![0]).toMatchObject({ x: 50, y: 60 });
  });

  it("includes targetId if the pointerup target has an id", () => {
    const child = document.createElement("button");
    child.id = "play-area";
    host.appendChild(child);

    const input = createInput(host);
    const tap = vi.fn<(e: TapEvent) => void>();
    input.onTap(tap);

    dispatchPointer(child, "pointerdown", {
      pointerId: 1,
      clientX: 10,
      clientY: 10,
    });
    dispatchPointer(child, "pointerup", {
      pointerId: 1,
      clientX: 10,
      clientY: 10,
    });

    expect(tap).toHaveBeenCalledTimes(1);
    expect(tap.mock.calls[0]![0].targetId).toBe("play-area");
  });

  it("does NOT fire if movement exceeds threshold (treated as drag)", () => {
    const input = createInput(host);
    const tap = vi.fn<(e: TapEvent) => void>();
    input.onTap(tap);

    dispatchPointer(host, "pointerdown", {
      pointerId: 1,
      clientX: 0,
      clientY: 0,
    });
    dispatchPointer(host, "pointermove", {
      pointerId: 1,
      clientX: 30,
      clientY: 30,
    });
    dispatchPointer(host, "pointerup", {
      pointerId: 1,
      clientX: 30,
      clientY: 30,
    });

    expect(tap).not.toHaveBeenCalled();
  });

  it("does NOT fire if duration exceeds 500ms (long press, drag still ends)", () => {
    const input = createInput(host);
    const tap = vi.fn<(e: TapEvent) => void>();
    const drag = vi.fn<(e: DragEvent) => void>();
    input.onTap(tap);
    input.onDrag(drag);

    dispatchPointer(host, "pointerdown", {
      pointerId: 1,
      clientX: 5,
      clientY: 5,
    });
    vi.advanceTimersByTime(600);
    dispatchPointer(host, "pointerup", {
      pointerId: 1,
      clientX: 5,
      clientY: 5,
    });

    expect(tap).not.toHaveBeenCalled();
    expect(drag.mock.calls.some(([e]) => e.phase === "end")).toBe(true);
  });

  it("fires AFTER drag end (deterministic ordering)", () => {
    const input = createInput(host);
    const order: string[] = [];
    input.onDrag((e) => {
      if (e.phase === "end") order.push("drag-end");
    });
    input.onTap(() => {
      order.push("tap");
    });

    dispatchPointer(host, "pointerdown", {
      pointerId: 1,
      clientX: 0,
      clientY: 0,
    });
    dispatchPointer(host, "pointerup", {
      pointerId: 1,
      clientX: 0,
      clientY: 0,
    });

    expect(order).toEqual(["drag-end", "tap"]);
  });
});

describe("createInput — drag", () => {
  it("fires start immediately on pointerdown", () => {
    const input = createInput(host);
    const drag = vi.fn<(e: DragEvent) => void>();
    input.onDrag(drag);

    dispatchPointer(host, "pointerdown", {
      pointerId: 7,
      clientX: 100,
      clientY: 200,
    });

    expect(drag).toHaveBeenCalledTimes(1);
    expect(drag.mock.calls[0]![0]).toEqual({
      phase: "start",
      startX: 100,
      startY: 200,
      dx: 0,
      dy: 0,
    });
  });

  it("fires move on each pointermove with correct dx/dy", () => {
    const input = createInput(host);
    const drag = vi.fn<(e: DragEvent) => void>();
    input.onDrag(drag);

    dispatchPointer(host, "pointerdown", {
      pointerId: 1,
      clientX: 100,
      clientY: 100,
    });
    dispatchPointer(host, "pointermove", {
      pointerId: 1,
      clientX: 110,
      clientY: 95,
    });
    dispatchPointer(host, "pointermove", {
      pointerId: 1,
      clientX: 130,
      clientY: 80,
    });

    const moves = drag.mock.calls
      .map(([e]) => e)
      .filter((e) => e.phase === "move");
    expect(moves).toHaveLength(2);
    expect(moves[0]).toEqual({
      phase: "move",
      startX: 100,
      startY: 100,
      dx: 10,
      dy: -5,
    });
    expect(moves[1]).toEqual({
      phase: "move",
      startX: 100,
      startY: 100,
      dx: 30,
      dy: -20,
    });
  });

  it("fires end on pointerup with final delta", () => {
    const input = createInput(host);
    const drag = vi.fn<(e: DragEvent) => void>();
    input.onDrag(drag);

    dispatchPointer(host, "pointerdown", {
      pointerId: 1,
      clientX: 0,
      clientY: 0,
    });
    dispatchPointer(host, "pointermove", {
      pointerId: 1,
      clientX: 50,
      clientY: 25,
    });
    dispatchPointer(host, "pointerup", {
      pointerId: 1,
      clientX: 60,
      clientY: 30,
    });

    const end = drag.mock.calls.map(([e]) => e).find((e) => e.phase === "end");
    expect(end).toEqual({
      phase: "end",
      startX: 0,
      startY: 0,
      dx: 60,
      dy: 30,
    });
  });

  it("fires end on pointercancel", () => {
    const input = createInput(host);
    const drag = vi.fn<(e: DragEvent) => void>();
    input.onDrag(drag);

    dispatchPointer(host, "pointerdown", {
      pointerId: 1,
      clientX: 10,
      clientY: 10,
    });
    dispatchPointer(host, "pointercancel", {
      pointerId: 1,
      clientX: 12,
      clientY: 8,
    });

    const end = drag.mock.calls.map(([e]) => e).find((e) => e.phase === "end");
    expect(end).toEqual({
      phase: "end",
      startX: 10,
      startY: 10,
      dx: 2,
      dy: -2,
    });
  });

  it("ignores secondary pointers while a primary drag is active", () => {
    const input = createInput(host);
    const drag = vi.fn<(e: DragEvent) => void>();
    input.onDrag(drag);

    dispatchPointer(host, "pointerdown", {
      pointerId: 1,
      clientX: 0,
      clientY: 0,
    });
    dispatchPointer(host, "pointerdown", {
      pointerId: 2,
      clientX: 500,
      clientY: 500,
    });
    dispatchPointer(host, "pointermove", {
      pointerId: 2,
      clientX: 600,
      clientY: 600,
    });
    dispatchPointer(host, "pointermove", {
      pointerId: 1,
      clientX: 10,
      clientY: 0,
    });
    dispatchPointer(host, "pointerup", {
      pointerId: 2,
      clientX: 700,
      clientY: 700,
    });
    dispatchPointer(host, "pointerup", {
      pointerId: 1,
      clientX: 10,
      clientY: 0,
    });

    const phases = drag.mock.calls.map(([e]) => e.phase);
    const starts = phases.filter((p) => p === "start").length;
    const ends = phases.filter((p) => p === "end").length;
    expect(starts).toBe(1);
    expect(ends).toBe(1);

    const move = drag.mock.calls
      .map(([e]) => e)
      .find((e) => e.phase === "move");
    expect(move).toEqual({
      phase: "move",
      startX: 0,
      startY: 0,
      dx: 10,
      dy: 0,
    });
  });
});

describe("createInput — key", () => {
  it("fires down on keydown when event.repeat is false", () => {
    const input = createInput(host);
    const key = vi.fn<(e: KeyEvent) => void>();
    input.onKey(key);

    dispatchKey(document, "keydown", { key: "ArrowLeft", repeat: false });

    expect(key).toHaveBeenCalledWith({ key: "ArrowLeft", phase: "down" });
  });

  it("fires repeat on keydown when event.repeat is true", () => {
    const input = createInput(host);
    const key = vi.fn<(e: KeyEvent) => void>();
    input.onKey(key);

    dispatchKey(document, "keydown", { key: "a", repeat: true });

    expect(key).toHaveBeenCalledWith({ key: "a", phase: "repeat" });
  });

  it("fires up on keyup", () => {
    const input = createInput(host);
    const key = vi.fn<(e: KeyEvent) => void>();
    input.onKey(key);

    dispatchKey(document, "keyup", { key: " " });

    expect(key).toHaveBeenCalledWith({ key: " ", phase: "up" });
  });

  it("carries key field for printable and named keys", () => {
    const input = createInput(host);
    const key = vi.fn<(e: KeyEvent) => void>();
    input.onKey(key);

    dispatchKey(document, "keydown", { key: "ArrowLeft" });
    dispatchKey(document, "keydown", { key: "z" });

    expect(key.mock.calls.map(([e]) => e.key)).toEqual(["ArrowLeft", "z"]);
  });
});

describe("createInput — subscriptions", () => {
  it("supports multiple tap subscribers; each disposer removes only its own", () => {
    const input = createInput(host);
    const a = vi.fn<(e: TapEvent) => void>();
    const b = vi.fn<(e: TapEvent) => void>();
    const disposeA = input.onTap(a);
    input.onTap(b);

    dispatchPointer(host, "pointerdown", {
      pointerId: 1,
      clientX: 0,
      clientY: 0,
    });
    dispatchPointer(host, "pointerup", {
      pointerId: 1,
      clientX: 0,
      clientY: 0,
    });

    expect(a).toHaveBeenCalledTimes(1);
    expect(b).toHaveBeenCalledTimes(1);

    disposeA();

    dispatchPointer(host, "pointerdown", {
      pointerId: 1,
      clientX: 0,
      clientY: 0,
    });
    dispatchPointer(host, "pointerup", {
      pointerId: 1,
      clientX: 0,
      clientY: 0,
    });

    expect(a).toHaveBeenCalledTimes(1);
    expect(b).toHaveBeenCalledTimes(2);
  });

  it("disposer is idempotent", () => {
    const input = createInput(host);
    const handler = vi.fn<(e: TapEvent) => void>();
    const dispose = input.onTap(handler);

    expect(() => {
      dispose();
      dispose();
    }).not.toThrow();

    dispatchPointer(host, "pointerdown", {
      pointerId: 1,
      clientX: 0,
      clientY: 0,
    });
    dispatchPointer(host, "pointerup", {
      pointerId: 1,
      clientX: 0,
      clientY: 0,
    });

    expect(handler).not.toHaveBeenCalled();
  });

  it("after disposing all subscribers, no events fire", () => {
    const input = createInput(host);
    const tap = vi.fn<(e: TapEvent) => void>();
    const drag = vi.fn<(e: DragEvent) => void>();
    const key = vi.fn<(e: KeyEvent) => void>();
    const dt = input.onTap(tap);
    const dd = input.onDrag(drag);
    const dk = input.onKey(key);

    dt();
    dd();
    dk();

    dispatchPointer(host, "pointerdown", {
      pointerId: 1,
      clientX: 0,
      clientY: 0,
    });
    dispatchPointer(host, "pointerup", {
      pointerId: 1,
      clientX: 0,
      clientY: 0,
    });
    dispatchKey(document, "keydown", { key: "x" });

    expect(tap).not.toHaveBeenCalled();
    expect(drag).not.toHaveBeenCalled();
    expect(key).not.toHaveBeenCalled();
  });
});
