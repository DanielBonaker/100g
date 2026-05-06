import { describe, it, expect, vi } from "vitest";
import { createShopOverlay } from "./shopOverlay.ts";
import { makeRunState } from "../domain/runState.ts";
import { priceFor } from "../domain/shop.ts";

// ---------------------------------------------------------------------------
// Structure tests
// ---------------------------------------------------------------------------

describe("createShopOverlay — structure", () => {
  it("returns an element with data-role='shop-overlay'", () => {
    const overlay = createShopOverlay();
    expect(overlay.element.dataset.role).toBe("shop-overlay");
    overlay.destroy();
  });

  it("has exactly 5 size buttons", () => {
    const overlay = createShopOverlay();
    const buttons = overlay.element.querySelectorAll("[data-size]");
    expect(buttons).toHaveLength(5);
    overlay.destroy();
  });

  it("size buttons have data-size 1..5", () => {
    const overlay = createShopOverlay();
    for (let size = 1; size <= 5; size++) {
      const btn = overlay.element.querySelector(
        `[data-size="${size.toString()}"]`,
      );
      expect(btn).not.toBeNull();
    }
    overlay.destroy();
  });

  it("each size button shows the correct price", () => {
    const overlay = createShopOverlay();
    const state = makeRunState();
    overlay.refresh(state, 999);
    for (let size = 1; size <= 5; size++) {
      const btn = overlay.element.querySelector(
        `[data-size="${size.toString()}"]`,
      );
      expect(btn?.textContent).toContain(
        priceFor(size as 1 | 2 | 3 | 4 | 5).toString(),
      );
    }
    overlay.destroy();
  });
});

// ---------------------------------------------------------------------------
// Show / hide
// ---------------------------------------------------------------------------

describe("createShopOverlay — show/hide", () => {
  it("starts hidden", () => {
    const overlay = createShopOverlay();
    expect(overlay.element.style.display).toBe("none");
    overlay.destroy();
  });

  it("show() makes it visible", () => {
    const overlay = createShopOverlay();
    overlay.show();
    expect(overlay.element.style.display).not.toBe("none");
    overlay.destroy();
  });

  it("hide() makes it hidden again", () => {
    const overlay = createShopOverlay();
    overlay.show();
    overlay.hide();
    expect(overlay.element.style.display).toBe("none");
    overlay.destroy();
  });
});

// ---------------------------------------------------------------------------
// Disabled state
// ---------------------------------------------------------------------------

describe("createShopOverlay — disabled state", () => {
  it("size button is disabled when balance < price", () => {
    const overlay = createShopOverlay();
    const state = makeRunState();
    // balance=0 < price[1]=3 → disabled
    overlay.refresh(state, 0);
    const btn =
      overlay.element.querySelector<HTMLButtonElement>("[data-size='1']");
    expect(btn?.disabled).toBe(true);
    overlay.destroy();
  });

  it("size button is enabled when balance === price", () => {
    const overlay = createShopOverlay();
    const state = makeRunState();
    overlay.refresh(state, priceFor(1)); // balance === price[1]
    const btn =
      overlay.element.querySelector<HTMLButtonElement>("[data-size='1']");
    expect(btn?.disabled).toBe(false);
    overlay.destroy();
  });

  it("size button is enabled when balance > price", () => {
    const overlay = createShopOverlay();
    const state = makeRunState();
    overlay.refresh(state, 999);
    const btn =
      overlay.element.querySelector<HTMLButtonElement>("[data-size='1']");
    expect(btn?.disabled).toBe(false);
    overlay.destroy();
  });

  it("higher size buttons are disabled when balance is insufficient", () => {
    const overlay = createShopOverlay();
    const state = makeRunState();
    // balance=3 → size1 enabled, size2 (price=8) disabled
    overlay.refresh(state, 3);
    const btn2 =
      overlay.element.querySelector<HTMLButtonElement>("[data-size='2']");
    expect(btn2?.disabled).toBe(true);
    overlay.destroy();
  });

  it("refresh updates disabled states dynamically", () => {
    const overlay = createShopOverlay();
    const state = makeRunState();
    overlay.refresh(state, 0);
    const btn =
      overlay.element.querySelector<HTMLButtonElement>("[data-size='1']");
    expect(btn?.disabled).toBe(true);

    overlay.refresh(state, 100);
    expect(btn?.disabled).toBe(false);
    overlay.destroy();
  });
});

// ---------------------------------------------------------------------------
// onSizeTap callback
// ---------------------------------------------------------------------------

describe("createShopOverlay — onSizeTap", () => {
  it("clicking an enabled button calls onSizeTap with the correct size", () => {
    const overlay = createShopOverlay();
    const state = makeRunState();
    overlay.refresh(state, 999);

    const tapped: number[] = [];
    overlay.onSizeTap = (size) => tapped.push(size);

    const btn =
      overlay.element.querySelector<HTMLButtonElement>("[data-size='1']");
    btn?.click();

    expect(tapped).toHaveLength(1);
    expect(tapped[0]).toBe(1);
    overlay.destroy();
  });

  it("clicking a disabled button does not call onSizeTap", () => {
    const overlay = createShopOverlay();
    const state = makeRunState();
    overlay.refresh(state, 0); // all disabled

    const tapped = vi.fn();
    overlay.onSizeTap = tapped;

    const btn =
      overlay.element.querySelector<HTMLButtonElement>("[data-size='1']");
    btn?.click();

    expect(tapped).not.toHaveBeenCalled();
    overlay.destroy();
  });

  it("tapping size 3 button calls onSizeTap(3)", () => {
    const overlay = createShopOverlay();
    const state = makeRunState();
    overlay.refresh(state, 999);

    const tapped: number[] = [];
    overlay.onSizeTap = (size) => tapped.push(size);

    const btn =
      overlay.element.querySelector<HTMLButtonElement>("[data-size='3']");
    btn?.click();

    expect(tapped[0]).toBe(3);
    overlay.destroy();
  });
});

// ---------------------------------------------------------------------------
// Tap-outside to close
// ---------------------------------------------------------------------------

describe("createShopOverlay — tap-outside closes", () => {
  it("clicking the overlay background (not a button) closes the overlay", () => {
    const overlay = createShopOverlay();
    overlay.show();

    // Simulate click on the overlay itself (not a child)
    const event = new MouseEvent("click", { bubbles: true });
    Object.defineProperty(event, "target", { value: overlay.element });
    overlay.element.dispatchEvent(event);

    expect(overlay.element.style.display).toBe("none");
    overlay.destroy();
  });
});

// ---------------------------------------------------------------------------
// Destroy
// ---------------------------------------------------------------------------

describe("createShopOverlay — destroy", () => {
  it("removes element from parent on destroy", () => {
    const container = document.createElement("div");
    document.body.appendChild(container);
    const overlay = createShopOverlay();
    container.appendChild(overlay.element);

    overlay.destroy();

    expect(container.contains(overlay.element)).toBe(false);
    container.remove();
  });
});

// ---------------------------------------------------------------------------
// Hit-target size
// ---------------------------------------------------------------------------

describe("createShopOverlay — hit targets", () => {
  it("all size buttons have min-width and min-height >= 44px", () => {
    const overlay = createShopOverlay();
    const state = makeRunState();
    overlay.refresh(state, 999);

    for (let size = 1; size <= 5; size++) {
      const btn = overlay.element.querySelector<HTMLButtonElement>(
        `[data-size="${size.toString()}"]`,
      );
      expect(btn).not.toBeNull();
      const minW = parseInt(btn!.style.minWidth, 10);
      const minH = parseInt(btn!.style.minHeight, 10);
      expect(minW).toBeGreaterThanOrEqual(44);
      expect(minH).toBeGreaterThanOrEqual(44);
    }
    overlay.destroy();
  });
});
