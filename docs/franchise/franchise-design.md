# 13123249422161

A persistent pixel creature game in a shared MMO world.

## Core Concept

Every creature is made of 1–9 living pixels on a 3×3 king-adjacency grid. There are exactly 167 possible shapes, cataloged in `bestiary.jsx`. Shape + pixel types = creature identity.

## Pixel Types (6)

- **Puls** (red) — rhythmic pulsing, Vitalität
- **Phase** (blue) — visibility shifting, Ausweichen
- **Funke** (yellow) — electric flicker, Angriff
- **Void** (purple) — light absorption, Absorption
- **Blüte** (green) — organic color drift, Regeneration
- **Kristall** (white) — prismatic shimmer, Verstärkung

## Evolution Tiers (9)

1px Keim → 2px Bund → 3px Funke → 4px Gestalt → 5px Wesen → 6px Titan → 7px Apex → 8px Archon → 9px Absolut (Vollkommen)

Each tier = number of pixels in the creature.

## Fusion

Two creatures merge permanently. Their pixels combine into one larger creature. A 3px + 5px = 8px Archon.

## World

A vast 2D plane viewed from above. The player owns land, places creatures in gardens, and expands territory. Creatures live on the land persistently — they exist whether the player is watching or not.

## Monetarisierung

Archon-Zerfall, ein Archon kann in zwei 4px Kreaturen gespalten werden, diese Teile merken sich die geteilte Geschichte inkl. Spaltung.
Außerdem können Landflächen und gekauft werden und Werbung entfernen + 1 Inventar-Platz.

## Gameplay Loop

- Creatures spawn/arrive on the player's land
- Player earns from what creatures achieve (idle/passive income)
- Earnings buy more land
- Player fuses creatures to create stronger ones
- Permanent decisions — no undo, no exiting fate
- The game persists, the world keeps going
- Potentially there could be action mini games where the own creatures use ML/AI/NN to win 2D levels. This improvement-Loop could be trained in cycles.

## Visual Rules

- True pixel art. Every pixel renders at exactly 1:1 native resolution.
- Optional 4x/8x integer zoom changes display size only, not visual fidelity.
- Creatures are their literal pixels — a 3px creature is 3 pixels on screen (before zoom).

## Files

- `lumina.jsx` — creature builder demo (4×4 grid UI for composing creatures)
- `bestiary.jsx` — all 167 shapes with names, tiers, symmetry data
- `lumina_world.jsx` — world prototype (needs rework for new direction)
