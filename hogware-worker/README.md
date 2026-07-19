# HogWare leaderboard Worker

This Cloudflare Worker gives HogWare a leaderboard whose source of truth is PostHog.

The browser talks only to the Worker for leaderboard reads and writes. That keeps the board working when a content blocker prevents the PostHog browser library from loading.

## Request flow

### Submit a score

`POST /` accepts:

```json
{
  "handle": "HOG",
  "day": 12,
  "score": 24,
  "stages_cleared": 9,
  "loops_reached": 2,
  "uid": "browser-stable-id"
}
```

The Worker:

1. normalizes the handle to three uppercase letters or numbers
2. validates numeric ranges and requires a browser ID
3. rejects a score above `stages_cleared * 4`, the game's scoring ceiling
4. sends `hogware_score_submitted` to PostHog's ingestion API from the server

The plausibility rule is intentionally lightweight. It prevents casual forged scores but is not a cryptographic proof of play.

### Read a daily board

`GET /?day=N` runs one HogQL query and returns:

```json
[
  { "handle": "HOG", "best": 24 }
]
```

The query keeps the best score for each browser ID, applies the same scoring ceiling, returns the top 20, and scans only the last three days. Results are cached at the edge for 60 seconds.

Only the handle and score leave the Worker. Browser IDs and event payloads are not included in the response.

## Configuration

Public configuration lives in `wrangler.toml`:

- `POSTHOG_HOST`: PostHog app host used for HogQL queries
- `POSTHOG_PROJECT_ID`: dedicated HogWare project ID
- `ALLOWED_ORIGIN`: production GitHub Pages origin
- `POSTHOG_INGEST_HOST`: PostHog event ingestion host
- `POSTHOG_PUBLIC_KEY`: public, write-only project token

The personal API key must be stored as a Worker secret:

```sh
cd hogware-worker
npx wrangler secret put POSTHOG_API_KEY
```

Use a dedicated PostHog project and scope the personal key to Query Read for that project only. Never put the personal key in HTML, JavaScript, documentation, or `wrangler.toml`.

## Deploy

```sh
cd hogware-worker
npx wrangler deploy
```

The deployed URL is configured as `WORKER_URL` in `hogware.js`.

## Verify

1. Play a real run and submit a score.
2. Open `https://hogware-leaderboard.whoischrislam.workers.dev/?day=<current-day-number>` and confirm the handle appears.
3. Send a test POST whose score exceeds `stages_cleared * 4` and confirm the Worker returns HTTP 422 with `implausible score`.
4. Confirm the browser still receives `[{handle, best}]` when the PostHog browser script is blocked.
5. Visit the game with `?notrack=1` and confirm the UI explains that the score will not be submitted.

Rotate the Query Read personal key after the application package ships.
