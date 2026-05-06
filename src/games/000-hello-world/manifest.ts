import type { GameManifest } from "../../engine/Game.ts";
import type { HelloWorldRunState } from "./game.ts";

export const manifest: GameManifest<HelloWorldRunState> = {
  id: "000-hello-world",
  title: "Hello World",
  achievements: [
    {
      id: "hw-tap-5",
      title: "Five taps",
      criterion: "Tap the square 5 times.",
    },
    {
      id: "hw-tap-25",
      title: "Twenty-five taps",
      criterion: "Tap the square 25 times.",
    },
    {
      id: "hw-tap-100",
      title: "Centuriator",
      criterion: "Tap the square 100 times in one session.",
    },
  ],
  currencyYield: () => 0,
};
