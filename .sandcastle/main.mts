// 100g night-shift orchestrator — parallel-planner-with-review template,
// tailored for our pnpm + GH Issues + sandcastle:ready label setup.
//
// Run via:
//   pnpm factory:night
// or directly:
//   npx tsx .sandcastle/main.mts

import * as sandcastle from "@ai-hero/sandcastle";
import { docker } from "@ai-hero/sandcastle/sandboxes/docker";

// Maximum number of plan→execute→review→merge cycles before stopping.
const MAX_ITERATIONS = 5;

// Sandbox lifecycle hooks. corepack enables pnpm in the default sandbox image,
// then pnpm install brings deps up to date for the worktree.
const hooks = {
  sandbox: {
    onSandboxReady: [
      { command: "corepack enable" },
      { command: "pnpm install --frozen-lockfile" },
    ],
  },
} as const;

// Copy host node_modules into the worktree before each sandbox starts.
// `pnpm install --frozen-lockfile` then patches platform-specific binaries
// and any packages added since the last copy.
const copyToWorktree = ["node_modules"];

const PLANNER_MODEL = "claude-opus-4-7";
const WORKER_MODEL = "claude-sonnet-4-6";

for (let iteration = 1; iteration <= MAX_ITERATIONS; iteration++) {
  console.log(`\n=== Iteration ${iteration}/${MAX_ITERATIONS} ===\n`);

  // ──────────────────────────────────────────────────────────────────────
  // Phase 1: Plan
  // Opus reads sandcastle:ready issues, builds a dependency graph, picks
  // the unblocked subset, assigns branch names, emits <plan>{...}</plan>.
  // ──────────────────────────────────────────────────────────────────────
  const plan = await sandcastle.run({
    hooks,
    sandbox: docker(),
    name: "planner",
    maxIterations: 1,
    agent: sandcastle.claudeCode(PLANNER_MODEL),
    promptFile: "./.sandcastle/plan-prompt.md",
  });

  const planMatch = plan.stdout.match(/<plan>([\s\S]*?)<\/plan>/);
  if (!planMatch) {
    throw new Error(
      "Planning agent did not produce a <plan> tag.\n\n" + plan.stdout,
    );
  }

  const { issues } = JSON.parse(planMatch[1]!) as {
    issues: { id: string; title: string; branch: string }[];
  };

  if (issues.length === 0) {
    console.log("No unblocked sandcastle:ready issues. Exiting.");
    break;
  }

  console.log(`Planning complete. ${issues.length} issue(s) in parallel:`);
  for (const issue of issues) {
    console.log(`  ${issue.id}: ${issue.title} → ${issue.branch}`);
  }

  // ──────────────────────────────────────────────────────────────────────
  // Phase 2: Implement + Review (per branch, in parallel)
  // ──────────────────────────────────────────────────────────────────────
  const settled = await Promise.allSettled(
    issues.map(async (issue) => {
      const sandbox = await sandcastle.createSandbox({
        branch: issue.branch,
        sandbox: docker(),
        hooks,
        copyToWorktree,
      });

      try {
        const implement = await sandbox.run({
          name: "implementer",
          maxIterations: 100,
          agent: sandcastle.claudeCode(WORKER_MODEL),
          promptFile: "./.sandcastle/implement-prompt.md",
          promptArgs: {
            TASK_ID: issue.id,
            ISSUE_TITLE: issue.title,
            BRANCH: issue.branch,
          },
        });

        if (implement.commits.length > 0) {
          const review = await sandbox.run({
            name: "reviewer",
            maxIterations: 1,
            agent: sandcastle.claudeCode(WORKER_MODEL),
            promptFile: "./.sandcastle/review-prompt.md",
            promptArgs: { BRANCH: issue.branch },
          });
          return {
            ...review,
            commits: [...implement.commits, ...review.commits],
          };
        }

        return implement;
      } finally {
        await sandbox.close();
      }
    }),
  );

  for (const [i, outcome] of settled.entries()) {
    if (outcome.status === "rejected") {
      console.error(
        `  ✗ ${issues[i]!.id} (${issues[i]!.branch}) failed: ${String(outcome.reason)}`,
      );
    }
  }

  const completedIssues = settled
    .map((outcome, i) => ({ outcome, issue: issues[i]! }))
    .filter(
      (e) =>
        e.outcome.status === "fulfilled" &&
        e.outcome.value.commits.length > 0,
    )
    .map((e) => e.issue);

  const completedBranches = completedIssues.map((i) => i.branch);

  console.log(
    `\nExecution complete. ${completedBranches.length} branch(es) with commits.`,
  );

  if (completedBranches.length === 0) {
    console.log("No commits this cycle. Continuing.");
    continue;
  }

  // ──────────────────────────────────────────────────────────────────────
  // Phase 3: Merge into main, run CI locally, push.
  // ──────────────────────────────────────────────────────────────────────
  await sandcastle.run({
    hooks,
    sandbox: docker(),
    name: "merger",
    maxIterations: 1,
    agent: sandcastle.claudeCode(WORKER_MODEL),
    promptFile: "./.sandcastle/merge-prompt.md",
    promptArgs: {
      BRANCHES: completedBranches.map((b) => `- ${b}`).join("\n"),
      ISSUES: completedIssues
        .map((i) => `- #${i.id}: ${i.title}`)
        .join("\n"),
    },
  });

  console.log("\nBranches merged + pushed.");
}

console.log("\nNight shift complete.");
