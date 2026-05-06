// STUB — implementation pending (tests first)
import type { RunState } from "../domain/runState.ts";
import type { Size } from "../domain/shop.ts";

export interface ShopOverlay {
  readonly element: HTMLDivElement;
  show(): void;
  hide(): void;
  refresh(state: RunState, balance: number): void;
  destroy(): void;
  onSizeTap: (size: Size) => void;
}

export const createShopOverlay = (): ShopOverlay => {
  const element = document.createElement("div");
  element.dataset.role = "shop-overlay";
  throw new Error("not implemented");
};
