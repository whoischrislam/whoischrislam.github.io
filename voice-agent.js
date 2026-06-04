/* Portfolio voice agent — frontend (Phase 1, turn-based).
   /stt (upload) -> /ask (Claude) -> /tts. The client is dumb plumbing:
   capture audio, call endpoints, play audio. All judgment lives server-side.
   Hardened per the adversarial review (Safari MIME, gesture-time audio unlock,
   state guards, r.ok handling, signed TTS). */
(function () {
  "use strict";

  // Deployed Worker URL.
  var VOICE_API = "https://portfolio-voice-backend.whoischrislam.workers.dev";

  var root = document.getElementById("voice-interface");
  if (!root || !root.classList.contains("voice-agent")) return;

  var micBtn = root.querySelector(".va-mic");
  var micLabel = root.querySelector(".va-mic-label");
  var stopBtn = root.querySelector(".va-stop");
  var statusEl = root.querySelector(".va-status");
  var convoEl = root.querySelector(".va-conversation");
  var lensBtns = Array.prototype.slice.call(root.querySelectorAll(".va-lens"));
  var starterBtns = Array.prototype.slice.call(root.querySelectorAll(".va-starter"));

  var lens = null;
  var mediaRecorder = null;
  var chunks = [];
  var audioCtx = null;
  var currentSource = null;
  var thinkTimer = null;
  var requestingMic = false; // synchronous guard against double-tap races

  function state() { return root.dataset.state; }

  function setState(s) {
    root.dataset.state = s;
    var idle = s === "idle";
    micBtn.disabled = s === "processing";
    stopBtn.hidden = s !== "speaking";
    lensBtns.forEach(function (b) { b.disabled = !idle; });
    starterBtns.forEach(function (b) { b.disabled = !idle; });

    if (thinkTimer) { clearInterval(thinkTimer); thinkTimer = null; }
    if (s === "listening") micLabel.textContent = "Listening… tap to stop";
    else if (s === "processing") startThinking();
    else if (s === "speaking") micLabel.textContent = "Speaking…";
    else micLabel.textContent = "Tap to ask";
  }

  function startThinking() {
    var t0 = Date.now();
    micLabel.textContent = "Thinking…";
    thinkTimer = setInterval(function () {
      var s = Math.round((Date.now() - t0) / 1000);
      micLabel.textContent = "Thinking (" + s + "s)…";
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

  // Create + resume the AudioContext synchronously inside a user gesture so iOS
  // lets us play audio later (after the network round-trips).
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
  function extFor(mime) {
    if (mime.indexOf("mp4") > -1) return "audio.mp4";
    if (mime.indexOf("ogg") > -1) return "audio.ogg";
    return "audio.webm";
  }

  // --- lens pills (optional, idle only) ---
  lensBtns.forEach(function (b) {
    b.addEventListener("click", function () {
      if (state() !== "idle") return;
      if (lens === b.dataset.lens) { lens = null; b.classList.remove("is-active"); }
      else { lens = b.dataset.lens; lensBtns.forEach(function (x) { x.classList.toggle("is-active", x === b); }); }
    });
  });

  // --- typed starters (idle only) ---
  starterBtns.forEach(function (b) {
    b.addEventListener("click", function () {
      if (state() !== "idle") return;
      unlockAudio();
      addTurn("you", b.textContent);
      ask(b.textContent);
    });
  });

  micBtn.addEventListener("click", onMic);
  stopBtn.addEventListener("click", stopPlayback);

  function onMic() {
    unlockAudio(); // inside the gesture
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
        fail("Couldn't start recording. Try a question below instead.");
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
      setStatus("");
    }).catch(function () {
      requestingMic = false;
      fail("I need mic access to listen. You can also tap a question below.");
    });
  }

  function stopRecording() {
    if (mediaRecorder && mediaRecorder.state !== "inactive") mediaRecorder.stop();
  }

  function describeError(status) {
    if (status === 429) return "Lots of questions right now. Give it a few seconds and try again.";
    return "Something went wrong. Try again?";
  }

  function transcribe(blob, type) {
    setState("processing");
    setStatus("Transcribing…");
    var fd = new FormData();
    fd.append("file", blob, extFor(type));
    fetch(VOICE_API + "/stt", { method: "POST", body: fd })
      .then(function (r) {
        if (!r.ok) throw { status: r.status };
        return r.json();
      })
      .then(function (data) {
        var t = (data && data.transcript ? data.transcript : "").trim();
        if (!t) { fail("I didn't catch that. Try again, or tap a question below."); return; }
        addTurn("you", t);
        ask(t);
      })
      .catch(function (e) { fail(describeError(e && e.status)); });
  }

  function ask(transcript) {
    setState("processing");
    setStatus("");
    var body = lens ? { transcript: transcript, lens: lens } : { transcript: transcript };
    fetch(VOICE_API + "/ask", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    })
      .then(function (r) {
        if (!r.ok) throw { status: r.status };
        return r.json();
      })
      .then(function (data) {
        var reply = data && data.reply ? data.reply : "";
        if (!reply) { fail("Something went wrong. Try again?"); return; }
        addTurn("agent", reply);
        speak(reply, data.ttsToken);
      })
      .catch(function (e) { fail(describeError(e && e.status)); });
  }

  function speak(text, token) {
    setState("speaking");
    setStatus("");
    if (!token) { done(); return; } // no signature -> skip audio, text is shown
    fetch(VOICE_API + "/tts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text: text, token: token }),
    })
      .then(function (r) { if (!r.ok) throw new Error("tts"); return r.arrayBuffer(); })
      .then(function (buf) {
        if (!audioCtx) { done(); return; }
        return audioCtx.decodeAudioData(buf).then(function (audioBuffer) {
          var src = audioCtx.createBufferSource();
          src.buffer = audioBuffer;
          src.connect(audioCtx.destination);
          src.onended = function () {
            src.disconnect();
            currentSource = null;
            if (audioCtx) { try { audioCtx.suspend(); } catch (e) {} }
            done();
          };
          currentSource = src;
          src.start();
        });
      })
      .catch(function () { done(); }); // text answer already shown
  }

  function stopPlayback() {
    if (currentSource) {
      try { currentSource.stop(); } catch (e) {}
      try { currentSource.disconnect(); } catch (e) {}
      currentSource = null;
    }
    if (audioCtx) { try { audioCtx.suspend(); } catch (e) {} }
    done();
  }

  function done() { setState("idle"); setStatus(""); }
  function fail(msg) { setState("idle"); setStatus(msg); }

  setState("idle");
})();
