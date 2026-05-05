// scripts/factory-night.ts
// Night-shift launcher — subscription edition.
//
// We deliberately do NOT call Sandcastle here. Sandcastle requires
// ANTHROPIC_API_KEY (per-token billing); see ADR 0003. Instead, this
// script surveys the `night-shift` backlog and prints the exact
// launch instruction you give a Claude Code session running in
// C:\100g. Once you say it, the agent invokes
// superpowers:subagent-driven-development and works the queue.
//
// If you ever want the Sandcastle path, see ADR 0003 and run:
//   npx tsx .sandcastle/main.mts

import { execSync } from "node:child_process";

interface Issue {
  number: number;
  title: string;
  labels: { name: string }[];
}

function gh(cmd: string): string {
  return execSync(cmd, { stdio: ["ignore", "pipe", "ignore"] }).toString();
}

console.log("# 100g — Night Shift Briefing\n");

let issues: Issue[];
try {
  issues = JSON.parse(
    gh(
      'gh issue list --state open --label "night-shift" --json number,title,labels --limit 20',
    ),
  ) as Issue[];
} catch {
  console.error("✗ gh CLI failed. Are you authed? `gh auth status` to check.");
  process.exit(1);
}

if (issues.length === 0) {
  console.log(
    "No issues labelled `night-shift` are open.\n\n" +
      "Day shift first: pick up an idea via `superpowers:brainstorming` or\n" +
      "`/grill-me`, then `/to-prd` → `/to-issues` → `/triage`. Add the\n" +
      "`night-shift` label to anything that's truly ready for autonomous\n" +
      "execution (no open design questions, no missing dependencies).\n",
  );
  process.exit(0);
}

console.log(
  `## Queued (${String(issues.length)}) — labelled \`night-shift\`\n`,
);
for (const issue of issues) {
  console.log(`- #${String(issue.number)} ${issue.title}`);
}

console.log(
  "\n## How to run the night shift\n\n" +
    "1. Make sure your machine won't sleep (Settings → System → Power & battery → never).\n" +
    "2. Open a fresh Claude Code session in `C:\\100g`.\n" +
    "3. Paste the launch instruction below.\n" +
    "4. Walk away. Review the resulting PRs / merged commits in the morning.\n\n" +
    "## Launch instruction\n\n" +
    "```\n" +
    "Execute the night-shift backlog using superpowers:subagent-driven-development.\n" +
    "\n" +
    "- Read `gh issue list --state open --label night-shift --json number,title` for the queue.\n" +
    "- Build a dependency graph: for each issue, fetch its body via\n" +
    "  `gh issue view <n> --json body` and find blocker references. Two formats exist:\n" +
    "    1. Structured: `## Blocked by` section followed by `- #<n>` bullets.\n" +
    "    2. Loose: a `Blocked by:` sentence listing either `#<n>` numbers or\n" +
    "       descriptive titles (e.g. `engine/Engine`, `services/economy`,\n" +
    "       `services/achievements`, `shell/Router`). Resolve descriptive titles\n" +
    "       by scanning the open + closed issue list for matching titles.\n" +
    "  Treat a blocker as satisfied if the referenced issue is CLOSED.\n" +
    "- Process in priority order (p1 → p2 → p3). Within each priority tier, prefer\n" +
    "  issues whose blockers are all satisfied. Skip issues with any open blocker.\n" +
    "- For each runnable issue:\n" +
    "  - Create an isolated git worktree via superpowers:using-git-worktrees.\n" +
    "  - Dispatch a fresh implementer subagent (TDD: red → green → refactor).\n" +
    "  - Dispatch a spec-compliance reviewer subagent; fix gaps if any.\n" +
    "  - Dispatch a code-quality reviewer subagent; fix gaps if any.\n" +
    "  - Run `pnpm typecheck && pnpm lint && pnpm test && pnpm build`.\n" +
    "  - If all green, merge the worktree branch back to `main` (no fast-forward),\n" +
    "    push to `origin/main`, and `gh issue close <number>` with a brief summary.\n" +
    "  - If anything fails twice, leave a comment on the issue with the failure\n" +
    "    and move on.\n" +
    "- After every successful merge, re-fetch the queue and re-resolve blockers.\n" +
    "  Closing one issue often unblocks several others; do not stick to the\n" +
    "  initial ordering past the first merge.\n" +
    "- Stop when the queue has no runnable issues left or you hit your\n" +
    "  subscription rate limit.\n" +
    "```\n",
);
