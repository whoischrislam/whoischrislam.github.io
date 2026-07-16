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

  var reducedMotion = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  function shake() {
    if (reducedMotion) return;
    stage.classList.remove("hw-shaking");
    void stage.offsetWidth; // restart animation
    stage.classList.add("hw-shaking");
  }

  /* ---------------- Tiny SFX stub ----------------
     Placeholder blips until the ElevenLabs files land in /audio/hogware/.
     Swap the synth body for Audio(src).play() then. */
  var audioCtx = null;
  function sfx(kind) {
    try {
      if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
      var o = audioCtx.createOscillator(), g = audioCtx.createGain();
      var f = { pass: 660, fail: 140, tick: 880, verb: 440, over: 220, level: 990 }[kind] || 440;
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
      scene.innerHTML = '<div class="hw-screen"><div class="hw-toggles' + dens + '" style="gap:0.45em;">' + rows + '</div></div>';
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
    params: { target: 6, radius: 26, drift: false, decayMs: 0 },
    levels: [
      {},
      { target: 8, radius: 20, durationMs: 4800 },
      { target: 9, radius: 16, drift: true, decayMs: 1100, durationMs: 4800 } // normalcy fights back: idle too long and progress reverts
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
      ring.setAttribute("fill", "none");
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
          sfx("fail"); // whiff — no progress, keep aiming
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
      // Seeded random spot each play — "it's always dead center" stops being knowledge.
      ctx.state.shipPos = { left: 15 + run.rng() * 50, top: 25 + run.rng() * 35 };
      scene.innerHTML = '<div id="hw-ship-zone" style="position:absolute; inset:0;"></div>' +
        '<p class="hw-hint" style="position:absolute; bottom:5%; left:0; right:0; text-align:center;">ignore the meetings — just hit SHIP</p>';
      if (ctx.params.decoy) {
        var d = document.createElement("button");
        d.className = "hw-btn";
        d.id = "hw-decoy-btn";
        d.textContent = "SHIP LATER";
        d.style.position = "absolute";
        d.style.zIndex = "12";
        var dpos = { left: 15 + run.rng() * 50, top: 25 + run.rng() * 35 };
        // keep decoy and real button visibly apart
        if (Math.abs(dpos.left - ctx.state.shipPos.left) < 18) dpos.left = (dpos.left + 30) % 65 + 10;
        d.style.left = dpos.left + "%";
        d.style.top = dpos.top + "%";
        d.addEventListener("pointerdown", function (e) {
          e.stopPropagation();
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
      chargeMs: 1400,        // full bar fill time
      zones: [               // [maxPct, label, bonus, pass]
        [35, "TIMID.", 0, true],
        [70, "SAFE.", 0, true],
        [90, "BOLD!", 1, true],
        [100, "MOONSHOT!!", 2, true],
        [999, "…overboard.", 0, false]
      ]
    },
    levels: [
      {},
      { varyBands: true, failBelowMin: 30, failBelowMax: 50 },
      { chargeMs: 1050, varyBands: true, failBelowMin: 45, failBelowMax: 68 }
    ],
    setup: function (ctx) {
      ctx.state.holding = false;
      ctx.state.power = 0;
      ctx.state.launched = false;
      // L2+: the moonshot edge moves per play (seeded variance), and a fail floor
      // rises with level — under-charging stops being safe. Thematically exact:
      // "never trying" is the only real failure this value recognizes.
      var moonStart = ctx.params.varyBands ? 88 + run.rng() * 6 : 90;
      // The fail floor itself varies per play (seeded) — the passing window is a
      // fresh read off the rink every time, never a memorized number.
      var floor = ctx.params.failBelowMin != null
        ? ctx.params.failBelowMin + run.rng() * (ctx.params.failBelowMax - ctx.params.failBelowMin)
        : 0;
      ctx.state.zones = [
        [35, "TIMID.", 0], [70, "SAFE.", 0], [moonStart, "BOLD!", 1], [100, "MOONSHOT!!", 2]
      ].map(function (z) { return [z[0], z[1], z[2], z[0] > floor]; });
      ctx.state.zones.push([999, "…overboard.", 0, false]);
      ctx.state.floor = floor;
      // Rink bands drawn from the REAL zones so the shrinking safe area is visible.
      var px = function (pct) { return 6 + (pct / 100) * 372 + 10; };
      var bands =
        (floor > 0 ? '<rect x="' + px(0) + '" y="36" width="' + (px(floor) - px(0)) + '" height="10" rx="5" fill="var(--chip-bg)" stroke="var(--border-strong)" stroke-dasharray="3 3"/>' : '') +
        '<rect x="' + px(Math.max(floor, 35)) + '" y="36" width="' + (px(70) - px(Math.max(floor, 35))) + '" height="10" rx="5" fill="var(--accent-soft)"/>' +
        '<rect x="' + px(70) + '" y="34" width="' + (px(moonStart) - px(70)) + '" height="14" rx="7" fill="var(--accent-soft)"/>' +
        '<rect x="' + px(moonStart) + '" y="32" width="' + (px(100) - px(moonStart)) + '" height="18" rx="6" fill="var(--accent)" opacity="0.55"/>';
      scene.innerHTML =
        '<div class="hw-screen" style="justify-content:flex-end; padding-bottom:2.2em;">' +
          '<svg id="hw-rink" width="100%" height="120" viewBox="0 0 400 60" preserveAspectRatio="none" aria-hidden="true">' +
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
          '<p class="hw-hint">hold <span class="hw-kbd">space</span> / press — release to launch. far edge pays. past it drowns.</p>' +
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
      var zones = ctx.state.zones;
      setTimeout(function () {
        // Exact-landing floor check first — a 38% shot under a 42% floor fails
        // even though the "SAFE" zone extends past it.
        if (pct < ctx.state.floor) return ctx.fail("Short of the line. That wasn't even trying.");
        for (var i = 0; i < zones.length; i++) {
          if (pct <= zones[i][0]) {
            if (zones[i][3]) return ctx.win(zones[i][1], zones[i][2]);
            var why = i === zones.length - 1 ? " Right past the edge." : " That wasn't even trying.";
            return ctx.fail(zones[i][1] + why);
          }
        }
      }, reducedMotion ? 150 : 720);
    },
    onTimeout: function (ctx) { ctx.fail("Never even took the shot."); }
  };

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
    show(hud); updateHud();
    nextGame();
  }

  function nextGame() {
    var game = run.order[run.idx];
    hideAllScreens();
    updateHud(); // loop counter can change between games
    timerFill.style.transform = "scaleX(1)"; // fresh bar behind the verb card
    $("hw-verb-word").textContent = game.verb;
    $("hw-verb-value").textContent = game.value;
    show(screens.verb);
    sfx("verb");
    setTimeout(function () { playGame(game); }, VERB_MS);
  }

  function playGame(game) {
    hideAllScreens();
    // Difficulty level: loop 1 = L1, loop 2 = L2, loop 3+ = L3 (speed takes over from loop 4).
    var levelIdx = Math.min(run.loop - 1, 2);
    var levelParams = (game.levels && game.levels[levelIdx]) || {};
    // Levels that add a time-costing mechanic (e.g. the stall stop) can buy more clock.
    var duration = (levelParams.durationMs || game.baseDurationMs) * run.speed;
    stage.dataset.level = levelIdx + 1; // exposed for tests/debugging
    active = {
      game: game,
      params: Object.assign({}, game.params, levelParams),
      state: {},
      elapsed: 0,
      duration: duration,
      done: false,
      win: function (flavor, bonus) { settle(true, flavor, bonus || 0); },
      fail: function (flavor) { settle(false, flavor, 0); }
    };
    scene.innerHTML = "";
    show(scene);
    game.setup(active);
    // Pre-held input counts: if the player is already holding when a hold-input
    // game starts, deliver the press now instead of demanding a re-press.
    if (game.input === "space" && game.onPress && holdActive()) game.onPress(active);
    timerFill.classList.remove("hw-timer-hot");
    var last = performance.now();
    (function tick(now) {
      if (!active || active.done) return;
      var dt = now - last; last = now;
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

    if (pass) {
      run.cleared++;
      run.score += 1 + bonus;
      run.trail.push("🟩");
      sfx("pass");
      capture("hogware_microgame_cleared", { game: game.id, value: game.value, loop: run.loop, bonus: bonus });
    } else {
      run.lives--;
      run.trail.push("🟥");
      sfx("fail");
      shake();
    }
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
      if (run.idx >= run.order.length) {
        run.idx = 0;
        run.loop++;
        // Pure axes, like real WarioWare: LEVEL UP changes only the game configs
        // (new complications), SPEED UP changes only the clock. Never both at once.
        if (run.loop <= 3) {
          showAnnounce("LEVEL UP!", "new complications");
        } else {
          run.speed = Math.max(SPEED_FLOOR, run.speed * SPEED_DECAY);
          showAnnounce("SPEED UP!", "same games. less time.");
        }
        run.order = shuffle(run.order, run.rng);
      } else {
        nextGame();
      }
    }, RESULT_MS);
  }

  /* ---- Interstitial: escalation announcement + a real value quote (skippable) ---- */
  var quoteTimer = null;
  function showAnnounce(word, axisNote) {
    hideAllScreens();
    var pool = QUOTES.slice();
    if (ph()) pool.push(REPLAY_QUOTE);
    var q = pool[Math.floor(Math.random() * pool.length)];
    var wordEl = $("hw-announce-word");
    wordEl.textContent = word;
    wordEl.classList.toggle("hw-announce-speed", word === "SPEED UP!");
    $("hw-announce-axis").textContent = axisNote || "";
    $("hw-quote-text").textContent = q.text;
    $("hw-quote-source").textContent = q.value + " — posthog.com/handbook/values";
    show(screens.quote);
    sfx("level");
    run.phase = "quote";
    quoteTimer = setTimeout(endQuote, QUOTE_MS);
  }
  function endQuote() {
    if (quoteTimer) { clearTimeout(quoteTimer); quoteTimer = null; }
    if (!run || run.phase !== "quote") return;
    run.phase = "verb";
    nextGame();
  }

  /* ---- Game over + leaderboard ---- */
  function resultString() {
    return "HogWare #" + DAY_NUM + " " + run.trail.join("") + " · " + run.score +
      "\nhttps://whoischrislam.github.io/hogware.html";
  }
  function gameOver() {
    hide(hud);
    hideAllScreens();
    sfx("over");
    var best = 0;
    try { best = parseInt(localStorage.getItem("hogware_best") || "0", 10); } catch (e) {}
    var isBest = run.score > best;
    if (isBest) { try { localStorage.setItem("hogware_best", String(run.score)); } catch (e) {} }

    $("hw-final-score").textContent = run.score;
    $("hw-final-stats").textContent =
      run.cleared + " cleared · loop " + run.loop + (isBest ? " · new personal best" : best ? " · best " + best : "");
    $("hw-trail").textContent = "HogWare #" + DAY_NUM + "  " + run.trail.join("");

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

    show(screens.gameover);
    renderLeaderboard();
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
    if (!active || active.done) return;
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
    if (active && !active.done && active.game.input === "space") { e.preventDefault(); pressActive(e); }
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
      hideAllScreens();
      startRun();
    });
    $("hw-submit").addEventListener("click", submitScore);
    $("hw-initials").addEventListener("keydown", function (e) {
      if (e.key === "Enter") submitScore();
      e.stopPropagation();
    });
    stage.focus({ preventScroll: true });
  });
})();
