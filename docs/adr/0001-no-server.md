# 0001 — No server. IndexedDB only.

**Status:** Accepted (2026-05-04)

## Context

100g must deploy daily, cost ~zero, and run on mobile. Cross-game currency + per-game achievements need persistence.

## Decision

All state lives in **IndexedDB** on the client. No backend. No login. No cross-device sync (yet).

## Consequences

**Positive**

- Free hosting on GitHub Pages.
- Zero ops.
- Privacy by default — no telemetry, no data collected.
- Trivial CI (no DB migrations server-side, no secrets in deploy).

**Negative**

- No cross-device save. Clearing browser data clears progress.
- Anti-cheat is impossible — fine for a personal showcase, not for leaderboards.
- Schema migrations must run client-side; the `services/persistence` migration runner handles this.

## Reconsider when

- The challenge is complete (Day 100) and we want to add multiplayer or shareable highscores.
- A specific game design genuinely requires server logic that can't be approximated locally.

## See also

- `src/services/persistence/` — IndexedDB wrapper + migration runner.
- ADR 0002 (asset licensing) for the parallel anti-IP decision.
