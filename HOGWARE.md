# Making HogWare

A build log for the game I made for PostHog's [Technical Ex-Founder](https://posthog.com/careers/technical-ex-founder) application. Keeping this public because "make it public" is literally one of the five things this game is about.

## The brief

I didn't want to send another cover letter. PostHog already runs its own page of hedgehog games ([sparks-joy](https://posthog.com/sparks-joy) — BrickHog, HogWars, HogPatch) so a hedgehog game isn't a stretch for them, it's on-brand. The bar I set for myself: build something PostHog people would actually want to pass around Slack, not just something a recruiter skims once.

## Where it started

First pass was **Hedgehog Curl** — a curling-style flick game, aim and power, a leaderboard. Solid, but while scoping it I kept asking: would anyone actually forward this to a coworker twice? Leaderboard games spread once ("try this"). They don't have the thing that makes Wordle-style games spread every day — a result you can paste into Slack without a link click.

I looked at a daily-puzzle version ("Hogdle" — guess a PostHog product/feature from a cryptic clue) because that share mechanic is genuinely the strongest one that exists. But it lost to a better idea.

## What it became

I pulled PostHog's actual company values from their public handbook. There are five:

1. **You're the driver** — *"We hire people that are really great at their jobs, and get out of their way. There are no deadlines, very minimal coordination and you won't have us breathing down your neck."*
2. **Make it public** — *"We default to transparency with everything we work on... our code, our handbook, our roadmap, how we pay people..."*
3. **Do more weird** — *"We aren't weird for the sake of it. We want the company perfectly optimized for our strategy."*
4. **Why not now?** — *"...getting things done proactively, today. You do not need consensus to do things..."*
5. **Optimistic by default** — *"Aiming for the best possible upside and sometimes missing is much better than never trying."*

Five values, five microgames, one WarioWare-style gauntlet. The pitch writes itself: *I built a WarioWare out of your own handbook.* That's a stronger signal than a leaderboard game — it says I read the thing, not just the mascot.

The curling mechanic didn't get thrown out. It became the microgame for "Optimistic by default": hold to charge power, release to launch toward the rings. Undershoot is safe and scores low. Overshoot risks missing entirely, but the sweet spot near the edge scores highest — the scoring rule *is* the value.

## How each microgame works

Real WarioWare runs on a strict format: ~4-5 seconds, one blunt verb ("Dodge!", "Squash!"), one input, instant pass/fail. I held to that — every microgame here is click-only or spacebar-only, nothing more to learn.

| Value | Verb | Input | Mechanic |
|---|---|---|---|
| You're the driver | DRIVE! | Spacebar (hold) | Hold to drive; traffic bails out of your lane before you reach it. From level 2, one stall car only moves if you *stop* — hold into it and you crash. |
| Make it public | PUBLISH! | Click | Flip every toggle from Private to Public. The list gets longer and denser per level, and at level 3 one re-locks itself ("legal had concerns"). |
| Do more weird | WEIRD! | Click (aim) | A pulsing ring marks the next thing to weirdify on a boring stock photo — only clicks inside it count. At level 3 the photo wanders and normalcy creeps back if you stall. |
| Why not now? | SHIP IT! | Click | Find and hit SHIP in a swarm of moving distractions — meetings, your mom, the dog. Nothing holds still. Later levels: the button arrives late, and a decoy shows up first. |
| Optimistic by default | AIM! | Spacebar (press) | The hedgehog paces the rink on its own; stop it on the glowing band. A near-frame-perfect sliver past the edge pays triple. |

Everyone gets the same gauntlet on the same day — a daily seed drives the order and every roll of the dice, so scores are comparable and your result is *today's* result. You get three lives (the icons are Max, PostHog's own mascot, straight from their press assets — it started at WarioWare's four, then playtesting said classic-NES three). Run ends when they're gone; score is total microgames cleared. At the end you get a copyable result — `HogWare #12 🟩🟩🟥🟩 · 7` — built to be pasted into Slack next to a coworker's.

## The decisions I'd defend

**PostHog is the leaderboard.** Not a tracking pixel on top of someone else's database — their own product *is* the backend. Scores write in through a normal `posthog.capture()` call. Reads come from a small Cloudflare Worker holding a Query-Read-only PostHog personal API key, running a HogQL query that aggregates the leaderboard straight out of the events table. If I'd bolted on Supabase instead, this would just be another game that happens to send events somewhere. This way, their query engine is doing real work.

**Built for variants from day one, not retrofitted.** Every microgame is a small config object on one shared engine (verb card, timer, input capture, pass/fail, PostHog capture) instead of five one-off scripts. A cosmetic variant is just a new skin on the same config. A real mechanic variant — extra decoys, moving targets, tighter thresholds — is a small delta of logic inside that one microgame, not a rewrite. That's what makes it realistic to keep adding to this after the first version ships.

**Code-drawn scenes, no live third-party calls at runtime.** Everything on screen is inline SVG — scalable, recolorable off the same CSS tokens already driving the rest of the site — with two exceptions: the life icons are official Max PNGs from PostHog's press assets (credited in the footer), and the playable hedgehog will get a real design pass from me rather than staying code-drawn. Sound and music came from ElevenLabs (their SFX and Music APIs) — generated once during the build and shipped as static files, not called live from the browser. The same rule keeps the PostHog personal API key out of the client: no secret ships to the browser, ever.

## Iteration 2: the adversarial pass

After v1 shipped, two things happened before any polish: real research into how WarioWare actually works, and a four-model adversarial review (Codex, DeepSeek, Minimax, Stepfun — external models, deliberately not the AI that built it) of the whole concept. Verdict: **block before sharing**. They were right. What changed because of it:

- **Sudden death died.** The math was brutal: with one miss ending the run, most first-time players would never see all five values — and all five values is the whole pitch. Real WarioWare gives you four lives; HogWare shipped with four, and later playtesting tuned it to a classic-NES three. (An earlier version of this paragraph said "four" while the code said three — caught by review, again. Building in public means the doc drifts get caught in public too.)
- **Two microgames were contradicting the values they represented.** "You're the driver" was a stoplight reaction test — but the actual quote is "we hire people that are really great at their jobs, and **get out of their way**." A traffic light telling you exactly when to act is the opposite of that. Now the road literally clears itself. Same with "Do more weird": clicking fast isn't weird, so now a boring stock photo mutates weirder with every click.
- **The share mechanic I'd already diagnosed and then failed to build got built.** The reason Wordle spreads inside companies is a copyable result that needs no link click. Daily seed, emoji trail, one COPY button.
- **The panel also caught this document lying** — see the audio note above. Keeping the catch visible instead of quietly fixing it is the point of the doc.

Also for the record, the panel got things wrong: it assumed the game was keyboard-only (touch worked from day one) and unsanitized (initials were already clamped to A-Z0-9). Spec-only reviews infer; the code is the ground truth. Both kinds of findings are part of an honest review story.

## Four bosses built, three cut

Bosses are the WarioWare structure that lets good runs go deep: a longer stage after every loop, no visible timer, and clearing one restores a lost life. I built four. One survived playtesting.

**RUN THE QUERY** (assemble the leaderboard's actual HogQL, pick the right chart) — cut the same day I played it. It wasn't fun: every engineer knows SELECT comes before FROM, so it was data entry, then one obvious click. I'd optimized for signal and forgotten to build a game. Narrative jokes belong in this document; mechanics belong in the game.

**HEDGEHOG MODE** (charge, roll, hop rocks, land in the glow — the project's original curling concept) and **THE INCIDENT** (spot the bad commit while the error graph climbs, then mash ROLLBACK) — both playable, both shelved after playtesting. They need more love than they've had, and a boss you half-like is worse than fewer bosses you fully like. They stay in the codebase awaiting rework.

**FUNNEL RESCUE** is the keeper: eight users fall at seeded spots — regulars, fast ones, floaters, and one $-marked whale worth double (net revenue retention as a game rule) — and you steer the funnel with one input to retain four points' worth. Realistic retention math on purpose: needing ~44% of what falls is "great product" territory, not fantasy-land. Miss the rim and the user visibly bounces off and churns in full view.

Building these surfaced two honest game-feel lessons the test suite caught before any human did: hop presses that land mid-air now buffer and fire on landing (punishing an 80ms-early press is how games feel broken without anyone knowing why), and THE INCIDENT's mash-meter once checked for 100% *after* the per-frame decay ran — you could mash to full and nothing would happen, forever.

## The connective tissue

The seamless feel came last and went through the heaviest process: research (the lookahead-scheduler pattern for Web Audio, iOS unlock quirks), a written architecture spec, and another adversarial review — which BLOCKED v1 and was right to. The shipped version: a beat clock (the conductor) that aligns *starts* — the next verb card lands on a beat — but never stretches durations and never gates feedback, because the panel proved beat-quantizing the result flash both broke the tuned timings and added dead air. Zoom transitions ride it, deliberately dramatic; games only start their clock and hear input once the zoom lands, so transitions cost zero playable time. The verb card doubles as the home scene: your remaining Max lives bounce to the beat, a stat tile reads the loop and level, and your score draws itself as a tiny insights-style sparkline. When the music speeds up someday (the beat clock is ready for a 120-BPM loop and stings), the whole scene will accelerate with it.

## The night the leaderboard went live

Wiring PostHog for real took one long evening and taught more than the whole build. The pieces: a dedicated PostHog project so the read key can only ever see game events; a Cloudflare Worker holding a Query-Read-only key that answers the leaderboard with one HogQL query; a plausibility gate *inside the query* — a submitted score only counts if that player's cleared-microgame event trail backs at least half of it. We tested that honestly: injected a forged 250-point score with no gameplay behind it, straight at the capture API. It ingested fine, and the board never showed it. Cheat-resistance implemented in HogQL.

The debugging gauntlet, kept here because pretending it was smooth would be against the whole point of this document: GitHub Pages' Jekyll builds failed for an hour on GitHub's own API (fixed forever with a `.nojekyll`); my browser cached the stale game and gaslit us both; my ad blocker was silently eating PostHog scripts; piping a secret through `echo` embedded an invisible newline that made a valid API key read as invalid; a CLI deploy wiped a dashboard-added secret; and my first leaderboard query was heavy enough to time out PostHog's sync window and had an alias-shadowing bug besides. Six real failures, each one now a thing I know.

Also live: a real multivariate feature flag (`hogware-share-taunt` — does a challenge line in the copied result raise share rates? the flag decides, the copy-event data answers), and a post-run survey asking the only question that matters: *how weird was that?* — Not weird → Very weird, five emoji. Zero code for the survey; it triggers on the game's own run-completed event. And PostHog's MCP server is now wired into the agent workflow that built this, so "did anyone play today?" is a question my tools can answer directly.

## The role closed. Shipped it anyway.

While this was mid-build, PostHog took the Technical Ex-Founder listing down. Not a rejection; the door closed before I got to knock. I checked their careers page twice: no ex-founder role, no product engineer roles at all right now.

So the application this was built for no longer exists, and the game is finished anyway, because somewhere during the build it stopped being a cover letter and became the proof. Not proof for PostHog specifically. Proof of the job I actually do:

- **Read the handbook, not just the careers page.** Every mechanic in this game traces back to a sentence PostHog wrote about themselves. The scoring rules *are* the values.
- **Use the company's real product as load-bearing infrastructure, not decoration.** The leaderboard is a HogQL query. The A/B test is their flag product. The survey is their survey product. The cheat protection runs inside the query.
- **Run a real process, solo.** An external adversarial review that blocked v1 and was right. Research-backed pacing fixes. A headless suite that plays every microgame and fights the boss. A public kill list for the darlings that weren't fun.
- **Ship it fast without shipping it sloppy.** About a week from concept to a playtest-tuned game that works on a phone, with the analytics to know whether anyone plays.

That generalizes to any company: hand me your handbook and your product, and in a week you get something your own team wants to pass around Slack. PostHog just happened to be the first handbook.

And the fifth value was always going to get the last word. "Optimistic by default" means *aiming for the best possible upside and sometimes missing is much better than never trying.* I built a microgame out of that sentence, then the project got to live it.

## Status

Finished and live at [whoischrislam.github.io/hogware.html](https://whoischrislam.github.io/hogware.html), built in the open in `whoischrislam.github.io` as `hogware.html` / `hogware.js`, with the headless test suite at `tests/smoke-hogware.js` (32 checks) and the leaderboard Worker at `hogware-worker/`. Every PostHog feature is live and verified: events, session replay, the HogQL leaderboard with its forge test passed, a running flag experiment, and a launched survey. One asset still owed: my hand-drawn hedgehog (tracked in [`HOGWARE_ART_DIRECTION.md`](HOGWARE_ART_DIRECTION.md)); the site links go live when it lands. The leaderboard resets daily. Go start a war.
