# Claude Instructions

For deliberate builder practice, SuperDay simulations, or daily product-engineering training, read and follow `BUILDER_TRAINING.md`.

Use `BUILDER_TRAINING_LOG.md` as the append-only record of completed reps. The objective is sustainable, bounded delivery: one working proof, early feedback, relevant verification, clear comprehension, and a reviewable handoff within the promised timebox.

Do not expand a practice rep into a framework, platform, generalized engine, or workflow project unless the scoped outcome cannot be delivered without it. Surface and park attractive extra ideas.

Outside an explicitly agreed training rep, follow the repository's normal task instructions.

Before writing or changing any PlaySesh adoption claim, read `PLAYSESH_METRICS.md`. Treat it as the canonical interpretation of Discord authorization and install counts, and do not conflate them with active usage.

**Six surfaces carry facts, not five.** `index.html`, `resume.json`, `llms.txt`, `candidate.html`, the résumé PDF, and `portfolio-voice-backend/src/facts.js`. The last is the agent's catalog and the one that drifts unseen, because nothing on the site renders it — on 2026-08-13 it was live with a fabricated "3.2s patience window", a test-file count removed everywhere else, and four PlaySesh figures `PLAYSESH_METRICS.md` marks "Not supported." Change a number on one, change it on all six, then run `node test-facts.mjs` in the backend repo.

## Diagnosing the site

**Measure before proposing a layout, length, or density fix.** Every intuition was wrong on 2026-08-13: widening the column looked like it would shorten the page (saves 2%, pushes the lede to 124 characters per line), and the AI section looked like the density problem (it is 2% of the page; 17 work cards are 78%). Render in headless Chrome and measure section heights, characters per line, and page total before deciding.

**Verify by rendering the real page, not a harness.** An isolated test page showed mobile overflow that did not exist in `index.html` — the harness was broken, not the site. When a test disagrees with expectation, suspect the test first. Print CSS especially cannot be judged by reading: this page prints only `#va-dock` by design, which silently made two print rules dead code.

**Inventory before building.** The "speed run" was specced from scratch before discovering `/brief` in `portfolio-voice-backend` already compiles a fact-cited recruiter brief. A visual index was proposed before discovering seven finished case-study pages already hold 150 images in `images/craft/` that `index.html` references zero times.

**`DESIGN_SYSTEM.md` is derived, not the source.** It holds recovered tokens. `portfolio-archive/live/` holds the recovered *structure* — the 2014-2020 site that performed. Reading the token file is not reading the archive.

## Private job-hunt workspace

Before job-search, application, interview-prep, or career-positioning work, read `.jobhunt/README.md`.

Keep all private job-hunt research and drafts in `.jobhunt/`, including JDs, interview material, recruiter or hiring-manager details, compensation, pipeline status, application drafts, career-GTM strategy, and agent prompts. Do not create those files at the public repository root, link them from the site, or commit them.

Use `.jobhunt/CAREER_GTM_POSITIONING.md` as the working positioning source of truth. Extend existing material instead of creating duplicates. Only edit public resume, portfolio, and machine-readable surfaces outside `.jobhunt/` when Chris explicitly asks for a publishable update.

After creating or moving private material, verify it is ignored and check `git status`. Gitignored files are not backed up by git.

## Content about Chris

Never infer, assume, or fabricate facts about his experience: what the brief was, why
something was built, what he believed beforehand, what a decision produced. **Ask him.**
Labelling a guess as a guess is not sufficient, because the label protects the process
and the reader still sees the content. Verbatim from an artifact is preferred, and verify
the string against its source before calling it verbatim. If the raw material does not
exist, say the slot cannot be filled yet rather than bridging it with something
reasonable-sounding.
