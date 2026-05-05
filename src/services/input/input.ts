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
  for (const h of [...handlers]) {
    try {
      h(event);
    } catch (err) {
      console.error("[input] handler threw:", err);
    }
  }
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

  const onPointerDown = (pe: PointerEvent): void => {
    if (active !== null && active.pointerId !== pe.pointerId) {
      // Previous pointer was lost (no pointerup observed — e.g. context menu,
      // alt-tab). Force-end it synthetically so the service doesn't wedge.
      fanOut(dragHandlers, {
        phase: "end",
        startX: active.startX,
        startY: active.startY,
        dx: active.lastX - active.startX,
        dy: active.lastY - active.startY,
      });
      active = null;
    }
    if (active !== null) return;
    active = {
      pointerId: pe.pointerId,
      startX: pe.clientX,
      startY: pe.clientY,
      startedAt: performance.now(),
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

  const onPointerMove = (pe: PointerEvent): void => {
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
    const duration = performance.now() - active.startedAt;
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

  const onPointerUp = (pe: PointerEvent): void => {
    endPointer(pe);
  };

  const onPointerCancel = (pe: PointerEvent): void => {
    endPointer(pe);
  };

  const onKeyDown = (ke: KeyboardEvent): void => {
    fanOut(keyHandlers, {
      key: ke.key,
      phase: ke.repeat ? "repeat" : "down",
    });
  };

  const onKeyUp = (ke: KeyboardEvent): void => {
    fanOut(keyHandlers, { key: ke.key, phase: "up" });
  };

  // Narrow target to one branch of the union so TS picks the literal-keyed
  // addEventListener overloads (PointerEvent, not generic Event).
  if (target instanceof Document) {
    target.addEventListener("pointerdown", onPointerDown);
    target.addEventListener("pointermove", onPointerMove);
    target.addEventListener("pointerup", onPointerUp);
    target.addEventListener("pointercancel", onPointerCancel);
    target.addEventListener("keydown", onKeyDown);
    target.addEventListener("keyup", onKeyUp);
  } else {
    target.addEventListener("pointerdown", onPointerDown);
    target.addEventListener("pointermove", onPointerMove);
    target.addEventListener("pointerup", onPointerUp);
    target.addEventListener("pointercancel", onPointerCancel);
    target.ownerDocument.addEventListener("keydown", onKeyDown);
    target.ownerDocument.addEventListener("keyup", onKeyUp);
  }

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
