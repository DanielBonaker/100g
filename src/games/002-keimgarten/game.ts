import type {
  Game,
  GameContext,
  SeededRng,
  Persistence,
} from "../../engine/Game.ts";
import type { Stage } from "./render/stage.ts";
import { manifest } from "./manifest.ts";
import { makeRunState, isRunState } from "./domain/runState.ts";
import type { RunState } from "./domain/runState.ts";
import { tick as tickCreature } from "./domain/creatureBehavior.ts";
import type { PlayBounds } from "./domain/creatureBehavior.ts";
import { hueFromId } from "./render/creatureSprite.ts";
import { BESTIARY } from "../../shared/franchise/bestiary.ts";

export { manifest };

// Play area bounds in local play-container coords.
// The play container is offset by PLAY_Y (y=8) from the canvas.
// Play area is 48×56, so local coords are x:0..47, y:0..55.
const PLAY_BOUNDS: PlayBounds = { minX: 0, maxX: 47, minY: 0, maxY: 55 };

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

  // Fallback canvas path (happy-dom / no WebGL)
  let canvas: HTMLCanvasElement | null = null;
  let ctx2d: CanvasRenderingContext2D | null = null;
  const fallbackSprites = new Map<number, FallbackSprite>();

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
        (sprite.y + 8) * scale, // add PLAY_Y offset
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
  // Game contract
  // ---------------------------------------------------------------------------

  const init = async (ctx: GameContext): Promise<void> => {
    container = ctx.container;
    persistence = ctx.services.persistence;
    rng = ctx.rng;

    // Restore from persistence
    const saved = await persistence.load<unknown>("keimgarten-run");
    if (saved !== null && isRunState(saved)) {
      runState = saved;
    } else {
      if (saved !== null) void persistence.delete("keimgarten-run");
      runState = makeRunState(ctx.rng.state);
    }

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
    } catch {
      // Fallback: use a plain 2D canvas
      pixiAvailable = false;
      canvas = document.createElement("canvas");
      canvas.width = 48 * 4;
      canvas.height = 80 * 4;
      canvas.setAttribute("data-keimgarten-canvas", "true");
      container.appendChild(canvas);
      ctx2d = canvas.getContext("2d");

      for (const creature of runState.owned) {
        syncFallbackSprite(creature);
      }
      drawFallback();
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
