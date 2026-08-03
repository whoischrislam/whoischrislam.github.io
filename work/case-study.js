/* Case-study read tracking.

   A pageview alone cannot answer the only question worth asking about these pages:
   does anyone actually read one? Depth milestones plus dwell time separate a
   recruiter who skimmed the outcome block from a hiring manager who reached the
   retro at the bottom. Fires at most once per milestone per pageview.

   Depends on analytics-init.js having run (window.posthog). No-ops without it. */
(function () {
  "use strict";

  function capture(event, props) {
    if (window.__phDisabled || typeof posthog === "undefined" || !posthog.capture) return;
    posthog.capture(event, props || {});
  }

  var slug = (location.pathname.split("/").pop() || "index").replace(/\.html$/, "");
  var started = Date.now();
  var hit = {};

  function seconds() { return Math.round((Date.now() - started) / 1000); }

  function depth() {
    var doc = document.documentElement;
    var scrollable = doc.scrollHeight - window.innerHeight;
    if (scrollable <= 0) return 100; // page shorter than the viewport: it is all visible
    return Math.min(100, Math.round((window.scrollY / scrollable) * 100));
  }

  function check() {
    var d = depth();
    [25, 50, 75, 100].forEach(function (m) {
      if (d >= m && !hit[m]) {
        hit[m] = true;
        capture("case_study_depth", { case_study: slug, depth: m, seconds: seconds() });
      }
    });
  }

  var ticking = false;
  window.addEventListener("scroll", function () {
    if (ticking) return;
    ticking = true;
    window.requestAnimationFrame(function () { check(); ticking = false; });
  }, { passive: true });

  // Outbound clicks from a case study: back to the site, or straight to email.
  document.addEventListener("click", function (e) {
    var a = e.target.closest && e.target.closest("a");
    if (!a) return;
    var href = a.getAttribute("href") || "";
    if (href.indexOf("mailto:") === 0) {
      capture("clicked_email", { location: "case_study", case_study: slug });
    } else if (href.indexOf("../index.html") === 0 || href === "../") {
      capture("case_study_exit_to_index", { case_study: slug, depth: depth(), seconds: seconds() });
    }
  });

  // Final read summary. visibilitychange is the reliable one on mobile, where
  // pagehide/unload are unreliable; sendBeacon keeps it from being dropped.
  document.addEventListener("visibilitychange", function () {
    if (document.visibilityState !== "hidden" || hit.__done) return;
    hit.__done = true;
    capture("case_study_read", { case_study: slug, max_depth: depth(), seconds: seconds() });
  });

  capture("case_study_opened", { case_study: slug });
  check(); // short pages, or a deep link that lands mid-page
})();
