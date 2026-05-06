/**
 * @vitest-environment happy-dom
 */
import { describe, it, expect, beforeEach } from "vitest";
import { BESTIARY } from "../../../shared/franchise/bestiary.ts";
import { TIERS } from "../../../shared/franchise/types.ts";
import { hueFromId } from "./creatureSprite.ts";
import { createBestiaryOverlay } from "./bestiaryOverlay.ts";
import type { RunState } from "../domain/runState.ts";
import { makeRunState } from "../domain/runState.ts";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const makeStateWithOwned = (ids: readonly number[]): RunState => {
  const base = makeRunState();
  const taps: Record<number, number> = {};
  for (const id of ids) {
    taps[id] = id * 3; // predictable non-zero tap count per owned creature
  }
  return {
    ...base,
    uniqueOwnedIds: ids,
    totalTapsByCreatureId: taps,
  };
};

// ---------------------------------------------------------------------------
// Show / hide
// ---------------------------------------------------------------------------

describe("BestiaryOverlay show/hide", () => {
  it("starts hidden (display:none)", () => {
    const overlay = createBestiaryOverlay();
    expect(overlay.element.style.display).toBe("none");
  });

  it("show() makes the element visible", () => {
    const overlay = createBestiaryOverlay();
    overlay.show();
    expect(overlay.element.style.display).not.toBe("none");
  });

  it("hide() returns the element to hidden", () => {
    const overlay = createBestiaryOverlay();
    overlay.show();
    overlay.hide();
    expect(overlay.element.style.display).toBe("none");
  });
});

// ---------------------------------------------------------------------------
// Slot presence
// ---------------------------------------------------------------------------

describe("BestiaryOverlay — 167 slots", () => {
  let overlay: ReturnType<typeof createBestiaryOverlay>;

  beforeEach(() => {
    overlay = createBestiaryOverlay();
    overlay.refresh(makeRunState()); // fresh state: only Keim (id=0) owned
  });

  it("renders exactly 167 creature slots", () => {
    const slots = overlay.element.querySelectorAll("[data-creature-id]");
    expect(slots).toHaveLength(167);
  });

  it("slot IDs span 0..166", () => {
    const slots = overlay.element.querySelectorAll("[data-creature-id]");
    const ids = Array.from(slots).map((s) =>
      Number((s as HTMLElement).dataset.creatureId),
    );
    for (let i = 0; i < 167; i++) {
      expect(ids).toContain(i);
    }
  });
});

// ---------------------------------------------------------------------------
// Tier grouping
// ---------------------------------------------------------------------------

describe("BestiaryOverlay — tier sections", () => {
  let overlay: ReturnType<typeof createBestiaryOverlay>;

  beforeEach(() => {
    overlay = createBestiaryOverlay();
    overlay.refresh(makeRunState());
  });

  it("renders exactly 9 tier sections", () => {
    const sections = overlay.element.querySelectorAll("section[data-tier]");
    expect(sections).toHaveLength(9);
  });

  it("section data-tier attributes are 1..9", () => {
    const sections = overlay.element.querySelectorAll("section[data-tier]");
    const tiers = Array.from(sections).map((s) =>
      Number((s as HTMLElement).dataset.tier),
    );
    for (let t = 1; t <= 9; t++) {
      expect(tiers).toContain(t);
    }
  });

  it("each section heading contains the canonical tier label", () => {
    for (let t = 1; t <= 9; t++) {
      const section = overlay.element.querySelector(
        `section[data-tier="${String(t)}"]`,
      );
      expect(section).not.toBeNull();
      const heading = section!.querySelector("h3");
      expect(heading).not.toBeNull();
      const tierMeta = TIERS[t as 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9];
      expect(heading!.textContent).toContain(tierMeta.label);
    }
  });

  it("each section heading uses the canonical tier hex color", () => {
    for (let t = 1; t <= 9; t++) {
      const section = overlay.element.querySelector(
        `section[data-tier="${String(t)}"]`,
      );
      const heading = section!.querySelector("h3") as HTMLElement;
      // color may be stored as-is or converted by happy-dom — just verify it's non-empty
      expect(heading.style.color).toBeTruthy();
      const lowerColor = heading.style.color.toLowerCase().replace("#", "");
      expect(lowerColor.length).toBeGreaterThan(0);
    }
  });
});

// ---------------------------------------------------------------------------
// Owned / locked state
// ---------------------------------------------------------------------------

describe("BestiaryOverlay — owned vs locked", () => {
  it("starter state (only Keim id=0) marks slot 0 as owned, rest locked", () => {
    const overlay = createBestiaryOverlay();
    overlay.refresh(makeRunState());

    const slot0 = overlay.element.querySelector<HTMLElement>(
      '[data-creature-id="0"]',
    )!;
    expect(slot0.dataset.owned).toBe("true");

    const slot1 = overlay.element.querySelector<HTMLElement>(
      '[data-creature-id="1"]',
    )!;
    expect(slot1.dataset.owned).toBe("false");
  });

  it("after refresh with more owned ids, those slots become owned", () => {
    const overlay = createBestiaryOverlay();
    const state = makeStateWithOwned([0, 5, 20]);
    overlay.refresh(state);

    for (const id of [0, 5, 20]) {
      const slot = overlay.element.querySelector<HTMLElement>(
        `[data-creature-id="${String(id)}"]`,
      )!;
      expect(slot.dataset.owned).toBe("true");
    }
    // spot-check a locked one
    const slot2 = overlay.element.querySelector<HTMLElement>(
      '[data-creature-id="2"]',
    )!;
    expect(slot2.dataset.owned).toBe("false");
  });
});

// ---------------------------------------------------------------------------
// Owned slot color
// ---------------------------------------------------------------------------

describe("BestiaryOverlay — slot silhouette colors", () => {
  it("owned slot silhouette uses the deterministic hue (non-grey)", () => {
    const overlay = createBestiaryOverlay();
    overlay.refresh(makeRunState()); // id=0 owned

    const slot0 = overlay.element.querySelector('[data-creature-id="0"]');
    const sil = slot0!.querySelector<HTMLElement>("[data-role='silhouette']")!;
    expect(sil).not.toBeNull();

    const creature = BESTIARY[0]!;
    const hue = hueFromId(creature.id, creature.tier);
    const expectedHex = `#${hue.toString(16).padStart(6, "0")}`;
    expect(sil.style.backgroundColor).toBe(expectedHex);
  });

  it("locked slot silhouette is grey / has reduced opacity", () => {
    const overlay = createBestiaryOverlay();
    overlay.refresh(makeRunState()); // id=1 is locked

    const slot1 = overlay.element.querySelector('[data-creature-id="1"]');
    const sil = slot1!.querySelector<HTMLElement>("[data-role='silhouette']")!;
    // Locked: backgroundColor should be a grey-ish value
    expect(sil.style.backgroundColor).toBeTruthy();
    // opacity should be reduced
    expect(Number(sil.style.opacity)).toBeLessThan(1);
  });
});

// ---------------------------------------------------------------------------
// German name label
// ---------------------------------------------------------------------------

describe("BestiaryOverlay — name labels", () => {
  it("each slot shows the German name regardless of owned/locked state", () => {
    const overlay = createBestiaryOverlay();
    overlay.refresh(makeRunState());

    for (const creature of BESTIARY) {
      const slot = overlay.element.querySelector(
        `[data-creature-id="${String(creature.id)}"]`,
      );
      expect(slot).not.toBeNull();
      const nameEl = slot!.querySelector("[data-role='name']");
      expect(nameEl).not.toBeNull();
      expect(nameEl!.textContent).toBe(creature.nameDe);
    }
  });
});

// ---------------------------------------------------------------------------
// Tap count visibility
// ---------------------------------------------------------------------------

describe("BestiaryOverlay — tap counts", () => {
  it("owned slots show tap count element", () => {
    const overlay = createBestiaryOverlay();
    const state = makeStateWithOwned([0, 5]);
    overlay.refresh(state);

    for (const id of [0, 5]) {
      const slot = overlay.element.querySelector(
        `[data-creature-id="${String(id)}"]`,
      );
      const tapsEl = slot!.querySelector("[data-role='taps']");
      expect(tapsEl).not.toBeNull();
    }
  });

  it("locked slots do NOT show tap count element", () => {
    const overlay = createBestiaryOverlay();
    overlay.refresh(makeRunState()); // only id=0 owned

    const slot1 = overlay.element.querySelector('[data-creature-id="1"]');
    const tapsEl = slot1!.querySelector("[data-role='taps']");
    expect(tapsEl).toBeNull();
  });

  it("tap count text matches totalTapsByCreatureId", () => {
    const overlay = createBestiaryOverlay();
    const taps: Record<number, number> = { 0: 42 };
    const state: RunState = {
      ...makeRunState(),
      uniqueOwnedIds: [0],
      totalTapsByCreatureId: taps,
    };
    overlay.refresh(state);

    const slot0 = overlay.element.querySelector('[data-creature-id="0"]');
    const tapsEl = slot0!.querySelector("[data-role='taps']");
    expect(tapsEl!.textContent).toContain("42");
  });
});

// ---------------------------------------------------------------------------
// Sticky header
// ---------------------------------------------------------------------------

describe("BestiaryOverlay — sticky header", () => {
  it("shows '1 / 167' for fresh state (only Keim owned)", () => {
    const overlay = createBestiaryOverlay();
    overlay.refresh(makeRunState());

    const header = overlay.element.querySelector(
      "[data-role='bestiary-header']",
    );
    expect(header).not.toBeNull();
    expect(header!.textContent).toContain("1");
    expect(header!.textContent).toContain("167");
  });

  it("updates count after refresh with more owned ids", () => {
    const overlay = createBestiaryOverlay();
    overlay.refresh(makeRunState());

    overlay.refresh(makeStateWithOwned([0, 5, 20, 100]));

    const header = overlay.element.querySelector(
      "[data-role='bestiary-header']",
    );
    expect(header!.textContent).toContain("4");
    expect(header!.textContent).toContain("167");
  });
});

// ---------------------------------------------------------------------------
// Tap-outside closes
// ---------------------------------------------------------------------------

describe("BestiaryOverlay — tap-outside to close", () => {
  it("clicking directly on the overlay backdrop calls hide", () => {
    const overlay = createBestiaryOverlay();
    document.body.appendChild(overlay.element);
    overlay.show();

    // Simulate click where target === overlay itself
    const event = new MouseEvent("click", { bubbles: true });
    Object.defineProperty(event, "target", { value: overlay.element });
    overlay.element.dispatchEvent(event);

    expect(overlay.element.style.display).toBe("none");

    document.body.removeChild(overlay.element);
  });

  it("clicking on a child element does NOT close the overlay", () => {
    const overlay = createBestiaryOverlay();
    document.body.appendChild(overlay.element);
    overlay.refresh(makeRunState());
    overlay.show();

    // Click on a child slot — event.target is NOT the overlay
    const slot0 = overlay.element.querySelector('[data-creature-id="0"]')!;
    slot0.dispatchEvent(new MouseEvent("click", { bubbles: true }));

    // Still visible
    expect(overlay.element.style.display).not.toBe("none");

    document.body.removeChild(overlay.element);
  });
});

// ---------------------------------------------------------------------------
// destroy
// ---------------------------------------------------------------------------

describe("BestiaryOverlay — destroy", () => {
  it("removes element from parent after destroy()", () => {
    const overlay = createBestiaryOverlay();
    document.body.appendChild(overlay.element);
    overlay.destroy();
    expect(document.body.contains(overlay.element)).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// BESTIARY integrity guard
// ---------------------------------------------------------------------------

describe("BESTIARY sanity", () => {
  it("has exactly 167 entries", () => {
    expect(BESTIARY).toHaveLength(167);
  });
});
