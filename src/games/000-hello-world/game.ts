import type { Game, GameContext } from "../../engine/Game.ts";

export interface HelloWorldRunState {
  readonly totalTaps: number;
  readonly sessionTaps: number;
}

const GAME_ID = "000-hello-world";
const STORAGE_KEY = "hw-total-taps";
const SPRITE_SIZE = 80; // px — well above the 44×44 min hit target
const ACH_5 = "hw-tap-5";
const ACH_25 = "hw-tap-25";
const ACH_100 = "hw-tap-100";

export const createHelloWorldGame = (): Game & {
  __getRunState(): HelloWorldRunState;
} => {
  let totalTaps = 0;
  let sessionTaps = 0;
  let sprite: HTMLDivElement | null = null;
  let disposeInput: (() => void) | null = null;
  let ctx: GameContext | null = null;

  const checkAchievements = (): void => {
    if (ctx === null) return;
    const { achievements } = ctx.services;
    if (totalTaps >= 5) achievements.unlock(GAME_ID, ACH_5);
    if (totalTaps >= 25) achievements.unlock(GAME_ID, ACH_25);
    if (sessionTaps >= 100) achievements.unlock(GAME_ID, ACH_100);
  };

  return {
    __getRunState: () => ({ totalTaps, sessionTaps }),

    async init(gameCtx: GameContext): Promise<void> {
      ctx = gameCtx;
      const { container, services } = ctx;

      // Restore totalTaps from persistence
      const saved = await services.persistence.load<number>(STORAGE_KEY);
      totalTaps = typeof saved === "number" ? saved : 0;
      sessionTaps = 0;

      // Mount sprite centered in container
      const el = document.createElement("div");
      el.style.position = "absolute";
      el.style.width = `${String(SPRITE_SIZE)}px`;
      el.style.height = `${String(SPRITE_SIZE)}px`;
      el.style.background = "#4a9eff";
      el.style.left = `calc(50% - ${String(SPRITE_SIZE / 2)}px)`;
      el.style.top = `calc(50% - ${String(SPRITE_SIZE / 2)}px)`;
      container.style.position = "relative";
      container.appendChild(el);
      sprite = el;

      // Subscribe to taps and hit-test against sprite
      disposeInput = services.input.onTap((e) => {
        if (sprite === null) return;
        const rect = sprite.getBoundingClientRect();
        const containerRect = container.getBoundingClientRect();
        // In happy-dom getBoundingClientRect returns zeros; fall back to
        // computed style + container layout to derive hit bounds.
        const spriteLeft =
          rect.width > 0
            ? rect.left - containerRect.left
            : (container.clientWidth || 375) / 2 - SPRITE_SIZE / 2;
        const spriteTop =
          rect.height > 0
            ? rect.top - containerRect.top
            : (container.clientHeight || 667) / 2 - SPRITE_SIZE / 2;
        const spriteRight = spriteLeft + SPRITE_SIZE;
        const spriteBottom = spriteTop + SPRITE_SIZE;

        if (
          e.x >= spriteLeft &&
          e.x <= spriteRight &&
          e.y >= spriteTop &&
          e.y <= spriteBottom
        ) {
          totalTaps += 1;
          sessionTaps += 1;
          services.economy.addYield(GAME_ID, 1);
          void services.persistence.save(STORAGE_KEY, totalTaps, {
            debounceMs: 50,
          });
          checkAchievements();
        }
      });
    },

    update(_dtMs: number): void {
      // event-driven; no per-tick logic needed
    },

    render(): void {
      // DOM updates happen synchronously on tap; no render loop needed
    },

    teardown(): void {
      if (disposeInput !== null) {
        disposeInput();
        disposeInput = null;
      }
      if (sprite !== null && ctx !== null) {
        ctx.container.removeChild(sprite);
        sprite = null;
      }
      ctx = null;
    },
  };
};
