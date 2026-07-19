# Making HogWare

HogWare is a daily browser microgame gauntlet built from PostHog's five public handbook values. I made it for my application to PostHog's Technical Ex-Founder role.

[Play HogWare](https://whoischrislam.github.io/hogware.html)

This is a fan tribute, not an official PostHog product.

## The product

The game turns each value into a mechanic instead of using the handbook as decoration:

| Value | Prompt | Control | Mechanic |
| --- | --- | --- | --- |
| You're the driver | DRIVE! | Hold the screen or space, then release | Drive while traffic clears the lane. Later loops introduce a stalled car that only moves when the player stops. |
| Make it public | PUBLISH! | Click or tap | Turn every row from Private to Public before time runs out. Later loops add more rows and a legal re-lock. |
| Do more weird | WEIRD! | Click or tap | Hit the highlighted parts of an office scene to mutate it one detail at a time. |
| Why not now? | SHIP IT! | Click or tap | Find and click the real SHIP IT button among moving distractions and decoys. |
| Optimistic by default | AIM! | Press space or tap | Stop the moving hedgehog on the target. The narrow ledge beyond the safe zone is riskier and pays the largest bonus. |

After all five games, a longer FUNNEL RESCUE boss asks the player to steer falling users into a funnel. Standard users are worth one retained point and the whale is worth two.

Everyone receives the same seeded order and game variation on the same local day. A run starts with three lives, gets faster on later loops, and ends when the lives are gone. Each clear earns one point plus a zero-to-three bonus. The AIM ledge is the maximum bonus.

The result screen returns to a PostHog OS desktop. Players can open each value, compare the daily leaderboard, and copy a compact emoji result to share.

## Product decisions

### One prompt at a time

The first version described the whole game as click or space. That was inaccurate because PUBLISH and SHIP require pointing, while DRIVE and the boss use hold and release. The final title screen says to follow each game's prompt, and every stage now names its exact control beside the action.

The three Max icons on the title screen are labeled as lives. A personal best only appears after the browser has a previous score. These small changes made the rules legible without turning the title screen into a manual.

### The mechanic has to express the value

Early versions exposed where a familiar arcade interaction could contradict the value it represented. DRIVE began as a stoplight reaction test, which put the game in charge of the player. The shipped version lets traffic move out of the driver's way. AIM makes the safest result useful but gives the largest upside to the player willing to risk the edge.

### Three bosses were cut

Four boss concepts reached playable code. RUN THE QUERY became data entry rather than a game. HEDGEHOG MODE and THE INCIDENT needed more work than the application package justified. FUNNEL RESCUE was the one that remained readable, physical, and fun under pressure.

The cuts matter as much as the builds. The final package is smaller, but every stage supports the same short-session rhythm.

### The shell is part of the game

HogWare runs inside a beige HOGWARE 3000 CRT with a Windows 95-style desktop and application windows. Starting a run resembles an operating system boot instead of replaying the page-load flicker. On game over, value windows can be opened and dragged, but are constrained to the visible desktop so the content cannot become unreachable.

## Technical design

### Static, config-driven engine

The site is vanilla HTML, CSS, and JavaScript with no build step. Each microgame is a config object with setup, update, press, release, and timeout hooks. A shared engine owns the timer, verb card, transitions, input routing, scoring, lives, and analytics events.

That structure keeps the five games consistent while allowing each mechanic to stay small. URL overrides such as `?day=N`, `?weird=<id>`, and `?boss=<id>` make seeded variants directly testable.

### PostHog-backed leaderboard that survives content blockers

The leaderboard originally depended on PostHog's browser library to submit scores. That failed for exactly the audience most likely to use a content blocker against analytics scripts.

The shipped path separates gameplay analytics from the board:

1. The browser submits `{handle, day, score, stages_cleared, loops_reached, uid}` to a Cloudflare Worker on game over.
2. The Worker validates the fields and forwards a `hogware_score_submitted` event to PostHog's ingestion API from the server.
3. `GET /?day=N` runs one HogQL query against those PostHog events and returns only `[{handle, best}]`.
4. The query groups by browser ID, keeps each browser's best score for the day, and limits the board to 20 rows.

The Worker rejects scores above four points per cleared stage, which matches the real scoring ceiling. This is a plausibility check, not cryptographic anti-cheat. It blocks casual nonsense while keeping the submission path simple. The Worker caches each day's board for 60 seconds and the client gives reads an eight-second timeout with a retry action.

The personal PostHog API key has Query Read scope and remains a Worker secret. The public project key can ingest events but cannot read project data.

`?notrack=1` stores an opt-out in the browser and disables both analytics and leaderboard submission by design.

### Sharing and measurement

The copied result includes the day number, score, and color trail. A PostHog feature flag can add a short challenge line, allowing the copy rate to be compared without changing the game bundle. Product analytics and session replay remain optional. The game still plays if the PostHog browser script is blocked.

## Verification

The Playwright smoke suite runs 32 checks across:

- title, boot, and transition behavior
- all five microgames and their input paths
- boss success and failure states
- scoring, lives, result copy, and personal-best behavior
- leaderboard loading, timeout, and retry states
- desktop and game-over window containment

The suite runs directly against the static files. Packaging changes are also rendered at desktop and phone sizes before release.

## What shipped

- Five handbook-value microgames and one boss
- Daily deterministic gauntlets with three lives and a difficulty ramp
- Desktop, CRT, sound, transitions, and game-over value windows
- Copyable daily results with an optional feature-flag taunt
- PostHog event storage and a HogQL leaderboard through a Cloudflare Worker
- An ad-blocker-safe score submission path
- A 32-check headless smoke suite

The current hedgehog in AIM is a placeholder that is acceptable for launch. I plan to replace it with an original hand-drawn character without changing the mechanic.

## Credits

HogWare was built by Chris Lam. The five values come from PostHog's [public handbook](https://posthog.com/handbook/values). Max life icons use PostHog's [press assets](https://posthog.com/media). HogWare is a fan tribute and not an official PostHog product.
