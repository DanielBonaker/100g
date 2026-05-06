import type { GameManifest } from "../../engine/Game.ts";
import type { RunState } from "./domain/runState.ts";

export const manifest: GameManifest<RunState> = {
  id: "001-drop-deck",
  title: "Drop Deck",
  achievements: [
    {
      id: "dd-rows-100",
      title: "Centurion Stack",
      criterion: "Clear 100 rows in a single run.",
    },
    {
      id: "dd-round-10",
      title: "Tenfold Climb",
      criterion: "Reach round 10 across any save.",
    },
    {
      id: "dd-deck-20",
      title: "Full Deck",
      criterion: "Grow the deck to 20 blocks.",
    },
  ],
  // min(rows / 5, 200) + min(round - 1, 100), capped at 300
  currencyYield: (state) =>
    Math.min(
      Math.min(state.clearedRowsThisRun / 5, 200) +
        Math.min(state.round - 1, 100),
      300,
    ),
};
