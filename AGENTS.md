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

## Private job-hunt workspace

Before job-search research, application work, interview preparation, or career-positioning work, read `.jobhunt/README.md`.

Store private job-search material under `.jobhunt/`, never at the repository root or in public site directories. This includes job descriptions, recruiter or hiring-manager details, compensation, interview notes and transcripts, rejections, pipeline status, application drafts, career-GTM strategy, and recruiting-agent prompts.

Use `.jobhunt/CAREER_GTM_POSITIONING.md` as the working source of truth for target roles, positioning, discovery strategy, and cross-surface copy. Check for and extend an existing file before creating a new one. Public resume and portfolio files belong outside `.jobhunt/` only when Chris explicitly asks to update material intended for publication.

Never link `.jobhunt/` material from the public site or commit it. After creating or moving private material, verify the path is ignored and inspect `git status`. Remember that gitignored files are not backed up by git.
