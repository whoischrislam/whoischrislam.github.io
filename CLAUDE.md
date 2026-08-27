@AGENTS.md

# Claude Code adapter

`AGENTS.md` is the canonical repository contract. Do not restate or fork its
rules here. Claude Code officially supports this import form, so changes to the
shared contract reach Claude and other agents from one maintained source.

Use the project skills in `.claude/skills/` when their descriptions match the
request. In particular, use `session-start` to resume portfolio work and
`session-end` to preserve confirmed evidence and the current handoff.
