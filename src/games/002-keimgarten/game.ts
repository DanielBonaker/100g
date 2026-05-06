import type {
  Game,
  GameContext,
  SeededRng,
  Persistence,
} from "../../engine/Game.ts";
import type { Stage } from "./render/stage.ts";
import type { Disposer } from "../../services/input/types.ts";
import { manifest } from "./manifest.ts";
import {
  makeRunState,
  isRunState,
  normalizeRunState,
} from "./domain/runState.ts";
import type { RunState } from "./domain/runState.ts";
import { tick as tickCreature } from "./domain/creatureBehavior.ts";
import type { PlayBounds } from "./domain/creatureBehavior.ts";
import { applyAction } from "./domain/garden.ts";
import { hitTestCreatures } from "./input/controller.ts";
import { hueFromId } from "./render/creatureSprite.ts";
import { BESTIARY } from "../../shared/franchise/bestiary.ts";
import { getTier } from "../../shared/franchise/types.ts";

export { manifest };

// Play area bounds in local play-container coords.
// The play container is offset by PLAY_Y (y=8) from the canvas.
// Play area is 48×56, so local coords are x:0..47, y:0..55.
const PLAY_BOUNDS: PlayBounds = { minX: 0, maxX: 47, minY: 0, maxY: 55 };

// Native canvas dimensions
const NATIVE_W = 48;
const NATIVE_H = 80;
const PLAY_Y = 8; // play area starts at native y=8

// Minimum integer zoom used (from stage.ts)
const MIN_ZOOM = 7;

// ---------------------------------------------------------------------------
// Pixi-fallback canvas sprite representation for test environments
// ---------------------------------------------------------------------------

interface FallbackSprite {
  x: number;
  y: number;
  color: number;
}

export const createKeimgartenGame = (): Game & {
  __getRunState(): RunState;
} => {
  let runState: RunState = makeRunState();
  let persistence: Persistence | null = null;
  let rng: SeededRng | null = null;
  let container: HTMLElement | null = null;

  // Pixi-path: stage and sprite map
  let stage: Stage | null = null;
  const pixiSprites = new Map<number, unknown>(); // instanceId → Pixi Sprite
  let pixiAvailable = false;
  let currentZoom = MIN_ZOOM;

  // Fallback canvas path (happy-dom / no WebGL)
  let canvas: HTMLCanvasElement | null = null;
  let ctx2d: CanvasRenderingContext2D | null = null;
  const fallbackSprites = new Map<number, FallbackSprite>();

  // Input disposer
  let tapDisposer: Disposer | null = null;

  // ---------------------------------------------------------------------------
  // Nameplate + heart particle DOM overlay
  // ---------------------------------------------------------------------------

  const showNameplate = (
    creatureId: number,
    screenX: number,
    screenY: number,
  ): void => {
    if (container === null) return;

    const shape = BESTIARY[creatureId];
    if (shape === undefined) return;

    const tier = getTier(shape.tier);
    const text = `${shape.nameDe} — ${tier.label} (${String(shape.tier)})`;

    const div = document.createElement("div");
    div.setAttribute("data-keimgarten-nameplate", "true");
    div.textContent = text;
    div.style.cssText = [
      "position:absolute",
      "pointer-events:none",
      "background:rgba(0,0,0,0.7)",
      "color:#fff",
      "font-size:9px",
      "font-family:monospace",
      "padding:2px 4px",
      "border-radius:2px",
      "white-space:nowrap",
      `left:${String(Math.round(screenX))}px`,
      `top:${String(Math.round(screenY - 20))}px`,
      "transform:translateX(-50%)",
      "transition:opacity 0.1s",
    ].join(";");

    container.style.position = "relative";
    container.appendChild(div);

    // Fade out after ~2 s and remove
    const startMs = 1800;
    const fadeMs = 200;
    const total = startMs + fadeMs;
    const startTime = Date.now();

    const tick = (): void => {
      const elapsed = Date.now() - startTime;
      if (elapsed >= total) {
        div.remove();
        return;
      }
      if (elapsed >= startMs) {
        const t = (elapsed - startMs) / fadeMs;
        div.style.opacity = String(1 - t);
      }
      requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  };

  const showHeartParticle = (screenX: number, screenY: number): void => {
    if (container === null) return;

    const div = document.createElement("div");
    div.setAttribute("data-keimgarten-heart", "true");
    div.textContent = "♥"; // ♥
    div.style.cssText = [
      "position:absolute",
      "pointer-events:none",
      "color:#ff4466",
      "font-size:10px",
      `left:${String(Math.round(screenX))}px`,
      `top:${String(Math.round(screenY - 10))}px`,
      "transform:translateX(-50%)",
      "transition:opacity 0.3s,top 0.6s",
    ].join(";");

    container.style.position = "relative";
    container.appendChild(div);

    // Float up and fade
    const durationMs = 600;
    const startTime = Date.now();
    const startY = screenY - 10;

    const tick = (): void => {
      const elapsed = Date.now() - startTime;
      if (elapsed >= durationMs) {
        div.remove();
        return;
      }
      const t = elapsed / durationMs;
      const curY = startY - t * 20;
      div.style.top = `${String(Math.round(curY))}px`;
      div.style.opacity = String(1 - t);
      requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  };

  // ---------------------------------------------------------------------------
  // Tap handler
  // ---------------------------------------------------------------------------

  const handleTap = (tapX: number, tapY: number): void => {
    const hit = hitTestCreatures(
      tapX,
      tapY,
      currentZoom,
      runState.owned,
      PLAY_Y,
    );
    if (hit === null) return;

    const prevCount = runState.totalTapsByCreatureId[hit.creatureId] ?? 0;

    runState = applyAction(runState, {
      type: "tap-creature",
      instanceId: hit.instanceId,
      creatureId: hit.creatureId,
      tick: runState.tick,
    });

    // Nameplate — position above the tapped creature in screen coords
    // tapX/tapY are already screen coords
    showNameplate(hit.creatureId, tapX, tapY);

    // Heart particle after 100 cumulative taps (check new count)
    const newCount = runState.totalTapsByCreatureId[hit.creatureId] ?? 0;
    if (prevCount < 100 && newCount >= 100) {
      showHeartParticle(tapX, tapY);
    } else if (newCount >= 100) {
      showHeartParticle(tapX, tapY);
    }

    // Persist
    if (persistence !== null) {
      void persistence.save("keimgarten-run", runState, { debounceMs: 50 });
    }
  };

  // ---------------------------------------------------------------------------
  // Fallback rendering (2D canvas)
  // ---------------------------------------------------------------------------

  const drawFallback = (): void => {
    if (ctx2d === null || canvas === null) return;
    ctx2d.clearRect(0, 0, canvas.width, canvas.height);
    ctx2d.fillStyle = "#ffeec0";
    ctx2d.fillRect(0, 0, canvas.width, canvas.height);

    for (const sprite of fallbackSprites.values()) {
      const r = (sprite.color >> 16) & 0xff;
      const g = (sprite.color >> 8) & 0xff;
      const b = sprite.color & 0xff;
      ctx2d.fillStyle = `rgb(${String(r)},${String(g)},${String(b)})`;
      // In fallback mode, scale native px by 4 for visibility
      const scale = 4;
      ctx2d.fillRect(
        sprite.x * scale,
        (sprite.y + PLAY_Y) * scale,
        scale,
        scale,
      );
    }
  };

  const syncFallbackSprite = (creature: {
    instanceId: number;
    creatureId: number;
    position: { x: number; y: number };
  }): void => {
    const shape = BESTIARY[creature.creatureId];
    const color = hueFromId(
      creature.creatureId,
      shape !== undefined ? shape.tier : 1,
    );
    fallbackSprites.set(creature.instanceId, {
      x: creature.position.x,
      y: creature.position.y,
      color,
    });
  };

  // ---------------------------------------------------------------------------
  // Pixi sprite management
  // ---------------------------------------------------------------------------

  const syncPixiSprite = (creature: {
    instanceId: number;
    position: { x: number; y: number };
  }): void => {
    const s = pixiSprites.get(creature.instanceId);
    if (s !== undefined) {
      const sprite = s as { position: { set(x: number, y: number): void } };
      sprite.position.set(creature.position.x, creature.position.y);
    }
  };

  // ---------------------------------------------------------------------------
  // Compute current zoom from canvas dimensions
  // ---------------------------------------------------------------------------

  const getZoom = (): number => {
    if (canvas !== null) {
      // fallback canvas is scaled by 4
      return 4;
    }
    if (stage !== null) {
      const s = stage as unknown as {
        app: { canvas: { width: number } };
      };
      return Math.max(MIN_ZOOM, Math.round(s.app.canvas.width / NATIVE_W));
    }
    return MIN_ZOOM;
  };

  // ---------------------------------------------------------------------------
  // Game contract
  // ---------------------------------------------------------------------------

  const init = async (ctx: GameContext): Promise<void> => {
    container = ctx.container;
    persistence = ctx.services.persistence;
    rng = ctx.rng;

    // Restore from persistence; normalizeRunState fills in fields added in
    // later schema iterations for backward-compat with older saves.
    const saved = await persistence.load<unknown>("keimgarten-run");
    if (saved !== null && isRunState(saved)) {
      runState = normalizeRunState(saved);
    } else {
      if (saved !== null) void persistence.delete("keimgarten-run");
      runState = makeRunState(ctx.rng.state);
    }

    // Subscribe to tap events
    tapDisposer = ctx.services.input.onTap((e) => {
      currentZoom = getZoom();
      // The tap event x/y are in canvas element CSS pixels.
      // In fallback mode the canvas is 4× scale. In Pixi mode the canvas
      // element is NATIVE_W*zoom × NATIVE_H*zoom. We need screen coords that
      // match what getZoom() returns, so pass them through directly.
      handleTap(e.x, e.y);
    });

    // Try Pixi path first
    try {
      const [{ createStage }, { createCreatureSprite }, pixiModule] =
        await Promise.all([
          import("./render/stage.ts"),
          import("./render/creatureSprite.ts"),
          import("pixi.js"),
        ]);

      stage = await createStage(ctx.container);
      stage.resize(ctx.dimensions.width, ctx.dimensions.height);

      const playContainer = stage.play as {
        addChild(child: unknown): void;
      };

      for (const creature of runState.owned) {
        const sprite = createCreatureSprite(
          creature,
          stage.app,
          pixiModule,
        ) as {
          position: { set(x: number, y: number): void };
        };
        sprite.position.set(creature.position.x, creature.position.y);
        playContainer.addChild(sprite);
        pixiSprites.set(creature.instanceId, sprite);
      }

      pixiAvailable = true;
      // Compute initial zoom from Pixi canvas
      currentZoom = getZoom();
    } catch {
      // Fallback: use a plain 2D canvas
      pixiAvailable = false;
      canvas = document.createElement("canvas");
      canvas.width = NATIVE_W * 4;
      canvas.height = NATIVE_H * 4;
      canvas.setAttribute("data-keimgarten-canvas", "true");
      container.appendChild(canvas);
      ctx2d = canvas.getContext("2d");

      for (const creature of runState.owned) {
        syncFallbackSprite(creature);
      }
      drawFallback();
      currentZoom = 4; // fallback scale
    }
  };

  const update = (_dtMs: number): void => {
    if (persistence === null || rng === null) return;
    const currentRng = rng;

    const newOwned = runState.owned.map((c) =>
      tickCreature(c, runState.tick, PLAY_BOUNDS, currentRng),
    );
    runState = { ...runState, tick: runState.tick + 1, owned: newOwned };

    // Sync sprite positions
    if (pixiAvailable) {
      for (const creature of newOwned) {
        syncPixiSprite(creature);
      }
    } else {
      for (const creature of newOwned) {
        syncFallbackSprite(creature);
      }
    }

    // Debounce-save
    void persistence.save("keimgarten-run", runState, { debounceMs: 50 });
  };

  const render = (): void => {
    if (!pixiAvailable) {
      drawFallback();
    }
    // Pixi auto-renders via its ticker; nothing to do here.
  };

  const teardown = (): void => {
    if (tapDisposer !== null) {
      tapDisposer();
      tapDisposer = null;
    }

    if (pixiAvailable && stage !== null) {
      stage.destroy();
      stage = null;
    }
    pixiSprites.clear();
    pixiAvailable = false;

    if (canvas !== null && container !== null) {
      if (canvas.parentNode === container) container.removeChild(canvas);
      canvas = null;
    }
    ctx2d = null;
    fallbackSprites.clear();

    container = null;
    persistence = null;
    rng = null;
  };

  return {
    init,
    update,
    render,
    teardown,
    __getRunState: () => runState,
  };
};
