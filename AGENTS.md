# Agent Instructions

## One instruction source for every agent

`AGENTS.md` is the canonical repository contract for Codex, Claude Code, and any
other coding agent. Do not maintain a second copy of these rules in a
tool-specific file. `CLAUDE.md` must remain a thin adapter that imports
`@AGENTS.md`; tool-specific adapters may add only genuinely tool-specific notes.

When an agent does not discover `AGENTS.md` automatically, give it this file as
project context before it works. Task-specific procedures belong in
`.claude/skills/` so they are loaded on demand instead of making this file noisy.

Run `python3 scripts/check-agent-harness.py` after changing agent instructions,
session skills, private evidence workflow files, or their paths.

## Builder training

When Chris asks to practice, run a drill, simulate a SuperDay, improve delivery speed, or level up as a product engineer:

1. Read `BUILDER_TRAINING.md` before acting.
2. Start by helping Chris write the scope card.
3. Keep one central work item and enforce the promised timebox.
4. Prefer a user-visible vertical slice over supporting platform work.
5. Publish a checkpoint at the time specified by the selected training mode.
6. Surface scope expansion immediately and park it unless it is required for the promised outcome.
7. Require relevant verification and a plain-language teach-back of the critical implementation path.
8. Stop at the deadline and append the result to `BUILDER_TRAINING_LOG.md`.

Do not judge training speed by commits, lines of code, or agent activity. Judge it by time to working proof, feedback, verification, comprehension, and reviewable handoff.

Normal project work does not automatically become a training exercise. Use this protocol when Chris explicitly frames the work as practice or agrees to enter training mode.

## Canonical career evidence

Never infer, assume, or fabricate facts about Chris's experience: the brief,
ownership, chronology, rationale, delivery state, outcome, or what he believed.
Calling a guess an inference is not sufficient for public copy. Inspect the
available artifacts and records first; if the answer remains unknown, leave the
slot unresolved and ask Chris a focused question.

An artifact proves that work existed. It does not by itself prove Chris owned
it, that it shipped, or that it caused an outcome. Chris's direct account can
confirm remembered ownership and delivery state. Numerical claims require a
surviving written source or separately recoverable evidence and must retain the
source's qualification (for example, projected versus measured).

Before writing or changing any PlaySesh adoption claim in the resume, portfolio, or application materials, read `PLAYSESH_METRICS.md`. Keep Discord authorizations, server installs, individual-user installs, and PostHog engagement metrics separately labeled. Do not describe OAuth authorizations as active users or installs.

**Six surfaces carry facts, not five.** `index.html`, `resume.json`, `llms.txt`, `candidate.html`, the résumé PDF, and `portfolio-voice-backend/src/facts.js` — the last one is the agent's catalog and it is the one that drifts unseen, because nothing on the site renders it. On 2026-08-13 it was found live with a fabricated "3.2s patience window", a test-file count removed everywhere else, and four PlaySesh figures that `PLAYSESH_METRICS.md` marks "Not supported." Change a number on one surface, change it on all six, and run `node test-facts.mjs` in the backend repo.

## Diagnosing the site

**Measure before proposing a layout, length, or density fix.** Every intuition about this page was wrong on 2026-08-13: widening the column looked like it would shorten the page (it saves 2% and pushes the lede to 124 characters per line), the AI section looked like the density problem (it is 2% of the page; 17 work cards are 78%). Render the page in headless Chrome, measure section heights, characters per line, and page total, then decide.

**Verify by rendering the real page, not a harness.** An isolated test page showed mobile overflow that did not exist in `index.html`; the harness was broken, not the site. When a test disagrees with expectation, suspect the test first. Print CSS in particular cannot be trusted by reading — this page prints only `#va-dock` by design, which silently made two print rules dead code.

## Before building, inventory

Check what already exists before designing anything new. On 2026-08-13 the "speed run" concept was specced from scratch before discovering `/brief` in `portfolio-voice-backend` already compiles a fact-cited recruiter brief; and a visual index was proposed before discovering seven finished case-study pages already carry 150 images in `images/craft/` that `index.html` references zero times.

**`DESIGN_SYSTEM.md` is derived, not the source.** It holds recovered tokens. `portfolio-archive/live/` holds the recovered *structure* — the 2014-2020 site that performed: short index, hero image plus one sentence per project, case studies on their own pages. Reading the token file is not reading the archive.

## Private job-hunt workspace

Before job-search research, application work, interview preparation, or career-positioning work, read `.jobhunt/README.md`.

Store private job-search material under `.jobhunt/`, never at the repository root or in public site directories. This includes job descriptions, recruiter or hiring-manager details, compensation, interview notes and transcripts, rejections, pipeline status, application drafts, career-GTM strategy, and recruiting-agent prompts.

Use `.jobhunt/CAREER_GTM_POSITIONING.md` as the working source of truth for target roles, positioning, discovery strategy, and cross-surface copy. Check for and extend an existing file before creating a new one. Public resume and portfolio files belong outside `.jobhunt/` only when Chris explicitly asks to update material intended for publication.

Never link `.jobhunt/` material from the public site or commit it. After creating or moving private material, verify the path is ignored and inspect `git status`. Remember that gitignored files are not backed up by git.

## Portfolio evidence workflow

When work touches the portfolio, resume, career positioning, case studies, or
interview-derived career evidence:

1. Read `.jobhunt/README.md` and `.jobhunt/ACTIVE_PORTFOLIO_HANDOFF.md`.
2. Read the relevant role section in `.jobhunt/CANONICAL_WORK_HISTORY.md` and
   the relevant company evidence brief. Do not reread or remine unrelated roles.
3. Inspect the named artifacts, archive, or Dropbox material before asking Chris
   to reconstruct something that is already documented.
4. Classify new information before drafting: confirmed by Chris, supported by an
   artifact, externally verified, historically documented, or unresolved.
5. Keep visibility separate from truth: public, public but generalized,
   interview-only, confidential, or private.
6. Separate three claims that frequently drift together: what Chris owned, what
   reached users, and what outcome was observed.
7. Capture interview answers in the private company brief first. Reflect back
   any material interpretation or ambiguity before converting it into public
   copy. Ask one focused question at a time when practical.
8. Use delivery labels honestly: shipped and measured, shipped, working alpha,
   completed but not launched, internal demo, exploration, supporting
   contribution, or unknown. Never promote one state into another.
9. Before ending meaningful portfolio work, update the active handoff and any
   source-of-truth file changed by the session. Preserve unresolved questions;
   do not bridge them with plausible prose.

The reusable company-brief shape lives in
`.jobhunt/COMPANY_STORY_BRIEF_TEMPLATE.md`. Session-start and session-end
procedures live in `.claude/skills/session-start/SKILL.md` and
`.claude/skills/session-end/SKILL.md` and are shared by the supported agents.

For the v3 portfolio, run `python3 scripts/check-portfolio-v3.py` after changing
company records, stories, visual placeholders, slugs, or referenced assets.
