# PlaySesh Metrics and Claim Policy

**Status:** Canonical evidence note
**Last verified:** July 18, 2026
**Purpose:** Prevent PlaySesh adoption metrics from being overstated or drifting across the resume, portfolio, and application materials.

Before publishing a PlaySesh adoption claim, use the values and language in this document. Generated resume or portfolio output is not a new source of truth.

## Verified Discord dashboard snapshot

Chris transcribed these values from the PlaySesh application in the Discord Developer Portal on July 18, 2026:

| Discord field | Dashboard value | Canonical public expression |
| --- | ---: | --- |
| Authorization Count | 5,940 individual users | Nearly 6,000 authorized Discord accounts |
| Install Count — Servers | 132 servers | Approximately 130 Discord server installs |
| Install Count — Users | 63 individual users | 63 individual-user installs |

Discord labels these counts as approximate and updates them daily. Preserve that qualification when using exact values. Rounded public expressions such as “nearly 6,000” and “approximately 130” already communicate the approximation.

## What Discord says these fields mean

Discord's [Application Resource documentation](https://docs.discord.com/developers/resources/application) defines:

- `approximate_guild_count` as the approximate number of guilds to which the app has been added.
- `approximate_user_install_count` as the approximate number of users who installed the app with the `applications.commands` scope.
- `approximate_user_authorization_count` as the approximate number of users who have authorized the app with an OAuth2 scope.

Discord's [OAuth2 and permissions documentation](https://docs.discord.com/developers/platform/oauth2-and-permissions) explains authorization and install flows. These definitions—not the labels alone—govern how we describe the metrics.

The PlaySesh codebase has also used multiple OAuth paths:

- The embedded Discord activity requests `identify` and `guilds` in `client/contexts/DiscordInfoContext.tsx`.
- The web login requests `identify` and `email` in `client/utils/discord-auth.ts`.

Therefore, Authorization Count is best understood as the approximate number of Discord accounts that authorized PlaySesh through an OAuth flow. It is broader than installs and is not an activity metric.

## What the evidence supports

The dashboard supports saying:

- Nearly 6,000 Discord accounts authorized PlaySesh.
- PlaySesh was installed in approximately 130 Discord servers.
- 63 users installed PlaySesh as an individual-user app.
- Authorization reach was substantially larger than the current server-install count.

It does **not** support saying:

- PlaySesh had 5,940 or 6,000 active users.
- PlaySesh had 5,940 or 6,000 installs.
- PlaySesh had 5,940 or 6,000 monthly active users.
- All authorized accounts used PlaySesh meaningfully or recently.
- The 132 installed servers were all active at the same time.
- 5,940 users were distributed across the 132 servers.

Authorization, installation, and engagement are different measurements and must remain separately labeled.

## Approved wording

### Resume

Use this as the default adoption statement:

> Grew PlaySesh organically to nearly 6,000 authorized Discord accounts and approximately 130 server installs.

If space is limited:

> Reached nearly 6,000 authorized Discord accounts organically.

Only after the engagement evidence below is reconfirmed may it be combined into a stronger outcome bullet:

> Reached nearly 6,000 authorized Discord accounts organically; at peak, 1,302 MAU with 50-minute average sessions.

Do not lead with the 63 individual-user installs unless the role or product story specifically concerns Discord's user-install model.

### Portfolio

Present the measurements as separate labeled facts:

- **Nearly 6,000** authorized Discord accounts
- **Approximately 130** Discord server installs
- **1,302** monthly active users at peak — pending provenance check
- **50 minutes** average session length — pending provenance check

Use this source note:

> Discord authorization and install counts are approximate as of July 2026. Engagement metrics are from PostHog during active operation.

### Interviews

A precise spoken explanation is:

> The Discord dashboard currently shows about 5,940 accounts that authorized the application and 132 server installs. I treat those as reach and distribution metrics, not active usage. Our separate PostHog analytics showed 1,302 monthly active users at peak and roughly 50-minute average sessions, which I can explain as a different measurement window.

## Engagement metrics requiring reconfirmation

The current portfolio and resume surfaces also claim:

- 1,302 monthly active users at peak.
- 50-minute average sessions.

These appear to come from PostHog during active PlaySesh operation, but their dashboard source, date range, metric definition, and supporting screenshot or export have not yet been recorded here. Until that evidence is recovered:

- Preserve the numbers; do not alter or round them.
- Mark them as pending verification in internal drafts and review reports.
- Do not combine them with the July 2026 Discord dashboard counts as if they share a measurement date.

## Separate engineering evidence

The portfolio currently states that Chris authored 1,147 of 1,790 PlaySesh commits and was the primary engineer. Keep this separate from adoption metrics. Commit volume is supporting evidence of implementation ownership, not a user outcome and not the lead resume metric.

## Surfaces currently needing synchronization

The following files contain the older formulation “5,120 users across 121 Discord servers” and must eventually be regenerated or updated from the canonical facts:

- `resume.json`
- `candidate.html`
- `llms.txt`
- `index.html`

Do not silently replace them one at a time. First verify the two PostHog engagement metrics, then update the canonical resume facts and all public surfaces in one reviewed change.

## Next evidence task

Recover a PostHog screenshot or export for the 1,302 MAU and 50-minute session claims. Record:

1. The exact dashboard/query used.
2. The reporting date range.
3. Whether 1,302 means peak calendar-month MAU or a rolling 30-day value.
4. Whether 50 minutes is mean or median session duration and how a session was defined.
5. The date the evidence was captured.

Once recorded, those claims can move from “pending verification” to approved facts in the resume compiler.
