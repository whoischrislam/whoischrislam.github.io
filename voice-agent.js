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
    var el = document.createElement("p");
    el.className = "va-turn va-turn-" + role;
    el.textContent = text;
    convoEl.appendChild(el);
    convoEl.scrollTop = convoEl.scrollHeight;
  }

  function renderFlows() {
    var set = FLOWS[lens] || FLOWS.default;
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
  modeBtns.forEach(function (b) {
    b.addEventListener("click", function () {
      if (state() !== "idle") return;
      if (lens === b.dataset.lens) { lens = null; b.classList.remove("is-active"); }
      else { lens = b.dataset.lens; modeBtns.forEach(function (x) { x.classList.toggle("is-active", x === b); }); }
      renderFlows();
    });
  });

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
  stopBtn.addEventListener("click", stopPlayback);

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
    fetch(VOICE_API + "/ask", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) })
      .then(function (r) { if (!r.ok) throw { status: r.status }; return r.json(); })
      .then(function (d) {
        var reply = d && d.reply ? d.reply : "";
        if (!reply) { fail("Something went wrong. Try again?"); return; }
        if (d.receipt) { receipts.push(d.receipt); turnCount++; maybeShowBrief(); }
        addTurn("agent", reply);
        speak(reply, d.ttsToken);
      })
      .catch(function (e) { fail(describeError(e && e.status)); });
  }

  function speak(text, token) {
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
  function stopPlayback() {
    if (currentSource) { try { currentSource.stop(); } catch (e) {} try { currentSource.disconnect(); } catch (e) {} currentSource = null; }
    if (audioCtx) { try { audioCtx.suspend(); } catch (e) {} }
    done();
  }
  function done() { setState("idle"); }
  function fail(msg) { setState("idle"); setStatus(msg); }

  // --- hero CTA: focus the composer after the anchor scroll ---
  var heroCta = document.querySelector("[data-va-focus]");
  if (heroCta) heroCta.addEventListener("click", function () {
    setTimeout(function () { try { inputEl.focus({ preventScroll: true }); } catch (e) { inputEl.focus(); } }, 500);
  });

  // --- floating launcher: appears once the inline agent scrolls out of view ---
  if (launcher) {
    launcher.addEventListener("click", function () {
      root.scrollIntoView({ behavior: "smooth", block: "center" });
      setTimeout(function () { try { inputEl.focus({ preventScroll: true }); } catch (e) {} }, 500);
    });
    if ("IntersectionObserver" in window) {
      new IntersectionObserver(function (entries) {
        entries.forEach(function (en) { launcher.hidden = en.isIntersecting; });
      }, { threshold: 0.25 }).observe(root);
    }
  }

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

  renderFlows();
  setState("idle");
})();
