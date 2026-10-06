#!/usr/bin/env bash
# jobhunt-brief.sh — SessionStart hook: a 3-line brief from .jobhunt/ so every
# session starts with the current state, even when session-start isn't invoked.
#
# Contract (mirrors ~/.claude/hooks/rep-streak.sh):
#   - Exit 0 SILENTLY on any anomaly (no .jobhunt checkout, e.g. a worktree).
#   - Read-only. No LLM, no network.
#   - Stdout becomes session context; the full read is still the session-start skill.

ROOT="${CLAUDE_PROJECT_DIR:-$(cd "$(dirname "$0")/../.." && pwd)}"
J="$ROOT/.jobhunt"
H="$J/ACTIVE_PORTFOLIO_HANDOFF.md"
[ -r "$H" ] || exit 0

# Newest handoff entry is the first "## " heading; its open items start with "**Open".
latest=$(grep -m1 '^## ' "$H" 2>/dev/null | sed 's/^## //')
open=$(awk '/^## /{n++} n==1 && /^\*\*Open/{print; exit}' "$H" 2>/dev/null)

dirty=$(git -C "$J" status --porcelain 2>/dev/null) && dirty=$(printf '%s' "$dirty" | grep -c .) || dirty='?'

misses=0
M="$J/decision-log/MISSES.md"
[ -r "$M" ] && misses=$(awk -F'|' '/^\| [0-9]{4}-/{n++} END{print n+0}' "$M")

echo "<jobhunt-brief> Read .jobhunt/INDEX.md + ACTIVE_PORTFOLIO_HANDOFF.md before career/portfolio work."
[ -n "$latest" ] && echo "Last handoff: $latest"
[ -n "$open" ] && echo "$open"
echo ".jobhunt: ${dirty:-?} uncommitted change(s) (not backed up until committed + pushed) · miss log: $misses line(s), review 2026-10-13"
exit 0
