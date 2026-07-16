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
| You're the driver | DRIVE! | Spacebar (hold) | Hold to drive. Traffic bails out of your lane before you reach it — the road clears itself. The only way to fail is to hesitate. |
| Make it public | PUBLISH! | Click | Flip three toggles — code, roadmap, pay — from Private to Public before time's up. |
| Do more weird | WEIRD! | Click (mash) | A boring corporate stock photo mutates one notch weirder per click. Ten notches to win. |
| Why not now? | SHIP IT! | Click | Hit Ship before the "let's schedule a sync" popups bury the button. |
| Optimistic by default | AIM! | Spacebar (hold + release) | Charge and launch toward the rings. Safe and short, or risky and worth more. |

Everyone gets the same gauntlet on the same day — a daily seed drives the order and every roll of the dice, so scores are comparable and your result is *today's* result. You get three lives (the icons are Max, PostHog's own mascot, straight from their press assets — it started at WarioWare's four, then playtesting said classic-NES three). Run ends when they're gone; score is total microgames cleared. At the end you get a copyable result — `HogWare #12 🟩🟩🟥🟩 · 7` — built to be pasted into Slack next to a coworker's.

## The decisions I'd defend

**PostHog is the leaderboard.** Not a tracking pixel on top of someone else's database — their own product *is* the backend. Scores write in through a normal `posthog.capture()` call. Reads come from a small Cloudflare Worker holding a Query-Read-only PostHog personal API key, running a HogQL query that aggregates the leaderboard straight out of the events table. If I'd bolted on Supabase instead, this would just be another game that happens to send events somewhere. This way, their query engine is doing real work.

**Built for variants from day one, not retrofitted.** Every microgame is a small config object on one shared engine (verb card, timer, input capture, pass/fail, PostHog capture) instead of five one-off scripts. A cosmetic variant is just a new skin on the same config. A real mechanic variant — extra decoys, moving targets, tighter thresholds — is a small delta of logic inside that one microgame, not a rewrite. That's what makes it realistic to keep adding to this after the first version ships.

**Code-drawn scenes, no live third-party calls at runtime.** Everything on screen is inline SVG — scalable, recolorable off the same CSS tokens already driving the rest of the site — with two exceptions: the life icons are official Max PNGs from PostHog's press assets (sanctioned, credited in the footer), and the playable hedgehog will get a real design pass from me rather than staying code-drawn. Sound and music will come from ElevenLabs (their SFX and Music APIs) — generated once during the build and shipped as static files, not called live from the browser. Same reason the PostHog personal API key will never leave the Worker: no secret ships to the client, ever. (For the record: as of this writing the audio doesn't exist yet — the current build has placeholder synth blips. An earlier version of this doc said "shipped" in past tense; an adversarial review caught that as a transparency bug in a doc about transparency. Fair. Fixed.)

## Iteration 2: the adversarial pass

After v1 shipped, two things happened before any polish: real research into how WarioWare actually works, and a four-model adversarial review (Codex, DeepSeek, Minimax, Stepfun — external models, deliberately not the AI that built it) of the whole concept. Verdict: **block before sharing**. They were right. What changed because of it:

- **Sudden death died.** The math was brutal: with one miss ending the run, most first-time players would never see all five values — and all five values is the whole pitch. Real WarioWare gives you four lives; HogWare shipped with four, and later playtesting tuned it to a classic-NES three. (An earlier version of this paragraph said "four" while the code said three — caught by review, again. Building in public means the doc drifts get caught in public too.)
- **Two microgames were contradicting the values they represented.** "You're the driver" was a stoplight reaction test — but the actual quote is "we hire people that are really great at their jobs, and **get out of their way**." A traffic light telling you exactly when to act is the opposite of that. Now the road literally clears itself. Same with "Do more weird": clicking fast isn't weird, so now a boring stock photo mutates weirder with every click.
- **The share mechanic I'd already diagnosed and then failed to build got built.** The reason Wordle spreads inside companies is a copyable result that needs no link click. Daily seed, emoji trail, one COPY button.
- **The panel also caught this document lying** — see the audio note above. Keeping the catch visible instead of quietly fixing it is the point of the doc.

Also for the record, the panel got things wrong: it assumed the game was keyboard-only (touch worked from day one) and unsanitized (initials were already clamped to A-Z0-9). Spec-only reviews infer; the code is the ground truth. Both kinds of findings are part of an honest review story.

## Status

Building in the open in `whoischrislam.github.io` as `hogware.html` / `hogware.js`. Iteration 2 (lives, daily seed, the two mechanic swaps, copyable results) is in. Next gate is playtesting with real humans — mechanics don't get polish until strangers confirm they're fun. After that: the leaderboard Worker (with score validation designed in from the start), a feature flag experiment that actually decides something (3 vs 4 lives against completion rate), audio, and my own hedgehog. The page stays unlisted until it earns the link.
