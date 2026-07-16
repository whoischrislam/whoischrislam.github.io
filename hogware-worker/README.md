# HogWare leaderboard Worker

PostHog is the database: scores write in via `posthog.capture()` from the game, and this Worker reads them back with one HogQL query. The personal API key never leaves the Worker.

## Chris's setup checklist (~10 min, in order)

1. **Create a DEDICATED PostHog project** (e.g. "HogWare") — do not reuse the portfolio project. The API key below can read *everything* in its project; a dedicated project means it can only ever read game events. Copy the new project's **API token** (`phc_…`) and **project ID** (the number in the URL).
2. **Swap the game's token**: in `hogware.html`, replace the `KEY` in the PostHog init snippet with the new project's token, so game events land in the dedicated project. (Portfolio analytics stays on the old token, untouched.)
3. **Create a personal API key**: PostHog → Settings → Personal API keys → scope it to **Query Read only**, and only the HogWare project.
4. **Fill in `wrangler.toml`**: set `POSTHOG_PROJECT_ID` to the project ID.
5. **Deploy** (needs a Cloudflare account + `npx wrangler login` once):
   ```
   cd hogware-worker
   npx wrangler secret put POSTHOG_API_KEY   # paste the personal key
   npx wrangler deploy
   ```
6. **Wire the game**: paste the deployed Worker URL into `WORKER_URL` at the top of `hogware.js` (the game calls `WORKER_URL + "?day=" + DAY_NUM`).
7. **Verify before trusting**: play a run, submit a score, then hit the Worker URL in a browser — your handle should appear. Also try forging one in the console (`posthog.capture('hogware_score_submitted', {handle:'HAX', score: 9999, day: <today>})`) and confirm it does NOT appear (no cleared-events trail backs it).

## Design notes

- **Leaderboards are per-day**, matching the daily seed — same gauntlet, same board.
- **Plausibility gate in the query**: a score only counts if the same `distinct_id` has cleared-microgame events backing at least half of it. Console-forged captures have no trail and aggregate to nothing. This is heuristic, not cryptographic — the audience is PostHog employees, and session replay is on. They know we can see them.
- **60s edge cache** per day: a reshare spike costs one PostHog query per minute, not one per viewer. PostHog's published query rate limits should be re-checked against [their current docs](https://posthog.com/docs/api/queries) before assuming headroom — figures floating around (240/min, 2,400/hr) came from an unverified research pass.
- **The response is `[{handle, best}]` only** — no distinct_ids or event payloads leave the Worker.
