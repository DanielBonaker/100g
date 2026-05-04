# 0003 — Sandcastle is opt-in; default night shift uses Claude Code subscription

**Status:** Accepted (2026-05-05)

## Context

Sandcastle (`@ai-hero/sandcastle`) is a Docker-based AFK orchestrator that runs Claude in isolated sandboxes against a backlog of GitHub issues. It is the canonical "night shift" of Matt Pocock's day-shift / night-shift workflow.

**The problem:** Sandcastle authenticates against the Anthropic API and requires `ANTHROPIC_API_KEY` — a separate, per-token billing channel from a Claude Code subscription. Maintainer has marked subscription auth as `wontfix` in [issue #191](https://github.com/mattpocock/sandcastle/issues/191).

For 100g (a 100-day personal project) the recurring per-token cost would be material — rough back-of-envelope: $5–$20 per night × 100 nights = $500–$2000 in tokens above the subscription already paid for.

A near-equivalent capability already exists locally: `superpowers:subagent-driven-development` (Jesse Vincent's plugin, already installed) dispatches a fresh subagent per task with two-stage review (spec compliance + code quality), all within one Claude Code session. Combined with `superpowers:using-git-worktrees` for per-issue isolation, it covers ~95% of Sandcastle's value at $0 incremental cost.

## Decision

**The default night-shift orchestrator is `superpowers:subagent-driven-development` running inside a Claude Code session.** Sandcastle config (`.sandcastle/`) remains in the repo as opt-in only.

Concretely:

- `pnpm factory:night` prints a launch instruction. It does NOT invoke Sandcastle.
- The user starts a Claude Code session in `C:\100g`, pastes the launch instruction, walks away.
- The agent reads `gh issue list --label night-shift`, opens a worktree per issue, dispatches subagent implementer + reviewers, merges to `main`, pushes, closes the issue.
- The label is `night-shift` (not `sandcastle:ready`) — orchestrator-agnostic naming.
- If at any point the user gets API credits or wants Docker isolation, they can run `npx tsx .sandcastle/main.mts` for the same backlog. No code changes needed.

## Consequences

**Positive**

- Zero incremental token cost over the existing Claude Code subscription.
- One fewer prereq (Docker Desktop install) and one fewer secret (`ANTHROPIC_API_KEY`).
- Faster setup: works the moment a Claude Code session opens in the repo.
- Lower-risk dependency: subagent-driven-development ships in `superpowers@5.0.7` (already installed); Sandcastle is a separate moving part.

**Negative**

- No Docker sandbox. A runaway agent could in principle write outside the worktree (mitigated by worktrees + `/git-guardrails-claude-code` from Matt's skills).
- "AFK" requires the host machine not to sleep mid-run — disable sleep or use a power keepalive during the session.
- Subscription rate limits apply. For 100g's small vertical slices, a typical night processes 2–4 issues before any cap; Sandcastle would also hit issues slowly under the same load, just billed differently.
- Parallelism is logical (subagents in one session, sharing the session's context budget) rather than physical (separate processes). For 10–15 parallel issues this would matter; for 2–4 it does not.

## Reconsider when

- Token costs of running Sandcastle become acceptable (e.g., the project starts paying its way).
- A specific safety incident makes Docker isolation necessary.
- Subscription rate limits become a recurring blocker for nightly throughput.
- The project ever grows beyond a single contributor and needs concurrent isolated runs.

## See also

- ADR 0001 — no server (parallel decision: minimise ops surface)
- `CLAUDE.md` — the day shift / night shift section codifies the workflow this ADR supports.
- `.sandcastle/main.mts` — opt-in alternative orchestrator, kept for completeness.
