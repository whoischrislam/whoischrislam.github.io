Whenever a fact, selector, style rule, or content item is about to exist in
more than one place in this repo (a generated/secondary surface, a second
view, or a second content slot), name the single canonical location first,
then close the duplication one of two ways:

- **Machine-checkable duplication** (a selector, a generated data file, a
  registry entry, a token list): add an automated existence/schema/
  reachability/freshness check that runs before deploy or commit — the
  `test-facts.mjs` precedent, extended to whatever new surface nothing
  renders and nobody will think to open.
- **Structural/visual duplication** (a component styled in two views, a fact
  repeated across content slots): fold it into one component or one slot, and
  run the site-wide render sweep across every place it appears before calling
  the change done.

Never let a hand-verification promise substitute for an automated check on a
surface nothing renders. Never let "I'll remember to update both" substitute
for one shared component.

**Scoping caveat (from validation, do not skip):** these checks assert
existence, schema, selector-reachability, or freshness — not string equality.
Do not mechanically dedupe every textual repetition; two things that happen to
say the same words are not automatically the same fact. Only fold in
duplication that is genuinely one piece of shared knowledge or behavior
represented twice.

## This rule merges and retires

- The `learning-2026-09-23-component-sync-across-views` raw entry (component
  styling duplicated across the world page and the story view) — its
  "shared component over parallel view styles" principle is folded into the
  structural-duplication branch above. Do not re-derive it as a separate rule.
- Ad hoc, per-surface parity checks invented one incident at a time. Before
  adding a new one-off check for the next drifted surface, check whether it is
  actually another instance of this same pattern first.

## Do

- `node test-facts.mjs` (portfolio-voice-backend) already gates `facts.js`
  against canonical sources before deploy. That is the reference shape.
- Before shipping a company page, check that the fact-band Outcome and any
  card's own result are not silently repeating the same number in two slots
  that could drift independently (2026-09-23, GoodRx/Iodine "2% -> 5%").
- When a builder creates a new component class, check it lands in the
  design-system registry (`assets/ds/design-system.js`) in the same change,
  not after it's noticed missing.

## Don't

- Don't ship a new generated/secondary surface (a JS data file, an analytics
  selector list, a registry) without deciding at creation time how its parity
  with the canonical source will be checked.
- Don't treat "nothing renders this so nothing will notice" as low risk — it's
  the opposite; `facts.js` shipped a fabricated number to a live recruiter
  agent for weeks specifically because nothing rendered it (2026-08-14).
- Don't write a blocking string-equality check as a shortcut — it will flag
  legitimate independent phrasing and get disabled or ignored.

## Known open gaps this rule points at (not yet closed, do not assume closed)

1. **analytics.js has no selector-parity check.** A staged draft exists at
   `scripts/check-analytics-selectors.py` (existence/reachability only, per
   the scoping caveat above) — NOT wired into `verify.sh`. On its first run
   against this repo (2026-09-24) it found `.arc-more`, `.video-facade`,
   `a[href*="cal.com/"]`, and `[onclick*="mailto:"]` genuinely absent from
   `index.html` (zero occurrences anywhere in the file — the same four
   selectors `violation-2026-08-19-analytics-selectors-stale-across-rewrites`
   already named as dead, still unfixed) and flagged `a[href*="y30.ai"]` /
   `iframe[src*="loom.com"]` as likely false positives, since this site
   renders those links from JS data arrays rather than static markup — confirm
   those two with a headless render before treating them as broken. Chris:
   review the draft, decide whether to fix the four real dead selectors and
   wire the script into `verify.sh`'s `checks` list.
2. **Content-slot duplication has no pre-ship check.** Treat "does this
   company page repeat a card's result in the fact-band Outcome" as a design
   checklist item before calling a company-page change done, the same way
   `decision-2026-09-23-one-job-per-slot` was caught by hand. No code check
   proposed here — this is a judgment call the scoping caveat says not to
   mechanize.
3. **The `?ds` design-system catalog (`assets/ds/design-system.js`) hand-
   maintains lists** (type samples, token lists, the component registry `REG`)
   that drifted on 2026-09-24. `scripts/check-design-system.py` already
   catches renamed/deleted registry selectors, but not a new component class a
   builder ships that never gets added to `REG`. Chris is separately approving
   a build plan to generate the catalog from live tokens/components; that plan
   is the canonical fix for this instance, not this rule. Reference it, don't
   duplicate it here.

<!-- promoted from pattern-2026-09-24-duplicated-surfaces-drift-without-automated-parity.yaml on 2026-09-24; validation verdict: recommended; sources: https://github.com/style-dictionary/style-dictionary, https://styledictionary.com/info/tokens/, https://storybook.js.org/addons/storybook-tokens, https://figr.design/blog/design-system-documentation-guide -->
