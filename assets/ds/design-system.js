/* Design-system catalog — runs only on ?ds. Renders the REAL live components by harvesting
   them from the running site (homepage DOM + hidden iframes of the company/case-study views),
   so the catalog is a true mirror, not a reconstruction. Foundations read live tokens. Adds the
   mark/note layer, per-tile "View live", and a Coverage view (wired vs to-wire). */
(function(){
  if(!/[?&]ds\b/.test(location.search)) return;
  var WORLDS=['this_site','goodrx','y30','clover','playsesh','pathstream','taskrabbit','sharecare','startplaying','modus','amazon','zodiacus'];
  var ROLE=[['--world-bg','Background'],['--world-ink','Text / ink'],['--world-accent','Accent / primary'],['--world-surface','Surface'],['--world-card-bg','Card']];
  // harvest sources: company view + a rich case study. A source may be an ordered list of views:
  // the first is loaded eagerly; the next is loaded only if the component is not found there, so a
  // tile survives one world changing (e.g. a placeholder replaced by a real hero image).
  var SRC={thissite:'index.html?work=this_site',company:['index.html?work=y30','index.html?work=goodrx'],casestudy:'index.html?work=y30&project=spoken-voice-system',nocards:'index.html?work=hogware',quotes:['index.html?work=goodrx','index.html?work=taskrabbit','index.html?work=amazon'],placeholder:['index.html?work=pathstream','index.html?work=taskrabbit','index.html?work=clover']};
  // component registry: id, label, live selector, source ('home' = clone from homepage DOM, else SRC key), group
  var REG=[
    {id:'co-band',label:'World band (homepage)',sel:'.co-band',src:'home',grp:'Templated'},
    {id:'world-hero',label:'Title band (world layer, tame)',sel:'.world-hero',src:'company',grp:'Templated'},
    {id:'work-fact-band',label:'Facts row (pages without cards)',sel:'.work-fact-band',src:'nocards',grp:'Templated'},
    {id:'work-outcome-statement',label:'Outcome statement (pages without cards)',sel:'.work-outcome-statement',src:'nocards',grp:'Templated'},
    {id:'work-links',label:'Links to live work (title band; ↗ leaves the site)',sel:'.work-links',src:'company',grp:'Templated'},
    {id:'work-story-facts',label:'Case study facts + outcome (in the title band)',sel:'.work-story-facts',src:'casestudy',grp:'Templated'},
    {id:'work-story-hero',label:'Case study hero (16:9 frame in the title band)',sel:'.work-story-hero',src:'casestudy',grp:'Templated'},
    {id:'work-credits',label:'Credits (people and code boundaries, end of page)',sel:'.work-credits',src:'company',grp:'Templated'},
    {id:'work-changelog',label:'Recent changes (living log, from changelog.json)',sel:'.work-changelog',src:'thissite',grp:'Templated'},
    {id:'work-panel-facts',label:'Fact grid / spec panel',sel:'.work-panel-facts',src:'company',grp:'Templated',wrap:'work-panel is-company-view',wrapId:'work-panel'},
    {id:'work-support',label:'Also shipped (unified schedule)',sel:'.work-support-row',src:'company',grp:'Templated'},
    {id:'work-project-card',label:'Project card (one component: company pages + Recent work)',sel:'.work-project-card',src:'company',grp:'Templated'},
    {id:'portfolio-diagram',label:'Diagram card',sel:'.portfolio-diagram',src:'casestudy',grp:'Templated'},
    {id:'project-chapter',label:'Case-study chapter',sel:'.project-chapter',src:'casestudy',grp:'Templated'},
    {id:'story-artifact',label:'Case-study image (artifact)',sel:'.story-artifact',src:'casestudy',grp:'Templated'},
    {id:'project-story',label:'Case-study page (whole story)',sel:'.project-story',src:'casestudy',grp:'Templated'},
    {id:'story-end',label:'Case-study end row (next case study + contact)',sel:'.story-end',src:'casestudy',grp:'Templated'},
    {id:'work-project-grid',label:'Project card grid (3 / 2 / 1 per row)',sel:'.work-project-grid',src:'company',grp:'Templated'},
    {id:'project-story-nav',label:'Case-study jump-to nav',sel:'.project-story-nav',src:'casestudy',grp:'Templated'},
    {id:'work-company-quotes',label:'World recommendations (verbatim quotes)',sel:'.work-company-quotes',src:'quotes',grp:'Templated'},
    {id:'visual-placeholder',label:'Visual placeholder ("coming soon")',sel:'.visual-placeholder',src:'placeholder',grp:'Templated'},
    {id:'hero',label:'Homepage hero',sel:'.hero',src:'home',grp:'Chrome'},
    {id:'recent-work',label:'Recent work (homepage front door)',sel:'.recent-work',src:'home',grp:'Chrome'},
    {id:'scroll-cue',label:'Scroll cue',sel:'.scroll-cue',src:'home',grp:'Chrome'},
    {id:'hero-credibility',label:'Credibility rail',sel:'.hero-credibility',src:'home',grp:'Chrome'},
    {id:'status-pill',label:'Availability pill (header)',sel:'.status-pill',src:'home',grp:'Chrome'},
    {id:'wcard',label:'More-work card',sel:'.work-tile.wcard',src:'home',grp:'Chrome'},
    {id:'refs',label:'Contact: reach me / ask first / references',sel:'.refs',src:'home',grp:'Chrome'},
    {id:'foot',label:'Footer',sel:'.foot',src:'home',grp:'Chrome'},
    {id:'read-progress',label:'Read-progress bar',sel:'.read-progress',src:'home',grp:'Chrome'}
  ];
  var DEV=/[?&]dev\b/.test(location.search); // public by default (Chris 2026-09-24); ?ds&dev = the working tools
  var FROM={}; // component id -> the view it was actually harvested from (for "View live")
  var CUR='y30';
  var _wq=(location.search.match(/[?&]w=([a-z0-9]+)/)||[])[1]; // ?w=<world> deep-links the picker
  var HDOCS=[document]; // every live document we can scan for the audit (homepage + harvested views)
  function esc(s){return String(s).replace(/[&<>"]/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c];});}
  function readWorld(w){var b=document.body,prev=b.getAttribute('data-world');b.setAttribute('data-world',w);var cs=getComputedStyle(b),o={};ROLE.forEach(function(r){o[r[0]]=cs.getPropertyValue(r[0]).trim();});if(prev)b.setAttribute('data-world',prev);else b.removeAttribute('data-world');return o;}
  function mk(id,inner){return '<div class="markable" data-ds-id="'+esc(id)+'">'+inner+'</div>';}
  function card(t,body,proposed){return '<section class="ds-card"><h2 class="ds-h2">'+t+(proposed?' <span class="ds-ptag">proposed · pull from live</span>':'')+'</h2>'+body+'</section>';}

  // ---- harvesting ----
  function cloneFrom(doc,sel){try{var el=doc.querySelector(sel);return el?el.cloneNode(true):null;}catch(e){return null;}}
  // cloned nodes keep the site's scroll-reveal state (start invisible) and lazy images
  // (never loaded off-viewport) -> tiles look empty. Force the revealed/loaded state.
  function reveal(node){
    if(!node) return node;
    var all=[node].concat([].slice.call(node.querySelectorAll('*')));
    all.forEach(function(el){
      if(el.style){el.style.opacity='1';el.style.visibility='visible';if(el.style.filter&&el.style.filter!=='none')el.style.filter='none';if(/translate|scale/.test(el.style.transform||''))el.style.transform='none';}
      el.removeAttribute('inert');el.removeAttribute('hidden');
      el.classList&&el.classList.remove('is-hidden','reveal','anim-2');
      if(el.tagName==='IMG'){el.loading='eager';var ds=el.getAttribute('data-src');if(ds&&!el.getAttribute('src'))el.setAttribute('src',ds);}
    });
    return node;
  }
  function loadFrame(url){return new Promise(function(res){var f=document.createElement('iframe');f.setAttribute('aria-hidden','true');f.style.cssText='position:fixed;left:-10000px;top:0;width:1200px;height:2400px;border:0';f.src=url;var done=false;function go(){if(done)return;done=true;setTimeout(function(){res(f.contentDocument);},1600);}f.addEventListener('load',go);document.body.appendChild(f);setTimeout(go,6000);});}
  function harvest(){
    var out={};
    REG.filter(function(r){return r.src==='home';}).forEach(function(r){out[r.id]=cloneFrom(document,r.sel);});
    var docs={}; // url -> Promise<document>, so each view loads once however many entries use it
    function view(u){return docs[u]||(docs[u]=loadFrame(u).then(function(d){if(d)HDOCS.push(d);return d;}));}
    function pick(urls,sel,i){if(i>=urls.length)return Promise.resolve(null);return view(urls[i]).then(function(d){var n=d&&cloneFrom(d,sel);return n?{node:n,url:urls[i]}:pick(urls,sel,i+1);});}
    return Promise.all(REG.filter(function(r){return r.src!=='home';}).map(function(r){
      return pick([].concat(SRC[r.src]),r.sel,0).then(function(m){out[r.id]=m?m.node:null;if(m)FROM[r.id]=m.url;});
    })).then(function(){return out;});
  }

  // ---- views ----
  // Every custom property declared on :root (any theme), read from the live stylesheets: a new token shows up
  // here on the next load with nothing to maintain. Grouped by family prefix; anything unmatched is listed, not hidden.
  function liveTokens(){
    var names={};
    function walk(rules){ if(!rules) return; for(var i=0;i<rules.length;i++){ var r=rules[i];
      if(r.cssRules&&!r.selectorText) walk(r.cssRules);
      if(r.selectorText&&/^:root\b/.test(r.selectorText.trim())&&!/data-world/.test(r.selectorText)){ for(var j=0;j<r.style.length;j++){ var n=r.style[j]; if(n.indexOf('--')===0) names[n]=1; } } } }
    for(var i=0;i<document.styleSheets.length;i++){ var sh=document.styleSheets[i]; if(sh.href&&/assets\/ds\//.test(sh.href)) continue; try{ walk(sh.cssRules); }catch(e){} }
    var cs=getComputedStyle(document.documentElement), out={};
    Object.keys(names).sort().forEach(function(n){ out[n]=cs.getPropertyValue(n).trim(); });
    return out;
  }
  var FAM=[['Type','^--t-'],['Space','^--(s|sp)-'],['Motion','^--(dur|ease)-|^--(transition|enter)$'],['Brand bands (homepage)','^--band-'],
    ['Color','^--(bg|surface|surface-2|surface-hover|text|muted|border|border-strong|border-soft|accent|accent-soft|accent-strong|on-accent|chip-bg|grid|grid-maj)$']];
  function famOf(n){ for(var i=0;i<FAM.length;i++){ if(new RegExp(FAM[i][1]).test(n)) return FAM[i][0]; } return 'Ungrouped'; }
  var SANS_T={'--t-xs':1,'--t-sm':1,'--t-base':1,'--t-md':1,'--t-lg':1};
  function changesCard(){ return card('Recent system changes','<div id="ds-changes"><p class="ds-note">Loading…</p></div>'); }
  function loadChanges(){ fetch('assets/ds/changelog.json',{cache:'no-store'}).then(function(r){return r.json();}).then(function(list){
      var el=document.getElementById('ds-changes'); if(!el) return;
      el.innerHTML='<div style="display:grid;gap:10px">'+list.slice(0,12).map(function(c){ return '<div class="tyrow"><div><div class="tkn">'+esc(c.date)+'</div><div class="tkv">'+esc(c.area)+'</div></div><div><div style="font:400 15px/1.45 var(--ds-sans)">'+esc(c.change)+'</div>'+(c.commit?'<code class="auc">'+esc(c.commit)+'</code>':'')+'</div></div>'; }).join('')+'</div>';
    }).catch(function(){ var el=document.getElementById('ds-changes'); if(el) el.innerHTML='<p class="ds-note">changelog.json missing or unreadable.</p>'; }); }
  function foundations(){
    var T=liveTokens(), fams={}; Object.keys(T).forEach(function(n){ (fams[famOf(n)]=fams[famOf(n)]||[]).push(n); });
    // order scales by size, not alphabet (clamp() sorts by its largest px value)
    function px(v){ var m=String(v).match(/([\d.]+)(px|ms|rem|s)\b/g); if(!m) return 1e9; var last=m[m.length-1]; var n=parseFloat(last); return /rem/.test(last)?n*16:(/ms/.test(last)?n:(/s$/.test(last)?n*1000:n)); }
    ['Type','Space','Motion'].forEach(function(f){ if(fams[f]) fams[f].sort(function(a,b){ return px(T[a])-px(T[b]); }); });
    var html='';
    // color: semantic tokens as swatches
    html+=card('Color tokens · '+((fams.Color||[]).length)+' live','<div class="ds-grid4">'+(fams.Color||[]).map(function(t){ return mk('token:color:'+t,'<div class="tk"><div class="tksw" style="background:var('+t+')"></div><div class="tkn">'+esc(t)+'</div><div class="tkv">'+esc(T[t])+'</div></div>'); }).join('')+'</div>');
    // world layer (tame): brand band + per-theme accent, read live per world
    var probe=document.createElement('div'); probe.className='work-shell'; probe.style.display='none'; document.body.appendChild(probe);
    var wl='<div class="ds-grid4">'+WORLDS.map(function(w){ var prev=document.body.getAttribute('data-world'); document.body.setAttribute('data-world',w);
        var b=getComputedStyle(document.body), p=getComputedStyle(probe);
        var bg=b.getPropertyValue('--brand-bg').trim(), ink=b.getPropertyValue('--brand-ink').trim(), al=p.getPropertyValue('--brand-accent-light').trim(), ad=p.getPropertyValue('--brand-accent-dark').trim();
        if(prev) document.body.setAttribute('data-world',prev); else document.body.removeAttribute('data-world');
        return mk('token:world:'+w,'<div class="tk"><div style="background:'+bg+';color:'+ink+';padding:14px 12px;font:400 20px/1 var(--ds-serif)">'+esc(w)+'</div><div class="tkv" style="margin-top:6px">band '+esc(bg)+'</div><div class="tkv">accent <span style="display:inline-block;width:10px;height:10px;background:'+al+';vertical-align:middle"></span> light '+esc(al)+' · <span style="display:inline-block;width:10px;height:10px;background:'+ad+';vertical-align:middle"></span> dark '+esc(ad)+'</div></div>'); }).join('')+'</div>';
    probe.remove();
    html+=card('World layer (tame): brand band + per-theme accent',wl);
    // type: every --t-* token, sampled in the family its role uses
    html+=card('Type scale · '+((fams.Type||[]).length)+' tokens (floor 14px; check-design-system fails raw px)','<div style="display:grid;gap:12px;container-type:inline-size">'+(fams.Type||[]).map(function(t){ var fam=SANS_T[t]?'var(--sans)':'var(--serif)';
      return mk('token:type:'+t,'<div class="tyrow"><div><div class="tkn">'+esc(t)+'</div><div class="tkv">'+esc(T[t])+'</div></div><div style="font:400 var('+t+')/1.1 '+fam+';white-space:nowrap;overflow:hidden;text-overflow:ellipsis">'+(SANS_T[t]?'Figtree · I design and code to ship products':'Newsreader · Controlled comparison')+'</div></div>'); }).join('')+'</div>');
    // space: bars
    html+=card('Space · '+((fams.Space||[]).length)+' tokens','<div style="display:grid;gap:8px">'+(fams.Space||[]).map(function(t){ return mk('token:space:'+t,'<div class="tyrow"><div><div class="tkn">'+esc(t)+'</div><div class="tkv">'+esc(T[t])+'</div></div><div><div style="height:12px;width:var('+t+');background:var(--accent)"></div></div></div>'); }).join('')+'</div>');
    // motion: tokens with a play demo (hover a row)
    html+=card('Motion · '+((fams.Motion||[]).length)+' tokens (hover a row to play)','<div style="display:grid;gap:8px">'+(fams.Motion||[]).map(function(t){ var isEase=/ease/.test(t);
      var tr=isEase?'transform 700ms var('+t+')':(/dur/.test(t)?'transform var('+t+') var(--ease-out,ease)':'transform 700ms ease');
      if(t==='--transition'||t==='--enter') tr='transform var('+t+')';
      return mk('token:motion:'+t,'<div class="tyrow ds-motion"><div><div class="tkn">'+esc(t)+'</div><div class="tkv">'+esc(T[t])+'</div></div><div style="position:relative;height:16px;background:var(--surface-2)"><span style="position:absolute;left:0;top:0;width:16px;height:16px;background:var(--accent);transition:'+tr+'"></span></div></div>'); }).join('')+'</div>');
    // rules that are not tokens
    html+=card('Rules','<div class="ds-note" style="display:grid;gap:6px"><div><b>Radius:</b> 0 everywhere, circles included (hard edges).</div><div><b>Typefaces:</b> Newsreader (display) + Figtree (text), weights 400 / 600.</div><div><b>Hover:</b> one language per component type; tilt and pan only with a fine pointer; focus gets the glow + a 2px outline.</div><div><b>Reduced motion:</b> keeps fades and glows; drops rise, tilt, pan.</div></div>');
    if(fams['Brand bands (homepage)']) html+=card('Brand bands (homepage) · '+fams['Brand bands (homepage)'].length,'<div class="ds-grid4">'+fams['Brand bands (homepage)'].map(function(t){ return mk('token:band:'+t,'<div class="tk"><div class="tksw" style="background:var('+t+')"></div><div class="tkn">'+esc(t)+'</div><div class="tkv">'+esc(T[t])+'</div></div>'); }).join('')+'</div>');
    if(fams.Ungrouped) html+=card('Ungrouped tokens · '+fams.Ungrouped.length+' (no family prefix yet)','<div style="display:flex;flex-wrap:wrap;gap:6px">'+fams.Ungrouped.map(function(t){ return '<code class="auc" title="'+esc(T[t])+'">'+esc(t)+'</code>'; }).join('')+'</div>');
    return '<div id="ds-foundations" class="ds-mode">'+changesCard()+html+'</div>';
  }
  function componentsShell(){return '<div id="ds-components" class="ds-mode" hidden><p class="ds-note" style="margin:0 0 12px">Real components harvested from the live site, themed by the world picker. This IS the live output.</p>'
    +'<div class="qa-bar"><b>QA variants</b>'
    +'<span>Blueprint</span><div class="ds-seg qa" data-qa="bp"><button data-v="" aria-pressed="true">Current</button><button data-v="dots">Dots</button><button data-v="lines">Lines</button><button data-v="hybrid">Dotted grid</button></div>'
    +'</div>'
    +'<div id="ds-comp-body"><p class="ds-note">Harvesting live components…</p></div></div>';}
  function renderComponents(h){
    var groups={};REG.forEach(function(r){(groups[r.grp]=groups[r.grp]||[]).push(r);});
    var html='';
    Object.keys(groups).forEach(function(g){
      var wired=groups[g].filter(function(r){return h[r.id];}).length;
      html+='<h2 class="ds-h2">'+g+' <span class="ds-count">'+wired+'/'+groups[g].length+' live</span></h2><div class="cgrid">';
      groups[g].forEach(function(r){
        var node=h[r.id];
        var sc=(r.grp==='Chrome')?'ds-stage-c':'ds-stage';
        var body=node?'<div class="'+sc+'" data-harvested="1"></div>':'<div class="'+sc+'" style="display:flex;align-items:center;justify-content:center;min-height:90px"><span style="font:700 11px/1 var(--ds-mono);text-transform:uppercase;letter-spacing:.08em;opacity:.55;color:inherit">not found on live — to wire</span></div>';
        html+='<div class="markable ctile" data-ds-id="comp:'+r.id+'"><div class="clabel">'+esc(r.label)+' <a class="ds-viewlive" href="'+(FROM[r.id]||(r.src==='home'?'index.html':[].concat(SRC[r.src])[0]))+'" target="_blank" rel="noopener">View live →</a></div>'+body+'</div>';
      });
      html+='</div>';
    });
    var wrap=document.getElementById('ds-comp-body');wrap.innerHTML=html;
    // inject the real cloned nodes into their stages
    var stages=wrap.querySelectorAll('[data-harvested]');var i=0;
    REG.forEach(function(r){if(h[r.id]){var st=stages[i++];if(st){var node=reveal(h[r.id]);if(r.wrap){var wp=document.createElement('div');wp.className=r.wrap;if(r.wrapId)wp.id=r.wrapId;wp.appendChild(node);st.appendChild(wp);}else{st.appendChild(node);}}}});
  }
  function coverage(h){
    var rows=REG.map(function(r){var live=!!h[r.id];return '<div class="invtile"><span class="dot" style="'+(live?'background:#2a9d4f':'background:#d98a2b')+'"></span>'+esc(r.label)+' <span style="font:400 10px/1 var(--ds-mono);opacity:.6;margin-left:6px">'+esc(r.sel)+'</span><span class="stub">'+(live?'wired · live':'to wire')+'</span></div>';}).join('');
    var wired=REG.filter(function(r){return h[r.id];}).length;
    return '<div id="ds-coverage" class="ds-mode" hidden><p class="ds-note" style="margin:0 0 16px"><b>'+wired+' of '+REG.length+'</b> registered components are wired to a live instance. Green = harvested from live. Amber = registered but not found (either not on the sampled views yet, or dead). <b>Defined-but-never-used</b> (dead CSS) detection is the next scanner — it compares every component class in the CSS against what actually renders.</p><section class="ds-card"><h2 class="ds-h2">Coverage</h2><div style="display:grid;gap:8px">'+rows+'</div></section></div>';
  }

  // ---- audit: reconcile styled (CSS) vs rendered (DOM) vs cataloged (registry), live every load ----
  function dsSheetClasses(){var set={};for(var i=0;i<document.styleSheets.length;i++){var s=document.styleSheets[i];if(!(s.href&&/assets\/ds\//.test(s.href)))continue;try{[].forEach.call(s.cssRules,function(r){if(r.selectorText)(r.selectorText.match(/\.[A-Za-z_][\w-]*/g)||[]).forEach(function(c){set[c.slice(1)]=1;});});}catch(e){}}return set;}
  function definedClasses(ex){var set={};function walk(rules){if(!rules)return;for(var i=0;i<rules.length;i++){var r=rules[i];if(r.selectorText)(r.selectorText.match(/\.[A-Za-z_][\w-]*/g)||[]).forEach(function(c){var n=c.slice(1);if(!ex[n])set[n]=1;});if(r.cssRules)walk(r.cssRules);}}for(var i=0;i<document.styleSheets.length;i++){var s=document.styleSheets[i];if(s.href&&/assets\/ds\//.test(s.href))continue;try{walk(s.cssRules);}catch(e){}}return set;}
  function usedClasses(ex){var set={};HDOCS.forEach(function(d){if(!d)return;try{[].forEach.call(d.querySelectorAll('[class]'),function(el){var cn=(el.getAttribute&&el.getAttribute('class'))||'';cn.split(/\s+/).forEach(function(c){if(c&&!ex[c])set[c]=1;});});}catch(e){}});return set;}
  function catalogedClasses(){var set={};REG.forEach(function(r){(r.sel.match(/\.[A-Za-z_][\w-]*/g)||[]).forEach(function(c){set[c.slice(1)]=1;});});return set;}
  function renderAudit(){
    var el=document.getElementById('ds-audit');if(!el)return;
    var dsx=dsSheetClasses(),def=definedClasses(dsx),used=usedClasses(dsx),cat=catalogedClasses();
    var defArr=Object.keys(def).sort(),usedArr=Object.keys(used).sort();
    var usedNotCat=usedArr.filter(function(c){return def[c]&&!cat[c];});
    var deadCss=defArr.filter(function(c){return !used[c];});
    function list(a){return a.length?'<div style="display:flex;flex-wrap:wrap;gap:6px">'+a.map(function(c){return '<code class="auc">'+esc(c)+'</code>';}).join('')+'</div>':'<p class="ds-note" style="margin:0">None.</p>';}
    el.querySelector('#ds-audit-body').innerHTML=
      '<div class="ds-grid3" style="margin:0 0 16px"><div class="auk"><b>'+defArr.length+'</b><span>styled classes (CSS)</span></div><div class="auk"><b>'+usedArr.length+'</b><span>rendered on sampled views</span></div><div class="auk"><b>'+Object.keys(cat).length+'</b><span>cataloged selectors</span></div></div>'
      +'<section class="ds-card"><h2 class="ds-h2">Rendered + styled, not cataloged <span class="ds-count">'+usedNotCat.length+'</span></h2><p class="ds-note" style="margin:0 0 10px">Candidates to add to the registry (some are sub-parts of components already cataloged).</p>'+list(usedNotCat)+'</section>'
      +'<section class="ds-card"><h2 class="ds-h2">Styled but not rendered <span class="ds-count">'+deadCss.length+'</span></h2><p class="ds-note" style="margin:0 0 10px">Dead-CSS candidates — defined but never appeared on the homepage or the sampled company/case-study. Review before deleting; some only render on other worlds/states.</p>'+list(deadCss)+'</section>';
  }

  // ---- build DOM ----
  var root=document.createElement('div');root.id='ds-root';
  root.innerHTML='<div class="ds-bar"><span><b>Design system</b></span>'
    +'<div class="ds-seg" id="ds-mode"><button data-m="ds-foundations" aria-pressed="true">Foundations</button><button data-m="ds-components">Components</button><button data-m="ds-coverage">Coverage</button><button data-m="ds-audit">Audit</button></div>'
    +'<span><b>World</b></span><select id="ds-world">'+WORLDS.map(function(w){return '<option'+(w===CUR?' selected':'')+'>'+w+'</option>';}).join('')+'</select>'
    +'<span style="font:400 12px/1.4 var(--ds-sans);opacity:.7">'+(DEV?'Live catalog (?ds&dev). Hover a tile → MARK. Each tile has View live.':'The system behind this site, read live from its own CSS and components.')+'</span></div>'
    +'<div class="ds-wrap">'+foundations()+componentsShell()+coverage({})+'<div id="ds-audit" class="ds-mode" hidden><p class="ds-note" style="margin:0 0 12px">Live reconciliation: styled (CSS) vs rendered (DOM) vs cataloged (registry). Recomputed every load — the runtime "nothing slips" net; a commit-time hook enforces the same.</p><div id="ds-audit-body"><p class="ds-note">Scanning…</p></div></div></div>'
    +'<button class="ds-fab" id="ds-fab">Notes 0</button>'
    +'<div class="ds-panel" id="ds-panel"><h3>Notes &amp; punch list</h3><div class="ds-list" id="ds-notelist"></div><div class="foot"><button class="ds-btn pri" id="ds-copy">Copy punch list</button><button class="ds-btn" id="ds-clear">Clear</button><button class="ds-btn" id="ds-close">Close</button></div></div>'
    +'<div class="ds-editor" id="ds-editor"><div style="font:700 10px/1.3 var(--ds-mono);color:#6d4bd8;margin-bottom:6px" id="ds-edid"></div><textarea id="ds-edtext" placeholder="What to improve here..."></textarea><div class="flags" id="ds-edflags"><button data-fl="improve" aria-pressed="true">Improve</button><button data-fl="bug">Bug</button><button data-fl="idea">Idea</button></div><div style="display:flex;gap:8px"><button class="ds-btn pri" id="ds-edsave" style="flex:1">Save</button><button class="ds-btn" id="ds-eddel">Delete</button></div></div>';
  document.body.appendChild(root);
  if(!DEV){ root.classList.add('ds-public');
    var pub=document.createElement('style'); pub.textContent='#ds-root.ds-public #ds-fab,#ds-root.ds-public #ds-panel,#ds-root.ds-public #ds-editor,#ds-root.ds-public .qa-bar,#ds-root.ds-public .mchip,#ds-root.ds-public [data-m="ds-coverage"],#ds-root.ds-public [data-m="ds-audit"]{display:none!important}';
    document.head.appendChild(pub); }
  if(_wq&&WORLDS.indexOf(_wq)>=0){CUR=_wq;var _ws=root.querySelector('#ds-world');if(_ws)_ws.value=_wq;}
  document.body.classList.add('ds-active','work-focus-open');
  document.body.setAttribute('data-world',CUR);
  document.title='Design system · Chris Lam';
  var back=document.createElement('a'); back.href='?work=this_site#work'; back.textContent='← This site'; back.style.cssText='font:600 12px/1 var(--ds-sans);color:inherit;text-decoration:none;margin-right:8px'; var bar=root.querySelector('.ds-bar'); if(bar) bar.insertBefore(back,bar.firstChild);
  // deep-linkable tab: ?ds=components / ?ds=coverage / ?ds=foundations
  var MODES={foundations:'ds-foundations',components:'ds-components',coverage:'ds-coverage',audit:'ds-audit'};
  var initMode=MODES[((location.search.match(/[?&]ds=([a-z]+)/)||[])[1])]||'ds-foundations';
  if(!DEV&&(initMode==='ds-coverage'||initMode==='ds-audit')) initMode='ds-foundations';
  function setMode(m){root.querySelectorAll('#ds-mode button').forEach(function(b){b.setAttribute('aria-pressed',b.getAttribute('data-m')===m);});['ds-foundations','ds-components','ds-coverage','ds-audit'].forEach(function(id){var el=document.getElementById(id);if(el)el.hidden=(id!==m);});}
  setMode(initMode);
  loadChanges();

  // harvest then populate components + coverage
  harvest().then(function(h){
    renderComponents(h);
    var cov=coverage(h);var tmp=document.createElement('div');tmp.innerHTML=cov;var old=document.getElementById('ds-coverage');old.parentNode.replaceChild(tmp.firstChild,old);
    // keep coverage hidden unless active
    renderAudit();
    setMode(document.querySelector('#ds-mode button[aria-pressed="true"]').getAttribute('data-m'));
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
  // ---- QA variants (preview-only; nothing baked to live until Chris picks) ----
  var VAR={
    bp:{
      dots:'#ds-root .visual-placeholder::before,#ds-root .portfolio-diagram::before{background-image:radial-gradient(color-mix(in srgb,var(--world-line) 85%,transparent) 1.4px,transparent 1.7px);background-size:22px 22px;opacity:1}',
      lines:'#ds-root .visual-placeholder::before,#ds-root .portfolio-diagram::before{background-image:linear-gradient(color-mix(in srgb,var(--world-line) 82%,transparent) 1px,transparent 1px),linear-gradient(90deg,color-mix(in srgb,var(--world-line) 82%,transparent) 1px,transparent 1px);background-size:22px 22px;opacity:1}',
      hybrid:'#ds-root .visual-placeholder::before,#ds-root .portfolio-diagram::before{background-image:radial-gradient(color-mix(in srgb,var(--world-line) 90%,transparent) 1.5px,transparent 1.9px),linear-gradient(color-mix(in srgb,var(--world-line) 40%,transparent) 1px,transparent 1px),linear-gradient(90deg,color-mix(in srgb,var(--world-line) 40%,transparent) 1px,transparent 1px);background-size:22px 22px;opacity:1}'
    }
  };
  root.addEventListener('click',function(e){
    var seg=e.target.closest('.ds-seg.qa'); if(!seg||e.target.tagName!=='BUTTON')return;
    var qa=seg.getAttribute('data-qa'), v=e.target.getAttribute('data-v');
    [].forEach.call(seg.children,function(x){x.setAttribute('aria-pressed',x===e.target);});
    var id='qa-'+qa, st=document.getElementById(id);
    if(!v){ if(st)st.remove(); return; }
    if(!st){ st=document.createElement('style'); st.id=id; document.head.appendChild(st); }
    st.textContent=(VAR[qa]&&VAR[qa][v])||'';
  });
  // deep-link variants, e.g. ?ds=components&w=y30&bp=dots
  ['bp'].forEach(function(qa){var v=(location.search.match(new RegExp('[?&]'+qa+'=([a-z]+)'))||[])[1];if(v&&VAR[qa]&&VAR[qa][v]){var st=document.createElement('style');st.id='qa-'+qa;st.textContent=VAR[qa][v];document.head.appendChild(st);var seg=root.querySelector('.ds-seg.qa[data-qa="'+qa+'"]');if(seg)[].forEach.call(seg.children,function(x){x.setAttribute('aria-pressed',x.getAttribute('data-v')===(v||''));});}});
  draw();
})();
