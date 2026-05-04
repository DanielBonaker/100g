---
name: Game
about: A new mini-game in the 100-day challenge
title: "Game NNN: <title>"
labels: ["game"]
assignees: []
---

## Concept

(One paragraph. What is the game and what makes it interesting?)

## Mobile constraints

- Controls: <tap / drag / swipe — list the gestures>
- Hit-targets ≥ 44 px: <yes / opt-out reason>
- No rotation gestures unless explicitly justified here.

## Anti-IP statement

- Confirmed: no copyrighted shapes, characters, music, or sprites.
- Asset sources: <links to royalty-free / original assets>

## The 3 mandatory achievements

| ID         | Title | Criterion |
| ---------- | ----- | --------- |
| `<slug>-1` |       |           |
| `<slug>-2` |       |           |
| `<slug>-3` |       |           |

## Currency yield

(Function sketch. Deterministic. Capped. Never negative.)

```ts
currencyYield: (state) => /* ... */;
```

## Vertical slices (decompose with `/to-issues`)

- [ ]
- [ ]
- [ ]

## Acceptance

- [ ] All 3 achievements unlockable in deployed build
- [ ] Currency yields are bounded and tested
- [ ] Plays cleanly in 375×667 viewport
- [ ] CI green; smoke test green; deployed
