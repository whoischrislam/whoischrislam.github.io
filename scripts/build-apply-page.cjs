#!/usr/bin/env node
// Build an unlisted application page from a page.md that Chris writes himself.
//
//   node scripts/build-apply-page.cjs <page.md>            -> <slug>-application.html (refuses on any blank)
//   node scripts/build-apply-page.cjs <page.md> --draft    -> same file with blanks highlighted + a DRAFT bar
//   node scripts/build-apply-page.cjs <page.md> --check    -> validate only, write nothing
//   add --out <file.html> to write somewhere else (previews)
//
// The script never writes copy. Every sentence on the page comes from page.md verbatim;
// the script supplies only structure, the demo embeds, and recommendations quoted from
// index.html's workRecommendations (the canonical source). Format: templates/apply-page.md.
'use strict';
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const args = process.argv.slice(2);
const DRAFT = args.includes('--draft'), CHECK = args.includes('--check');
const outIdx = args.indexOf('--out'), OUT = outIdx >= 0 ? args[outIdx + 1] : null;
const src = args.find((a, i) => !a.startsWith('--') && (outIdx < 0 || i !== outIdx + 1));
if (!src) { console.error('usage: build-apply-page.cjs <page.md> [--draft|--check]'); process.exit(2); }

const errors = [];
const err = m => errors.push(m);

// ---- Demos: each is a shared component in assets/demos. Captions are the approved Epoch page copy. ----
const DEMOS = {
  'us-of-drugs': {
    toc: 'GoodRx Research',
    band: 'band-goodrx',
    css: ['assets/demos/us-of-drugs.css'],
    js: ['https://cdn.jsdelivr.net/npm/d3@7/dist/d3.min.js', 'https://cdn.jsdelivr.net/npm/topojson-client@3/dist/topojson-client.min.js', 'assets/demos/us-of-drugs.js'],
    html: `<div class="sub-block">
      <p class="meta"><span>Shipped 2018</span><span class="src-tip" tabindex="0">Rebuilt 2026 <i>ⓘ</i><em role="tooltip">Redrawn from the original 2018 data file. The original was built in Vega.</em></span><span><a href="https://www.goodrx.com/healthcare-access/research/the-most-popular-drugs-in-america-by-state">Original on GoodRx ↗</a></span></p>
      <h2 class="sub-title">The United States of Drugs</h2>
      <p class="lede">What each state fills most at the pharmacy. I designed the original and built it in code, with help from my engineering colleague Marc Mendiola.</p>
      <p class="map-find">Levothyroxine, a thyroid medicine, was the most-filled prescription in <b>24 of 50 states</b>.</p>
    </div>
    <div id="usod"></div>`,
    init: `USOfDrugs.mount(document.getElementById('usod'));`,
  },
  'voice-xray': {
    toc: 'y30: inside the voice',
    band: 'band-plain',
    css: ['assets/demos/voice-xray.css'],
    js: ['assets/demos/voice-xray.js'],
    html: `<section class="vx-host" id="vx" aria-label="Watch a real call run through the pipeline"></section>`,
    init: `VoiceXray.mount(document.getElementById('vx'), {title: 'Watch a real call run through the pipeline'});`,
  },
  'hogware': {
    toc: 'HogWare',
    band: 'band-plain',
    css: [], js: [],
    html: `<iframe class="embed-game" src="hogware.html" title="HogWare, a playable microgame gauntlet" loading="lazy"></iframe>
    <p class="aside"><a href="hogware.html">Play full screen ↗</a></p>`,
    init: '',
  },
};

// ---- Recommendations: verbatim, from index.html ----
function loadRecommendations() {
  const html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
  const start = html.indexOf('var workRecommendations = {');
  if (start < 0) { err('index.html: workRecommendations not found'); return {}; }
  let i = html.indexOf('{', start), depth = 0, inStr = null;
  for (let j = i; j < html.length; j++) {
    const c = html[j];
    if (inStr) { if (c === '\\') j++; else if (c === inStr) inStr = null; continue; }
    if (c === '"' || c === "'") inStr = c;
    else if (c === '{') depth++;
    else if (c === '}' && --depth === 0) {
      const obj = Function(`"use strict";return (${html.slice(i, j + 1)})`)();
      const byName = {};
      Object.values(obj).flat().forEach(r => { byName[r.name] = r; });
      return byName;
    }
  }
  err('index.html: could not parse workRecommendations'); return {};
}

// ---- Inline text: escape, then **bold**, [text](url), [[blank]] ----
const esc = s => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const attr = s => esc(s).replace(/"/g, '&quot;');
function inline(s, where) {
  if (/—|&mdash;|&#8212;/.test(s)) err(`${where}: em dash (public copy uses a period, comma, colon, or parentheses)`);
  let out = esc(s);
  out = out.replace(/\[\[(.*?)\]\]/g, (_, t) => { if (!DRAFT) err(`${where}: unfilled blank [[${t}]]`); return `<span class="blank">${t || 'blank'}</span>`; });
  out = out.replace(/\*\*(.+?)\*\*/g, '<b>$1</b>');
  out = out.replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, (_, t, u) => { checkLink(u, where); return `<a href="${u}">${t}</a>`; });
  return out;
}
function checkLink(u, where) {
  if (/^(https?:|mailto:|#)/.test(u)) return;
  const file = u.split(/[?#]/)[0];
  if (file && !fs.existsSync(path.join(ROOT, file))) err(`${where}: link to missing file ${file}`);
}
function checkImage(p, where) { if (!fs.existsSync(path.join(ROOT, p))) err(`${where}: missing image ${p}`); }

// ---- Parse page.md ----
const raw = fs.readFileSync(src, 'utf8').replace(/\r\n/g, '\n');
const fm = raw.match(/^---\n([\s\S]*?)\n---\n/);
if (!fm) { console.error(`${src}: needs a --- front matter block (see templates/apply-page.md)`); process.exit(2); }
const meta = {};
fm[1].split('\n').forEach(l => { const m = l.match(/^(\w+):\s*(.*)$/); if (m) meta[m[1]] = m[2].trim(); });
['company', 'role', 'slug', 'description'].forEach(k => { if (!meta[k]) err(`front matter: missing ${k}`); });
if (meta.slug && !/^[a-z0-9-]+$/.test(meta.slug)) err('front matter: slug must be lowercase letters, digits, hyphens');

// Sections: "# Kind" or "# Kind: heading". Kinds: Opening, Match, Demo, Recommendations, Section, Contact.
const sections = [];
raw.slice(fm[0].length).split('\n').forEach(line => {
  const h = line.match(/^# (\w+)(?::\s*(.*))?$/);
  if (h) sections.push({ kind: h[1].toLowerCase(), arg: (h[2] || '').trim(), lines: [] });
  else if (sections.length) sections[sections.length - 1].lines.push(line);
  else if (line.trim()) err(`text before the first # section: "${line.trim().slice(0, 40)}"`);
});

// Blocks inside a section: paragraphs, "- " lists, "## " cards, "key: value" directives.
const DIRECTIVES = ['transition', 'image', 'link', 'quotes', 'toc'];
function blocks(lines) {
  const out = []; let para = [];
  const flush = () => { if (para.length) { out.push({ t: 'p', text: para.join(' ') }); para = []; } };
  lines.forEach(l => {
    const d = l.match(/^(\w+):\s+(.*)$/);
    if (!l.trim()) flush();
    else if (l.startsWith('## ')) { flush(); out.push({ t: 'h', text: l.slice(3).trim() }); }
    else if (l.startsWith('- ')) { flush(); out.push({ t: 'li', text: l.slice(2).trim() }); }
    else if (d && DIRECTIVES.includes(d[1])) { flush(); out.push({ t: d[1], text: d[2].trim() }); }
    else para.push(l.trim());
  });
  flush(); return out;
}
const paras = (bs, cls, where) => bs.filter(b => b.t === 'p').map(b => `<p${cls ? ` class="${cls}"` : ''}>${inline(b.text, where)}</p>`).join('\n');
const lists = (bs, where) => { const li = bs.filter(b => b.t === 'li'); return li.length ? `<ul>${li.map(b => `<li>${inline(b.text, where)}</li>`).join('')}</ul>` : ''; };
const one = (bs, t) => (bs.find(b => b.t === t) || {}).text;

const recs = loadRecommendations();
const usedDemos = [];
let n = 0;
const id = k => `${k}-${++n}`;

function render(s) {
  const bs = blocks(s.lines), where = `# ${s.kind}${s.arg ? ': ' + s.arg : ''}`;
  const trans = one(bs, 'transition'), pre = trans ? `<p class="trans">${inline(trans, where)}</p>\n` : '';
  const head = (title, toc) => `<div class="sec-head"><h2>${inline(title, where)}</h2></div>`;
  const tocAttr = title => `data-toc="${attr(one(bs, 'toc') || title.replace(/\*\*|\[\[|\]\]/g, ''))}"`;
  switch (s.kind) {
    case 'opening': {
      const ps = bs.filter(b => b.t === 'p');
      if (!ps.length) err(`${where}: empty`);
      return `<div id="hello" data-toc="${attr(one(bs, 'toc') || 'Hello')}"></div>\n` +
        ps.map((b, i) => `<p class="${i ? 'lede' : 'opening'}">${inline(b.text, where)}</p>`).join('\n');
    }
    case 'match': {
      if (!s.arg) err(`${where}: needs a heading, e.g. "# Match: How I match the role"`);
      const cards = []; let cur = null;
      bs.forEach(b => { if (b.t === 'h') cards.push(cur = { title: b.text, bs: [] }); else if (cur) cur.bs.push(b); });
      if (!cards.length) err(`${where}: needs at least one "## " card`);
      const intro = paras(bs.slice(0, bs.findIndex(b => b.t === 'h')), 'lede', where);
      const html = cards.map(c => {
        const w = `${where} / ## ${c.title}`, img = one(c.bs, 'image'), link = one(c.bs, 'link');
        let imgHtml = '';
        if (img) { const [p, alt] = img.split('|').map(x => x.trim()); checkImage(p, w); if (!alt) err(`${w}: image needs "path | alt text"`);
          imgHtml = `<button class="zoom wz" aria-label="Enlarge: ${attr(c.title)}"><img src="${attr(p)}" alt="${attr(alt || '')}" loading="lazy" /></button>`; }
        return `<article class="wcard"><h3>${inline(c.title, w)}</h3>${imgHtml}${lists(c.bs, w)}${paras(c.bs, '', w)}${link ? inline(link, w) : ''}</article>`;
      }).join('\n');
      return `${pre}<section class="chapter" id="${id('match')}" ${tocAttr(s.arg)}>\n${head(s.arg)}\n${intro}\n<div class="why">\n${html}\n</div>\n</section>`;
    }
    case 'demo': {
      const d = DEMOS[s.arg];
      if (!d) { err(`${where}: unknown demo "${s.arg}". Known: ${Object.keys(DEMOS).join(', ')}`); return ''; }
      usedDemos.push(d);
      return `${pre}<section class="band ${d.band}" id="${id('demo')}" data-toc="${attr(one(bs, 'toc') || d.toc)}">\n${d.html}\n${paras(bs, '', where)}\n</section>`;
    }
    case 'recommendations': {
      if (!s.arg) err(`${where}: needs a heading`);
      const names = (one(bs, 'quotes') || '').split(',').map(x => x.trim()).filter(Boolean);
      if (!names.length) err(`${where}: needs "quotes: Name, Name"`);
      const qs = names.map(nm => {
        const r = recs[nm];
        if (!r) { err(`${where}: no recommendation from "${nm}" in index.html. Known: ${Object.keys(recs).join(', ')}`); return ''; }
        const body = r.quote.split(/\n\n+/).map(p => `<p>${esc(p).replace(/\n/g, '<br>')}</p>`).join('');
        return `<blockquote class="q">${body}<cite>${esc(r.name)}, ${esc(r.role)}${r.relation ? ` · ${esc(r.relation)}` : ''}</cite></blockquote>`;
      }).join('\n');
      return `${pre}<section class="chapter" id="${id('recs')}" ${tocAttr(s.arg)}>\n${head(s.arg)}\n${paras(bs, 'lede', where)}\n${qs}\n<p class="aside"><a href="https://www.linkedin.com/in/whoischrislam/details/recommendations/">All recommendations on LinkedIn ↗</a></p>\n</section>`;
    }
    case 'section': {
      if (!s.arg) err(`${where}: needs a heading`);
      return `${pre}<section class="chapter" id="${id('sec')}" ${tocAttr(s.arg)}>\n${head(s.arg)}\n${paras(bs, '', where)}\n${lists(bs, where)}\n</section>`;
    }
    case 'contact': {
      if (!s.arg) err(`${where}: needs a heading, e.g. "# Contact: Let's talk."`);
      return `${pre}<section class="chapter contact" id="contact" ${tocAttr('Get in touch')}>\n<h2>${inline(s.arg, where)}</h2>\n${paras(bs, '', where)}\n` +
        `<a class="btn btn-primary btn-lg" href="${mailto}">Email Chris</a>\n<a class="btn btn-lg btn-ghost" href="index.html">See my full portfolio ↗</a>\n<p class="aside">Or download my <a href="chris-lam-resume.pdf">résumé</a>.</p>\n</section>`;
    }
    default: err(`unknown section "# ${s.kind}". Use Opening, Match, Demo, Recommendations, Section, Contact.`); return '';
  }
}

const mailto = `mailto:whoischrislam@gmail.com?subject=${encodeURIComponent(meta.email_subject || `${meta.company || ''}: ${meta.role || ''}`)}`;
if (!sections.some(s => s.kind === 'opening')) err('missing # Opening');
if (!sections.some(s => s.kind === 'contact')) err('missing # Contact');
const body = sections.map(render).join('\n\n');
inline(meta.description || '', 'front matter description');

if (errors.length) {
  console.error(`${src}: ${errors.length} problem(s), nothing written:\n` + errors.map(e => '  - ' + e).join('\n'));
  process.exit(1);
}
if (CHECK) { console.log(`${src}: OK`); process.exit(0); }

const title = `For ${meta.company} · ${meta.role} · Chris Lam`;
const css = [...new Set(usedDemos.flatMap(d => d.css))].map(h => `<link rel="stylesheet" href="${h}">`).join('\n');
const js = [...new Set(usedDemos.flatMap(d => d.js))].map(h => `<script src="${h}"></script>`).join('\n');
const init = usedDemos.map(d => d.init).join('\n');
const page = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width, initial-scale=1.0" />
<!-- Built by scripts/build-apply-page.cjs from Chris's page.md. Edit the source, not this file. -->
<title>${esc(title)}</title>
<meta name="description" content="${attr(meta.description)}" />
<meta property="og:title" content="${attr(title)}" />
<meta property="og:description" content="${attr(meta.description)}" />
<meta name="author" content="Chris Lam" />
<meta name="robots" content="noindex" /><!-- unlisted on purpose: an application page addressed to one employer, shared by link only -->
<link rel="preconnect" href="https://fonts.googleapis.com" />
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
<link href="https://fonts.googleapis.com/css2?family=Newsreader:ital,opsz,wght@0,6..72,400;0,6..72,500;1,6..72,400&family=Figtree:wght@400;600&family=IBM+Plex+Mono:wght@400;500&display=swap" rel="stylesheet" />
<link rel="stylesheet" href="assets/apply/apply.css">
${css}
</head>
<body>
${DRAFT ? '<div class="draft-bar">DRAFT · blanks highlighted · not for sending</div>\n' : ''}<nav class="toc" aria-label="On this page">
  <p class="toc-title">On this page</p>
  <ol id="toc-list"></ol>
  <a class="btn btn-primary toc-cta" href="${mailto}"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><rect x="3" y="5" width="18" height="14" rx="2"/><path d="M3 7l9 6 9-6"/></svg>Email Chris</a>
</nav>
<a class="cta-float" href="${mailto}">Email Chris</a>
<main>
${body}

<dialog class="lightbox" id="lightbox" aria-label="Enlarged image"><button class="lb-close" aria-label="Close">×</button><img id="lb-img" alt="" /><p id="lb-cap"></p></dialog>
<footer>Design and build: Chris Lam.</footer>
</main>
<script src="analytics-init.js"></script>
${js}
<script src="assets/apply/apply.js"></script>
${init ? `<script>\n${init}\n</script>` : ''}
</body>
</html>
`;
const out = OUT ? path.resolve(OUT) : path.join(ROOT, `${meta.slug}-application.html`);
fs.writeFileSync(out, page);
console.log(`${DRAFT ? 'DRAFT ' : ''}wrote ${path.relative(ROOT, out)}`);
