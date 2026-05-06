import type { GameManifest } from "../../engine/Game.ts";
import type { RunState } from "./domain/runState.ts";
import { compute } from "./domain/currencyYield.ts";

export const manifest: GameManifest<RunState> = {
  id: "002-keimgarten",
  title: "Keimgarten",
  achievements: [
    {
      id: "first-fusion",
      title: "Erste Verschmelzung",
      criterion: "Complete the first fusion of any output size",
    },
    {
      id: "first-archon",
      title: "Archon erwacht",
      criterion: "Own at least one size-8 (Archon) creature",
    },
    {
      id: "vollkommen",
      title: "Vollkommen",
      criterion: "Own the unique size-9 (Vollkommen) creature",
    },
  ],
  currencyYield: compute,
};
