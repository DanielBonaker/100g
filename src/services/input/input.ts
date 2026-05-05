import type {
  Disposer,
  DragEvent,
  Input,
  InputOptions,
  KeyEvent,
  TapEvent,
} from "./types.ts";

const DEFAULT_TAP_MOVE_PX = 8;
const DEFAULT_TAP_MAX_MS = 500;

interface ActivePointer {
  pointerId: number;
  startX: number;
  startY: number;
  startedAt: number;
  lastX: number;
  lastY: number;
}

const fanOut = <E>(handlers: Set<(e: E) => void>, event: E): void => {
  for (const h of [...handlers]) h(event);
};

export const createInput = (
  target: HTMLElement | Document,
  options?: InputOptions,
): Input => {
  const tapMoveThresholdPx = options?.tapMoveThresholdPx ?? DEFAULT_TAP_MOVE_PX;
  const tapMaxDurationMs = options?.tapMaxDurationMs ?? DEFAULT_TAP_MAX_MS;

  const tapHandlers = new Set<(e: TapEvent) => void>();
  const dragHandlers = new Set<(e: DragEvent) => void>();
  const keyHandlers = new Set<(e: KeyEvent) => void>();

  let active: ActivePointer | null = null;

  const onPointerDown = (e: Event): void => {
    const pe = e as PointerEvent;
    if (active !== null) return;
    active = {
      pointerId: pe.pointerId,
      startX: pe.clientX,
      startY: pe.clientY,
      startedAt: Date.now(),
      lastX: pe.clientX,
      lastY: pe.clientY,
    };
    fanOut(dragHandlers, {
      phase: "start",
      startX: active.startX,
      startY: active.startY,
      dx: 0,
      dy: 0,
    });
  };

  const onPointerMove = (e: Event): void => {
    const pe = e as PointerEvent;
    if (active?.pointerId !== pe.pointerId) return;
    active.lastX = pe.clientX;
    active.lastY = pe.clientY;
    fanOut(dragHandlers, {
      phase: "move",
      startX: active.startX,
      startY: active.startY,
      dx: pe.clientX - active.startX,
      dy: pe.clientY - active.startY,
    });
  };

  const endPointer = (pe: PointerEvent): void => {
    if (active?.pointerId !== pe.pointerId) return;

    const dx = pe.clientX - active.startX;
    const dy = pe.clientY - active.startY;
    const duration = Date.now() - active.startedAt;
    const moved = Math.sqrt(dx * dx + dy * dy);

    fanOut(dragHandlers, {
      phase: "end",
      startX: active.startX,
      startY: active.startY,
      dx,
      dy,
    });

    const wasTap =
      pe.type === "pointerup" &&
      moved <= tapMoveThresholdPx &&
      duration <= tapMaxDurationMs;

    active = null;

    if (wasTap) {
      const targetEl = pe.target;
      const targetId =
        targetEl instanceof Element && targetEl.id !== ""
          ? targetEl.id
          : undefined;
      const tapEvent: TapEvent =
        targetId === undefined
          ? { x: pe.clientX, y: pe.clientY }
          : { x: pe.clientX, y: pe.clientY, targetId };
      fanOut(tapHandlers, tapEvent);
    }
  };

  const onPointerUp = (e: Event): void => {
    endPointer(e as PointerEvent);
  };

  const onPointerCancel = (e: Event): void => {
    endPointer(e as PointerEvent);
  };

  const onKeyDown = (e: Event): void => {
    const ke = e as KeyboardEvent;
    fanOut(keyHandlers, {
      key: ke.key,
      phase: ke.repeat ? "repeat" : "down",
    });
  };

  const onKeyUp = (e: Event): void => {
    const ke = e as KeyboardEvent;
    fanOut(keyHandlers, { key: ke.key, phase: "up" });
  };

  target.addEventListener("pointerdown", onPointerDown);
  target.addEventListener("pointermove", onPointerMove);
  target.addEventListener("pointerup", onPointerUp);
  target.addEventListener("pointercancel", onPointerCancel);

  const keyTarget: Document =
    target instanceof Document ? target : target.ownerDocument;
  keyTarget.addEventListener("keydown", onKeyDown);
  keyTarget.addEventListener("keyup", onKeyUp);

  const subscribe = <E>(
    set: Set<(e: E) => void>,
    handler: (e: E) => void,
  ): Disposer => {
    set.add(handler);
    return () => {
      set.delete(handler);
    };
  };

  return {
    onTap: (handler) => subscribe(tapHandlers, handler),
    onDrag: (handler) => subscribe(dragHandlers, handler),
    onKey: (handler) => subscribe(keyHandlers, handler),
  };
};
