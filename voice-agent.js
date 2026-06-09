/* Chris's AI hiring guide — frontend (Phase 1 + P1 interaction model).
   Composer (type or speak) -> /stt (upload) -> /ask (Claude, hiring-guide
   model) -> /tts. Mode-aware quick flows, four states, floating launcher.
   The client is dumb plumbing; all judgment lives server-side. */
(function () {
  "use strict";

  var VOICE_API = "https://portfolio-voice-backend.whoischrislam.workers.dev";

  var root = document.getElementById("voice-interface");
  if (!root || !root.classList.contains("voice-agent")) return;

  function slice(n) { return Array.prototype.slice.call(n); }

  var modeBtns = slice(root.querySelectorAll(".va-mode"));
  var scrollEl = root.querySelector(".va-scroll");
  var convoEl = root.querySelector(".va-conversation");
  var statusEl = root.querySelector(".va-status");
  var flowsEl = root.querySelector(".va-flows");
  var inputEl = root.querySelector(".va-input");
  var sendBtn = root.querySelector(".va-send");
  var micBtn = root.querySelector(".va-mic");
  var stopBtn = root.querySelector(".va-stop");
  var launcher = document.getElementById("va-launcher");
  var briefCta = root.querySelector(".va-brief-cta");
  var briefEl = document.getElementById("brief-print-root");
  var dock = document.getElementById("va-dock");
  var dockBody = dock ? dock.querySelector(".va-dock-body") : null;
  var dockClose = dock ? dock.querySelector(".va-dock-close") : null;
  var openCtas = slice(document.querySelectorAll("[data-va-open]"));
  var openCta = openCtas[0] || null; // the hero CTA, used for launcher visibility

  // Mode-aware quick flows (decision-oriented; content tuned over time).
  var FLOWS = {
    default: ["Qualify Chris in 60 seconds", "Show his strongest AI and healthcare proof", "Find his best-fit role and level"],
    recruiter: ["Qualify Chris in 60 seconds", "Best-fit roles and level", "Location, remote, and seniority", "Top 3 reasons to interview", "Resume and contact"],
    hiring_manager: ["Show his strongest systems work", "Explain y30's architecture", "What business outcomes has he moved?", "How does he work with PM, eng, and design?", "What would he own in the first 90 days?"],
    founder: ["What does Chris own end to end?", "How does he use AI as a force multiplier?", "Where does he create uncommon value?"],
    y30: ["What is y30?", "How does y30 handle safety?", "Why voice for elder care?"],
  };

  var lens = null;
  var mediaRecorder = null, chunks = [], audioCtx = null, currentSource = null, thinkTimer = null, requestingMic = false;
  var streamReader = null, ttsQueue = [], ttsPlaying = false, streamDone = false;
  var receipts = [], turnCount = 0, briefing = false;

  function state() { return root.dataset.state; }

  function setState(s) {
    root.dataset.state = s;
    var idle = s === "idle";
    inputEl.disabled = !idle;
    sendBtn.disabled = !idle;
    micBtn.disabled = !(s === "idle" || s === "listening");
    stopBtn.hidden = s !== "speaking";
    modeBtns.forEach(function (b) { b.disabled = !idle; });
    slice(flowsEl.querySelectorAll(".va-flow")).forEach(function (b) { b.disabled = !idle; });
    if (thinkTimer) { clearInterval(thinkTimer); thinkTimer = null; }
    if (s === "listening") setStatus("Listening… tap the mic to stop.");
    else if (s === "processing") startThinking();
    else if (s === "speaking") setStatus("Speaking…");
    else setStatus("");
  }

  function startThinking() {
    var t0 = Date.now();
    setStatus("Thinking…");
    thinkTimer = setInterval(function () {
      setStatus("Thinking (" + Math.round((Date.now() - t0) / 1000) + "s)…");
    }, 1000);
  }
  function setStatus(m) { statusEl.textContent = m || ""; }

  function addTurn(role, text) {
    root.classList.add("va-started"); // collapse the opener once the conversation begins
    var el = document.createElement("p");
    el.className = "va-turn va-turn-" + role;
    el.textContent = text;
    convoEl.appendChild(el);
    if (scrollEl) scrollEl.scrollTop = scrollEl.scrollHeight;
  }

  function renderFlows() {
    var set = (FLOWS[lens] || FLOWS.default).slice(0, 3); // keep the footer tray compact
    flowsEl.innerHTML = "";
    set.forEach(function (q) {
      var b = document.createElement("button");
      b.type = "button";
      b.className = "va-flow";
      b.textContent = q;
      b.addEventListener("click", function () {
        if (state() !== "idle") return;
        unlockAudio();
        addTurn("you", q);
        ask(q);
      });
      flowsEl.appendChild(b);
    });
  }

  function unlockAudio() {
    var Ctx = window.AudioContext || window.webkitAudioContext;
    if (!audioCtx && Ctx) audioCtx = new Ctx();
    if (audioCtx && audioCtx.state === "suspended") { try { audioCtx.resume(); } catch (e) {} }
  }
  function pickMime() {
    var prefs = ["audio/webm;codecs=opus", "audio/webm", "audio/mp4", "audio/ogg;codecs=opus", "audio/ogg"];
    if (typeof MediaRecorder !== "undefined" && MediaRecorder.isTypeSupported) {
      for (var i = 0; i < prefs.length; i++) if (MediaRecorder.isTypeSupported(prefs[i])) return prefs[i];
    }
    return "";
  }
  function extFor(m) { if (m.indexOf("mp4") > -1) return "audio.mp4"; if (m.indexOf("ogg") > -1) return "audio.ogg"; return "audio.webm"; }

  // --- modes (change answer format server-side) ---
  // Radio behaviour: pick a role and the picker collapses to that choice; "Change"
  // (or tapping the chosen pill) reopens it. The lens-tailored suggested questions
  // are the feedback, so there's no persistent acknowledgement cluttering the thread.
  var changeBtn = root.querySelector(".va-change");
  modeBtns.forEach(function (b) {
    b.addEventListener("click", function () {
      if (state() !== "idle") return;
      // Tapping the already-chosen role while collapsed just reopens the options.
      if (root.classList.contains("va-role-chosen") && b.classList.contains("is-active")) {
        root.classList.remove("va-role-chosen");
        return;
      }
      if (lens === b.dataset.lens) {
        lens = null; b.classList.remove("is-active");
        root.classList.remove("va-role-chosen");
      } else {
        lens = b.dataset.lens;
        modeBtns.forEach(function (x) { x.classList.toggle("is-active", x === b); });
        root.classList.add("va-role-chosen");
      }
      renderFlows();
    });
  });
  if (changeBtn) changeBtn.addEventListener("click", function () { root.classList.remove("va-role-chosen"); });

  // --- composer ---
  function sendTyped() {
    if (state() !== "idle") return;
    var t = (inputEl.value || "").trim();
    if (!t) return;
    inputEl.value = "";
    unlockAudio();
    addTurn("you", t);
    ask(t);
  }
  sendBtn.addEventListener("click", sendTyped);
  inputEl.addEventListener("keydown", function (e) { if (e.key === "Enter") { e.preventDefault(); sendTyped(); } });
  micBtn.addEventListener("click", onMic);
  stopBtn.addEventListener("click", stopTurn);

  function onMic() {
    unlockAudio(); // inside the gesture (iOS)
    if (state() === "listening") { stopRecording(); return; }
    if (state() !== "idle" || requestingMic) return;
    requestingMic = true;
    startRecording();
  }
  function startRecording() {
    navigator.mediaDevices.getUserMedia({ audio: true }).then(function (stream) {
      requestingMic = false;
      var mime = pickMime();
      try {
        mediaRecorder = mime ? new MediaRecorder(stream, { mimeType: mime }) : new MediaRecorder(stream);
      } catch (e) {
        stream.getTracks().forEach(function (t) { t.stop(); });
        fail("Couldn't start recording. Type your question instead.");
        return;
      }
      chunks = [];
      mediaRecorder.ondataavailable = function (e) { if (e.data && e.data.size) chunks.push(e.data); };
      mediaRecorder.onstop = function () {
        stream.getTracks().forEach(function (t) { t.stop(); });
        var type = mediaRecorder.mimeType || mime || "audio/webm";
        transcribe(new Blob(chunks, { type: type }), type);
      };
      mediaRecorder.start();
      setState("listening");
    }).catch(function () {
      requestingMic = false;
      fail("I need mic access to listen. You can also type your question.");
    });
  }
  function stopRecording() { if (mediaRecorder && mediaRecorder.state !== "inactive") mediaRecorder.stop(); }

  function describeError(status) {
    return status === 429 ? "Lots of questions right now. Give it a few seconds and try again." : "Something went wrong. Try again?";
  }

  function transcribe(blob, type) {
    setState("processing");
    setStatus("Transcribing…");
    var fd = new FormData();
    fd.append("file", blob, extFor(type));
    fetch(VOICE_API + "/stt", { method: "POST", body: fd })
      .then(function (r) { if (!r.ok) throw { status: r.status }; return r.json(); })
      .then(function (d) {
        var t = (d && d.transcript ? d.transcript : "").trim();
        if (!t) { fail("I didn't catch that. Try again, or type it."); return; }
        addTurn("you", t);
        ask(t);
      })
      .catch(function (e) { fail(describeError(e && e.status)); });
  }

  function ask(transcript) {
    setState("processing");
    var body = lens ? { transcript: transcript, lens: lens } : { transcript: transcript };
    // Send the verified receipts so the agent won't repeat proof it already gave.
    // The server uses only the agent's own prior replies, never the visitor's text.
    if (receipts.length) body.priorReceipts = receipts;
    streamAsk(body, transcript);
  }

  // Streaming turn (/ask-stream, SSE). Render each sentence as it clears the server-side
  // leak scan; queue per-sentence audio so speech starts on sentence 1 instead of after the
  // whole answer. If the stream can't be established before any text is shown, fall back to
  // the non-streaming /ask so the visitor still gets an answer.
  function streamAsk(body, transcript) {
    var agentEl = null, full = "", guided = false, fellBack = false;
    ttsQueue = []; ttsPlaying = false; streamDone = false;

    function append(text) {
      if (state() !== "speaking") setState("speaking"); // first sentence: drop the "Thinking…" timer
      if (!agentEl) {
        root.classList.add("va-started");
        agentEl = document.createElement("p");
        agentEl.className = "va-turn va-turn-agent";
        convoEl.appendChild(agentEl);
      }
      agentEl.textContent += (agentEl.textContent ? " " : "") + text;
      if (scrollEl) scrollEl.scrollTop = scrollEl.scrollHeight;
      full += (full ? " " : "") + text;
      if (!guided) { guideToProof(transcript, full); guided = true; } // react as the answer begins
    }

    function onEvent(ev) {
      if (ev.type === "sentence") {
        append(ev.text);
        if (ev.ttsToken) enqueueTts(ev.text, ev.ttsToken);
      } else if (ev.type === "done") {
        if (ev.receipt) { receipts.push(ev.receipt); turnCount++; maybeShowBrief(); }
        if (ev.reply && !guided) { guideToProof(transcript, ev.reply); guided = true; }
      } else if (ev.type === "error") {
        if (!full && !fellBack) { fellBack = true; askJson(body, transcript); }
      }
      // "truncated": a sentence hit the scan; keep what was shown, end gracefully.
    }

    function finish() {
      streamDone = true;
      streamReader = null;
      if (fellBack) return;
      if (!full) { fail("Something went wrong. Try again?"); return; }
      settleIdle(); // go idle once any queued audio drains
    }

    fetch(VOICE_API + "/ask-stream", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    }).then(function (r) {
      if (!r.ok || !r.body) throw { status: r.status || 0 };
      streamReader = r.body.getReader();
      var decoder = new TextDecoder(), sse = "";
      function pump() {
        return streamReader.read().then(function (res) {
          if (res.done) { finish(); return; }
          sse += decoder.decode(res.value, { stream: true });
          var nl;
          while ((nl = sse.indexOf("\n\n")) !== -1) {
            var raw = sse.slice(0, nl); sse = sse.slice(nl + 2);
            var line = null;
            raw.split("\n").forEach(function (l) { if (l.indexOf("data:") === 0) line = l.slice(5).trim(); });
            if (line) { try { onEvent(JSON.parse(line)); } catch (e) {} }
          }
          return pump();
        });
      }
      return pump();
    }).catch(function (e) {
      // Stream setup/continuation failed. Fall back only if nothing has been shown yet.
      if (!full && !fellBack) { fellBack = true; askJson(body, transcript); return; }
      finish();
    });
  }

  // --- streaming audio queue (sequential per-sentence playback) ---
  function enqueueTts(text, token) {
    if (!audioCtx) return; // no unlocked audio context -> text-only, skip speech
    ttsQueue.push({ text: text, token: token });
    if (!ttsPlaying) playNextTts();
  }
  function playNextTts() {
    if (ttsQueue.length === 0) { ttsPlaying = false; settleIdle(); return; }
    ttsPlaying = true;
    var item = ttsQueue.shift();
    fetch(VOICE_API + "/tts", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ text: item.text, token: item.token }) })
      .then(function (r) { if (!r.ok) throw new Error("tts"); return r.arrayBuffer(); })
      .then(function (buf) {
        if (!audioCtx) { playNextTts(); return; }
        return audioCtx.decodeAudioData(buf).then(function (ab) {
          var src = audioCtx.createBufferSource();
          src.buffer = ab;
          src.connect(audioCtx.destination);
          src.onended = function () { src.disconnect(); if (currentSource === src) currentSource = null; playNextTts(); };
          currentSource = src;
          src.start();
        });
      })
      .catch(function () { playNextTts(); }); // a failed sentence shouldn't stall the rest
  }
  // Idle only when the stream has ended AND all queued audio has played.
  function settleIdle() {
    if (streamDone && !ttsPlaying && ttsQueue.length === 0) {
      if (audioCtx) { try { audioCtx.suspend(); } catch (e) {} }
      done();
    }
  }
  // Stop button: cancel the stream, drop queued audio, stop playback, go idle.
  function stopTurn() {
    streamDone = true;
    if (streamReader) { try { streamReader.cancel(); } catch (e) {} streamReader = null; }
    ttsQueue = []; ttsPlaying = false;
    if (currentSource) { try { currentSource.stop(); } catch (e) {} try { currentSource.disconnect(); } catch (e) {} currentSource = null; }
    if (audioCtx) { try { audioCtx.suspend(); } catch (e) {} }
    done();
  }

  // --- non-streaming fallback (kept for resilience if /ask-stream is unavailable) ---
  function askJson(body, transcript) {
    setState("processing");
    fetch(VOICE_API + "/ask", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) })
      .then(function (r) { if (!r.ok) throw { status: r.status }; return r.json(); })
      .then(function (d) {
        var reply = d && d.reply ? d.reply : "";
        if (!reply) { fail("Something went wrong. Try again?"); return; }
        if (d.receipt) { receipts.push(d.receipt); turnCount++; maybeShowBrief(); }
        addTurn("agent", reply);
        guideToProof(transcript, reply);
        speakSingle(reply, d.ttsToken);
      })
      .catch(function (e) { fail(describeError(e && e.status)); });
  }
  function speakSingle(text, token) {
    setState("speaking");
    if (!token) { done(); return; }
    fetch(VOICE_API + "/tts", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ text: text, token: token }) })
      .then(function (r) { if (!r.ok) throw new Error("tts"); return r.arrayBuffer(); })
      .then(function (buf) {
        if (!audioCtx) { done(); return; }
        return audioCtx.decodeAudioData(buf).then(function (ab) {
          var src = audioCtx.createBufferSource();
          src.buffer = ab;
          src.connect(audioCtx.destination);
          src.onended = function () { src.disconnect(); currentSource = null; if (audioCtx) { try { audioCtx.suspend(); } catch (e) {} } done(); };
          currentSource = src;
          src.start();
        });
      })
      .catch(function () { done(); });
  }
  function done() { setState("idle"); }
  function fail(msg) { setState("idle"); setStatus(msg); }

  // --- every [data-va-open] CTA (hero + bottom) and the floating launcher open the dock ---
  openCtas.forEach(function (el) { el.addEventListener("click", function (e) { e.preventDefault(); openDock(); }); });
  if (launcher) {
    launcher.addEventListener("click", openDock);
    // Launcher appears once the hero CTA is scrolled out of view (and the dock is closed).
    if ("IntersectionObserver" in window && openCta) {
      new IntersectionObserver(function () { updateLauncher(); }, { threshold: 0 }).observe(openCta);
    }
  }
  if (dockClose) dockClose.addEventListener("click", closeDock);

  // --- recruiter brief (export artifact) ---
  function maybeShowBrief() {
    if (briefCta && turnCount >= 3) briefCta.hidden = false;
  }
  if (briefCta) briefCta.addEventListener("click", requestBrief);

  function requestBrief() {
    if (briefing || receipts.length < 3) return;
    briefing = true;
    briefCta.disabled = true;
    var orig = briefCta.textContent;
    briefCta.textContent = "Generating…";
    fetch(VOICE_API + "/brief", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ audience: "recruiter", receipts: receipts }),
    })
      .then(function (r) { return r.json(); })
      .then(renderBrief)
      .catch(function () {
        briefEl.hidden = false;
        briefEl.textContent = "Couldn't generate the brief right now. Try again in a moment.";
      })
      .then(function () { briefing = false; briefCta.disabled = false; briefCta.textContent = orig; });
  }

  function el(tag, cls, text) {
    var e = document.createElement(tag);
    if (cls) e.className = cls;
    if (text != null) e.textContent = text;
    return e;
  }
  function section(title, node) {
    briefEl.appendChild(el("h4", null, title));
    if (node) briefEl.appendChild(node);
  }
  function list(items) {
    var ul = el("ul");
    (items || []).forEach(function (t) { ul.appendChild(el("li", null, t)); });
    return ul;
  }

  function renderBrief(data) {
    briefEl.innerHTML = "";
    briefEl.hidden = false;
    if (!data || (!data.brief && !data.insufficientSignal)) {
      briefEl.appendChild(el("p", null, "Couldn't generate the brief right now. Try again in a moment."));
      return;
    }
    if (!data.brief && data.insufficientSignal) {
      briefEl.appendChild(el("p", "va-brief-title", "A bit more signal first"));
      briefEl.appendChild(el("p", null, data.message || "Ask a few more questions and I can put together a recruiter brief."));
      briefEl.appendChild(list(data.recommendedNextQuestions));
      return;
    }
    var b = data.brief;
    briefEl.appendChild(el("p", "va-brief-title", "Recruiter brief: Chris Lam"));
    section("Snapshot", el("p", null, b.snapshot));
    section("Best-fit roles", list(b.bestFitRoles));
    var ev = el("ul");
    (b.evidence || []).forEach(function (item) {
      var li = el("li", "va-brief-ev");
      li.appendChild(document.createTextNode(item.claim + " "));
      if (item.anchor) { var a = el("a", null, "(see proof)"); a.href = item.anchor; li.appendChild(a); }
      ev.appendChild(li);
    });
    section("Evidence", ev);
    if (b.openQuestions && b.openQuestions.length) section("Open questions to clarify", list(b.openQuestions));
    if (b.nextStep) section("Recommended next step", el("p", null, b.nextStep));
    var prov = (b.provenance && b.provenance.basis ? b.provenance.basis : "");
    if (b.provenance && b.provenance.generatedAt) prov += " Generated " + b.provenance.generatedAt.slice(0, 10) + ".";
    briefEl.appendChild(el("p", "va-brief-prov", prov));

    var actions = el("div", "va-brief-actions");
    var copyBtn = el("button", "va-brief-copy", "Copy"); copyBtn.type = "button";
    copyBtn.addEventListener("click", function () { copyBrief(b, copyBtn); });
    var printBtn = el("button", "va-brief-print", "Print / PDF"); printBtn.type = "button";
    printBtn.addEventListener("click", function () { window.print(); });
    var closeBtn = el("button", "va-brief-close", "Close"); closeBtn.type = "button";
    closeBtn.addEventListener("click", function () { briefEl.hidden = true; briefEl.innerHTML = ""; });
    actions.appendChild(copyBtn); actions.appendChild(printBtn); actions.appendChild(closeBtn);
    briefEl.appendChild(actions);
    briefEl.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }

  function copyBrief(b, btn) {
    var L = ["RECRUITER BRIEF: CHRIS LAM", ""];
    L.push("Snapshot: " + b.snapshot, "");
    L.push("Best-fit roles:");
    (b.bestFitRoles || []).forEach(function (r) { L.push("  - " + r); });
    L.push("", "Evidence:");
    (b.evidence || []).forEach(function (it) { L.push("  - " + it.claim + (it.anchor ? " [" + it.anchor + "]" : "")); });
    if (b.openQuestions && b.openQuestions.length) { L.push("", "Open questions to clarify:"); b.openQuestions.forEach(function (q) { L.push("  - " + q); }); }
    if (b.nextStep) L.push("", "Recommended next step: " + b.nextStep);
    L.push("", b.provenance && b.provenance.basis ? b.provenance.basis : "", "Source: whoischrislam.github.io");
    var text = L.join("\n");
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(function () {
        btn.textContent = "Copied"; setTimeout(function () { btn.textContent = "Copy"; }, 1500);
      });
    }
  }

  // --- Build B: page orchestration (guide to proof) ---
  // Deterministic keyword -> real section. Only acts on a confident match;
  // never invents a target. Scroll is gentle, interruptible, reduced-motion-safe.
  var PROOF_MAP = [
    { anchor: "#y30", kw: ["y30", "elder", "caregiver", "grandma", "safety", "patience window", "fsm", "voice ai"] },
    { anchor: "#playsesh", kw: ["playsesh", "discord", "game dev", "game-thinking", "durable objects", "websocket", "multiplayer", "indie"] },
    { anchor: "#work", kw: ["goodrx", "good rx", "clover", "amazon", "taskrabbit", "task rabbit", "ipo", "acquisition", "acquired", "conversion", "revenue", "nurse", "coupon", "prime", "webby", "sharecare", "modus", "jira", "dark mode", "metric", "outcome", "nps"] },
    { anchor: "#looking-for", kw: ["looking for", "role", "remote", "relocat", "location", "honolulu", "bay area", "seniority", "level", "open to", "best fit", "best-fit"] },
    { anchor: "#stack", kw: ["how he works", "how does he work", "his stack", "ai-native", "ai native", "force multiplier", "how he builds"] },
    { anchor: "#testimonials", kw: ["recommend", "reference", "vouch", "say about him", "testimonial"] },
    { anchor: "#play", kw: ["side project", "voice noir", "evolve die repeat", "board game", "for fun"] },
  ];
  function matchSection(text) {
    var t = (" " + (text || "")).toLowerCase();
    var best = null, bestCount = 0;
    PROOF_MAP.forEach(function (m) {
      var c = 0;
      m.kw.forEach(function (k) { if (t.indexOf(k) > -1) c++; });
      if (c > bestCount) { bestCount = c; best = m.anchor; }
    });
    return bestCount >= 1 ? best : null;
  }
  function pulse(inner) {
    inner.classList.remove("va-proof-highlight");
    void inner.offsetWidth; // restart the animation
    inner.classList.add("va-proof-highlight");
    setTimeout(function () { inner.classList.remove("va-proof-highlight"); }, 2800);
  }
  // Pulse when the section actually arrives in view, not when we start scrolling.
  function highlightOnArrival(target) {
    var inner = target.querySelector(".section-content") || target;
    if (!("IntersectionObserver" in window)) { pulse(inner); return; }
    var io = new IntersectionObserver(function (entries, obs) {
      entries.forEach(function (en) { if (en.isIntersecting) { pulse(inner); obs.disconnect(); } });
    }, { threshold: 0.2 });
    io.observe(target);
    setTimeout(function () { io.disconnect(); }, 6000); // safety
  }
  function guideToProof(question, reply) {
    // Match the question first; only consult the reply if it's substantive (not a refusal).
    var anchor = matchSection(question);
    if (!anchor && reply && reply.length > 40 && reply.toLowerCase().indexOf("just here to talk") < 0) {
      anchor = matchSection(reply);
    }
    if (!anchor) return;
    var target = document.querySelector(anchor);
    if (!target) return;
    // Attribution: make the agent's page navigation legible instead of a mystery scroll.
    // The status clears on its own when the turn ends (setState -> idle).
    var PROOF_LABELS = { "#y30": "the y30 work", "#playsesh": "PlaySesh", "#work": "his work history", "#looking-for": "what he's looking for", "#stack": "how he works", "#testimonials": "the references", "#play": "his side projects" };
    setStatus("Showing you " + (PROOF_LABELS[anchor] || "the proof") + " on the page…");
    highlightOnArrival(target);
    var reduce = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (!reduce) setTimeout(function () { target.scrollIntoView({ behavior: "smooth", block: "start" }); }, 900);
  }

  // --- pinned dock (the agent's only home; opens/closes, never inline) ---
  // Keep the dock usable when the mobile keyboard is up. A fixed bottom-sheet
  // otherwise sits at the layout-viewport bottom, which the keyboard hides. When
  // the keyboard is open on a small screen we anchor the dock to BOTH the top and
  // bottom of the visible (visual) viewport, so it becomes a flush sheet filling
  // the space above the keys: header at top, composer just above the keyboard, no
  // floating gap and no guesswork about content height.
  function clearDockKeyboardStyles() {
    dock.style.top = "";
    dock.style.bottom = "";
    dock.style.left = "";
    dock.style.right = "";
    dock.style.maxHeight = "";
    dock.style.borderRadius = "";
  }
  function positionDockForKeyboard() {
    if (!dock) return;
    var vv = window.visualViewport;
    if (dock.hidden || !vv || window.innerWidth > 540) { clearDockKeyboardStyles(); return; }
    var keyboard = Math.max(0, window.innerHeight - vv.height - vv.offsetTop);
    if (keyboard > 80) {
      dock.style.top = vv.offsetTop + "px";
      dock.style.bottom = keyboard + "px";
      dock.style.left = "0";
      dock.style.right = "0";
      dock.style.maxHeight = "none";
      dock.style.borderRadius = "var(--border-radius) var(--border-radius) 0 0";
    } else {
      clearDockKeyboardStyles();
    }
  }
  if (window.visualViewport) {
    window.visualViewport.addEventListener("resize", positionDockForKeyboard);
    window.visualViewport.addEventListener("scroll", positionDockForKeyboard);
  }

  function openDock() {
    if (!dock) return;
    dock.hidden = false;
    if (launcher) launcher.hidden = true;
    try { inputEl.focus({ preventScroll: true }); } catch (e) {}
    positionDockForKeyboard();
  }
  function closeDock() {
    if (!dock) return;
    dock.hidden = true;
    clearDockKeyboardStyles();
    updateLauncher();
    // a11y: return focus to the launcher so keyboard users aren't stranded
    try { if (launcher && !launcher.hidden) launcher.focus(); } catch (e) {}
  }
  // a11y: Escape closes the dock from anywhere inside it
  if (dock) {
    dock.addEventListener("keydown", function (e) {
      if (e.key === "Escape") { e.preventDefault(); closeDock(); }
    });
  }
  function updateLauncher() {
    if (!launcher) return;
    if (dock && !dock.hidden) { launcher.hidden = true; return; }
    if (!openCta) { launcher.hidden = false; return; }
    var r = openCta.getBoundingClientRect();
    launcher.hidden = r.top < window.innerHeight && r.bottom > 0; // hide while the hero CTA is on screen
  }

  // The agent lives only in the dock (never inline). Home it there on load.
  if (dockBody) { dockBody.appendChild(root); root.hidden = false; }
  renderFlows();
  updateLauncher();
  setState("idle");
})();
