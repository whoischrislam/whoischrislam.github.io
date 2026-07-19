# Builder Training Protocol

**Status:** Active
**Started:** July 17, 2026
**Purpose:** Turn Chris's demonstrated burst velocity into sustainable, repeatable product-engineering speed.

## Why this exists

The repository evidence across HogWare, EDR, PlaySesh, and y30 shows that Chris can move from an idea to substantial working software unusually quickly. The recurring constraint is not raw production speed. It is convergence:

- Selecting the smallest proof that resolves the real uncertainty.
- Showing work and asking for feedback before the solution becomes large.
- Keeping supporting architecture proportional to validated product need.
- Finishing within a normal workday instead of relying on long, intense sessions.
- Understanding and explaining AI-assisted implementation rather than measuring success by generated volume.

The training goal is:

> Produce one bounded, useful, explainable, reviewable outcome at a high quality bar within the promised timebox.

## Current baseline

### Demonstrated strengths

- Very fast time from idea to working vertical slice.
- Strong design-engineering range across interaction, frontend, backend, infrastructure, testing, and deployment.
- High agency when debugging unfamiliar systems.
- Willingness to test, revise, and kill weak ideas.
- Effective use of coding agents as a throughput multiplier.
- Strong instinct for instrumentation, feedback loops, and operational quality.

### Training edges

- Scope expands easily after the first useful version works.
- Platform, process, or architecture work can displace the next user-visible proof.
- Several projects are ahead as software systems but behind as converged products.
- Work often happens in long bursts; sustainable eight-hour repeatability is not yet proven.
- High agent throughput can conceal comprehension debt unless teach-back is intentional.

These are not character flaws. They are the next set of trainable product-engineering skills.

## What speed means

Do not use commits, lines of code, or agent activity as the primary score.

Speed is:

1. Time to a working user-visible slice.
2. Time to the first useful feedback checkpoint.
3. Time to reduce the most important uncertainty.
4. Time to a tested, reviewable handoff.
5. Amount of unnecessary work avoided.

## Training modes

### Daily rep: 90–120 minutes

Use this on most practice days.

| Time | Action |
|---|---|
| 0:00–0:15 | Write the scope card. Inspect the existing system. |
| 0:15–1:00 | Build the thinnest working path. |
| 1:00–1:15 | Run it and publish a checkpoint. |
| 1:15–1:45 | Fix the highest-value issue only. |
| 1:45–2:00 | Verify, explain, log, and stop. |

A daily rep must end with one of these artifacts:

- A working user-visible change.
- A reproduced and fixed bug with a regression test.
- A tested product hypothesis with a keep/revise/kill decision.
- A small refactor that measurably reduces risk or iteration time.
- A reviewable plan for an uncertainty that truly could not be resolved in code that day.

### Half-day rep: four hours

Use this for a feature that needs one feedback cycle. A working version must exist by hour two. The remaining time is for feedback, tests, and refinement.

### SuperDay simulation: eight hours

Use this weekly or every other week.

| Time | Required state |
|---|---|
| 0:00–0:30 | Problem understood; scope card posted. |
| 1:30 | Crude working vertical slice and first update. |
| 4:00 | Complete user-visible solution; request feedback. |
| 6:30 | Feedback incorporated; critical cases covered. |
| 7:30 | Tests, cleanup, documentation, and demo ready. |
| 8:00 | Reviewable handoff submitted; work stops. |

The exercise fails if it produces impressive volume but no clean handoff.

## Scope card

Every rep begins with this, before implementation:

```text
User/problem:
Outcome by the end of this timebox:
How I will prove it works:
In scope:
Explicitly out of scope:
First checkpoint:
Stop time:
```

The out-of-scope section is mandatory. New ideas go into a parking lot and do not change the current rep.

## One-work-item rule

- One product uncertainty at a time.
- One working tree or branch at a time for the central implementation.
- One material scope change maximum per rep.
- No new framework, platform, abstraction, workflow system, or generalized engine unless the scoped outcome cannot be delivered without it.
- If three implementation attempts fail, stop and reconsider the approach instead of adding more machinery.

## Using AI while training

AI use is expected. The skill being trained is directing and evaluating it well.

Chris owns:

- The problem framing and scope card.
- The product judgment and tradeoffs.
- Acceptance or rejection of generated work.
- The final explanation and demonstration.

Agents may research, scaffold, implement, test, and review, but they must not silently expand the task. During a practice rep:

- Keep the central judgment path with one primary agent.
- Ask the agent to expose assumptions and tradeoffs.
- Inspect the meaningful diff before calling the work complete.
- Explain the critical execution path without reading the agent's summary verbatim.
- Record any code or architectural decision that cannot yet be explained as comprehension debt.

## Daily scorecard

Score each dimension 0, 1, or 2. The total is a trend, not a judgment of personal worth.

| Dimension | 0 | 1 | 2 |
|---|---|---|---|
| Focus | Scope expanded materially | One justified adjustment | Original outcome stayed intact |
| First slice | No working slice | Late working slice | Working by planned checkpoint |
| User value | Mostly internal work | Indirect improvement | User-visible or risk-reducing outcome |
| Feedback | None | Self-review only | External, behavioral, or adversarial feedback used |
| Quality | Not verified | Partial checks | Relevant tests and manual verification pass |
| Comprehension | Cannot explain key path | Partial explanation | Can explain decisions, flow, and risks |
| Handoff | Work remains ambiguous | State documented | Reviewable demo/diff with tradeoffs |

Interpretation:

- **12–14:** Strong professional rep.
- **9–11:** Useful rep; identify the single largest leak.
- **6–8:** Activity occurred, but the outcome or discipline was weak.
- **0–5:** Reset the exercise; reduce scope substantially.

## Practice rotation

Rotate these rather than always starting greenfield projects:

1. **Vertical slice:** turn a user problem into the smallest working flow.
2. **Bug hunt:** reproduce, diagnose, fix, and protect with a regression test.
3. **Design by code:** improve an interaction directly in the product and compare before/after behavior.
4. **Existing-system contribution:** understand unfamiliar code and make a narrow change without rewriting it.
5. **Feedback response:** start from a real observation and ship the smallest useful response.
6. **Subtraction:** delete, simplify, or park work while preserving the product outcome.
7. **Communication:** produce a crisp proposal, checkpoint, demo, and handoff around a small change.

At least half of all reps should modify an existing system. Greenfield work naturally flatters Chris's strengths and under-trains constraint handling.

## Leveling ladder

### Level 1: Consistent daily closure

Complete five 90–120 minute reps with honest logs and no overtime.

### Level 2: Half-day delivery

Complete three four-hour reps with a working version by hour two and a reviewable handoff by hour four.

### Level 3: SuperDay repeatability

Complete three eight-hour simulations. Score at least 11 each time, without extending the day.

### Level 4: External constraint

Complete a narrowly scoped contribution in an unfamiliar codebase or for an external reviewer. Incorporate feedback without losing the original deadline.

### Level 5: Sustainable professional cadence

Maintain three weeks of bounded delivery, with at least four closed reps per week, while preserving rest and avoiding catch-up marathons.

## Initial exercises

### EDR

Make one body transformation unmistakably visible during play. Do not add parts, rooms, progression, or supporting systems. This directly trains convergence on the current demo proof.

### PlaySesh

Implement the smallest complete arrow interaction: create, render, select, edit, delete, and test. Do not include trigger-platform or portability work in the same rep.

### y30

Choose one bounded, non-production-risk voice behavior or evaluation improvement. Keep it behind an existing flag or local harness. Do not introduce a new orchestration layer.

## Weekly review

Once per week, review `BUILDER_TRAINING_LOG.md` and answer:

1. What repeatedly delayed the first working slice?
2. What work looked productive but did not reduce the main uncertainty?
3. Where did feedback materially improve the result?
4. What did I stop or deliberately leave out?
5. What can I now explain that I could not explain last week?
6. Is the pace becoming easier to repeat, or am I borrowing energy from the next day?

Change only one training constraint for the next week.

## Ground rule

The objective is not to simulate urgency every day. It is to make disciplined delivery feel normal.
