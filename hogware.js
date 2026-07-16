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
     Cloudflare Worker that runs a HogQL query over hogware_score_submitted
     events with a Query-Read-only personal API key (server-side only).
     Empty string = not deployed yet; the UI degrades to local-best-only. */
  var WORKER_URL = "";

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
  var ZOOM_MS = 240; // per half (out, then in)
  var transitioning = false;
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
    conductor.nextBeat(function () {
      if (fromEl) fromEl.classList.add("hw-zoom-out");
      setTimeout(function () {
        hideAllScreens();
        if (fromEl) fromEl.classList.remove("hw-zoom-out");
        if (prep) prep();
        show(toEl);
        toEl.classList.add("hw-zoom-in");
        void toEl.offsetWidth; // commit start state before animating to identity
        toEl.classList.add("hw-zoom-in-go");
        setTimeout(function () {
          toEl.classList.remove("hw-zoom-in", "hw-zoom-in-go");
          transitioning = false;
          if (done) done();
        }, ZOOM_MS);
      }, ZOOM_MS);
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
      setRate: function (r) { anchor = nextBeatAt(); rate = Math.min(2, Math.max(1, r)); }, // re-anchor forward, no jump
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
      }
    };
  })();
  document.addEventListener("visibilitychange", function () {
    if (!document.hidden) conductor.resumeIfInterrupted();
  });

  /* ---------------- Tiny SFX stub ----------------
     Placeholder blips until the ElevenLabs files land in /audio/hogware/.
     Swap the synth body for buffer playback then (slots: pass/fail/tick/verb/over/level/whiff). */
  function sfx(kind) {
    if (conductor.isMuted()) return;
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
    params: { count: 3, relocks: 0, density: 0 },
    levels: [{}, { count: 4, density: 1 }, { count: 5, relocks: 1, density: 2 }],
    _pool: ["the code", "the roadmap", "the salaries", "the finances", "the incident report", "the board deck", "the pricing model", "the postmortem"],
    setup: function (ctx) {
      // Draw this play's secrets from the pool (seeded) — different docs each loop.
      var items = shuffle(gamePublish._pool.slice(), run.rng).slice(0, ctx.params.count);
      ctx.state.items = items;
      ctx.state.pub = {};
      ctx.state.relocksLeft = ctx.params.relocks;
      ctx.state.relockIdx = Math.floor(run.rng() * items.length);
      var rows = items.map(function (label, i) {
        return '<div class="hw-toggle" data-i="' + i + '" role="button" tabindex="-1">' +
          '<span>' + label + '</span><span class="hw-pill">PRIVATE</span></div>';
      }).join("");
      // Density is the difficulty lever: a more cramped list = smaller targets,
      // and it reads MORE like corporate software, not less.
      var dens = ["", " hw-toggles-snug", " hw-toggles-dense"][ctx.params.density] || "";
      scene.innerHTML = '<div class="hw-screen"><div class="hw-toggles' + dens + '" style="gap:0.45em;">' + rows + '</div>' +
        '<p class="hw-hint">take it ALL public — flip every toggle</p></div>';
      function setState(el, isPublic) {
        el.classList.toggle("hw-public", isPublic);
        el.querySelector(".hw-pill").textContent = isPublic ? "PUBLIC" : "PRIVATE";
      }
      scene.querySelectorAll(".hw-toggle").forEach(function (el) {
        var i = parseInt(el.dataset.i, 10);
        el.addEventListener("pointerdown", function () {
          if (ctx.done || ctx.state.pub[i]) return;
          ctx.state.pub[i] = true;
          setState(el, true);
          sfx("tick");
          if (ctx.state.relocksLeft > 0 && i === ctx.state.relockIdx) {
            ctx.state.relocksLeft--;
            setTimeout(function () {
              if (ctx.done) return;
              ctx.state.pub[i] = false;
              setState(el, false);
              el.querySelector("span").textContent = items[i] + " (legal had concerns)";
              sfx("fail");
            }, 550);
          }
          if (Object.keys(ctx.state.pub).filter(function (k) { return ctx.state.pub[k]; }).length === items.length) {
            ctx.win("Everything's out in the open.", 0);
          }
        });
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
      { spawnEveryMs: 380, shipDelayMs: 450, driftSpeed: 46 },                                        // the button isn't there yet — find it when it lands
      { spawnEveryMs: 420, decoy: true, shipDelayMs: 700, decoyLockMs: 600, durationMs: 5200, driftSpeed: 42 } // SHIP LATER shows first; falling for it costs time
    ],
    params: {
      spawnEveryMs: 520,
      shipDelayMs: 0,
      decoy: false,
      decoyLockMs: 0,
      driftSpeed: 30, // px/s — meetings creep toward your maker time

      popups: [
        ["Quick sync?", "just 30 min"],
        ["Loop in legal", "before we do anything"],
        ["Circle back?", "next quarter maybe"],
        ["Add to agenda", "for the weekly"],
        ["Needs sign-off", "from 4 stakeholders"],
        ["Align on this?", "let's workshop it"]
      ]
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
        '<p class="hw-hint" style="position:absolute; bottom:5%; left:0; right:0; text-align:center;">ignore the meetings — just hit SHIP</p>';
      if (ctx.params.decoy) {
        var d = document.createElement("button");
        d.className = "hw-btn";
        d.id = "hw-decoy-btn";
        d.textContent = "SHIP LATER";
        d.style.position = "absolute";
        d.style.zIndex = "12";
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
      b.className = "hw-btn";
      b.id = "hw-ship-btn";
      b.textContent = "SHIP";
      b.style.position = "absolute";
      b.style.zIndex = "12";
      b.style.left = ctx.state.shipPos.left + "%";
      b.style.top = ctx.state.shipPos.top + "%";
      b.style.transform = "none"; // pin the anchor: the shared #hw-ship-btn CSS centers via translate, which would fight the pop animation
      if (!reducedMotion) { b.style.animation = "hw-verb-pop 0.25s cubic-bezier(0.2, 1.6, 0.4, 1)"; }
      b.addEventListener("pointerdown", function () {
        if (ctx.elapsed < ctx.state.lockedUntil) return; // still stuck in the meeting you clicked into
        ctx.win("Shipped. Today.", ctx.state.spawned >= 5 ? 1 : 0);
      });
      $("hw-ship-zone").appendChild(b);
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
      var cx = box.width * (ctx.state.shipPos.left / 100) + 40, cy = box.height * (ctx.state.shipPos.top / 100) + 20;
      // Meetings creep toward your maker time: every popup drifts at the ship
      // button and piles onto it — the click window shrinks in real time.
      if (!ctx.state.popupEls) ctx.state.popupEls = [];
      ctx.state.popupEls.forEach(function (pu) {
        var dx = cx - pu.x - 60, dy = cy - pu.y - 25;
        var dist = Math.sqrt(dx * dx + dy * dy);
        if (dist < 10) return; // parked on your calendar
        var step = pu.speed * dt / 1000;
        pu.x += dx / dist * step;
        pu.y += dy / dist * step;
        pu.el.style.left = pu.x + "px";
        pu.el.style.top = pu.y + "px";
      });
      if (ctx.elapsed - ctx.state.lastSpawn < ctx.state.nextGap) return;
      ctx.state.lastSpawn = ctx.elapsed;
      ctx.state.nextGap = ctx.params.spawnEveryMs + (run.rng() - 0.5) * 160; // irregular cadence reads more human
      var p = ctx.state.popupOrder[ctx.state.spawned % ctx.state.popupOrder.length];
      var el = document.createElement("div");
      el.className = "hw-popup";
      el.innerHTML = "<b>" + p[0] + "</b><span>" + p[1] + "</span>";
      // Spawn at a random edge (seeded) and slide in — readable approach, shrinking window.
      var side = Math.floor(run.rng() * 4), along = run.rng();
      var sx = side === 0 ? along * box.width : (side === 1 ? box.width - 10 : (side === 2 ? along * box.width : -110));
      var sy = side === 0 ? -50 : (side === 1 ? along * box.height : (side === 2 ? box.height - 20 : along * box.height));
      el.style.left = sx + "px";
      el.style.top = sy + "px";
      el.style.transform = "rotate(" + (run.rng() * 10 - 5) + "deg)";
      $("hw-ship-zone").appendChild(el);
      ctx.state.popupEls.push({ el: el, x: sx, y: sy, speed: ctx.params.driftSpeed * (0.8 + run.rng() * 0.5) });
      ctx.state.spawned++;
    },
    onTimeout: function (ctx) { ctx.fail("Buried in meetings. Classic."); }
  };

  /* ---- 5. OPTIMISTIC BY DEFAULT — "AIM!" (hold + release) ---- */
  var gameAim = {
    id: "aim", value: "Optimistic by default", verb: "AIM!", input: "space",
    baseDurationMs: 5200,
    params: {
      chargeMs: 1400,   // full bar fill time
      bandHalf: 12,     // half-width of the target band, in power %
      strict: false     // L1: anywhere on the rink lands; band is pure upside
    },
    levels: [
      {},
      { bandHalf: 9, strict: true },
      { chargeMs: 1050, bandHalf: 7, strict: true }
    ],
    setup: function (ctx) {
      ctx.state.holding = false;
      ctx.state.power = 0;
      ctx.state.launched = false;
      // The target band lands ANYWHERE on the rink per play (seeded) — short chip,
      // center lob, or a deep moonshot. Read the rink, then commit to the charge.
      var range = ctx.params.strict ? [25, 90] : [30, 80];
      ctx.state.band = range[0] + run.rng() * (range[1] - range[0]);
      ctx.state.moonshot = ctx.state.band >= 78; // deep placements keep the name
      var px = function (pct) { return 6 + (pct / 100) * 372 + 10; };
      var b0 = ctx.state.band - ctx.params.bandHalf, b1 = ctx.state.band + ctx.params.bandHalf;
      var g0 = Math.max(0, b0 - 6), g1 = Math.min(100, b1 + 6); // "close" grace halo
      var bands =
        '<rect x="' + px(g0) + '" y="35" width="' + (px(g1) - px(g0)) + '" height="12" rx="6" fill="var(--accent-soft)"/>' +
        '<rect x="' + px(Math.max(0, b0)) + '" y="32" width="' + (px(Math.min(100, b1)) - px(Math.max(0, b0))) + '" height="18" rx="6" fill="var(--accent)" opacity="0.55"/>';
      scene.innerHTML =
        '<div class="hw-screen" style="justify-content:flex-end; padding-bottom:2.2em;">' +
          '<svg id="hw-rink" width="100%" height="120" viewBox="0 0 400 60" preserveAspectRatio="none" aria-hidden="true" ' +
            'data-band="' + ctx.state.band.toFixed(1) + '" data-chargems="' + ctx.params.chargeMs + '">' +
            '<rect x="0" y="38" width="400" height="6" rx="3" fill="var(--chip-bg)"/>' +
            bands +
            '<line x1="' + px(100) + '" y1="20" x2="' + px(100) + '" y2="56" stroke="var(--accent-strong)" stroke-width="2.5" stroke-dasharray="3 3"/>' +
            '<g id="hw-puck" style="transform: translate(6px, 26px);">' +
              '<circle cx="10" cy="14" r="10" fill="var(--accent)"/>' +
              '<circle cx="7" cy="12" r="1.4" fill="var(--bg)"/>' +
              '<circle cx="13" cy="12" r="1.4" fill="var(--bg)"/>' +
            '</g>' +
          '</svg>' +
          '<div style="width:min(70%,320px); height:12px; border-radius:999px; background:var(--chip-bg); overflow:hidden;"><div id="hw-power-fill" style="height:100%; width:0%; border-radius:999px; background:var(--accent);"></div></div>' +
          '<p class="hw-hint">hold <span class="hw-kbd">space</span> / press — release to land on the glow. past the edge drowns.</p>' +
        '</div>';
    },
    update: function (ctx, dt) {
      if (ctx.state.holding && !ctx.state.launched) {
        ctx.state.power = Math.min(110, ctx.state.power + (dt / ctx.params.chargeMs) * 100);
        var fill = $("hw-power-fill");
        if (fill) {
          fill.style.width = Math.min(100, ctx.state.power) + "%";
          if (ctx.state.power > 90) fill.style.background = "var(--accent-strong)";
        }
        if (ctx.state.power >= 110) gameAim._launch(ctx); // held too long: greed launches itself
      }
    },
    onPress: function (ctx) {
      if (!ctx.state.launched) ctx.state.holding = true;
    },
    onRelease: function (ctx) {
      if (ctx.state.holding && !ctx.state.launched) gameAim._launch(ctx);
    },
    _launch: function (ctx) {
      ctx.state.launched = true;
      ctx.state.holding = false;
      var pct = ctx.state.power;
      var puck = $("hw-puck");
      var x = 6 + (pct / 100) * 372;
      if (puck) {
        if (!reducedMotion) puck.style.transition = "transform 0.7s cubic-bezier(0.1, 0.6, 0.3, 1)";
        requestAnimationFrame(function () { puck.style.transform = "translate(" + x + "px, 26px)"; });
      }
      setTimeout(function () {
        if (pct > 100) return ctx.fail("…overboard. Right past the edge.");
        var d = Math.abs(pct - ctx.state.band);
        var big = ctx.state.moonshot ? "MOONSHOT!!" : "BULLSEYE!";
        if (d <= ctx.params.bandHalf) return ctx.win(big, 2);
        if (d <= ctx.params.bandHalf + 6) return ctx.win("CLOSE.", 1);
        if (!ctx.params.strict) return ctx.win("…landed. Nothing gained.", 0);
        return ctx.fail(pct < ctx.state.band ? "Short of the brief." : "Sailed right past it.");
      }, reducedMotion ? 150 : 720);
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
      trail: [], history: [0], rng: rng, order: shuffle(GAMES.slice(), rng), idx: 0, phase: "verb"
    };
  }
  function shuffle(a, rng) {
    for (var i = a.length - 1; i > 0; i--) {
      var j = Math.floor(rng() * (i + 1)), t = a[i]; a[i] = a[j]; a[j] = t;
    }
    return a;
  }

  function updateHud() {
    $("hw-hud-score").textContent = "Score " + run.score;
    $("hw-hud-loop").textContent = "Loop " + run.loop + " · Lv" + Math.min(run.loop, 3);
    var icons = document.querySelectorAll("#hw-hud-lives .hw-life");
    icons.forEach(function (img, i) {
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
    swapScreens(screens.verb, function () {
      updateHud(); // loop counter can change between games
      timerFill.style.transform = "scaleX(1)"; // fresh bar behind the verb card
      $("hw-verb-word").textContent = game.verb;
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
    $("hw-verb-tile").textContent =
      "LOOP " + run.loop + " · Lv" + Math.min(run.loop, 3) + " · " + (1 / run.speed).toFixed(1) + "×";
    // Sparkline: score after each game, scaled into an 86×30 box.
    var h = run.history, maxY = Math.max(4, h[h.length - 1]);
    var pts = h.map(function (s, i) {
      var x = 4 + (h.length === 1 ? 0 : (i / (h.length - 1)) * 74);
      var y = 26 - (s / maxY) * 20;
      return x.toFixed(1) + "," + y.toFixed(1);
    });
    $("hw-spark-line").setAttribute("points", pts.join(" "));
    var lastPt = pts[pts.length - 1].split(",");
    var dot = $("hw-spark-dot");
    dot.setAttribute("cx", lastPt[0]);
    dot.setAttribute("cy", lastPt[1]);
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
      game.setup(thisActive);
    }, function () {
      if (active !== thisActive || active.done) return;
      active.live = true;
      stage.dataset.live = "1"; // exposed for the headless test to wait on
      scene.style.pointerEvents = "";
      // Pre-held input counts: if the player is already holding when a hold-input
      // game starts, deliver the press now instead of demanding a re-press.
      if (game.input === "space" && game.onPress && holdActive()) game.onPress(active);
      startClock(game);
    });
  }

  function startClock(game) {
    timerFill.classList.remove("hw-timer-hot");
    var last = performance.now();
    (function tick(now) {
      if (!active || active.done) return;
      var dt = Math.min(now - last, 100); last = now; // clamp: a backgrounded tab must not dump one giant dt and drain the game
      active.elapsed += dt;
      var frac = Math.max(0, 1 - active.elapsed / active.duration);
      timerFill.style.transform = "scaleX(" + frac + ")";
      if (frac < 0.3) timerFill.classList.add("hw-timer-hot");
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
    run.history.push(run.score); // feeds the verb-card sparkline
    updateHud();

    hideAllScreens();
    var word = $("hw-result-word");
    word.textContent = pass ? (bonus > 0 ? "CLEARED +" + bonus : "CLEARED") : "MISSED";
    word.className = "hw-result-word " + (pass ? "hw-pass" : "hw-fail");
    $("hw-result-flavor").textContent = (flavor || "") +
      (!pass && run.lives > 0 ? " (" + run.lives + (run.lives === 1 ? " life" : " lives") + " left)" : "");
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
    return trailGrid() + "\nhttps://whoischrislam.github.io/hogware.html";
  }
  function gameOver() {
    hide(hud);
    conductor.stop(); // scheduler only runs during an active run
    sfx("over");
    var best = 0;
    try { best = parseInt(localStorage.getItem("hogware_best") || "0", 10); } catch (e) {}
    var isBest = run.score > best;
    if (isBest) { try { localStorage.setItem("hogware_best", String(run.score)); } catch (e) {} }

    $("hw-final-score").textContent = run.score;
    $("hw-final-stats").textContent =
      run.cleared + " cleared · loop " + run.loop + (isBest ? " · new personal best" : best ? " · best " + best : "");
    var trailEl = $("hw-trail");
    trailEl.textContent = trailGrid();
    trailEl.classList.toggle("hw-trail-deep", run.trail.length > 36); // 6+ loops: compress so the score stays on-frame

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

    swapScreens(screens.gameover, null, renderLeaderboard);
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
    if (!WORKER_URL) {
      var best = 0;
      try { best = parseInt(localStorage.getItem("hogware_best") || "0", 10); } catch (e) {}
      el.innerHTML = best ? "personal best on this browser: <b>" + best + "</b> · global leaderboard: wiring in progress" : "";
      return;
    }
    el.textContent = "loading leaderboard…";
    fetch(WORKER_URL).then(function (r) { return r.json(); }).then(function (rows) {
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
