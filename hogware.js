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
      var f = { pass: 660, fail: 140, tick: 880, verb: 440, over: 220 }[kind] || 440;
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

  /* ---- 1. YOU'RE THE DRIVER — "DRIVE!" (space) ---- */
  var gameDrive = {
    id: "drive", value: "You're the driver", verb: "DRIVE!", input: "space",
    baseDurationMs: 4200,
    params: { minRedMs: 900, maxRedMs: 2400 },
    setup: function (ctx) {
      ctx.state.green = false;
      ctx.state.greenAt = null;
      ctx.state.flipAt = ctx.params.minRedMs + Math.random() * (ctx.params.maxRedMs - ctx.params.minRedMs);
      scene.innerHTML =
        '<div class="hw-screen">' +
          '<svg width="72" height="180" viewBox="0 0 40 100" aria-hidden="true">' +
            '<rect x="4" y="2" width="32" height="96" rx="8" fill="var(--surface)" stroke="var(--border-strong)"/>' +
            '<circle id="hw-light-red" cx="20" cy="22" r="11" fill="#E5484D"/>' +
            '<circle id="hw-light-green" cx="20" cy="56" r="11" fill="var(--chip-bg)"/>' +
          '</svg>' +
          '<div style="display:flex; align-items:center; gap:0.6em;">' + hedgehogSVG(44) +
            '<span style="color:var(--muted); font-size:0.9em;">no deadlines. but the light matters.</span></div>' +
          '<p class="hw-hint"><span class="hw-kbd">space</span> / tap when it turns green</p>' +
        '</div>';
    },
    update: function (ctx) {
      if (!ctx.state.green && ctx.elapsed >= ctx.state.flipAt) {
        ctx.state.green = true;
        ctx.state.greenAt = ctx.elapsed;
        var red = $("hw-light-red"), grn = $("hw-light-green");
        if (red) red.setAttribute("fill", "var(--chip-bg)");
        if (grn) grn.setAttribute("fill", "#46A758");
        sfx("tick");
      }
    },
    onPress: function (ctx) {
      if (!ctx.state.green) return ctx.fail("Jumped the gun. Stalled.");
      var ms = Math.round(ctx.elapsed - ctx.state.greenAt);
      ctx.win(ms + "ms — floor it.", ms < 350 ? 1 : 0);
    },
    onTimeout: function (ctx) { ctx.fail("The light was green. It's still green."); }
  };

  /* ---- 2. MAKE IT PUBLIC — "PUBLISH!" (click) ---- */
  var gamePublish = {
    id: "publish", value: "Make it public", verb: "PUBLISH!", input: "click",
    baseDurationMs: 4200,
    params: { items: ["the code", "the roadmap", "the salaries"] },
    setup: function (ctx) {
      ctx.state.left = ctx.params.items.length;
      var rows = ctx.params.items.map(function (label, i) {
        return '<div class="hw-toggle" data-i="' + i + '" role="button" tabindex="-1">' +
          '<span>' + label + '</span><span class="hw-pill">PRIVATE</span></div>';
      }).join("");
      scene.innerHTML = '<div class="hw-screen"><div class="hw-toggles">' + rows + '</div></div>';
      scene.querySelectorAll(".hw-toggle").forEach(function (el) {
        el.addEventListener("pointerdown", function () {
          if (el.classList.contains("hw-public")) return;
          el.classList.add("hw-public");
          el.querySelector(".hw-pill").textContent = "PUBLIC";
          sfx("tick");
          ctx.state.left--;
          if (ctx.state.left === 0) ctx.win("Everything's out in the open.", 0);
        });
      });
    },
    onTimeout: function (ctx) { ctx.fail("Still " + ctx.state.left + " thing" + (ctx.state.left > 1 ? "s" : "") + " behind closed doors."); }
  };

  /* ---- 3. DO MORE WEIRD — "WEIRD!" (mash) ---- */
  var gameWeird = {
    id: "weird", value: "Do more weird", verb: "WEIRD!", input: "click",
    baseDurationMs: 4200,
    params: { target: 12, words: ["WEIRD", "HOG", "!?", "★", "WHY NOT", "MORE", "♨", "hi"] },
    setup: function (ctx) {
      ctx.state.count = 0;
      scene.innerHTML =
        '<div class="hw-poster" id="hw-poster">' +
          '<div class="hw-poster-label" id="hw-poster-label">a perfectly normal poster</div>' +
        '</div>' +
        '<p class="hw-hint" style="position:absolute; bottom:6%; left:0; right:0; text-align:center;">click it weirder — ' +
          '<span id="hw-weird-count">0</span>/' + ctx.params.target + '</p>';
      var poster = $("hw-poster");
      var colors = ["var(--accent)", "var(--accent-strong)", "var(--chip-text)"];
      poster.addEventListener("pointerdown", function (e) {
        var r = poster.getBoundingClientRect();
        var s = document.createElement("span");
        s.className = "hw-sticker";
        s.textContent = ctx.params.words[Math.floor(Math.random() * ctx.params.words.length)];
        var c = colors[Math.floor(Math.random() * colors.length)];
        s.style.color = "var(--on-accent)";
        s.style.background = c;
        s.style.left = (e.clientX - r.left - 14) + "px";
        s.style.top = (e.clientY - r.top - 12) + "px";
        s.style.transform = "rotate(" + (Math.random() * 44 - 22) + "deg) scale(" + (0.8 + Math.random() * 0.7) + ")";
        poster.appendChild(s);
        sfx("tick");
        ctx.state.count++;
        var label = $("hw-weird-count"), plain = $("hw-poster-label");
        if (label) label.textContent = ctx.state.count;
        if (plain && ctx.state.count > 3) plain.style.opacity = "0";
        if (ctx.state.count >= ctx.params.target) ctx.win("Perfectly optimized for our strategy.", 0);
      });
    },
    onTimeout: function (ctx) { ctx.fail("Only " + ctx.state.count + " weird. Not weird enough."); }
  };

  /* ---- 4. WHY NOT NOW? — "SHIP IT!" (click) ---- */
  var gameShip = {
    id: "ship", value: "Why not now?", verb: "SHIP IT!", input: "click",
    baseDurationMs: 4600,
    params: {
      spawnEveryMs: 520,
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
      scene.innerHTML = '<button id="hw-ship-btn" class="hw-btn">SHIP</button>';
      $("hw-ship-btn").addEventListener("pointerdown", function () {
        ctx.win("Shipped. Today.", ctx.state.spawned >= 5 ? 1 : 0);
      });
    },
    update: function (ctx) {
      if (ctx.elapsed - ctx.state.lastSpawn < ctx.params.spawnEveryMs) return;
      ctx.state.lastSpawn = ctx.elapsed;
      var box = stage.getBoundingClientRect();
      var p = ctx.params.popups[ctx.state.spawned % ctx.params.popups.length];
      var el = document.createElement("div");
      el.className = "hw-popup";
      el.innerHTML = "<b>" + p[0] + "</b><span>" + p[1] + "</span>";
      // Aim popups at a jittered ring around the button so they bury it over time.
      var cx = box.width * 0.5, cy = box.height * 0.55;
      var jx = cx + (Math.random() - 0.5) * box.width * 0.34;
      var jy = cy + (Math.random() - 0.5) * box.height * 0.34;
      el.style.left = Math.max(4, Math.min(box.width - 130, jx - 60)) + "px";
      el.style.top = Math.max(30, Math.min(box.height - 70, jy - 30)) + "px";
      el.style.transform = "rotate(" + (Math.random() * 10 - 5) + "deg)";
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
    return { score: 0, cleared: 0, loop: 1, speed: startSpeed, order: shuffle(GAMES.slice()), idx: 0, phase: "verb" };
  }
  function shuffle(a) {
    for (var i = a.length - 1; i > 0; i--) {
      var j = Math.floor(Math.random() * (i + 1)), t = a[i]; a[i] = a[j]; a[j] = t;
    }
    return a;
  }

  function updateHud() {
    $("hw-hud-score").textContent = "Score " + run.score;
    $("hw-hud-loop").textContent = "Loop " + run.loop;
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
    active = {
      game: game,
      params: game.params,
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
      sfx("pass");
      capture("hogware_microgame_cleared", { game: game.id, value: game.value, loop: run.loop, bonus: bonus });
    } else {
      sfx("fail");
      shake();
    }
    updateHud();

    hideAllScreens();
    var word = $("hw-result-word");
    word.textContent = pass ? (bonus > 0 ? "CLEARED +" + bonus : "CLEARED") : "MISSED";
    word.className = "hw-result-word " + (pass ? "hw-pass" : "hw-fail");
    $("hw-result-flavor").textContent = flavor || "";
    show(screens.result);

    setTimeout(function () {
      if (!pass) return gameOver();
      run.idx++;
      if (run.idx >= run.order.length) {
        run.idx = 0;
        run.loop++;
        run.speed = Math.max(SPEED_FLOOR, run.speed * SPEED_DECAY);
        run.order = shuffle(run.order);
        showQuote();
      } else {
        nextGame();
      }
    }, RESULT_MS);
  }

  /* ---- Interstitial: a real value quote between loops (skippable) ---- */
  var quoteTimer = null;
  function showQuote() {
    hideAllScreens();
    var pool = QUOTES.slice();
    if (ph()) pool.push(REPLAY_QUOTE);
    var q = pool[Math.floor(Math.random() * pool.length)];
    $("hw-quote-text").textContent = q.text;
    $("hw-quote-source").textContent = q.value + " — posthog.com/handbook/values";
    show(screens.quote);
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

    capture("hogware_run_completed", {
      score: run.score, stages_cleared: run.cleared, loops_reached: run.loop, pace_variant: paceVariant
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
      handle: handle, score: run.score, stages_cleared: run.cleared, loops_reached: run.loop
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
