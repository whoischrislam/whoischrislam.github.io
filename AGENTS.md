# Agent Instructions

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
