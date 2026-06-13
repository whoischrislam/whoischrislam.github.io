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

    // Email — both <a href="mailto:"> and the onclick=mailto demo-request buttons.
    document.querySelectorAll('a[href^="mailto:"]').forEach(function (el) {
      el.addEventListener("click", function () {
        capture("clicked_email", { href: el.getAttribute("href"), label: (el.textContent || "").trim().slice(0, 40) });
      });
    });
    document.querySelectorAll('[onclick*="mailto:"]').forEach(function (el) {
      el.addEventListener("click", function () {
        capture("clicked_email", { source: "button", label: (el.textContent || "").trim().slice(0, 40) });
      });
    });

    /* ---- profile / external links ---- */
    document.querySelectorAll('a[href*="github.com/whoischrislam"], [onclick*="github.com/whoischrislam"]').forEach(function (el) {
      el.addEventListener("click", function () { capture("clicked_github"); });
    });
    document.querySelectorAll('a[href*="linkedin.com/in/whoischrislam"]').forEach(function (el) {
      el.addEventListener("click", function () { capture("clicked_linkedin"); });
    });
    document.querySelectorAll('a[href*="y30.ai"], [onclick*="y30.ai"]').forEach(function (el) {
      el.addEventListener("click", function () { capture("clicked_y30_site"); });
    });

    /* ---- proof engagement ---- */
    // PlaySesh demo videos (the click also swaps in the iframe, handled in script.js).
    document.querySelectorAll(".video-facade").forEach(function (el) {
      el.addEventListener("click", function () {
        capture("played_video", { project: "playsesh", video_id: el.dataset.videoId || "" });
      });
    });
    // "Read the full story" arc expansion.
    var arc = document.querySelector(".arc-more");
    if (arc) arc.addEventListener("toggle", function () { if (arc.open) capture("expanded_arc_story"); });

    // y30 Loom demo — count it when it actually scrolls into view (it's embedded, not clicked).
    var loom = document.querySelector('iframe[src*="loom.com"]');
    if (loom && "IntersectionObserver" in window) {
      var loomFired = false;
      var loomIo = new IntersectionObserver(function (entries, obs) {
        entries.forEach(function (en) {
          if (!loomFired && en.isIntersecting) { loomFired = true; capture("viewed_y30_demo"); obs.disconnect(); }
        });
      }, { threshold: 0.5 });
      loomIo.observe(loom);
    }

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
