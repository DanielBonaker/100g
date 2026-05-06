# 0002 — Asset licensing & anti-IP

**Status:** Accepted (2026-05-04)

## Context

A 100-day public game challenge is a magnet for IP claims if not careful. Tetris Co aggressively defends its trademarks; copyrighted music gets DMCA'd; sprite-rip culture is endemic in indie game communities.

## Decision

1. Every visual, audio, or design asset must be **original** or licensed under a **SPDX-permissive** license (MIT / Apache-2.0 / CC0 / CC-BY).
2. Every third-party asset must be cited in this file with: source URL, author, license, and date acquired.
3. No game shape, character, or melody may be a clone of a copyrighted one. "Inspired by" is fine; "literally the same" is not.
4. CI runs a license check on dependencies (no GPL, no proprietary).

## Asset registry

| Asset                                     | Source                                                                    | Author                          | License                    | Acquired   |
| ----------------------------------------- | ------------------------------------------------------------------------- | ------------------------------- | -------------------------- | ---------- |
| Drop Deck / Keimgarten audio (all sounds) | Synthesised via WebAudio API oscillators in `src/services/audio/audio.ts` | Original (no third-party asset) | N/A — generated at runtime | 2026-05-06 |

Add rows as assets land.

## Synthesised audio note

Issue #30 uses pure oscillator-based tones (no audio files, no third-party samples).
Real CC0/CC-BY sample assets may replace these tones in a future polish issue.
When they do, each asset must be registered here with source URL, author, license, and date.

## Consequences

- Slower asset acquisition; deliberate.
- Each game's issue must include the anti-IP statement (see `.github/ISSUE_TEMPLATE/game.md`).
- The shell never displays a copyrighted name (e.g. say "block-fall puzzle" not "Tetris-clone" in user-facing copy).

## Reconsider when

- Never. Don't reconsider this one.
