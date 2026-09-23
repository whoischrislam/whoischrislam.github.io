/* Reusable dev tuning panel - the ONE standard for tuning effects (replaces bespoke per-effect panels).
   Loaded by index.html and by throwaway spike pages, so every tuner is the same tool.
   window.devPanel(cfg) renders ONLY when the URL has ?dev, so nothing dev-only ever ships to users.
   cfg = { title, target, sliders:[{k,label,min,max,step}], toggles:[{options:[{label,value,on}], onPick}],
           selects:[{k,label,options:[[value,label]], onPick}], onChange, pos:'left'|'bottom'|'left bottom', copy:false }.
   Returns the panel element (or null without ?dev); remove() it to swap panels. */
(function(){
  var DEV=/[?&]dev\b/.test(location.search);
  var styled=false;
  function injectCSS(){ if(styled) return; styled=true;
    var s=document.createElement('style');
    s.textContent='.devpanel{position:fixed;top:12px;right:12px;z-index:100000;width:214px;max-height:88vh;'
     +'overflow:auto;background:rgba(20,20,22,.94);border:1px solid rgba(255,255,255,.14);border-radius:10px;'
     +'padding:10px 12px;box-shadow:0 8px 30px rgba(0,0,0,.45);font-family:var(--sans,sans-serif);color:#ddd;backdrop-filter:blur(6px)}'
     +'.devpanel.left{right:auto;left:12px}.devpanel.bottom{top:auto;bottom:12px}'
     +'.devpanel h4{margin:0 0 6px;font-size:10px;letter-spacing:.08em;text-transform:uppercase;color:#8a8f98;font-weight:700}'
     +'.devpanel .row{display:flex;align-items:center;gap:6px;margin:5px 0}'
     +'.devpanel label{flex:0 0 62px;font-size:11px;color:#cfd3d8}'
     +'.devpanel input[type=range]{flex:1;height:16px;accent-color:var(--accent,#2a9d4f);min-width:0}'
     +'.devpanel .val{flex:0 0 32px;font-size:10px;text-align:right;color:#8a8f98;font-variant-numeric:tabular-nums}'
     +'.devpanel .tg{display:flex;gap:2px;margin:6px 0}'
     +'.devpanel .tg button{flex:1;appearance:none;border:0;background:transparent;color:#ddd;font:600 11px/1 var(--sans);padding:5px;border-radius:6px;cursor:pointer}'
     +'.devpanel .tg button:hover{background:rgba(255,255,255,.08)}.devpanel .tg button.on{background:var(--accent,#2a9d4f);color:#fff}'
     +'.devpanel select{flex:1;min-width:0;background:#2a2a2e;color:#ddd;border:1px solid rgba(255,255,255,.16);border-radius:6px;font:600 11px/1.2 var(--sans,sans-serif);padding:4px}'
     +'.devpanel .copy{margin-top:8px;width:100%;appearance:none;border:1px solid rgba(255,255,255,.16);background:transparent;color:#ddd;font:600 11px/1 var(--sans);padding:6px;border-radius:6px;cursor:pointer}';
    document.head.appendChild(s);
  }
  window.devPanel=function(cfg){
    if(!DEV) return null;                 // no-op unless ?dev - never ships to users
    injectCSS();
    cfg=cfg||{}; var t=cfg.target||{};
    var p=document.createElement('div'); p.className='devpanel'+(cfg.pos?' '+cfg.pos:'');
    if(cfg.title){ var h=document.createElement('h4'); h.textContent=cfg.title; p.appendChild(h); }
    (cfg.sliders||[]).forEach(function(c){
      var row=document.createElement('div'); row.className='row';
      var l=document.createElement('label'); l.textContent=c.label||c.k;
      var inp=document.createElement('input'); inp.type='range'; inp.min=c.min; inp.max=c.max; inp.step=c.step; inp.value=(t[c.k]!=null?t[c.k]:c.min);
      var fmt=function(n){ return c.step<1?(+n).toFixed(2):n; };
      var v=document.createElement('span'); v.className='val'; v.textContent=fmt(inp.value);
      inp.addEventListener('input',function(){ var n=parseFloat(inp.value); t[c.k]=n; v.textContent=fmt(n); if(cfg.onChange) cfg.onChange(t,c.k,n); });
      row.appendChild(l); row.appendChild(inp); row.appendChild(v); p.appendChild(row);
    });
    (cfg.toggles||[]).forEach(function(g){
      var tg=document.createElement('div'); tg.className='tg';
      (g.options||[]).forEach(function(o){
        var b=document.createElement('button'); b.textContent=o.label; if(o.on) b.classList.add('on');
        b.addEventListener('click',function(){ tg.querySelectorAll('button').forEach(function(x){x.classList.remove('on');}); b.classList.add('on'); if(g.onPick) g.onPick(o.value); });
        tg.appendChild(b);
      });
      p.appendChild(tg);
    });
    (cfg.selects||[]).forEach(function(c){
      var row=document.createElement('div'); row.className='row';
      var l=document.createElement('label'); l.textContent=c.label||c.k;
      var sel=document.createElement('select');
      (c.options||[]).forEach(function(o){ var op=document.createElement('option'); op.value=o[0]; op.textContent=o[1]; if(String(t[c.k])===String(o[0])) op.selected=true; sel.appendChild(op); });
      sel.addEventListener('change',function(){ t[c.k]=sel.value; if(c.onPick) c.onPick(sel.value); if(cfg.onChange) cfg.onChange(t,c.k,sel.value); });
      row.appendChild(l); row.appendChild(sel); p.appendChild(row);
    });
    if(cfg.copy!==false){
      var btn=document.createElement('button'); btn.className='copy'; btn.textContent='Copy settings';
      btn.addEventListener('click',function(){ var out=JSON.stringify(t); try{navigator.clipboard.writeText(out);}catch(e){} console.log((cfg.title||'devPanel')+' '+out); btn.textContent='Copied ✓'; setTimeout(function(){btn.textContent='Copy settings';},1200); });
      p.appendChild(btn);
    }
    document.body.appendChild(p);
    return p;
  };
})();
