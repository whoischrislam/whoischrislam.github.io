#!/usr/bin/env bash
# Monthly harness audit. Keeps the harness current: is the gate healthy, are any
# checkers unwired, any docs stale? Run manually or via the session-start ritual.
# NOTE: no `set -e` — we want every section to run and report, not abort on the first finding.
set -uo pipefail
cd "$(git rev-parse --show-toplevel)"

echo "== harness audit ($(date +%Y-%m-%d)) =="

# 1. Does the gate still pass end to end?
if bash scripts/verify.sh >/dev/null 2>&1; then
  echo "gate: PASS"
else
  echo "gate: FAIL  -> run ./scripts/verify.sh"
fi

# 2. Checkers that exist but verify.sh never runs (wire them, or confirm intentional).
echo "-- checkers not in verify.sh (confirm each is intentionally excluded) --"
verify_code=$(grep -v '^[[:space:]]*#' scripts/verify.sh)   # strip comments: a name in a comment is not "wired"
for f in scripts/check-*.py; do
  name=$(basename "$f")
  grep -q "$name" <<<"$verify_code" || echo "   $name"
done

# 3. Tracked docs untouched in >90 days (retirement / staleness candidates).
echo "-- docs untouched >90 days (review or retire) --"
cutoff=$(date -v-90d +%s 2>/dev/null || date -d '90 days ago' +%s)
git ls-files '*.md' | while read -r doc; do
  ts=$(git log -1 --format=%ct -- "$doc" 2>/dev/null)
  [ -n "$ts" ] && [ "$ts" -lt "$cutoff" ] && echo "   $doc"
done

date +%Y-%m-%d > .harness-audit-last
echo "== audit done (recorded .harness-audit-last) =="
