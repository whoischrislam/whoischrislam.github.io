---
name: session-start
description: Resume portfolio, career-evidence, or job-hunt work from the repository's durable sources. Use when Chris asks to continue, catch up, begin a portfolio session, or recover the current state after time away.
---

# Session Start

Reconstruct the working state from maintained evidence rather than conversation
memory.

1. Read `AGENTS.md`, then `.jobhunt/README.md` and
   `.jobhunt/ACTIVE_PORTFOLIO_HANDOFF.md` completely.
2. Inspect `git status` before making changes. Treat unrelated edits as Chris's
   work and preserve them.
3. Run `python3 scripts/check-agent-harness.py`. Report warnings that affect the
   current task; do not expand the session to unrelated cleanup.
4. From the active handoff, identify the current company or workstream. Read only
   its section in `.jobhunt/CANONICAL_WORK_HISTORY.md`, its company brief, and the
   referenced artifacts or source files.
5. Give Chris a compact catch-up: what is settled, what changed last, what remains
   unresolved, and the next concrete action. Distinguish public implementation
   state from private evidence state.
6. Continue the requested work. If a fact is absent or conflicting, inspect the
   named evidence first and then ask one focused question. Never fill the gap with
   a likely story.

Starting a session is read-only unless Chris also asks to change or continue the
work. Do not commit, push, publish, or contact anyone merely because this skill
was invoked.
