/* PostHog bootstrap, shared by index.html and every work/*.html case study.
   Was inline in index.html only, which is why the seven case studies shipped
   uninstrumented on 2026-08-02. One copy now, so it cannot drift again.

   No DOM autocapture; session replay ON (also enable it in project settings);
   localStorage persistence for return-visit attribution without third-party
   cookies. Stays fully dark until a real project key is set. */
!function(t,e){var o,n,p,r;e.__SV||(window.posthog=e,e._i=[],e.init=function(i,s,a){function g(t,e){var o=e.split(".");2==o.length&&(t=t[o[0]],e=o[1]),t[e]=function(){t.push([e].concat(Array.prototype.slice.call(arguments,0)))}}(p=t.createElement("script")).type="text/javascript",p.crossOrigin="anonymous",p.async=!0,p.src=s.api_host.replace(".i.posthog.com","-assets.i.posthog.com")+"/static/array.js",(r=t.getElementsByTagName("script")[0]).parentNode.insertBefore(p,r);var u=e;for(void 0!==a?u=e[a]=[]:a="posthog",u.people=u.people||[],u.toString=function(t){var e="posthog";return"posthog"!==a&&(e+="."+a),t||(e+=" (stub)"),e},u.people.toString=function(){return u.toString(1)+".people (stub)"},o="init capture register register_once register_for_session unregister unregister_for_session getFeatureFlag getFeatureFlagPayload isFeatureEnabled reloadFeatureFlags updateEarlyAccessFeatureEnrollment getEarlyAccessFeatures on onFeatureFlags onSessionId getSurveys getActiveMatchingSurveys renderSurvey canRenderSurvey getNextSurveyStep identify setPersonProperties group resetGroups setPersonPropertiesForFlags resetPersonPropertiesForFlags setGroupPropertiesForFlags resetGroupPropertiesForFlags reset get_distinct_id getGroups get_session_id get_session_replay_url alias set_config startSessionRecording stopSessionRecording sessionRecordingStarted captureException loadToolbar get_property getSessionProperty createPersonProfile opt_in_capturing opt_out_capturing has_opted_in_capturing has_opted_out_capturing clear_opt_in_out_capturing debug".split(" "),n=0;n<o.length;n++)g(u,o[n]);e._i.push([i,s,a])},e.__SV=1)}(document,window.posthog||[]);
(function () {
  var KEY = "phc_wJ87u3UDqx4AokJzKguRM9jXR7YkQRJFKLoS6nPeEg5P"; // PostHog project token (public, write-only)
  if (KEY.indexOf("YOUR_") === 0) { window.__phDisabled = true; return; } // not configured yet: stay dark
  // Self-exclusion: visit ?notrack=1 once on any device to keep your own visits and
  // tests out of the data (persists per browser); ?track=1 re-enables. Opted-out
  // browsers never init PostHog at all: no pageview, no events, no recording.
  try {
    var qp = new URLSearchParams(location.search);
    if (qp.get("notrack") === "1") { localStorage.setItem("ph_optout", "1"); alert("Analytics is now OFF on this browser. Your visits won't be recorded."); }
    if (qp.get("track") === "1") { localStorage.removeItem("ph_optout"); alert("Analytics is now ON for this browser."); }
    if (localStorage.getItem("ph_optout") === "1") { window.__phDisabled = true; return; }
  } catch (e) {}
  posthog.init(KEY, {
    api_host: "https://us.i.posthog.com",
    defaults: "2026-01-30",
    autocapture: false,
    disable_session_recording: false,
    persistence: "localStorage"
  });
  // Register outbound campaign tags as super properties so EVERY event carries
  // attribution. Person-property breakdowns don't work under identified_only
  // (anonymous visitors get no person profile), so super properties are how a
  // UTM-tagged outreach link stays attached through to the conversion event.
  try {
    var q = new URLSearchParams(window.location.search), utm = {};
    ["utm_source", "utm_medium", "utm_campaign", "utm_term", "utm_content"].forEach(function (k) {
      var v = q.get(k); if (v) utm[k] = v;
    });
    if (Object.keys(utm).length) posthog.register(utm);
  } catch (e) {}
})();
