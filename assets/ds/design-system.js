/* Design-system catalog — runs only when the URL has ?ds. It hides the homepage, drives the
   site's own per-world state (so components render with the LIVE CSS), and adds the mark/note
   layer. v1: Foundations (read from live tokens) + diagram & product-map wired to live classes.
   Everything else is listed in Inventory and wired in iteratively. */
(function(){
  if(!/[?&]ds\b/.test(location.search)) return;
  var WORLDS=['goodrx','y30','clover','playsesh','pathstream','taskrabbit','sharecare','startplaying','modus','amazon','zodiacus'];
  var ROLE=[['--world-bg','Background'],['--world-ink','Text / ink'],['--world-accent','Accent / primary'],['--world-surface','Surface'],['--world-card-bg','Card']];
  var SEMANTIC=['--bg','--surface','--surface-2','--text','--muted','--border','--border-strong','--accent'];
  var TYPE=[['Display / Newsreader','40px',"'Newsreader',serif",'400','Chris Lam'],['Section / serif','28px',"'Newsreader',serif",'400','Controlled comparison'],['Card title / serif','21px',"'Newsreader',serif",'400','Admin console'],['Body / Figtree','15px',"'Figtree',sans-serif",'400','I design and code to ship products.'],['Label / sans','13px',"'Figtree',sans-serif",'700','Held constant'],['Kicker / Plex Mono','11px',"'IBM Plex Mono',monospace",'700','CONTROLLED INTERNAL BENCHMARK']];
  var INV={
    'Foundations':['Color: semantic tokens ✓','Color: 11 world palettes ✓','Base / blueprint theme (proposed)','Type scale','Space scale (4px)','Radius & hairline','Grain / blueprint base','Elevation','12-col grid','Motion: durations','Motion: easings','Interaction inventory'],
    'Templated components':['World band (homepage)','World hero (company/project)','Case-study split hero','Fact grid / spec panel','Product-map / supporting card ✓','Diagram card: flow ✓','Diagram card: loop','Case-study chapter','Case-study jump-to nav','Media vignette','More-work card','Experiment card','Blueprint placeholder','Dot-density placeholder','"Visuals coming soon" placeholder'],
    'One-off / chrome':['Header & nav','Credibility rail','Availability pill','Lightbox / media dialog','Buttons','Links','Read-progress bar','Footer','Testimonial','"What I am looking for"','"Let us work together" / contact'],
    'Compositions (page types)':['Company / World page','Project page','Case study page','Experiment / WIP page']
  };
  var CUR='y30';
  function esc(s){return String(s).replace(/[&<>"]/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c];});}
  function readWorld(w){var b=document.body,prev=b.getAttribute('data-world');b.setAttribute('data-world',w);var cs=getComputedStyle(b),o={};ROLE.forEach(function(r){o[r[0]]=cs.getPropertyValue(r[0]).trim();});if(prev)b.setAttribute('data-world',prev);else b.removeAttribute('data-world');return o;}

  // --- component markup using the SITE's own classes ---
  function diagram(){return '<div class="portfolio-diagram" data-diagram-type="flow" style="--diagram-columns:3">'
    +'<div class="portfolio-diagram-head"><span class="portfolio-diagram-eyebrow">Controlled internal benchmark</span>'
    +'<span class="portfolio-diagram-title">Controlled comparison: three LLMs on one STT/TTS pipeline</span></div>'
    +'<div class="portfolio-diagram-stage">'
    +'<div class="portfolio-diagram-item"><span class="portfolio-diagram-label">Speech recognition</span><span class="portfolio-diagram-meta">Held constant</span></div>'
    +'<div class="portfolio-diagram-item" data-diagram-tone="accent"><span class="portfolio-diagram-label">Three language models</span><span class="portfolio-diagram-meta">Similar speed and safety</span></div>'
    +'<div class="portfolio-diagram-item"><span class="portfolio-diagram-label">Speech generation</span><span class="portfolio-diagram-meta">Held constant</span></div>'
    +'</div><div class="portfolio-diagram-footer">Highest-cost model used ~20x more tokens, no speed advantage.</div></div>';}
  function productmap(){return '<ul class="work-also-shipped-list" style="list-style:none;margin:0;padding:0">'
    +'<li><b>Admin console</b><span>Provider health, latency, and cost per minute.</span><div class="work-supporting-delivery">Internal build</div></li>'
    +'<li><b>Provider switchboard</b><span>Independent STT, LLM, and TTS controls.</span><div class="work-supporting-delivery">Shipped</div></li>'
    +'<li><b>Safety layer</b><span>Deterministic crisis responses, never generated.</span><div class="work-supporting-delivery">Shipped</div></li></ul>';}

  function foundations(){
    var sem='<div class="ds-grid4">'+SEMANTIC.map(function(t){var v=getComputedStyle(document.documentElement).getPropertyValue(t).trim();return mk('token:color:'+t,'<div class="tk"><div class="tksw" style="background:'+esc(v)+'"></div><div class="tkm"><div class="tkn">'+esc(t)+'</div><div class="tkv">'+esc(v||'—')+'</div></div></div>');}).join('')+'</div>';
    var wg='<h3 class="ds-h3">World palettes (11) — each color by its ROLE, read from live tokens</h3><div class="ds-grid4">'+WORLDS.map(function(w){var o=readWorld(w);var rows=ROLE.map(function(r){return '<div class="pal-row"><i class="pal-chip" style="background:'+esc(o[r[0]]||'#888')+'"></i><span class="pal-role" style="color:'+esc(o['--world-ink'])+'">'+r[1]+'</span><span class="pal-tok" style="color:'+esc(o['--world-ink'])+'">'+r[0].replace('--world-','')+'</span></div>';}).join('');return mk('token:world:'+w,'<div class="pal" style="background:'+esc(o['--world-bg'])+'"><div class="pal-h"><span class="pal-name" style="color:'+esc(o['--world-ink'])+'">'+w+'</span></div>'+rows+'</div>');}).join('')+'</div>';
    var type='<div style="display:grid;gap:12px">'+TYPE.map(function(t){return mk('token:type:'+t[0],'<div class="tyrow"><div><div class="tkn">'+t[0]+'</div><div class="tkv">'+t[1]+'</div></div><div style="font-family:'+t[2]+';font-weight:'+t[3]+';font-size:'+t[1]+';line-height:1.1;color:#1b1b19">'+esc(t[4])+'</div></div>');}).join('')+'</div>';
    return '<div id="ds-foundations" class="ds-mode">'
      +card('Color tokens',sem+wg)
      +card('Type scale',type,true)
      +card('Space · radius · grain · elevation · grid · motion','<p class="ds-note">Documented next — these live as inline values / magic numbers on the site today and get promoted to tokens as we wire them.</p>',true)
      +'</div>';
  }
  function components(){
    var tiles=[['comp:diagram-flow','Diagram card · flow',diagram()],['comp:productmap','Product-map / supporting card',productmap()]];
    var grid='<div class="cgrid">'+tiles.map(function(t){return '<div class="markable ctile" data-ds-id="'+t[0]+'"><div class="clabel">'+t[1]+'</div><div class="ds-stage">'+t[2]+'</div></div>';}).join('')+'</div>';
    return '<div id="ds-components" class="ds-mode" hidden><p class="ds-note" style="margin:0 0 14px">Rendered with the site\'s OWN classes and themed by the world picker — this is the live CSS. Note the diagram shows the real #28 contrast bug (unfixed on live); the product-map shows its shipped fix. That contrast is the catalog doing its job.</p><h2 class="ds-h2">Wired to live <span class="ds-count">2</span></h2>'+grid+'</div>';
  }
  function inventory(){
    var out='<div id="ds-inventory" class="ds-mode" hidden><p class="ds-note" style="margin:0 0 16px">Full coverage map. ✓ = already wired to live classes. The rest get wired iteratively; the permanent catalog will fail a check if a live component class is missing here.</p>';
    Object.keys(INV).forEach(function(g){out+='<section class="ds-card"><h2 class="ds-h2">'+g+' <span class="ds-count">'+INV[g].length+'</span></h2><div class="ds-grid3">'+INV[g].map(function(it){var done=/✓/.test(it);return mk('inv:'+it,'<div class="invtile"><span class="dot" style="'+(done?'background:#2a9d4f':'')+'"></span>'+esc(it.replace(' ✓',''))+'<span class="stub">'+(done?'live':'to wire')+'</span></div>');}).join('')+'</div></section>';});
    return out+'</div>';
  }
  function card(t,body,proposed){return '<section class="ds-card"><h2 class="ds-h2">'+t+(proposed?' <span class="ds-ptag">proposed · pull from live</span>':'')+'</h2>'+body+'</section>';}
  function mk(id,inner){return '<div class="markable" data-ds-id="'+esc(id)+'">'+inner+'</div>';}

  // --- build DOM ---
  var root=document.createElement('div');root.id='ds-root';
  root.innerHTML='<div class="ds-bar"><span><b>Design system</b></span>'
    +'<div class="ds-seg" id="ds-mode"><button data-m="ds-foundations" aria-pressed="true">Foundations</button><button data-m="ds-components">Components</button><button data-m="ds-inventory">Inventory</button></div>'
    +'<span><b>World</b></span><select id="ds-world">'+WORLDS.map(function(w){return '<option'+(w===CUR?' selected':'')+'>'+w+'</option>';}).join('')+'</select>'
    +'<span style="font:400 12px/1.4 var(--ds-sans);opacity:.7">Live catalog (?ds). Hover a tile → MARK to note.</span></div>'
    +'<div class="ds-wrap">'+foundations()+components()+inventory()+'</div>'
    +'<button class="ds-fab" id="ds-fab">Notes 0</button>'
    +'<div class="ds-panel" id="ds-panel"><h3>Notes &amp; punch list</h3><div class="ds-list" id="ds-notelist"></div><div class="foot"><button class="ds-btn pri" id="ds-copy">Copy punch list</button><button class="ds-btn" id="ds-clear">Clear</button><button class="ds-btn" id="ds-close">Close</button></div></div>'
    +'<div class="ds-editor" id="ds-editor"><div style="font:700 10px/1.3 var(--ds-mono);color:#6d4bd8;margin-bottom:6px" id="ds-edid"></div><textarea id="ds-edtext" placeholder="What to improve here..."></textarea><div class="flags" id="ds-edflags"><button data-fl="improve" aria-pressed="true">Improve</button><button data-fl="bug">Bug</button><button data-fl="idea">Idea</button></div><div style="display:flex;gap:8px"><button class="ds-btn pri" id="ds-edsave" style="flex:1">Save</button><button class="ds-btn" id="ds-eddel">Delete</button></div></div>';
  document.body.appendChild(root);
  document.body.classList.add('ds-active','work-focus-open');
  document.body.setAttribute('data-world',CUR);
  document.title='Design system · Chris Lam';

  // --- annotation ---
  var FLAGS={improve:'fl-improve',bug:'fl-bug',idea:'fl-idea'};var notes={};try{notes=JSON.parse(localStorage.getItem('ds-notes')||'{}');}catch(e){}
  var cur=null,curFlag='improve';
  function save(){try{localStorage.setItem('ds-notes',JSON.stringify(notes));}catch(e){}}
  function draw(){
    root.querySelectorAll('.markable').forEach(function(el){var id=el.getAttribute('data-ds-id');el.classList.toggle('has-note',!!notes[id]);var c=el.querySelector(':scope>.mchip');if(!c){c=document.createElement('span');c.className='mchip';el.appendChild(c);}c.textContent=notes[id]?'✓ note':'mark';});
    var ids=Object.keys(notes);root.querySelector('#ds-fab').textContent='Notes '+ids.length;
    root.querySelector('#ds-notelist').innerHTML=ids.length?ids.map(function(id){var n=notes[id];return '<div class="pn"><div class="pid">'+esc(id)+'</div><div class="ptxt"><span class="pfl '+FLAGS[n.flag]+'">'+n.flag+'</span>'+esc(n.text)+'</div><div class="pact"><button data-jump="'+esc(id)+'">Jump</button><button data-del="'+esc(id)+'">Delete</button></div></div>';}).join(''):'<p class="ds-note">No notes yet. Hover a tile, click MARK.</p>';
  }
  root.addEventListener('click',function(e){
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
  root.querySelector('#ds-mode').addEventListener('click',function(e){var b=e.target.closest('button');if(!b)return;[].forEach.call(e.currentTarget.children,function(x){x.setAttribute('aria-pressed',x===b);});['ds-foundations','ds-components','ds-inventory'].forEach(function(m){root.querySelector('#'+m).hidden=(m!==b.getAttribute('data-m'));});});
  root.querySelector('#ds-world').addEventListener('change',function(e){CUR=e.target.value;document.body.setAttribute('data-world',CUR);});
  draw();
})();
