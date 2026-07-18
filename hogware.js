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
      var trafColors = ["#2438C0", "#2E8B57", "#8C8C8C", "#C9972B"];
      var carSvg = function (fill) {
        return '<path d="M1 12 L1 6 L7 6 L11 1 L23 1 L27 6 L33 6 L33 12 Z" fill="' + fill + '" stroke="#101010" stroke-width="1.4" stroke-linejoin="round"/>' +
          '<rect x="12" y="2.4" width="4.6" height="3.4" fill="#CDEAF5" stroke="#101010" stroke-width="0.6"/>' +
          '<rect x="18" y="2.4" width="4.6" height="3.4" fill="#CDEAF5" stroke="#101010" stroke-width="0.6"/>' +
          '<circle cx="8" cy="12.5" r="3.4" fill="#111"/><circle cx="8" cy="12.5" r="1.2" fill="#999"/>' +
          '<circle cx="26" cy="12.5" r="3.4" fill="#111"/><circle cx="26" cy="12.5" r="1.2" fill="#999"/>';
      };
      var carsSvg = ctx.state.cars.map(function (c, i) {
        var fill = c.type === "stall" ? "#D01E1E" : trafColors[i % trafColors.length];
        return '<g class="hw-traffic" data-i="' + i + '" style="transform: translate(' + (40 + c.frac * 300) + 'px, 30px);">' +
          carSvg(fill) +
          (c.type === "stall" ? '<text class="hw-stall-warn" x="14" y="-3" font-size="13" font-weight="bold" fill="#D01E1E" opacity="0">!</text>' : '') +
          '</g>';
      }).join("");
      scene.innerHTML =
        '<div class="hw-screen" style="justify-content:flex-end; padding-bottom:2em;">' +
          '<svg width="100%" height="140" viewBox="0 0 400 70" preserveAspectRatio="none" aria-hidden="true">' +
            '<rect x="0" y="24" width="400" height="30" fill="#8C8C8C" stroke="#101010" stroke-width="1.4"/>' +   // road
            '<line x1="0" y1="39" x2="400" y2="39" stroke="#FCFBF5" stroke-width="2" stroke-dasharray="12 9"/>' + // centreline
            '<text x="380" y="20" font-size="17">🏁</text>' +
            carsSvg +
            '<g id="hw-car" style="transform: translate(6px, 30px);">' +
              carSvg("var(--accent)") +
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
    /* Scenes are stock-photo clichés rendered as cheesy 90s corporate clip-art
       (Office-97 CD-ROM energy) — the "boring photo" is unmistakably intentional,
       not generic. Each play picks one; each carries its own tailored mutations.
       A pulsing ring marks the next thing to weirdify; only clicks inside count.
       Aim is the skill, not mashing. */
    _scenes: [
      {
        id: "handshake",
        aria: "A stock photo of two businessmen shaking hands",
        // 90s clip-art: thick unifying outline, muted-corporate palette, a gold
        // "deal achieved" sunburst. Every mutable element carries an id.
        svg:
          '<rect id="hw-hs-bg" x="0" y="0" width="200" height="110" fill="#E3DAC6"/>' +
          '<rect x="0" y="84" width="200" height="26" fill="#CBBE9E"/>' +
          '<g stroke="#2b2b2b" stroke-width="1.1" stroke-linejoin="round">' +
            '<rect x="12" y="15" width="30" height="22" fill="#F4EFE2"/>' +
            '<polyline points="17,32 24,25 30,28 39,18" fill="none" stroke="#7B3B47" stroke-width="1.6"/>' +
          '</g>' +
          // gold sunburst behind the clasp — starts faint, a mutation cranks it
          '<g id="hw-hs-sun" style="opacity:0.22; transform-origin:100px 60px; transition:opacity .3s;">' +
            '<g stroke="#E6B325" stroke-width="4" stroke-linecap="round">' +
              '<line x1="100" y1="60" x2="146" y2="60"/><line x1="100" y1="60" x2="140" y2="82"/>' +
              '<line x1="100" y1="60" x2="123" y2="98"/><line x1="100" y1="60" x2="100" y2="106"/>' +
              '<line x1="100" y1="60" x2="77" y2="98"/><line x1="100" y1="60" x2="60" y2="82"/>' +
              '<line x1="100" y1="60" x2="54" y2="60"/><line x1="100" y1="60" x2="60" y2="38"/>' +
              '<line x1="100" y1="60" x2="77" y2="22"/><line x1="100" y1="60" x2="100" y2="14"/>' +
              '<line x1="100" y1="60" x2="123" y2="22"/><line x1="100" y1="60" x2="140" y2="38"/>' +
            '</g>' +
          '</g>' +
          '<g stroke="#2b2b2b" stroke-width="1.5" stroke-linejoin="round" stroke-linecap="round">' +
            // right potted plant (drawn under figures' right edge)
            '<g><rect x="176" y="72" width="15" height="15" fill="#B5713B"/>' +
              '<path d="M183 72c-7-9-3-19 0-22 3 3 7 13 0 22z" fill="#4B7A4E"/>' +
              '<path d="M184 74c6-6 14-4 17-1-4 5-11 8-17 1z" fill="#5C8C5A"/></g>' +
            // LEFT figure
            '<g id="hw-hs-lfig">' +
              // jacket body: sloped shoulders down to waist (not a dome)
              '<path d="M22 90 L25 58 Q27 49 37 48 L51 48 Q61 49 63 58 L66 90 Z" fill="#3B4A6B"/>' +
              // reaching forearm: a tapered, outlined sleeve
              '<path d="M56 56 Q76 60 92 65 L91 71 Q74 67 53 62 Z" fill="#3B4A6B"/>' +
              // neck cylinder anchoring head to torso
              '<rect x="40" y="39" width="8" height="10" fill="#E0B088"/>' +
              // shirt collar V + lapels + tie = a real suit
              '<polygon points="44,47 36,50 44,61 52,50" fill="#F4EFE2"/>' +
              '<path d="M36 50 L44 61 L44 49 Z" fill="#32405c"/><path d="M52 50 L44 61 L44 49 Z" fill="#32405c"/>' +
              '<polygon id="hw-hs-ltie" points="44,50 47,59 44,69 41,59" fill="#7B3B47" style="transform-origin:44px 53px;"/>' +
              '<circle id="hw-hs-lhead" cx="44" cy="30" r="11" fill="#E0B088"/>' +
              '<path d="M33 29 Q44 13 55 29 Q55 20 44 16 Q33 20 33 29 Z" fill="#5A4632"/>' +
              '<g id="hw-hs-leyes"><circle cx="40" cy="30" r="1.5" fill="#222"/><circle cx="48" cy="30" r="1.5" fill="#222"/></g>' +
              '<path d="M40 35 Q44 38 48 35" fill="none" stroke-width="1.2"/>' +
            '</g>' +
            // RIGHT figure
            '<g id="hw-hs-rfig">' +
              '<path d="M134 90 L137 58 Q139 49 149 48 L163 48 Q173 49 175 58 L178 90 Z" fill="#6B7280"/>' +
              '<path d="M144 56 Q124 60 108 65 L109 71 Q126 67 147 62 Z" fill="#6B7280"/>' +
              '<rect x="152" y="39" width="8" height="10" fill="#C68642"/>' +
              '<polygon points="156,47 148,50 156,61 164,50" fill="#F4EFE2"/>' +
              '<path d="M148 50 L156 61 L156 49 Z" fill="#59606b"/><path d="M164 50 L156 61 L156 49 Z" fill="#59606b"/>' +
              '<polygon points="156,50 159,59 156,69 153,59" fill="#3B4A6B"/>' +
              '<circle id="hw-hs-rhead" cx="156" cy="30" r="11" fill="#C68642"/>' +
              '<path d="M145 29 Q156 13 167 29 Q167 20 156 16 Q145 20 145 29 Z" fill="#2B2B2B"/>' +
              '<g id="hw-hs-reyes"><circle cx="152" cy="30" r="1.5" fill="#222"/><circle cx="160" cy="30" r="1.5" fill="#222"/></g>' +
              '<path d="M152 35 Q156 38 160 35" fill="none" stroke-width="1.2"/>' +
            '</g>' +
            // two mitten hands clasped, thumbs over — a real grip
            '<g id="hw-hs-hands">' +
              '<path d="M88 67 Q88 60 95 60 L100 61 Q104 63 104 67 Q104 72 99 72 L94 72 Q88 73 88 67 Z" fill="#E0B088"/>' +
              '<path d="M112 67 Q112 60 105 60 L100 61 Q96 63 96 67 Q96 72 101 72 L106 72 Q112 73 112 67 Z" fill="#C68642"/>' +
              '<path d="M94 61 Q98 57 102 61 Q100 64 96 63 Z" fill="#E0B088"/>' +
              '<line x1="101" y1="62" x2="100" y2="71" stroke-width="0.8"/><line x1="104" y1="63" x2="103" y2="71" stroke-width="0.8"/>' +
            '</g>' +
          '</g>' +
          '<text id="hw-hs-caption" x="100" y="102" text-anchor="middle" font-size="12" font-weight="bold" fill="#3B4A6B" font-family="Georgia,\'Times New Roman\',serif" letter-spacing="1.5">SYNERGY</text>',
        mutations: [
          // the clasp detonates into a fist-bump explosion
          { at: [100, 66], fn: function () { var e = $("hw-hs-hands"); e.innerHTML = '<g stroke="#2b2b2b" stroke-width="1.2" stroke-linejoin="round"><polygon points="100,50 104,62 116,60 106,68 111,80 100,72 89,80 94,68 84,60 96,62" fill="var(--accent)"/></g><text x="100" y="70" text-anchor="middle" font-size="7" font-weight="bold" fill="#fff">POW</text>'; } },
          // left guy: googly eyes
          { at: [46, 34], fn: function () { document.querySelectorAll("#hw-hs-leyes circle").forEach(function (c) { c.setAttribute("r", "3.6"); }); } },
          // right guy hedgehogs out
          { at: [156, 30], fn: function () { var e = $("hw-hs-rhead"); e.setAttribute("fill", "#5FB84B"); e.insertAdjacentHTML("beforebegin", '<g stroke="#101010" stroke-width="1.3" fill="#5FB84B"><line x1="151" y1="20" x2="148" y2="11"/><circle cx="147" cy="10" r="2.2"/><line x1="161" y1="20" x2="164" y2="11"/><circle cx="165" cy="10" r="2.2"/></g>'); $("hw-hs-reyes").innerHTML = '<ellipse cx="152" cy="30" rx="2.6" ry="3.4" fill="#111"/><ellipse cx="160" cy="30" rx="2.6" ry="3.4" fill="#111"/>'; } },
          // beige wall goes electric purple
          { at: [175, 18], fn: function () { $("hw-hs-bg").setAttribute("fill", "#B043D1"); } },
          // left tie becomes a propeller
          { at: [46, 58], fn: function () { $("hw-hs-ltie").classList.add("hw-anim-spin"); } },
          // caption defects
          { at: [100, 101], fn: function () { var e = $("hw-hs-caption"); e.textContent = "SYNERWEIRD"; e.setAttribute("fill", "var(--accent)"); } },
          // the deal ascends — sunburst blazes and rotates
          { at: [100, 44], fn: function () { var e = $("hw-hs-sun"); e.style.opacity = "1"; e.classList.add("hw-anim-spin"); } },
          // right guy achieves liftoff
          { at: [154, 72], fn: function () { $("hw-hs-rfig").classList.add("hw-anim-float"); } }
        ]
      },
      {
        id: "chart",
        aria: "A stock photo of a presenter pointing at a growth chart",
        svg:
          '<rect id="hw-ch-bg" x="0" y="0" width="200" height="110" fill="#E3DAC6"/>' +
          '<rect x="0" y="84" width="200" height="26" fill="#CBBE9E"/>' +
          '<g stroke="#2b2b2b" stroke-width="1.5" stroke-linejoin="round" stroke-linecap="round">' +
            '<rect x="90" y="14" width="98" height="64" fill="#F4EFE2"/>' +
            '<line x1="112" y1="78" x2="104" y2="97" stroke-width="2"/><line x1="168" y1="78" x2="176" y2="97" stroke-width="2"/>' +
            '<g id="hw-ch-bars" style="transform-origin:140px 72px;">' +
              '<rect x="102" y="56" width="13" height="18" fill="#9AA6B8"/>' +
              '<rect x="122" y="48" width="13" height="26" fill="#7B8AA0"/>' +
              '<rect x="142" y="38" width="13" height="36" fill="#5B6B85"/>' +
              '<rect x="162" y="26" width="13" height="48" fill="#3B4A6B"/>' +
            '</g>' +
            '<polyline id="hw-ch-line" points="108,56 128,48 148,38 172,24" fill="none" stroke="var(--accent)" stroke-width="2.5" stroke-linecap="round"/>' +
            '<g id="hw-ch-rocket" style="opacity:0; transform-origin:178px 22px; transition:opacity .3s;"><path d="M175 24 l3 -9 3 9 -3 3z" fill="var(--accent)"/><path d="M176 27 l-2 5 4 -2 4 2 -2 -5z" fill="#E6B325"/></g>' +
          '</g>' +
          '<g stroke="#2b2b2b" stroke-width="1.5" stroke-linejoin="round" stroke-linecap="round">' +
            '<g id="hw-ch-fig">' +
              '<path d="M14 96 L17 58 Q19 49 29 48 L43 48 Q53 49 55 58 L58 96 Z" fill="#3B4A6B"/>' +
              '<path d="M50 55 Q68 48 82 43 L85 49 Q70 55 53 61 Z" fill="#3B4A6B"/>' +
              '<line id="hw-ch-rod" x1="83" y1="45" x2="150" y2="32" stroke="#6B4A2B" stroke-width="2" stroke-linecap="round"/>' +
              '<path d="M79 43 Q79 39 83 39 L86 39 Q90 40 90 44 Q90 48 86 48 L83 48 Q79 48 79 43 Z" fill="#8D5524"/>' +
              '<rect x="34" y="39" width="8" height="10" fill="#8D5524"/>' +
              '<polygon points="38,47 30,50 38,61 46,50" fill="#F4EFE2"/>' +
              '<path d="M30 50 L38 61 L38 49 Z" fill="#32405c"/><path d="M46 50 L38 61 L38 49 Z" fill="#32405c"/>' +
              '<polygon id="hw-ch-tie" points="38,50 41,59 38,69 35,59" fill="#7B3B47" style="transform-origin:38px 53px;"/>' +
              '<circle id="hw-ch-head" cx="38" cy="30" r="11" fill="#8D5524"/>' +
              '<path d="M27 29 Q38 13 49 29 Q49 20 38 16 Q27 20 27 29 Z" fill="#1e1e1e"/>' +
              '<g id="hw-ch-eyes"><circle cx="34" cy="30" r="1.5" fill="#222"/><circle cx="42" cy="30" r="1.5" fill="#222"/></g>' +
              '<path d="M34 35 Q38 38 42 35" fill="none" stroke-width="1.2"/>' +
            '</g>' +
          '</g>' +
          '<text id="hw-ch-caption" x="100" y="102" text-anchor="middle" font-size="12" font-weight="bold" fill="#3B4A6B" font-family="Georgia,\'Times New Roman\',serif" letter-spacing="1.5">Q3 GROWTH</text>',
        mutations: [
          { at: [148, 38], fn: function () { var e = $("hw-ch-line"); e.setAttribute("points", "108,56 126,22 144,62 162,18 178,48"); e.setAttribute("stroke", "var(--accent)"); e.setAttribute("stroke-width", "3.5"); } }, // chart becomes a rollercoaster
          { at: [38, 30], fn: function () { $("hw-ch-eyes").innerHTML = '<circle cx="38" cy="30" r="4.4" fill="#fff" stroke="#111" stroke-width="0.8"/><circle cx="38" cy="31" r="2.1" fill="#111"/>'; } }, // presenter goes cyclops
          { at: [140, 50], fn: function () { var bs = document.querySelectorAll("#hw-ch-bars rect"); var tops = [30, 60, 22, 64]; bs.forEach(function (r, i) { r.setAttribute("y", tops[i]); r.setAttribute("height", 74 - tops[i]); }); $("hw-ch-bars").classList.add("hw-anim-float"); } }, // the bars jump up and dance
          { at: [180, 12], fn: function () { $("hw-ch-bg").setAttribute("fill", "#B043D1"); } }, // wall goes purple
          { at: [116, 38], fn: function () { var e = $("hw-ch-rod"); e.setAttribute("stroke", "var(--accent)"); e.setAttribute("stroke-width", "5"); e.insertAdjacentHTML("afterend", '<line x1="83" y1="45" x2="150" y2="32" stroke="#fff" stroke-width="1.6" stroke-linecap="round"/>'); } }, // pointer becomes a lightsaber
          { at: [100, 101], fn: function () { var e = $("hw-ch-caption"); e.textContent = "TO THE MOON"; e.setAttribute("fill", "var(--accent)"); } },
          { at: [178, 20], fn: function () { var e = $("hw-ch-rocket"); e.style.opacity = "1"; e.style.transform = "scale(1.7) translateY(-8px)"; e.classList.add("hw-anim-float"); } }, // the chart literally takes off
          { at: [38, 55], fn: function () { $("hw-ch-tie").classList.add("hw-anim-spin"); } } // tie propeller
        ]
      },
      {
        id: "headset",
        aria: "A stock photo of a smiling support agent in a headset",
        svg:
          '<rect id="hw-hd-bg" x="0" y="0" width="200" height="110" fill="#E3DAC6"/>' +
          '<rect x="0" y="84" width="200" height="26" fill="#CBBE9E"/>' +
          '<g stroke="#2b2b2b" stroke-width="1.1" stroke-linejoin="round"><rect x="150" y="14" width="36" height="22" fill="#F4EFE2"/><text x="168" y="28" text-anchor="middle" font-size="7" fill="#9AA6B8" font-family="Georgia,serif" letter-spacing="1">SMILE!</text></g>' +
          '<g stroke="#2b2b2b" stroke-width="1.5" stroke-linejoin="round" stroke-linecap="round">' +
            '<g id="hw-hd-fig">' +
              '<path d="M60 96 L64 62 Q66 52 80 51 L112 51 Q126 52 128 62 L132 96 Z" fill="#7B8AA0"/>' +
              '<path d="M120 60 Q132 54 138 46 L144 50 Q139 59 127 66 Z" fill="#7B8AA0"/>' +
              '<g id="hw-hd-thumb"><path d="M136 48 q7 -2 8 -9 q0 -4 4 -3 q3 1 2 6 l-2 5 q6 0 6 3 q0 4 -7 4 l-10 0 z" fill="#C68642"/></g>' +
              '<rect x="91" y="41" width="10" height="11" fill="#E0B088"/>' +
              '<circle id="hw-hd-head" cx="96" cy="32" r="13" fill="#E0B088"/>' +
              '<path d="M83 30 Q96 12 109 30 Q109 20 96 16 Q83 20 83 30 Z" fill="#5A4632"/>' +
              '<g id="hw-hd-set"><path d="M82 26 Q96 8 110 26" fill="none" stroke="#2b2b2b" stroke-width="3"/><rect x="80" y="30" width="6" height="10" rx="2" fill="#2b2b2b"/><path d="M83 38 Q74 45 87 47" fill="none" stroke="#2b2b2b" stroke-width="2"/><circle cx="88" cy="47" r="2.5" fill="#2b2b2b"/></g>' +
              '<g id="hw-hd-eyes"><circle cx="91" cy="32" r="1.8" fill="#222"/><circle cx="101" cy="32" r="1.8" fill="#222"/></g>' +
              '<path id="hw-hd-smile" d="M89 38 Q96 45 103 38" fill="none" stroke-width="1.6"/>' +
            '</g>' +
          '</g>' +
          '<text id="hw-hd-caption" x="96" y="102" text-anchor="middle" font-size="11" font-weight="bold" fill="#3B4A6B" font-family="Georgia,\'Times New Roman\',serif" letter-spacing="1">HOW CAN I HELP!</text>',
        mutations: [
          { at: [96, 42], fn: function () { $("hw-hd-smile").setAttribute("d", "M82 36 Q96 57 110 36"); $("hw-hd-smile").setAttribute("fill", "#7a1f1f"); } }, // the smile goes way too wide
          { at: [96, 32], fn: function () { $("hw-hd-eyes").innerHTML = '<circle cx="91" cy="32" r="4.6" fill="#fff" stroke="#222" stroke-width="0.8"/><circle cx="101" cy="32" r="4.6" fill="#fff" stroke="#222" stroke-width="0.8"/><circle cx="92" cy="33" r="2.1" fill="#222"/><circle cx="102" cy="33" r="2.1" fill="#222"/>'; } }, // googly pop
          { at: [96, 10], fn: function () { $("hw-hd-fig").insertAdjacentHTML("beforeend", '<g style="transform-origin:96px 9px;" class="hw-anim-spin"><rect x="95" y="5" width="3" height="9" fill="#2b2b2b"/><rect x="82" y="3" width="28" height="3" rx="1.5" fill="var(--accent)" stroke="#2b2b2b" stroke-width="0.8"/></g>'); } }, // propeller beanie
          { at: [26, 16], fn: function () { $("hw-hd-bg").setAttribute("fill", "#B043D1"); } }, // wall goes purple
          { at: [140, 48], fn: function () { var e = $("hw-hd-thumb"); e.querySelector("path").setAttribute("fill", "var(--accent)"); e.style.transformOrigin = "144px 48px"; e.style.transform = "scale(1.8)"; } }, // giant orange thumbs-up
          { at: [96, 101], fn: function () { var e = $("hw-hd-caption"); e.textContent = "HELP ME"; e.setAttribute("fill", "var(--accent)"); } },
          { at: [96, 24], fn: function () { $("hw-hd-eyes").insertAdjacentHTML("beforeend", '<g><circle cx="96" cy="23" r="3.3" fill="#fff" stroke="#222" stroke-width="0.8"/><circle cx="96" cy="23" r="1.6" fill="#222"/></g>'); } }, // third eye opens
          { at: [96, 72], fn: function () { $("hw-hd-fig").classList.add("hw-anim-float"); } } // liftoff
        ]
      },
      {
        id: "team",
        aria: "A stock photo of a diverse team celebrating around a laptop",
        svg:
          '<rect id="hw-tm-bg" x="0" y="0" width="200" height="110" fill="#E3DAC6"/>' +
          '<rect x="0" y="88" width="200" height="22" fill="#CBBE9E"/>' +
          '<g id="hw-tm-confetti" style="opacity:0; transition:opacity .3s;"><rect x="60" y="18" width="4" height="4" fill="var(--accent)"/><rect x="100" y="12" width="4" height="4" fill="#E6B325"/><rect x="140" y="18" width="4" height="4" fill="#1D4AFF"/><rect x="80" y="14" width="4" height="4" fill="#F1A82C"/><rect x="120" y="16" width="4" height="4" fill="var(--accent)"/></g>' +
          '<g stroke="#2b2b2b" stroke-width="1.5" stroke-linejoin="round" stroke-linecap="round">' +
            '<g id="hw-tm-group">' +
              '<g id="hw-tm-f1">' +
                '<path d="M20 90 L22 70 Q24 62 34 61 L44 61 Q52 62 54 70 L56 90 Z" fill="#3B4A6B"/>' +
                '<path d="M26 68 L31 68 L27 47 L22 47 Z" fill="#3B4A6B"/><ellipse cx="24" cy="45" rx="3.4" ry="4" fill="#E0B088"/>' + // left arm up + hand
                '<path d="M43 68 L48 68 L52 47 L47 47 Z" fill="#3B4A6B"/><ellipse cx="50" cy="45" rx="3.4" ry="4" fill="#E0B088"/>' + // right arm up + hand
                '<rect x="34" y="52" width="6" height="10" fill="#E0B088"/>' +
                '<circle id="hw-tm-h1" cx="37" cy="44" r="9" fill="#E0B088"/>' +
                '<path d="M28 43 Q37 29 46 43 Q46 35 37 32 Q28 35 28 43 Z" fill="#5A4632"/>' +
                '<g id="hw-tm-e1"><circle cx="34" cy="44" r="1.4" fill="#222"/><circle cx="40" cy="44" r="1.4" fill="#222"/></g><path d="M34 48 Q37 51 40 48" fill="none" stroke-width="1.1"/>' +
              '</g>' +
              '<g id="hw-tm-f2">' +
                '<path d="M80 92 L82 70 Q84 61 100 60 Q116 61 118 70 L120 92 Z" fill="#7B3B47"/>' +
                '<path d="M89 68 L94 68 L90 47 L85 47 Z" fill="#7B3B47"/><ellipse cx="87" cy="45" rx="3.4" ry="4" fill="#C68642"/>' + // left arm up + hand
                '<path d="M106 68 L111 68 L115 47 L110 47 Z" fill="#7B3B47"/><ellipse cx="113" cy="45" rx="3.4" ry="4" fill="#C68642"/>' + // right arm up + hand
                '<rect x="96" y="49" width="8" height="11" fill="#C68642"/>' +
                '<circle id="hw-tm-h2" cx="100" cy="40" r="10" fill="#C68642"/>' +
                '<path d="M90 39 Q100 24 110 39 Q110 30 100 26 Q90 30 90 39 Z" fill="#1e1e1e"/>' +
                '<g id="hw-tm-e2"><circle cx="96" cy="40" r="1.5" fill="#222"/><circle cx="104" cy="40" r="1.5" fill="#222"/></g><path d="M96 44 Q100 47 104 44" fill="none" stroke-width="1.2"/>' +
              '</g>' +
              '<g id="hw-tm-f3">' +
                '<path d="M144 90 L146 70 Q148 62 158 61 L168 61 Q176 62 178 70 L180 90 Z" fill="#6B7280"/>' +
                '<path d="M150 68 L155 68 L151 47 L146 47 Z" fill="#6B7280"/><ellipse cx="148" cy="45" rx="3.4" ry="4" fill="#8D5524"/>' + // left arm up + hand
                '<path d="M167 68 L172 68 L176 47 L171 47 Z" fill="#6B7280"/><ellipse cx="174" cy="45" rx="3.4" ry="4" fill="#8D5524"/>' + // right arm up + hand
                '<rect x="158" y="52" width="6" height="10" fill="#8D5524"/>' +
                '<circle id="hw-tm-h3" cx="161" cy="44" r="9" fill="#8D5524"/>' +
                '<path d="M152 43 Q161 29 170 43 Q170 35 161 32 Q152 35 152 43 Z" fill="#1e1e1e"/>' +
                '<g id="hw-tm-e3"><circle cx="158" cy="44" r="1.4" fill="#222"/><circle cx="164" cy="44" r="1.4" fill="#222"/></g><path d="M158 48 Q161 51 164 48" fill="none" stroke-width="1.1"/>' +
              '</g>' +
            '</g>' +
            '<g id="hw-tm-trophy">' +
              '<path d="M89 71 Q82 71 83 76 Q84 80 90 79" fill="none" stroke="#2b2b2b" stroke-width="2"/>' +  // left handle
              '<path d="M111 71 Q118 71 117 76 Q116 80 110 79" fill="none" stroke="#2b2b2b" stroke-width="2"/>' + // right handle
              '<path id="hw-tm-cup" d="M89 69 L111 69 L108 79 Q100 85 92 79 Z" fill="#E6B325"/>' +  // cup bowl
              '<rect x="97" y="84" width="6" height="4" fill="#C9972B"/>' +  // stem
              '<path d="M90 88 L110 88 L112 93 L88 93 Z" fill="#C9972B"/>' +  // base
              '<path d="M100 71 l1.3 2.7 2.9 .3 -2.2 2 .7 2.9 -2.7 -1.5 -2.7 1.5 .7 -2.9 -2.2 -2 2.9 -.3 z" fill="#fff"/>' +  // star
            '</g>' +
          '</g>' +
          '<text id="hw-tm-caption" x="100" y="104" text-anchor="middle" font-size="11" font-weight="bold" fill="#3B4A6B" font-family="Georgia,\'Times New Roman\',serif" letter-spacing="1.5">TEAMWORK</text>',
        mutations: [
          { at: [100, 16], fn: function () { var e = $("hw-tm-confetti"); e.innerHTML = '<rect x="58" y="16" width="6" height="6" fill="var(--accent)"/><rect x="100" y="10" width="6" height="6" fill="#E6B325"/><rect x="142" y="16" width="6" height="6" fill="#1D4AFF"/><rect x="78" y="12" width="6" height="6" fill="#F1A82C"/><rect x="122" y="14" width="6" height="6" fill="var(--accent)"/><rect x="40" y="20" width="6" height="6" fill="#1D4AFF"/><rect x="160" y="22" width="6" height="6" fill="#E6B325"/>'; e.style.opacity = "1"; e.classList.add("hw-anim-float"); } }, // confetti erupts
          { at: [100, 40], fn: function () { var e = $("hw-tm-h2"); e.setAttribute("fill", "#5FB84B"); e.insertAdjacentHTML("beforebegin", '<g stroke="#101010" stroke-width="1.3" fill="#5FB84B"><line x1="95" y1="31" x2="92" y2="22"/><circle cx="91" cy="21" r="2"/><line x1="105" y1="31" x2="108" y2="22"/><circle cx="109" cy="21" r="2"/></g>'); $("hw-tm-e2").innerHTML = '<ellipse cx="96" cy="40" rx="2.4" ry="3.1" fill="#111"/><ellipse cx="104" cy="40" rx="2.4" ry="3.1" fill="#111"/>'; } }, // center goes alien
          { at: [100, 74], fn: function () { $("hw-tm-cup").setAttribute("fill", "var(--accent)"); $("hw-tm-trophy").insertAdjacentHTML("beforeend", '<g><circle cx="96" cy="75" r="2.6" fill="#fff" stroke="#111" stroke-width="0.7"/><circle cx="104" cy="75" r="2.6" fill="#fff" stroke="#111" stroke-width="0.7"/><circle cx="96" cy="76" r="1.2" fill="#111"/><circle cx="104" cy="76" r="1.2" fill="#111"/></g>'); } }, // the trophy comes alive
          { at: [182, 14], fn: function () { $("hw-tm-bg").setAttribute("fill", "#B043D1"); } }, // wall goes purple
          { at: [37, 44], fn: function () { $("hw-tm-e1").innerHTML = '<circle cx="34" cy="44" r="3.2" fill="#fff" stroke="#222" stroke-width="0.7"/><circle cx="40" cy="44" r="3.2" fill="#fff" stroke="#222" stroke-width="0.7"/><circle cx="35" cy="45" r="1.4" fill="#222"/><circle cx="41" cy="45" r="1.4" fill="#222"/>'; } }, // googly pop
          { at: [100, 103], fn: function () { var e = $("hw-tm-caption"); e.textContent = "SYNERGY!!!"; e.setAttribute("fill", "var(--accent)"); } },
          { at: [161, 44], fn: function () { $("hw-tm-e3").innerHTML = '<circle cx="161" cy="44" r="3.8" fill="#fff" stroke="#111" stroke-width="0.8"/><circle cx="161" cy="45" r="1.8" fill="#111"/>'; } }, // f3 goes cyclops
          { at: [100, 70], fn: function () { $("hw-tm-group").classList.add("hw-anim-float"); } } // the whole team lifts off
        ]
      }
    ],
    /* ---- MS-Paint treatment ----
       One central pass turns the "competent clip-art" scenes into a
       deliberately-crude MS-Paint doodle: flat loud palette on a white
       canvas, thick black outlines, and a hand-drawn wobble filter on every
       edge. Crudeness becomes the joke, and it's native to the Win95 world.
       Central so the whole look is one dial (palette + wobble scale). */
    _paint: function (svg) {
      return svg
        .replace(/#E3DAC6/g, "#FCFBF5").replace(/#CBBE9E/g, "#BFE3A0") // canvas white, crude green ground
        .replace(/#F4EFE2/g, "#FFFFFF")                                 // boards go pure white
        .replace(/stroke="#2b2b2b"/g, 'stroke="#101010"')               // outlines go full black
        .replace(/stroke-width="1.5"/g, 'stroke-width="2.4"')           // ...and thicker
        .replace(/#3B4A6B/g, "#2438C0").replace(/#6B7280/g, "#8C8C8C")  // MS-paint blue / grey suits
        .replace(/#7B3B47/g, "#D01E1E").replace(/#5A4632/g, "#7A4A16")  // red tie / brown hair
        .replace(/#E0B088/g, "#F2C892").replace(/#C68642/g, "#D89A54")  // flat skins
        .replace(/#8D5524/g, "#B87333").replace(/#7B8AA0/g, "#57A0DC"); // deeper skin / support-blue shirt
    },
    _render: function (svg, uid) {
      return '<defs><filter id="pw-' + uid + '" x="-6%" y="-6%" width="112%" height="112%">' +
        '<feTurbulence type="fractalNoise" baseFrequency="0.022" numOctaves="2" seed="7" result="n"/>' +
        '<feDisplacementMap in="SourceGraphic" in2="n" scale="3" xChannelSelector="R" yChannelSelector="G"/>' +
        '</filter></defs><g filter="url(#pw-' + uid + ')">' + gameWeird._paint(svg) + '</g>';
    },
    setup: function (ctx) {
      ctx.state.count = 0;
      ctx.state.applied = 0;
      ctx.state.lastClick = 0;
      var pool = gameWeird._scenes;
      var forced = null;
      try { forced = new URLSearchParams(location.search).get("weird"); } catch (e) {}
      var scn = (forced && pool.filter(function (s) { return s.id === forced; })[0]) ||
                pool[Math.floor(run.rng() * pool.length)];
      ctx.state.order = shuffle(scn.mutations.slice(), run.rng);
      // Random starting spot (seeded) so the photo isn't always dead center.
      var ox = Math.round((run.rng() - 0.5) * 90), oy = Math.round((run.rng() - 0.5) * 40);
      scene.innerHTML =
        '<div class="hw-screen" style="justify-content:center;">' +
          '<div class="hw-w-wrap' + (ctx.params.drift ? ' hw-anim-wander-fast' : '') + '" style="width:min(70%, 340px); position:relative; margin:' + (20 + oy) + 'px 0 0 ' + ox + 'px;">' +
          '<svg id="hw-w-frame" width="100%" viewBox="0 0 200 110" style="background:#FCFBF5; border:1px solid var(--border-strong); border-radius:8px; cursor:crosshair; transition: transform 0.3s;" aria-label="' + scn.aria + '">' +
            gameWeird._render(scn.svg, scn.id) +
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
        gameWeird._jolt();
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
    _jolt: function () {
      var f = $("hw-w-frame");
      if (!f) return;
      f.classList.remove("hw-jolt"); void f.offsetWidth; f.classList.add("hw-jolt"); // reflow restarts the anim each hit
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
              // placeholder crude hedgehog (brown, not the accent) — swap in the hand-drawn one later
              '<g fill="#8A5A2B" stroke="#101010" stroke-width="1">' +
                '<path d="M1 13 l-3 -2 3 -1 z"/><path d="M2 7 l-3 -3 4 0 z"/><path d="M7 4 l-2 -4 4 1 z"/><path d="M13 3 l0 -4 3 3 z"/><path d="M18 6 l3 -3 0 4 z"/>' +
              '</g>' +
              '<circle cx="11" cy="14" r="9" fill="#8A5A2B" stroke="#101010" stroke-width="1.6"/>' +
              '<path d="M19 13 q5 0 5 3 q0 3 -5 2.5 z" fill="#F2C892" stroke="#101010" stroke-width="1"/>' +
              '<circle cx="23.5" cy="15.5" r="1.1" fill="#111"/>' +
              '<circle cx="13" cy="12" r="1.7" fill="#111"/>' +
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
    // A "user" glyph (head + shoulders) drawn at local origin, differentiated by
    // silhouette per the small-sprite research: whale=crown+$, float=balloon,
    // fast=speed streaks, normal=plain. Readable with colour stripped out.
    _userGlyph: function (type) {
      var skin = { n: "#E0B088", fast: "#C68642", float: "#E0B088", whale: "#F2C892" }[type] || "#E0B088";
      var shirt = { n: "#3B4A6B", fast: "#2E8B57", float: "#7B3B47", whale: "#E6B325" }[type] || "#3B4A6B";
      var extra = "";
      if (type === "whale") extra = '<path d="M-5 -4 l1 -5 3 3 1 -5 1 5 3 -3 1 5 z" fill="#E6B325" stroke="#101010" stroke-width="1"/><text x="0" y="11" font-size="6.5" text-anchor="middle" fill="#111" font-weight="bold">$</text>';
      else if (type === "fast") extra = '<line x1="-3" y1="-9" x2="-3" y2="-14" stroke="#6b6b63" stroke-width="1.4"/><line x1="3" y1="-9" x2="3" y2="-14" stroke="#6b6b63" stroke-width="1.4"/>';
      else if (type === "float") extra = '<line x1="0" y1="-5" x2="0" y2="-13" stroke="#101010" stroke-width="1"/><ellipse cx="0" cy="-17" rx="5" ry="6" fill="#1D4AFF" stroke="#101010" stroke-width="1.2"/>';
      return '<g stroke="#101010" stroke-width="1.4" stroke-linejoin="round">' + extra +
        '<path d="M-7 13 Q-7 4 0 4 Q7 4 7 13 Z" fill="' + shirt + '"/>' +
        '<circle cx="0" cy="0" r="5" fill="' + skin + '"/>' +
        '<circle cx="-1.8" cy="-0.3" r="0.9" fill="#111"/><circle cx="1.8" cy="-0.3" r="0.9" fill="#111"/>' +
      '</g>';
    },
    _meter: function (retained, need) {
      var out = '<text x="120" y="17" font-size="9" font-weight="bold" fill="#151515">RETAINED</text>';
      for (var i = 0; i < need; i++) {
        var sx = 170 + i * 17, filled = i < Math.min(retained, need);
        out += '<rect x="' + sx + '" y="7" width="14" height="14" rx="3" fill="' + (filled ? "#EAF3E0" : "#f3f2ec") + '" stroke="#101010" stroke-width="1.2"/>';
        if (filled) out += '<circle cx="' + (sx + 7) + '" cy="13" r="3.4" fill="#C68642" stroke="#101010" stroke-width="1"/>';
      }
      return out;
    },
    _squash: function () {
      var inner = $("hw-funnel-inner");
      if (!inner) return;
      inner.classList.remove("hw-funnel-squash"); void inner.offsetWidth; inner.classList.add("hw-funnel-squash");
    },
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
            '<rect x="0" y="0" width="400" height="110" fill="#FCFBF5"/>' +
            '<rect x="0" y="104" width="400" height="6" fill="#dcdcd4"/>' +
            // Layer order: funnel (back) → users (front, so catches are visible) → meter (top).
            // mouth rx (33) matches the catch half-width (0.09 * 372 ≈ 33px) so the
            // graphic's bounds equal the real catch zone — no clipping past the lip.
            '<g id="hw-funnel" style="transform:translate(200px,0)"><g id="hw-funnel-inner">' +
              '<ellipse cx="0" cy="74" rx="33" ry="5.5" fill="#B23800" stroke="#101010" stroke-width="1.6"/>' +
              '<path d="M-33 74 L-6 94 L-6 103 L6 103 L6 94 L33 74" fill="var(--accent)" stroke="#101010" stroke-width="1.6" stroke-linejoin="round"/>' +
              '<ellipse cx="0" cy="74" rx="28" ry="4" fill="#7A2600"/>' +
            '</g></g>' +
            '<g id="hw-funnel-users"></g>' +
            '<g id="hw-funnel-meter"></g>' +
          '</svg>' +
          '<p class="hw-hint">retain <b>4</b> — the <b>$</b> whale counts double · hold <span class="hw-kbd">space</span> / press = right · release = left</p>' +
        '</div>';
    },
    update: function (ctx, dt) {
      var s = ctx.state, p = ctx.params;
      s.fx = Math.max(0.08, Math.min(0.92, s.fx + (s.holding ? 1 : -1) * p.funnelSpeed * dt / 1000));
      var fpx = 14 + s.fx * 372;
      var fg = $("hw-funnel");
      if (fg) fg.style.transform = "translate(" + fpx + "px,0)";
      var mg = $("hw-funnel-meter");
      if (mg) mg.innerHTML = gameBossFunnel._meter(s.retained, p.need);
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
          s.effects.push({ kind: "catch", x0: ux, fx: fpx, worth: u.worth, type: u.type, until: ctx.elapsed + 420 });
          gameBossFunnel._squash();
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
          s.effects.push({ kind: "churn", x: ux, y: 94, type: u.type, dir: (u.x < 0.5 ? -1 : 1), until: ctx.elapsed + 650 });
          sfx("whiff");
          continue;
        }
        var sy = 1 + Math.min(0.26, Math.max(0, u.y) * 0.18); // fall-stretch reads as weight
        dotsSvg += '<g transform="translate(' + ux.toFixed(1) + ',' + uy.toFixed(1) + ') scale(1,' + sy.toFixed(2) + ')">' + gameBossFunnel._userGlyph(u.type) + '</g>';
        if (!u.bounced && (lowest === null || u.y > lowest.y)) lowest = u;
      }
      // Transient juice: "+1"/"+2" popping from the funnel, churn puffs at the floor.
      s.effects = s.effects.filter(function (e) { return ctx.elapsed < e.until; });
      s.effects.forEach(function (e) {
        if (e.kind === "catch") {
          var lf2 = 1 - (e.until - ctx.elapsed) / 420;
          if (lf2 < 0.62) { // swallow: user slides to the (live) funnel centre and shrinks down into the spout, in full view
            var t = lf2 / 0.62;
            var sx = e.x0 + (fpx - e.x0) * t, syy = 71 + 25 * t, sc = Math.max(0.12, 1 - 0.88 * t);
            dotsSvg += '<g transform="translate(' + sx.toFixed(1) + ',' + syy.toFixed(1) + ') scale(' + sc.toFixed(2) + ')">' + gameBossFunnel._userGlyph(e.type) + '</g>';
          }
          if (lf2 > 0.4) { // +worth rises out ABOVE the mouth where it's visible
            var t2 = (lf2 - 0.4) / 0.6;
            dotsSvg += '<text x="' + fpx + '" y="' + (70 - t2 * 18).toFixed(1) + '" font-size="11" font-weight="bold" text-anchor="middle" fill="var(--accent)" opacity="' + (1 - t2).toFixed(2) + '">+' + e.worth + '</text>';
          }
        } else {
          // canned ragdoll flop: tumble + squash + grey + fade (deterministic)
          var lf = 1 - (e.until - ctx.elapsed) / 650;
          dotsSvg += '<g transform="translate(' + e.x.toFixed(1) + ',' + e.y + ') rotate(' + (e.dir * lf * 80).toFixed(0) + ')" opacity="' + (1 - lf).toFixed(2) + '" style="filter:grayscale(1)">' +
            '<g transform="translate(0,-9) scale(' + (1 + lf * 0.25).toFixed(2) + ',' + Math.max(0.3, 1 - lf * 0.6).toFixed(2) + ')">' + gameBossFunnel._userGlyph(e.type) + '</g></g>';
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

  // Debug hook: expose the WEIRD scene definitions so hogware-scenes.html can
  // render/step every scene without playing the gauntlet. Read-only data.
  try {
    window.HogWareScenes = gameWeird._scenes;
    window.HogWareRenderScene = function (svg, uid) { return gameWeird._render(svg, uid); };
    window.HogWareBoss = gameBossFunnel; // debug: render funnel glyphs/meter in the preview harness
  } catch (e) {}

  // Guard: on a host page without the game DOM (e.g. the scene preview page)
  // stage is null — skip the top-level game wiring so the script still loads
  // and the debug hook above stays available.
  if (stage) {
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
  }

  /* ---------------- Boot ---------------- */
  document.addEventListener("DOMContentLoaded", function () {
    if (!stage) return; // no game DOM (scene preview page) — nothing to boot
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
