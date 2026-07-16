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
  var LIVES = 4;               // WarioWare-authentic; sudden death killed runs before players saw all 5 values

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
     The quote is "we get out of their way" — so the road literally clears
     itself. Traffic ahead darts out of your lane just before you reach it;
     the only way to fail is to hesitate. */
  var gameDrive = {
    id: "drive", value: "You're the driver", verb: "DRIVE!", input: "space",
    baseDurationMs: 4200,
    params: { travelMs: 2600, obstacles: [0.3, 0.55, 0.78], hesitateIdx: -1 },
    levels: [
      {},
      { travelMs: 3000, obstacles: [0.25, 0.45, 0.65, 0.82] },
      { travelMs: 3000, obstacles: [0.25, 0.45, 0.65, 0.82], hesitateIdx: 2 } // one car holds its nerve longer than you'd like
    ],
    setup: function (ctx) {
      ctx.state.holding = false;
      ctx.state.x = 0; // 0..1 progress toward the flag
      var cars = ctx.params.obstacles.map(function (frac, i) {
        return '<g class="hw-traffic" data-frac="' + frac + '" style="transform: translate(' + (40 + frac * 300) + 'px, 30px);">' +
          '<rect x="0" y="0" width="26" height="14" rx="4" fill="var(--chip-text)" opacity="0.8"/>' +
          '<circle cx="6" cy="15" r="3.5" fill="var(--muted)"/><circle cx="20" cy="15" r="3.5" fill="var(--muted)"/></g>';
      }).join("");
      scene.innerHTML =
        '<div class="hw-screen" style="justify-content:flex-end; padding-bottom:2em;">' +
          '<svg width="100%" height="140" viewBox="0 0 400 70" preserveAspectRatio="none" aria-hidden="true">' +
            '<rect x="0" y="26" width="400" height="26" rx="4" fill="var(--chip-bg)"/>' +
            '<line x1="0" y1="39" x2="400" y2="39" stroke="var(--border-strong)" stroke-width="1.5" stroke-dasharray="10 8"/>' +
            '<text x="382" y="22" font-size="16">🏁</text>' +
            cars +
            '<g id="hw-car" style="transform: translate(6px, 30px);">' +
              '<rect x="0" y="0" width="30" height="14" rx="5" fill="var(--accent)"/>' +
              '<circle cx="7" cy="15" r="3.5" fill="var(--text)"/><circle cx="23" cy="15" r="3.5" fill="var(--text)"/>' +
              '<circle cx="24" cy="4" r="5" fill="var(--accent-strong)"/>' +
            '</g>' +
          '</svg>' +
          '<p class="hw-hint">hold <span class="hw-kbd">space</span> / press — everyone gets out of your way</p>' +
        '</div>';
    },
    update: function (ctx, dt) {
      if (ctx.state.holding) ctx.state.x = Math.min(1, ctx.state.x + dt / ctx.params.travelMs);
      var car = $("hw-car");
      if (car) car.style.transform = "translate(" + (6 + ctx.state.x * 348) + "px, 30px)";
      // Traffic bails out of the lane just before you reach it — that's the whole joke.
      scene.querySelectorAll(".hw-traffic").forEach(function (t, ti) {
        if (t.dataset.dodged) return;
        var frac = parseFloat(t.dataset.frac);
        var margin = (ti === ctx.params.hesitateIdx) ? 0.055 : 0.14; // the hesitant one waits until the last moment
        if (ctx.state.x > frac - margin) {
          t.dataset.dodged = "1";
          if (!reducedMotion) t.style.transition = "transform 0.35s ease-out, opacity 0.35s";
          t.style.transform = "translate(" + (40 + frac * 300) + "px, " + (frac > 0.5 ? -30 : 78) + "px)";
          t.style.opacity = "0.25";
          sfx("tick");
        }
      });
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
    params: { items: ["the code", "the roadmap", "the salaries"], relocks: 0 },
    levels: [
      {},
      { items: ["the code", "the roadmap", "the salaries", "the finances"] },
      { items: ["the code", "the roadmap", "the salaries", "the finances", "the incident report"], relocks: 1 }
    ],
    setup: function (ctx) {
      var items = ctx.params.items;
      ctx.state.pub = {};
      ctx.state.relocksLeft = ctx.params.relocks;
      ctx.state.relockIdx = Math.floor(run.rng() * items.length);
      var rows = items.map(function (label, i) {
        return '<div class="hw-toggle" data-i="' + i + '" role="button" tabindex="-1">' +
          '<span>' + label + '</span><span class="hw-pill">PRIVATE</span></div>';
      }).join("");
      scene.innerHTML = '<div class="hw-screen"><div class="hw-toggles" style="gap:0.45em;">' + rows + '</div></div>';
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
      var left = ctx.params.items.length - Object.keys(ctx.state.pub).filter(function (k) { return ctx.state.pub[k]; }).length;
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
    params: { target: 10, drift: false },
    levels: [
      {},
      { target: 12 },
      { target: 14, drift: true } // the photo starts wandering; normalcy resists
    ],
    _mutations: [
      function () { var e = $("hw-w-bg"); e.setAttribute("fill", "#B043D1"); },                                  // beige wall goes purple
      function () { var e = $("hw-w-chart"); e.setAttribute("points", "10,58 25,20 40,55 55,8 70,40 85,4"); e.setAttribute("stroke", "var(--accent)"); }, // chart becomes a rollercoaster
      function () { var e = $("hw-w-tie"); e.classList.add("hw-anim-spin"); },                                    // tie becomes a propeller
      function () { var e = $("hw-w-caption"); e.textContent = "SYNERWEIRD"; },
      function () { var e = $("hw-w-head"); e.setAttribute("fill", "var(--accent)"); $("hw-w-spikes").style.opacity = "1"; }, // person hedgehogs
      function () { var e = $("hw-w-plant"); e.classList.add("hw-anim-grow"); },                                  // plant refuses to stay decorative
      function () { var e = $("hw-w-eye3"); e.style.opacity = "1"; },                                             // third eye opens
      function () { var e = $("hw-w-person"); e.classList.add("hw-anim-float"); },                                // levitation unlocked
      function () { var e = $("hw-w-caption"); e.textContent = "WHY NOT NOW"; e.setAttribute("fill", "var(--accent)"); },
      function () { var e = $("hw-w-frame"); e.style.transform = "rotate(3deg) scale(1.04)"; },                   // reality tilts
      function () { var e = $("hw-w-sun"); e.style.opacity = "1"; },                                              // indoor sun
      function () { var e = $("hw-w-chart"); e.classList.add("hw-anim-spin"); }                                   // the chart has had enough
    ],
    setup: function (ctx) {
      ctx.state.count = 0;
      ctx.state.order = shuffle(gameWeird._mutations.slice(), run.rng);
      scene.innerHTML =
        '<div class="hw-screen" style="justify-content:center;">' +
          '<div class="hw-w-wrap' + (ctx.params.drift ? ' hw-anim-wander' : '') + '" style="width:min(70%, 340px);">' +
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
          '<p class="hw-hint">click it weirder — <span id="hw-weird-count">0</span>/' + ctx.params.target + '</p>' +
        '</div>';
      $("hw-w-frame").addEventListener("pointerdown", function () {
        if (ctx.done) return;
        var fn = ctx.state.order[ctx.state.count % ctx.state.order.length];
        try { fn(); } catch (e) {}
        sfx("tick");
        ctx.state.count++;
        var label = $("hw-weird-count");
        if (label) label.textContent = ctx.state.count;
        if (ctx.state.count >= ctx.params.target) ctx.win("Perfectly optimized for our strategy.", 0);
      });
    },
    onTimeout: function (ctx) { ctx.fail("Still " + (ctx.params.target - ctx.state.count) + " notches too normal."); }
  };

  /* ---- 4. WHY NOT NOW? — "SHIP IT!" (click) ---- */
  var gameShip = {
    id: "ship", value: "Why not now?", verb: "SHIP IT!", input: "click",
    baseDurationMs: 4600,
    levels: [
      {},
      { spawnEveryMs: 380 },
      { spawnEveryMs: 420, decoy: true } // a "SHIP LATER" button appears; reading is the skill
    ],
    params: {
      spawnEveryMs: 520,
      decoy: false,
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
      ctx.state.lastSpawn = 0;
      ctx.state.spawned = 0;
      scene.innerHTML = '<button id="hw-ship-btn" class="hw-btn">SHIP</button>' +
        '<p class="hw-hint" style="position:absolute; bottom:5%; left:0; right:0; text-align:center;">ignore the meetings — just hit SHIP</p>';
      $("hw-ship-btn").addEventListener("pointerdown", function () {
        ctx.win("Shipped. Today.", ctx.state.spawned >= 5 ? 1 : 0);
      });
      if (ctx.params.decoy) {
        var d = document.createElement("button");
        d.className = "hw-btn";
        d.id = "hw-decoy-btn";
        d.textContent = "SHIP LATER";
        d.style.position = "absolute";
        d.style.zIndex = "12";
        d.style.left = (28 + run.rng() * 20) + "%";
        d.style.top = (24 + run.rng() * 14) + "%";
        d.addEventListener("pointerdown", function (e) {
          e.stopPropagation();
          d.style.transform = "rotate(" + (run.rng() > 0.5 ? 8 : -8) + "deg)";
          d.textContent = "later?!";
          sfx("fail");
        });
        scene.appendChild(d);
      }
    },
    update: function (ctx) {
      if (ctx.elapsed - ctx.state.lastSpawn < ctx.params.spawnEveryMs) return;
      ctx.state.lastSpawn = ctx.elapsed;
      var box = stage.getBoundingClientRect();
      var p = ctx.params.popups[ctx.state.spawned % ctx.params.popups.length];
      var el = document.createElement("div");
      el.className = "hw-popup";
      el.innerHTML = "<b>" + p[0] + "</b><span>" + p[1] + "</span>";
      // Aim popups at a daily-seeded jittered ring around the button so they bury it over time.
      var cx = box.width * 0.5, cy = box.height * 0.55;
      var jx = cx + (run.rng() - 0.5) * box.width * 0.34;
      var jy = cy + (run.rng() - 0.5) * box.height * 0.34;
      el.style.left = Math.max(4, Math.min(box.width - 130, jx - 60)) + "px";
      el.style.top = Math.max(30, Math.min(box.height - 70, jy - 30)) + "px";
      el.style.transform = "rotate(" + (run.rng() * 10 - 5) + "deg)";
      scene.appendChild(el);
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
      { zones: [[35, "TIMID.", 0, true], [70, "SAFE.", 0, true], [93, "BOLD!", 1, true], [100, "MOONSHOT!!", 2, true], [999, "…overboard.", 0, false]] },
      { chargeMs: 1050, zones: [[35, "TIMID.", 0, true], [70, "SAFE.", 0, true], [93, "BOLD!", 1, true], [100, "MOONSHOT!!", 2, true], [999, "…overboard.", 0, false]] }
    ],
    setup: function (ctx) {
      ctx.state.holding = false;
      ctx.state.power = 0;
      ctx.state.launched = false;
      scene.innerHTML =
        '<div class="hw-screen" style="justify-content:flex-end; padding-bottom:2.2em;">' +
          '<svg id="hw-rink" width="100%" height="120" viewBox="0 0 400 60" preserveAspectRatio="none" aria-hidden="true">' +
            '<rect x="0" y="38" width="400" height="6" rx="3" fill="var(--chip-bg)"/>' +
            '<rect x="140" y="36" width="140" height="10" rx="5" fill="var(--accent-soft)"/>' +
            '<rect x="280" y="34" width="80" height="14" rx="7" fill="var(--accent-soft)"/>' +
            '<rect x="360" y="32" width="30" height="18" rx="6" fill="var(--accent)" opacity="0.55"/>' +
            '<line x1="396" y1="20" x2="396" y2="56" stroke="var(--accent-strong)" stroke-width="2.5" stroke-dasharray="3 3"/>' +
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
      var zones = ctx.params.zones;
      setTimeout(function () {
        for (var i = 0; i < zones.length; i++) {
          if (pct <= zones[i][0]) {
            if (zones[i][3]) return ctx.win(zones[i][1], zones[i][2]);
            return ctx.fail(zones[i][1] + " Right past the edge.");
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
    capture("hogware_run_started", { pace_variant: paceVariant });
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
    var duration = game.baseDurationMs * run.speed;
    // Difficulty level: loop 1 = L1, loop 2 = L2, loop 3+ = L3 (speed takes over from loop 4).
    var levelIdx = Math.min(run.loop - 1, 2);
    var levelParams = (game.levels && game.levels[levelIdx]) || {};
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
        // Escalation, WarioWare-style: difficulty levels first (loops 2-3, gentle
        // speed), then pure speed-ups once every game is already at L3.
        if (run.loop <= 3) {
          run.speed = Math.max(SPEED_FLOOR, run.speed * 0.95);
          showAnnounce("LEVEL UP!");
        } else {
          run.speed = Math.max(SPEED_FLOOR, run.speed * SPEED_DECAY);
          showAnnounce("SPEED UP!");
        }
        run.order = shuffle(run.order, run.rng);
      } else {
        nextGame();
      }
    }, RESULT_MS);
  }

  /* ---- Interstitial: escalation announcement + a real value quote (skippable) ---- */
  var quoteTimer = null;
  function showAnnounce(word) {
    hideAllScreens();
    var pool = QUOTES.slice();
    if (ph()) pool.push(REPLAY_QUOTE);
    var q = pool[Math.floor(Math.random() * pool.length)];
    $("hw-announce-word").textContent = word;
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

  document.addEventListener("keydown", function (e) {
    if (e.code !== "Space") return;
    var t = e.target;
    if (t && (t.tagName === "INPUT" || t.tagName === "BUTTON")) return;
    e.preventDefault();
    if (e.repeat) return;
    if (!run && !screens.title.classList.contains("hw-hidden")) return startRun();
    pressActive(e);
  });
  document.addEventListener("keyup", function (e) {
    if (e.code === "Space") releaseActive();
  });
  stage.addEventListener("pointerdown", function (e) {
    // For space-input games, any tap on the stage is the button.
    if (active && !active.done && active.game.input === "space") { e.preventDefault(); pressActive(e); }
    else if (run && run.phase === "quote") endQuote();
  });
  stage.addEventListener("pointerup", releaseActive);
  stage.addEventListener("pointercancel", releaseActive);

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
