// Pixi-aware module — no domain imports, no pure-function tests required.
// Uses the same lazy-import + fallback pattern as drop-deck.

// Native canvas dimensions (pixels in game-space)
export const NATIVE_W = 48;
export const NATIVE_H = 80;
export const HUD_TOP_H = 8;
export const HUD_BOTTOM_H = 16;
export const PLAY_Y = HUD_TOP_H; // play area starts at native y=8
export const PLAY_H = NATIVE_H - HUD_TOP_H - HUD_BOTTOM_H; // 56

export const PASTEL_BG = 0xffeec0;

// Minimal Pixi interfaces needed — avoids touching Pixi types in domain code
interface PixiContainer {
  addChild(child: unknown): void;
  position: { set(x: number, y: number): void };
  destroy(opts?: unknown): void;
}

interface PixiApp {
  canvas: HTMLCanvasElement;
  init(opts: unknown): Promise<void>;
  stage: PixiContainer & {
    scale: { set(s: number): void };
    addChild(child: unknown): void;
  };
  destroy(opts?: unknown): void;
}

export interface Stage {
  /** The raw Pixi Application (opaque to callers outside render/) */
  readonly app: PixiApp;
  /** Container for background layer (native coords) */
  readonly background: PixiContainer;
  /** Container for play layer — offset to y=PLAY_Y, children at local play coords */
  readonly play: PixiContainer;
  /** Container for HUD overlay */
  readonly hud: PixiContainer;
  /** Scale the canvas to fill the viewport with the largest integer multiple (min 7×) */
  resize(viewportWidth: number, viewportHeight: number): void;
  destroy(): void;
}

export const createStage = async (root: HTMLElement): Promise<Stage> => {
  const { Application, Container, Graphics } = await import("pixi.js");

  const app = new Application() as unknown as PixiApp;
  await app.init({
    width: NATIVE_W,
    height: NATIVE_H,
    antialias: false,
    backgroundColor: PASTEL_BG,
    resolution: 1,
  });

  app.canvas.style.imageRendering = "pixelated";
  app.canvas.style.display = "block";
  root.appendChild(app.canvas);

  // The zoom container holds everything; we scale it to integer multiples.
  const zoomContainer = new Container() as unknown as PixiContainer;
  app.stage.addChild(zoomContainer);

  // Soft pastel background fill
  const bgGfx = new Graphics();
  bgGfx.rect(0, 0, NATIVE_W, NATIVE_H).fill(PASTEL_BG);
  // Light grid guide lines for the play area (subtle)
  bgGfx
    .rect(0, HUD_TOP_H, NATIVE_W, 1)
    .fill(0xddcc99)
    .rect(0, NATIVE_H - HUD_BOTTOM_H, NATIVE_W, 1)
    .fill(0xddcc99);

  const background = new Container() as unknown as PixiContainer;
  background.position.set(0, 0);
  background.addChild(bgGfx);

  const play = new Container() as unknown as PixiContainer;
  play.position.set(0, PLAY_Y);

  const hud = new Container() as unknown as PixiContainer;
  hud.position.set(0, 0);

  zoomContainer.addChild(background);
  zoomContainer.addChild(play);
  zoomContainer.addChild(hud);

  const resize = (viewportWidth: number, viewportHeight: number): void => {
    const scaleX = Math.floor(viewportWidth / NATIVE_W);
    const scaleY = Math.floor(viewportHeight / NATIVE_H);
    const scale = Math.max(7, Math.min(scaleX, scaleY));
    app.stage.scale.set(scale);
    app.canvas.width = NATIVE_W * scale;
    app.canvas.height = NATIVE_H * scale;
  };

  return {
    app,
    background,
    play,
    hud,
    resize,
    destroy(): void {
      app.destroy({ removeView: true });
      if (app.canvas.parentNode === root) root.removeChild(app.canvas);
    },
  };
};
