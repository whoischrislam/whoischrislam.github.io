/* Portfolio analytics — explicit hiring-funnel events on top of PostHog.
   PostHog init + UTM registration live inline in <head>; this file only wires
   DOM events. Everything no-ops cleanly when PostHog isn't configured, so the
   site behaves identically with or without a project key. */
(function () {
  "use strict";

  function ph() {
    return (!window.__phDisabled && typeof posthog !== "undefined" && posthog.capture) ? posthog : null;
  }
  function capture(event, props) {
    var p = ph();
    if (p) p.capture(event, props || {});
  }
  // Shared helper so voice-agent.js can capture through the same guard.
  window.phCapture = capture;

  function ready(fn) {
    if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", fn);
    else fn();
  }

  ready(function () {
    /* ---- conversions ---- */

    // Resume download (header link + hero button).
    document.querySelectorAll('a[download], a[href$="chris-lam-resume.pdf"]').forEach(function (el) {
      el.addEventListener("click", function () {
        capture("resume_downloaded", { location: el.closest("nav, header") ? "header" : "page" });
      });
    });

    // Email links (the mailto buttons are plain links now).
    document.querySelectorAll('a[href^="mailto:"]').forEach(function (el) {
      el.addEventListener("click", function () {
        capture("clicked_email", { href: el.getAttribute("href"), label: (el.textContent || "").trim().slice(0, 40) });
      });
    });


    /* ---- profile / external links ---- */
    document.querySelectorAll('a[href*="github.com/whoischrislam"], [onclick*="github.com/whoischrislam"]').forEach(function (el) {
      el.addEventListener("click", function () { capture("clicked_github"); });
    });
    document.querySelectorAll('a[href*="linkedin.com/in/whoischrislam"]').forEach(function (el) {
      el.addEventListener("click", function () { capture("clicked_linkedin"); });
    });

    // Links rendered later by script (world actions like "Try y30"): one delegated listener, so they count
    // whenever they exist instead of only if they were in the page at load.
    document.addEventListener("click", function (e) {
      var a = e.target.closest && e.target.closest('a[href*="y30.ai"]');
      if (a) capture("clicked_y30_site");
    });

    /* ---- proof engagement ---- */
    // Demo videos (Loom / YouTube) open from media tiles on the homepage; one event, provider-labelled.
    document.addEventListener("click", function (e) {
      var t = e.target.closest && e.target.closest(".work-tile[data-provider]");
      if (t) capture("played_video", { provider: t.dataset.provider, project: t.dataset.project || "", video_id: t.dataset.videoId || "" });
    });

    /* ---- engaged_view: the mid-funnel signal ----
       Fires once when a visitor both lingers (20s) AND reads (50% scroll). This is
       what separates a real read from a drive-by, and is the middle step of the
       hiring funnel: pageview -> engaged_view -> conversion. */
    (function () {
      var dwellOk = false, scrollOk = false, sent = false;
      function maybe() {
        if (sent || !dwellOk || !scrollOk) return;
        sent = true;
        capture("engaged_view");
      }
      setTimeout(function () { dwellOk = true; maybe(); }, 20000);
      window.addEventListener("scroll", function () {
        var h = document.documentElement.scrollHeight - window.innerHeight;
        if (h > 0 && window.scrollY / h >= 0.5) { scrollOk = true; maybe(); }
      }, { passive: true });
    })();
  });
})();
