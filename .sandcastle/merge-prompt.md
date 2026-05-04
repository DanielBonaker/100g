# TASK

Merge the following branches into `main`, run the full CI locally, then push to `origin/main`.

Branches to merge:

{{BRANCHES}}

# STEPS

For each branch (in order):

1. `git switch main`
2. `git merge <branch> --no-ff --no-edit`
3. If there are conflicts, resolve them by reading both sides and choosing the right resolution. Prefer the branch's intent for code under that branch's owning module; prefer `main` for unrelated incidental changes.
4. After each merge, run:
   - `pnpm typecheck`
   - `pnpm lint`
   - `pnpm test`
   - `pnpm build`
5. If anything fails, fix on `main` (keep the merge atomic — don't unwind), commit the fix as `fix: post-merge <reason>`.

When all branches are merged and the full CI passes locally:

# PUSH

`git push origin main`

If the push is rejected:

- `git fetch origin main && git rebase origin/main` if the remote moved ahead.
- Re-run the full CI locally.
- `git push origin main` again.

If push fails for any other reason (auth, branch protection), leave the merge on `main` locally, leave a comment on each merged issue explaining "merged locally, push failed: <reason>", and stop.

# CLOSE ISSUES

For each branch that successfully merged AND was pushed, close its issue:

`gh issue close <ID> --comment "Merged in $(git rev-parse HEAD). Closed by Sandcastle."`

Issues to close:

{{ISSUES}}

# DONE

Output `<promise>COMPLETE</promise>` once all branches are merged + pushed + issues closed (or partial state explained).
