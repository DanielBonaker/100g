export type Disposer = () => void;

export interface TapEvent {
  x: number;
  y: number;
  targetId?: string;
}

// Name collides with the DOM's global DragEvent; consumers can alias on import
// (e.g. `import type { DragEvent as InputDragEvent } from ".../input"`).
export interface DragEvent {
  startX: number;
  startY: number;
  dx: number;
  dy: number;
  phase: "start" | "move" | "end";
}

export interface KeyEvent {
  key: string;
  phase: "down" | "up" | "repeat";
}

export interface InputOptions {
  tapMoveThresholdPx?: number;
  tapMaxDurationMs?: number;
}

export interface Input {
  onTap(handler: (e: TapEvent) => void): Disposer;
  onDrag(handler: (e: DragEvent) => void): Disposer;
  onKey(handler: (e: KeyEvent) => void): Disposer;
}
