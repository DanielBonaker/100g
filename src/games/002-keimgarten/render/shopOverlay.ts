import type { RunState } from "../domain/runState.ts";
import { priceFor } from "../domain/shop.ts";
import type { Size } from "../domain/shop.ts";

export interface ShopOverlay {
  readonly element: HTMLDivElement;
  show(): void;
  hide(): void;
  refresh(state: RunState, balance: number): void;
  destroy(): void;
  onSizeTap: (size: Size) => void;
}

const SIZES: readonly Size[] = [1, 2, 3, 4, 5];

export const createShopOverlay = (): ShopOverlay => {
  const overlay = document.createElement("div");
  overlay.dataset.role = "shop-overlay";
  overlay.style.cssText = [
    "position:absolute",
    "inset:0",
    "display:none",
    "flex-direction:column",
    "align-items:center",
    "justify-content:center",
    "background:rgba(0,0,0,0.85)",
    "z-index:100",
  ].join(";");

  // Title
  const title = document.createElement("div");
  title.style.cssText = [
    "color:#fff",
    "font-family:monospace",
    "font-size:12px",
    "margin-bottom:12px",
    "font-weight:bold",
  ].join(";");
  title.textContent = "Shop";
  overlay.appendChild(title);

  // Size buttons container
  const buttonsContainer = document.createElement("div");
  buttonsContainer.style.cssText = [
    "display:flex",
    "flex-direction:column",
    "gap:6px",
    "width:80%",
  ].join(";");
  overlay.appendChild(buttonsContainer);

  // Create a button per size
  const sizeButtons = new Map<Size, HTMLButtonElement>();
  for (const size of SIZES) {
    const btn = document.createElement("button");
    btn.dataset.size = String(size);
    btn.style.cssText = [
      "min-width:44px",
      "min-height:44px",
      "background:rgba(40,40,80,0.9)",
      "color:#fff",
      "font-family:monospace",
      "font-size:11px",
      "border:1px solid #666",
      "border-radius:4px",
      "cursor:pointer",
      "padding:6px 12px",
      "box-sizing:border-box",
      "text-align:left",
    ].join(";");
    btn.textContent = `Size ${size.toString()} — ${priceFor(size).toString()}`;
    buttonsContainer.appendChild(btn);
    sizeButtons.set(size, btn);
  }

  // Tap-outside to close
  overlay.addEventListener("click", (e) => {
    if (e.target === overlay) {
      hide();
    }
  });

  // Default no-op callback; caller replaces it
  let onSizeTap: (size: Size) => void = () => undefined;

  // Wire each button
  for (const size of SIZES) {
    const btn = sizeButtons.get(size);
    if (btn === undefined) continue;
    btn.addEventListener("click", () => {
      if (btn.disabled) return;
      onSizeTap(size);
    });
  }

  const show = (): void => {
    overlay.style.display = "flex";
  };

  const hide = (): void => {
    overlay.style.display = "none";
  };

  const refresh = (_state: RunState, balance: number): void => {
    for (const size of SIZES) {
      const btn = sizeButtons.get(size);
      if (btn === undefined) continue;
      const price = priceFor(size);
      btn.disabled = balance < price;
      btn.style.opacity = balance < price ? "0.5" : "1";
    }
  };

  const destroy = (): void => {
    if (overlay.parentNode !== null) {
      overlay.parentNode.removeChild(overlay);
    }
  };

  // Start hidden
  hide();

  return {
    element: overlay,
    show,
    hide,
    refresh,
    destroy,
    get onSizeTap(): (size: Size) => void {
      return onSizeTap;
    },
    set onSizeTap(cb: (size: Size) => void) {
      onSizeTap = cb;
    },
  };
};
