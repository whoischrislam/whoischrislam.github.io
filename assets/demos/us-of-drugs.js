/* The United States of Drugs (GoodRx Research, 2018), rebuilt in D3 from the March 2018 working data file.
   One component, two hosts: epoch-ai-application.html and the GoodRx Research case study in index.html.
   Needs d3 v7 + topojson-client on window (load() fetches them if missing) and assets/demos/us-of-drugs.css.
   Usage: USOfDrugs.mount(rootEl, { csv: 'data/goodrx-top-drugs-by-state-2018.csv' }) -> Promise */
(function () {
  const CDN = [
    ['d3', 'https://cdn.jsdelivr.net/npm/d3@7/dist/d3.min.js'],
    ['topojson', 'https://cdn.jsdelivr.net/npm/topojson-client@3/dist/topojson-client.min.js']
  ];
  const ATLAS = 'https://cdn.jsdelivr.net/npm/us-atlas@3/states-albers-10m.json';
  const RM = matchMedia('(prefers-reduced-motion: reduce)').matches;

  // Plain-language uses, for the average reader (general, not medical advice).
  const DRUG = {
    'levothyroxine': 'Thyroid hormone, for an underactive thyroid', 'lisinopril': 'Blood pressure', 'atorvastatin': 'Cholesterol',
    'amlodipine': 'Blood pressure', 'prednisone': 'Steroid for swelling, asthma and allergies', 'hydrocodone/acetaminophen': 'Opioid painkiller',
    'amoxicillin': 'Antibiotic', 'azithromycin': 'Antibiotic', 'omeprazole': 'Heartburn and acid reflux', 'oseltamivir': 'The flu (Tamiflu)',
    'amphetamine salt combo': 'ADHD (Adderall)', 'sertraline': 'Depression and anxiety', 'ventolin': 'Asthma inhaler', 'alprazolam': 'Anxiety (Xanax)',
    'phentermine': 'Weight loss', 'losartan': 'Blood pressure', 'metoprolol er': 'Blood pressure and heart', 'hydrochlorothiazide': 'Blood pressure (water pill)',
    'gabapentin': 'Nerve pain and seizures', 'simvastatin': 'Cholesterol', 'ibuprofen': 'Pain and swelling', 'pantoprazole': 'Heartburn and acid reflux',
    'fluoxetine': 'Depression and anxiety (Prozac)', 'escitalopram': 'Depression and anxiety', 'proair': 'Asthma inhaler', 'ondansetron': 'Nausea',
    'amoxicillin/potassium clavulanate': 'Antibiotic (Augmentin)', 'zolpidem': 'Sleep (Ambien)', 'sildenafil': 'Erectile dysfunction (Viagra)',
    'montelukast': 'Asthma and allergies', 'lorazepam': 'Anxiety', 'bupropion xl': 'Depression, and quitting smoking', 'tramadol': 'Pain',
    'oxycodone/acetaminophen': 'Opioid painkiller', 'oxycodone': 'Opioid painkiller', 'metformin': 'Type 2 diabetes', 'lantus': 'Insulin, for diabetes',
    'fluticasone propionate': 'Allergy nasal spray'
  };
  const cap = n => n.replace(/\b\w/, c => c.toUpperCase());
  const useOf = n => DRUG[n] || '';

  function script(src) {
    return new Promise((ok, fail) => { const s = document.createElement('script'); s.src = src; s.onload = ok; s.onerror = fail; document.head.appendChild(s); });
  }
  function load() { return CDN.reduce((p, [g, src]) => p.then(() => window[g] ? null : script(src)), Promise.resolve()); }

  // One tooltip for every map on the page.
  let tip;
  function showTip(html, ev) {
    if (!tip) { tip = document.createElement('div'); tip.className = 'usod-tip'; tip.setAttribute('role', 'tooltip'); document.body.appendChild(tip); }
    tip.innerHTML = html; tip.style.display = 'block';
    tip.style.left = Math.min(ev.clientX + 14, innerWidth - tip.offsetWidth - 8) + 'px';
    tip.style.top = Math.min(ev.clientY + 14, innerHeight - tip.offsetHeight - 8) + 'px';
  }
  function hideTip() { if (tip) tip.style.display = 'none'; }

  // Tells PostHog which parts of the demo get used, once per action per page view.
  const seen = new Set();
  function track(action) {
    if (seen.has(action)) return; seen.add(action);
    try { window.posthog && window.posthog.capture('demo_interact', { demo: 'us-of-drugs', action }); } catch (e) { /* analytics is optional */ }
  }

  function mount(root, opts) {
    opts = opts || {};
    root.classList.add('usod');
    root.innerHTML = `
      <div class="usod-controls">
        <div class="usod-seg" role="tablist" aria-label="Color the map by">
          <button role="tab" data-m="top" aria-selected="true">Top drug in each state</button>
          <button role="tab" data-m="follow" aria-selected="false">Follow one drug</button>
        </div>
        <div class="usod-pills" role="group" aria-label="Pick a drug" hidden></div>
      </div>
      <div class="usod-wrap">
        <div class="usod-legend" role="list"></div>
        <div class="usod-card" hidden></div>
        <svg class="usod-map" role="img" aria-label="Map of US states colored by prescription"></svg>
      </div>`;
    const q = s => root.querySelector(s);
    return load().then(() => Promise.all([d3.csv(opts.csv || 'data/goodrx-top-drugs-by-state-2018.csv'), d3.json(ATLAS)])).then(([drugs, us]) => {
      const byName = new Map(drugs.map(d => [d.statename, d]));
      const top10 = d => [1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map(i => d['drug' + i]);
      const tops = d3.rollups(drugs, v => v.length, d => d.drug1).sort((a, b) => b[1] - a[1]);
      const palette = ['#2a9d4f', '#c2410c', '#3b6fb6', '#b58a1b', '#7a4fb3', '#8a8a82'];
      const colorOf = new Map(tops.map(([k], i) => [k, palette[Math.min(i, palette.length - 1)]]));
      const inTop10 = new Map(d3.rollups(drugs.flatMap(top10), v => v.length, d => d));
      const common = [...inTop10].sort((a, b) => b[1] - a[1]).slice(0, 6).map(d => d[0]);
      const rankColor = d3.scaleSequential(t => d3.interpolateGreens(1 - t * 0.8)).domain([1, 10]);
      const NONE = 'var(--usod-none)';
      let mode = 'top', follow = common[0], hl = null;
      const svg = d3.select(q('.usod-map')).attr('viewBox', '-8 -8 991 626'); // padding so Alaska's outline stays inside
      const states = svg.selectAll('path').data(topojson.feature(us, us.objects.states).features).join('path')
        .attr('class', 'state').attr('d', d3.geoPath());
      function fill(f) {
        const d = byName.get(f.properties.name); if (!d) return NONE;
        if (mode === 'top') return colorOf.get(d.drug1) || palette[5];
        const r = top10(d).indexOf(follow) + 1; return r ? rankColor(r) : NONE;
      }
      const isOther = k => !tops.slice(0, 5).some(t => t[0] === k);
      function matches(f) {
        const d = byName.get(f.properties.name); if (!d || hl == null) return true;
        if (mode === 'top') return hl === 'other' ? isOther(d.drug1) : d.drug1 === hl;
        const r = top10(d).indexOf(follow) + 1; return hl === 'none' ? !r : r && r <= hl && r > hl - (hl === 1 ? 1 : hl === 5 ? 4 : 5);
      }
      const paint = () => states.attr('fill', fill).attr('opacity', f => matches(f) ? 1 : .18);
      const listStates = pred => { const n = drugs.filter(pred).map(d => d.statename).sort(); return n.length ? n.join(', ') : 'None'; };
      function legendTip(k) {
        if (mode === 'top') {
          if (k === 'other') { const ds = tops.slice(5).map(t => cap(t[0])); return `<b>Something else</b><span class="tt-use">${ds.join(', ')}</span><span class="tt-states">${listStates(d => isOther(d.drug1))}</span>`; }
          return `<b>${cap(k)}</b><span class="tt-use">${useOf(k)}</span><span class="tt-states">Top drug in ${listStates(d => d.drug1 === k)}</span>`;
        }
        const rk = d => top10(d).indexOf(follow) + 1;
        const [lab, pred] = k === 1 ? ['Ranks #1 in', d => rk(d) === 1] : k === 5 ? ['Ranks #2 to #5 in', d => rk(d) >= 2 && rk(d) <= 5]
          : k === 10 ? ['Ranks #6 to #10 in', d => rk(d) >= 6] : ['Not in the top 10 in', d => !rk(d)];
        return `<b>${cap(follow)}</b><span class="tt-use">${lab}</span><span class="tt-states">${listStates(pred)}</span>`;
      }
      function legend() {
        const L = q('.usod-legend');
        L.innerHTML = mode === 'top'
          ? tops.slice(0, 5).map(([k, n]) => `<button role="listitem" data-k="${k}"><i style="background:${colorOf.get(k)}"></i><span><b>${cap(k)}</b><small>${useOf(k)} · top in ${n} state${n > 1 ? 's' : ''}</small></span></button>`).join('')
            + `<button role="listitem" data-k="other"><i style="background:${palette[5]}"></i><span><b>Something else</b><small>${tops.length - 5} other drugs</small></span></button>`
          : `<p class="usod-lg-h">Where <b>${cap(follow)}</b> ranks</p><p class="usod-lg-use">${useOf(follow)}</p>`
            + [[1, '#1'], [5, '#2 to #5'], [10, '#6 to #10'], ['none', 'Not in the top 10']].map(([k, t]) => `<button role="listitem" data-k="${k}"><i style="background:${k === 'none' ? NONE : rankColor(k === 1 ? 1 : k === 5 ? 3 : 8)}"></i><span><b>${t}</b></span></button>`).join('');
        L.querySelectorAll('button').forEach(b => {
          const k = isNaN(+b.dataset.k) ? b.dataset.k : +b.dataset.k;
          const on = () => { hl = k; paint(); track('legend'); L.querySelectorAll('button').forEach(x => x.classList.toggle('dim', x !== b)); };
          const off = () => { hl = null; paint(); hideTip(); L.querySelectorAll('button').forEach(x => x.classList.remove('dim')); };
          b.addEventListener('pointerenter', on); b.addEventListener('pointermove', ev => showTip(legendTip(k), ev)); b.addEventListener('pointerleave', off);
          b.addEventListener('focus', on); b.addEventListener('blur', off);
        });
      }
      const recolor = () => states.transition().duration(RM ? 0 : 400).attr('fill', fill);
      function pills() {
        const P = q('.usod-pills');
        P.innerHTML = common.map(c => `<button aria-pressed="${c === follow}" data-d="${c}" title="${useOf(c)}">${cap(c)}</button>`).join('');
        P.querySelectorAll('button').forEach(b => b.onclick = () => { follow = b.dataset.d; track('pick_drug'); pills(); legend(); recolor(); });
      }
      root.querySelectorAll('.usod-seg button').forEach(b => b.onclick = () => {
        mode = b.dataset.m === 'top' ? 'top' : 'follow'; track('mode_' + mode);
        root.querySelectorAll('.usod-seg button').forEach(x => x.setAttribute('aria-selected', x === b));
        q('.usod-pills').hidden = mode === 'top'; pills(); legend(); recolor();
      });
      function card(f) {
        const d = byName.get(f.properties.name);
        if (!d) return `<b class="tt-title">${f.properties.name}</b>No data in the 2018 file.`;
        const list = top10(d), r = list.indexOf(follow) + 1;
        const key = mode === 'top'
          ? `<span class="tt-key"><i style="background:${colorOf.get(d.drug1) || palette[5]}"></i><span>Top drug: <b>${cap(d.drug1)}</b></span></span>`
          : `<span class="tt-key"><i style="background:${r ? rankColor(r === 1 ? 1 : r <= 5 ? 3 : 8) : NONE}"></i><span>${r ? `${cap(follow)} ranks <b>#${r}</b> here` : `${cap(follow)} isn't in the top 10 here`}</span></span>`;
        const odd = list.reduce((a, b) => (inTop10.get(b) || 99) < (inTop10.get(a) || 99) ? b : a), oddN = inTop10.get(odd);
        return `<b class="tt-title">${d.statename}</b>${key}<span class="tt-sub">Top 10 prescriptions, 2018</span><ol class="tt-list">${list.map(x =>
          `<li${(mode === 'top' ? x === d.drug1 : x === follow) ? ' class="hit"' : ''}><span>${cap(x)}</span><small>${useOf(x)}</small></li>`).join('')}</ol>`
          + (oddN <= 12 ? `<span class="tt-odd"><b>Unusual here:</b> ${cap(odd)}. Only ${oddN} state${oddN > 1 ? 's' : ''} have it in their top 10.</span>` : '');
      }
      states
        .on('pointerenter', function () { d3.select(this).raise().classed('hov', true); svg.classed('hovering', true); })
        .on('pointermove', (ev, f) => { if (ev.pointerType === 'mouse') { showTip(card(f), ev); track('state'); } })
        .on('pointerleave', function () { d3.select(this).classed('hov', false); svg.classed('hovering', false); hideTip(); })
        .on('click', function (ev, f) {
          if (ev.pointerType === 'mouse') return;
          states.classed('hov', false); d3.select(this).raise().classed('hov', true); svg.classed('hovering', true);
          const c = q('.usod-card'); c.hidden = false; c.innerHTML = card(f); track('state');
        });
      paint(); legend(); pills();
      root.classList.add('is-ready');
    });
  }

  window.USOfDrugs = { mount, load };
})();
