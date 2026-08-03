# HogWare Art Direction

**Status:** Current craft-pass plan

**Updated:** July 17, 2026

**Next action:** Build the AIM vertical slice described below before producing assets for the other games.

## The goal

HogWare should feel like a lost 1998 shareware game installed inside PostHog's desktop: strange, immediate, and cohesive. The next pass is not about adding decoration everywhere. It is about making every game readable in half a second, giving important actions satisfying visual feedback, and making all six scenes feel as though one small art team built them.

Gameplay is locked. Art must clarify the existing mechanics rather than create new ones.

## Visual system

- Chunky vector artwork with strong, consistent black outlines.
- Flat fills drawn from the existing PostHog-inspired palette.
- Restrained offset shadows and CRT glow; avoid generic gradients and glossy SaaS art.
- Slightly crude shareware energy, but deliberate spacing and silhouettes.
- One visual hero per scene. Decoration must not compete with the action.
- Interactive objects need three clear states: idle, actionable, and resolved.
- Animation should be short and readable: anticipation, action, payoff.
- Everything important must still work with reduced motion.

The desktop, CRT, program windows, timer, and game-over dialog already establish the shell. New art should live inside that system rather than redesign it.

## Brand boundary

PostHog's [press page](https://posthog.com/media) includes banner illustrations and Builder, Professor, and Detective Max. Their [brand guidelines](https://posthog.com/handbook/brand/assets) say official assets should remain unmodified, discourage AI-generated Max artwork, and restrict mascot or illustration use in marketing without permission.

For HogWare:

- Keep official logos and approved PostHog artwork unmodified.
- Do not generate or redraw Max with AI.
- Do not crop, recolor, costume, or animate official press illustrations into new poses.
- Use official press art only as an occasional intact cameo, title/credits image, or build-log image after permission is clear.
- Confirm that the existing `images/hogware/max-life.png` use is acceptable before submission.
- Chris should draw the original playable HogWare buddy. Implementation work can then clean the SVG, create state variants from Chris's source, and animate them in code.
- Game-world props, vehicles, UI objects, effects, and environments should be original HogWare assets rather than imitations of PostHog illustrations.

## Shared asset kit

Build a compact system instead of one-off scene art:

### Character

One original HogWare buddy with six to eight reusable states:

1. Neutral/front.
2. Moving left.
3. Moving right.
4. Anticipation/squash.
5. Impact or stop.
6. Success.
7. Failure.
8. Small desktop/taskbar pose if the main silhouette does not scale down cleanly.

### Program icons

Create one icon for each executable:

- `drive.exe`
- `publish.exe`
- `weird.exe`
- `ship.exe`
- `aim.exe`
- `funnel.exe`

These can appear on the desktop, verb cards, loading transitions, and future share art.

### Reusable effects

- Dust puff.
- Speed streak.
- Impact star.
- Sparks.
- Smoke.
- Target pulse.
- Success burst.
- Failure fragments.
- Stamp impression.
- Motion trail.

Use CSS and inline SVG for effects that change color, scale, or timing. Avoid shipping raster sequences.

### Technical shape

- Keep dynamic and interactive art as inline SVG or reusable SVG symbols.
- Use the existing CSS variables instead of hardcoded near-duplicate colors.
- Prefer a consistent view box and stroke treatment across games.
- Reserve raster assets for approved official artwork and the final social image.
- Make asset names semantic and state-based, such as `buddy-stop`, `car-stall`, or `user-whale`.
- Do not add live third-party asset requests at runtime.

## Microgame plan

### AIM — first vertical slice

This is the first pass because it forces the character, motion, scoring readability, and effects system to work together.

Assets:

- Original buddy movement poses.
- Rink surface and edge markers.
- Clear safe band, high-value band, and tiny triple-value ledge.
- Motion trail.
- Stop/impact burst.
- Separate success, miss, and triple-hit reactions.

Polish:

- Add a small anticipation squash before movement settles into rhythm.
- Make direction changes readable without adding visual noise.
- Let the trail communicate speed as later loops accelerate.
- Give the triple zone a distinctive flare without making it look safer or larger than it is.
- Make the stopped pose visibly lock to the result instead of merely freezing.

The vertical slice is complete when AIM looks intentional on desktop and phone, the scoring zones remain obvious under pressure, and the same buddy/effect rules can be reused elsewhere.

### DRIVE

Assets:

- Player vehicle with idle, moving, braking, and collision states.
- Normal traffic, stall car, and hesitant car with distinct silhouettes.
- Lane markers, roadside signs or cones, dust, and collision debris.

Polish:

- Add acceleration compression and speed streaks while holding.
- Make normal cars visibly yield before they leave the lane.
- Give the stall car a unique visual tell that does not require reading text.
- Make braking feel intentional and collision feel immediate.

### PUBLISH

Assets:

- Several document/file card types.
- Lock and public/globe states.
- Small owner avatars or file-source marks.
- Public stamp.
- Legal-warning/re-lock prop.

Polish:

- Turn every click into a lock-to-public transformation, not just a color swap.
- Use the stamp as the cumulative success payoff.
- Make the level-three legal re-lock theatrical but instantly understandable.
- Keep rows readable as density increases; icons should replace nonessential copy.

### WEIRD

Assets:

- One stronger base office illustration built from separate layers.
- Separate mutation layers for the person, tie, chart, plant, wall, sun, and caption.
- Stronger target/crosshair treatment.

Polish:

- Favor silhouette-changing mutations over small color changes.
- Preserve every mutation so the image becomes progressively stranger.
- Make the active target easier to scan without revealing future targets.
- End with a full-scene payoff after the final mutation.

The existing concepts—propeller tie, third eye, rollercoaster chart, indoor sun, levitation—are worth keeping. They need a unified drawing style and larger visual consequences.

### SHIP IT

Assets:

- Distinct meeting, calendar, message, family, pet, and approval-window distractions.
- Primary deployment/SHIP control.
- Pending or decoy deployment control.
- Package, rocket, or terminal-success motif.

Polish:

- Give distraction families different movement personalities instead of treating all of them as moving text.
- Use icons and silhouettes so the swarm can be parsed peripherally.
- Make the real SHIP control visually decisive without making the search trivial.
- Make the decoy look plausible at first glance but clearly explain itself when clicked.
- Add a sharp deployment burst on success.

### FUNNEL RESCUE

Assets:

- A physical funnel machine rather than only an abstract line.
- Standard, fast, and floating user tokens with distinct silhouettes.
- Gold or otherwise unmistakable revenue whale.
- Retained destination and churn exit.
- Bounce, spark, and score-light effects.

Polish:

- Show users hitting the rim, bouncing, and visibly exiting to churn.
- Make the retained path feel like a machine accepting the user.
- Give the whale more visual weight without obscuring its trajectory.
- Let the machine light up as retained value accumulates.
- Preserve the current realistic retention math and one-input control.

### Host, title, and results

Do this after the playable scenes establish the style.

- Replace the placeholder desktop buddy with the approved original character.
- Add the six program icons to the desktop without restoring the earlier clutter.
- Create one title composition that explains the CRT/desktop fiction immediately.
- Add small success/failure art accents to `gameover.exe` without weakening the score and COPY RESULT hierarchy.
- Build the OG image from the final title art rather than designing a separate visual language.

## Production order

1. Chris draws the canonical HogWare buddy source.
2. Implement AIM as the art-direction vertical slice.
3. Validate AIM on desktop, mobile/touch, and reduced motion.
4. Apply the system to DRIVE.
5. Upgrade FUNNEL RESCUE.
6. Upgrade WEIRD.
7. Upgrade SHIP IT and PUBLISH.
8. Finish the title, results accents, and OG image.
9. Confirm official-asset permission and attribution.
10. Run the full smoke suite and a real-device playthrough before listing the page.

## Definition of done

- Every game is understandable within half a second of the verb card ending.
- Interactive elements remain visually dominant at phone size.
- Every pass, failure, and special result has an immediate visual payoff.
- The six scenes share the same outlines, shadows, palette discipline, and motion language.
- No official PostHog illustration has been modified or used without the required permission.
- No new AI-generated hedgehog art ships.
- Reduced-motion mode remains complete and readable.
- Art does not change daily seeding, input timing, scoring, or game balance.
- Final assets load locally with no runtime third-party dependency.

## First return session

Do not start by polishing all six games.

1. Open this document and `hogware.js` at the `hedgehogSVG` placeholder.
2. Bring in Chris's canonical buddy SVG, or block only the character portion if it is not ready.
3. Build the AIM rink and effect assets around the existing mechanic.
4. Test one full AIM pass, miss, and triple hit at desktop and phone widths.
5. Decide whether the visual system is strong enough to propagate before touching DRIVE.

## The flip (staged 2026-07-20)

The game is content-complete and publicly framed for the closed role ("shipped it anyway" footer, HOGWARE.md ending chapter, OG card at `images/hogware/og.png`). Everything below is staged and waiting on one asset: Chris's hand-drawn hedgehog. When it lands, flip in this order.

1. Swap the hedgehog into `hedgehogSVG()` in `hogware.js` (AIM puck `#hw-puck` + verb-card buddy). Original character, not Max-like, no AI-generated hedgehog art.
2. Run `tests/smoke-hogware.js` (32 checks) plus one real-device playthrough.
3. If the title screen changed, regenerate the OG card: 1200x630 screenshot of the loaded title screen, saved to `images/hogware/og.png`.
4. Uncomment the HogWare case-card in `index.html` (marker: `HOGWARE (staged)`).
5. Uncomment the HogWare list item in `candidate.html` (same marker).
6. Add to `llms.txt` under Key pages:
   `- [HogWare](https://whoischrislam.github.io/hogware.html): a playable WarioWare-style game built from PostHog's five company values in about a week, with PostHog itself as the backend. The role it was built for closed mid-build; he shipped it anyway. Build log: https://github.com/whoischrislam/whoischrislam.github.io/blob/main/HOGWARE.md`
7. Add to `llms.txt` under Selected engineering:
   `- HogWare (solo, 2026): a WarioWare-style microgame gauntlet built from PostHog's five handbook values in about a week. PostHog is the backend: a HogQL leaderboard with in-query cheat protection behind a Cloudflare Worker, a live flag experiment, and a survey; a 32-check headless suite plays the game end to end.`
8. Add to `sitemap.xml`:
   `<url><loc>https://whoischrislam.github.io/hogware.html</loc><changefreq>monthly</changefreq><priority>0.6</priority></url>`
9. Rotate the exposed PostHog personal API key (Query Read) and update the Worker secret. Use `printf '%s' "$KEY" | wrangler secret put ...`, never `echo` (the trailing-newline bug from the leaderboard night).
10. Commit as `feat(hogware): go public`.
