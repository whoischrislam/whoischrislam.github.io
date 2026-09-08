#!/usr/bin/env bash
#
# verify.sh — the single quality gate for this repo.
#
# One entrypoint that a human, a git hook, and CI can all call, so the
# list of checks lives in exactly one place. Runs the fast, deterministic
# checkers. Any failure aborts immediately (fail-fast) and exits non-zero,
# which is the signal a hook or CI reads to block a commit/push.
#
# Deliberately NOT here:
#   - check-links.py       hits the network, flaky -> belongs in a nightly job
#   - backend test-facts.mjs   lives in a different repo (portfolio-voice-backend)

set -euo pipefail

# Run from this script's own directory so it works no matter where it is
# called from (repo root, a hook, or CI). The checkers resolve the repo
# root themselves, so running them from scripts/ is the known-good state.
cd "$(dirname "$0")"

checks=(
  check-portfolio-v3.py
  check-public-facts.py
  check-canon.py
  check-agent-harness.py
  check-receipts.py
)

for check in "${checks[@]}"; do
  echo "→ $check"
  python3 "$check"
done

echo "✓ verify.sh passed — all checks PASSED"
