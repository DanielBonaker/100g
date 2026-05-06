import type { Game, GameContext, Persistence } from "../../engine/Game.ts";
import type { Achievements, Audio, Economy } from "../../engine/services.ts";
import type { Disposer } from "../../services/input/types.ts";
import type { DragEvent as InputDragEvent } from "../../services/input/types.ts";
import {
  makeRunState,
  BOARD_COLS,
  BOARD_ROWS,
  commitActive,
  exitShop,
} from "./domain/board.ts";
import { swapHold, holdCapacity } from "./domain/hold.ts";
import type { RunState } from "./domain/board.ts";
import { isRunState } from "./domain/runState.ts";
import { makeRng } from "./domain/rng.ts";
import { manifest } from "./manifest.ts";
import {
  purchaseBooster,
  pickFromBooster,
  purchaseRemove,
  pickRemove,
  acceptPassive,
  declinePassive,
  REMOVE_COST,
  MIN_DECK_SIZE,
} from "./domain/shop.ts";
import type { BoosterTier } from "./domain/shop.ts";
import { findPassive } from "./catalog/passives.ts";

// ---------------------------------------------------------------------------
// Layout constants
// ---------------------------------------------------------------------------

const CELL_SIZE = 40; // px per cell
const BOARD_PIXEL_W = BOARD_COLS * CELL_SIZE;
const BOARD_PIXEL_H = BOARD_ROWS * CELL_SIZE;

// Each full cell-width of drag maps to one column shift
const DRAG_COL_THRESHOLD = CELL_SIZE;

// ---------------------------------------------------------------------------
// Audio — effectId → soundId mapping
// ---------------------------------------------------------------------------

const EFFECT_SOUND: Readonly<Record<string, string>> = {
  standard: "dd-block-land",
  ghost: "dd-block-land",
  melt: "dd-melt-splash",
  impact: "dd-impact-boom",
  rain: "dd-rain-patter",
};

// ---------------------------------------------------------------------------
// Achievement IDs
// ---------------------------------------------------------------------------

const ACH_ROWS_100 = "dd-rows-100";
const ACH_ROUND_10 = "dd-round-10";
const ACH_DECK_20 = "dd-deck-20";
const GAME_ID = "001-drop-deck";

// ---------------------------------------------------------------------------
// Pixi types — imported lazily so happy-dom tests can still run
// ---------------------------------------------------------------------------

interface PixiApp {
  canvas: HTMLCanvasElement;
  init(opts: unknown): Promise<void>;
  stage: { addChild(child: unknown): void; removeChild(child: unknown): void };
  destroy: (options?: unknown) => void;
}

interface PixiGraphics {
  clear: () => PixiGraphics;
  rect: (x: number, y: number, w: number, h: number) => PixiGraphics;
  fill: (color: number | string) => PixiGraphics;
  stroke: (opts: { color: number | string; width: number }) => PixiGraphics;
}

// ---------------------------------------------------------------------------
// Rendering helpers — work with both Pixi Graphics and null (test fallback)
// ---------------------------------------------------------------------------

const drawBoard = (
  gfx: PixiGraphics | null,
  ctx2d: CanvasRenderingContext2D | null,
  state: RunState,
): void => {
  if (gfx !== null) {
    gfx.clear();

    // Board background
    gfx
      .rect(0, 0, BOARD_PIXEL_W, BOARD_PIXEL_H)
      .fill(0x1a1a2e)
      .rect(0, 0, BOARD_PIXEL_W, BOARD_PIXEL_H)
      .stroke({ color: 0x4a4a8a, width: 1 });

    // Grid lines
    for (let c = 0; c <= BOARD_COLS; c++) {
      gfx.rect(c * CELL_SIZE, 0, 1, BOARD_PIXEL_H).fill(0x2a2a4a);
    }
    for (let r = 0; r <= BOARD_ROWS; r++) {
      gfx.rect(0, r * CELL_SIZE, BOARD_PIXEL_W, 1).fill(0x2a2a4a);
    }

    // Placed cells
    for (let r = 0; r < BOARD_ROWS; r++) {
      for (let c = 0; c < BOARD_COLS; c++) {
        if ((state.board[r]?.[c] ?? null) !== null) {
          gfx
            .rect(
              c * CELL_SIZE + 2,
              r * CELL_SIZE + 2,
              CELL_SIZE - 4,
              CELL_SIZE - 4,
            )
            .fill(0x44aaff);
        }
      }
    }

    // Active block preview — render all cells of the active block
    if (state.status === "running" && state.active !== null) {
      for (const { dx, dy } of state.active.cells) {
        gfx
          .rect(
            (state.activeColumn + dx) * CELL_SIZE + 2,
            dy * CELL_SIZE + 2,
            CELL_SIZE - 4,
            CELL_SIZE - 4,
          )
          .fill(0xffdd44);
      }
    }
  } else if (ctx2d !== null) {
    // Minimal 2D canvas fallback for test environments
    ctx2d.clearRect(0, 0, BOARD_PIXEL_W, BOARD_PIXEL_H);
    ctx2d.fillStyle = "#1a1a2e";
    ctx2d.fillRect(0, 0, BOARD_PIXEL_W, BOARD_PIXEL_H);
  }
};

// ---------------------------------------------------------------------------
// Achievement threshold checks — called after every commit
// ---------------------------------------------------------------------------

const checkAchievements = (
  state: RunState,
  achievements: Achievements,
): RunState => {
  let updated = state;

  // dd-rows-100: once per run (tracked via achievementsUnlockedThisRun)
  if (
    updated.clearedRowsThisRun >= 100 &&
    !updated.achievementsUnlockedThisRun.includes(ACH_ROWS_100)
  ) {
    achievements.unlock(GAME_ID, ACH_ROWS_100);
    updated = {
      ...updated,
      achievementsUnlockedThisRun: [
        ...updated.achievementsUnlockedThisRun,
        ACH_ROWS_100,
      ],
    };
  }

  // dd-round-10: once per save (idempotent in service; RunState tracks for run dedup)
  if (updated.highestRoundReached >= 10) {
    achievements.unlock(GAME_ID, ACH_ROUND_10);
  }

  // dd-deck-20: once per save (idempotent in service)
  if (updated.deck.length >= 20) {
    achievements.unlock(GAME_ID, ACH_DECK_20);
  }

  return updated;
};

// ---------------------------------------------------------------------------
// Currency yield on run-end
// ---------------------------------------------------------------------------

const emitYield = (state: RunState, economy: Economy): void => {
  economy.addYield(GAME_ID, manifest.currencyYield(state));
};

// ---------------------------------------------------------------------------
// Shop UI helpers
// ---------------------------------------------------------------------------

const BOOSTER_TIERS: readonly BoosterTier[] = ["small", "medium", "large"];
const BOOSTER_LABELS: Record<BoosterTier, string> = {
  small: "Small $2",
  medium: "Medium $5",
  large: "Large $10",
};

// Build the shop overlay DOM node. Returns it unmounted — caller appends.
// The overlay is re-rendered on every relevant state change by
// syncShopOverlay below.
const buildShopEl = (): HTMLDivElement => {
  const el = document.createElement("div");
  el.setAttribute("data-role", "shop");
  el.style.cssText =
    "position:absolute;top:0;left:0;width:100%;height:100%;" +
    "background:rgba(10,10,20,0.92);display:flex;flex-direction:column;" +
    "align-items:center;justify-content:center;gap:12px;color:#fff;" +
    "font-family:monospace;z-index:10;";
  return el;
};

// ---------------------------------------------------------------------------
// Game factory
// ---------------------------------------------------------------------------

export const createDropDeckGame = (): Game & { __getRunState(): RunState } => {
  let runState: RunState = makeRunState();
  let canvas: HTMLCanvasElement | null = null;
  let container: HTMLElement | null = null;
  let pixiApp: PixiApp | null = null;
  let boardGfx: PixiGraphics | null = null;
  let ctx2d: CanvasRenderingContext2D | null = null;
  let persistence: Persistence | null = null;
  let achievements: Achievements | null = null;
  let economy: Economy | null = null;
  let audio: Audio | null = null;
  const disposers: Disposer[] = [];

  // Shop overlay — mounted only when status === "in-shop"
  let shopEl: HTMLDivElement | null = null;

  // Hold overlay — always visible while status === "running" or "ended"
  let holdEl: HTMLDivElement | null = null;

  // ---------------------------------------------------------------------------
  // holdBlockLabel — returns a display string for a held block.
  // ---------------------------------------------------------------------------
  const holdBlockLabel = (
    block: ReturnType<typeof makeRunState>["hold"],
  ): string => {
    if (block === null) return "Empty";
    return block.displayName
      ? `${block.displayName} (${block.effectId})`
      : block.id;
  };

  // ---------------------------------------------------------------------------
  // syncHoldOverlay — idempotent reconciler for the hold button(s).
  // Mounts a hold UI element outside the board; updates text + disabled state.
  // ---------------------------------------------------------------------------
  const syncHoldOverlay = (): void => {
    if (container === null) return;

    const btnStyle =
      "min-width:44px;min-height:44px;padding:6px 10px;" +
      "background:#2a1a6a;color:#fff;border:1px solid #9060c0;" +
      "cursor:pointer;font-family:monospace;font-size:13px;display:block;width:100%;";

    // Mount wrapper if not yet present
    if (holdEl === null) {
      holdEl = document.createElement("div");
      holdEl.setAttribute("data-role", "hold-ui");
      holdEl.style.cssText =
        "position:absolute;top:4px;right:4px;display:flex;flex-direction:column;gap:4px;z-index:5;";
      container.appendChild(holdEl);
    }

    // Rebuild hold buttons
    while (holdEl.firstChild) holdEl.removeChild(holdEl.firstChild);

    // Slot 0 button (always present)
    const btn0 = document.createElement("button");
    btn0.setAttribute("data-action", "hold-swap");
    btn0.style.cssText = btnStyle;
    btn0.textContent = `Hold: ${holdBlockLabel(runState.hold)}`;
    btn0.disabled =
      runState.holdSwapLockedThisBlock || runState.status !== "running";
    btn0.addEventListener("click", () => {
      runState = swapHold(runState, 0);
      syncHoldOverlay();
    });
    holdEl.appendChild(btn0);

    // Slot 1 button — only when spare-pocket passive is active
    if (holdCapacity(runState) >= 2) {
      const btn1 = document.createElement("button");
      btn1.setAttribute("data-action", "hold-swap-2");
      btn1.style.cssText = btnStyle;
      btn1.textContent = `Hold2: ${holdBlockLabel(runState.hold2)}`;
      btn1.disabled =
        runState.holdSwapLockedThisBlock || runState.status !== "running";
      btn1.addEventListener("click", () => {
        runState = swapHold(runState, 1);
        syncHoldOverlay();
      });
      holdEl.appendChild(btn1);
    }
  };

  // ---------------------------------------------------------------------------
  // syncShopOverlay — idempotent reconciler for the shop DOM overlay.
  // Mounts the overlay when in-shop, removes it when not.
  // Re-renders content to reflect current shopOffer (tier buttons vs pick screen).
  // ---------------------------------------------------------------------------
  const syncShopOverlay = (rng: ReturnType<typeof makeRng>): void => {
    if (container === null) return;

    if (runState.status !== "in-shop") {
      if (shopEl !== null) {
        if (shopEl.parentNode === container) container.removeChild(shopEl);
        shopEl = null;
      }
      return;
    }

    // Mount overlay if not present — fire ambient sound on first mount
    if (shopEl === null) {
      shopEl = buildShopEl();
      container.appendChild(shopEl);
      audio?.play("dd-shop-ambient");
    }

    // Clear and rebuild contents
    while (shopEl.firstChild) shopEl.removeChild(shopEl.firstChild);

    const btnStyle =
      "min-width:44px;min-height:44px;padding:8px 16px;" +
      "background:#2a2a6a;color:#fff;border:1px solid #6060c0;" +
      "cursor:pointer;font-family:monospace;font-size:14px;";

    if (runState.shopOffer !== null) {
      // ---- Booster pick screen: show 3 block options ----
      const heading = document.createElement("div");
      heading.textContent = `Pick a block (${runState.shopOffer.tier}):`;
      shopEl.appendChild(heading);

      for (const block of runState.shopOffer.options) {
        const btn = document.createElement("button");
        btn.setAttribute("data-pick", block.id);
        btn.style.cssText = btnStyle;
        btn.textContent = block.displayName
          ? `${block.displayName} (${block.effectId})`
          : block.id;
        btn.addEventListener("click", () => {
          runState = pickFromBooster(runState, block);
          syncShopOverlay(rng);
        });
        shopEl.appendChild(btn);
      }
    } else if (runState.removeOffer !== null) {
      // ---- Remove pick screen: show up to 3 block options to remove ----
      const heading = document.createElement("div");
      heading.textContent = "Remove a block from your deck:";
      shopEl.appendChild(heading);

      for (const block of runState.removeOffer.options) {
        const btn = document.createElement("button");
        btn.setAttribute("data-remove-pick", block.id);
        btn.style.cssText = btnStyle;
        btn.textContent = block.displayName
          ? `${block.displayName} (${block.effectId})`
          : block.id;
        btn.addEventListener("click", () => {
          runState = pickRemove(runState, block.id);
          syncShopOverlay(rng);
        });
        shopEl.appendChild(btn);
      }
    } else if (runState.passiveOffer !== null) {
      // ---- Passive offer screen ----
      const passive = findPassive(runState.passiveOffer.passive);
      const heading = document.createElement("div");
      heading.textContent = "Passive offer:";
      shopEl.appendChild(heading);

      if (passive !== null) {
        const info = document.createElement("div");
        info.setAttribute("data-passive-info", passive.id);
        info.textContent = `${passive.title} — ${passive.description} ($${String(runState.passiveOffer.cost)})`;
        shopEl.appendChild(info);
      }

      const acceptBtn = document.createElement("button");
      acceptBtn.setAttribute("data-action", "accept-passive");
      acceptBtn.style.cssText = btnStyle;
      acceptBtn.textContent = `Accept ($${String(runState.passiveOffer.cost)})`;
      acceptBtn.disabled = runState.gold < runState.passiveOffer.cost;
      acceptBtn.addEventListener("click", () => {
        runState = acceptPassive(runState);
        syncShopOverlay(rng);
      });
      shopEl.appendChild(acceptBtn);

      const declineBtn = document.createElement("button");
      declineBtn.setAttribute("data-action", "decline-passive");
      declineBtn.style.cssText =
        btnStyle + "background:#1a1a1a;border-color:#808080;";
      declineBtn.textContent = "Decline";
      declineBtn.addEventListener("click", () => {
        runState = declinePassive(runState);
        syncShopOverlay(rng);
      });
      shopEl.appendChild(declineBtn);
    } else {
      // ---- Main shop screen: tier buttons + remove + skip ----
      const heading = document.createElement("div");
      heading.textContent = "Shop — buy a booster:";
      shopEl.appendChild(heading);

      for (const tier of BOOSTER_TIERS) {
        const btn = document.createElement("button");
        btn.setAttribute("data-booster", tier);
        btn.style.cssText = btnStyle;
        btn.textContent = BOOSTER_LABELS[tier];
        btn.addEventListener("click", () => {
          runState = purchaseBooster(runState, tier, rng);
          syncShopOverlay(rng);
        });
        shopEl.appendChild(btn);
      }

      // Remove button — disabled when deck too small or not enough gold
      const deckSize = runState.deck.length + runState.drawQueue.length;
      const removeDisabled =
        deckSize <= MIN_DECK_SIZE || runState.gold < REMOVE_COST;
      const removeBtn = document.createElement("button");
      removeBtn.setAttribute("data-action", "purchase-remove");
      removeBtn.style.cssText = btnStyle;
      removeBtn.textContent = `Remove ($${String(REMOVE_COST)})`;
      removeBtn.disabled = removeDisabled;
      removeBtn.addEventListener("click", () => {
        runState = purchaseRemove(runState, rng);
        syncShopOverlay(rng);
      });
      shopEl.appendChild(removeBtn);

      // Skip button — calls exitShop directly
      const skipBtn = document.createElement("button");
      skipBtn.setAttribute("data-action", "skip-shop");
      skipBtn.style.cssText =
        btnStyle + "background:#1a1a1a;border-color:#808080;";
      skipBtn.textContent = "Skip";
      skipBtn.addEventListener("click", () => {
        runState = exitShop(runState);
        syncShopOverlay(rng);
      });
      shopEl.appendChild(skipBtn);

      // Exit Shop button (explicit label for non-skip exit after purchases)
      const exitBtn = document.createElement("button");
      exitBtn.setAttribute("data-action", "exit-shop");
      exitBtn.style.cssText =
        btnStyle + "background:#1a1a1a;border-color:#808080;";
      exitBtn.textContent = "Exit Shop";
      exitBtn.addEventListener("click", () => {
        runState = exitShop(runState);
        syncShopOverlay(rng);
      });
      shopEl.appendChild(exitBtn);
    }
  };

  // Track drag state for column snapping
  let dragStartCol = 0;
  let dragAccumPx = 0;

  const init = async (ctx: GameContext): Promise<void> => {
    container = ctx.container;
    persistence = ctx.services.persistence;
    achievements = ctx.services.achievements;
    economy = ctx.services.economy;
    audio = ctx.services.audio;

    // Attempt to restore a prior run from persistence.
    // The isRunState guard rejects old-format saves (missing new fields from
    // this slice). Those saves are deleted and the run resets to a fresh state.
    const saved = await persistence.load<unknown>("drop-deck-run");
    if (isRunState(saved)) {
      runState = saved;
    } else {
      runState = makeRunState(ctx.rng.state);
      if (saved !== null) {
        // Saved object exists but has wrong shape — clear it.
        void persistence.delete("drop-deck-run");
      }
    }

    // Canvas is created eagerly; the Pixi-or-fallback decision happens after attach.
    canvas = document.createElement("canvas");
    canvas.width = BOARD_PIXEL_W;
    canvas.height = BOARD_PIXEL_H;
    container.appendChild(canvas);

    // Attempt PixiJS init — may fail in test environments (happy-dom)
    try {
      const { Application, Graphics } = await import("pixi.js");
      // Single bridge cast: Application is untyped JS; PixiApp is our typed contract.
      const app = new Application() as unknown as PixiApp;
      await app.init({
        canvas,
        width: BOARD_PIXEL_W,
        height: BOARD_PIXEL_H,
        antialias: false,
        background: 0x1a1a2e,
      });
      pixiApp = app;

      const gfx = new Graphics() as unknown as PixiGraphics;
      boardGfx = gfx;
      app.stage.addChild(gfx);
    } catch {
      // Fall back to 2D canvas drawing in environments without WebGL/Canvas2D
      ctx2d = canvas.getContext("2d");
    }

    const rng = makeRng(runState.rngState);

    // Sync hold overlay on init (always visible during running/ended)
    syncHoldOverlay();

    // Sync shop overlay on init (handles restored in-shop state)
    syncShopOverlay(rng);

    // Wire input handlers
    const tapDisposer = ctx.services.input.onTap(() => {
      // Tap is a no-op when the run is over or the shop is open (shop UI in #25)
      if (runState.status === "ended" || runState.status === "in-shop") return;

      // Capture the active block's effectId before commit — it will be replaced.
      const activeEffectId = runState.active?.effectId ?? "standard";
      const prevCommitted = runState.committedBlocks;
      const prevCleared = runState.clearedRowsThisRun;

      const result = commitActive(runState, rng);
      runState = result.state;

      // Sync hold overlay after any commit (lock resets; new active block available)
      syncHoldOverlay();

      // Sync shop overlay if the commit triggered a round-end → in-shop transition
      syncShopOverlay(rng);

      // Commit-save: debounced 50 ms. Only fires when a new cell was placed
      // (not a top-out or out-of-bounds no-op).
      if (runState.committedBlocks > prevCommitted && persistence !== null) {
        void persistence.save("drop-deck-run", runState, { debounceMs: 50 });
      }

      if (result.toppedOut) {
        // Run ended — emit currency yield
        if (economy !== null) {
          emitYield(runState, economy);
        }
        return;
      }

      // Fire block-land sound based on effectId (only on successful commit)
      if (runState.committedBlocks > prevCommitted) {
        const soundId = EFFECT_SOUND[activeEffectId] ?? "dd-block-land";
        audio?.play(soundId);

        // Fire row-clear sound if any rows were cleared this commit
        if (runState.clearedRowsThisRun > prevCleared) {
          audio?.play("dd-row-clear");
        }
      }

      // Check achievement thresholds after a successful commit
      if (achievements !== null) {
        runState = checkAchievements(runState, achievements);
      }
    });

    const dragDisposer = ctx.services.input.onDrag((e: InputDragEvent) => {
      if (runState.status === "ended" || runState.status === "in-shop") return;
      if (e.phase === "start") {
        dragStartCol = runState.activeColumn;
        dragAccumPx = 0;
      } else if (e.phase === "move") {
        dragAccumPx = e.dx;
        const colShift = Math.round(dragAccumPx / DRAG_COL_THRESHOLD);
        const newCol = Math.max(
          0,
          Math.min(BOARD_COLS - 1, dragStartCol + colShift),
        );
        runState = { ...runState, activeColumn: newCol };
      }
    });

    disposers.push(tapDisposer, dragDisposer);
  };

  // eslint-disable-next-line @typescript-eslint/no-empty-function
  const update = (_dtMs: number): void => {};

  const render = (): void => {
    drawBoard(boardGfx, ctx2d, runState);
  };

  const teardown = (): void => {
    for (const dispose of disposers) {
      dispose();
    }
    disposers.length = 0;

    if (holdEl !== null && container !== null) {
      if (holdEl.parentNode === container) container.removeChild(holdEl);
      holdEl = null;
    }

    if (shopEl !== null && container !== null) {
      if (shopEl.parentNode === container) container.removeChild(shopEl);
      shopEl = null;
    }

    if (pixiApp !== null) {
      pixiApp.destroy({ removeView: true });
      pixiApp = null;
      boardGfx = null;
    }

    if (canvas !== null && container !== null) {
      if (canvas.parentNode === container) {
        container.removeChild(canvas);
      }
      canvas = null;
    }

    container = null;
  };

  // Test-only seam — not part of the Game interface. Tests cast the return value
  // to access this; production code never calls it.
  const __getRunState = (): RunState => runState;

  return { init, update, render, teardown, __getRunState };
};
