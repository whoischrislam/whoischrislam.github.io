---
name: session-end
description: Preserve the durable state of portfolio and career-evidence work before stopping. Use when Chris asks to wrap up, stop for the day, document progress, or make the next session resume cleanly.
---

# Session End

Turn the session into a reliable next-session starting point.

1. Review what Chris directly confirmed, what artifacts established, what outside
   sources verified, and what remains unresolved. Do not upgrade the strength of
   any evidence while summarizing it.
2. Update the relevant private company brief with confirmed chronology,
   ownership, delivery state, outcomes, visibility boundaries, asset needs, and
   open questions. Update `.jobhunt/CANONICAL_WORK_HISTORY.md` only for settled
   career facts that should govern every surface.
3. Update `.jobhunt/ACTIVE_PORTFOLIO_HANDOFF.md` in place. Record the current
   public implementation, private evidence state, validation performed, next
   action, and deliberate deferrals. Do not create another dated handoff unless
   Chris requests a snapshot.
4. Run `python3 scripts/check-agent-harness.py`. If v3 portfolio data or assets
   changed, also run `python3 scripts/check-portfolio-v3.py`. Run other checks
   required by `AGENTS.md` for the surfaces changed.
5. Inspect `git diff` and `git status`. Verify private files remain ignored and
   no `.jobhunt/` content leaked into publication surfaces.
6. Report what is complete, what is uncommitted, what remains unresolved, and the
   precise next step. Remind Chris that ignored `.jobhunt/` files require their
   separate private backup.

Do not commit or push unless Chris asks. A clean handoff is required even when
the public implementation is intentionally unfinished.
