# ISSUES

Open issues labelled `sandcastle:ready` in the repo:

<issues-json>

!`gh issue list --state open --label "sandcastle:ready" --json number,title,body,labels,comments --jq '[.[] | {number, title, body, labels: [.labels[].name], comments: [.comments[].body]}]'`

</issues-json>

# REPO CONTEXT

Read `CLAUDE.md` for the project rules. Read open PRDs in `docs/prds/` if any of them are referenced by the issues.

# TASK

Analyze the issues above and build a dependency graph. For each issue, determine whether it **blocks** or **is blocked by** any other open issue.

Issue B is **blocked by** issue A if:

- B requires code or infrastructure A introduces (e.g. `services/economy` depends on `services/persistence`)
- B and A modify overlapping files / modules (concurrent work would conflict)
- B's spec depends on a decision A establishes
- An issue body explicitly says "Blocked by: ..."

An issue is **unblocked** if it has zero blocking dependencies on other open issues.

For each unblocked issue, assign a branch name in the format `sandcastle/issue-{id}-{slug}` (kebab-case slug from title, ≤ 30 chars).

Cap the parallel set at **4 issues** per cycle to keep token cost predictable.

# OUTPUT

Output your plan as a JSON object wrapped in `<plan>` tags:

<plan>
{"issues": [{"id": "1", "title": "engine/Game — the one interface every game implements", "branch": "sandcastle/issue-1-engine-game-interface"}]}
</plan>

If everything is blocked, include the single highest-priority candidate (the one with the fewest blockers and the highest `priority:p*` label).

If there are no `sandcastle:ready` issues, output `<plan>{"issues":[]}</plan>` and stop.
