/* Design-system catalog — runs only on ?ds. Renders the REAL live components by harvesting
   them from the running site (homepage DOM + hidden iframes of the company/case-study views),
   so the catalog is a true mirror, not a reconstruction. Foundations read live tokens. Adds the
   mark/note layer, per-tile "View live", and a Coverage view (wired vs to-wire). */
(function(){
  if(!/[?&]ds\b/.test(location.search)) return;
  var WORLDS=['goodrx','y30','clover','playsesh','pathstream','taskrabbit','sharecare','startplaying','modus','amazon','zodiacus'];
  var ROLE=[['--world-bg','Background'],['--world-ink','Text / ink'],['--world-accent','Accent / primary'],['--world-surface','Surface'],['--world-card-bg','Card']];
  var SEMANTIC=['--bg','--surface','--surface-2','--text','--muted','--border','--border-strong','--accent'];
  var TYPE=[['Display / Newsreader','40px',"'Newsreader',serif",'400','Chris Lam'],['Section / serif','28px',"'Newsreader',serif",'400','Controlled comparison'],['Card title / serif','21px',"'Newsreader',serif",'400','Admin console'],['Body / Figtree','15px',"'Figtree',sans-serif",'400','I design and code to ship products.'],['Label / sans','13px',"'Figtree',sans-serif",'700','Held constant'],['Kicker / Plex Mono','11px',"'IBM Plex Mono',monospace",'700','CONTROLLED INTERNAL BENCHMARK']];
  // harvest sources: company view + a rich case study
  var SRC={company:'index.html?work=y30',casestudy:'index.html?work=y30&project=spoken-voice-system'};
  // component registry: id, label, live selector, source ('home' = clone from homepage DOM, else SRC key), group
  var REG=[
    {id:'co-band',label:'World band (homepage)',sel:'.co-band',src:'home',grp:'Templated'},
    {id:'world-hero',label:'World hero (company/project)',sel:'.world-hero',src:'company',grp:'Templated'},
    {id:'work-panel-facts',label:'Fact grid / spec panel',sel:'.work-panel-facts',src:'company',grp:'Templated'},
    {id:'work-also-shipped-list',label:'Product-map / supporting card',sel:'.work-also-shipped-list',src:'company',grp:'Templated'},
    {id:'work-project-card',label:'Work project card',sel:'.work-project-card',src:'company',grp:'Templated'},
    {id:'portfolio-diagram',label:'Diagram card',sel:'.portfolio-diagram',src:'casestudy',grp:'Templated'},
    {id:'project-chapter',label:'Case-study chapter',sel:'.project-chapter',src:'casestudy',grp:'Templated'},
    {id:'project-story-nav',label:'Case-study jump-to nav',sel:'.project-story-nav',src:'casestudy',grp:'Templated'},
    {id:'work-vignette',label:'Media vignette / figure',sel:'.work-vignette',src:'casestudy',grp:'Templated'},
    {id:'wcard',label:'More-work card',sel:'.work-tile.wcard',src:'home',grp:'Chrome'},
    {id:'avail',label:'Availability pill',sel:'.avail',src:'home',grp:'Chrome'},
    {id:'read-progress',label:'Read-progress bar',sel:'.read-progress',src:'home',grp:'Chrome'}
  ];
  var LIVE={home:'index.html',company:SRC.company,casestudy:SRC.casestudy};
  var CUR='y30';
  function esc(s){return String(s).replace(/[&<>"]/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c];});}
  function readWorld(w){var b=document.body,prev=b.getAttribute('data-world');b.setAttribute('data-world',w);var cs=getComputedStyle(b),o={};ROLE.forEach(function(r){o[r[0]]=cs.getPropertyValue(r[0]).trim();});if(prev)b.setAttribute('data-world',prev);else b.removeAttribute('data-world');return o;}
  function mk(id,inner){return '<div class="markable" data-ds-id="'+esc(id)+'">'+inner+'</div>';}
  function card(t,body,proposed){return '<section class="ds-card"><h2 class="ds-h2">'+t+(proposed?' <span class="ds-ptag">proposed · pull from live</span>':'')+'</h2>'+body+'</section>';}

  // ---- harvesting ----
  function cloneFrom(doc,sel){try{var el=doc.querySelector(sel);return el?el.cloneNode(true):null;}catch(e){return null;}}
  function loadFrame(url){return new Promise(function(res){var f=document.createElement('iframe');f.setAttribute('aria-hidden','true');f.style.cssText='position:fixed;left:-10000px;top:0;width:1200px;height:2400px;border:0';f.src=url;var done=false;function go(){if(done)return;done=true;setTimeout(function(){res(f.contentDocument);},1600);}f.addEventListener('load',go);document.body.appendChild(f);setTimeout(go,6000);});}
  function harvest(){
    var out={};
    REG.filter(function(r){return r.src==='home';}).forEach(function(r){out[r.id]=cloneFrom(document,r.sel);});
    var srcs=Object.keys(SRC);
    return Promise.all(srcs.map(function(k){return loadFrame(SRC[k]).then(function(doc){return {k:k,doc:doc};});})).then(function(frames){
      var byKey={};frames.forEach(function(f){byKey[f.k]=f.doc;});
      REG.filter(function(r){return r.src!=='home';}).forEach(function(r){var doc=byKey[r.src];out[r.id]=doc?cloneFrom(doc,r.sel):null;});
      return out;
    });
  }

  // ---- views ----
  function foundations(){
    var sem='<div class="ds-grid4">'+SEMANTIC.map(function(t){var v=getComputedStyle(document.documentElement).getPropertyValue(t).trim();return mk('token:color:'+t,'<div class="tk"><div class="tksw" style="background:'+esc(v)+'"></div><div class="tkm"><div class="tkn">'+esc(t)+'</div><div class="tkv">'+esc(v||'—')+'</div></div></div>');}).join('')+'</div>';
    var wg='<h3 class="ds-h3">World palettes (11) — each color by its ROLE, read from live tokens</h3><div class="ds-grid4">'+WORLDS.map(function(w){var o=readWorld(w);var rows=ROLE.map(function(r){return '<div class="pal-row"><i class="pal-chip" style="background:'+esc(o[r[0]]||'#888')+'"></i><span class="pal-role" style="color:'+esc(o['--world-ink'])+'">'+r[1]+'</span><span class="pal-tok" style="color:'+esc(o['--world-ink'])+'">'+r[0].replace('--world-','')+'</span></div>';}).join('');return mk('token:world:'+w,'<div class="pal" style="background:'+esc(o['--world-bg'])+'"><div class="pal-h"><span class="pal-name" style="color:'+esc(o['--world-ink'])+'">'+w+'</span></div>'+rows+'</div>');}).join('')+'</div>';
    var type='<div style="display:grid;gap:12px">'+TYPE.map(function(t){return mk('token:type:'+t[0],'<div class="tyrow"><div><div class="tkn">'+t[0]+'</div><div class="tkv">'+t[1]+'</div></div><div style="font-family:'+t[2]+';font-weight:'+t[3]+';font-size:'+t[1]+';line-height:1.1;color:#1b1b19">'+esc(t[4])+'</div></div>');}).join('')+'</div>';
    return '<div id="ds-foundations" class="ds-mode">'+card('Color tokens',sem+wg)+card('Type scale',type,true)+card('Space · radius · grain · elevation · grid · motion','<p class="ds-note">Documented next — these live as inline values / magic numbers on the site today and get promoted to tokens as we wire them.</p>',true)+'</div>';
  }
  function componentsShell(){return '<div id="ds-components" class="ds-mode" hidden><p class="ds-note" style="margin:0 0 14px">Real components harvested from the live site (homepage DOM + hidden iframes), themed by the world picker. This IS the live output.</p><div id="ds-comp-body"><p class="ds-note">Harvesting live components…</p></div></div>';}
  function renderComponents(h){
    var groups={};REG.forEach(function(r){(groups[r.grp]=groups[r.grp]||[]).push(r);});
    var html='';
    Object.keys(groups).forEach(function(g){
      var wired=groups[g].filter(function(r){return h[r.id];}).length;
      html+='<h2 class="ds-h2">'+g+' <span class="ds-count">'+wired+'/'+groups[g].length+' live</span></h2><div class="cgrid">';
      groups[g].forEach(function(r){
        var node=h[r.id];
        var body=node?'<div class="ds-stage" data-harvested="1"></div>':'<div class="ds-stage" style="display:flex;align-items:center;justify-content:center;min-height:90px;color:var(--world-ink-soft)"><span style="font:700 11px/1 var(--ds-mono);text-transform:uppercase;letter-spacing:.08em;opacity:.7">not found on live — to wire</span></div>';
        html+='<div class="markable ctile" data-ds-id="comp:'+r.id+'"><div class="clabel">'+esc(r.label)+' <a class="ds-viewlive" href="'+LIVE[r.src]+'" target="_blank" rel="noopener">View live →</a></div>'+body+'</div>';
      });
      html+='</div>';
    });
    var wrap=document.getElementById('ds-comp-body');wrap.innerHTML=html;
    // inject the real cloned nodes into their stages
    var stages=wrap.querySelectorAll('.ds-stage[data-harvested]');var i=0;
    REG.forEach(function(r){if(h[r.id]){var st=stages[i++];if(st)st.appendChild(h[r.id]);}});
  }
  function coverage(h){
    var rows=REG.map(function(r){var live=!!h[r.id];return '<div class="invtile"><span class="dot" style="'+(live?'background:#2a9d4f':'background:#d98a2b')+'"></span>'+esc(r.label)+' <span style="font:400 10px/1 var(--ds-mono);opacity:.6;margin-left:6px">'+esc(r.sel)+'</span><span class="stub">'+(live?'wired · live':'to wire')+'</span></div>';}).join('');
    var wired=REG.filter(function(r){return h[r.id];}).length;
    return '<div id="ds-coverage" class="ds-mode" hidden><p class="ds-note" style="margin:0 0 16px"><b>'+wired+' of '+REG.length+'</b> registered components are wired to a live instance. Green = harvested from live. Amber = registered but not found (either not on the sampled views yet, or dead). <b>Defined-but-never-used</b> (dead CSS) detection is the next scanner — it compares every component class in the CSS against what actually renders.</p><section class="ds-card"><h2 class="ds-h2">Coverage</h2><div style="display:grid;gap:8px">'+rows+'</div></section></div>';
  }

  // ---- build DOM ----
  var root=document.createElement('div');root.id='ds-root';
  root.innerHTML='<div class="ds-bar"><span><b>Design system</b></span>'
    +'<div class="ds-seg" id="ds-mode"><button data-m="ds-foundations" aria-pressed="true">Foundations</button><button data-m="ds-components">Components</button><button data-m="ds-coverage">Coverage</button></div>'
    +'<span><b>World</b></span><select id="ds-world">'+WORLDS.map(function(w){return '<option'+(w===CUR?' selected':'')+'>'+w+'</option>';}).join('')+'</select>'
    +'<span style="font:400 12px/1.4 var(--ds-sans);opacity:.7">Live catalog (?ds). Hover a tile → MARK. Each tile has View live.</span></div>'
    +'<div class="ds-wrap">'+foundations()+componentsShell()+coverage({})+'</div>'
    +'<button class="ds-fab" id="ds-fab">Notes 0</button>'
    +'<div class="ds-panel" id="ds-panel"><h3>Notes &amp; punch list</h3><div class="ds-list" id="ds-notelist"></div><div class="foot"><button class="ds-btn pri" id="ds-copy">Copy punch list</button><button class="ds-btn" id="ds-clear">Clear</button><button class="ds-btn" id="ds-close">Close</button></div></div>'
    +'<div class="ds-editor" id="ds-editor"><div style="font:700 10px/1.3 var(--ds-mono);color:#6d4bd8;margin-bottom:6px" id="ds-edid"></div><textarea id="ds-edtext" placeholder="What to improve here..."></textarea><div class="flags" id="ds-edflags"><button data-fl="improve" aria-pressed="true">Improve</button><button data-fl="bug">Bug</button><button data-fl="idea">Idea</button></div><div style="display:flex;gap:8px"><button class="ds-btn pri" id="ds-edsave" style="flex:1">Save</button><button class="ds-btn" id="ds-eddel">Delete</button></div></div>';
  document.body.appendChild(root);
  document.body.classList.add('ds-active','work-focus-open');
  document.body.setAttribute('data-world',CUR);
  document.title='Design system · Chris Lam';
  // deep-linkable tab: ?ds=components / ?ds=coverage / ?ds=foundations
  var MODES={foundations:'ds-foundations',components:'ds-components',coverage:'ds-coverage'};
  var initMode=MODES[((location.search.match(/[?&]ds=([a-z]+)/)||[])[1])]||'ds-foundations';
  function setMode(m){root.querySelectorAll('#ds-mode button').forEach(function(b){b.setAttribute('aria-pressed',b.getAttribute('data-m')===m);});['ds-foundations','ds-components','ds-coverage'].forEach(function(id){var el=document.getElementById(id);if(el)el.hidden=(id!==m);});}
  setMode(initMode);

  // harvest then populate components + coverage
  harvest().then(function(h){
    renderComponents(h);
    var cov=coverage(h);var tmp=document.createElement('div');tmp.innerHTML=cov;var old=document.getElementById('ds-coverage');old.parentNode.replaceChild(tmp.firstChild,old);
    // keep coverage hidden unless active
    document.getElementById('ds-coverage').hidden = document.querySelector('#ds-mode button[aria-pressed="true"]').getAttribute('data-m')!=='ds-coverage';
    draw();
  });

  // ---- annotation ----
  var FLAGS={improve:'fl-improve',bug:'fl-bug',idea:'fl-idea'};var notes={};try{notes=JSON.parse(localStorage.getItem('ds-notes')||'{}');}catch(e){}
  var cur=null,curFlag='improve';
  function save(){try{localStorage.setItem('ds-notes',JSON.stringify(notes));}catch(e){}}
  function draw(){
    root.querySelectorAll('.markable').forEach(function(el){var id=el.getAttribute('data-ds-id');el.classList.toggle('has-note',!!notes[id]);var c=el.querySelector(':scope>.mchip');if(!c){c=document.createElement('span');c.className='mchip';el.appendChild(c);}c.textContent=notes[id]?'✓ note':'mark';});
    var ids=Object.keys(notes);root.querySelector('#ds-fab').textContent='Notes '+ids.length;
    root.querySelector('#ds-notelist').innerHTML=ids.length?ids.map(function(id){var n=notes[id];return '<div class="pn"><div class="pid">'+esc(id)+'</div><div class="ptxt"><span class="pfl '+FLAGS[n.flag]+'">'+n.flag+'</span>'+esc(n.text)+'</div><div class="pact"><button data-jump="'+esc(id)+'">Jump</button><button data-del="'+esc(id)+'">Delete</button></div></div>';}).join(''):'<p class="ds-note">No notes yet. Hover a tile, click MARK.</p>';
  }
  root.addEventListener('click',function(e){
    if(e.target.closest('.ds-viewlive'))return; // let the link navigate
    var chip=e.target.closest('.mchip');
    if(chip){var el=chip.closest('.markable');cur=el.getAttribute('data-ds-id');var n=notes[cur]||{};curFlag=n.flag||'improve';var ed=root.querySelector('#ds-editor');root.querySelector('#ds-edid').textContent=cur;root.querySelector('#ds-edtext').value=n.text||'';root.querySelectorAll('#ds-edflags button').forEach(function(b){b.setAttribute('aria-pressed',b.getAttribute('data-fl')===curFlag);});var r=chip.getBoundingClientRect();ed.style.left=Math.max(8,Math.min(r.left,innerWidth-320))+'px';ed.style.top=Math.min(r.bottom+8,innerHeight-240)+'px';ed.classList.add('open');root.querySelector('#ds-edtext').focus();e.stopPropagation();return;}
    if(!e.target.closest('#ds-editor'))root.querySelector('#ds-editor').classList.remove('open');
    var j=e.target.closest('[data-jump]');if(j){var t=root.querySelector('.markable[data-ds-id="'+CSS.escape(j.getAttribute('data-jump'))+'"]');if(t)t.scrollIntoView({behavior:'smooth',block:'center'});}
    var d=e.target.closest('[data-del]');if(d){delete notes[d.getAttribute('data-del')];save();draw();}
  });
  root.querySelectorAll('#ds-edflags button').forEach(function(b){b.addEventListener('click',function(){curFlag=b.getAttribute('data-fl');root.querySelectorAll('#ds-edflags button').forEach(function(x){x.setAttribute('aria-pressed',x===b);});});});
  root.querySelector('#ds-edsave').addEventListener('click',function(){var t=root.querySelector('#ds-edtext').value.trim();if(t)notes[cur]={text:t,flag:curFlag};else delete notes[cur];save();draw();root.querySelector('#ds-editor').classList.remove('open');});
  root.querySelector('#ds-eddel').addEventListener('click',function(){delete notes[cur];save();draw();root.querySelector('#ds-editor').classList.remove('open');});
  root.querySelector('#ds-fab').addEventListener('click',function(){root.querySelector('#ds-panel').classList.toggle('open');});
  root.querySelector('#ds-close').addEventListener('click',function(){root.querySelector('#ds-panel').classList.remove('open');});
  root.querySelector('#ds-clear').addEventListener('click',function(){if(confirm('Clear all notes?')){notes={};save();draw();}});
  root.querySelector('#ds-copy').addEventListener('click',function(){var md=Object.keys(notes).map(function(id){var n=notes[id];return '- ['+n.flag.toUpperCase()+'] '+id+' — '+n.text;}).join('\n');navigator.clipboard.writeText(md||'(no notes)').then(function(){var b=root.querySelector('#ds-copy');b.textContent='Copied!';setTimeout(function(){b.textContent='Copy punch list';},1200);});});
  root.querySelector('#ds-mode').addEventListener('click',function(e){var b=e.target.closest('button');if(!b)return;setMode(b.getAttribute('data-m'));});
  root.querySelector('#ds-world').addEventListener('change',function(e){CUR=e.target.value;document.body.setAttribute('data-world',CUR);});
  draw();
})();
