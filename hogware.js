/* ============================================================
   HogWare — five PostHog values, five microgames, one run.
   One shared engine; each microgame is a config object so future
   variants (cosmetic or mechanic) are params + a small delta,
   never a rewrite. Vanilla JS, DOM/SVG scenes, no build step.
   ============================================================ */
(function () {
  "use strict";

  /* ---------------- PostHog guard (same pattern as analytics.js) ---------------- */
  function ph() {
    return (!window.__phDisabled && typeof posthog !== "undefined" && posthog.capture) ? posthog : null;
  }
  function capture(event, props) {
    var p = ph();
    if (p) p.capture(event, props || {});
  }

  /* ---------------- Leaderboard endpoint ----------------
     Cloudflare Worker (source: hogware-worker/) that runs a HogQL query over
     hogware_score_submitted with a Query-Read-only personal API key held
     server-side. Daily top-20, plausibility-gated, 60s edge cache. */
  var WORKER_URL = "https://hogware-leaderboard.whoischrislam.workers.dev";

  /* ---------------- Tunables ---------------- */
  var VERB_MS = 950;           // verb card hold
  var RESULT_MS = 850;         // pass/fail flash
  var QUOTE_MS = 2600;         // interstitial quote (press to skip)
  var SPEED_DECAY = 0.86;      // per-loop timer multiplier
  var SPEED_FLOOR = 0.5;
  var LIVES = 3;               // classic NES count (Chris's call); sudden death killed runs before players saw all 5 values

  /* ---------------- Daily seed ----------------
     Everyone gets the same gauntlet on the same (local) day, so scores are
     comparable and the emoji result reads like "today's run" — the Wordle
     mechanic. Retrying the same day replays the same seed on purpose. */
  var HW_EPOCH = new Date(2026, 6, 15); // launch day = HogWare #1 (local time)
  var _now = new Date();
  var _todayMidnight = new Date(_now.getFullYear(), _now.getMonth(), _now.getDate());
  var DAY_NUM = Math.max(1, Math.round((_todayMidnight - HW_EPOCH) / 86400000) + 1);
  // ?day=N pins the seed (deterministic tests, replaying a past day) — harmless: it
  // only picks which daily gauntlet you play, and the leaderboard is already per-day.
  try {
    var _dq = parseInt(new URLSearchParams(location.search).get("day"), 10);
    if (_dq >= 1 && _dq <= 100000) DAY_NUM = _dq;
  } catch (e) {}
  function mulberry32(a) {
    return function () {
      a |= 0; a = a + 0x6D2B79F5 | 0;
      var t = Math.imul(a ^ a >>> 15, 1 | a);
      t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
      return ((t ^ t >>> 14) >>> 0) / 4294967296;
    };
  }

  /* Feature-flag hook (flag not created in the dashboard yet — safe default until it is).
     'brisk' variant starts runs 15% faster; controls nothing else. */
  var paceVariant = "default";
  (function () {
    var p = ph();
    if (p && p.onFeatureFlags) {
      p.onFeatureFlags(function () {
        try { paceVariant = p.getFeatureFlag("hogware-pace") || "default"; } catch (e) {}
      });
    }
  })();

  /* ---------------- Real handbook quotes (posthog.com/handbook/values, verbatim) ---------------- */
  var QUOTES = [
    { value: "You're the driver", text: "“We hire people that are really great at their jobs, and get out of their way.”" },
    { value: "Make it public", text: "“We default to transparency with everything we work on.”" },
    { value: "Do more weird", text: "“We aren't weird for the sake of it. We want the company perfectly optimized for our strategy.”" },
    { value: "Why not now?", text: "“You do not need consensus to do things.”" },
    { value: "Optimistic by default", text: "“Aiming for the best possible upside and sometimes missing is much better than never trying.”" }
  ];
  /* Session-replay nod — only shown when analytics is actually on. */
  var REPLAY_QUOTE = { value: "Make it public", text: "psst — this run is being session-replayed. Transparency goes both ways." };

  /* ---------------- DOM handles ---------------- */
  var $ = function (id) { return document.getElementById(id); };
  function valueSlug(s) { // "Why not now?" -> "why-not-now"
    return s.toLowerCase().replace(/'/g, "").replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
  }
  var stage = $("hw-stage"), scene = $("hw-scene"), hud = $("hw-hud");
  var timerFill = $("hw-timer-fill");
  var screens = {
    title: $("hw-titlescreen"), verb: $("hw-verb"), result: $("hw-result"),
    quote: $("hw-quote"), gameover: $("hw-gameover")
  };

  function show(el) { el.classList.remove("hw-hidden"); }
  function hide(el) { el.classList.add("hw-hidden"); }
  function hideAllScreens() {
    Object.keys(screens).forEach(function (k) { hide(screens[k]); });
    hide(scene);
  }
  function visibleScreen() {
    if (!scene.classList.contains("hw-hidden")) return scene;
    for (var k in screens) { if (!screens[k].classList.contains("hw-hidden")) return screens[k]; }
    return null;
  }

  /* ---- WarioWare-style zoom swap, quantized to the next beat ----
     Dramatic on purpose (Chris: start extreme, dial back) — tune these two.
     prefers-reduced-motion gets the old instant cut. Feedback screens never
     route through here; only forward-looking starts do. */
  // Cinematic CRT transition: outgoing image collapses to a bright horizontal
  // line (tube powering down), swap at the line, incoming blooms back open.
  var COLLAPSE_MS = 230, BLOOM_MS = 400;
  var transitioning = false;
  function crtBlip(kind) { // "hw-poweron" only now — the run-start tube wake-up
    if (reducedMotion) return;
    var f = $("hw-flash");
    if (!f) return;
    f.classList.remove("hw-poweron");
    void f.offsetWidth;
    f.classList.add(kind);
  }
  function swapScreens(toEl, prep, done) {
    var fromEl = visibleScreen();
    if (reducedMotion) {
      hideAllScreens();
      if (prep) prep();
      show(toEl);
      if (done) done();
      return;
    }
    transitioning = true;
    // Two transition vocabularies:
    //  • MAXIMIZE / RESTORE  — launching a program (desktop⇄microgame): the window
    //    grows to fill the screen, the game plays inside it, then restores back.
    //  • CRT power-cycle      — the machine changing state (boot, announcements,
    //    game over): the tube collapses to a line and blooms the next screen open.
    var effect =
      fromEl === screens.title ? "boot" :
      (fromEl === screens.verb && toEl === scene) ? "maximize" :
      (toEl === screens.verb) ? "restore" : "crt";

    conductor.nextBeat(function () {
      var reveal = function (inClass, inMs) {
        hideAllScreens();
        if (fromEl) fromEl.classList.remove("hw-crt-collapse", "hw-shrink-out");
        var appwin = screens.verb.querySelector(".hw-appwin");
        if (appwin) appwin.classList.remove("hw-appwin-maximize");
        if (prep) prep();
        show(toEl);
        toEl.classList.add(inClass);
        void toEl.offsetWidth;
        toEl.classList.add(inClass + "-go");
        setTimeout(function () {
          toEl.classList.remove(inClass, inClass + "-go");
          transitioning = false;
          if (done) done();
        }, inMs);
      };

      if (effect === "boot") { reveal("hw-crt-bloom", BLOOM_MS); return; }

      if (effect === "maximize") {
        // The program window rushes up to fill the screen, then the game blooms in inside it.
        screens.verb.querySelector(".hw-appwin").classList.add("hw-appwin-maximize");
        setTimeout(function () { reveal("hw-scale-in", 300); }, 240);
        return;
      }
      if (effect === "restore") {
        // The game shrinks back down and the desktop restores.
        if (fromEl) fromEl.classList.add("hw-shrink-out");
        setTimeout(function () { reveal("hw-restore-in", 300); }, 200);
        return;
      }
      // crt: collapse the tube to a line, bloom the next screen open
      if (fromEl) fromEl.classList.add("hw-crt-collapse");
      setTimeout(function () { reveal("hw-crt-bloom", BLOOM_MS); }, COLLAPSE_MS);
    });
  }

  var reducedMotion = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  function shake() {
    if (reducedMotion) return;
    stage.classList.remove("hw-shaking");
    void stage.offsetWidth; // restart animation
    stage.classList.add("hw-shaking");
  }

  /* ---------------- Conductor ----------------
     The beat clock behind the seamless feel. It aligns STARTS (next verb card
     lands on a beat) — it never stretches durations and never gates feedback
     (adversarial-review finding: beat-gating the result flash created dead air
     and broke tuned timings). Runs off the audio clock when unlocked, falls
     back to performance.now() when muted/locked — gameplay is identical either
     way because no game logic listens to it. */
  var audioCtx = null;
  var conductor = (function () {
    var BPM = 120, baseBeatMs = 60000 / BPM; // 500ms at rate 1
    var rate = 1, anchor = 0, timer = null, subs = [];
    var unlocked = false, muted = false;
    try { muted = localStorage.getItem("hogware_muted") === "1"; } catch (e) {}
    /* Real audio: ElevenLabs assets decoded to buffers. Music is a sample-exact
       16.000s WAV loop (8 bars @ 120 BPM); playbackRate mirrors game speed, so
       SPEED UP! pitches it up — the WarioWare chipmunk effect, for free. Stings
       replace the synth blips when loaded; the synth stays as fallback. */
    var buffers = {}, masterGain = null, musicGain = null, sfxGain = null, musicSrc = null, loadKicked = false;
    var STING_NAMES = ["pass", "fail", "tick", "verb", "over", "level", "whiff"];
    function ensureGraph() {
      if (!audioCtx || masterGain) return;
      masterGain = audioCtx.createGain();
      masterGain.gain.value = muted ? 0 : 1;
      masterGain.connect(audioCtx.destination);
      musicGain = audioCtx.createGain();
      musicGain.gain.value = 0.45;
      musicGain.connect(masterGain);
      sfxGain = audioCtx.createGain();
      sfxGain.gain.value = 0.9;
      sfxGain.connect(masterGain);
    }
    function now() { return (unlocked && audioCtx) ? audioCtx.currentTime * 1000 : performance.now(); }
    function beatMs() { return baseBeatMs / rate; }
    function nextBeatAt() {
      var t = now(), b = beatMs();
      return anchor + Math.ceil((t - anchor) / b + 1e-6) * b;
    }
    function tick() {
      var t = now();
      for (var i = subs.length - 1; i >= 0; i--) {
        if (t >= subs[i].at) { var fn = subs[i].fn; subs.splice(i, 1); try { fn(); } catch (e) {} }
      }
    }
    return {
      start: function (r) { // new run: fresh anchor, fresh subscriptions, scheduler on
        rate = Math.min(2, Math.max(1, r || 1));
        subs = [];
        anchor = now();
        if (!timer) timer = setInterval(tick, 25);
      },
      stop: function () { subs = []; if (timer) { clearInterval(timer); timer = null; } },
      setRate: function (r) {
        anchor = nextBeatAt();
        rate = Math.min(2, Math.max(1, r));
        conductor.syncMusicRate(); // the loop pitches up with the game — the chipmunk speed-up
      },
      nextBeat: function (fn) { if (!timer) return fn(); subs.push({ at: nextBeatAt(), fn: fn }); },
      beatMs: beatMs,
      unlock: function () { // must come from a user gesture (iOS: touchend/click, not touchstart)
        try {
          if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
          audioCtx.resume().then(function () { unlocked = true; anchor = now(); });
        } catch (e) {}
      },
      resumeIfInterrupted: function () { // iOS moves the ctx to "interrupted" on tab-away
        if (audioCtx && unlocked && audioCtx.state !== "running") {
          try { audioCtx.resume().then(function () { anchor = now(); }); } catch (e) {} // drop missed beats, never replay
        }
      },
      isMuted: function () { return muted; },
      setMuted: function (m) {
        muted = m;
        try { localStorage.setItem("hogware_muted", m ? "1" : "0"); } catch (e) {}
        if (masterGain) masterGain.gain.value = m ? 0 : 1;
        if (!m && run && !musicSrc) conductor.startMusic(); // unmuting mid-run brings the band back in
      },
      loadAssets: function () {
        // Lazy, once, post-gesture, http(s) only (file:// fetches just error-spam the console).
        if (loadKicked || !audioCtx || location.protocol === "file:") return;
        loadKicked = true;
        ensureGraph();
        var load = function (name, url) {
          fetch(url).then(function (r) { return r.arrayBuffer(); })
            .then(function (ab) { return audioCtx.decodeAudioData(ab); })
            .then(function (buf) {
              buffers[name] = buf;
              // If the music arrives mid-run, join in without waiting for the next run.
              if (name === "music" && run && !musicSrc) conductor.startMusic();
            })
            .catch(function () {}); // failed load = synth blips keep covering; never breaks the game
        };
        load("music", "audio/hogware/music.wav");
        STING_NAMES.forEach(function (n) { load(n, "audio/hogware/" + n + ".m4a"); });
      },
      playSting: function (kind) {
        if (muted || !audioCtx || !buffers[kind]) return false;
        ensureGraph();
        var src = audioCtx.createBufferSource();
        src.buffer = buffers[kind];
        src.connect(sfxGain);
        src.start();
        // Duck the music a touch so stings read over it, then recover.
        if (musicSrc && musicGain) {
          var t = audioCtx.currentTime;
          musicGain.gain.setTargetAtTime(0.28, t, 0.02);
          musicGain.gain.setTargetAtTime(0.45, t + 0.15, 0.08);
        }
        return true;
      },
      startMusic: function () {
        if (muted || !audioCtx || !buffers.music || musicSrc) return;
        ensureGraph();
        musicGain.gain.cancelScheduledValues(0);
        musicGain.gain.value = 0.45; // instant PLAY AGAIN mustn't inherit the previous fade-out
        musicSrc = audioCtx.createBufferSource();
        musicSrc.buffer = buffers.music;
        musicSrc.loop = true;
        musicSrc.loopStart = 0;
        musicSrc.loopEnd = 16.0; // 8 bars @ 120 BPM, sample-exact
        musicSrc.playbackRate.value = rate;
        musicSrc.connect(musicGain);
        musicSrc.start();
      },
      stopMusic: function () {
        if (!musicSrc) return;
        var src = musicSrc;
        musicSrc = null;
        try {
          if (musicGain && audioCtx) {
            musicGain.gain.setTargetAtTime(0, audioCtx.currentTime, 0.08); // brief fade, no click
            setTimeout(function () { try { src.stop(); } catch (e) {} if (musicGain) musicGain.gain.value = 0.45; }, 350);
          } else { src.stop(); }
        } catch (e) {}
      },
      syncMusicRate: function () { if (musicSrc) musicSrc.playbackRate.value = rate; }
    };
  })();
  document.addEventListener("visibilitychange", function () {
    if (document.hidden) {
      // Pause the whole audio graph with the tab: the game's rAF clock freezes, and
      // music playing over a frozen game reads as broken. Resume re-anchors the beat.
      if (audioCtx && audioCtx.state === "running") { try { audioCtx.suspend(); } catch (e) {} }
    } else {
      conductor.resumeIfInterrupted();
    }
  });

  /* ---------------- Tiny SFX stub ----------------
     Placeholder blips until the ElevenLabs files land in /audio/hogware/.
     Swap the synth body for buffer playback then (slots: pass/fail/tick/verb/over/level/whiff). */
  function sfx(kind) {
    if (conductor.isMuted()) return;
    if (conductor.playSting(kind)) return; // real ElevenLabs sting when loaded; synth below as fallback
    try {
      if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
      var o = audioCtx.createOscillator(), g = audioCtx.createGain();
      var f = { pass: 660, fail: 140, tick: 880, verb: 440, over: 220, level: 990, whiff: 260 }[kind] || 440;
      o.frequency.value = f;
      o.type = kind === "fail" ? "sawtooth" : "sine";
      g.gain.setValueAtTime(0.06, audioCtx.currentTime);
      g.gain.exponentialRampToValueAtTime(0.0001, audioCtx.currentTime + 0.18);
      o.connect(g); g.connect(audioCtx.destination);
      o.start(); o.stop(audioCtx.currentTime + 0.2);
    } catch (e) {}
  }

  /* ---------------- Placeholder hedgehog (coded SVG until the real mascot lands) ---------------- */
  function hedgehogSVG(size) {
    return '<svg width="' + size + '" height="' + size + '" viewBox="0 0 40 40" aria-hidden="true">' +
      '<path d="M20 6l3 6-6 0zM11 9l4 4-6 2zM29 9l2 6-6-2zM6 17l6 1-4 5zM34 17l-2 6-4-5z" fill="var(--accent)"/>' +
      '<circle cx="20" cy="22" r="12" fill="var(--accent)"/>' +
      '<circle cx="16" cy="20" r="1.8" fill="var(--bg)"/>' +
      '<circle cx="24" cy="20" r="1.8" fill="var(--bg)"/>' +
      '<ellipse cx="20" cy="26" rx="2.4" ry="1.6" fill="var(--bg)"/>' +
      '</svg>';
  }

  /* ============================================================
     THE FIVE MICROGAMES
     Contract: { id, value, verb, input, baseDurationMs, params,
                 setup(ctx), update(ctx, dt), onPress(ctx, e), onRelease(ctx),
                 onTimeout(ctx) }  — win/lose by calling ctx.win(flavor, bonus)
     or ctx.fail(flavor). `input` is documentation + router hint:
     'click' games get pointer events on scene elements; 'space'
     games get a unified press (spacebar OR tap) via onPress/onRelease.
     ============================================================ */

  /* ---- 1. YOU'RE THE DRIVER — "DRIVE!" (hold space) ----
     The quote is "we get out of their way" — traffic bails out of your lane
     before you reach it. From L2, one STALL car only notices you once you
     stop: hold into it and you crash; release, let it clear, resume. Obstacle
     positions are seeded-jittered per play so no two loops read identical. */
  var gameDrive = {
    id: "drive", value: "You're the driver", verb: "DRIVE!", input: "space",
    baseDurationMs: 4200,
    params: { travelMs: 2600, obstacles: [0.3, 0.55, 0.78], hesitateIdx: -1, stallIdx: -1 },
    levels: [
      {},
      { travelMs: 2600, obstacles: [0.25, 0.48, 0.68, 0.84], stallIdx: 1, durationMs: 4800 },
      { travelMs: 2600, obstacles: [0.25, 0.48, 0.68, 0.84], stallIdx: 1, hesitateIdx: 3, durationMs: 4800 }
    ],
    setup: function (ctx) {
      ctx.state.holding = false;
      ctx.state.x = 0; // 0..1 progress toward the flag
      ctx.state.noticeAt = null;
      // Your car speeds up with the run's speed-ups (half-rate) — the clock shrinks,
      // so travel must too, or deep loops become mathematically unwinnable.
      ctx.state.travelMs = ctx.params.travelMs * (0.55 + 0.45 * run.speed);
      // Stall car takes a random slot (never the first — no time to react to it),
      // so knowing "it's always the middle one" stops working after loop 2.
      var stallAt = ctx.params.stallIdx >= 0 ? 1 + Math.floor(run.rng() * (ctx.params.obstacles.length - 1)) : -1;
      var hesitateAt = -1;
      if (ctx.params.hesitateIdx >= 0) {
        hesitateAt = 1 + Math.floor(run.rng() * (ctx.params.obstacles.length - 1));
        if (hesitateAt === stallAt) hesitateAt = (stallAt % (ctx.params.obstacles.length - 1)) + 1;
      }
      // Seeded jitter so the road differs loop to loop (but is identical for everyone today).
      ctx.state.cars = ctx.params.obstacles.map(function (frac, i) {
        return {
          frac: Math.min(0.9, Math.max(0.15, frac + (run.rng() - 0.5) * 0.08)),
          type: i === stallAt ? "stall" : (i === hesitateAt ? "hesitate" : "normal"),
          dodged: false
        };
      });
      var carsSvg = ctx.state.cars.map(function (c, i) {
        var fill = c.type === "stall" ? "var(--accent-strong)" : "var(--chip-text)";
        return '<g class="hw-traffic" data-i="' + i + '" style="transform: translate(' + (40 + c.frac * 300) + 'px, 30px);">' +
          '<rect x="0" y="0" width="26" height="14" rx="4" fill="' + fill + '" opacity="0.85"/>' +
          '<circle cx="6" cy="15" r="3.5" fill="var(--muted)"/><circle cx="20" cy="15" r="3.5" fill="var(--muted)"/>' +
          (c.type === "stall" ? '<text class="hw-stall-warn" x="8" y="-6" font-size="14" font-weight="bold" fill="var(--accent-strong)" opacity="0">!</text>' : '') +
          '</g>';
      }).join("");
      scene.innerHTML =
        '<div class="hw-screen" style="justify-content:flex-end; padding-bottom:2em;">' +
          '<svg width="100%" height="140" viewBox="0 0 400 70" preserveAspectRatio="none" aria-hidden="true">' +
            '<rect x="0" y="26" width="400" height="26" rx="4" fill="var(--chip-bg)"/>' +
            '<line x1="0" y1="39" x2="400" y2="39" stroke="var(--border-strong)" stroke-width="1.5" stroke-dasharray="10 8"/>' +
            '<text x="382" y="22" font-size="16">🏁</text>' +
            carsSvg +
            '<g id="hw-car" style="transform: translate(6px, 30px);">' +
              '<rect x="0" y="0" width="30" height="14" rx="5" fill="var(--accent)"/>' +
              '<circle cx="7" cy="15" r="3.5" fill="var(--text)"/><circle cx="23" cy="15" r="3.5" fill="var(--text)"/>' +
              '<circle cx="24" cy="4" r="5" fill="var(--accent-strong)"/>' +
            '</g>' +
          '</svg>' +
          '<p class="hw-hint">hold <span class="hw-kbd">space</span> / press — everyone gets out of your way' +
          (ctx.params.stallIdx >= 0 ? ' <span style="color:var(--accent-strong)">(almost everyone)</span>' : '') + '</p>' +
        '</div>';
    },
    _dodge: function (c, el) {
      c.dodged = true;
      var w = el.querySelector(".hw-stall-warn");
      if (w) w.setAttribute("opacity", "0"); // it stopped yelling the moment it moved
      if (!reducedMotion) el.style.transition = "transform 0.35s ease-out, opacity 0.35s";
      el.style.transform = "translate(" + (40 + c.frac * 300) + "px, " + (c.frac > 0.5 ? -30 : 78) + "px)";
      el.style.opacity = "0.25";
      sfx("tick");
    },
    update: function (ctx, dt) {
      if (ctx.state.holding) ctx.state.x = Math.min(1, ctx.state.x + dt / ctx.state.travelMs);
      var car = $("hw-car");
      if (car) car.style.transform = "translate(" + (6 + ctx.state.x * 348) + "px, 30px)";
      var els = scene.querySelectorAll(".hw-traffic");
      for (var i = 0; i < ctx.state.cars.length; i++) {
        var c = ctx.state.cars[i], el = els[i];
        if (!el || c.dodged) continue;
        if (c.type === "stall") {
          var warn = el.querySelector(".hw-stall-warn");
          var near = ctx.state.x > c.frac - 0.2;
          if (warn) warn.setAttribute("opacity", near ? "1" : "0");
          if (near && !ctx.state.holding) {
            if (ctx.state.noticeAt === null) ctx.state.noticeAt = ctx.elapsed;
            if (ctx.elapsed - ctx.state.noticeAt > 320) gameDrive._dodge(c, el); // it noticed you waiting
          } else {
            ctx.state.noticeAt = null; // it only moves for someone who stops
          }
          if (ctx.state.holding && ctx.state.x > c.frac - 0.05) {
            return ctx.fail("You didn't have to tailgate.");
          }
        } else {
          var margin = c.type === "hesitate" ? 0.055 : 0.14; // the hesitant one waits until the last moment
          if (ctx.state.x > c.frac - margin) gameDrive._dodge(c, el);
        }
      }
      if (ctx.state.x >= 1) {
        var early = 1 - ctx.elapsed / ctx.duration;
        ctx.win("Nothing in your way. That's the point.", early > 0.25 ? 1 : 0);
      }
    },
    onPress: function (ctx) { ctx.state.holding = true; },
    onRelease: function (ctx) { ctx.state.holding = false; },
    onTimeout: function (ctx) { ctx.fail("The road was empty and you hesitated."); }
  };

  /* ---- 2. MAKE IT PUBLIC — "PUBLISH!" (click) ----
     L3: one toggle re-locks itself once ("legal had concerns") and needs
     a second flip — state is a set, not a countdown, so it survives that. */
  var gamePublish = {
    id: "publish", value: "Make it public", verb: "PUBLISH!", input: "click",
    baseDurationMs: 4200,
    params: { count: 3, density: 0, confirm: false },
    levels: [{}, { count: 4, density: 1 }, { count: 5, density: 2, confirm: true }],
    // A Win95 "Sharing" control panel: click a whole row to make it public. Fitts-safe
    // (the row is the target, the tiny checkbox is just the look). Content = radical
    // transparency, real items + a couple cheeky ones.
    _pool: ["Source code", "Product roadmap", "Company handbook", "Q3 financials",
            "Incident reports", "The postmortem", "Pricing model", "Your search history", "That 2am Slack"],
    _sensitive: "Salaries", // the one that needs a confirm at L3 — of course it does
    setup: function (ctx) {
      var items = shuffle(gamePublish._pool.slice(), run.rng).slice(0, ctx.params.count);
      if (ctx.params.confirm) { // guarantee the sensitive row is present as the confirm target
        if (items.indexOf(gamePublish._sensitive) === -1) items[items.length - 1] = gamePublish._sensitive;
        ctx.state.confirmLabel = gamePublish._sensitive;
      }
      ctx.state.items = items;
      ctx.state.pub = {};
      var dens = ["", " hw-pub-snug", " hw-pub-dense"][ctx.params.density] || "";
      var rows = items.map(function (label, i) {
        return '<button class="hw-pubrow" data-i="' + i + '">' +
          '<span class="hw-pubcheck"></span>' +
          '<span class="hw-publabel">' + label + '</span>' +
          '<span class="hw-pubstate">Private</span></button>';
      }).join("");
      scene.innerHTML =
        '<div class="hw-screen"><div class="hw-pubpanel">' +
          '<fieldset class="hw-pubgroup"><legend>Make public:</legend>' +
            '<div class="hw-publist' + dens + '">' + rows + '</div>' +
          '</fieldset>' +
          '<p class="hw-hint">click each row to make it public</p>' +
        '</div></div>';

      var publish = function (el, i) {
        ctx.state.pub[i] = true;
        el.classList.add("hw-public");
        el.querySelector(".hw-pubstate").textContent = "Public";
        sfx("tick");
        if (Object.keys(ctx.state.pub).filter(function (k) { return ctx.state.pub[k]; }).length === items.length) {
          ctx.win("Everything's out in the open.", 0);
        }
      };
      scene.querySelectorAll(".hw-pubrow").forEach(function (el) {
        var i = parseInt(el.dataset.i, 10);
        el.addEventListener("pointerdown", function () {
          if (ctx.done || !ctx.live || ctx.state.pub[i] || ctx.state.confirmOpen) return;
          // The sensitive row (L3) needs a "are you sure?" — of course salaries does.
          if (items[i] === ctx.state.confirmLabel) { gamePublish._askConfirm(ctx, el, i, publish); return; }
          publish(el, i);
        });
      });
    },
    _askConfirm: function (ctx, rowEl, i, publish) {
      ctx.state.confirmOpen = true;
      var overlay = document.createElement("div");
      overlay.className = "hw-pub-confirm-overlay"; // flex-centers the dialog — no transform race
      overlay.innerHTML =
        '<div class="hw-pub-confirm">' +
          '<div class="hw-pub-confirm-bar">⚠ Confirm</div>' +
          '<div class="hw-pub-confirm-body"><p><b>Make Salaries public?</b><br><span>everyone. yes, you too.</span></p>' +
            '<div class="hw-pub-confirm-btns"><button class="hw-btn hw-pubyes">Yes</button>' +
            '<button class="hw-btn hw-btn--ghost hw-pubno">No</button></div></div>' +
        '</div>';
      scene.querySelector(".hw-pubpanel").appendChild(overlay);
      var close = function () { ctx.state.confirmOpen = false; overlay.remove(); };
      overlay.querySelector(".hw-pubyes").addEventListener("pointerdown", function (e) {
        e.stopPropagation();
        if (ctx.done) return;
        close(); publish(rowEl, i);
      });
      overlay.querySelector(".hw-pubno").addEventListener("pointerdown", function (e) {
        e.stopPropagation();
        close(); sfx("whiff");
      });
    },
    onTimeout: function (ctx) {
      var left = ctx.state.items.length - Object.keys(ctx.state.pub).filter(function (k) { return ctx.state.pub[k]; }).length;
      ctx.fail("Still " + left + " thing" + (left > 1 ? "s" : "") + " behind closed doors.");
    }
  };

  /* ---- 3. DO MORE WEIRD — "WEIRD!" (mash) ----
     A boring corporate stock photo mutates one notch weirder per click —
     transformation of one scene, not decoration on top of it. Mutation
     order is daily-seeded so everyone's photo gets weird the same way. */
  var gameWeird = {
    id: "weird", value: "Do more weird", verb: "WEIRD!", input: "click",
    baseDurationMs: 4200,
    params: { target: 5, radius: 40, drift: false, decayMs: 0 },
    levels: [
      {},
      { target: 6, radius: 32, durationMs: 4800 },
      { target: 7, radius: 27, drift: true, decayMs: 1500, durationMs: 4800 } // normalcy fights back: idle too long and progress reverts
    ],
    /* Each mutation lives somewhere — a pulsing ring marks the next thing to
       weirdify, and only clicks near it count. Aim is the skill, not mashing. */
    _mutations: [
      { at: [170, 78], fn: function () { var e = $("hw-w-bg"); e.setAttribute("fill", "#B043D1"); } },            // beige wall goes purple
      { at: [142, 48], fn: function () { var e = $("hw-w-chart"); e.setAttribute("points", "105,58 120,20 135,55 150,8 165,40 180,4"); e.setAttribute("stroke", "var(--accent)"); } }, // chart becomes a rollercoaster
      { at: [60, 64], fn: function () { var e = $("hw-w-tie"); e.classList.add("hw-anim-spin"); } },              // tie becomes a propeller
      { at: [100, 101], fn: function () { var e = $("hw-w-caption"); e.textContent = "SYNERWEIRD"; } },
      { at: [60, 40], fn: function () { var e = $("hw-w-head"); e.setAttribute("fill", "var(--accent)"); $("hw-w-spikes").style.opacity = "1"; } }, // person hedgehogs
      { at: [25, 88], fn: function () { var e = $("hw-w-plant"); e.classList.add("hw-anim-grow"); } },            // plant refuses to stay decorative
      { at: [60, 33], fn: function () { var e = $("hw-w-eye3"); e.style.opacity = "1"; } },                       // third eye opens
      { at: [60, 72], fn: function () { var e = $("hw-w-person"); e.classList.add("hw-anim-float"); } },          // levitation unlocked
      { at: [100, 101], fn: function () { var e = $("hw-w-caption"); e.textContent = "WHY NOT NOW"; e.setAttribute("fill", "var(--accent)"); } },
      { at: [16, 12], fn: function () { var e = $("hw-w-frame"); e.style.transform = "rotate(3deg) scale(1.04)"; } }, // reality tilts
      { at: [170, 20], fn: function () { var e = $("hw-w-sun"); e.style.opacity = "1"; } },                       // indoor sun
      { at: [142, 48], fn: function () { var e = $("hw-w-chart"); e.classList.add("hw-anim-spin"); } },           // the chart has had enough
      { at: [58, 40], fn: function () { document.querySelectorAll("#hw-w-person circle").forEach(function (c) { var r = parseFloat(c.getAttribute("r")); if (r < 3) c.setAttribute("r", r * 2.2); }); } }, // googly eyes
      { at: [142, 48], fn: function () { var e = $("hw-w-chart"); e.setAttribute("stroke-width", "6"); e.setAttribute("stroke-linecap", "round"); } } // the chart thickens
    ],
    setup: function (ctx) {
      ctx.state.count = 0;
      ctx.state.applied = 0;
      ctx.state.lastClick = 0;
      ctx.state.order = shuffle(gameWeird._mutations.slice(), run.rng);
      // Random starting spot (seeded) so the photo isn't always dead center.
      var ox = Math.round((run.rng() - 0.5) * 90), oy = Math.round((run.rng() - 0.5) * 40);
      scene.innerHTML =
        '<div class="hw-screen" style="justify-content:center;">' +
          '<div class="hw-w-wrap' + (ctx.params.drift ? ' hw-anim-wander-fast' : '') + '" style="width:min(70%, 340px); position:relative; margin:' + (20 + oy) + 'px 0 0 ' + ox + 'px;">' +
          '<svg id="hw-w-frame" width="100%" viewBox="0 0 200 110" style="background:var(--surface); border:1px solid var(--border-strong); border-radius:8px; cursor:crosshair; transition: transform 0.3s;" aria-label="A perfectly normal stock photo">' +
            '<rect id="hw-w-bg" x="0" y="0" width="200" height="110" fill="#E8E0D0"/>' +
            '<circle id="hw-w-sun" cx="170" cy="20" r="12" fill="#FFC53D" style="opacity:0; transition: opacity 0.3s;"/>' +
            '<g id="hw-w-person" style="transform-origin: 60px 70px;">' +
              '<circle id="hw-w-head" cx="60" cy="42" r="13" fill="#D9B38C"/>' +
              '<g id="hw-w-spikes" style="opacity:0; transition: opacity 0.3s;">' +
                '<path d="M50 33l-6-8 8 2zM58 29l-2-9 6 5zM66 30l4-8 2 9z" fill="var(--accent)"/></g>' +
              '<circle cx="55" cy="40" r="1.8" fill="#222"/><circle cx="65" cy="40" r="1.8" fill="#222"/>' +
              '<circle id="hw-w-eye3" cx="60" cy="33" r="2.2" fill="#222" style="opacity:0; transition: opacity 0.3s;"/>' +
              '<rect x="48" y="55" width="24" height="34" rx="5" fill="#4A5568"/>' +
              '<polygon id="hw-w-tie" points="60,55 64,65 60,80 56,65" fill="#C53030" style="transform-origin: 60px 60px;"/>' +
            '</g>' +
            '<polyline id="hw-w-chart" points="105,58 120,50 135,52 150,44 165,46 180,38" fill="none" stroke="#718096" stroke-width="2.5" style="transform-origin: 142px 48px;"/>' +
            '<g id="hw-w-plant" style="transform-origin: 25px 95px;">' +
              '<rect x="20" y="88" width="10" height="10" fill="#A0785A"/>' +
              '<path d="M25 88c-6-8-2-16 0-18 2 2 6 10 0 18z" fill="#48885C"/></g>' +
            '<text id="hw-w-caption" x="100" y="103" text-anchor="middle" font-size="9" font-weight="bold" fill="#718096" letter-spacing="2">SYNERGY</text>' +
          '</svg></div>' +
          '<p class="hw-hint">click the glowing bits weirder — <span id="hw-weird-count">0</span>/' + ctx.params.target + '</p>' +
        '</div>';
      // Pulsing ring marks the next target; move it to the first one.
      var svg = $("hw-w-frame");
      var ring = document.createElementNS("http://www.w3.org/2000/svg", "circle");
      ring.setAttribute("id", "hw-w-ring");
      ring.setAttribute("r", ctx.params.radius);
      ring.setAttribute("fill", "var(--accent-soft)"); // the whole clickable area reads as target, not just the outline
      ring.setAttribute("stroke", "var(--accent)");
      ring.setAttribute("stroke-width", "2.5");
      ring.setAttribute("stroke-dasharray", "6 4");
      ring.classList.add("hw-w-ring-pulse");
      svg.appendChild(ring);
      gameWeird._moveRing(ctx);

      svg.addEventListener("pointerdown", function (e) {
        if (ctx.done) return;
        var m = ctx.state.order[ctx.state.applied % ctx.state.order.length];
        // Convert the click into viewBox coords and demand real aim.
        var r = svg.getBoundingClientRect();
        var cx = (e.clientX - r.left) / r.width * 200;
        var cy = (e.clientY - r.top) / r.height * 110;
        var dx = cx - m.at[0], dy = cy - m.at[1];
        if (Math.sqrt(dx * dx + dy * dy) > ctx.params.radius) {
          sfx("whiff"); // soft dud — a miss costs time, it shouldn't also scold
          return;
        }
        try { m.fn(); } catch (err) {}
        sfx("tick");
        ctx.state.count++;
        ctx.state.applied++;
        ctx.state.lastClick = ctx.elapsed;
        var label = $("hw-weird-count");
        if (label) label.textContent = ctx.state.count;
        if (ctx.state.count >= ctx.params.target) return ctx.win("Perfectly optimized for our strategy.", 0);
        gameWeird._moveRing(ctx);
      });
    },
    _moveRing: function (ctx) {
      var ring = $("hw-w-ring");
      var m = ctx.state.order[ctx.state.applied % ctx.state.order.length];
      if (ring && m) { ring.setAttribute("cx", m.at[0]); ring.setAttribute("cy", m.at[1]); }
    },
    update: function (ctx) {
      // L3: normal creeps back in — idle too long between clicks and progress reverts.
      if (!ctx.params.decayMs || ctx.state.count === 0) return;
      var since = ctx.elapsed - Math.max(ctx.state.lastClick, ctx.state.lastDecay || 0);
      if (since > ctx.params.decayMs) {
        ctx.state.lastDecay = ctx.elapsed;
        ctx.state.count = Math.max(0, ctx.state.count - 1);
        var label = $("hw-weird-count");
        if (label) label.textContent = ctx.state.count;
        var frame = $("hw-w-frame");
        if (frame) { // beige veil blinks: normalcy reasserting itself
          frame.style.filter = "saturate(0.2)";
          setTimeout(function () { if (frame) frame.style.filter = ""; }, 220);
        }
        sfx("fail");
      }
    },
    onTimeout: function (ctx) { ctx.fail("Still " + (ctx.params.target - ctx.state.count) + " notches too normal."); }
  };

  /* ---- 4. WHY NOT NOW? — "SHIP IT!" (click) ---- */
  var gameShip = {
    id: "ship", value: "Why not now?", verb: "SHIP IT!", input: "click",
    baseDurationMs: 4600,
    levels: [
      {},
      { spawnEveryMs: 240, shipDelayMs: 750, driftSpeed: 170, burst: 5 },                                          // the button isn't there yet — find it under the pile
      { spawnEveryMs: 260, decoy: true, shipDelayMs: 1100, decoyLockMs: 600, durationMs: 5400, driftSpeed: 160, burst: 6 } // SHIP LATER sits alone longer; falling for it costs time
    ],
    params: {
      spawnEveryMs: 340,
      shipDelayMs: 0,
      decoy: false,
      decoyLockMs: 0,
      driftSpeed: 115,  // px/s — everything keeps moving; ~half launch aimed across the button
      burst: 4,         // notifications already in the frame at t=0 — no clean opening beat
      // Win95 chrome, modern remote-work content: form stays in-world, the joke stays now.
      popups: [
        { t: "cal",   title: "Standup",             body: "starts in 5 min" },
        { t: "cal",   title: "Quick sync?",         body: "“just 30 min” (it's 60)" },
        { t: "cal",   title: "Retro",               body: "what went well: this popup" },
        { t: "cal",   title: "1:1 w/ your skip",    body: "no agenda, as usual" },
        { t: "cal",   title: "Lunch",               body: "you forgot to eat again" },
        { t: "email", title: "re: re: re: quick q", body: "6 people replied-all" },
        { t: "email", title: "Your car's warranty", body: "FINAL notice!!" },
        { t: "email", title: "1,024 unread",        body: "inbox zero is a myth" },
        { t: "email", title: "Payment received",    body: "you spent $340 on… things" },
        { t: "chat",  title: "Mom",                 body: "you never call anymore" },
        { t: "chat",  title: "@you in #general",    body: "thoughts? 👀" },
        { t: "chat",  title: "the group chat",      body: "247 unread" },
        { t: "chat",  title: "landlord",            body: "rent's due btw" },
        { t: "chat",  title: "your PM",             body: "got a sec? 👀" },
        { t: "sys",   title: "The dog",             body: "is staring at the leash" },
        { t: "sys",   title: "Low battery",         body: "10%, no charger in sight" },
        { t: "sys",   title: "Laundry's done",      body: "it will wrinkle" },
        { t: "sys",   title: "Focus time",          body: "lol" },
        { t: "sys",   title: "Hydrate?",            body: "you haven't. today." }
      ]
    },
    _ntype: {
      email: { icon: "📧", app: "Inbox" },
      cal:   { icon: "📅", app: "Reminder" },
      chat:  { icon: "💬", app: "Messenger" },
      sys:   { icon: "⚠️", app: "Alert" }
    },
    setup: function (ctx) {
      ctx.state.lastSpawn = -ctx.params.spawnEveryMs; // first meeting invite lands immediately
      ctx.state.spawned = 0;
      ctx.state.popupOrder = shuffle(ctx.params.popups.slice(), run.rng); // different meeting barrage each loop
      ctx.state.nextGap = ctx.params.spawnEveryMs;
      ctx.state.lockedUntil = 0;
      ctx.state.shipShown = false;
      // Seeded random spot each play, edge-BIASED: uniform draws feel center-heavy
      // (most of the probability mass is mid-range), so push toward the extremes.
      var edgy = function () { var u = run.rng(); return u < 0.5 ? 2 * u * u : 1 - 2 * (1 - u) * (1 - u); };
      ctx.state.shipPos = { left: 3 + edgy() * 74, top: 10 + edgy() * 62 };
      scene.innerHTML = '<div id="hw-ship-zone" style="position:absolute; inset:0;"></div>' +
        '<p class="hw-hint" style="position:absolute; bottom:5%; left:0; right:0; text-align:center;">ignore the noise — find and hit SHIP</p>';
      if (ctx.params.decoy) {
        var d = document.createElement("button");
        d.className = "hw-ship-btn95 hw-ship-decoy";
        d.id = "hw-decoy-btn";
        d.textContent = "SHIP LATER";
        d.style.position = "absolute";
        d.style.zIndex = "5"; // below the notifications (11) — they must be able to bury it
        var dpos = { left: 3 + edgy() * 74, top: 10 + edgy() * 62 };
        // keep decoy and real button visibly apart
        if (Math.abs(dpos.left - ctx.state.shipPos.left) < 18) dpos.left = (dpos.left + 37) % 74 + 3;
        d.style.left = dpos.left + "%";
        d.style.top = dpos.top + "%";
        d.addEventListener("pointerdown", function (e) {
          e.stopPropagation();
          if (ctx.done || !ctx.live) return; // never touch run.rng() after resolve — it would shift the daily seed stream
          ctx.state.lockedUntil = ctx.elapsed + ctx.params.decoyLockMs; // you're in the meeting now
          d.style.transform = "rotate(" + (run.rng() > 0.5 ? 8 : -8) + "deg)";
          d.textContent = "in a meeting…";
          sfx("fail");
        });
        $("hw-ship-zone").appendChild(d);
      }
    },
    _showShip: function (ctx) {
      ctx.state.shipShown = true;
      var b = document.createElement("button");
      b.className = "hw-ship-btn95"; // the 'deploy' button you're hunting for
      b.id = "hw-ship-btn";
      b.textContent = "SHIP IT";
      b.style.position = "absolute";
      b.style.zIndex = "5"; // below the notifications (11) — the pile must be able to bury it
      b.style.left = ctx.state.shipPos.left + "%";
      b.style.top = ctx.state.shipPos.top + "%";
      if (!reducedMotion) { b.style.animation = "hw-verb-pop 0.25s cubic-bezier(0.2, 1.6, 0.4, 1)"; }
      b.addEventListener("pointerdown", function () {
        if (ctx.elapsed < ctx.state.lockedUntil) return; // still stuck in the meeting you clicked into
        ctx.win("Shipped. Today.", ctx.state.spawned >= 5 ? 1 : 0);
      });
      $("hw-ship-zone").appendChild(b);
    },
    _spawn: function (ctx, box) {
      var p = ctx.state.popupOrder[ctx.state.spawned % ctx.state.popupOrder.length];
      var nt = gameShip._ntype[p.t];
      var el = document.createElement("div");
      el.className = "hw-notif hw-notif-" + p.t;
      el.innerHTML =
        '<div class="hw-notif-bar"><span class="hw-notif-icon">' + nt.icon + '</span>' +
          '<span class="hw-notif-app">' + nt.app + '</span><b class="hw-notif-x">×</b></div>' +
        '<div class="hw-notif-body"><b>' + p.title + '</b><span>' + p.body + '</span></div>';
      // Spawn ANYWHERE in the frame (seeded) — there is no clean corner to rest your eyes.
      var sx = run.rng() * (box.width - 150), sy = 30 + run.rng() * (box.height - 90);
      el.style.left = sx + "px";
      el.style.top = sy + "px";
      el.style.transform = "rotate(" + (run.rng() * 10 - 5) + "deg)";
      $("hw-ship-zone").appendChild(el);
      // Nothing parks: everything keeps moving forever. About half launch AIMED at
      // the button so they sweep across it; the rest careen randomly. Where's Waldo,
      // except the page won't hold still.
      var box2 = stage.getBoundingClientRect();
      var vx, vy;
      if (run.rng() < 0.55) {
        var tx = box2.width * (ctx.state.shipPos.left / 100) + 40 - sx;
        var ty = box2.height * (ctx.state.shipPos.top / 100) + 20 - sy;
        var d = Math.max(1, Math.sqrt(tx * tx + ty * ty));
        vx = tx / d; vy = ty / d;
      } else {
        var ang = run.rng() * Math.PI * 2;
        vx = Math.cos(ang); vy = Math.sin(ang);
      }
      ctx.state.popupEls.push({
        el: el, x: sx, y: sy, vx: vx, vy: vy,
        speed: ctx.params.driftSpeed * (0.75 + run.rng() * 0.55)
      });
      ctx.state.spawned++;
    },
    update: function (ctx, dt) {
      if (!ctx.state.shipShown && ctx.elapsed >= ctx.params.shipDelayMs) gameShip._showShip(ctx);
      var ship = $("hw-ship-btn");
      if (ship) {
        var locked = ctx.elapsed < ctx.state.lockedUntil;
        ship.style.opacity = locked ? "0.35" : "";
        ship.style.cursor = locked ? "not-allowed" : "";
      }
      var box = stage.getBoundingClientRect();
      if (!ctx.state.popupEls) ctx.state.popupEls = [];
      // No clean opening beat: part of the pile is already here at t=0.
      if (!ctx.state.burstDone) {
        ctx.state.burstDone = true;
        for (var b = 0; b < (ctx.params.burst || 0); b++) gameShip._spawn(ctx, box);
      }
      ctx.state.popupEls.forEach(function (pu) {
        var step = pu.speed * dt / 1000;
        pu.x += pu.vx * step;
        pu.y += pu.vy * step;
        if (pu.x < -20 || pu.x > box.width - 120) pu.vx *= -1;
        if (pu.y < 20 || pu.y > box.height - 70) pu.vy *= -1;
        pu.el.style.left = pu.x + "px";
        pu.el.style.top = pu.y + "px";
      });
      if (ctx.elapsed - ctx.state.lastSpawn < ctx.state.nextGap) return;
      ctx.state.lastSpawn = ctx.elapsed;
      ctx.state.nextGap = ctx.params.spawnEveryMs + (run.rng() - 0.5) * 120; // irregular cadence reads more human
      gameShip._spawn(ctx, box);
    },
    onTimeout: function (ctx) { ctx.fail("Buried in meetings. Classic."); }
  };

  /* ---- 5. OPTIMISTIC BY DEFAULT — "AIM!" (hold + release) ---- */
  var gameAim = {
    id: "aim", value: "Optimistic by default", verb: "AIM!", input: "space", preHold: false,
    baseDurationMs: 5200,
    params: {
      slideSpeed: 66,   // %/s — the hedgehog paces the rink on its own; you STOP it
      bandHalf: 12,     // half-width of the target band
      strict: false     // L1: anywhere on the rink lands; band is pure upside
    },
    levels: [
      {},
      { slideSpeed: 95, bandHalf: 9, strict: true },
      { slideSpeed: 128, bandHalf: 7, strict: true }
    ],
    setup: function (ctx) {
      var s = ctx.state;
      s.pos = 0;
      s.dir = 1;
      s.stopped = false;
      // The target band lands ANYWHERE per play (seeded); the slider ping-pongs
      // 0..105 — the sliver past the edge is the drowning zone, so late greed
      // still exists even without a charge meter.
      var range = ctx.params.strict ? [25, 90] : [30, 80];
      s.band = range[0] + run.rng() * (range[1] - range[0]);
      s.moonshot = s.band >= 78; // deep placements keep the name
      var px = function (pct) { return 6 + (pct / 100) * 372 + 10; };
      var b0 = s.band - ctx.params.bandHalf, b1 = s.band + ctx.params.bandHalf;
      var g0 = Math.max(0, b0 - 6), g1 = Math.min(100, b1 + 6); // "close" grace halo
      var bands =
        '<rect x="' + px(g0) + '" y="35" width="' + (px(g1) - px(g0)) + '" height="12" rx="6" fill="var(--accent-soft)"/>' +
        '<rect x="' + px(Math.max(0, b0)) + '" y="32" width="' + (px(Math.min(100, b1)) - px(Math.max(0, b0))) + '" height="18" rx="6" fill="var(--accent)" opacity="0.55"/>' +
        // THE LEDGE: a sliver of maximum upside at the very end — nearly frame-perfect, pays triple.
        '<rect x="' + px(102) + '" y="30" width="' + (px(106) - px(102)) + '" height="22" rx="3" fill="var(--accent-strong)" opacity="0.85"/>';
      scene.innerHTML =
        '<div class="hw-screen" style="justify-content:flex-end; padding-bottom:2.2em;">' +
          '<svg id="hw-rink" width="100%" height="120" viewBox="0 0 400 60" preserveAspectRatio="none" aria-hidden="true" ' +
            'data-band="' + s.band.toFixed(1) + '" data-speed="' + ctx.params.slideSpeed + '">' +
            '<rect x="0" y="38" width="400" height="6" rx="3" fill="var(--chip-bg)"/>' +
            bands +
            '<line x1="' + px(100) + '" y1="20" x2="' + px(100) + '" y2="56" stroke="var(--accent-strong)" stroke-width="2.5" stroke-dasharray="3 3"/>' +
            '<g id="hw-puck" style="transform: translate(6px, 26px);">' +
              '<circle cx="10" cy="14" r="10" fill="var(--accent)"/>' +
              '<circle cx="7" cy="12" r="1.4" fill="var(--bg)"/>' +
              '<circle cx="13" cy="12" r="1.4" fill="var(--bg)"/>' +
            '</g>' +
          '</svg>' +
          '<p class="hw-hint"><span class="hw-kbd">space</span> / tap to STOP the hedgehog on the glow — the far ledge pays triple</p>' +
        '</div>';
    },
    update: function (ctx, dt) {
      var s = ctx.state;
      if (s.stopped) return;
      s.pos += s.dir * ctx.params.slideSpeed * dt / 1000;
      if (s.pos >= 106) { s.pos = 106; s.dir = -1; }
      if (s.pos <= 0) { s.pos = 0; s.dir = 1; }
      var puck = $("hw-puck");
      if (puck) puck.style.transform = "translate(" + (6 + (s.pos / 100) * 372) + "px, 26px)";
      var rink = $("hw-rink");
      if (rink) { rink.dataset.pos = s.pos.toFixed(1); rink.dataset.dir = s.dir; }
    },
    onPress: function (ctx) {
      var s = ctx.state;
      if (s.stopped) return;
      s.stopped = true;
      sfx("tick");
      var pct = s.pos;
      setTimeout(function () {
        if (ctx.done) return;
        if (pct >= 102) return ctx.win("THE LEDGE. Maximum upside.", 3); // the best possible outcome, barely possible
        var d = Math.abs(pct - s.band);
        var big = s.moonshot ? "MOONSHOT!!" : "BULLSEYE!";
        if (d <= ctx.params.bandHalf) return ctx.win(big, 2);
        if (d <= ctx.params.bandHalf + 6) return ctx.win("CLOSE.", 1);
        if (!ctx.params.strict) return ctx.win("…landed. Nothing gained.", 0);
        return ctx.fail(pct < s.band ? "Short of the brief." : "Sailed right past it.");
      }, reducedMotion ? 120 : 320);
    },
    onTimeout: function (ctx) { ctx.fail("Never even took the shot."); }
  };

  /* ============================================================
     BOSS: RUN THE QUERY — longer, two phases, no visible timer.
     Appears after every full loop; clearing it restores one lost
     life (max LIVES) and gates the LEVEL UP!, WarioWare-style.
     Phase 1: assemble a HogQL query by clicking fragments in order
     (3 syntax errors = the query never ships). Phase 2: it "runs" —
     pick which of three charts ORDER BY score DESC actually returns.
     ============================================================ */
  var gameBossQuery = {
    id: "boss-query", value: "BOSS", verb: "RUN THE QUERY!", input: "click", boss: true,
    baseDurationMs: 30000, // invisible safety net so an abandoned run still ends; not a displayed timer
    params: { maxErrors: 3 },
    _frags: [
      { ord: 0, text: "SELECT handle, max(score)" },
      { ord: 1, text: "FROM events" },
      { ord: 2, text: "WHERE event = 'hogware_score_submitted'" },
      { ord: 3, text: "ORDER BY score DESC" }
    ],
    setup: function (ctx) {
      ctx.state.step = 0;
      ctx.state.errors = 0;
      var frags = shuffle(gameBossQuery._frags.slice(), run.rng);
      var chips = frags.map(function (f) {
        return '<button class="hw-frag" data-ord="' + f.ord + '">' + f.text + '</button>';
      }).join("");
      scene.innerHTML =
        '<div id="hw-boss-scene" class="hw-screen" style="gap:0.9em;">' +
          '<pre id="hw-terminal">hogql&gt; <span class="hw-caret">▋</span></pre>' +
          '<div class="hw-frag-tray">' + chips + '</div>' +
          '<p class="hw-hint">assemble the leaderboard query — this is literally how the scoreboard works · ' +
            '<span id="hw-boss-errors">' + ctx.params.maxErrors + '</span> errors left</p>' +
        '</div>';
      scene.querySelectorAll(".hw-frag").forEach(function (chip) {
        chip.addEventListener("pointerdown", function () {
          if (ctx.done || !ctx.live || chip.disabled) return;
          if (parseInt(chip.dataset.ord, 10) === ctx.state.step) {
            chip.disabled = true;
            chip.classList.add("hw-frag-used");
            ctx.state.step++;
            sfx("tick");
            var term = $("hw-terminal");
            term.innerHTML = "hogql&gt; " + gameBossQuery._frags.slice(0, ctx.state.step).map(function (f) { return f.text; }).join("<br>&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp; ") +
              (ctx.state.step < 4 ? ' <span class="hw-caret">▋</span>' : "");
            if (ctx.state.step === 4) setTimeout(function () { gameBossQuery._phase2(ctx); }, 500);
          } else {
            ctx.state.errors++;
            sfx("whiff");
            chip.classList.add("hw-frag-err");
            setTimeout(function () { chip.classList.remove("hw-frag-err"); }, 300);
            var left = ctx.params.maxErrors - ctx.state.errors;
            var el = $("hw-boss-errors");
            if (el) el.textContent = left;
            if (ctx.state.errors >= ctx.params.maxErrors) ctx.fail("Syntax errors. The intern has questions.");
          }
        });
      });
    },
    _phase2: function (ctx) {
      if (ctx.done) return;
      sfx("verb");
      // Three candidate results; only descending bars match ORDER BY score DESC.
      var bars = function (heights, correct) {
        var rects = heights.map(function (h, i) {
          return '<rect x="' + (6 + i * 13) + '" y="' + (40 - h) + '" width="9" height="' + h + '" rx="2" fill="var(--accent)" opacity="0.8"/>';
        }).join("");
        return '<button class="hw-chart" data-correct="' + (correct ? 1 : 0) + '">' +
          '<svg width="76" height="46" viewBox="0 0 76 46">' + rects + '<line x1="4" y1="41" x2="72" y2="41" stroke="var(--border-strong)"/></svg></button>';
      };
      var charts = shuffle([
        bars([32, 25, 18, 12, 7], true),   // DESC — the right answer
        bars([7, 12, 18, 25, 32], false),  // ASC — reading it backwards
        bars([18, 30, 9, 24, 14], false)   // chaos — no ORDER BY at all
      ], run.rng).join("");
      scene.innerHTML =
        '<div id="hw-boss-scene" class="hw-screen" style="gap:1em;">' +
          '<pre id="hw-terminal">hogql&gt; running… returned 3 candidates</pre>' +
          '<div class="hw-chart-tray">' + charts + '</div>' +
          '<p class="hw-hint">which one is ORDER BY score DESC?</p>' +
        '</div>';
      scene.querySelectorAll(".hw-chart").forEach(function (btn) {
        btn.addEventListener("pointerdown", function () {
          if (ctx.done) return;
          if (btn.dataset.correct === "1") ctx.win("The query returned. +1 life.", 1);
          else ctx.fail("That's… not what DESC means.");
        });
      });
    },
    onTimeout: function (ctx) { ctx.fail("The query is still running somewhere."); }
  };
  /* ============================================================
     BOSS: HEDGEHOG MODE — the original Hedgehog Curl, resurrected.
     Phase 1: hold to charge, release to launch the curled hog down
     a long rink. Phase 2: while rolling, hop the rocks (tap/space).
     Land in the glow = +1 life. Stop short, eat a rock, or fly off
     the end = a life gone. Power is the bet; hops are the skill.
     ============================================================ */
  var gameBossHedgehog = {
    id: "boss-curl", value: "BOSS", verb: "HEDGEHOG MODE!", input: "space", boss: true,
    instruction: "charge. hop the rocks. stop in the glow.",
    baseDurationMs: 30000, // invisible safety net, not a visible timer
    params: { chargeMs: 1600, hopMs: 420, zone: [0.72, 0.98] },
    setup: function (ctx) {
      ctx.state.phase = "charge";
      ctx.state.holding = false;
      ctx.state.power = 0;
      ctx.state.x = 0;          // 0..1+ rink progress
      ctx.state.v = 0;
      ctx.state.airUntil = 0;
      // Rocks at seeded spots; the hog must hop each one it reaches.
      ctx.state.rocks = [0.3, 0.5, 0.66].map(function (f) {
        return Math.min(0.68, Math.max(0.22, f + (run.rng() - 0.5) * 0.1)); // clamped below the zone — never land ON a rock
      });
      var z = ctx.params.zone;
      // Linear power→distance (D = power/100 · 1.1), same readable mapping as AIM! —
      // the original quadratic physics made "half power = half distance" false, which
      // played as unfair, not hard. Friction stays visual (the ease-out), not physical.
      var targetPower = 100 * ((z[0] + z[1]) / 2) / 1.1;
      var px = function (f) { return 8 + f * 372; };
      var rocksSvg = ctx.state.rocks.map(function (f) {
        return '<polygon points="' + (px(f) - 7) + ',64 ' + px(f) + ',52 ' + (px(f) + 7) + ',64" fill="var(--chip-text)"/>';
      }).join("");
      scene.innerHTML =
        '<div id="hw-boss-scene" class="hw-screen" style="justify-content:flex-end; padding-bottom:2em;">' +
          '<svg id="hw-curl-rink" width="100%" height="150" viewBox="0 0 400 78" preserveAspectRatio="none" aria-hidden="true" ' +
            'data-chargems="' + ctx.params.chargeMs + '" data-targetpower="' + targetPower.toFixed(1) + '" data-rocks="' + ctx.state.rocks.join(",") + '">' +
            '<rect x="0" y="62" width="400" height="8" rx="4" fill="var(--chip-bg)"/>' +
            '<rect x="' + px(z[0]) + '" y="58" width="' + (px(z[1]) - px(z[0])) + '" height="16" rx="7" fill="var(--accent)" opacity="0.45"/>' +
            '<line x1="' + px(1) + '" y1="40" x2="' + px(1) + '" y2="76" stroke="var(--accent-strong)" stroke-width="2.5" stroke-dasharray="3 3"/>' +
            rocksSvg +
            '<g id="hw-curl-hog" style="transform: translate(8px, 50px);">' +
              '<circle cx="0" cy="0" r="11" fill="var(--accent)"/>' +
              '<path d="M-8 -7l-4 -6 7 1zM0 -10l1 -8 4 6zM8 -6l7 -3-3 7z" fill="var(--accent)"/>' +
              '<circle cx="-4" cy="-2" r="1.6" fill="var(--bg)"/><circle cx="3" cy="-2" r="1.6" fill="var(--bg)"/>' +
            '</g>' +
          '</svg>' +
          '<div style="width:min(70%,320px); height:12px; border-radius:999px; background:var(--chip-bg); overflow:hidden;"><div id="hw-curl-power" style="height:100%; width:0%; border-radius:999px; background:var(--accent);"></div></div>' +
          '<p class="hw-hint" id="hw-curl-hint">hold <span class="hw-kbd">space</span> to charge, release to roll — then hop the rocks</p>' +
        '</div>';
    },
    update: function (ctx, dt) {
      var s = ctx.state;
      if (s.phase === "charge" && s.holding) {
        s.power = Math.min(110, s.power + (dt / ctx.params.chargeMs) * 100);
        var fill = $("hw-curl-power");
        if (fill) {
          fill.style.width = Math.min(100, s.power) + "%";
          if (s.power > 90) fill.style.background = "var(--accent-strong)";
        }
        if (s.power >= 110) gameBossHedgehog._launch(ctx); // greed launches itself
      }
      if (s.phase === "roll") {
        // Ease toward the linear target distance: reads as friction, lands where power says.
        var remain = s.targetX - s.x;
        var step = Math.max(0.11, remain * 1.1) * dt / 1000; // keeps rock-approach speed human-readable
        var airborneNow = ctx.elapsed < s.airUntil;
        if (airborneNow) step = Math.max(step, 0.30 * dt / 1000); // a hop is a lunge: constant air distance even from a slow roll
        s.x = Math.min(s.targetX, s.x + step);
        s.v = remain > 0.004 ? 1 : 0; // "still moving" flag for the settle check
        var airborne = ctx.elapsed < s.airUntil;
        // Input buffering: a hop pressed mid-air fires the moment we land —
        // standard platformer forgiveness, and mashy players earn it constantly.
        if (!airborne && s.wasAirborne && s.hopQueued) {
          s.hopQueued = false;
          s.airUntil = ctx.elapsed + ctx.params.hopMs;
          airborne = true;
          sfx("tick");
        }
        s.wasAirborne = airborne;
        var hog = $("hw-curl-hog");
        if (hog) {
          var y = airborne ? 50 - 16 * Math.sin(Math.PI * (1 - (s.airUntil - ctx.elapsed) / ctx.params.hopMs)) : 50;
          hog.style.transform = "translate(" + (8 + Math.min(1.04, s.x) * 372) + "px, " + y + "px) rotate(" + (s.x * 900) + "deg)";
        }
        var rink = $("hw-curl-rink");
        if (rink) rink.dataset.hogx = s.x.toFixed(3); // live position for the headless player
        // rock collisions — only on the ground
        if (!airborne) {
          for (var i = 0; i < s.rocks.length; i++) {
            if (Math.abs(s.x - s.rocks[i]) < 0.024) return ctx.fail("Rolled straight into a rock. Curl harder.");
          }
        }
        if (s.x > 1.02) return ctx.fail("…right off the end of the rink.");
        if (s.v <= 0) {
          var z = ctx.params.zone;
          if (s.x >= z[0] && s.x <= z[1]) return ctx.win("Stuck the landing. +1 life.", 1);
          return ctx.fail(s.x < z[0] ? "Stopped short of the glow." : "A hair too far.");
        }
      }
    },
    onPress: function (ctx) {
      var s = ctx.state;
      if (s.phase === "charge") { s.holding = true; return; }
      if (s.phase === "roll") {
        if (ctx.elapsed >= s.airUntil) {
          s.airUntil = ctx.elapsed + ctx.params.hopMs; // hop!
          sfx("tick");
        } else {
          s.hopQueued = true; // mid-air press: buffered for landing
        }
      }
    },
    onRelease: function (ctx) {
      if (ctx.state.phase === "charge" && ctx.state.holding) gameBossHedgehog._launch(ctx);
    },
    _launch: function (ctx) {
      var s = ctx.state;
      s.phase = "roll";
      s.holding = false;
      // linear: where you'll stop is exactly power/100 × 1.1 down the rink (~65-89% lands the zone)
      s.targetX = (s.power / 100) * 1.1;
      s.v = 1;
      var hint = $("hw-curl-hint");
      if (hint) hint.innerHTML = 'hop the rocks — <span class="hw-kbd">space</span> / tap';
      sfx("verb");
    },
    onTimeout: function (ctx) { ctx.fail("Never left the starting line."); }
  };

  /* ============================================================
     BOSS: THE INCIDENT — the error graph is climbing RIGHT NOW.
     Phase 1: spot the bad commit while errors rise (wrong click =
     spike; graph tops out = escalated = fail). Phase 2: mash
     ROLLBACK to rewind the deploy faster than the decay. A scan
     under pressure, then a race — not a quiz.
     ============================================================ */
  var gameBossIncident = {
    id: "boss-incident", value: "BOSS", verb: "THE INCIDENT!", input: "click", boss: true,
    instruction: "find the bad deploy. mash ROLLBACK.",
    baseDurationMs: 30000,
    params: { climbPerSec: 0.055, wrongSpike: 0.18, mashGain: 0.055, decayPerSec: 0.05 },
    _commits: [
      { bad: 0, text: "fix: typo in README" },
      { bad: 0, text: "chore: bump dependencies" },
      { bad: 0, text: "docs: update onboarding" },
      { bad: 1, text: "feat: quick fix, tests off, deployed 5pm friday" }
    ],
    setup: function (ctx) {
      ctx.state.err = 0.22;      // the graph is already unhappy
      ctx.state.phase = 1;
      ctx.state.progress = 0;
      var commits = shuffle(gameBossIncident._commits.slice(), run.rng);
      var rows = commits.map(function (c) {
        return '<button class="hw-commit" data-bad="' + c.bad + '">' + c.text + '</button>';
      }).join("");
      scene.innerHTML =
        '<div id="hw-incident-scene" class="hw-screen" style="gap:0.7em;">' +
          '<svg id="hw-err-graph" width="min(88%, 460px)" height="54" viewBox="0 0 200 24" preserveAspectRatio="none">' +
            '<rect x="0" y="0" width="200" height="24" fill="var(--surface)" stroke="var(--border-strong)"/>' +
            '<line x1="0" y1="3" x2="200" y2="3" stroke="#E5484D" stroke-width="1" stroke-dasharray="3 2"/>' +
            '<rect id="hw-err-fill" x="0" y="24" width="200" height="0" fill="#E5484D" opacity="0.55"/>' +
          '</svg>' +
          '<p class="hw-hint" id="hw-incident-hint" style="color:#E5484D;">errors climbing! click the commit that broke prod — before the graph tops out</p>' +
          '<div class="hw-frag-tray">' + rows + '</div>' +
        '</div>';
      scene.querySelectorAll(".hw-commit").forEach(function (btn) {
        btn.addEventListener("pointerdown", function () {
          if (ctx.done || !ctx.live || ctx.state.phase !== 1 || btn.disabled) return;
          if (btn.dataset.bad === "1") {
            gameBossIncident._phase2(ctx);
          } else {
            btn.disabled = true;
            btn.classList.add("hw-frag-used");
            ctx.state.err += ctx.params.wrongSpike; // reverting the wrong thing makes it worse
            sfx("fail");
            shake();
          }
        });
      });
    },
    _phase2: function (ctx) {
      ctx.state.phase = 2;
      sfx("verb");
      var graph = $("hw-err-graph").outerHTML;
      scene.innerHTML =
        '<div id="hw-incident-scene" class="hw-screen" style="gap:0.7em;">' +
          graph +
          '<button id="hw-rollback" class="hw-btn" style="font-size:1.2em; padding:0.75em 2.2em;">ROLLBACK</button>' +
          '<p class="hw-hint" id="hw-incident-hint">found it! now MASH — rewind the deploy to 100%: <span id="hw-rb-pct">0</span>%</p>' +
        '</div>';
      $("hw-rollback").addEventListener("pointerdown", function () {
        if (ctx.done) return;
        ctx.state.progress = Math.min(1, ctx.state.progress + ctx.params.mashGain);
        sfx("tick");
        var pct = $("hw-rb-pct");
        if (pct) pct.textContent = Math.round(ctx.state.progress * 100);
        // Win at the peak, in the same click — checking in update() ran after decay,
        // so 100% could never survive to the test (mash to full, nothing happens).
        if (ctx.state.progress >= 1) ctx.win("Rolled back. The graph is green again. +1 life.", 1);
      });
    },
    update: function (ctx, dt) {
      var s = ctx.state;
      if (s.phase === 1) {
        s.err = Math.min(1, s.err + ctx.params.climbPerSec * dt / 1000);
      } else {
        s.progress = Math.max(0, s.progress - ctx.params.decayPerSec * dt / 1000); // the deploy resists
        s.err = Math.min(1, Math.max(0, s.err - s.progress * 0.02 + 0.015 * dt / 1000));
      }
      var fill = $("hw-err-fill");
      if (fill) {
        fill.setAttribute("y", 24 - s.err * 22);
        fill.setAttribute("height", s.err * 22);
      }
      var g = $("hw-err-graph");
      if (g) { g.dataset.p = s.progress.toFixed(3); g.dataset.err = s.err.toFixed(3); } // live state for the headless player
      if (s.err >= 1) return ctx.fail("Escalated. Enjoy the postmortem.");
    },
    onTimeout: function (ctx) { ctx.fail("The incident outlasted you."); }
  };

  /* ============================================================
     BOSS: FUNNEL RESCUE — users are falling; steer the funnel.
     One input: hold to slide right, release to drift left. Catch
     4 of 6 in the funnel mouth = retained = +1 life.
     ============================================================ */
  var gameBossFunnel = {
    id: "boss-funnel", value: "BOSS", verb: "FUNNEL RESCUE!", input: "space", boss: true,
    instruction: "catch falling users. retain 4.",
    baseDurationMs: 30000,
    params: { need: 4, funnelSpeed: 0.68, mouth: 0.09 },
    /* Wave of 8, realistic retention math (need 4 pts of 9 possible ≈ 44%):
       normals, fast fallers, floaters, and one whale worth 2 — net revenue
       retention as a game rule. The wave escalates: later users spawn
       closer together and fall faster. */
    setup: function (ctx) {
      var s = ctx.state;
      s.holding = false;
      s.fx = 0.5;
      s.retained = 0;
      s.resolved = 0;
      s.total = 0;
      s.caught = 0;
      s.effects = [];
      var types = shuffle(["n", "n", "n", "n", "fast", "fast", "float", "whale"], run.rng);
      s.users = [];
      var born = 600;
      for (var i = 0; i < types.length; i++) {
        var t = types[i];
        var speedUp = 1 - i * 0.035; // escalation: later users fall faster
        s.users.push({
          type: t,
          x: 0.1 + run.rng() * 0.8,
          bornAt: born,
          fallMs: (t === "fast" ? 1500 : t === "float" ? 2600 : t === "whale" ? 2900 : 2100) * speedUp,
          worth: t === "whale" ? 2 : 1,
          y: -0.1, done: false, bounced: false
        });
        born += 1500 - i * 90; // escalation: the wave crowds up
      }
      s.total = types.length;
      scene.innerHTML =
        '<div id="hw-funnel-scene" class="hw-screen" style="justify-content:flex-end; padding-bottom:1.6em;">' +
          '<svg id="hw-funnel-rink" width="100%" height="210" viewBox="0 0 400 110" preserveAspectRatio="none">' +
            '<rect x="0" y="104" width="400" height="6" fill="var(--chip-bg)"/>' +
            '<text x="12" y="100" font-size="9" fill="var(--muted)">churned</text>' +
            '<text x="352" y="100" font-size="9" fill="var(--muted)">churned</text>' +
            '<g id="hw-funnel-users"></g>' +
            '<g id="hw-funnel">' +
              '<path id="hw-funnel-path" d="" fill="none" stroke="var(--accent)" stroke-width="3" stroke-linecap="round"/>' +
              '<text id="hw-funnel-label" y="107" font-size="9" fill="var(--accent)" text-anchor="middle">retained: 0/' + ctx.params.need + '</text>' +
            '</g>' +
          '</svg>' +
          '<p class="hw-hint">retain <b>4</b> — the <b>$</b> whale counts double · hold <span class="hw-kbd">space</span> / press = right · release = left</p>' +
        '</div>';
    },
    update: function (ctx, dt) {
      var s = ctx.state, p = ctx.params;
      s.fx = Math.max(0.08, Math.min(0.92, s.fx + (s.holding ? 1 : -1) * p.funnelSpeed * dt / 1000));
      var fpx = 14 + s.fx * 372;
      var path = $("hw-funnel-path");
      if (path) path.setAttribute("d", "M" + (fpx - 26) + " 78 L" + (fpx - 8) + " 96 L" + (fpx + 8) + " 96 L" + (fpx + 26) + " 78");
      var label = $("hw-funnel-label");
      if (label) { label.setAttribute("x", fpx); label.textContent = "retained: " + s.retained + "/" + p.need; }
      var rink = $("hw-funnel-rink");
      var lowest = null;
      var usersG = $("hw-funnel-users");
      var dotsSvg = "";
      for (var i = 0; i < s.users.length; i++) {
        var u = s.users[i];
        if (u.done || ctx.elapsed < u.bornAt) continue;
        u.y = (ctx.elapsed - u.bornAt) / u.fallMs;
        var ux = 14 + u.x * 372, uy = u.y * 92;
        if (u.y >= 0.82 && u.y < 1 && !u.bounced && Math.abs(u.x - s.fx) < p.mouth) {
          u.done = true; s.resolved++; s.caught++; s.retained += u.worth;
          s.effects.push({ kind: "catch", x: fpx, y: 84, worth: u.worth, until: ctx.elapsed + 500 });
          sfx("pass");
          continue;
        }
        // Near miss: clip the funnel rim — bounce sideways and churn in full view.
        if (u.y >= 0.82 && !u.bounced && Math.abs(u.x - s.fx) < p.mouth + 0.055) {
          u.bounced = true;
          u.bounceDir = u.x < s.fx ? -1 : 1;
        }
        if (u.bounced) u.x = Math.max(0.03, Math.min(0.97, u.x + u.bounceDir * 0.28 * dt / 1000));
        if (u.y >= 1) {
          u.done = true; s.resolved++;
          s.effects.push({ kind: "churn", x: ux, y: 100, until: ctx.elapsed + 600 });
          sfx("whiff");
          continue;
        }
        // Draw by type: whale is big with a ring, fast has a streak, floater is airy.
        if (u.type === "whale") {
          dotsSvg += '<circle cx="' + ux + '" cy="' + uy + '" r="8.5" fill="var(--text)" opacity="0.9"/>' +
            '<circle cx="' + ux + '" cy="' + uy + '" r="11.5" fill="none" stroke="var(--accent)" stroke-width="1.5" stroke-dasharray="4 3"/>' +
            '<text x="' + ux + '" y="' + (uy + 3) + '" font-size="8" text-anchor="middle" fill="var(--bg)" font-weight="bold">$</text>';
        } else if (u.type === "fast") {
          dotsSvg += '<line x1="' + ux + '" y1="' + (uy - 12) + '" x2="' + ux + '" y2="' + (uy - 5) + '" stroke="var(--muted)" stroke-width="2" opacity="0.6"/>' +
            '<circle cx="' + ux + '" cy="' + uy + '" r="4.2" fill="var(--text)" opacity="0.9"/>';
        } else if (u.type === "float") {
          dotsSvg += '<path d="M' + (ux - 7) + ' ' + (uy - 8) + ' Q' + ux + ' ' + (uy - 15) + ' ' + (ux + 7) + ' ' + (uy - 8) + '" fill="none" stroke="var(--muted)" stroke-width="1.5"/>' +
            '<circle cx="' + ux + '" cy="' + uy + '" r="5" fill="var(--text)" opacity="0.7"/>';
        } else {
          dotsSvg += '<circle cx="' + ux + '" cy="' + uy + '" r="5" fill="var(--text)" opacity="0.85"/>' +
            '<circle cx="' + (ux - 2) + '" cy="' + (uy - 2) + '" r="1.2" fill="var(--bg)"/>';
        }
        if (!u.bounced && (lowest === null || u.y > lowest.y)) lowest = u;
      }
      // Transient juice: "+1"/"+2" popping from the funnel, churn puffs at the floor.
      s.effects = s.effects.filter(function (e) { return ctx.elapsed < e.until; });
      s.effects.forEach(function (e) {
        var lifeFrac = 1 - (e.until - ctx.elapsed) / (e.kind === "catch" ? 500 : 600);
        if (e.kind === "catch") {
          dotsSvg += '<text x="' + e.x + '" y="' + (e.y - lifeFrac * 16) + '" font-size="10" font-weight="bold" text-anchor="middle" fill="var(--accent)" opacity="' + (1 - lifeFrac) + '">+' + e.worth + '</text>';
        } else {
          dotsSvg += '<circle cx="' + e.x + '" cy="' + e.y + '" r="' + (4 + lifeFrac * 5) + '" fill="none" stroke="var(--muted)" stroke-width="1.5" opacity="' + (0.6 * (1 - lifeFrac)) + '"/>';
        }
      });
      if (usersG) usersG.innerHTML = dotsSvg;
      if (rink) {
        rink.dataset.fx = s.fx.toFixed(3);
        rink.dataset.nextx = lowest ? lowest.x.toFixed(3) : "-1";
      }
      if (s.resolved >= s.total && s.effects.length === 0) {
        var pctRet = Math.round(s.caught / s.total * 100);
        if (s.retained >= p.need) return ctx.win(pctRet + "% retained — suspiciously good. +1 life.", 1);
        return ctx.fail(pctRet + "% retention. The churn postmortem writes itself.");
      }
    },
    onPress: function (ctx) { ctx.state.holding = true; },
    onRelease: function (ctx) { ctx.state.holding = false; },
    onTimeout: function (ctx) { ctx.fail("Everyone churned while you watched."); }
  };

  // Rotation pool: FUNNEL only, per playtest — CURL and INCIDENT shelved (need more
  // love), QUERY shelved earlier (quiz, not game). Shelved bosses stay summonable
  // via ?boss= for future rework; they're just out of the daily rotation.
  var BOSSES = [gameBossFunnel];
  var SHELVED_BOSSES = [gameBossHedgehog, gameBossIncident, gameBossQuery];
  var BOSS_FORCED = null;
  try {
    var bq = new URLSearchParams(location.search).get("boss");
    if (bq) BOSSES.concat(SHELVED_BOSSES).forEach(function (b) { if (b.id.indexOf(bq) >= 0) BOSS_FORCED = b; });
  } catch (e) {}

  var GAMES = [gameDrive, gamePublish, gameWeird, gameShip, gameAim];

  /* ============================================================
     ENGINE — state machine + timer + input routing
     ============================================================ */
  var run = null;      // active run state
  var active = null;   // active microgame ctx
  var rafId = null;

  function newRun() {
    var startSpeed = paceVariant === "brisk" ? 0.85 : 1.0;
    var rng = mulberry32(DAY_NUM * 2654435761); // daily seed: same gauntlet for everyone today
    return {
      score: 0, cleared: 0, loop: 1, speed: startSpeed, lives: LIVES,
      trail: [], rng: rng, order: shuffle(GAMES.slice(), rng), idx: 0, phase: "verb"
    };
  }
  function shuffle(a, rng) {
    for (var i = a.length - 1; i > 0; i--) {
      var j = Math.floor(rng() * (i + 1)), t = a[i]; a[i] = a[j]; a[j] = t;
    }
    return a;
  }

  function updateHud() {
    // Microgame HUD is just hero-timer + lives now; loop/level live on the desktop + announce cards.
    document.querySelectorAll("#hw-hud-lives .hw-life").forEach(function (img, i) {
      img.classList.toggle("hw-life-lost", i >= run.lives);
    });
  }

  function startRun() {
    run = newRun();
    // Life icons rendered from LIVES so the count stays a one-line change (and flag-testable later).
    var livesEl = $("hw-hud-lives");
    livesEl.innerHTML = "";
    for (var i = 0; i < LIVES; i++) {
      var img = document.createElement("img");
      img.className = "hw-life";
      img.src = "images/hogware/max-life.png";
      img.alt = "";
      livesEl.appendChild(img);
    }
    capture("hogware_run_started", { pace_variant: paceVariant, lives: LIVES });
    conductor.unlock(); // we're inside a user gesture here (START click or space)
    conductor.start(1 / run.speed); // fresh anchor + rate; brisk variant starts faster, music will too
    conductor.loadAssets(); // lazy, once; game plays with synth blips until buffers land
    conductor.startMusic();
    crtBlip("hw-poweron"); // the monitor wakes up
    show(hud); updateHud();
    nextGame();
  }

  function nextGame() {
    // The slot after the last regular game is the boss — daily seed picks which one (pool of 1, for now).
    var game = run.idx >= run.order.length
      ? (BOSS_FORCED || BOSSES[DAY_NUM % BOSSES.length])
      : run.order[run.idx];
    screens.verb.classList.toggle("hw-verb-boss", !!game.boss);
    hud.classList.toggle("hw-hud-boss", !!game.boss);
    hide(hud); // desktop shows its taskbar; the gameplay HUD is for inside a program
    swapScreens(screens.verb, function () {
      updateHud(); // loop counter can change between games
      timerFill.style.transform = "scaleX(1)"; // fresh bar behind the verb card
      $("hw-verb-word").textContent = game.verb;
      // A: the window is the value's program — titled as its .exe (the desktop icon carries the phrase).
      $("hw-appwin-title").textContent = game.boss ? valueSlug(game.verb) + ".exe" : valueSlug(game.value) + ".exe";
      // C: light up this value's app icon on the desktop (bosses light none).
      document.querySelectorAll("#hw-desk-icons .hw-desk-icon").forEach(function (el) {
        el.classList.toggle("hw-desk-active", !game.boss && el.dataset.id === game.id);
      });
      // One-second cards get ONE word; the value names live in the quotes and flavors.
      var valEl = $("hw-verb-value");
      valEl.textContent = game.boss ? game.value : "";
      valEl.classList.toggle("hw-hidden", !game.boss);
      var instr = $("hw-verb-instr");
      instr.textContent = game.instruction || "";
      instr.classList.toggle("hw-hidden", !game.instruction);
      renderVerbStatus();
    }, function () {
      sfx("verb");
      // Bosses carry an instruction line — a noun card alone teaches nothing, so they hold longer.
      setTimeout(function () { playGame(game); }, game.boss ? VERB_MS * 2.2 : VERB_MS);
    });
  }

  /* The verb card doubles as the WarioWare "home scene": big Max lives bouncing
     on the beat, a stat tile, and the run's score drawn as a tiny insights-style
     sparkline — status as furniture, not chrome. */
  function renderVerbStatus() {
    stage.style.setProperty("--beat", conductor.beatMs() + "ms");
    var livesEl = $("hw-verb-lives");
    livesEl.innerHTML = "";
    for (var i = 0; i < run.lives; i++) {
      var img = document.createElement("img");
      img.className = "hw-life-big";
      img.src = "images/hogware/max-life.png";
      img.alt = "";
      livesEl.appendChild(img);
    }
    // One honest number: LOOP N, gaining a "· FAST" only once speed-ups begin (loop 4+).
    // Level tier is communicated by the LEVEL UP! cards as events, not a persistent token.
    $("hw-verb-tile").textContent = "LOOP " + run.loop + (run.loop >= 4 ? " · FAST" : "");
    // The relocated flavor line: what just happened, in the window's status bar.
    $("hw-appwin-status").textContent = run.lastStatus || "ready.";
  }

  function playGame(game) {
    // Difficulty level: loop 1 = L1, loop 2 = L2, loop 3+ = L3 (speed takes over from loop 4).
    var levelIdx = Math.min(run.loop - 1, 2);
    var levelParams = (game.levels && game.levels[levelIdx]) || {};
    // Levels that add a time-costing mechanic (e.g. the stall stop) can buy more clock.
    var duration = (levelParams.durationMs || game.baseDurationMs) * run.speed;
    stage.dataset.level = levelIdx + 1; // exposed for tests/debugging
    stage.dataset.boss = game.boss ? "1" : "0";
    stage.dataset.live = "0";
    active = {
      game: game,
      params: Object.assign({}, game.params, levelParams),
      state: {},
      elapsed: 0,
      duration: duration,
      done: false,
      live: false, // activation barrier: no clock, no input until the zoom lands
      win: function (flavor, bonus) { settle(true, flavor, bonus || 0); },
      fail: function (flavor) { settle(false, flavor, 0); }
    };
    var thisActive = active;
    swapScreens(scene, function () {
      scene.innerHTML = "";
      scene.style.pointerEvents = "none"; // a fading-in scene is never clickable
      show(hud); // back inside a program: the gameplay HUD returns
      game.setup(thisActive);
    }, function () {
      if (active !== thisActive || active.done) return;
      active.live = true;
      stage.dataset.live = "1"; // exposed for the headless test to wait on
      scene.style.pointerEvents = "";
      // Pre-held input counts for HOLD games (DRIVE, boss charge) — but never for
      // press-to-stop games (AIM), where a carried-over hold would fire instantly.
      if (game.input === "space" && game.onPress && game.preHold !== false && holdActive()) game.onPress(active);
      startClock(game);
    });
  }

  function startClock(game) {
    timerFill.classList.remove("hw-timer-warm", "hw-timer-hot");
    var last = performance.now();
    (function tick(now) {
      if (!active || active.done) return;
      var dt = Math.min(now - last, 100); last = now; // clamp: a backgrounded tab must not dump one giant dt and drain the game
      active.elapsed += dt;
      var frac = Math.max(0, 1 - active.elapsed / active.duration);
      timerFill.style.transform = "scaleX(" + frac + ")";
      timerFill.classList.toggle("hw-timer-warm", frac <= 0.6 && frac > 0.3); // green → yellow → red
      timerFill.classList.toggle("hw-timer-hot", frac <= 0.3);
      if (game.update) game.update(active, dt);
      if (!active || active.done) return; // a game can resolve inside update()
      if (active.elapsed >= active.duration) {
        if (game.onTimeout) game.onTimeout(active);
        if (active && !active.done) settle(false, "Time.", 0);
        return;
      }
      rafId = requestAnimationFrame(tick);
    })(last);
  }

  function settle(pass, flavor, bonus) {
    if (!active || active.done) return;
    active.done = true;
    if (rafId) cancelAnimationFrame(rafId);
    var game = active.game;
    active = null;
    stage.dataset.live = "0";
    scene.style.pointerEvents = "none"; // outgoing scene is inert the instant the game resolves

    if (pass) {
      run.cleared++;
      run.score += 1 + bonus;
      if (game.boss) run.lives = Math.min(LIVES, run.lives + 1); // the boss gives a life back — that's what lets good runs go deep
      run.trail.push(game.boss ? "🟪" : (bonus > 0 ? "🟨" : "🟩")); // purple = boss; gold = style bonus; both unexplained on purpose
      sfx("pass");
      capture("hogware_microgame_cleared", { game: game.id, value: game.value, loop: run.loop, bonus: bonus });
    } else {
      run.lives--;
      run.trail.push("🟥");
      sfx("fail");
      shake();
    }
    updateHud();

    // The wit doesn't fit a 0.8s flash — the flash is just the verdict + bonus;
    // the flavor line relocates to the desktop status bar, which has reading time.
    run.lastStatus = (pass ? "✓ " : "✗ ") + (flavor || "") +
      (!pass && run.lives > 0 ? " (" + run.lives + (run.lives === 1 ? " life" : " lives") + " left)" : "");
    hideAllScreens();
    var word = $("hw-result-word");
    word.textContent = pass ? (bonus > 0 ? "CLEARED +" + bonus : "CLEARED") : "MISSED";
    word.className = "hw-result-word " + (pass ? "hw-pass" : "hw-fail");
    $("hw-result-flavor").textContent = ""; // moved to the desktop status bar
    show(screens.result);

    setTimeout(function () {
      if (!pass && run.lives <= 0) return gameOver();
      run.idx++;
      if (run.idx > run.order.length) {
        // Boss is done (win or survive-the-fail): the loop closes and the level-up unlocks.
        run.idx = 0;
        run.loop++;
        // Pure axes, like real WarioWare: LEVEL UP changes only the game configs
        // (new complications), SPEED UP changes only the clock. Never both at once.
        if (run.loop <= 3) {
          showAnnounce("LEVEL UP!", "new complications");
        } else {
          run.speed = Math.max(SPEED_FLOOR, run.speed * SPEED_DECAY);
          conductor.setRate(1 / run.speed); // music/beat tempo mirrors the game clock, brisk variant included
          showAnnounce("SPEED UP!", "same games. less time.");
        }
        run.order = shuffle(run.order, run.rng);
      } else {
        nextGame(); // idx === order.length lands on the boss slot
      }
    }, RESULT_MS);
  }

  /* ---- Interstitial: escalation announcement + a real value quote (skippable) ---- */
  var quoteTimer = null;
  function showAnnounce(word, axisNote) {
    run.phase = "quote";
    swapScreens(screens.quote, function () {
      var pool = QUOTES.slice();
      if (ph()) pool.push(REPLAY_QUOTE);
      var q = pool[Math.floor(Math.random() * pool.length)];
      var wordEl = $("hw-announce-word");
      wordEl.textContent = word;
      wordEl.classList.toggle("hw-announce-speed", word === "SPEED UP!");
      $("hw-announce-axis").textContent = axisNote || "";
      $("hw-quote-text").textContent = q.text;
      $("hw-quote-source").textContent = q.value + " — posthog.com/handbook/values";
    }, function () {
      sfx("level");
      quoteTimer = setTimeout(endQuote, QUOTE_MS);
    });
  }
  function endQuote() {
    if (transitioning) return; // a press mid-swap must not double-advance the phase machine
    if (quoteTimer) { clearTimeout(quoteTimer); quoteTimer = null; }
    if (!run || run.phase !== "quote") return;
    run.phase = "verb";
    nextGame();
  }

  /* ---- Game over + leaderboard ---- */
  function trailGrid() {
    // Wordle's trick: rows = loops (5 games + the boss), so survival depth reads at a glance in Slack.
    var rows = [];
    for (var i = 0; i < run.trail.length; i += 6) rows.push(run.trail.slice(i, i + 6).join(""));
    return "🦔 HogWare #" + DAY_NUM + " · " + run.score + "\n" + rows.join("\n");
  }
  function resultString() {
    // Flag experiment 'hogware-share-taunt': does a challenge line raise the copy->share rate?
    // (A lives-count flag was considered and rejected: it would break daily-leaderboard fairness.)
    var taunt = "";
    try {
      var p = ph();
      if (p && p.getFeatureFlag && p.getFeatureFlag("hogware-share-taunt") === "taunt") {
        taunt = "\nbeat " + run.score + " or churn.";
      }
    } catch (e) {}
    return trailGrid() + taunt + "\nhttps://whoischrislam.github.io/hogware.html";
  }
  function gameOver() {
    hide(hud);
    conductor.stop(); // scheduler only runs during an active run
    conductor.stopMusic();
    sfx("over");
    var best = 0;
    try { best = parseInt(localStorage.getItem("hogware_best") || "0", 10); } catch (e) {}
    var isBest = run.score > best;
    if (isBest) { try { localStorage.setItem("hogware_best", String(run.score)); } catch (e) {} }

    $("hw-final-score").textContent = run.score;
    $("hw-final-stats").textContent =
      (isBest ? "new best · " : "") + "loop " + run.loop + " · " + run.cleared + " cleared";
    var trailEl = $("hw-trail");
    trailEl.textContent = trailGrid();
    trailEl.classList.toggle("hw-trail-deep", run.trail.length > 42); // deep runs compress so the dialog stays contained

    var copyBtn = $("hw-copy");
    copyBtn.textContent = "COPY RESULT";
    copyBtn.onclick = function () {
      var done = function () { copyBtn.textContent = "COPIED — go start a leaderboard war"; };
      capture("hogware_result_copied", { day: DAY_NUM, score: run.score });
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(resultString()).then(done, done);
      } else { done(); }
    };

    capture("hogware_run_completed", {
      day: DAY_NUM, score: run.score, stages_cleared: run.cleared, loops_reached: run.loop,
      lives_lost: LIVES - run.lives, pace_variant: paceVariant
    });

    // reset submit UI
    show($("hw-submit-row"));
    hide($("hw-submitted-note"));
    var initials = $("hw-initials");
    try { initials.value = localStorage.getItem("hogware_handle") || ""; } catch (e) {}

    swapScreens(screens.gameover, null, function () {
      renderLeaderboard();
      resetGameoverDesktop();
    });
  }

  /* ---------------- Game-over desktop: draggable windows + clickable value apps ---------------- */
  var zTop = 20;
  function focusWin(win) { win.style.zIndex = ++zTop; }
  function makeDraggable(win, bar) {
    bar.addEventListener("pointerdown", function (e) {
      if (e.target.closest("button, input, a, .hw-tbar-controls")) return; // grabbing a control, not the bar
      e.preventDefault();
      var host = screens.gameover.getBoundingClientRect();
      // Lazily pop out of flex-center into an absolute float at its current spot.
      if (!win.classList.contains("hw-floating")) {
        var wr0 = win.getBoundingClientRect();
        win.style.left = (wr0.left - host.left) + "px";
        win.style.top = (wr0.top - host.top) + "px";
        win.classList.add("hw-floating");
      }
      focusWin(win);
      var wr = win.getBoundingClientRect();
      var offX = e.clientX - wr.left, offY = e.clientY - wr.top;
      try { bar.setPointerCapture(e.pointerId); } catch (er) {}
      function move(ev) {
        var x = Math.max(0, Math.min(host.width - wr.width, ev.clientX - host.left - offX));
        var y = Math.max(0, Math.min(host.height - wr.height, ev.clientY - host.top - offY));
        win.style.left = x + "px"; win.style.top = y + "px";
      }
      function up() { bar.removeEventListener("pointermove", move); bar.removeEventListener("pointerup", up); }
      bar.addEventListener("pointermove", move);
      bar.addEventListener("pointerup", up);
    });
    win.addEventListener("pointerdown", function () { focusWin(win); });
  }
  function valueQuoteFor(vphrase) {
    for (var i = 0; i < QUOTES.length; i++) if (QUOTES[i].value === vphrase) return QUOTES[i];
    return null;
  }
  function openValueWindow(vphrase) {
    var q = valueQuoteFor(vphrase);
    if (!q) return;
    var slug = valueSlug(vphrase);
    var existing = document.getElementById("valwin-" + slug);
    if (existing) { focusWin(existing); return; } // already open — just raise it
    var win = document.createElement("div");
    win.className = "hw-win hw-floating hw-valwin hw-dialog"; // value windows float from birth
    win.id = "valwin-" + slug;
    win.innerHTML =
      '<div class="hw-dialog-bar hw-win-bar">' +
        '<span class="hw-dialog-title">' + slug + '.exe</span>' +
        '<span class="hw-tbar-controls"><b>_</b><b>□</b><b class="hw-close" role="button" aria-label="Close">×</b></span>' +
      '</div>' +
      '<div class="hw-valwin-body">' +
        '<p class="hw-valwin-quote">' + q.text + '</p>' +
        '<p class="hw-valwin-src">— ' + q.value + ' · posthog.com/handbook/values</p>' +
      '</div>';
    screens.gameover.appendChild(win);
    // cascade so stacked windows don't hide each other
    var n = document.querySelectorAll(".hw-valwin").length;
    win.style.left = (18 + n * 22) + "%";
    win.style.top = (16 + n * 10) + "%";
    focusWin(win);
    makeDraggable(win, win.querySelector(".hw-win-bar"));
    win.querySelector(".hw-close").addEventListener("click", function () { win.remove(); });
    capture("hogware_value_opened", { value: q.value });
  }
  var goDeskWired = false;
  function resetGameoverDesktop() {
    // Fresh run: clear any value windows, un-float the hero dialog so flex re-centers it.
    document.querySelectorAll(".hw-valwin").forEach(function (w) { w.remove(); });
    var dlg = $("hw-go-dialog");
    dlg.classList.remove("hw-floating");
    dlg.style.left = ""; dlg.style.top = ""; dlg.style.zIndex = "";
    document.querySelectorAll("#hw-go-icons .hw-desk-icon").forEach(function (o) { o.classList.remove("hw-desk-active"); });
    if (goDeskWired) return;
    goDeskWired = true;
    makeDraggable(dlg, dlg.querySelector(".hw-win-bar"));
    document.querySelectorAll("#hw-go-icons .hw-desk-icon").forEach(function (icon) {
      var vphrase = icon.querySelector("i").textContent;
      var select = function () {
        document.querySelectorAll("#hw-go-icons .hw-desk-icon").forEach(function (o) { o.classList.remove("hw-desk-active"); });
        icon.classList.add("hw-desk-active");
      };
      icon.addEventListener("click", select);
      icon.addEventListener("dblclick", function () { openValueWindow(vphrase); });
      icon.addEventListener("keydown", function (e) { if (e.key === "Enter") { select(); openValueWindow(vphrase); } });
    });
  }

  function submitScore() {
    var initials = $("hw-initials");
    var handle = (initials.value || "HOG").toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 3) || "HOG";
    try { localStorage.setItem("hogware_handle", handle); } catch (e) {}
    capture("hogware_score_submitted", {
      handle: handle, day: DAY_NUM, score: run.score, stages_cleared: run.cleared, loops_reached: run.loop
    });
    hide($("hw-submit-row"));
    var note = $("hw-submitted-note");
    note.textContent = ph()
      ? handle + " → beamed to PostHog. The leaderboard is literally a HogQL query."
      : "Analytics is off on this browser (?notrack=1), so this score stays between us.";
    show(note);
    renderLeaderboard();
  }

  function renderLeaderboard() {
    var el = $("hw-leaderboard");
    // file:// (local dev, headless tests) has origin "null" — the Worker's CORS
    // rightly rejects it, so don't fetch at all; show the local-best fallback.
    if (!WORKER_URL || location.protocol === "file:") {
      var best = 0;
      try { best = parseInt(localStorage.getItem("hogware_best") || "0", 10); } catch (e) {}
      el.innerHTML = best ? "personal best on this browser: <b>" + best + "</b> · global leaderboard: wiring in progress" : "";
      return;
    }
    el.textContent = "loading leaderboard…";
    fetch(WORKER_URL + "?day=" + DAY_NUM).then(function (r) { return r.json(); }).then(function (rows) {
      if (!rows || !rows.length) { el.textContent = "no scores yet — be the first."; return; }
      el.innerHTML = "<table>" + rows.slice(0, 10).map(function (row, i) {
        return "<tr><td>" + (i + 1) + "</td><td>" + String(row.handle || "???").slice(0, 3) + "</td><td>" + row.best + "</td></tr>";
      }).join("") + "</table>";
    }).catch(function () {
      el.textContent = "leaderboard unreachable — your run still counted.";
    });
  }

  /* ---------------- Unified input routing ----------------
     'space' games receive press/release from spacebar OR pointer on the stage.
     'click' games handle their own element listeners; stray stage presses are ignored. */
  function pressActive(e) {
    if (run && run.phase === "quote") return endQuote();
    if (!active || active.done || !active.live) return; // activation barrier: zooming-in games don't hear input
    var g = active.game;
    if (g.input === "space" && g.onPress) g.onPress(active, e);
  }
  function releaseActive() {
    if (!active || active.done) return;
    var g = active.game;
    if (g.input === "space" && g.onRelease) g.onRelease(active);
  }

  /* Real held-state tracking: players pre-hold space/touch before a game starts
     (especially DRIVE), and a "fresh press only" model reads that as no input —
     an unfair fail. playGame() consults holdActive() to synthesize the press. */
  var spaceHeld = false, pointerHeld = false;
  function holdActive() { return spaceHeld || pointerHeld; }

  document.addEventListener("keydown", function (e) {
    if (e.code !== "Space") return;
    var t = e.target;
    if (t && (t.tagName === "INPUT" || t.tagName === "BUTTON")) return;
    e.preventDefault();
    if (e.repeat) return;
    spaceHeld = true;
    if (!run && !screens.title.classList.contains("hw-hidden")) return startRun();
    pressActive(e);
  });
  document.addEventListener("keyup", function (e) {
    if (e.code === "Space") { spaceHeld = false; releaseActive(); }
  });
  window.addEventListener("blur", function () { spaceHeld = false; pointerHeld = false; releaseActive(); });
  stage.addEventListener("pointerdown", function (e) {
    pointerHeld = true;
    // For space-input games, any tap on the stage is the button.
    if (active && !active.done && active.live && active.game.input === "space") { e.preventDefault(); pressActive(e); }
    else if (run && run.phase === "quote") endQuote();
  });
  stage.addEventListener("pointerup", function () { pointerHeld = false; releaseActive(); });
  stage.addEventListener("pointercancel", function () { pointerHeld = false; releaseActive(); });

  /* ---------------- Boot ---------------- */
  document.addEventListener("DOMContentLoaded", function () {
    // Cold boot: the tube stays dark (hw-booting) while the power-on line does the
    // geometry, then the title snaps in crisp when it locks — never a gradual fade.
    if (reducedMotion) {
      stage.classList.remove("hw-booting");
    } else {
      setTimeout(function () {
        crtBlip("hw-poweron");
        setTimeout(function () { stage.classList.remove("hw-booting"); }, 430); // reveal as the line blooms full
      }, 200);
    }
    var best = 0;
    try { best = parseInt(localStorage.getItem("hogware_best") || "0", 10); } catch (e) {}
    if (best) {
      var line = $("hw-best-line");
      line.textContent = "personal best: " + best;
      show(line);
    }
    $("hw-start").addEventListener("click", startRun);
    $("hw-again").addEventListener("click", function () {
      startRun();
    });

    // Audio unlock: one-time, gesture-driven (iOS wants touchend/click, not touchstart).
    var unlockOnce = function () {
      conductor.unlock();
      document.removeEventListener("pointerup", unlockOnce);
      document.removeEventListener("keydown", unlockOnce);
    };
    document.addEventListener("pointerup", unlockOnce);
    document.addEventListener("keydown", unlockOnce);

    // Mute toggle. blur() after click is load-bearing: the keydown handler
    // ignores Space when a BUTTON has focus, so a focused mute button would
    // silently kill DRIVE/AIM (adversarial-review catch).
    var muteBtn = $("hw-mute");
    var muteLabel = function () { muteBtn.textContent = conductor.isMuted() ? "sound: off" : "sound: on"; };
    muteLabel();
    muteBtn.addEventListener("click", function () {
      conductor.setMuted(!conductor.isMuted());
      muteLabel();
      muteBtn.blur();
    });
    $("hw-submit").addEventListener("click", submitScore);
    $("hw-initials").addEventListener("keydown", function (e) {
      if (e.key === "Enter") submitScore();
      e.stopPropagation();
    });
    stage.focus({ preventScroll: true });
  });
})();
