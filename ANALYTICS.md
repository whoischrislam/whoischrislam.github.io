# Portfolio analytics

PostHog, instrumented for one job: **tell whether outbound effort turns into engaged recruiter attention, and where that attention drops off.** Not vanity traffic. Every event maps to a decision I'd actually make during the job hunt.

## What we measure and why

The funnel is three steps, read on **unique users** and **absolute counts** (traffic is small — percentages and trend lines will lie):

```
pageview  ->  engaged_view  ->  conversion
 (landed)     (actually read)    (resume / email / opened the agent)
```

- **pageview** — auto-captured. Carries UTM tags (see attribution) so I can split by outreach campaign.
- **engaged_view** — fires once when a visitor both lingers (20s) and reads (50% scroll). This is the line between a drive-by and a real read. It's the single most useful signal on the site.
- **conversion** — any of `clicked_booking`, `resume_downloaded`, `clicked_email`, `opened_voice_agent`. These are not equal. `clicked_booking` is the only one where someone has decided to talk; the rest are interest. Read it separately, never averaged into the others.

The voice agent is the centerpiece work sample, so it has its own sub-funnel:

```
opened_voice_agent -> voice_agent_lens_selected -> voice_agent_first_message -> voice_agent_brief_requested -> voice_agent_brief_generated
```

That tells me not just "did they click the agent" but "did they pick a lens, ask something, and value it enough to pull a brief."

### Event reference

| Event | Where | Why it matters |
|---|---|---|
| `$pageview` | auto | Volume + referrer + UTM attribution |
| `engaged_view` | analytics.js | Real read vs bounce — mid-funnel |
| `clicked_booking` | analytics.js | **Strongest conversion.** Picked a time, not just showed interest (`location`: hero/contact) |
| `resume_downloaded` | analytics.js | Hard conversion |
| `clicked_email` | analytics.js | Hard conversion (incl. demo-request buttons) |
| `clicked_github` / `clicked_linkedin` | analytics.js | Credential checks |
| `clicked_y30_site` | analytics.js | Deep interest in current work |
| `played_video` | analytics.js | PlaySesh proof consumed |
| `viewed_y30_demo` | analytics.js | y30 Loom demo scrolled into view |
| `expanded_arc_story` | analytics.js | Read the long-form narrative |
| `opened_voice_agent` | voice-agent.js | Agent funnel entry (`location`: hero/contact/launcher) |
| `voice_agent_lens_selected` | voice-agent.js | Who's asking (`lens`) |
| `voice_agent_first_message` | voice-agent.js | Actually engaged (`input_type`: text/voice) |
| `voice_agent_brief_requested` | voice-agent.js | High intent |
| `voice_agent_brief_generated` | voice-agent.js | Brief delivered (client-observed server success) |

## Attribution: UTM, not referrer

Most email clients and messaging apps strip the HTTP referrer, so referrer-based attribution shows cold-email and intro traffic as "direct." **Tag every link you send.** Example:

```
https://whoischrislam.github.io/?utm_source=email&utm_medium=outreach&utm_campaign=acme_jane
```

The init in `index.html` reads `utm_*` from the URL and registers them as PostHog **super properties**, so they ride on every event in the session — including conversions. (Person-property breakdowns don't work here because `person_profiles` is `identified_only`; anonymous visitors get no profile. Super properties are the workaround.)

Keep UTM naming consistent: `utm_medium=email` for cold email, `utm_medium=intro` for warm intros, `utm_medium=social` for LinkedIn/X, `utm_campaign=<company_or_person>`.

## Frontend / backend split

**The frontend (`whoischrislam.github.io`) is the analytics surface. The backend (`portfolio-voice-backend`) stays clean.**

- The browser observes the entire journey — page, scroll, every CTA, and all voice-agent interaction (open, lens, message, brief). One PostHog project, one `distinct_id`, `localStorage` persistence. That covers ~95% of what matters.
- The backend Worker is deliberately "dumb plumbing's" counterpart: it holds judgment (prompt, grounding, safety) but **no analytics**. The brief funnel is captured client-side — `voice_agent_brief_requested` on click, `voice_agent_brief_generated` when the server's brief actually renders — so we get the brief outcome without a server-side PostHog dependency, a new Worker secret, or identity-stitching.

**When to add backend events (not yet):** only if I later want server-truth the client can't see — cost per conversation, error/rate-limit rates, safety-layer triggers. The pattern then: the frontend sends `posthog.get_distinct_id()` in the request body; the Worker POSTs to PostHog's `/capture/` with that same `distinct_id` so events stitch to one person. Until there's a question only the server can answer, this stays out — smallest reversible step.

## Excluding your own visits and tests

Visit **`whoischrislam.github.io/?notrack=1`** once on each device/browser you use to test. That browser then never initializes PostHog again — no pageview, no events, no recording — so you stay out of the real data. An alert confirms it worked. `?track=1` re-enables. The choice persists in that browser's `localStorage`, so it survives across visits but not across fresh-incognito or cleared storage (re-run the link if you reset those). This is the travel-proof alternative to IP filtering, which breaks the moment your IP changes.

For data already collected before you opted out (e.g. the Jun 13 setup tests), just start your dashboard date range the next day, or exclude those distinct_ids when building insights.

## Privacy posture

- No DOM autocapture (only the deliberate events above). `localStorage` persistence (no third-party cookies). No cookie banner needed for a personal portfolio with no EU establishment; the trade-off vs `memory` persistence is that `localStorage` keeps return-visit identity, which is the whole point.
- **Session replay is ON** (enabled in both the SDK config and PostHog project settings). PostHog masks form inputs by default, so text typed into the agent shows as asterisks — but the rendered agent conversation (visible Q&A text on the page) IS captured in the replay. That's fine here (it's Chris's own agent talking about Chris), just be aware. Replay consumes more free-tier quota than plain events; for portfolio traffic that's a non-issue. Turn off by setting `disable_session_recording: true` in both HTML files.
- Email subjects/bodies are not captured — only that a mail link was clicked.

## Setup (one-time)

1. Create a PostHog Cloud project (US region).
2. Replace `YOUR_POSTHOG_PROJECT_KEY` with the project API key (public, write-only — safe to commit) in **both `index.html` and `candidate.html`**. Until then the site stays fully dark: no script loads, no events. (`grep -rl YOUR_POSTHOG_PROJECT_KEY .` finds every spot.)
3. In PostHog, build the **Portfolio — Hiring Funnel** dashboard: the 3-step funnel above (unique users), a table on `utm_campaign` / `utm_source`, the agent sub-funnel, and a bar of proof events (`viewed_y30_demo`, `played_video`, `expanded_arc_story`).

## Weekly operating loop (5 min)

1. After each batch of outreach, check the `utm_campaign` table 24–48h later — did the link actually land sessions? Zero sessions = fix the email/CTA, not the site.
2. `engaged_view / pageview` low → the page isn't holding people; fix the hero.
3. `opened_voice_agent` high but `voice_agent_first_message` low → people open the agent and bounce; fix the intro prompt.
4. `resume_downloaded` happening but `clicked_booking` near zero → they like the credentials but won't start a conversation; fix the contact CTA. This fired for real: over the 60 days to 2026-08-01, 16 people downloaded the resume and 2 clicked email. The booking link went in on 2026-08-01 as the response, so treat that date as the baseline for judging whether it worked.

Don't let it become a side project. Five minutes, four checks.
