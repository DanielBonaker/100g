// Router — hash-based navigation shell for 100g.
// Routes: #/ (picker), #/games/<id>, #/achievements
// Vanilla DOM only — no framework.

import type { Engine } from "../engine/Engine.ts";
import type { AchievementDef } from "../engine/Game.ts";
import type { Economy } from "../services/economy/index.ts";
import type { Achievements } from "../services/achievements/index.ts";

// The Router only uses id, title, and achievements from a manifest.
// Using a structural subtype avoids variance conflicts with GameManifest<T>.
export interface GameEntry {
  readonly id: string;
  readonly title: string;
  readonly achievements: readonly [
    AchievementDef,
    AchievementDef,
    AchievementDef,
  ];
}

// ---------------------------------------------------------------------------
// Public surface — ≤ 5 methods
// ---------------------------------------------------------------------------

export interface Route {
  readonly path: string;
}

export interface RouterOptions {
  readonly engine: Engine;
  readonly economy: Economy;
  readonly achievements: Achievements;
  readonly registeredGames: readonly { manifest: GameEntry }[];
  readonly window?: Pick<
    Window,
    "addEventListener" | "removeEventListener" | "location"
  >;
}

export interface Router {
  navigate(path: string): void;
  currentPath(): string;
  destroy(): void;
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

const MIN_HIT_PX = "44px";

const GAME_ROUTE = /^\/games\/(.+)$/;

function parseHash(w: Pick<Window, "location">): string {
  const hash = w.location.hash;
  if (!hash || hash === "#") return "/";
  if (hash.startsWith("#/")) return hash.slice(1);
  return "/";
}

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------

export function createRouter(rootEl: HTMLElement, opts: RouterOptions): Router {
  const win = opts.window ?? window;
  const { engine, economy, achievements, registeredGames } = opts;

  let path = parseHash(win);

  // ---- Persistent HUD ----

  const hudEl = document.createElement("header");
  hudEl.setAttribute("data-role", "hud");
  hudEl.style.minHeight = MIN_HIT_PX;

  function updateHud(): void {
    const balance = economy.getBalance();
    const gameMatch = GAME_ROUTE.exec(path);
    if (gameMatch !== null) {
      const id = gameMatch[1];
      const entry = registeredGames.find((g) => g.manifest.id === id);
      const title = entry?.manifest.title ?? "";
      hudEl.textContent = title
        ? `Balance: ${String(balance)} | ${title}`
        : `Balance: ${String(balance)}`;
    } else {
      hudEl.textContent = `Balance: ${String(balance)}`;
    }
  }

  // ---- View container ----

  const viewEl = document.createElement("div");
  viewEl.setAttribute("data-role", "view");

  rootEl.appendChild(hudEl);
  rootEl.appendChild(viewEl);

  // ---- View renderers ----

  function renderPicker(): void {
    viewEl.innerHTML = "";
    const list = document.createElement("ul");
    list.setAttribute("data-role", "picker");

    for (const { manifest } of registeredGames) {
      const li = document.createElement("li");
      const btn = document.createElement("button");
      btn.type = "button";
      btn.setAttribute("data-game-id", manifest.id);
      btn.style.minHeight = MIN_HIT_PX;
      btn.style.minWidth = MIN_HIT_PX;
      btn.textContent = manifest.title;
      btn.addEventListener("click", () => {
        navigate(`/games/${manifest.id}`);
      });
      li.appendChild(btn);
      list.appendChild(li);
    }

    viewEl.appendChild(list);
  }

  function makeBackButton(): HTMLButtonElement {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.setAttribute("data-role", "back");
    btn.style.minHeight = MIN_HIT_PX;
    btn.style.minWidth = MIN_HIT_PX;
    btn.textContent = "Back";
    btn.addEventListener("click", () => {
      navigate("/");
    });
    return btn;
  }

  function renderGame(gameId: string): void {
    viewEl.innerHTML = "";
    viewEl.appendChild(makeBackButton());

    const host = document.createElement("div");
    host.setAttribute("data-role", "game-host");
    viewEl.appendChild(host);

    void engine.start(gameId);
  }

  function renderAchievements(): void {
    viewEl.innerHTML = "";
    viewEl.appendChild(makeBackButton());

    for (const { manifest } of registeredGames) {
      const section = document.createElement("section");
      section.setAttribute("data-game-id", manifest.id);

      const heading = document.createElement("h2");
      heading.textContent = manifest.title;
      section.appendChild(heading);

      const ul = document.createElement("ul");
      for (const achDef of manifest.achievements) {
        const li = document.createElement("li");
        const unlocked = achievements.isUnlocked(manifest.id, achDef.id);
        li.setAttribute("data-achievement-id", achDef.id);
        li.setAttribute("data-unlocked", String(unlocked));
        if (!unlocked) {
          li.style.opacity = "0.4";
        }
        li.textContent = achDef.title;
        ul.appendChild(li);
      }
      section.appendChild(ul);
      viewEl.appendChild(section);
    }
  }

  function renderCurrent(): void {
    updateHud();
    const gameMatch = GAME_ROUTE.exec(path);
    if (path === "/") {
      renderPicker();
    } else if (gameMatch !== null) {
      renderGame(gameMatch[1] ?? "");
    } else if (path === "/achievements") {
      renderAchievements();
    } else {
      // Unknown path — redirect to picker
      navigate("/");
    }
  }

  // ---- Navigation ----

  function navigate(nextPath: string): void {
    const prevPath = path;

    if (GAME_ROUTE.test(prevPath) && nextPath !== prevPath) {
      void engine.stop();
    }

    path = nextPath;
    win.location.hash = `#${nextPath}`;
    renderCurrent();
  }

  // ---- hashchange listener ----

  function onHashChange(): void {
    const nextPath = parseHash(win);
    if (nextPath === path) return;

    if (GAME_ROUTE.test(path)) {
      void engine.stop();
    }

    path = nextPath;
    renderCurrent();
  }

  win.addEventListener("hashchange", onHashChange);

  const disposeEconomy = economy.subscribe(() => {
    updateHud();
  });

  // Initial render
  renderCurrent();

  // ---- Public interface ----

  return {
    navigate,
    currentPath: () => path,
    destroy(): void {
      win.removeEventListener("hashchange", onHashChange);
      disposeEconomy();
      rootEl.removeChild(hudEl);
      rootEl.removeChild(viewEl);
    },
  };
}
