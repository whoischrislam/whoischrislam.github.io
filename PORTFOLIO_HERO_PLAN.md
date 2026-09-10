# Portfolio hero + mosaic rebuild — production plan

Status as of 2026-09-10. Graphics owner: Chris (Figma). Site wiring and
verification owner: the agent. The style truth lives in `DESIGN_SYSTEM.md`
("Hero art direction (recovered)"); this file is the operational masterlist.

## The model

One master hero composite per project (1400x450, brand-colour canvas + device
mockups). The case study lives on its own `work/<project>.html` page with that
hero as its lead. The homepage mosaic is curated crops of those heroes, not a
separate tile set. Consistency is structural: every mosaic piece is a fragment
of one styled master, so the wall reads as one register.

Production unit per product case study: one hero + two to three crops (vary the
tile shape, for example one landscape and one portrait). The hero leads the case
page; the crops are the mosaic pieces.

## Tooling decision

Figma for the composites (device-mockup framing, clean export). Not paper.design
(it builds live UI components, not screenshot composites) and not hand-CSS (slow,
fiddly bezels). The site side (crop wiring, case-page hero, render checks) is
code. paper.design is not used in this plan. This closes the Figma-vs-paper.design
question for this work: the task is mockup compositing, which is Figma's job.

## Category A — product heroes (the device-mockup template)

| Project | Hero | Canvas colour | Source assets | Blocker |
|---|---|---|---|---|
| Pathstream (PILOT) | build | red `#FF4F51` | in-repo + Dropbox | none |
| TaskRabbit | reuse | green | done | cut crops only |
| Clover Health | reuse | teal | done | cut crops only |
| GoodRx | reuse | yellow | done | cut crops only |
| Iodine (off-wall now) | reuse | purple | done | cut crops only |
| Amazon Music | build | gold `#DF9900` (fails light theme) | Dropbox | needs a light-theme gold variant |
| Modus Create | build | UNKNOWN | Dropbox | need hex |
| StartPlaying | build | UNKNOWN | Dropbox / live | need hex |
| doc.ai / Omix | build (diagram, not devices) | UNKNOWN | likely none, design fresh | need hex + design the lifecycle |

Category A count: five heroes to build (Pathstream, Amazon, Modus, StartPlaying,
Omix) plus four reused. Crops: two to three per project across nine projects
(roughly 18 to 27), of which eight to twelve are cut from the four heroes that
already exist. Counting method: one hero per project, plus the crop range above;
not a fixed number, because the final mosaic curation sets how many pieces show.

doc.ai/Omix is the exception: a clinical-study lifecycle diagram, not a
product-across-devices shot. Brand canvas, diagram treatment, and likely no
source screenshots, so it is designed from scratch. Hardest of the five.

## Category B — live-demo projects (video)

y30, PlaySesh. The video tiles stay (a stronger register than a static
composite). No new mosaic graphics required. Optional case-page poster later.

## Category C — games / experiments

Not device mockups. Screenshot or key-art on a brand canvas, a lighter template.
Decide keep/cut first.

- Have art, keep: HogWare (`images/hogware/og.png`), Evolve Die Repeat
  (`images/co/edr.webp`), Zodiacus (`images/co/zodiacus.webp`), y30 game
  (`images/work/y30-game.png`).
- Empty, cut candidates: Voice Noir, Rat with Wings.
- Empty, keep for AI signal: AI Polyglot (one capture).

Category C graphics: zero to three captures, no composites, pending the cut
decisions.

## Build order (unblocked first)

1. Pathstream (pilot, fully unblocked): one hero + three crops (matched to the
   existing wide / portrait / landscape Pathstream tile slots).
2. Crops from the four existing heroes (TaskRabbit, Clover, GoodRx, Iodine):
   no new compositing, fast wins.
3. Amazon (needs a light-theme gold decision, otherwise ready).
4. Modus, StartPlaying, Omix: blocked on the three brand hexes; Omix also needs
   the lifecycle designed.

## Gating inputs needed from Chris

1. Three brand-colour hexes: Modus, StartPlaying, doc.ai/Omix. Cannot be invented
   (design-system rule), and they gate three of the five heroes.
2. Confirm Dropbox source screenshots exist for Amazon Music, Modus dark mode,
   and StartPlaying. No source means no hero for that project.
3. Category C cut list: keep or cut Voice Noir, Rat with Wings, AI Polyglot.

## Crop discipline (from the 2026-09-10 concept spike)

The spike built a mosaic purely from CSS crops of the four existing heroes. It
validated the concept (the brand-canvas + device style unified the wall) and
exposed one rule: CSS-cropping a single hero clips the devices. So export
deliberately framed crops from Figma, device fully inside the frame, even margin,
consistent device scale.

## Pilot state and next action (Pathstream)

- Brand colour known (red `#FF4F51`, cited to `PATHSTREAM_BRAND_GUIDELINES.pdf`).
- In-repo source: `pathstream-completelesson` (1512x1080), `-dashboardstates`
  (1400x1944), `-menuscrolling` (3330x1080), `-contrast` and `-subtle`
  (1400x5624 full-page scrolls), `-ecosystem` (1400x141). Pull cleaner originals
  from the Dropbox design folder where these are too tall or low-res.
- Case page exists: `work/pathstream.html` ("Rebuilding the lesson, mid-flight").
- Next: Chris builds the Pathstream hero + three crops. The agent then swaps the
  three Pathstream tile sources in `index.html`, sets the case-page hero, renders
  before/after at 1440 and 390, and runs `check-portfolio-v3.py` and `verify.sh`.
- Offered, not yet delivered: exact Figma export dimensions for the hero and the
  three crop frames.

## Where this connects

- Style truth: `DESIGN_SYSTEM.md`, section "Hero art direction (recovered)".
- The private handoff `.jobhunt/ACTIVE_PORTFOLIO_HANDOFF.md` is not in this
  worktree (separate private repo, gitignored). Its pointer to this plan must be
  added from the main checkout during session-end.
