import { describe, it, expect } from "vitest";
import { createFusionOverlay } from "./fusionOverlay.ts";
import { makeRunState } from "../domain/runState.ts";
import type { RunState } from "../domain/runState.ts";
import { BESTIARY } from "../../../shared/franchise/bestiary.ts";
import type { FusionTarget } from "../domain/fusion.ts";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Build a state that has two owned creatures of given tiers and tier 6 unlocked. */
const makeStateWithPair = (
  tierA: number,
  tierB: number,
  unlockedFusionTiers: readonly number[] = [6],
): { state: RunState; instanceA: number; instanceB: number } => {
  const base = makeRunState();
  const creatureA = BESTIARY.find((c) => c.tier === tierA)!;
  const creatureB = BESTIARY.find((c) => c.tier === tierB)!;

  const instanceA = base.nextInstanceId;
  const instanceB = base.nextInstanceId + 1;

  const state: RunState = {
    ...base,
    owned: [
      ...base.owned,
      {
        instanceId: instanceA,
        creatureId: creatureA.id,
        position: { x: 10, y: 10 },
        state: "idle" as const,
        stateUntil: 30,
        facing: 1 as const,
        seed: 111,
        walkTargetX: 10,
        walkTargetY: 10,
      },
      {
        instanceId: instanceB,
        creatureId: creatureB.id,
        position: { x: 20, y: 20 },
        state: "idle" as const,
        stateUntil: 30,
        facing: 1 as const,
        seed: 222,
        walkTargetX: 20,
        walkTargetY: 20,
      },
    ],
    nextInstanceId: base.nextInstanceId + 2,
    unlockedFusionTiers,
  };

  return { state, instanceA, instanceB };
};

// ---------------------------------------------------------------------------
// Structure
// ---------------------------------------------------------------------------

describe("createFusionOverlay — structure", () => {
  it("returns an element with data-role='fusion-overlay'", () => {
    const state = makeRunState();
    const overlay = createFusionOverlay();
    overlay.refresh(state);
    expect(overlay.element.dataset.role).toBe("fusion-overlay");
    overlay.destroy();
  });

  it("has exactly 4 target-size buttons (6, 7, 8, 9)", () => {
    const overlay = createFusionOverlay();
    const state = makeRunState();
    overlay.refresh(state);
    const buttons = overlay.element.querySelectorAll("[data-target-size]");
    expect(buttons).toHaveLength(4);
    overlay.destroy();
  });

  it("target buttons exist for sizes 6, 7, 8, 9", () => {
    const overlay = createFusionOverlay();
    const state = makeRunState();
    overlay.refresh(state);
    for (const size of [6, 7, 8, 9]) {
      const btn = overlay.element.querySelector(
        `[data-target-size="${size.toString()}"]`,
      );
      expect(btn).not.toBeNull();
    }
    overlay.destroy();
  });
});

// ---------------------------------------------------------------------------
// Show / hide
// ---------------------------------------------------------------------------

describe("createFusionOverlay — show/hide", () => {
  it("starts hidden", () => {
    const overlay = createFusionOverlay();
    expect(overlay.element.style.display).toBe("none");
    overlay.destroy();
  });

  it("show() makes it visible", () => {
    const overlay = createFusionOverlay();
    overlay.show();
    expect(overlay.element.style.display).not.toBe("none");
    overlay.destroy();
  });

  it("hide() makes it hidden again", () => {
    const overlay = createFusionOverlay();
    overlay.show();
    overlay.hide();
    expect(overlay.element.style.display).toBe("none");
    overlay.destroy();
  });
});

// ---------------------------------------------------------------------------
// Target tier buttons — disabled/enabled based on unlockedFusionTiers
// ---------------------------------------------------------------------------

describe("createFusionOverlay — target tier buttons", () => {
  it("size-6 button is disabled when tier 6 is not unlocked", () => {
    const overlay = createFusionOverlay();
    const state = makeRunState(); // unlockedFusionTiers=[]
    overlay.refresh(state);
    const btn = overlay.element.querySelector<HTMLButtonElement>(
      "[data-target-size='6']",
    );
    expect(btn?.disabled).toBe(true);
    overlay.destroy();
  });

  it("size-6 button is enabled when tier 6 is unlocked", () => {
    const overlay = createFusionOverlay();
    const { state } = makeStateWithPair(1, 5, [6]);
    overlay.refresh(state);
    const btn = overlay.element.querySelector<HTMLButtonElement>(
      "[data-target-size='6']",
    );
    expect(btn?.disabled).toBe(false);
    overlay.destroy();
  });

  it("sizes 7, 8, 9 are disabled by default (not unlocked)", () => {
    const overlay = createFusionOverlay();
    const { state } = makeStateWithPair(1, 5, [6]); // only 6 unlocked
    overlay.refresh(state);
    for (const size of [7, 8, 9]) {
      const btn = overlay.element.querySelector<HTMLButtonElement>(
        `[data-target-size="${size.toString()}"]`,
      );
      expect(btn?.disabled).toBe(true);
    }
    overlay.destroy();
  });

  it("size-7 button is enabled when tier 7 is unlocked", () => {
    const overlay = createFusionOverlay();
    const { state } = makeStateWithPair(1, 5, [6, 7]);
    overlay.refresh(state);
    const btn = overlay.element.querySelector<HTMLButtonElement>(
      "[data-target-size='7']",
    );
    expect(btn?.disabled).toBe(false);
    overlay.destroy();
  });
});

// ---------------------------------------------------------------------------
// Input picker appears after selecting a target
// ---------------------------------------------------------------------------

describe("createFusionOverlay — input picker", () => {
  it("input picker is not visible before a target is selected", () => {
    const overlay = createFusionOverlay();
    const { state } = makeStateWithPair(1, 5, [6]);
    overlay.refresh(state);
    const picker = overlay.element.querySelector(
      "[data-role='fusion-input-picker']",
    );
    // Either absent or hidden
    if (picker !== null) {
      const el = picker as HTMLElement;
      expect(el.style.display).toBe("none");
    } else {
      expect(picker).toBeNull();
    }
    overlay.destroy();
  });

  it("selecting target 6 reveals the input picker", () => {
    const overlay = createFusionOverlay();
    const { state } = makeStateWithPair(1, 5, [6]);
    overlay.refresh(state);
    const btn = overlay.element.querySelector<HTMLButtonElement>(
      "[data-target-size='6']",
    );
    btn!.click();
    const picker = overlay.element.querySelector<HTMLElement>(
      "[data-role='fusion-input-picker']",
    );
    expect(picker).not.toBeNull();
    expect(picker!.style.display).not.toBe("none");
    overlay.destroy();
  });

  it("owned creatures appear as input items after selecting target", () => {
    const overlay = createFusionOverlay();
    const { state, instanceA, instanceB } = makeStateWithPair(1, 5, [6]);
    overlay.refresh(state);

    const btn = overlay.element.querySelector<HTMLButtonElement>(
      "[data-target-size='6']",
    );
    btn!.click();

    const inputA = overlay.element.querySelector(
      `[data-instance-id="${instanceA.toString()}"]`,
    );
    const inputB = overlay.element.querySelector(
      `[data-instance-id="${instanceB.toString()}"]`,
    );
    expect(inputA).not.toBeNull();
    expect(inputB).not.toBeNull();
    overlay.destroy();
  });
});

// ---------------------------------------------------------------------------
// Confirm button
// ---------------------------------------------------------------------------

describe("createFusionOverlay — confirm button", () => {
  it("confirm button is disabled before two inputs are selected", () => {
    const overlay = createFusionOverlay();
    const { state } = makeStateWithPair(1, 5, [6]);
    overlay.refresh(state);

    // Select target 6
    const targetBtn = overlay.element.querySelector<HTMLButtonElement>(
      "[data-target-size='6']",
    );
    targetBtn!.click();

    const confirmBtn = overlay.element.querySelector<HTMLButtonElement>(
      "[data-role='fusion-confirm']",
    );
    expect(confirmBtn?.disabled).toBe(true);
    overlay.destroy();
  });

  it("confirm button enabled after selecting two valid inputs that sum to target", () => {
    const overlay = createFusionOverlay();
    const { state, instanceA, instanceB } = makeStateWithPair(1, 5, [6]);
    overlay.refresh(state);

    // Select target 6
    overlay.element
      .querySelector<HTMLButtonElement>("[data-target-size='6']")!
      .click();

    // Select first input
    overlay.element
      .querySelector<HTMLButtonElement>(
        `[data-instance-id="${instanceA.toString()}"]`,
      )!
      .click();

    // Select second input
    overlay.element
      .querySelector<HTMLButtonElement>(
        `[data-instance-id="${instanceB.toString()}"]`,
      )!
      .click();

    const confirmBtn = overlay.element.querySelector<HTMLButtonElement>(
      "[data-role='fusion-confirm']",
    );
    expect(confirmBtn?.disabled).toBe(false);
    overlay.destroy();
  });

  it("tapping confirm fires onConfirm with correct instanceA, instanceB, targetSize", () => {
    const overlay = createFusionOverlay();
    const { state, instanceA, instanceB } = makeStateWithPair(1, 5, [6]);
    overlay.refresh(state);

    const confirmed: { a: number; b: number; target: FusionTarget }[] = [];
    overlay.onConfirm = (a, b, target) => confirmed.push({ a, b, target });

    // Select target 6
    overlay.element
      .querySelector<HTMLButtonElement>("[data-target-size='6']")!
      .click();

    // Select inputs
    overlay.element
      .querySelector<HTMLButtonElement>(
        `[data-instance-id="${instanceA.toString()}"]`,
      )!
      .click();
    overlay.element
      .querySelector<HTMLButtonElement>(
        `[data-instance-id="${instanceB.toString()}"]`,
      )!
      .click();

    // Confirm
    overlay.element
      .querySelector<HTMLButtonElement>("[data-role='fusion-confirm']")!
      .click();

    expect(confirmed).toHaveLength(1);
    expect(confirmed[0]!.target).toBe(6);
    // instanceA and instanceB should be present (order may vary)
    const ids = [confirmed[0]!.a, confirmed[0]!.b];
    expect(ids).toContain(instanceA);
    expect(ids).toContain(instanceB);
    overlay.destroy();
  });
});

// ---------------------------------------------------------------------------
// Tap-outside closes
// ---------------------------------------------------------------------------

describe("createFusionOverlay — tap-outside closes", () => {
  it("clicking overlay background closes the overlay", () => {
    const overlay = createFusionOverlay();
    overlay.show();

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

describe("createFusionOverlay — destroy", () => {
  it("removes element from parent on destroy", () => {
    const container = document.createElement("div");
    document.body.appendChild(container);
    const overlay = createFusionOverlay();
    container.appendChild(overlay.element);
    overlay.destroy();
    expect(container.contains(overlay.element)).toBe(false);
    container.remove();
  });
});

// ---------------------------------------------------------------------------
// Cost labels on target buttons
// ---------------------------------------------------------------------------

describe("createFusionOverlay — cost labels on target buttons", () => {
  it("size-6 button shows tier label 'Titan' with no cost number (free)", () => {
    const overlay = createFusionOverlay();
    const state = makeRunState();
    overlay.refresh(state, 0);
    const btn = overlay.element.querySelector<HTMLButtonElement>(
      "[data-target-size='6']",
    );
    // Button text should show the tier label "Titan" (free — no cost appended)
    expect(btn?.textContent).toContain("Titan");
    expect(btn?.textContent).not.toContain("100");
    overlay.destroy();
  });

  it("size-7 target button text includes '100'", () => {
    const overlay = createFusionOverlay();
    const { state } = makeStateWithPair(1, 5, [6, 7]);
    overlay.refresh(state, 200);
    const btn = overlay.element.querySelector<HTMLButtonElement>(
      "[data-target-size='7']",
    );
    expect(btn?.textContent).toContain("100");
    overlay.destroy();
  });

  it("size-8 target button text includes '500'", () => {
    const overlay = createFusionOverlay();
    const { state } = makeStateWithPair(1, 5, [6, 7, 8]);
    overlay.refresh(state, 600);
    const btn = overlay.element.querySelector<HTMLButtonElement>(
      "[data-target-size='8']",
    );
    expect(btn?.textContent).toContain("500");
    overlay.destroy();
  });

  it("size-9 target button text includes '2000'", () => {
    const overlay = createFusionOverlay();
    const { state } = makeStateWithPair(1, 5, [6, 7, 8, 9]);
    overlay.refresh(state, 3000);
    const btn = overlay.element.querySelector<HTMLButtonElement>(
      "[data-target-size='9']",
    );
    expect(btn?.textContent).toContain("2000");
    overlay.destroy();
  });
});

// ---------------------------------------------------------------------------
// Confirm button gated on balance >= fusionCost
// ---------------------------------------------------------------------------

describe("createFusionOverlay — confirm button gated on balance", () => {
  it("confirm button disabled when balance < cost for size 7 (balance=50, cost=100)", () => {
    const overlay = createFusionOverlay();
    const { state, instanceA, instanceB } = makeStateWithPair(3, 4, [6, 7]);
    overlay.refresh(state, 50); // balance=50, cost=100

    // Select target 7
    overlay.element
      .querySelector<HTMLButtonElement>("[data-target-size='7']")!
      .click();

    // Select both inputs
    overlay.element
      .querySelector<HTMLButtonElement>(
        `[data-instance-id="${instanceA.toString()}"]`,
      )!
      .click();
    overlay.element
      .querySelector<HTMLButtonElement>(
        `[data-instance-id="${instanceB.toString()}"]`,
      )!
      .click();

    const confirmBtn = overlay.element.querySelector<HTMLButtonElement>(
      "[data-role='fusion-confirm']",
    );
    expect(confirmBtn?.disabled).toBe(true);
    overlay.destroy();
  });

  it("confirm button enabled when balance >= cost for size 7 (balance=100, cost=100)", () => {
    const overlay = createFusionOverlay();
    const { state, instanceA, instanceB } = makeStateWithPair(3, 4, [6, 7]);
    overlay.refresh(state, 100); // balance=100, cost=100

    // Select target 7
    overlay.element
      .querySelector<HTMLButtonElement>("[data-target-size='7']")!
      .click();

    // Select both inputs
    overlay.element
      .querySelector<HTMLButtonElement>(
        `[data-instance-id="${instanceA.toString()}"]`,
      )!
      .click();
    overlay.element
      .querySelector<HTMLButtonElement>(
        `[data-instance-id="${instanceB.toString()}"]`,
      )!
      .click();

    const confirmBtn = overlay.element.querySelector<HTMLButtonElement>(
      "[data-role='fusion-confirm']",
    );
    expect(confirmBtn?.disabled).toBe(false);
    overlay.destroy();
  });

  it("confirm button enabled for size 6 even with 0 balance (free)", () => {
    const overlay = createFusionOverlay();
    const { state, instanceA, instanceB } = makeStateWithPair(1, 5, [6]);
    overlay.refresh(state, 0); // balance=0, cost=0

    // Select target 6
    overlay.element
      .querySelector<HTMLButtonElement>("[data-target-size='6']")!
      .click();

    // Select both inputs
    overlay.element
      .querySelector<HTMLButtonElement>(
        `[data-instance-id="${instanceA.toString()}"]`,
      )!
      .click();
    overlay.element
      .querySelector<HTMLButtonElement>(
        `[data-instance-id="${instanceB.toString()}"]`,
      )!
      .click();

    const confirmBtn = overlay.element.querySelector<HTMLButtonElement>(
      "[data-role='fusion-confirm']",
    );
    expect(confirmBtn?.disabled).toBe(false);
    overlay.destroy();
  });

  it("refresh() with updated balance re-evaluates confirm button state", () => {
    const overlay = createFusionOverlay();
    const { state, instanceA, instanceB } = makeStateWithPair(3, 4, [6, 7]);

    // Low balance — setup confirm should be disabled after selecting
    overlay.refresh(state, 50);
    overlay.element
      .querySelector<HTMLButtonElement>("[data-target-size='7']")!
      .click();
    overlay.element
      .querySelector<HTMLButtonElement>(
        `[data-instance-id="${instanceA.toString()}"]`,
      )!
      .click();
    overlay.element
      .querySelector<HTMLButtonElement>(
        `[data-instance-id="${instanceB.toString()}"]`,
      )!
      .click();

    const confirmBtn = overlay.element.querySelector<HTMLButtonElement>(
      "[data-role='fusion-confirm']",
    )!;
    expect(confirmBtn.disabled).toBe(true);

    // Now update balance to 200 — confirm should become enabled
    overlay.refresh(state, 200);
    expect(confirmBtn.disabled).toBe(false);

    overlay.destroy();
  });
});
