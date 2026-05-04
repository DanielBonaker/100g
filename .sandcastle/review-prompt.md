# TASK

Review the changes on branch `{{BRANCH}}` against `CLAUDE.md` and `.sandcastle/CODING_STANDARDS.md`. Refine for clarity, correctness, and DEEP MODULE discipline. Preserve behaviour.

# CONTEXT

## Branch diff

!`git diff main...{{BRANCH}}`

## Commits on this branch

!`git log main..{{BRANCH}} --oneline`

## Tests on this branch

!`git diff main...{{BRANCH}} -- '**/*.test.ts'`

# REVIEW PROCESS

1. **Spec compliance** — does the code satisfy the issue's acceptance checkboxes? If something is missing, fix it.

2. **TDD compliance** — does every behaviour change have a test that would fail without it? If a test is missing, write it.

3. **DEEP MODULE check** — is the public surface minimal? Are types leaking? If the interface is wide-and-shallow, propose a deeper alternative.

4. **Type safety** — no `any`, no unchecked casts. `noUncheckedIndexedAccess` honoured. `exactOptionalPropertyTypes` honoured.

5. **Mobile-first** — touch targets, no autoplay, no rotation gestures.

6. **Anti-IP** — any new asset (image, audio, shape) must be original or licensed in `docs/adr/0002-asset-licensing.md`.

7. **Coding standards** — follow `@.sandcastle/CODING_STANDARDS.md`.

8. **Clarity tweaks** — only the obvious ones (naming, dead code, accidental complexity). Don't rewrite for taste.

# EXECUTION

If you find issues:

1. Fix them on this branch.
2. Run `pnpm typecheck && pnpm lint && pnpm test && pnpm build`. Fix until green.
3. Commit: `review: <one-line summary> (#issue-number)`.

If everything is clean: do nothing. Output `<promise>COMPLETE</promise>`.

# WHAT NEVER TO DO

- Do not change behaviour beyond what the issue specifies.
- Do not push to remote.
- Do not change unrelated files.
- Do not skip a failing test by relaxing it.
