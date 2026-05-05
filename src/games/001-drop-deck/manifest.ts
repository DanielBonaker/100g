import type { GameManifest } from "../../engine/Game.ts";
import type { RunState } from "./domain/runState.ts";

export const manifest: GameManifest<RunState> = {
  id: "001-drop-deck",
  title: "Drop Deck",
  achievements: [
    {
      id: "dd-first-drop",
      title: "First Drop",
      criterion: "Commit your first block to the board",
    },
    {
      id: "dd-five-drops",
      title: "Five Drops",
      criterion: "Commit five blocks in a single run",
    },
    {
      id: "dd-survive-100",
      title: "Centurion Stack",
      criterion: "Commit 100 blocks without topping out",
    },
  ],
  currencyYield: (state) => Math.min(state.committedCells, 100),
};
