# Resume Compiler Plan

**Status:** Parked until HogWare is submitted
**Created:** July 16, 2026
**Next action:** Start with Phase 1 below; do not manually redesign another PDF first.

## Why this exists

Creating a tailored resume currently means manually rewriting and synchronizing several files. That is slow, tiring, and prone to drift. The goal is to turn resume creation into a small, reviewable build process:

```text
verified career facts
        +
target-role profile
        +
job description
        |
        v
selection + constrained wording
        |
        v
approved content model
        |
        +-> fixed Typst design system -> designed PDF
        +-> semantic HTML -> compatibility output
        `-> plain text + JSON + review report
```

The human job should be approving evidence and final wording, not copying edits between formats.

## Current-state audit

- `resume.json` is the closest thing to structured source data, but it mixes facts with presentation-ready prose.
- `candidate.html` contains overlapping facts and independently maintained wording.
- `index.html` repeats positioning, skills, and selected outcomes.
- `chris-lam-resume.pdf` was generated with ReportLab on June 5, 2026, but its generator is not present in this repository.
- The PDF already differs from the newer JSON and portfolio positioning.
- There is no repeatable command that rebuilds all resume formats from one source.

## Product requirements

The compiler must:

1. Generate a role-specific resume from verified facts.
2. Reorder evidence based on the target role and job description.
3. Mirror job-description language only when the underlying experience supports it.
4. Keep every generated claim traceable to an approved source fact.
5. Produce an ATS-readable, selectable-text PDF.
6. Produce HTML, plain text, and JSON from the same selected content.
7. Explain what it selected, omitted, matched, or could not substantiate.
8. Avoid requiring manual layout work for each application.
9. Preserve the visual character of the high-converting InDesign resume across role variants.
10. Change editorial selection by role without allowing the layout to redesign itself.

The compiler must not:

- Invent metrics, skills, scope, titles, dates, or outcomes.
- Treat the LLM as a source of truth.
- Silently alter an approved number or factual qualifier.
- Stuff unsupported keywords into bullets.
- Automatically submit applications.
- Overwrite the canonical public resume without an explicit promotion step.

## Proposed repository structure

```text
resume/
|-- data/
|   |-- identity.json
|   |-- career-facts.json
|   |-- education.json
|   `-- skills.json
|-- profiles/
|   |-- technical-founder.json
|   |-- ai-product-engineer.json
|   |-- ai-product-designer.json
|   `-- developer-tools-engineer.json
|-- jobs/
|   |-- posthog-technical-ex-founder/
|   |   |-- job-description.md
|   |   `-- analysis.json
|   `-- openclaw-product-designer/
|       |-- job-description.md
|       `-- analysis.json
|-- templates/
|   |-- designed-resume.typ
|   |-- compatibility-resume.html
|   |-- compatibility-resume.css
|   `-- design-tokens.json
|-- references/
|   |-- design-rubric.md
|   `-- baseline-content.json
|-- scripts/
|   |-- build.mjs
|   |-- analyze-job.mjs
|   |-- validate-facts.mjs
|   |-- validate-output.mjs
|   `-- promote.mjs
|-- tests/
|   |-- facts.test.mjs
|   |-- selection.test.mjs
|   `-- rendering.test.mjs
`-- dist/
    `-- <application-slug>/
        |-- resume.html
        |-- chris-lam-resume.pdf
        |-- resume.txt
        |-- resume.json
        `-- review.md
```

Generated files under `resume/dist/` should not become new sources of truth.

## Canonical fact model

`career-facts.json` should contain atomic, reusable accomplishments rather than one fixed resume narrative.

```json
{
  "id": "y30_safety_engine",
  "company": "y30",
  "role": "Co-Founder & CPTO",
  "action": "Designed and built",
  "object": "a deterministic safety state machine",
  "methods": [
    "implemented crisis paths in code",
    "prevented the language model from overriding safety states"
  ],
  "metrics": [],
  "impacts": [
    "removed model availability and improvisation from high-risk turns"
  ],
  "skills": [
    "voice AI",
    "state machines",
    "AI safety",
    "product architecture"
  ],
  "senioritySignals": [
    "architectural decision-making",
    "end-to-end ownership"
  ],
  "roleTags": [
    "technical-founder",
    "ai-product-engineer",
    "ai-product-designer"
  ],
  "approvedPhrasings": [],
  "evidence": [
    {
      "type": "private-codebase",
      "reference": "y30 safety engine"
    }
  ],
  "approved": true
}
```

### Fact rules

- One record should represent one defensible accomplishment.
- Metrics should be stored separately from prose.
- Approximate figures must retain their qualifier, such as `about`, `~`, or a range.
- Team outcomes must record whether Chris led, owned, contributed, or participated.
- Every fact needs an evidence note, even when the evidence is private.
- Unsupported or disputed claims remain `approved: false` and cannot be rendered.
- Role-specific wording belongs in `approvedPhrasings`; the underlying facts remain neutral.

## Role profiles

A profile is a stable positioning strategy for a cluster of similar jobs. It is not a new identity for every application.

Each profile should define:

- Headline and summary emphasis.
- Weighted skills and role tags.
- Preferred seniority signals.
- Preferred companies and accomplishments.
- Skill-section ordering.
- Maximum bullets per role.
- Terms to prefer or avoid.
- Content that should normally be omitted.

A profile may change editorial content and allocation, but it may not change the approved design tokens, component styles, or page geometry.

### Initial profiles

#### `technical-founder`

Emphasize high agency, 0-to-1 ownership, product judgment, architecture, shipping, experimentation, and measurable adoption.

#### `ai-product-engineer`

Emphasize production AI systems, user-facing ownership, APIs, UI implementation, testing, reliability, product partnership, and architecture.

#### `ai-product-designer`

Emphasize fourteen years of product design, human-agent interaction, research, prototyping, trust, safety, permissions, accessibility, and the ability to implement designs directly.

#### `developer-tools-engineer`

Emphasize PlaySesh, developer workflows, real-time collaboration, APIs, documentation, product-led growth, and contributor or customer enablement.

## Job-description overlay

Each application folder should preserve the exact job description and a reviewed analysis.

`analysis.json` should include:

- Role title and company.
- Required qualifications.
- Preferred qualifications.
- Repeated exact phrases.
- Product domain.
- Seniority expectations.
- Recruiter-visible keywords.
- Hiring-manager signals.
- Unsupported requirements or genuine gaps.

Job language may influence selection and wording, but it may not create evidence.

## Recruiter-screen contract

The compiler must optimize for the first human gate, not only for a technically sophisticated hiring manager. This contract is based on the July 16, 2026 Formation workshop, “How Senior Engineers Land Interviews,” led from a technical recruiter's perspective. Source notes and transcript: `https://notes.granola.ai/t/7ae235b6-98e3-4c1f-99c7-b7d21bf66caa`.

Assume the initial review lasts six to eight seconds and is performed by someone scanning a checklist derived from the job description.

### Exact-language matching

- Extract repeated responsibilities, qualifications, skill phrases, and role-cluster terms from the job description.
- Mirror an exact phrase such as `reusable UI components` when an approved fact genuinely supports it.
- Record the fact IDs supporting every mirrored phrase.
- Never add a keyword merely to satisfy a checklist.
- Distinguish recruiter-visible language from deeper hiring-manager evidence; the resume needs both.

### Bullet contract

Use the workshop's XYZ structure in recruiter-readable language:

- **X — action and ownership:** what Chris drove, decided, designed, or built.
- **Y — measurement:** how success, scale, quality, speed, adoption, reliability, or learning was measured.
- **Z — impact:** what changed for users, customers, the company, or the system.

A strong bullet must also expose the relevant method or skill from the job description. Business impact alone is insufficient, and unexplained technical jargon is not recruiter-readable.

The first two bullets of the most recent relevant role have the strictest standard. Prefer facts containing all three XYZ elements and an explicit JD-relevant skill. If no approved fact contains a metric, report the evidence gap rather than inventing one.

### Seniority contract

Signal seniority through evidence of:

- Direction-setting or problem framing.
- Architectural, interaction, or product decision ownership.
- Stakeholder or cross-functional alignment.
- End-to-end accountability for the outcome.

Avoid passive phrases such as `worked with`, `helped`, `assisted`, or `contributed to` unless they are necessary to preserve honest attribution. Titles alone do not establish seniority.

### Role-cluster contract

The summary, skills, and opening bullets must identify the intended role cluster immediately.

- Product-engineering variants should signal user-facing ownership, UI craft, API design, testing or reliability, and product/design partnership when supported.
- Infrastructure variants should signal architecture, cross-team influence, system-level design, reliability, performance, or scale when supported.
- Design-engineering variants should signal interaction and visual craft, production frontend implementation, reusable systems, and design-engineering collaboration when supported.
- Product-design variants should signal product direction, interaction design, research, systems thinking, and shipped outcomes when supported.

A summary that could move unchanged between these clusters is not sufficiently targeted. The first bullet must reinforce the same cluster rather than reframing Chris as a different candidate.

### Six-second preview

Every build should generate a compact preview containing only:

1. Headline and summary.
2. Most recent relevant role heading.
3. Its first two bullets.
4. Recruiter-visible skill matches.

Review this preview before the full resume. If the target role and strongest evidence are not obvious from the preview, the build is not ready.

## Selection and wording strategy

### Selection should be deterministic

Score approved facts using a visible formula, initially:

- 40% role and responsibility relevance.
- 25% strength of evidence or measurable outcome.
- 20% seniority and ownership signal.
- 10% recency.
- 5% distinctiveness relative to other selected bullets.

The exact weights can change, but the result must be inspectable in `review.md`.

### Wording should be constrained

Version 1 should prefer approved human-written phrasings and deterministic templates. This is safer and faster than requiring an API integration immediately.

An optional later LLM step may propose variants under these constraints:

- Use only fields from one fact record.
- Preserve all qualifiers and attribution.
- Prefer plain language before technical detail.
- Include action, method or technical signal, and result when evidence exists.
- Signal seniority through decisions and ownership, not inflated adjectives.
- Return structured JSON with cited fact IDs.
- Require human approval before a phrasing becomes reusable.

The LLM can transform facts; it cannot approve facts.

## Design system

The primary visual reference is:

`/Users/whoischrislam/Dropbox/Design/Career/Resume/old_chris_lam_resume.pdf`

This InDesign resume had the strongest historical application conversion. Treat that result as a meaningful design signal while acknowledging that role, market, seniority, and content have changed since it was used.

Preserve its visual DNA:

- Editorial serif and sans-serif contrast.
- Confident name and section-heading treatment.
- Restrained grayscale palette.
- Deliberate whitespace and alignment.
- Strong visual rhythm with minimal ornamentation.
- An unmistakably designed, rather than generic-template, presentation.

Improve the parts that do not translate safely to the new system:

- Increase body readability where the original type is small or light.
- Make bullets easier to scan.
- Add a targeted summary without crowding the page.
- Keep the reading and extraction order predictable.
- Prevent the supporting skills area from consuming space without adding role relevance.
- Permit an intentional second page instead of shrinking typography or spacing.

The following are negative references, not templates to reproduce:

- `/Users/whoischrislam/Dropbox/Design/Career/Resume/ats-chris-lam-resume.pdf`
- `/Users/whoischrislam/Dropbox/Design/Career/Resume/chris_lam_healthcare_resume.pdf`

They demonstrate failure modes the generator must prevent: dense run-on bullets, accidental typography, corrupted dates, generic-template appearance, arbitrary accent color, split bullets, orphaned content, poor page balance, passive seniority signals, and manually duplicated claims.

### Frozen design tokens

Reverse-engineer the InDesign reference into explicit, versioned tokens:

- Letter page size and margins.
- Column widths and gaps.
- Font families, weights, and fallback policy.
- Type sizes and line heights.
- Heading, role, paragraph, and bullet spacing.
- Bullet indentation and maximum line length.
- Grayscale color values and minimum contrast.
- Component keep-together and page-break behavior.

Use Georgia for the display treatment and Myriad Pro for body text only if the fonts can be used and reproduced legally. Otherwise choose one approved fallback, such as Source Sans 3, record the decision, and fail on unexpected font substitution.

The generator must never pick fonts, colors, spacing, or layout variants from the job description.

### Content slots and budgets

Each visual region receives a preferred and hard budget. Initial budgets should cover:

- Name and headline line counts.
- Summary line count.
- Skill categories and items.
- Bullets per role.
- Preferred and maximum bullet length.
- Older-experience compression.
- Maximum page count by profile.

If selected content exceeds its budget, the compiler should remove lower-scoring evidence or move intentionally to a second page. It must not silently shrink type, tighten spacing, or distort the layout.

### What changes by application

Role profiles and job descriptions may change:

- Headline and summary.
- Skill selection and ordering.
- Accomplishment selection and bullet order.
- Bullet allocation by role.
- Supported terminology.
- How much older experience is expanded or compressed.

They may not change:

- Typography.
- Spacing and alignment.
- Contact treatment.
- Page geometry.
- Visual hierarchy.
- Component styles.

This is the central implementation rule: freeze the visual system that worked; generate only the editorial decisions inside it.

## Rendering approach

Use Typst for the primary designed PDF. Its template should consume the selected content model directly and provide precise, reproducible typography and pagination. Use semantic HTML and print CSS for the synchronized compatibility rendering and browser-based screenshots.

Do not use InDesign as the production generator. Use its successful PDF as the visual reference and acceptance target; keep the repeatable build in the repository.

Both renderers must consume the same approved content model. They must never be edited as independent resumes.

Version 1 should make the designed Typst PDF the default output because it preserves the strongest historical conversion signal. The maximum-compatibility theme is insurance for uncertain parsing environments, not the new visual standard. It can be enabled after the primary template and shared content model are trustworthy.

Rendering requirements:

- Selectable text; no resume-as-image output.
- Standard headings and chronological experience.
- No important information encoded only through color or icons.
- One or two pages depending on the profile.
- Stable margins and typography.
- Controlled page breaks; no orphaned headings.
- Links remain readable in text extraction.
- Plain-text output preserves a logical reading order.
- Typography never shrinks automatically to make content fit.
- A bullet and its role heading stay together across page boundaries.
- The designed theme uses only approved fonts and design tokens.

Proposed command:

```bash
npm run resume:build -- \
  --profile ai-product-designer \
  --job openclaw-product-designer
```

The default build writes only to `resume/dist/<application-slug>/`.

An explicit promotion command copies an approved build to the public canonical files:

```bash
npm run resume:promote -- --job openclaw-product-designer
```

## Review report

Every build should create `review.md` containing:

- Six-second preview: summary, most recent role, first two bullets, and recruiter-visible skills.
- Selected summary and headline.
- Selected facts and their scores.
- Omitted high-scoring facts and why they lost.
- Job requirements matched by evidence.
- Requirements with no supporting evidence.
- Exact job-description terms used, with supporting fact IDs.
- XYZ decomposition for every selected bullet.
- Seniority signals found in each lead bullet.
- Role-cluster consistency across the summary, skills, and opening bullets.
- Claims and metrics requiring manual verification.
- Duplicate or repetitive concepts.
- Extracted PDF text.
- Page count and layout warnings.

This report is the trust surface for the generator.

## Automated quality gates

The build should fail when:

- A rendered claim lacks an approved fact ID.
- A metric differs from its canonical value or loses its qualifier.
- An unapproved fact is selected.
- The generated PDF has no extractable text.
- The PDF exceeds the configured page limit.
- Required identity or contact fields are missing.
- A role or date conflicts with canonical history.
- A generated file is edited manually and no longer matches the build.
- A bullet or heading is orphaned across pages.
- A required font is missing or an unexpected font is substituted.
- Type size or spacing falls below the approved design tokens.
- The same accomplishment appears more than once.
- A baseline fixture no longer renders with the approved template geometry.
- An exact job-description phrase appears without a supporting approved fact ID.
- The summary targets a different role cluster from the selected profile.
- The first bullet of the most recent relevant role contradicts or weakens the target role cluster.
- Either of the first two bullets lacks action or ownership, JD-relevant skill evidence, or impact.
- A measurable lead-bullet fact is rendered without its canonical metric or qualifier.

The build should warn when:

- A later bullet weakly matches the target role.
- A later bullet lacks one or more XYZ elements.
- A bullet uses passive participation language without an intentional attribution.
- A bullet contains impact but no ownership or technical signal.
- A bullet is mostly jargon and lacks plain-language impact.
- Multiple bullets repeat the same accomplishment or skill signal.
- The summary could plausibly target a different role cluster unchanged.
- Keyword coverage is low despite relevant verified evidence.
- A heading or role block breaks awkwardly across pages.
- A page is substantially overcrowded or mostly empty.
- A content slot exceeds its preferred budget.
- The designed and compatibility outputs do not contain the same approved claims.

## Phased implementation

### Phase 1: Establish one source of truth

- [ ] Create the `resume/` directory structure.
- [ ] Split identity, education, skills, and accomplishments into canonical data files.
- [ ] Migrate every current `resume.json` claim into atomic fact records.
- [ ] Reconcile wording differences across the PDF, `candidate.html`, and `index.html`.
- [ ] Mark uncertain claims as unapproved rather than resolving them by assumption.
- [ ] Add schema validation and provenance checks.

**Exit:** every current resume claim is represented once and has approval status.

### Phase 2: Build deterministic profiles and selection

- [ ] Implement the four initial role profiles.
- [ ] Add PostHog Technical Ex-Founder and OpenClaw Product Designer job folders.
- [ ] Implement transparent scoring, selection, ordering, and bullet limits.
- [ ] Generate the role-specific content model as JSON.
- [ ] Generate the six-second recruiter preview and checklist trace.
- [ ] Produce the first `review.md` before building a PDF.

**Exit:** the same facts produce visibly different, defensible PostHog and OpenClaw drafts.

### Phase 3: Render reproducible outputs

- [ ] Record the design rubric and reverse-engineer the InDesign reference into tokens.
- [ ] Recreate the approved reference content in Typst as a template acceptance fixture.
- [ ] Compare the fixture against page screenshots from the InDesign PDF and approve intentional differences.
- [ ] Build the designed Typst template against the selected content model.
- [ ] Build the semantic compatibility HTML template and print CSS from the same model.
- [ ] Generate plain text and JSON Resume from the selected content.
- [ ] Add page-count and `pdftotext` checks.
- [ ] Add tagged-PDF, font, orphan, overflow, density, and page-balance checks.
- [ ] Add visual screenshots and baseline-fixture comparisons for layout QA.

**Exit:** one command produces all formats with stable, readable layout, and the designed PDF is recognizably the mature successor to the high-converting InDesign resume.

### Phase 4: Add application workflow

- [ ] Add explicit approval and promotion steps.
- [ ] Prevent generated outputs from becoming source data.
- [ ] Add a concise `README` with the six-step human workflow.
- [ ] Add diff output showing what changed from the previous application.
- [ ] Decide how approved resume facts propagate to `candidate.html` and portfolio claims.
- [ ] Add an optional maximum-compatibility PDF theme without creating a second content source.
- [ ] Store a build version hash with each application for outcome tracking.

**Exit:** creating a new application requires a job description, profile choice, and review, not manual reformatting.

### Phase 5: Optional constrained AI assistance

- [ ] Generate alternative bullets from one fact record at a time.
- [ ] Require fact-ID citations in model output.
- [ ] Show word-level differences from approved phrasing.
- [ ] Save accepted variants back into `approvedPhrasings`.
- [ ] Never auto-approve generated wording.

**Exit:** AI reduces writing effort without becoming an untraceable source of claims.

## First restart session

When returning after HogWare, do only this:

1. Re-read this document.
2. Run `git status` and preserve unrelated portfolio changes.
3. Create `resume/data/career-facts.json` and a schema.
4. Migrate only y30 and PlaySesh first.
5. Create the `technical-founder` and `ai-product-designer` profiles.
6. Produce a JSON-only comparison for PostHog versus OpenClaw.
7. Stop and review whether the selected evidence actually feels role-specific.

Do not start with PDF styling. Prove the data and selection model first.

## Success criteria

This project is successful when:

- A new tailored resume can be generated and reviewed in under 15 minutes.
- No factual claim needs to be manually copied between formats.
- Every bullet can be traced to approved evidence.
- PostHog and OpenClaw resumes clearly frame the same career differently.
- PDF text extraction matches the intended reading order.
- The user edits facts and approvals, not generated documents.
- Visual quality remains consistent when the target role and bullet selection change.
- The primary PDF retains the InDesign reference's editorial character without inheriting its readability or extraction weaknesses.
- Generated application outcomes can be associated with the exact profile, content selection, template version, and build hash.

## Open questions

- Should canonical career data use JSON Schema only, or TypeScript types plus runtime validation?
- Should approved role-specific summaries live in profiles or as fact-backed composition blocks?
- Which portfolio claims should be generated from the same data, and which should stay editorial?
- Should JD analysis be deterministic in Version 1 or prepared with an AI assistant and then reviewed?
- Should the public canonical PDF be a general profile, or should the site choose among role variants through campaign links?
- Which private evidence references are sufficient for confidence without exposing proprietary material?

## Ground rule

Build the smallest trustworthy compiler first. Do not turn resume automation into another open-ended platform project.
