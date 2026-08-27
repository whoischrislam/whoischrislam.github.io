# Cross-agent repository harness

This repository uses one durable instruction contract plus on-demand workflows
and executable checks. The goal is continuity across models and sessions, not a
large prompt that tries to remember everything.

## The portable pattern

1. `AGENTS.md` is the canonical contract. It contains only rules that should
   influence nearly every relevant agent session.
2. `CLAUDE.md` imports `@AGENTS.md`. Claude Code does not read `AGENTS.md`
   directly, and Anthropic documents this import as the compatibility pattern.
3. `.claude/skills/` holds repeatable, task-specific procedures. Their
   descriptions are discoverable; their full instructions load only when used.
4. Private domain knowledge lives outside the always-loaded prompt. For this
   repository, `.jobhunt/` contains the canonical career record, company evidence
   briefs, and the active portfolio handoff.
5. Scripts make important invariants executable. Instructions guide behavior;
   checks catch path drift, private-data leakage, broken content relationships,
   and missing assets.

Official references:

- [OpenAI: custom instructions with AGENTS.md](https://learn.chatgpt.com/docs/agent-configuration/agents-md)
- [Anthropic: how Claude remembers a project](https://code.claude.com/docs/en/memory)
- [The cross-agent AGENTS.md format](https://agents.md/)

## Why this survives model changes

The model is not the memory. Repository files are the memory. A new session can
reconstruct the current state by reading the active handoff, then loading only
the relevant canonical evidence and company brief. Corrections compound because
they are written into maintained sources instead of remaining trapped in chat.

The source hierarchy is:

```text
AGENTS.md                         operating rules
.jobhunt/ACTIVE_PORTFOLIO_HANDOFF.md  current state and next action
.jobhunt/CANONICAL_WORK_HISTORY.md    settled career facts
.jobhunt/*_STORY_BRIEF.md             company-level evidence and questions
public portfolio data and pages       publishable interpretation
scripts/check-*.py                     executable invariants
```

## Reusing this in another repository

Start small:

1. Create a concise `AGENTS.md` with project boundaries, source-of-truth paths,
   build commands, and required verification.
2. If Claude Code is used, create `CLAUDE.md` containing `@AGENTS.md` and only
   necessary Claude-specific additions.
3. Add a single active handoff instead of relying on a pile of dated notes.
4. Put specialized recurring workflows into skills rather than bloating the
   always-loaded instructions.
5. Add deterministic checks for the failures that would be expensive or easy to
   miss. Do not use prose as the only protection for a hard invariant.
6. Test the harness with a fresh session: ask the agent to state its instruction
   sources, current state, boundaries, and required checks before it works.

Treat the harness like code. When an agent makes a repeatable mistake, determine
whether the correction belongs in the canonical contract, a task-specific skill,
a domain source, or an executable check. Avoid adding the same correction to all
four layers.
