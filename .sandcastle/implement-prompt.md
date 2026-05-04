# TASK

Implement issue #{{TASK_ID}}: {{ISSUE_TITLE}}

Pull the issue using:

!`gh issue view {{TASK_ID}}`

If it references a PRD under `docs/prds/`, read that file before writing code.

Only work on this single issue. Work on branch `{{BRANCH}}`.

# CONTEXT

Read `CLAUDE.md` first — it codifies the project rules (TDD, deep modules, no copyrighted assets, mobile-first, IndexedDB-only).

Recent commits:

!`git log -n 10 --format="%H %s" --date=short`

# DISCIPLINE — non-negotiable

1. **TDD (RED → GREEN → REFACTOR).** Iron law: NO PRODUCTION CODE WITHOUT A FAILING TEST FIRST. If you write code before the test, delete it and start over.
2. **DEEP MODULES.** Small interface, deep behaviour. Do not export types beyond the boundary unless required.
3. **No new top-level deps without an ADR** in `docs/adr/`.
4. **No copyrighted assets.** Original or SPDX-permissive only.
5. **Mobile-first.** Min hit-target 44 px. No rotation gestures.

# WORKFLOW

1. **Explore.** Read tests + adjacent source. Understand the existing surface.
2. **RED.** Write one failing test that captures the next bit of behaviour.
3. **GREEN.** Minimal code to pass.
4. **Verify locally:**
   - `pnpm typecheck`
   - `pnpm lint`
   - `pnpm test`
   - `pnpm build`
5. **REFACTOR.** Tidy while staying green.
6. Repeat 2–5 until the issue's acceptance checkboxes are met.

# COMMIT

Make small, semantic git commits per RED-GREEN cycle. Commit messages:

- One-line subject in imperative mood.
- Reference the issue: `(#{{TASK_ID}})`.
- Body, if needed: WHY (not WHAT).

Example: `engine: add Game interface (#1)`

# WHEN COMPLETE

If the issue's acceptance criteria are all checked off:

- Comment on the issue summarising what was done (don't close it — the merger phase closes it).
- Output `<promise>COMPLETE</promise>`.

If you got stuck:

- Comment on the issue explaining the blocker.
- Output `<promise>COMPLETE</promise>` so the night shift moves on.

# RULES

- ONLY work on a SINGLE issue.
- Do not push to remote — the merger phase handles that.
- Do not edit `CLAUDE.md` unless the issue is specifically about updating it.
- Do not edit other issues' files unless absolutely necessary; if you do, note it in the issue comment.
