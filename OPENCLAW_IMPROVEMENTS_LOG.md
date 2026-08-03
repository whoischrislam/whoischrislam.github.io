# OpenClaw Improvements Log

This log tracks firsthand friction through contribution and review status.

| Friction observed | Contribution made | Status | Evidence |
| --- | --- | --- | --- |
| Deep security audit recommends running the deep audit again | Conditioned the hint on shallow mode and added shallow/deep coverage | Local patch, verified; repository autoreview blocked by missing TruffleHog | Installed release output, current source, 9 focused tests, formatting, lint, `git diff --check` |
| Local TUI refuses `/tools` without explaining the required transport or recovery | Mapped the current handler and test surfaces | Verified candidate | Local TUI transcript and current source |
| `sandbox explain` mixes direct runtime state with inactive sandbox policy | Mapped the renderer, JSON payload, and tests | Verified candidate | Installed release output, current source, official docs |
| Config dry run omits proposed paths and runtime consequences | Mapped current dry-run result and human receipt | Verified candidate | Installed release output and current source |
| Tool inventory differs from the Codex model-facing tool surface | Verified Codex native-operation replacement and Tool Search behavior | Parked pending direct Codex source review | TUI trace and current OpenClaw Codex harness docs |
| First multiline task mutated before later constraints arrived | Retried as one submitted request with one named native tool and independent verification | Learning proof complete | Verbose TUI trace, `sed`, and `wc` |
| Missing `session.reset` config obscured the installed release's implicit daily reset | Traced the rollover through session IDs, archived transcript timestamp, installed source, and current source | Documented; default behavior already changed on current `main` | Installed CLI output, release source, current change `#111140` |

## Session checkpoint: July 23, 2026

- The controlled workspace task is complete and independently verified.
- Six contribution candidates are ranked in `OPENCLAW_CONTRIBUTION_PLAN.md`.
- Candidate 1 is implemented on local branch `fix/security-audit-deep-hint`.
- Candidate 1 passes 9 focused tests, formatting, focused lint, and `git diff --check`.
- No fork, commit, push, issue, or pull request has been created.
- Resume by reviewing the candidate 1 diff and deciding whether to publish a draft pull request.

## Session update: July 24, 2026

- Installed dependencies with a frozen lockfile under Node 24.18.0 and the repository-declared pnpm 11.15.1.
- The package manager verified 1,456 lockfile entries against its supply-chain policies.
- Ran `src/cli/security-cli.test.ts` through the repository test wrapper: 1 file passed, 9 tests passed.
- Both changed files passed the repository formatting and type-aware lint wrappers.
- `git diff --check` passed.
- The source diff still contains only the intended CLI condition and its focused behavior test.

## Session update: July 25, 2026

- Re-read the current root contribution rules, `CONTRIBUTING.md`, PR template, issue form, and `CODEOWNERS`.
- Confirmed that this small behavior bug may go directly to a PR.
- Confirmed that the changed CLI files are not restricted security-owned paths.
- Rechecked current GitHub `main`. The human-readable deep audit still prints the redundant hint.
- Re-ran the focused CLI suite: 1 file passed, 9 tests passed.
- Re-ran targeted formatting, focused lint, and `git diff --check`. All passed.
- Attempted the repository autoreview harness. It stopped because TruffleHog is not installed and the harness does not auto-install it.
- No fork, commit, push, issue, or pull request has been created.
