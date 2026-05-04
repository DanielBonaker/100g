// scripts/factory-night.ts
// Night-shift entry point. Runs Sandcastle against the labelled backlog.
// Real implementation lands once @ai-hero/sandcastle is added (P6).
// Today this is a guard rail: warn loudly if prereqs are missing.

import { execSync } from "node:child_process";

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

if (!process.env.ANTHROPIC_API_KEY) {
  console.error("✗ ANTHROPIC_API_KEY not set in environment.");
  ready = false;
}

if (!ready) {
  console.error(
    "\nFix the prereqs above. See CLAUDE.md → 'Status as of repo bootstrap'.",
  );
  process.exit(1);
}

console.log("✓ Prereqs OK.");
console.log(
  "\nSandcastle wiring lands in P6. For now, run manually:\n" +
    "  npx sandcastle init   # one-time\n" +
    "  npx sandcastle run\n",
);
