# 100g — Project Instructions for Claude

You are working on **100g**, a 100-day mini-game challenge. This file is the ground truth. Memory at `~/.claude/projects/C--100g/memory/` complements this; if anything contradicts, this file wins.

---

## North star

- 100 mini-games over 100 days, one per day, ~30–60 min/day each.
- All games live on a single web shell at `https://danielbonaker.github.io/100g/`.
- Every game has **3 achievements** + a **cross-game currency** that persists across all games.
- Pixel-art aesthetic. Mobile-first controls. **No copyrighted assets.** Daily deploy on every merge to `main`.
- We are building the **factory** (engine + skills + kanban + AFK orchestrator) BEFORE Game 001.

## Tech invariants — do not change without an ADR

| Layer       | Choice                                                              |
| ----------- | ------------------------------------------------------------------- |
| Language    | TypeScript `strict`, `noUncheckedIndexedAccess: true`               |
| Build       | Vite (`base: "/100g/"` for GH Pages)                                |
| Renderer    | PixiJS + thin custom ECS                                            |
| Test        | Vitest (happy-dom for DOM, node for pure)                           |
| Lint/format | typescript-eslint + Prettier + Husky/lint-staged                    |
| Persistence | IndexedDB only. **No server.** Versioned schema + migration runner. |
| Hosting     | GitHub Pages, deployed by Actions on push to `main`                 |
| Pkg mgr     | pnpm                                                                |

If the current task seems to require a server, an external API, or a new dep, **stop and ask**.

## DEEP MODULES — the architectural contract

Every service exports a **small interface** with **deep behaviour**. Implementation is private. Tests live next to source.

- `src/engine/Game.ts` — the ONE interface every game implements (`init / update / render / teardown` + manifest).
- `src/services/{persistence,economy,achievements,input,audio}` — each a deep module.
- Run `/improve-codebase-architecture` weekly to find deepening opportunities.
- A change is "wide and shallow" if it adds many surface methods; refuse such changes — propose collapsing them into one deeper method first.

## TDD — non-negotiable

> **NO PRODUCTION CODE WITHOUT A FAILING TEST FIRST.**

- Iron law from `superpowers:test-driven-development`. If you wrote code before the test, **delete it**, write the test, watch it fail, then implement minimally. No "adapting" the code into a test scaffold.
- Canonical TDD skill: **`superpowers:test-driven-development`** (it's enforced via the SessionStart hook).
- Matt Pocock's `/tdd` is a synonym — same red-green-refactor cycle.
- Before claiming any task complete, invoke **`superpowers:verification-before-completion`** and paste actual command output.

## Day shift / Night shift — the daily workflow

**Day shift (you, with the user):**

1. `superpowers:brainstorming` is the entry point for new game ideas.
2. For thorny design branches inside it, drop into Matt's `/grill-me` for relentless interview.
3. `/to-prd` synthesises the conversation into a PRD under `docs/prds/`.
4. `/to-issues` decomposes the PRD into vertical-slice GitHub issues. Each issue is independently grabbable.
5. `/triage` walks the state machine; issues ready for autonomous build get the **`sandcastle:ready`** label.

**Night shift (Sandcastle, AFK):**

- `pnpm factory:night` runs `@ai-hero/sandcastle` with the `parallel-planner` template.
- It picks `sandcastle:ready` issues, spawns N Docker'd Claudes in isolated worktrees, branchStrategy `merge-to-head`.
- A run merges to `main` only if CI is green.

**Don't propose `CronCreate` for daily scheduling** — session-only, 7-day cap. Use `pnpm factory:night` manually before bed; OS-level scheduler later.

## Anti-IP rules

- Tetromino/character/sound/sprite assets must be **original**, not copies of copyrighted IP. Many legal Tetris clones exist — copy precedent for shape design, not Tetris Co.
- License every third-party asset in `docs/adr/0002-asset-licensing.md` with a link.
- CI fails if a dependency lacks a SPDX-compatible license.

## Mobile-first constraints

- Default control vocabulary: tap, drag, swipe. **No rotation gestures** unless a game's spec explicitly opts in.
- Min hit-target: 44 × 44 px.
- Test every game in mobile viewport (375 × 667) before merging.
- Audio: starts muted; user must tap to enable (browser autoplay rules).

## Currency & achievement contract

Every `Game` implementation must export a manifest:

```ts
export const manifest: GameManifest = {
  id: "001-balatro-tetris",
  title: "Balatro-Tetris",
  achievements: [
    { id: "rows-50",  title: "Half a Hundred",       criterion: "Clear 50 rows in one run" },
    { id: "rows-100", title: "Centurion",            criterion: "Clear 100 rows in one run" },
    { id: "rows-250", title: "Beyond Reason",        criterion: "Clear 250 rows in one run" },
  ],
  currencyYield: (gameState) => /* deterministic, cap'd, never negative */,
};
```

The shell enforces these at registration time — no game ships without 3 achievements + a yield function.

## Where things live

| What                                          | Path                                                           |
| --------------------------------------------- | -------------------------------------------------------------- |
| Specs (Jesse's brainstorming → writing-plans) | `docs/superpowers/specs/`, `docs/superpowers/plans/`           |
| PRDs (Matt's `/to-prd`)                       | `docs/prds/`                                                   |
| ADRs (architecture decisions)                 | `docs/adr/`                                                    |
| Engine                                        | `src/engine/`                                                  |
| Services (deep modules)                       | `src/services/{persistence,economy,achievements,input,audio}/` |
| Game shell                                    | `src/shell/`                                                   |
| Games                                         | `src/games/NNN-<slug>/`                                        |
| Sandcastle config                             | `.sandcastle/config.ts`, `.sandcastle/prompt.md`               |
| Factory scripts                               | `scripts/factory-morning.ts`, `scripts/factory-night.ts`       |

## Skill priority on this repo

1. **`superpowers:using-superpowers`** — auto-loaded; gates every response.
2. **`superpowers:brainstorming`** — entry point for new design work; falls into Matt's `/grill-me` for deep interviews.
3. **`superpowers:test-driven-development`** — TDD canonical; Matt's `/tdd` is a synonym.
4. **Matt's `/to-prd` → `/to-issues` → `/triage`** — the kanban pipeline. GH Issues are the kanban.
5. **`superpowers:subagent-driven-development`** — for in-session parallel work.
6. **Sandcastle (`pnpm factory:night`)** — for AFK execution against the `sandcastle:ready` backlog.
7. **`/improve-codebase-architecture`** — weekly deep-module review.
8. **`/diagnose`** + **`superpowers:systematic-debugging`** — when things break.

## What you must NEVER do here

- Ship code without a failing test first.
- Add a dependency without an ADR if it's not in the invariants table above.
- Stand up a backend service. (No.)
- Use copyrighted music, sprites, or shape designs.
- Bypass the day-shift human-in-loop for design decisions.
- Use `CronCreate` for cross-session daily scheduling — wrong tool for a 100-day project.
- Create custom "day-shift"/"night-shift" _skills_. They are scripts (`scripts/factory-*.ts`), not skills.
- Add features, refactors, or comments beyond what the issue asks for.

## Status as of repo bootstrap (2026-05-04)

- gh CLI authed as `DanielBonaker`, scopes `repo` + `workflow`.
- `pnpm` 10.29.3, Node 24.11.1.
- `superpowers@5.0.7` plugin installed.
- **Pending user action:** install Docker Desktop, install `mattpocock/skills` via `npx skills@latest add mattpocock/skills`, set `ANTHROPIC_API_KEY` env var (separate from Claude Code subscription) — required by Sandcastle.
