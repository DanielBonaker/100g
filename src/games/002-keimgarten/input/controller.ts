import type { OwnedCreature } from "../domain/runState.ts";

export interface CreatureHit {
  readonly instanceId: number;
  readonly creatureId: number;
}

/**
 * Half-width of the hit-box in native pixels.
 * 4 native px → diameter of 9 native px → 9×7 = 63 screen px at minimum 7× zoom.
 * That exceeds the 44 px mobile hit-target requirement.
 */
export const HIT_RADIUS_NATIVE = 4;

/**
 * Given a tap at canvas-screen pixel (tapX, tapY), integer zoom factor, a
 * native-pixel Y offset for the play layer (playOffsetY), and a list of
 * creatures (in render order), returns the topmost creature whose bounding box
 * contains the tap, or null.
 *
 * Tap coords are in screen pixels (canvas-space). Converts to native coords
 * via Math.floor(coord / zoom). Creature positions are in play-local coords;
 * playOffsetY is added to convert them to canvas-native coords before
 * comparison.
 *
 * Chebyshev distance <= HIT_RADIUS_NATIVE => hit.
 * "Topmost" = last entry in the creatures array (rendered last = on top).
 */
export const hitTestCreatures = (
  tapX: number,
  tapY: number,
  zoom: number,
  creatures: readonly OwnedCreature[],
  playOffsetY = 0,
): CreatureHit | null => {
  const nativeX = Math.floor(tapX / zoom);
  const nativeY = Math.floor(tapY / zoom);

  // Iterate in reverse order so we pick the topmost (last-rendered) first
  for (let i = creatures.length - 1; i >= 0; i--) {
    const c = creatures[i];
    if (c === undefined) continue;
    const dx = Math.abs(nativeX - c.position.x);
    const dy = Math.abs(nativeY - (c.position.y + playOffsetY));
    if (dx <= HIT_RADIUS_NATIVE && dy <= HIT_RADIUS_NATIVE) {
      return { instanceId: c.instanceId, creatureId: c.creatureId };
    }
  }

  return null;
};
