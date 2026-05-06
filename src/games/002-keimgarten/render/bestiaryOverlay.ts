import { BESTIARY } from "../../../shared/franchise/bestiary.ts";
import { TIERS } from "../../../shared/franchise/types.ts";
import type { FranchiseTier } from "../../../shared/franchise/types.ts";
import type { RunState } from "../domain/runState.ts";
import { hueFromId } from "./creatureSprite.ts";

export interface BestiaryOverlay {
  readonly element: HTMLDivElement;
  show(): void;
  hide(): void;
  refresh(state: RunState): void;
  destroy(): void;
}

export const createBestiaryOverlay = (): BestiaryOverlay => {
  const overlay = document.createElement("div");
  overlay.dataset.role = "bestiary-overlay";
  overlay.style.cssText = [
    "position:absolute",
    "inset:0",
    "display:none",
    "flex-direction:column",
    "background:rgba(0,0,0,0.85)",
    "z-index:100",
    "overflow:hidden",
  ].join(";");

  // Sticky header
  const stickyHeader = document.createElement("header");
  stickyHeader.dataset.role = "bestiary-header";
  stickyHeader.style.cssText = [
    "position:sticky",
    "top:0",
    "background:rgba(0,0,0,0.9)",
    "color:#fff",
    "font-family:monospace",
    "font-size:11px",
    "padding:6px 8px",
    "flex-shrink:0",
    "z-index:1",
  ].join(";");

  // Scrollable list
  const list = document.createElement("div");
  list.dataset.role = "bestiary-list";
  list.style.cssText = ["overflow-y:auto", "flex:1", "padding:4px"].join(";");

  overlay.appendChild(stickyHeader);
  overlay.appendChild(list);

  // Tap-outside to close: only when target is the overlay itself
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
  };

  // Start hidden
  hide();

  const refresh = (state: RunState): void => {
    const ownedSet = new Set(state.uniqueOwnedIds);
    stickyHeader.textContent = `${ownedSet.size.toString()} / ${BESTIARY.length.toString()}`;

    list.replaceChildren();

    // Group BESTIARY by tier
    const byTier = new Map<number, typeof BESTIARY>();
    for (const creature of BESTIARY) {
      const existing = byTier.get(creature.tier);
      if (existing !== undefined) {
        byTier.set(creature.tier, [...existing, creature]);
      } else {
        byTier.set(creature.tier, [creature]);
      }
    }

    const tierNums: FranchiseTier[] = [1, 2, 3, 4, 5, 6, 7, 8, 9];
    for (const tier of tierNums) {
      const tierMeta = TIERS[tier];
      const creatures = byTier.get(tier) ?? [];

      const section = document.createElement("section");
      section.dataset.tier = String(tier);
      section.style.cssText = "margin-bottom:8px";

      const heading = document.createElement("h3");
      heading.style.color = tierMeta.hex;
      heading.style.cssText = [
        `color:${tierMeta.hex}`,
        "font-family:monospace",
        "font-size:10px",
        "margin:4px 0 2px",
        "padding:2px 4px",
        "border-bottom:1px solid currentColor",
      ].join(";");
      heading.textContent = `${tierMeta.label} — ${tierMeta.sub}`;
      section.appendChild(heading);

      for (const creature of creatures) {
        const slot = document.createElement("div");
        slot.dataset.creatureId = String(creature.id);
        const isOwned = ownedSet.has(creature.id);
        slot.dataset.owned = isOwned ? "true" : "false";
        slot.style.cssText = [
          "display:flex",
          "align-items:center",
          "gap:4px",
          "padding:2px 4px",
          "min-height:44px",
          "box-sizing:border-box",
        ].join(";");

        // Silhouette block
        const silhouette = document.createElement("span");
        silhouette.dataset.role = "silhouette";
        silhouette.style.cssText = [
          "display:inline-block",
          "width:12px",
          "height:12px",
          "flex-shrink:0",
          "border-radius:2px",
        ].join(";");

        if (isOwned) {
          const hue = hueFromId(creature.id, creature.tier);
          silhouette.style.backgroundColor = `#${hue.toString(16).padStart(6, "0")}`;
        } else {
          silhouette.style.backgroundColor = "#666";
          silhouette.style.opacity = "0.5";
        }

        // German name label
        const nameLabel = document.createElement("span");
        nameLabel.dataset.role = "name";
        nameLabel.style.cssText = [
          "color:#ddd",
          "font-family:monospace",
          "font-size:9px",
          "flex:1",
          "white-space:nowrap",
          "overflow:hidden",
          "text-overflow:ellipsis",
        ].join(";");
        nameLabel.textContent = creature.nameDe;

        slot.appendChild(silhouette);
        slot.appendChild(nameLabel);

        // Tap count (owned only)
        if (isOwned) {
          const tapCount = state.totalTapsByCreatureId[creature.id] ?? 0;
          const tapEl = document.createElement("span");
          tapEl.dataset.role = "taps";
          tapEl.style.cssText = [
            "color:#aaa",
            "font-family:monospace",
            "font-size:8px",
            "flex-shrink:0",
          ].join(";");
          tapEl.textContent = `${tapCount.toString()} taps`;
          slot.appendChild(tapEl);
        }

        section.appendChild(slot);
      }

      list.appendChild(section);
    }
  };

  const destroy = (): void => {
    if (overlay.parentNode !== null) {
      overlay.parentNode.removeChild(overlay);
    }
  };

  return { element: overlay, show, hide, refresh, destroy };
};
