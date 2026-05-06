import type { RunState } from "../domain/runState.ts";
import type { FusionTarget } from "../domain/fusion.ts";
import { fusionCost } from "../domain/fusion.ts";
import { BESTIARY } from "../../../shared/franchise/bestiary.ts";

export interface FusionOverlay {
  readonly element: HTMLDivElement;
  show(): void;
  hide(): void;
  refresh(state: RunState, balance?: number): void;
  destroy(): void;
  onConfirm: (
    instanceA: number,
    instanceB: number,
    targetSize: FusionTarget,
  ) => void;
}

const FUSION_TARGETS: readonly FusionTarget[] = [6, 7, 8, 9];

export const createFusionOverlay = (): FusionOverlay => {
  const overlay = document.createElement("div");
  overlay.dataset.role = "fusion-overlay";
  overlay.style.cssText = [
    "position:absolute",
    "inset:0",
    "display:none",
    "flex-direction:column",
    "align-items:center",
    "justify-content:flex-start",
    "background:rgba(0,0,0,0.88)",
    "z-index:200",
    "overflow-y:auto",
    "padding:8px",
    "box-sizing:border-box",
  ].join(";");

  // Title
  const title = document.createElement("div");
  title.style.cssText = [
    "color:#fff",
    "font-family:monospace",
    "font-size:12px",
    "margin-bottom:8px",
    "font-weight:bold",
    "width:100%",
    "text-align:center",
  ].join(";");
  title.textContent = "Fusion";
  overlay.appendChild(title);

  // Target picker container
  const targetContainer = document.createElement("div");
  targetContainer.style.cssText = [
    "display:flex",
    "flex-direction:row",
    "gap:4px",
    "margin-bottom:8px",
    "width:100%",
    "justify-content:center",
  ].join(";");
  overlay.appendChild(targetContainer);

  // Target buttons
  const targetButtons = new Map<FusionTarget, HTMLButtonElement>();
  for (const size of FUSION_TARGETS) {
    const btn = document.createElement("button");
    btn.dataset.targetSize = String(size);
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
      "padding:4px 8px",
      "box-sizing:border-box",
    ].join(";");
    btn.textContent = size.toString();
    btn.disabled = true;
    targetContainer.appendChild(btn);
    targetButtons.set(size, btn);
  }

  // Input picker — shown after target is selected
  const inputPicker = document.createElement("div");
  inputPicker.dataset.role = "fusion-input-picker";
  inputPicker.style.cssText = [
    "display:none",
    "flex-direction:column",
    "gap:4px",
    "width:100%",
    "max-height:200px",
    "overflow-y:auto",
    "margin-bottom:8px",
  ].join(";");
  overlay.appendChild(inputPicker);

  // Confirm button
  const confirmBtn = document.createElement("button");
  confirmBtn.dataset.role = "fusion-confirm";
  confirmBtn.style.cssText = [
    "min-width:80px",
    "min-height:44px",
    "background:rgba(40,80,40,0.9)",
    "color:#fff",
    "font-family:monospace",
    "font-size:11px",
    "border:1px solid #4a4",
    "border-radius:4px",
    "cursor:pointer",
    "padding:4px 12px",
    "box-sizing:border-box",
    "margin-top:4px",
  ].join(";");
  confirmBtn.textContent = "Fuse";
  confirmBtn.disabled = true;
  overlay.appendChild(confirmBtn);

  // State
  let selectedTarget: FusionTarget | null = null;
  let selectedA: number | null = null;
  let selectedB: number | null = null;
  let currentState: RunState | null = null;
  let currentBalance = 0;

  let onConfirmCb: (
    instanceA: number,
    instanceB: number,
    targetSize: FusionTarget,
  ) => void = () => undefined;

  const updateConfirmBtn = (): void => {
    if (
      selectedTarget === null ||
      selectedA === null ||
      selectedB === null ||
      currentState === null
    ) {
      confirmBtn.disabled = true;
      return;
    }
    // Validate sum
    const ca = currentState.owned.find((c) => c.instanceId === selectedA);
    const cb = currentState.owned.find((c) => c.instanceId === selectedB);
    if (ca === undefined || cb === undefined) {
      confirmBtn.disabled = true;
      return;
    }
    const tierA = BESTIARY[ca.creatureId]?.tier;
    const tierB = BESTIARY[cb.creatureId]?.tier;
    const sumValid =
      tierA !== undefined &&
      tierB !== undefined &&
      tierA + tierB === selectedTarget;
    const cost = fusionCost(selectedTarget);
    confirmBtn.disabled = !(sumValid && currentBalance >= cost);
  };

  const buildInputPicker = (state: RunState): void => {
    // Clear existing buttons
    inputPicker.innerHTML = "";
    selectedA = null;
    selectedB = null;
    updateConfirmBtn();

    for (const creature of state.owned) {
      const shape = BESTIARY[creature.creatureId];
      const btn = document.createElement("button");
      btn.dataset.instanceId = String(creature.instanceId);
      btn.style.cssText = [
        "min-width:44px",
        "min-height:44px",
        "background:rgba(40,40,80,0.9)",
        "color:#fff",
        "font-family:monospace",
        "font-size:10px",
        "border:1px solid #666",
        "border-radius:4px",
        "cursor:pointer",
        "padding:4px 8px",
        "box-sizing:border-box",
        "text-align:left",
      ].join(";");
      const tierLabel = shape !== undefined ? `T${shape.tier.toString()}` : "?";
      const name = shape?.nameDe ?? "?";
      btn.textContent = `[${tierLabel}] ${name} #${creature.instanceId.toString()}`;

      btn.addEventListener("click", () => {
        if (selectedA === null) {
          selectedA = creature.instanceId;
          btn.style.background = "rgba(80,80,20,0.9)";
        } else if (selectedB === null && creature.instanceId !== selectedA) {
          selectedB = creature.instanceId;
          btn.style.background = "rgba(80,80,20,0.9)";
        } else if (creature.instanceId === selectedA) {
          // Deselect A
          selectedA = selectedB;
          selectedB = null;
          btn.style.background = "rgba(40,40,80,0.9)";
          // Un-highlight B if it was selected
          const bBtn = inputPicker.querySelector<HTMLButtonElement>(
            selectedA !== null
              ? `[data-instance-id="${selectedA.toString()}"]`
              : "",
          );
          if (bBtn !== null) bBtn.style.background = "rgba(80,80,20,0.9)";
        } else if (creature.instanceId === selectedB) {
          selectedB = null;
          btn.style.background = "rgba(40,40,80,0.9)";
        }
        updateConfirmBtn();
      });

      inputPicker.appendChild(btn);
    }

    inputPicker.style.display = "flex";
  };

  // Wire target buttons
  for (const size of FUSION_TARGETS) {
    const btn = targetButtons.get(size);
    if (btn === undefined) continue;
    btn.addEventListener("click", () => {
      if (btn.disabled || currentState === null) return;
      selectedTarget = size;
      // Highlight selected
      for (const [, b] of targetButtons) {
        b.style.background = "rgba(40,40,80,0.9)";
      }
      btn.style.background = "rgba(80,40,80,0.9)";
      buildInputPicker(currentState);
    });
  }

  // Wire confirm button
  confirmBtn.addEventListener("click", () => {
    if (
      confirmBtn.disabled ||
      selectedTarget === null ||
      selectedA === null ||
      selectedB === null
    )
      return;
    onConfirmCb(selectedA, selectedB, selectedTarget);
    hide();
  });

  // Tap-outside to close
  overlay.addEventListener("click", (e) => {
    if (e.target === overlay) {
      hide();
    }
  });

  const show = (): void => {
    overlay.style.display = "flex";
  };

  const hide = (): void => {
    overlay.style.display = "none";
    // Reset selection state
    selectedTarget = null;
    selectedA = null;
    selectedB = null;
    inputPicker.style.display = "none";
    inputPicker.innerHTML = "";
    confirmBtn.disabled = true;
    for (const [, b] of targetButtons) {
      b.style.background = "rgba(40,40,80,0.9)";
    }
  };

  const TIER_LABELS: Record<FusionTarget, string> = {
    6: "Titan",
    7: "Apex",
    8: "Archon",
    9: "Vollkommen",
  };

  const refresh = (state: RunState, balance = 0): void => {
    currentState = state;
    currentBalance = balance;
    // Update target button disabled states and cost labels
    for (const size of FUSION_TARGETS) {
      const btn = targetButtons.get(size);
      if (btn === undefined) continue;
      btn.disabled = !state.unlockedFusionTiers.includes(size);
      btn.style.opacity = btn.disabled ? "0.4" : "1";
      const cost = fusionCost(size);
      const label = TIER_LABELS[size];
      btn.textContent = cost > 0 ? `${label} (${cost.toString()})` : label;
    }
    // Re-evaluate confirm button in case balance changed
    updateConfirmBtn();
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
    get onConfirm(): (
      instanceA: number,
      instanceB: number,
      targetSize: FusionTarget,
    ) => void {
      return onConfirmCb;
    },
    set onConfirm(
      cb: (
        instanceA: number,
        instanceB: number,
        targetSize: FusionTarget,
      ) => void,
    ) {
      onConfirmCb = cb;
    },
  };
};
