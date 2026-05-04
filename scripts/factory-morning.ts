// scripts/factory-morning.ts
// Day-shift opener: surface what last night's Sandcastle run produced
// and the day's triaged backlog. The actual planning happens in chat
// with the user via /grill-me → /to-prd → /to-issues → /triage.

import { execSync } from "node:child_process";

const sh = (cmd: string): string =>
  execSync(cmd, { stdio: ["ignore", "pipe", "inherit"] })
    .toString()
    .trim();

console.log("# 100g — Morning Briefing\n");

console.log("## Last night's merges to main");
try {
  const merges = sh(
    'gh pr list --state merged --limit 5 --json number,title,mergedAt --jq "map(select(.mergedAt | fromdateiso8601 > (now - 86400))) | .[] | \\"#\\(.number) \\(.title)\\""',
  );
  console.log(merges || "_(none in the last 24h)_");
} catch {
  console.log("_(gh not configured or no merges)_");
}

console.log("\n## Today's triaged backlog");
try {
  const triaged = sh(
    'gh issue list --state open --label "night-shift" --limit 20 --json number,title,labels --jq "[.[] | \\"#\\(.number) \\(.title)\\"] | join(\\"\\n\\")"',
  );
  console.log(triaged || "_(no issues labelled night-shift)_");
} catch {
  console.log("_(gh not configured)_");
}

console.log(
  "\n## Day-shift checklist\n" +
    "- [ ] Pick the top issue or open a new game brief\n" +
    "- [ ] If new: invoke `superpowers:brainstorming` (drop into `/grill-me` for thorny branches)\n" +
    "- [ ] `/to-prd` → `docs/prds/`\n" +
    "- [ ] `/to-issues` to decompose into vertical slices\n" +
    "- [ ] `/triage` and label `night-shift` what's ready\n" +
    "- [ ] Run `pnpm factory:night` before bed (prints launch instructions for the SDD-based night shift)\n",
);
