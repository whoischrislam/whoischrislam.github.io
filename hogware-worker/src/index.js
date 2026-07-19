/* HogWare leaderboard Worker.

   TWO jobs, both on Chris's own domain so ad blockers (which kill posthog-js
   in the browser for a big slice of the PostHog-savvy audience) can't break
   the board:

   - POST /  → submit a score. The Worker validates it and forwards it to
     PostHog's ingestion API SERVER-SIDE. The browser only ever talks to this
     Worker, never to PostHog directly, so a content blocker can't stop a
     score from landing. Scores still live in PostHog — the story holds.

   - GET /?day=N → read today's top 20 via one HogQL query. Reads off the
     submit event alone (its own stages_cleared property), so it doesn't
     depend on the per-clear events, which ad blockers also suppress.

   The personal API key (Query Read scope) is a Worker secret and never
   reaches a browser. Returns handle+score only — nothing else leaves here. */

function corsHeaders(origin) {
  return {
    "Access-Control-Allow-Origin": origin,
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    "Content-Type": "application/json",
  };
}

function clampInt(v, lo, hi) {
  var n = parseInt(v, 10);
  if (!isFinite(n)) return null;
  if (n < lo || n > hi) return null;
  return n;
}

export default {
  async fetch(request, env, ctx) {
    const origin = env.ALLOWED_ORIGIN || "*";
    const cors = corsHeaders(origin);

    if (request.method === "OPTIONS") return new Response(null, { headers: cors });

    /* ---------------- WRITE: POST a score ---------------- */
    if (request.method === "POST") {
      let body;
      try { body = await request.json(); } catch (e) {
        return new Response(JSON.stringify({ ok: false, error: "bad json" }), { status: 400, headers: cors });
      }

      // Validate + sanity-gate server-side. A cleared game is worth up to 4 points
      // (1 base + up to +3 bonus), so score must not exceed stages_cleared*4. This
      // won't stop a determined forger hitting the endpoint directly, but it kills
      // casual nonsense — and for a portfolio board that's the right trade: a board
      // that works for everyone beats a locked one that's empty for half the audience.
      const day = clampInt(body.day, 1, 100000);
      const score = clampInt(body.score, 0, 400);
      const cleared = clampInt(body.stages_cleared, 0, 1000);
      const loops = clampInt(body.loops_reached, 0, 1000);
      let handle = String(body.handle == null ? "" : body.handle).toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 3);
      const uid = String(body.uid == null ? "" : body.uid).slice(0, 80);

      if (day === null || score === null || cleared === null) {
        return new Response(JSON.stringify({ ok: false, error: "missing/invalid fields" }), { status: 400, headers: cors });
      }
      if (!handle) handle = "HOG";
      if (score > cleared * 4) {
        return new Response(JSON.stringify({ ok: false, error: "implausible score" }), { status: 422, headers: cors });
      }
      if (!uid) {
        return new Response(JSON.stringify({ ok: false, error: "missing uid" }), { status: 400, headers: cors });
      }

      // Forward to PostHog ingestion server-side. distinct_id = the browser's stable
      // id (posthog's own when available, else a local uuid), so replays dedup to one row.
      const ingest = (env.POSTHOG_INGEST_HOST || "https://us.i.posthog.com") + "/capture/";
      const payload = {
        api_key: env.POSTHOG_PUBLIC_KEY,
        event: "hogware_score_submitted",
        distinct_id: uid,
        properties: {
          handle: handle, day: day, score: score,
          stages_cleared: cleared, loops_reached: loops == null ? 0 : loops,
          via: "worker",
        },
      };
      const phRes = await fetch(ingest, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!phRes.ok) {
        const detail = await phRes.text();
        return new Response(JSON.stringify({ ok: false, error: "ingest failed", status: phRes.status, detail: detail.slice(0, 200) }), {
          status: 502, headers: cors,
        });
      }
      return new Response(JSON.stringify({ ok: true, handle: handle }), { headers: { ...cors, "Cache-Control": "no-store" } });
    }

    if (request.method !== "GET") {
      return new Response(JSON.stringify({ error: "GET or POST only" }), { status: 405, headers: cors });
    }

    /* ---------------- READ: GET the board ---------------- */
    const url = new URL(request.url);
    const day = parseInt(url.searchParams.get("day") || "0", 10);
    if (!day || day < 1 || day > 100000) {
      return new Response(JSON.stringify({ error: "day parameter required" }), { status: 400, headers: cors });
    }

    // 60s edge cache per day-URL: reshares hit cache, not PostHog's query API.
    const cacheKey = new Request(url.origin + "/leaderboard?day=" + day, request);
    const cache = caches.default;
    const cached = await cache.match(cacheKey);
    if (cached) return cached;

    /* Plausibility gate lives IN the query, reading the submit event's own
       stages_cleared: score must be backed by cleared*4 (the real per-clear max).
       No JOIN, no dependency on the per-clear events (which ad blockers suppress).
       One row per distinct_id (best score that browser posted), time-bounded to
       3 days so the scan never grows with history. */
    const hogql = `
      SELECT
        argMax(toString(properties.handle), toInt(properties.score)) AS handle,
        max(toInt(properties.score)) AS best
      FROM events
      WHERE event = 'hogware_score_submitted'
        AND toInt(properties.day) = ${day}
        AND toInt(properties.score) BETWEEN 1 AND 400
        AND toInt(properties.stages_cleared) * 4 >= toInt(properties.score)
        AND timestamp > now() - INTERVAL 3 DAY
      GROUP BY distinct_id
      ORDER BY best DESC
      LIMIT 20
    `;

    const phRes = await fetch(`${env.POSTHOG_HOST}/api/projects/${env.POSTHOG_PROJECT_ID}/query/`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${env.POSTHOG_API_KEY}`,
      },
      body: JSON.stringify({ query: { kind: "HogQLQuery", query: hogql } }),
    });

    if (!phRes.ok) {
      const detail = await phRes.text();
      return new Response(JSON.stringify({ error: "query failed", status: phRes.status, detail: detail.slice(0, 200) }), {
        status: 502,
        headers: { ...cors, "Cache-Control": "no-store" },
      });
    }

    const data = await phRes.json();
    const rows = (data.results || []).map((r) => ({ handle: String(r[0] || "???").slice(0, 3), best: Number(r[1] || 0) }));
    const response = new Response(JSON.stringify(rows), { headers: { ...cors, "Cache-Control": "public, max-age=60" } });
    ctx.waitUntil(cache.put(cacheKey, response.clone()));
    return response;
  },
};
