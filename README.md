# 100g

100 mini-games. 100 days. Pixel art. TypeScript. DEEP modules.

> ⚠️ **Factory under construction.** The outer engine, kanban, and AFK orchestrator (Sandcastle) are being built before Game 001 ships. See [`CLAUDE.md`](./CLAUDE.md) for the operating manual.

## Tech

- TypeScript (strict, `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`)
- Vite 6 + PixiJS 8
- Vitest (happy-dom) — TDD-first
- IndexedDB persistence, no server
- GitHub Pages deploy on every merge to `main`

## Local

```bash
pnpm install
pnpm dev          # http://localhost:5173
pnpm test         # one-shot vitest run
pnpm typecheck
pnpm lint
pnpm build        # outputs ./dist
```

## Daily workflow

- **Day shift (with the user):** `superpowers:brainstorming` → optional `/grill-me` → `/to-prd` → `/to-issues` → `/triage`. Issues ready for autonomous build get `sandcastle:ready`.
- **Night shift (AFK):** `pnpm factory:night` runs Sandcastle's `parallel-planner` template, spawning Docker'd Claudes on the labelled backlog. Merges to `main` only on green CI.

## Live

https://danielbonaker.github.io/100g/

## License

MIT — see [`LICENSE`](./LICENSE). All in-repo assets must be original or properly attributed in `docs/adr/0002-asset-licensing.md`. No copyrighted IP.
