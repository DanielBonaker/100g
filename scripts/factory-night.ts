// scripts/factory-night.ts
// Night-shift entry point. Verifies prereqs, then hands off to the
// .sandcastle/main.mts orchestrator (parallel-planner-with-review template).

import { execSync, spawnSync } from "node:child_process";
import { existsSync } from "node:fs";

function check(cmd: string, hint: string): boolean {
  try {
    execSync(cmd, { stdio: "ignore" });
    return true;
  } catch {
    console.error(`✗ ${hint}`);
    return false;
  }
}

console.log("100g — night shift starting…\n");

let ready = true;
ready =
  check("docker --version", "Docker not installed (Sandcastle needs it).") &&
  ready;
ready = check("gh --version", "gh CLI not installed.") && ready;

if (!process.env.ANTHROPIC_API_KEY && !existsSync(".sandcastle/.env")) {
  console.error(
    "✗ ANTHROPIC_API_KEY not set and .sandcastle/.env is missing.\n" +
      "  Copy .sandcastle/.env.example → .sandcastle/.env and fill it in,\n" +
      "  or export ANTHROPIC_API_KEY in your shell.",
  );
  ready = false;
}

const readyIssues = ((): number => {
  try {
    const out = execSync(
      'gh issue list --state open --label "sandcastle:ready" --json number',
      { stdio: ["ignore", "pipe", "ignore"] },
    ).toString();
    const parsed = JSON.parse(out) as { number: number }[];
    return parsed.length;
  } catch {
    return -1;
  }
})();

if (readyIssues === 0) {
  console.warn(
    "⚠ No issues labelled `sandcastle:ready`. The planner will exit immediately.\n" +
      "  Add the label to issues you want built tonight, then re-run.",
  );
}

if (!ready) {
  console.error(
    "\nFix the prereqs above. See CLAUDE.md → 'Status as of repo bootstrap'.",
  );
  process.exit(1);
}

const queuedDesc = readyIssues >= 0 ? String(readyIssues) : "?";
console.log(`✓ Prereqs OK. ${queuedDesc} sandcastle:ready issue(s) queued.\n`);

const result = spawnSync("npx", ["tsx", ".sandcastle/main.mts"], {
  stdio: "inherit",
  shell: true,
});

process.exit(result.status ?? 1);
