import type { GameManifest } from "../../engine/Game.ts";
import type { RunState } from "./domain/runState.ts";

export const manifest: GameManifest<RunState> = {
  id: "002-keimgarten",
  title: "Keimgarten",
  achievements: [
    {
      id: "kg-first-keim",
      title: "Erster Keim",
      criterion: "Open the garden for the first time.",
    },
    {
      id: "kg-walk-10",
      title: "Spaziergang",
      criterion: "Watch a creature walk for 10 cumulative ticks.",
    },
    {
      id: "kg-nap-watcher",
      title: "Schlafwächter",
      criterion: "Observe a creature in nap state.",
    },
  ],
  // No yield in this slice; formula ships in a later issue.
  currencyYield: () => 0,
};
