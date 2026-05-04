# 100g Coding Standards

These rules supplement `CLAUDE.md`. The reviewer agent loads this via `@.sandcastle/CODING_STANDARDS.md` so the standards are enforced at review time without spending implement-phase tokens.

## Style

- TypeScript strict, no `any`, no `as` casts unless commented and justified.
- Named exports only — no `default export`.
- One concept per file. File name matches the dominant export.
- camelCase for variables and functions. PascalCase for types and classes. SCREAMING_CASE for true constants.
- 2-space indent. LF line endings. UTF-8.
- No trailing whitespace except in `.md`.
- Imports sorted: external → `@/` aliases → relative. No deep cross-package imports — go through index files.

## Tests

- Tests live next to source: `src/foo/Foo.ts` ↔ `src/foo/Foo.test.ts` or `src/foo/__tests__/Foo.test.ts`.
- Each test file describes ONE module.
- Test names describe behaviour, not implementation: `it("rejects spend below balance")`, not `it("calls _validate")`.
- Always assert outputs / state changes — never just call and trust it didn't throw.
- Fakes > mocks for stateful collaborators (persistence, audio).
- Snapshot tests are forbidden unless an ADR says otherwise.

## Architecture (DEEP MODULES)

- Public interface ≤ 5 methods until proven otherwise.
- Hide implementation details. The body of a function should be longer than its signature.
- No god-classes. Composition > inheritance.
- A change that adds many shallow methods to expose internals is a smell — propose a deeper method instead.
- Cross-module deps go through interfaces, not concrete types.

## Naming

- No "manager", "handler", "helper", "util" in module names. They mean nothing.
- Prefer noun-typed names for domain entities (`Economy`, `Achievements`, `Persistence`), verb-typed for actions (`createEngine`, `unlockAchievement`).

## Errors

- Don't `try/catch` to silence — only to translate or recover.
- Don't return `undefined` for "didn't happen" — return a typed result (`{ ok: true } | { ok: false, reason: ... }`) or use a typed `Error` subclass.
- Never throw on invalid user input from a game; surface it as an event the engine can react to.

## Comments

- WHY only. Code explains WHAT.
- No commented-out code. Delete it.
- No `// TODO` without a linked issue number.

## Git

- Commits are imperative, one-liner subject ≤ 72 chars.
- Each commit compiles and tests green.
- No "wip" or "fix typo" commits in merged history — squash or amend pre-merge.
- Reference the issue: `(#42)` in subject or body.

## Anti-IP

- No copyrighted shapes, characters, music, sprites.
- Every third-party asset cited in `docs/adr/0002-asset-licensing.md`.
- No "inspired by" copies of trademarked Tetris shapes — use original variants.

## Mobile

- Min hit-target 44 × 44 px.
- No rotation gestures unless game spec explicitly opts in.
- Test in 375 × 667 viewport before merging UI changes.
