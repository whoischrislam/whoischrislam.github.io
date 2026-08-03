# OpenClaw Contribution Plan

Updated: July 25, 2026

This plan converts firsthand friction from `OPENCLAW_INSTALL_JOURNEY.md` into current-source contribution candidates. Every candidate below is verified against the installed release, current upstream source, or both. Items that still require reproduction are labeled.

## Ranking

| Rank | Candidate | Contribution-to-effort | Effort | Status |
| --- | --- | --- | --- | --- |
| 1 | Suppress the redundant deep-audit hint | Very high | S | Implemented locally |
| 2 | Add recovery guidance for Gateway-only commands in the local TUI | High | S/M | Verified candidate |
| 3 | Separate active and inactive policy in `sandbox explain` | High | M | Verified candidate |
| 4 | Make config dry-run receipts identify the proposed paths and checks | Medium | M/L | Verified candidate |
| 5 | Explain effective inventory versus model-facing tools | Medium | L | Parked |
| 6 | Preview capability loss from a restrictive plugin allow list | Medium | L | Issue-first product change |

## Candidate 1: Suppress the redundant deep-audit hint

### Firsthand friction

`openclaw security audit --deep` completed a deep audit and then printed:

```text
Run deeper: openclaw security audit --deep
```

The command recommended the mode that was already active.

### Current-source trace

- `src/cli/security-cli.ts`
- `src/cli/security-cli.test.ts`

Current `main` unconditionally adds the hint to human-readable audit output. JSON output is separate and unaffected.

### Proposed fix

Print the hint only when `--deep` is not active. Add focused coverage for shallow and deep runs.

### Effort

S

### Contribution status

A local branch now contains the implementation and behavior test:

```text
fix/security-audit-deep-hint
```

The focused CLI test passes. Both changed files pass formatting, focused lint, and `git diff --check`.

The repository review harness was attempted on July 25. It stopped before model review because TruffleHog is not installed. The harness does not permit automatic installation. Manual review found no actionable issue in the two-file patch.

### Draft PR title

```text
fix(security): omit deep-audit hint after deep runs
```

### Draft PR description

#### What Problem This Solves

Fixes an issue where users running `openclaw security audit --deep` would still be told to run the same deep-audit command after the audit completed.

#### Why This Change Was Made

The human-readable audit output now shows the deep-audit hint only after a shallow run. JSON output and audit behavior are unchanged.

#### User Impact

Users no longer receive a redundant next step after they have already completed the deeper audit.

#### Evidence

- Reproduced on OpenClaw 2026.7.1-2.
- Verified the unconditional hint on current `main`.
- Added focused coverage for shallow and deep human-readable output.
- Focused result: 1 test file passed, 9 tests passed.
- Both changed files passed `oxfmt --check` and focused `oxlint`.
- `git diff --check` passed.
- The repository autoreview harness was attempted but could not start without TruffleHog.
- AI-assisted. The behavior was observed and independently verified by Chris Lam.

### Issue-first decision

No issue is required. `CONTRIBUTING.md` permits direct PRs for bugs and very small fixes. No matching issue or PR was found in a live GitHub search.

## Candidate 2: Add recovery guidance for Gateway-only commands in the local TUI

### Firsthand friction

The local embedded TUI exposed `/tools` in the command vocabulary, then responded:

```text
/tools is not available in local embedded mode; message not sent
```

It did not explain that the command requires a Gateway-backed TUI or how to open one.

### Current-source trace

- `src/tui/tui-command-handlers.ts`
- `src/tui/tui-command-handlers.test.ts`
- `src/tui/tui-pty-local.e2e.test.ts`
- `src/tui/AGENTS.md`

Current `main` uses one generic refusal message for shared commands entered in local mode.

### Proposed fix

State that the command requires a Gateway-backed TUI. Give the recovery command:

```text
Exit and run openclaw tui after starting the Gateway.
```

Keep the message generic for every shared command that follows the same boundary.

### Effort

S/M

### Issue-first decision

Likely direct PR after focused implementation and PTY proof. Search for related open work before starting.

## Candidate 3: Separate active and inactive policy in `sandbox explain`

### Firsthand friction

The command correctly reported `runtime: direct` and `mode: off`, then presented `workspaceAccess: none`, Docker backend details, sandbox tool allow and deny lists, and sandbox fix paths with equal visual weight.

### Current-source trace

- `src/commands/sandbox-explain.ts`
- `src/commands/sandbox-explain.test.ts`
- `docs/gateway/sandbox-vs-tool-policy-vs-elevated.md`

Current `main` always renders configured sandbox details and the heading `Sandbox tool policy`, even when the selected session is not sandboxed.

### Proposed fix

Keep the details available, but label them as inactive when the effective runtime is direct. Lead with the active execution boundary and avoid implying that `workspaceAccess: none` describes current host-workspace access.

### Effort

M

### Issue-first decision

Direct bug-fix PR may be appropriate if the change remains a labeling correction. A broader output redesign should start with an issue.

## Candidate 4: Make config dry-run receipts identify proposed paths and checks

### Firsthand friction

Strict JSON dry runs reported only that one update was validated against the config file. The output did not name the path, describe the checks, or state the runtime consequence. Applied writes provided clearer path and restart guidance.

### Current-source trace

- `src/cli/config-cli.ts`
- `src/cli/config-cli.test.ts`
- `src/cli/config-cli.integration.test.ts`

Current `main` still prints only an update count and config path for successful human-readable dry runs. Structured JSON includes check categories but not proposed config paths or values.

### Proposed fix

Start with safe path names and completed validation categories. Do not print secret values. Reuse existing restart-impact logic only if it can be done without widening the config mutation contract.

### Effort

M/L

### Issue-first decision

Issue first if the proposal includes values, restart prediction, or a shared receipt format. A path-only clarity fix may remain a small direct PR.

## Parked candidates

### Effective inventory versus model-facing tools

`/tools verbose` listed OpenClaw capabilities, while the Codex harness replaced duplicate workspace tools with native Codex operations and deferred other tools through Tool Search. This needs direct sibling Codex source review before any code proposal. Effort L.

### Restrictive plugin allow-list preview

Setting `plugins.allow` to only `codex` reduced the active Gateway from ten loaded plugins to one. A preview of removed capabilities is a product change with plugin and configuration implications. Start with an issue. Effort L.
