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
| You're the driver | DRIVE! | Spacebar | Floor it the instant the light turns green. Jump early, you stall. |
| Make it public | PUBLISH! | Click | Flip three toggles — code, roadmap, pay — from Private to Public before time's up. |
| Do more weird | WEIRD! | Click (mash) | Plaster a poster with stickers as fast as you can. |
| Why not now? | SHIP IT! | Click | Hit Ship before the "let's schedule a sync" popups bury the button. |
| Optimistic by default | AIM! | Spacebar (hold + release) | Charge and launch toward the rings. Safe and short, or risky and worth more. |

Runs shuffle the order every loop and speed up each time through, until you miss one. Score is total microgames cleared, not just loops survived — more room to actually rank people on a leaderboard.

## The decisions I'd defend

**PostHog is the leaderboard.** Not a tracking pixel on top of someone else's database — their own product *is* the backend. Scores write in through a normal `posthog.capture()` call. Reads come from a small Cloudflare Worker holding a Query-Read-only PostHog personal API key, running a HogQL query that aggregates the leaderboard straight out of the events table. If I'd bolted on Supabase instead, this would just be another game that happens to send events somewhere. This way, their query engine is doing real work.

**Built for variants from day one, not retrofitted.** Every microgame is a small config object on one shared engine (verb card, timer, input capture, pass/fail, PostHog capture) instead of five one-off scripts. A cosmetic variant is just a new skin on the same config. A real mechanic variant — extra decoys, moving targets, tighter thresholds — is a small delta of logic inside that one microgame, not a rewrite. That's what makes it realistic to keep adding to this after the first version ships.

**No raster art, no live third-party calls at runtime.** Everything on screen is inline SVG — scalable, recolorable off the same CSS tokens already driving the rest of the site. The one thing that got a real design pass instead of code is the hedgehog itself. Sound and music came out of ElevenLabs (their SFX and Music APIs, both genuinely good), generated once and shipped as static files — not called live from the browser, same reason the PostHog personal API key never leaves the Worker: no secret ships to the client, ever.

## Status

Building in the open in `whoischrislam.github.io` as `hogware.html` / `hogware.js`. Full technical plan lives alongside the build. Core five microgames and the run loop first; leaderboard, feature flag, and survey wiring depend on a couple of things only I can do (a scoped API key, a Cloudflare account, an actual PostHog feature flag and survey created in their dashboard). Hedgehog art and audio come from me directly, not generated blind.
