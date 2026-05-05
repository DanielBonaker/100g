# Drop Deck — Design Spec

| Field         | Value                                                                |
| ------------- | -------------------------------------------------------------------- |
| Slug          | `001-drop-deck`                                                      |
| Title         | Drop Deck                                                            |
| Date          | 2026-05-04                                                           |
| Author        | Daniel Bonaker                                                       |
| Status        | Resolved — post-`grill-me` (2026-05-05)                              |
| Game folder   | `src/games/001-drop-deck/`                                           |
| Brainstorming | Captured from session 2026-05-04, refined via `/grill-me` 2026-05-05 |
| Genre         | Mobile-first roguelike-deckbuilder block-drop puzzle                 |

## 1. One-paragraph overview

A mobile-first puzzle game where the player drops creature-shaped blocks (sourced from the cross-100g bestiary at `docs/franchise/bestiary.jsx`) onto an 8×16 board. Blocks have **no rotation** — neither gesture nor button — so the player's only placement choice is the column. Block geometry comes from the bestiary's 167 cataloged forms (3×3 king-graph, 1–9 cells per block). Each block carries one of **5 effects** (Standard / Ghost / Melt / Impact / Rain), giving 5× variety on the same shape. Blocks come from the player's deck; between rounds the player visits a shop to add blocks via tiered booster packs (Small / Medium / Large by cell count), remove unwanted blocks, or buy run-permanent passives. Runs are endless and harden round-by-round through a garbage-row cadence; runs end only on top-out. Three achievements on mixed axes (`rows-100` / `round-10` / `deck-20`) feed the platform-shell achievement store; cross-game currency drops on each run-end.

## 2. Game design

### 2.1 Core loop

```
Run
├── Round 1 (target 5 rows)
│   ├── Turn N: select-from-queue → drag-to-position → tap-to-commit → resolve-effect → check target/topout
│   ├── ...
│   └── Round-Clear → Lump-Sum + Interest → Shop
├── Round 2 (target 7 rows)
│   ...
└── Run-End on Top-Out → Run-Stats → emit achievement progress + currency yield
```

### 2.2 Run / Round / Turn state machine

Three top-level states inside a run:

| State      | Meaning                                                    | Exits                                                                                 |
| ---------- | ---------------------------------------------------------- | ------------------------------------------------------------------------------------- |
| `InRound`  | Board active, player commits blocks, garbage-cadence ticks | `Round-Cleared` → `InShop`; `Top-Out` → `RunEnded`                                    |
| `InShop`   | Board frozen; player buys/skips                            | `Shop-Exit` → `InRound` with `round + 1`, deck reshuffle, garbage-cadence-counter = 0 |
| `RunEnded` | Top-out reached; final stats screen                        | (terminal — emits callbacks; user returns to shell)                                   |

Triggers:

- **`Round-Cleared`**: `clearedRowsThisRound >= roundTarget(round)`. Pays out lump-sum + interest, transitions to `InShop`.
- **`Top-Out`**: a new block cannot spawn because its spawn cells are occupied (Tetris-classic spawn-blocked). Transitions to `RunEnded`.
- **`Shop-Exit`**: player taps "Continue" in shop. Transitions to next `InRound` with reset garbage counter, reshuffled deck, incremented round, advanced row target.

No turn limit, no run limit. Rounds count monotonically (1, 2, 3, …, theoretically unbounded).

### 2.3 Block model

A block is the atomic unit of gameplay: a connected creature-shape from the bestiary, paired with one effect.

```ts
type Cell = { x: number; y: number };

type EffectId = "standard" | "ghost" | "melt" | "impact" | "rain";

type FranchiseTier =
  | "keim" // 1px
  | "bund" // 2px
  | "funke" // 3px
  | "gestalt" // 4px
  | "wesen" // 5px
  | "titan" // 6px
  | "apex" // 7px
  | "archon" // 8px
  | "absolut"; // 9px (Vollkommen)

interface Block {
  id: string; // <tier>-<name-slug>, e.g. "funke-haken", "wesen-schwert"
  bestiaryId: number; // 0..166, references the bestiary entry
  name: string; // German name from bestiary, e.g. "Haken", "Schwert"
  tier: FranchiseTier; // mapped from cell count
  shape: Cell[]; // canonical, normalized to top-left origin, no rotation
  effect: EffectId; // 1 of 5 effects
  cellCount: number; // 1..9, derived from shape.length
}
```

Cells are stored at canonical positions (no rotation by design — bestiary already enforces canonical orientation). Mirror-equivalent shapes are collapsed in the bestiary via the `sym` flag; chiral shapes appear in only their canonical orientation.

### 2.4 Effect catalog (launch set: 5 effects)

Effects are **per-block**, never per-cell. One block, one effect resolution on landing.

| EffectId   | Behaviour                                                                                                                                                                                                                                                                                                                           | Visual cue                                                         |
| ---------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------ |
| `standard` | Block lands at the targeted column floor — first cell-collision stops descent. Block stays rigid.                                                                                                                                                                                                                                   | Base block sprite                                                  |
| `ghost`    | Block lands at the **deepest row where the entire rigid block fits in empty cells** (passes through above-stack obstructions). May not reach the floor if columns disagree.                                                                                                                                                         | Translucent blue + faint vertical streak through above-stack cells |
| `melt`     | Block disintegrates on landing. Cell count `N` is poured from the drop column top: water-fills the **flood-fill-reachable cavity** (block cells = walls), filling lowest-row first, alternating outward from drop column at each row. Overflow rises above the cavity using the same outward rule. Sealed cavities are unreachable. | Translucent green water animation + ripple                         |
| `impact`   | Block lands as Standard. Then **all cells in the block's bounding box, expanded by 1 cell in every direction (the aura), are cleared**. Cleared cells trigger row-clear checks normally.                                                                                                                                            | Glow + radial aura particle                                        |
| `rain`     | Block disassembles on landing. Each cell falls **independently to its own column's lowest empty cell**. Block keeps its column-distribution but loses its vertical structure. Within a column, multiple cells stack from the lowest empty upward.                                                                                   | Per-column droplet trails                                          |

Effect resolution order on a single landing:

1. Position block per its effect rule (Standard / Ghost / Melt / Rain). Standard and Ghost preserve shape; Melt and Rain disintegrate.
2. Apply Impact aura clear (Impact only). Other effects skip this step.
3. Run row-clear check across all rows.
4. Increment the garbage-cadence counter (one drop = one tick).
5. Check Top-Out for next-spawn.

Effects do not stack. Wildcard / combos are out of scope (deferred — would need a colour or chain subsystem first).

### 2.5 Shape catalog (bestiary subset)

Drop Deck draws from the cross-100g bestiary at `docs/franchise/bestiary.jsx` — **167 creature shapes** defined as connected subsets in a **3×3 king-graph** (cells may be diagonally connected).

**Bounding box hard cap: 3×3.** Max cell count: **9**.

Tier classification follows the bestiary tiers (from `franchise-design.md`):

| FranchiseTier | Cell count | Bestiary pool size | Sub-label (German) |
| ------------- | ---------- | ------------------ | ------------------ |
| `keim`        | 1          | 1                  | Ursprung           |
| `bund`        | 2          | 3                  | Verbindung         |
| `funke`       | 3          | 12                 | Erwachen           |
| `gestalt`     | 4          | 32                 | Formung            |
| `wesen`       | 5          | 49                 | Bewusstsein        |
| `titan`       | 6          | 42                 | Macht              |
| `apex`        | 7          | 21                 | Herrschaft         |
| `archon`      | 8          | 6                  | Vollendung         |
| `absolut`     | 9          | 1 (Vollkommen)     | Transzendenz       |

Drop Deck curates **~28–30 creatures** from the 167-shape bestiary. Booster-tier mapping:

| Booster tier | Source bestiary tiers                       | Pool size | Curation target |
| ------------ | ------------------------------------------- | --------- | --------------- |
| Small ($2)   | Keim + Bund + Funke (1–3 cells)             | 16        | ~8              |
| Medium ($5)  | Gestalt + Wesen (4–5 cells)                 | 81        | ~12             |
| Large ($10)  | Titan + Apex + Archon + Absolut (6–9 cells) | 70        | ~8              |

Total catalog: ~28–30 shapes × 5 effects = **~140–150 unique block definitions**, stored at `src/games/001-drop-deck/catalog/blocks.ts` (curated subset of the bestiary). Block IDs follow `<tier>-<name-slug>`. UI display uses the German bestiary name directly.

The bestiary's mathematical definition (king-graph connectivity) allows diagonal-only-connected shapes — e.g., `Schrägling` (`[[0,0],[1,1]]`), `Diagonale` (`[[0,0],[1,1],[2,2]]`). These are intentional puzzle elements but should be curated carefully — avoid frustrating shapes that produce permanent unfillable holes.

The exact curated list is a balancing-pass output, not a Tag-1 design decision.

### 2.6 Deck mechanics

| Property                    | Value                                                                                                                         |
| --------------------------- | ----------------------------------------------------------------------------------------------------------------------------- |
| Min deck size               | 5 (Remove blocked below this)                                                                                                 |
| Max deck size               | 20 (Add blocked above this)                                                                                                   |
| Starting deck               | 7 blocks, all Standard, drawn from the curated small-tier subset of the bestiary (specific composition is a calibration item) |
| Reshuffle on round start    | Yes — deck fully reshuffled at every `Shop-Exit` → `InRound` transition                                                       |
| Reshuffle on in-round empty | Yes — auto-reshuffle and continue (deck is _not_ a fail source)                                                               |
| Draw model                  | Strict queue (no hand-pick); top-of-deck → next-block slot                                                                    |
| Hold slot                   | One slot (or two with Spare Pocket passive); swap allowed **once per active block** (Tetris-classic rule)                     |
| Next-preview                | 2 upcoming blocks shown above the board (3 with Foresight passive)                                                            |

### 2.7 Board, controls, top-out

**Board:** 8 columns × 16 rows. Origin (0, 0) = top-left. Rows clear bottom-up like classic block-drop.

**Controls (mobile-first, no rotation, no rotation gesture, no rotation button):**

1. Active block sits stationary at the top of the board, snapped to a column.
2. Player **drag-holds anywhere on the board surface** → block snaps to the column under the finger, **clamped so its full bounding box fits within the board** (a 3-wide block on an 8-wide board can sit at columns 0–5 only); ghost-outline at the resolution position highlights where it will land **after the effect resolves**.
3. Player **lifts finger** → selection persists at the last-touched valid column (no commit).
4. Player **taps the active block (or anywhere on the board)** → commit. Block lands, effects resolve, next block enters the active slot.

**Effect-aware ghost-preview:**

- Standard: outline at top of stack.
- Ghost: outline at deepest fitting row + faint translucent vertical streak through above-stack cells.
- Melt: outline shows post-pour water silhouette in the reachable cavity, lowest-row-first with outward spread.
- Impact: outline at top of stack + aura zone shown as faint border around the cells the aura will clear.
- Rain: per-column drop-outlines at each block-column's lowest empty cell.

The hold-swap action is a dedicated UI button (44×44 min hit target) **outside the board area** to avoid drag-conflict. Tapping it once swaps the active block with the held block (or stows it if no held block). Locked from re-use until the active block commits.

**Top-out** is reached on either of:

- A new block spawns at the top-of-board active position and any of its cells overlap an already-occupied board cell.
- A garbage-row injection would shift any existing cell off the top of the board.

Both paths emit the identical `RunEnded` transition.

**Garbage cadence:** every 8 committed drops, a partial garbage row is appended at the bottom (random 6 of the 8 columns filled with `garbage` cells, the other 2 left empty) and the entire stack shifts up one row. **Garbage cells count as filled for row-clear purposes** — the player completes the row by dropping blocks into the empty 2 columns. When a garbage-containing row clears, the garbage cells are removed alongside any block cells in that row.

### 2.8 Shop & currency

**Currency:** in-game `gold`, separate from cross-game currency (which is a platform-shell concept).

**Three earning sources (all active):**

| Source              | Amount                                                   |
| ------------------- | -------------------------------------------------------- |
| Per-row trickle     | +$1 per cleared row, awarded immediately                 |
| Round-clear lump    | $5 + (round - 1) × $1 (so Round 1 = $5, Round 2 = $6, …) |
| Interest on reserve | 10% of held gold at end of round, capped at $5           |

**Shop layout (between every round, skippable):**

| Slot # | Always-present? | Action                                                                        |
| ------ | --------------- | ----------------------------------------------------------------------------- |
| 1      | Yes             | Buy Booster: choose Small ($2) / Medium ($5) / Large ($10) — opens 3-pick     |
| 2      | Yes             | Remove a block: shop shows 3 random blocks from your deck, pay $X to remove 1 |
| 3      | 50% chance      | Buy a Passive: 1 random Passive offered at its tier-cost                      |
| 4      | Always          | Skip Shop → exit immediately, no spend                                        |

**Booster mechanics:** opening a booster shows 3 random blocks weighted by tier × effect-rarity:

| Booster tier | Standard | Ghost | Rain | Melt | Impact |
| ------------ | -------- | ----- | ---- | ---- | ------ |
| Small        | 60%      | 16%   | 12%  | 8%   | 4%     |
| Medium       | 45%      | 20%   | 15%  | 12%  | 8%     |
| Large        | 30%      | 22%   | 20%  | 16%  | 12%    |

Player picks 1 of 3 (or skips). The picked block is added to the deck (assuming under max-20). Specific percentages are placeholder and tuned during playtesting.

**Remove cost:** $3 (tunable). 3 random deck-blocks shown, pay $3 to remove the chosen one. Skip costs nothing.

**Round-target curve:** `target(round) = 5 + 2 × (round - 1)` rows. So Round 1 = 5, Round 2 = 7, Round 3 = 9, …, Round 10 = 23. Linear; tunable.

### 2.9 Passives (launch set: 9)

Passives are run-permanent (purchased → active until top-out). **Max 1 of each per run** (no stacking). Cost determines shop-tier presence. **No effect-amplifier passives** — effects stand on their own.

| Category           | Passive name      | Effect                                                        | Cost |
| ------------------ | ----------------- | ------------------------------------------------------------- | ---- |
| Currency-Boost     | Penny Pincher     | +$1 per cleared row                                           | $5   |
| Currency-Boost     | Compound Interest | Interest cap +50% (max $7.50/round)                           | $5   |
| Currency-Boost     | Round Bonus+      | Round-clear lump-sum +$3                                      | $5   |
| Deck-Convenience   | Spare Pocket      | Hold slot capacity +1 (now 2 slots)                           | $10  |
| Deck-Convenience   | Foresight         | Next-preview shows 3 blocks instead of 2                      | $10  |
| Deck-Convenience   | Warm Start        | Each round starts with 1 Standard block already in hold       | $10  |
| Difficulty-Reducer | Slow Pollution    | Garbage cadence reduced by 1 drop (now every 7 drops)         | $20  |
| Difficulty-Reducer | Foundation        | First row of every round pre-fills with 4 single-cell helpers | $15  |
| Difficulty-Reducer | Skipper's Bonus   | Skipping a shop awards $8 instead of nothing                  | $15  |

The exact balancing of effects and costs is a Tag-1 first-cut, expected to be tuned through play.

### 2.10 Achievements & cross-game currency

Three achievements on **mixed axes** — each rewards a different play style:

```ts
achievements: [
  {
    id: "rows-100",
    title: "Centurion",
    criterion: "Clear 100 rows in one run",
  },
  { id: "round-10", title: "Long Haul", criterion: "Reach round 10" },
  {
    id: "deck-20",
    title: "Full Hand",
    criterion: "End a run with a 20-block deck",
  },
];
```

The game tracks `clearedRowsThisRun`, `highestRoundReached`, and `deck.cards.length`. On crossing each criterion during a run, it emits an achievement-unlock callback. The platform-shell `services/achievements` handles persistence and prevents duplicate awards.

**Cross-game currency yield:** at run-end, the game's `currencyYield(gameState)` returns:

```
yield = min(floor(clearedRowsThisRun / 5), 200) + min(highestRoundReached - 1, 100)
```

Hard cap: **300 per run** (the natural ceiling of the per-component caps). Deterministic, never negative. Awarded to the platform-shell economy service, which adds it to the cross-game balance.

Per-component caps reward endurance without infinite scaling; the cap is high enough that hitting it means an extraordinary run.

## 3. Architecture

### 3.1 Module layout

```
src/shared/franchise/
├── bestiary.ts          # 167-shape data array (cross-100g source of truth)
└── types.ts             # CreatureShape interface + FranchiseTier enum

src/games/001-drop-deck/
├── index.ts             # exports `Game` impl + `manifest`
├── manifest.ts          # the GameManifest (id, title, achievements, currencyYield)
├── catalog/
│   ├── blocks.ts        # ~140-150 block definitions (curated bestiary × 5 effects)
│   └── passives.ts      # 9 passive definitions
├── domain/              # pure logic, no rendering, no Pixi
│   ├── deck.ts          # Deck operations (shuffle, draw, hold)
│   ├── board.ts         # Board state, row-clear, top-out
│   ├── effects.ts       # Effect resolution (Standard / Ghost / Melt / Impact / Rain)
│   ├── garbage.ts       # Garbage-cadence application
│   ├── round.ts         # Round-target curve, round transitions
│   ├── shop.ts          # Shop offer generation, transactions
│   ├── economy.ts       # Local gold accounting, interest calculation
│   └── runState.ts      # Aggregate run-state type + reducers
├── render/              # Pixi.js + ECS layer
│   ├── stage.ts         # Pixi Application bootstrap
│   ├── boardView.ts     # Board cell rendering
│   ├── activeBlockView.ts # Active-block + drag/preview (effect-aware ghost)
│   ├── shopView.ts      # Shop overlay
│   ├── hudView.ts       # Score, round, gold, hold, next-preview
│   └── effects/         # Particle systems (Impact aura, Melt water, Rain droplets, row-clear)
├── input/               # Adapters consuming services/input → domain commands
│   └── controller.ts    # Drag-position + tap-confirm + hold-swap-button
└── tests/               # vitest (happy-dom for render-adjacent, node for pure)
    ├── deck.test.ts
    ├── board.test.ts
    ├── effects.test.ts
    ├── garbage.test.ts
    ├── shop.test.ts
    ├── economy.test.ts
    ├── runState.test.ts
    ├── topout.parity.test.ts
    └── persistence.test.ts
```

**Boundaries:**

- `domain/` contains zero Pixi imports, zero DOM access. Pure functions and reducers. Fully unit-testable in node.
- `render/` consumes `domain/` state and renders. No game logic lives here.
- `input/` translates raw `services/input` events into domain commands.
- `src/shared/franchise/bestiary.ts` is shared cross-game data — Drop Deck consumes it as read-only.

### 3.2 Game interface implementation

Per `src/engine/Game.ts` contract (currently a `.gitkeep`'d skeleton; this spec assumes the contract from `CLAUDE.md`):

```ts
import type { Game, GameManifest } from "@/engine/Game";

export const manifest: GameManifest = {
  /* see § 2.10 */
};

export const game: Game = {
  init(ctx) {
    /* mount Pixi stage to ctx.container, load catalog, init RunState */
  },
  update(dtMs) {
    /* tick effects' particle systems; no gravity tick needed */
  },
  render() {
    /* Pixi auto-renders via tween/ticker */
  },
  teardown() {
    /* unmount Pixi stage, release listeners */
  },
};
```

`update / render` are mostly idle in this game (no gravity, no falling). They animate transitions (Melt water, Rain droplets, Impact aura, row-clear flash, garbage-shift) via Pixi's ticker.

### 3.3 Service dependencies

Each consumed service is named by its `src/services/` deep-module slug:

| Service        | Used for                                                                                               |
| -------------- | ------------------------------------------------------------------------------------------------------ |
| `input`        | Touch/drag/tap event normalisation; mobile pointer events                                              |
| `persistence`  | Save run-snapshot after every committed block (50ms debounce); save best-run stats at run-end          |
| `economy`      | Receive `currencyYield()` output at run-end; add to cross-game balance                                 |
| `achievements` | Emit achievement-unlock events on threshold crossings (rows-100, round-10, deck-20)                    |
| `audio`        | Block-land sfx, row-clear sfx, Impact boom, Melt splash, Rain patter, ambient shop music. Starts muted |

No new dependencies. Pixi is already a dep; no other packages introduced.

### 3.4 ECS layer use

The engine's "thin custom ECS" is used for **render-side** entities only — particle systems, animated cells during row-clear, Melt water animation, Rain droplet trails. Domain state is _not_ an ECS — it is plain reducers over typed structures, because the simulation is fully discrete and event-driven.

## 4. Data model

### 4.1 RunState (top-level)

```ts
interface RunState {
  state: "InRound" | "InShop" | "RunEnded";
  round: number; // 1-indexed
  roundTarget: number; // memoised from round
  clearedRowsThisRound: number;
  clearedRowsThisRun: number;
  highestRoundReached: number;
  gold: number;
  deck: Deck;
  hold: Block[]; // capacity 1 (or 2 with Spare Pocket passive)
  next: Block[]; // length 2 (or 3 with Foresight passive)
  active: Block | null;
  activeColumn: number; // current drag-position
  board: Board;
  passives: Set<PassiveId>;
  garbageCounter: number; // increments per drop, resets on round-start
  achievementsUnlockedThisRun: Set<AchievementId>;
}
```

### 4.2 Deck

```ts
interface Deck {
  cards: Block[]; // all blocks owned this run, persisted across rounds
  shuffleOrder: Block[]; // in-round draw order, regenerated on shuffle
  drawIndex: number; // pointer into shuffleOrder; auto-reshuffle on overflow
}
```

### 4.3 Board

```ts
interface Board {
  width: 8;
  height: 16;
  cells: (CellContents | null)[][]; // [row][col], row 0 = top
}
type CellContents = { kind: "block"; effect: EffectId } | { kind: "garbage" };
```

### 4.4 Persistence

| What                        | When persisted                              | Survives                              |
| --------------------------- | ------------------------------------------- | ------------------------------------- |
| Active run snapshot         | After every committed block (50ms debounce) | Browser refresh / mobile interruption |
| Best run stats per game     | At every run-end                            | Forever                               |
| Cross-game currency balance | At every run-end                            | Forever, shared across all games      |
| Achievements unlocked       | At unlock event                             | Forever                               |

Save-after-commit ensures mid-round resilience on mobile (tab kill, OS sleep, incoming call). IndexedDB writes are async and non-blocking; debounce coalesces rapid commits within a 50ms window. RNG state is included in the run-snapshot to make resumes deterministic.

Persistence is via `services/persistence` (IndexedDB). No server. Per ADR 0001.

## 5. Testing strategy

**TDD is non-negotiable** (per CLAUDE.md). Every public function in `domain/` is implemented test-first.

### 5.1 Unit tests (Vitest, node env)

- `deck.test.ts` — shuffle determinism with seeded RNG, draw-pointer wraparound, hold-swap-once-per-block lock, min/max deck size enforcement on add/remove.
- `board.test.ts` — block placement at column (rigid), row-clear detection, garbage-row injection, cell-shift-up on garbage, top-out detection on spawn collision; **king-adjacency-aware shape connectivity** (cells diagonally connected belong to same block).
- `effects.test.ts` — five suites:
  - `standard` — block lands at first collision, rigid; tests at floor, on top of stacks, against walls.
  - `ghost` — finds deepest row where rigid block fits in all-empty cells; reaches under overhangs (created by Melt/Impact); may NOT reach the floor on uneven columns; identical to Standard when no overhangs exist.
  - `melt` — flood-fill from drop col top through empty cells (block cells = walls); fills bottom-up with outward spread from drop col; overflow stacks above using same outward rule; sealed (encapsulated) cavities are unreachable; tunnels fill horizontally; buckets hold water; N exceeds reachable region size → overflow rises.
  - `impact` — clears all cells in the bounding-box-+1 aura; works for any block size; tests with 1×1 (3×3 aura), 2×2 (4×4 aura), 1×4 (3×6 aura), 3×3 (5×5 aura).
  - `rain` — each cell falls to its column's lowest empty independently; per-column stacking when block has multiple cells per column (e.g., 3×3 brick → 3 cells stacked per column).
- `garbage.test.ts` — counter increments per drop, triggers at threshold, resets at round-start, integrates with passive `Slow Pollution`.
- `shop.test.ts` — booster offer generation respects tier × effect-rarity weights (statistical test with seeded RNG, tolerance bounds), remove-3-of-deck samples uniformly, currency deduction, max-deck-size enforcement.
- `economy.test.ts` — per-row trickle, round-clear lump-sum formula, interest cap, gold non-negative invariant, currency-yield formula = `min(rows/5, 200) + min(round-1, 100)` with hard cap at 300.
- `runState.test.ts` — state transitions (`InRound` ↔ `InShop` ↔ `RunEnded`) on correct triggers, idempotent shop-exit, achievement-unlock-once-per-run guarantee, mixed-axis achievement triggers (rows-100, round-10, deck-20).
- `topout.parity.test.ts` — spawn-block top-out and garbage-shift top-out produce identical `RunEnded` state (same final stats, same achievements, same currency yield).
- `persistence.test.ts` — save-after-commit produces a state from which the run can be fully restored (RNG state preserved); debounce coalesces rapid commits to a single write within window; restore preserves achievements + RNG state.

### 5.2 Integration tests (Vitest, happy-dom env)

- `input/controller.test.ts` — drag-position-then-tap-commit gesture sequence, hold-swap button click, double-tap rejection.
- A smoke test that mounts the game, simulates a 5-row clear, and asserts a `Round-Cleared` transition + correct gold payout.

### 5.3 Mobile viewport

Per CLAUDE.md, every game tested in 375×667 viewport before merging. Manual smoke pass: drag-position works on touch, hit-targets ≥ 44×44 px, no scroll-conflict with system gestures.

### 5.4 What is **not** tested

- Particle visuals (no snapshot tests for Pixi rendering — visual regression is human-reviewed during night-shift QA).
- Audio playback (per Audio service; service-level tests live there).

## 6. Out of scope (deferred / cut)

Explicitly out of scope for this spec — these were considered and removed:

- **Slide effect.** Cut during grill-me 2026-05-05; replaced with Melt as a richer, more strategic 5th-effect-slot (Melt + Rain together cover what Slide attempted).
- **Effect-amplifier passives** (Sliding Strong, Big Bang, Phase Walker). Cut during grill-me to reduce passive-list complexity; effects stand on their own without leveling.
- **Per-block rotation.** Bestiary's canonical orientations are the only orientations; mirror-collapsed by `sym` flag.
- **Meta-progression between runs.** No persistent block-pool unlocks, no cross-run upgrades. (Platform-shell handles cross-game currency, which is its own kind of meta — but the game itself has no per-game meta.)
- **Hand-pick from drawn cards.** The deck is a strict queue. The Roguelike-card-pick feel is delivered via Hold-slot + Shop, not via a hand of N.
- **Procedural shape mutation.** Shapes are fixed at catalog-pick time; no Cell-add/remove transformations during the run.
- **Per-cell effects.** A block has one effect total. No mixed-effect cells within a single block.
- **Wildcard effect.** Cut — would only make sense paired with a Combo or Color-match subsystem, which is also cut.
- **Combos / colour-match / chain bonuses.** No row-cleared multipliers, no chain detection.
- **Consumables.** No mid-round usable items.
- **Multiple difficulty modes.** No Easy / Normal / Hard. One mode, escalating round-target curve provides the difficulty arc.
- **Online features.** No leaderboards, no shareable runs, no telemetry. Per ADR 0001.
- **Win state.** Endless run. Top-out is the only way out.
- **Bestiary fusion economy.** Drop Deck consumes shape geometry from the bestiary but does NOT implement the franchise's fusion mechanic (which is specific to the cross-100g creature game).

## 7. Compliance notes

| Concern                                                           | Status                                                                     |
| ----------------------------------------------------------------- | -------------------------------------------------------------------------- |
| ADR 0001 (no server)                                              | ✓ All state IndexedDB; no fetch calls                                      |
| ADR 0002 (asset licensing & anti-IP)                              | ✓ Bestiary names are original German; no franchise IP referenced anywhere  |
| ADR 0003 (no sandcastle by default)                               | ✓ Spec is orthogonal to night-shift orchestrator choice                    |
| TDD invariant (no production code without failing test)           | ✓ § 5 enumerates the test plan                                             |
| Mobile-first, no rotation, ≥44×44 hit targets, audio starts muted | ✓ § 2.7 + § 3.3                                                            |
| No new runtime dependencies                                       | ✓ Pixi already in `package.json`                                           |
| TypeScript strict + `noUncheckedIndexedAccess`                    | ✓ Catalog access via guarded getters; no raw indexing                      |
| Cross-100g shape consistency                                      | ✓ Bestiary is shared source of truth at `src/shared/franchise/bestiary.ts` |
| Bestiary fusion economy boundary                                  | ✓ Drop Deck does NOT implement franchise fusion; uses geometry only        |

## 8. Decisions resolved during grill-me 2026-05-05

12 design decisions locked from the grill-me session:

1. **No rotation.** No gesture, no button, no rotation mechanic of any kind. Bestiary's canonical orientations are the only orientations.
2. **Curated catalog** with hand-picked orientations from bestiary (compatible with bestiary's mirror-collapsed canonical orientations).
3. **Slide → Melt.** Slide effect cut; replaced with Melt = water-fill physics (flood-fill from drop column, alternate outward at each row, overflow stacks above using same rule, sealed cavities unreachable).
4. **Impact = aura.** Bounding-box + 1-cell border in every direction. No center-cell ambiguity. Catalog curation prevents oversized Impact blocks.
5. **Ghost = rigid, deepest fitting row.** Block stays as a rigid unit; descends to the deepest position where all cells are in empty board cells.
6. **5 effects total.** Standard / Ghost / Melt / Impact / Rain.
7. **Rain = per-column disassemble.** Each cell falls to its own column's lowest empty cell, independently.
8. **Effect-amplifier passives removed.** 9 passives total, three categories of three. No per-effect upgrades.
9. **Currency cap = `min(rows/5, 200) + min(round-1, 100)`, max 300/run.** Per-component caps; rewards endurance without infinite scaling.
10. **Achievements = mixed axes.** `rows-100` (Centurion), `round-10` (Long Haul), `deck-20` (Full Hand). Each rewards a different play style.
11. **Persistence = save after every commit, 50ms debounce.** Mid-round resilience for mobile play.
12. **Bestiary integration.** Catalog draws from cross-100g 167-shape bestiary at `docs/franchise/bestiary.jsx`. **3×3 bbox cap** (was 4×4); **9 cells max** (was 16). Shapes extracted to `src/shared/franchise/bestiary.ts` for cross-game read-only access.

### Calibration items deferred to playtesting

These were flagged during grill-me as tuning concerns rather than architecture:

- Round-target curve (linear `5 + 2(round-1)` vs quadratic).
- Garbage cadence number (every 8 drops).
- Booster prices ($2 / $5 / $10) and remove-cost ($3).
- Booster rarity percentages (placeholder in §2.8).
- Foundation passive details + interaction with garbage row.
- Starting deck composition (currently 7× Standard small-tier blocks; specific bestiary picks TBD).
- Concrete catalog curation: which ~28–30 of the 167 bestiary creatures are included, especially how many diagonal-only-connected shapes survive curation.

## 9. Glossary (project-local terminology)

For future `CONTEXT.md` seeding when `setup-matt-pocock-skills` runs in this repo.

**Game terms:**

- **Block** — atomic playable unit; a creature shape with one effect.
- **Bestiary** — the cross-100g 167-creature catalog at `docs/franchise/bestiary.jsx`. Source of truth for shape geometry.
- **Creature** — bestiary entry; equivalent to a "shape" or "piece" in classical block-drop games.
- **Deck** — the player's owned set of blocks for the current run.
- **Round** — one row-clearing target between two shop visits.
- **Run** — one continuous play session from start to top-out.
- **Booster** — a shop-purchasable pack offering 3 random blocks of a tier, pick 1.
- **Passive** — a run-permanent purchasable effect, max 1 of each per run.
- **Garbage** — uncleanable filler row injected from below to ramp difficulty.
- **Top-out** — failure state: a new block cannot spawn, or garbage shift would push existing cell above row 0.

**Effects:**

- **Standard** — block lands at first collision, rigid.
- **Ghost** — rigid block lands at deepest fitting row (passes through above-stack obstructions).
- **Melt** — block disintegrates and water-fills the flood-fill-reachable cavity below the drop column.
- **Impact** — block lands as Standard, then clears the bbox+1 aura around it.
- **Rain** — block disassembles by column; each cell falls to its column's lowest empty independently.

**Franchise tier names** (creature-size hierarchy from the bestiary):

- **Keim** (1px) — Ursprung (origin)
- **Bund** (2px) — Verbindung (connection)
- **Funke** (3px) — Erwachen (awakening)
- **Gestalt** (4px) — Formung (formation)
- **Wesen** (5px) — Bewusstsein (consciousness)
- **Titan** (6px) — Macht (power)
- **Apex** (7px) — Herrschaft (dominion)
- **Archon** (8px) — Vollendung (perfection)
- **Absolut** (9px, Vollkommen) — Transzendenz (transcendence)

---

**End of spec.**
