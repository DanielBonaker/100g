import type { Game } from "../../engine/Game.ts";

export interface HelloWorldRunState {
  readonly totalTaps: number;
  readonly sessionTaps: number;
}

export const createHelloWorldGame = (): Game & {
  __getRunState(): HelloWorldRunState;
} => {
  throw new Error("not implemented");
};
