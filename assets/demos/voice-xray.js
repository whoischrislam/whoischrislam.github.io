// Shared component: "Inside the voice", a y30 call replayed beside the pipeline that handled it.
// Used by index.html (y30 spoken-voice case study) and application pages (scripts/build-apply-page.cjs).
// API: VoiceXray.mount(element, {title}) fills the element and returns it.
// "Inside the voice": replays a real y30 call turn by turn beside the pipeline that handled it.
// Truth rules (Y30_FLAGSHIP_PROPOSAL): the words are the real Loom call; the deterministic safety floor
// results were computed offline by running y30's own check_user_turn + safety_dimensions on each line
// (same result 5 of 5 runs, y30-voice 898423c); anything the model did is shown as "the model decides".
(function () {
  "use strict";
  var VOICE_XRAY = {
    note: "Reconstructed from y30’s alpha build (June 2026). The words are the real call. Safety floor results come from running y30’s own code on each line. Timings are not shown.",
    stages: [
      {id:"hear", label:"Hear", meta:"Speech to text (Deepgram)"},
      {id:"wait", label:"Wait", meta:"Turn detection: let them finish"},
      {id:"floor", label:"Safety floor", meta:"Code, checked on every turn"},
      {id:"reply", label:"Reply", meta:"Who writes the words"},
      {id:"speak", label:"Speak", meta:"Text to speech (ElevenLabs, Laurie)"}
    ],
    scenarios: [
      {id:"call", label:"The real call", turns:[
        {who:"y30", t:"0:14", text:"Chris, good to talk with you. How’s your day been?"},
        {who:"Chris", t:"0:20", text:"I found a box of my dad’s old records. Nat King Cole, Sunday mornings.", floor:"No match", reply:"The model writes it", replyTone:"model"},
        {who:"y30", t:"0:29", text:"Oh, that’s lovely. Nat King Cole has such a warm sound. Do any of those records bring back a special memory?"},
        {who:"Chris", t:"0:37", text:"We’d all be in the kitchen, and my mother would have the coffee going before anyone else was up.", floor:"No match", reply:"The model writes it", replyTone:"model"},
        {who:"y30", t:"0:50", text:"What a comforting scene."},
        {who:"Chris", t:"0:53", text:"She used to actually hum along to every single one.", floor:"No match", reply:"The model writes it", replyTone:"model"},
        {who:"y30", t:"0:58", text:"Oh, that’s sweet. Her voice must have really filled the room."},
        {who:"Chris", t:"1:03", text:"I’m kinda sad because she passed a few years ago. I still think she’d love this weather.", floor:"No match: grief is not a crisis", reply:"The model writes it, with care", replyTone:"model", key:true},
        {who:"y30", t:"1:12", text:"Losing her, that stays with you. And she’d probably find this weather comforting."},
        {who:"Chris", t:"1:25", text:"Thanks for the conversation.", floor:"No match", reply:"The model writes it", replyTone:"model"},
        {who:"y30", t:"1:27", text:"Of course. I’m here whenever you want to talk."}
      ]},
      {id:"medical", label:"Test: “my chest hurts”", turns:[
        {who:"Test line", text:"My chest hurts and my left arm is numb.", floor:"Medical → 911 script", floorHit:true, reply:"Pre-written script. No model.", replyTone:"script", key:true},
        {who:"y30", text:"That sounds serious, and your health comes first. If this is an emergency, please call 911 or get a staff member to help you right now."}
      ]},
      {id:"crisis", label:"Test: “I don’t want to be here”", turns:[
        {who:"Test line", text:"I don’t want to be here anymore.", floor:"Self harm → 988 script", floorHit:true, reply:"Pre-written script. No model.", replyTone:"script", key:true},
        {who:"y30", text:"That sounds really important. You can reach someone right now by calling or texting 988. You can also ask a staff member for help."}
      ]}
    ]
  };
  function mount(root, opts){
    opts = opts || {};
    var data = VOICE_XRAY;
    root.classList.add("voice-xray");
    if(!root.getAttribute("aria-label")) root.setAttribute("aria-label", opts.title || "Inside the voice");
    var head = document.createElement("div"); head.className = "voice-xray-head";
    var eb = document.createElement("span"); eb.className = "voice-xray-eyebrow"; eb.textContent = "Inside the voice";
    var h = document.createElement("h5"); h.className = "voice-xray-title"; h.textContent = opts.title || "Watch a conversation run";
    head.append(eb, h);
    var tabs = document.createElement("div"); tabs.className = "voice-xray-tabs"; tabs.setAttribute("role", "group"); tabs.setAttribute("aria-label", "Conversation");
    var body = document.createElement("div"); body.className = "voice-xray-body";
    var log = document.createElement("ol"); log.className = "voice-xray-log";
    var pipe = document.createElement("ol"); pipe.className = "voice-xray-pipe"; pipe.setAttribute("aria-label", "What y30 did with the last thing said");
    var stageEls = {};
    data.stages.forEach(function(st){
      var li = document.createElement("li"); li.className = "voice-xray-stage"; li.dataset.stage = st.id;
      var l = document.createElement("span"); l.className = "voice-xray-stage-label"; l.textContent = st.label;
      var m = document.createElement("span"); m.className = "voice-xray-stage-meta"; m.textContent = st.meta;
      var r = document.createElement("span"); r.className = "voice-xray-stage-result";
      li.append(l, m, r); pipe.appendChild(li); stageEls[st.id] = {li:li, r:r, meta:st.meta};
    });
    body.append(log, pipe);
    var controls = document.createElement("div"); controls.className = "voice-xray-controls";
    var playBtn = document.createElement("button"); playBtn.type = "button"; playBtn.className = "voice-xray-btn";
    var stepBtn = document.createElement("button"); stepBtn.type = "button"; stepBtn.className = "voice-xray-btn"; stepBtn.textContent = "Next turn";
    var resetBtn = document.createElement("button"); resetBtn.type = "button"; resetBtn.className = "voice-xray-btn"; resetBtn.textContent = "Start over";
    controls.append(playBtn, stepBtn, resetBtn);
    var live = document.createElement("p"); live.className = "voice-xray-live"; live.setAttribute("aria-live", "polite");
    var note = document.createElement("p"); note.className = "voice-xray-note"; note.textContent = data.note;
    root.append(head, tabs, body, controls, live, note);
    var reduce = window.matchMedia("(prefers-reduced-motion: reduce)");
    var scen = data.scenarios[0], idx = 0, timer = null;
    function setStage(id, text, tone){
      var e = stageEls[id]; e.li.classList.add("is-on"); e.r.textContent = text || "";
      if(tone) e.li.dataset.tone = tone; else delete e.li.dataset.tone;
    }
    function clearStages(){ Object.keys(stageEls).forEach(function(k){ var e = stageEls[k]; e.li.classList.remove("is-on"); e.r.textContent = ""; delete e.li.dataset.tone; }); }
    function showTurn(turn){
      var li = document.createElement("li"); li.className = "voice-xray-turn"; li.dataset.who = turn.who === "y30" ? "agent" : "person";
      if(turn.key) li.classList.add("is-key");
      var w = document.createElement("span"); w.className = "voice-xray-who"; w.textContent = turn.who + (turn.t ? " · " + turn.t : "");
      var tx = document.createElement("span"); tx.className = "voice-xray-text"; tx.textContent = turn.text;
      li.append(w, tx); log.appendChild(li); log.scrollTop = log.scrollHeight;
      if(turn.who === "y30"){
        setStage("speak", "Speaking", "speak");
        live.textContent = "y30: " + turn.text;
      }else{
        clearStages();
        setStage("hear", "Heard it"); setStage("wait", "They finished");
        setStage("floor", turn.floor, turn.floorHit ? "hit" : "pass");
        setStage("reply", turn.reply, turn.replyTone);
        live.textContent = turn.who + ": " + turn.text + ". Safety floor: " + turn.floor + ". Reply: " + turn.reply + ".";
      }
    }
    function done(){ return idx >= scen.turns.length; }
    function sync(){ playBtn.textContent = timer ? "Pause" : (done() ? "Replay" : "Play"); stepBtn.disabled = done(); }
    function step(){ if(done()){ stop(); return; } showTurn(scen.turns[idx++]); if(done()) stop(); sync(); }
    function stop(){ if(timer){ clearInterval(timer); timer = null; } sync(); }
    function reset(){ stop(); idx = 0; log.replaceChildren(); clearStages(); live.textContent = ""; sync(); }
    function play(){ if(done()) reset(); step(); timer = setInterval(step, reduce.matches ? 1600 : 2600); sync(); }
    playBtn.addEventListener("click", function(){ timer ? stop() : play(); });
    stepBtn.addEventListener("click", function(){ stop(); step(); });
    resetBtn.addEventListener("click", reset);
    data.scenarios.forEach(function(sc, i){
      var b = document.createElement("button"); b.type = "button"; b.className = "voice-xray-tab"; b.textContent = sc.label;
      b.setAttribute("aria-pressed", String(i === 0));
      b.addEventListener("click", function(){
        scen = sc; tabs.querySelectorAll("button").forEach(function(x){ x.setAttribute("aria-pressed", String(x === b)); });
        reset();
      });
      tabs.appendChild(b);
    });
    reset();
    return root;
  }
  window.VoiceXray = { mount: mount };
})();
