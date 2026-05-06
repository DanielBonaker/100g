// 100g — bootstrap entry point.
// Wires persistence → economy → achievements → engine → router.

import { createPersistence } from "./services/persistence/index.ts";
import { createEconomy } from "./services/economy/index.ts";
import { createAchievements } from "./services/achievements/index.ts";
import { createInput } from "./services/input/index.ts";
import { createAudio } from "./services/audio/index.ts";
import { createEngine } from "./engine/Engine.ts";
import { createRouter } from "./shell/Router.ts";
import {
  createDropDeckGame,
  manifest as dropDeckManifest,
} from "./games/001-drop-deck/index.ts";
import {
  createHelloWorldGame,
  manifest as helloWorldManifest,
} from "./games/000-hello-world/index.ts";
import {
  createKeimgartenGame,
  manifest as keimgartenManifest,
} from "./games/002-keimgarten/index.ts";

void (async () => {
  const root = document.querySelector<HTMLDivElement>("#app");
  if (root === null) throw new Error("missing #app root element");

  const persistence = createPersistence({});
  const economy = await createEconomy({ persistence });
  const achievements = await createAchievements({ persistence });
  const input = createInput(root);
  const audio = await createAudio({ persistence });

  const services = {
    persistence,
    economy,
    achievements,
    input,
    audio,
  };

  // Autoplay-safe: AudioContext is created only on the first user gesture.
  // The listener is registered with { once: true } so it fires at most once.
  const enableAudioOnce = (): void => {
    void audio.enable();
  };
  root.addEventListener("pointerdown", enableAudioOnce, { once: true });

  const engine = createEngine(root, { services });
  engine.register(dropDeckManifest, () => createDropDeckGame());
  engine.register(helloWorldManifest, () => createHelloWorldGame());
  engine.register(keimgartenManifest, () => createKeimgartenGame());

  createRouter(root, {
    engine,
    economy,
    achievements,
    registeredGames: [
      { manifest: dropDeckManifest },
      { manifest: helloWorldManifest },
      { manifest: keimgartenManifest },
    ],
  });
})();
