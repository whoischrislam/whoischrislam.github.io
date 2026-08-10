# Design system — recovered, not invented

Every value here came from Chris's own CSS, 2010–2024, across `portfolio-archive`,
`gamedev-portfolio`, `portfolio`, and `Dropbox/Design/Career/Portfolio/OLD/2013-2016`
(portfolio_v1–v6). Two forensic passes: one for type and colour, one for layout and
spacing. **Do not re-derive these. Do not replace them with framework defaults.**

The brief that started it: the page looked "bland and AI generated." The cause was not
inconsistency — it was the *absence* of his own decisions.

---

## Tokens

```css
/* Type. Seven steps. Was 21 sizes at half-pixel granularity (13.5, 14.5, 16.5, 18.5),
   which is the granularity of a generator, not a decision. */
--t-xxl:38px  --t-xl:30px  --t-lg:24px  --t-md:21px  --t-base:18px  --t-sm:16px  --t-xs:14px

/* Spacing. 4px base, doubling. Same shape as his 2024 set, which was
   0.2 / 0.4 / 0.8 / 1 / 1.6 / 2 / 4 in em. */
--sp-1:4  --sp-2:8  --sp-3:16  --sp-4:24  --sp-6:32  --sp-8:44  --sp-12:88
```

**Fonts.** Open Sans is his in 2024 *and* 2026 — do not swap it. Instrument Serif is the
replaceable half. Single column: 840px. He has shipped asymmetric layouts twice (2010
700/200, 2014 280/620), so asymmetric is *available*, just not his default.

## The vertical hierarchy

Ordered, and the order is the point. **The card gap must exceed the largest gap inside a
card**, or a reader sees bigger breaks within one project than between two.

| gap | value | mobile |
|---|---|---|
| paragraph inside a beat | 15px | — |
| a new beat inside a card | 28px | — |
| card to card | 44px | 28px |
| section boundary | 88px | 44px |

Recurring ratio across every era he hand-authored: section boundary is **2.5–4×** the
paragraph gap (2011: 2.5–3.5em vs 1em; 2014: 80px vs 20px; 2024: 4em vs 1em).

**The rule goes above a section heading, never below.** His Squarespace case studies were
`hr → h2 → content` for four years, eight rules deep in the Iodine page alone.

## Colour

**Green, not coral.** Green recurs across four eras (`#00C131` 2010, `#7dd758` 2014,
`#26AF55` and `#66FF02` 2024 — chosen twice independently). Coral had no precedent in
sixteen years.

`--accent:#26AF55` dark / `#177537` light.

**Per-project accents.** Each hue has a citable source. Each is a *pair*, because his 2014
palette was built for a light-only page — only lightness moves between themes, hue and
saturation are untouched. All clear 4.5:1.

| project | dark | light | source |
|---|---|---|---|
| y30 | `#2E7DDD` | `#1A56A0` | his own token in y30-voice, commented "y30 blue" |
| PlaySesh | `#E29452` | `#AA5D1C` | `playsesh/client/src/App.css` |
| Pathstream | `#FF4F51` | `#E30003` | `PATHSTREAM_BRAND_GUIDELINES.pdf`, labelled HEX |
| TaskRabbit | `#2E964B` | `#278140` | his own 2014 per-project assignment |
| Amazon | `#DF9900` | `#956600` | his own 2014 per-project assignment |

Applied via `data-accent` on the `<article>`; `--proj-accent` inherits to descendants and
falls back to green outside cards. `--proj-soft` derives a tint with `color-mix`.

**Everything accent-coloured inside a card must follow that card.** Two hues in one card is
the clutter; repeating one hue is not.

**Colours that do NOT survive both themes** — do not reuse: UW purple `#39285b` is 1.48:1
on dark, Amazon `#df9900` is 2.28:1 on light. Any new brand colour needs a value per theme.

## Hard edges

From gamedev, where he explicitly reset every radius to zero, deleted every drop shadow,
and hardened borders to `2px solid`. Structure comes from line weight. `.btn` keeps 8px and
is now the only radius on the page — an open decision.

## No uppercase micro-type

He uses uppercase for h1/h2 display, nav links, and 16px project headings. **Never as
micro-labels.** Seven rules at 11–12px with `.08em` letter-spacing were the single
strongest template tell in the file.

## Responsive: one step, nothing else

His 2024 pattern, and now this page's: at 640px, one type step down, section padding
halved, one width step. **Nothing else changes at any breakpoint.**

---

# How to verify — do this before claiming anything visual

**Reading CSS source is not verification.** Two bugs shipped live because I judged rendered
output by reading the stylesheet. See `memory/verify-by-rendering.md`.

Chrome is at `/Applications/Google Chrome.app/Contents/MacOS/Google Chrome`. A local server
runs on `:8765`.

```bash
# screenshot, then actually LOOK at the png
"$CHROME" --headless --disable-gpu --hide-scrollbars --force-device-scale-factor=1 \
  --window-size=1280,2400 --screenshot=out.png \
  --virtual-time-budget=3500 http://localhost:8765/index.html
```

**For computed values** (the only way to see cascade outcomes, token resolution, and
measured geometry): copy the page to `_probe.html`, append a script that runs on `load` and
writes `getComputedStyle` results into `<pre id=R>`, run with `--dump-dom`, extract that
node, delete the probe.

**Gotchas learned the hard way:**

- `--screenshot` captures from scroll-0 and **ignores `#fragment`**. To shoot a mid-page
  block, build a minimal page containing that markup plus the real `<style>`.
- **Chrome will not open a window narrower than 500px.** Every "390px mobile" check without
  an iframe is actually testing 500. Use an iframe with `width:390px` to get a true
  viewport.
- `.reveal` elements are `opacity:0` until observed. Force `.js .reveal{opacity:1!important}`
  in screenshot copies or you photograph a blank page.
- Before appending to any CSS declaration block, **check the last declaration ends in `;`**.
  `--head-h:56px` without one swallowed the next token and put 17px headings live.
- Never let a regex treat CSS as flat. One did, lifted `display:none` out of `@media print`,
  and the page was an empty black rectangle for three commits.
- **A check that tests one form of a thing gives false confidence.** The white-on-accent bug
  was found three times: as `var(--accent)`, then again, then as a literal `#fff`. Same
  shape as the em-dash sweep that passed while `&mdash;` sat on live pages.

## The card format checker

`python3 scripts/check-cards.py` — enforces tier, slot order, word caps, closed label sets,
industry words in `transfers`, dash sweeps, and a renders-at-all check. **Must be 0 fail,
0 warn before any commit.** It cannot see rendering; that is what the browser is for.

---

# Open items

**1. `work/y30.html` is not backed up.** 1,423 words, untracked *and* gitignored
(`.gitignore:42`), so git is not protecting it. The y30 card's case-study link has nothing
to point at. Highest-value remaining work: the converting format per the hiring research is
a 500–800 word narrative tracing one decision from an ambiguous start to an outcome.

**2. Six cards share the green fallback** — GoodRx, Clover Health, doc.ai, Modus Create,
StartPlaying, Blue Startups. Needs a hex from Chris per company; the light-theme variant is
then computed. No verifiable source was found locally, and inventing a brand colour is
still inventing.

**3. `.btn` radius.** 8px, now the only radius on the page.

**4. ~90 raw px spacing values remain in card rules** despite the tokens existing. Cosmetic
debt, no visible defect.

**5. The asymmetric 31/69 split** from his 2014 work section — scan layer narrow-left, read
layer wide-right. The content is already written for that shape.

**6. Machine surface.** `llms.txt` exists; an MCP endpoint does not.

## Do not re-litigate

- Open Sans stays. The serif is the replaceable half.
- Single column is the default. (Asymmetric is available, but it is a deliberate choice.)
- The booking CTA is dead — 1 click in 8 weeks. The agent CTA is primary; PostHog showed
  9 real conversations against 2 email clicks.
- The reference offer's position is correct: filter, then close.
- Do not "consolidate borders and type sizes" for its own sake. The original critique was
  about character, not consistency.
