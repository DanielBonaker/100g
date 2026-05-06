// Pixi-aware module — sprite rasterisation for owned creatures.

import { BESTIARY } from "../../../shared/franchise/bestiary.ts";
import type { OwnedCreature } from "../domain/runState.ts";

/**
 * Deterministic hue for a creature based on id and tier.
 * Returns an RGB hex number (0xRRGGBB).
 */
export const hueFromId = (id: number, size: number): number => {
  const hue = (id * 137 + size * 73) % 360;
  // Saturation and lightness vary slightly by size
  const saturation = 60 + ((size * 7) % 20); // 60-80%
  const lightness = 50 + ((size * 3) % 10); // 50-60%
  return hslToRgbHex(hue, saturation, lightness);
};

function hslToRgbHex(h: number, s: number, l: number): number {
  const sf = s / 100;
  const lf = l / 100;
  const c = (1 - Math.abs(2 * lf - 1)) * sf;
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
  const m = lf - c / 2;

  let r = 0;
  let g = 0;
  let b = 0;

  if (h < 60) {
    r = c;
    g = x;
  } else if (h < 120) {
    r = x;
    g = c;
  } else if (h < 180) {
    g = c;
    b = x;
  } else if (h < 240) {
    g = x;
    b = c;
  } else if (h < 300) {
    r = x;
    b = c;
  } else {
    r = c;
    b = x;
  }

  const ri = Math.round((r + m) * 255);
  const gi = Math.round((g + m) * 255);
  const bi = Math.round((b + m) * 255);

  return (ri << 16) | (gi << 8) | bi;
}

// Minimal Pixi interfaces (avoid importing pixi types here)
interface PixiSprite {
  position: { set(x: number, y: number): void };
  tint: number;
  destroy(opts?: unknown): void;
}

interface PixiGraphicsLike {
  rect(x: number, y: number, w: number, h: number): PixiGraphicsLike;
  fill(color: number): PixiGraphicsLike;
  destroy(): void;
}

// Opaque texture handle — we only pass it to Sprite constructor
type PixiTexture = object;

interface PixiApplication {
  renderer: {
    generateTexture(gfx: unknown): PixiTexture;
  };
}

interface PixiModule {
  Graphics: new () => PixiGraphicsLike;
  Sprite: new (texture: PixiTexture) => PixiSprite;
}

/**
 * Create a Pixi Sprite for the given creature.
 * Accepts an already-loaded pixi module reference so the caller controls
 * when the dynamic import happens (no require() needed here).
 * Returns unknown so domain code never touches Pixi types.
 */
export const createCreatureSprite = (
  creature: OwnedCreature,
  app: unknown,
  pixiModule: unknown,
): unknown => {
  const pixi = pixiModule as PixiModule;
  const pixiApp = app as PixiApplication;

  const shape = BESTIARY[creature.creatureId];
  const color = hueFromId(
    creature.creatureId,
    shape !== undefined ? shape.tier : 1,
  );

  const gfx = new pixi.Graphics();

  if (shape !== undefined && shape.cells.length > 0) {
    for (const [row, col] of shape.cells) {
      gfx.rect(col, row, 1, 1).fill(color);
    }
  } else {
    // Fallback: 1×1 block
    gfx.rect(0, 0, 1, 1).fill(color);
  }

  const texture = pixiApp.renderer.generateTexture(gfx);
  gfx.destroy();

  const sprite = new pixi.Sprite(texture);
  sprite.tint = 0xffffff; // use natural texture color
  return sprite;
};
