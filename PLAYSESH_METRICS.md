# PlaySesh Metrics and Claim Policy

**Status:** Canonical evidence note
**Last verified:** August 1, 2026
**Purpose:** Prevent PlaySesh adoption metrics from being overstated or drifting across the resume, portfolio, and application materials.

Before publishing a PlaySesh adoption claim, use the values and language in this document. Generated resume or portfolio output is not a new source of truth.

## Retired claims (read this first)

Two figures that previously appeared on public surfaces have been checked against raw PostHog events and are **not supported**. Do not publish either one.

| Retired claim | Verdict | What the evidence actually shows |
| --- | --- | --- |
| 1,302 monthly active users | Not supported. Remove. | Measured peak MAU is **1,043**, in January 2026. The 1,302 figure almost certainly came from a dashboard insight that counts distinct PostHog session IDs, not users. See "Source of the false claims" below. |
| 50-minute average sessions | Not supported as written. Cut from resume and portfolio. | 52.4 minutes is the mean of sessions lasting 60 seconds or longer in the single best month (May 2026). Stating it requires three qualifiers and it rests on a 12% sample of sessions. |

Neither number may be reintroduced without new evidence recorded in this file.

## Verified Discord dashboard snapshot

Chris read these values from the PlaySesh application in the Discord Developer Portal on **August 1, 2026**:

| Discord field | Dashboard value | Canonical public expression |
| --- | ---: | --- |
| Authorization Count | 6,220 individual users | Over 6,200 authorized Discord accounts |
| Install Count, Servers | 138 servers | 138 Discord server installs |
| Install Count, Users | 67 individual users | 67 individual-user installs |

Prior snapshot, July 18, 2026, kept for history: 5,940 authorizations, 132 servers, 63 individual users.

Discord labels these counts as approximate and updates them daily. PlaySesh is in maintenance mode and still accumulating users, so the figures drift upward over time. That is why the July and August readings differ. **Any published figure must carry an "as of" date.** Preserve Discord's approximation qualifier when using exact values.

## What Discord says these fields mean

Discord's [Application Resource documentation](https://docs.discord.com/developers/resources/application) defines:

- `approximate_guild_count` as the approximate number of guilds to which the app has been added.
- `approximate_user_install_count` as the approximate number of users who installed the app with the `applications.commands` scope.
- `approximate_user_authorization_count` as the approximate number of users who have authorized the app with an OAuth2 scope.

Discord's [OAuth2 and permissions documentation](https://docs.discord.com/developers/platform/oauth2-and-permissions) explains authorization and install flows. These definitions, not the labels alone, govern how we describe the metrics.

The PlaySesh codebase has also used multiple OAuth paths:

- The embedded Discord activity requests `identify` and `guilds` in `client/contexts/DiscordInfoContext.tsx`.
- The web login requests `identify` and `email` in `client/utils/discord-auth.ts`.

Therefore, Authorization Count is best understood as the approximate number of Discord accounts that authorized PlaySesh through an OAuth flow. It is broader than installs and is not an activity metric.

## Verified PostHog engagement evidence

Computed from raw events on **August 1, 2026**. PlaySesh analytics live under a separate PostHog login from Chris's portfolio account.

### Operating window

- First event: 2025-07-25 17:40:46 UTC
- Last event: 2026-08-02 01:03:21 UTC
- Span: 373 days

PlaySesh the company started in 2024. The product shipped in July 2025. The analytics window begins at product launch, not company founding. Do not describe this as the company's operating history.

### Monthly active users

**Definition:** unique persons (`person_id`) firing the `session_started` event at least once in a UTC calendar month.

Query used:

```sql
SELECT toStartOfMonth(timestamp) AS month, uniqExact(person_id) AS mau_unique_persons
FROM events WHERE event = 'session_started' AND timestamp >= '2000-01-01'
GROUP BY month ORDER BY month ASC
```

| Month | MAU (unique persons) |
| --- | ---: |
| Dec 2025 | 791 |
| Jan 2026 | **1,043 (peak)** |
| Feb 2026 | 896 |
| Mar 2026 | 733 |
| Apr 2026 | 769 |
| May 2026 | 664 |
| Jun 2026 | 776 |
| Jul 2026 | 803 |
| Aug 2026 | 41 (partial month) |

**Critical caveat.** `session_started` events only exist from December 2025 onward. The project has events going back to July 2025, but July through November 2025 have no `session_started` data. No MAU figure may be cited for those months. If a higher peak occurred before instrumentation was added, it is unprovable and must not be claimed.

### Session length

**Definition:** a matched (`$session_id`, `session_started`, `session_ended`) triple where the same `$session_id` appears on both events and the end timestamp is later than the start.

Data quality problems, recorded so they are never quietly dropped:

- Unique `$session_id` values on `session_started`: 8,663.
- Total `session_started` events: 72,984.
- Duration analysis therefore covers roughly **12% of sessions**. That is a thin and possibly unrepresentative base.
- Only 28 of 19,486 `session_ended` events carry a `session_duration` property, so duration has to be computed from timestamps.

Distribution of all matched pairs:

| Duration bucket | Sessions | Share |
| --- | ---: | ---: |
| Under 10s | 5,899 | 69% |
| 10s to 1 min | 354 | 4% |
| 1 to 5 min | 428 | 5% |
| 5 to 30 min | 834 | 10% |
| 30 to 60 min | 508 | 6% |
| 60 min and over | 527 | 6% |

The 69% under ten seconds are tab-close and unload artifacts, not real sessions. Including them drives the overall median to 0.0 to 0.1 minutes and makes both the mean and the median meaningless.

Filtered to sessions of 60 seconds or longer, which excludes the unload artifacts:

| Month | Sessions | Mean (min) | Median (min) |
| --- | ---: | ---: | ---: |
| Dec 2025 | 323 | 53.6 | 32.7 |
| Jan 2026 | 442 | 41.4 | 26.6 |
| Feb 2026 | 299 | 42.3 | 19.5 |
| Mar 2026 | 246 | 45.8 | 16.4 |
| Apr 2026 | 251 | 37.1 | 23.1 |
| May 2026 | 212 | **52.4 (peak mean)** | 27.8 |
| Jun 2026 | 275 | 46.1 | 32.2 |
| Jul 2026 | 240 | 35.5 | 20.2 |
| Aug 2026 | 9 | 29.7 | 10.1 |

Excluding the partial August month, the median of the filtered sessions runs roughly 16 to 33 minutes depending on the month.

### Source of the false claims

The PlaySesh dashboard's "Monthly active users" insight is configured with `unique_session` math rather than `dau`. It has been counting distinct PostHog session IDs over a 30-day window and labelling the result users. That is the likely origin of the 1,302 figure: it was never a user count.

The "Daily active projects" insight has the same defect. It counts unique sessions over 24 hours, not boards.

Open remediation items in the PlaySesh PostHog project:

1. Change the "Monthly active users" insight math from `unique_session` to `dau`.
2. Change the "Daily active projects" insight to count boards rather than sessions, or rename it to state what it actually measures.

Until those are fixed, no figure read off that dashboard may be published.

## What the evidence supports

The evidence supports saying:

- Over 6,200 Discord accounts authorized PlaySesh, as of August 1, 2026.
- PlaySesh was installed in 138 Discord servers, as of August 1, 2026.
- 67 users installed PlaySesh as an individual-user app.
- Authorization reach was substantially larger than the current server-install count.
- Peak monthly active users was 1,043, in January 2026, where a monthly active user is a unique person firing `session_started` in that calendar month.

It does **not** support saying:

- PlaySesh had 6,220 active users.
- PlaySesh had 6,220 installs.
- PlaySesh had 6,220 monthly active users.
- PlaySesh had 1,302 monthly active users.
- PlaySesh had 50-minute average sessions.
- All authorized accounts used PlaySesh meaningfully or recently.
- The 138 installed servers were all active at the same time.
- 6,220 users were distributed across the 138 servers.
- Any MAU figure for July through November 2025.

Authorization, installation, and engagement are different measurements and must remain separately labeled.

## Approved wording

The two draft statements below reflect the verified evidence but are **DRAFT pending Chris's approval**. He owns final public phrasing.

### Resume (DRAFT)

Default adoption statement:

> Grew organically to over 6,200 authorized Discord accounts and 138 server installs; peaked at 1,043 monthly active users (January 2026).

If space is limited:

> Grew organically to over 6,200 authorized Discord accounts; peaked at 1,043 monthly active users.

Do not lead with the 67 individual-user installs unless the role or product story specifically concerns Discord's user-install model. Do not put session length on the resume, for the reasons in "Session length on public surfaces" below.

### Portfolio (DRAFT)

Present the measurements as separate labeled facts:

- **6,220** authorized Discord accounts
- **138** Discord server installs
- **1,043** monthly active users at peak

Use this source note:

> Discord authorization and install counts are approximate and were read on August 1, 2026. Monthly active users are from PostHog and count unique people who started a session in a calendar month; peak was January 2026.

### Session length on public surfaces

**Cut it from the resume and the portfolio.** The number cannot survive without qualifiers that do not fit on either surface, and the underlying base is 12% of sessions.

Retain it only as a spoken interview answer, where the measurement can be explained:

> Our raw session-length number was unusable. Sixty-nine percent of session-end events fired within ten seconds, which were tab-close artifacts, not sessions. Once I filtered to sessions over a minute, the median ran about 20 to 33 minutes depending on the month. I'd rather give you the method than a headline number.

### Interviews

A precise spoken explanation of adoption:

> As of August, the Discord dashboard shows about 6,220 accounts that authorized the application and 138 server installs. I treat those as reach and distribution metrics, not active usage. Separately, PostHog shows peak monthly active users of 1,043 in January 2026, counting unique people who started a session that month. Instrumentation for that event only starts in December 2025, so I don't claim anything about the first few months after launch.

If asked about a previously published figure, answer directly: the earlier 1,302 number came from a dashboard insight that was counting sessions and calling them users, it was caught and corrected, and the audited figure is 1,043.

## Separate engineering evidence

The portfolio states that Chris authored 1,147 of 1,790 PlaySesh commits and was the primary engineer. Keep this separate from adoption metrics. Commit volume is supporting evidence of implementation ownership, not a user outcome and not the lead resume metric.

## Surfaces currently needing synchronization

These files still carry the older formulation "5,120 users across 121 Discord servers" and must be updated to the verified values:

- `resume.json`
- `candidate.html`
- `llms.txt`
- `index.html`

Target values for all four: 6,220 authorized Discord accounts, 138 server installs, 1,043 peak monthly active users (January 2026), no session-length claim, and an "as of August 1, 2026" note on the Discord figures.

Do not silently replace them one at a time. All four must change in a single reviewed pass so the surfaces cannot disagree with each other.

## Provenance record (evidence task closed)

The open task to recover PostHog provenance for the 1,302 MAU and 50-minute session claims is **complete as of August 1, 2026**. The outcome was that both claims were wrong. Recorded here so the question is not reopened without new evidence.

1. **Queries used.** MAU: `uniqExact(person_id)` on `session_started`, grouped by `toStartOfMonth(timestamp)`, full query above. Session length: matched `$session_id` pairs across `session_started` and `session_ended`, duration computed from timestamps because only 28 of 19,486 end events carried `session_duration`.
2. **Date range.** All events in the project, first event 2025-07-25, last event 2026-08-02, span 373 days. `session_started` exists only from December 2025.
3. **Is 1,302 peak calendar-month MAU or rolling 30-day?** Neither. It was not a user count at all. The dashboard insight producing it used `unique_session` math, counting distinct PostHog session IDs. Measured peak calendar-month MAU is 1,043.
4. **Is 50 minutes mean or median, and how was a session defined?** As published it matched nothing reproducible. The closest real figure is 52.4 minutes, the mean of sessions of 60 seconds or longer in May 2026 alone. Medians are far lower, 16 to 33 minutes by month. Unfiltered means and medians are worthless because 69% of matched sessions are sub-ten-second unload artifacts.
5. **Date captured.** August 1, 2026, from the PlaySesh PostHog project, which sits under a separate login from Chris's portfolio PostHog account.

Standing caveats attached to this evidence:

- Duration analysis covers roughly 12% of sessions (8,663 unique session IDs on `session_started` against 72,984 `session_started` events). Treat it as directional, not precise.
- No MAU may be cited for July through November 2025. A higher pre-instrumentation peak is unprovable and must not be claimed.
- Discord counts keep rising in maintenance mode. Re-read the portal before publishing, and always attach the read date.
