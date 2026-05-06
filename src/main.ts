// 100g — bootstrap entry point.
// Wires persistence → economy → achievements → engine → router.

import type { Audio } from "./engine/services.ts";
import { createPersistence } from "./services/persistence/index.ts";
import { createEconomy } from "./services/economy/index.ts";
import { createAchievements } from "./services/achievements/index.ts";
import { createInput } from "./services/input/index.ts";
import { createEngine } from "./engine/Engine.ts";
import { createRouter } from "./shell/Router.ts";
import {
  createDropDeckGame,
  manifest as dropDeckManifest,
} from "./games/001-drop-deck/index.ts";

// Temporary no-op audio stub — real service ships with issue #30.
function makeNoOpAudio(): Audio {
  return {
    enable: () => undefined,
    setMuted: () => undefined,
    play: () => undefined,
  };
}

void (async () => {
  const root = document.querySelector<HTMLDivElement>("#app");
  if (root === null) throw new Error("missing #app root element");

  const persistence = createPersistence({});
  const economy = await createEconomy({ persistence });
  const achievements = await createAchievements({ persistence });
  const input = createInput(root);

  const services = {
    persistence,
    economy,
    achievements,
    input,
    audio: makeNoOpAudio(),
  };

  const engine = createEngine(root, { services });
  engine.register(dropDeckManifest, () => createDropDeckGame());

  createRouter(root, {
    engine,
    economy,
    achievements,
    registeredGames: [{ manifest: dropDeckManifest }],
  });
})();
