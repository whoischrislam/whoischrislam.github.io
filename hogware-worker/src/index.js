/* HogWare leaderboard Worker.
   Reads: one HogQL query against the dedicated HogWare PostHog project,
   aggregating hogware_score_submitted into a daily top-20. The personal
   API key (Query Read scope only) lives as a Worker secret and never
   reaches a browser. Responses cache for 60s (both in Cloudflare's edge
   cache and via Cache-Control), so a Slack reshare spike costs one query
   a minute, not one per view. Returns handle+score only — no distinct_id
   or anything else leaves this Worker. */

export default {
  async fetch(request, env, ctx) {
    const origin = env.ALLOWED_ORIGIN || "*";
    const cors = {
      "Access-Control-Allow-Origin": origin,
      "Access-Control-Allow-Methods": "GET, OPTIONS",
      "Cache-Control": "public, max-age=60",
      "Content-Type": "application/json",
    };
    if (request.method === "OPTIONS") return new Response(null, { headers: cors });
    if (request.method !== "GET") return new Response(JSON.stringify({ error: "GET only" }), { status: 405, headers: cors });

    const url = new URL(request.url);
    // day: the client's HogWare day number — leaderboards are per-day, like the seed.
    const day = parseInt(url.searchParams.get("day") || "0", 10);
    if (!day || day < 1 || day > 100000) {
      return new Response(JSON.stringify({ error: "day parameter required" }), { status: 400, headers: cors });
    }

    // 60s edge cache per day-URL: reshares hit cache, not PostHog's query API.
    const cacheKey = new Request(url.origin + "/leaderboard?day=" + day, request);
    const cache = caches.default;
    const cached = await cache.match(cacheKey);
    if (cached) return cached;

    /* Plausibility gate lives IN the query: a submitted score only counts if that
       same person's cleared-events trail that day backs at least half of it.
       Forged posthog.capture('hogware_score_submitted', {score: 9999}) calls have
       no trail, so they aggregate to nothing. (Scores also sanity-clamp at 400 —
       nobody legitimate is close.) */
    const hogql = `
      SELECT s.handle AS handle, max(s.score) AS best
      FROM (
        SELECT
          distinct_id,
          toString(properties.handle) AS handle,
          toInt(properties.score) AS score
        FROM events
        WHERE event = 'hogware_score_submitted'
          AND toInt(properties.day) = ${day}
          AND toInt(properties.score) BETWEEN 0 AND 400
      ) s
      JOIN (
        SELECT distinct_id, count() AS cleared
        FROM events
        WHERE event = 'hogware_microgame_cleared'
        GROUP BY distinct_id
      ) c ON c.distinct_id = s.distinct_id
      WHERE c.cleared * 2 >= s.score
      GROUP BY s.handle
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
      // Surface status, not PostHog's internals, to the client.
      return new Response(JSON.stringify({ error: "query failed", status: phRes.status, detail: detail.slice(0, 200) }), {
        status: 502,
        headers: { ...cors, "Cache-Control": "no-store" },
      });
    }

    const data = await phRes.json();
    const rows = (data.results || []).map((r) => ({ handle: String(r[0] || "???").slice(0, 3), best: Number(r[1] || 0) }));
    const response = new Response(JSON.stringify(rows), { headers: cors });
    ctx.waitUntil(cache.put(cacheKey, response.clone()));
    return response;
  },
};
