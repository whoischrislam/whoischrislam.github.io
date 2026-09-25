#!/usr/bin/env node
/*
 * render.cjs: the one command for looking at the real page.
 *
 * Verify by rendering, never by reading source. The plain Chrome
 * --screenshot command misses anything behind a scroll reveal (it captured
 * blank or hero-only pages twice on 2026-09-24), so this scrolls the whole
 * page first, then captures at Retina dpr 2 and reports horizontal overflow.
 *
 * Usage (needs the local server: python3 -m http.server 8765):
 *   node scripts/render.cjs                       home at 1440 and 390
 *   node scripts/render.cjs "/?work=y30"          any path(s)
 *   node scripts/render.cjs --sweep               home + every world + every story
 *   node scripts/render.cjs --list                print the sweep URLs, no browser
 *   options: --widths 1440,390  --out <dir>  --base http://localhost:8765
 *            --motion   keep scroll reveals (default renders the reduced-motion
 *                       path, where the site shows every section at once)
 *
 * Worlds and stories come from check-portfolio-v3.py's own parser, so the
 * sweep cannot drift from the records it checks.
 *
 * Needs the playwright npm package (uses the installed Chrome). This repo has
 * no package.json, so it falls back to $PLAYWRIGHT_PATH, then the sibling
 * prototype checkout.
 */
const { execFileSync } = require("node:child_process");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");

const ROOT = path.resolve(__dirname, "..");
const args = process.argv.slice(2);
const opt = (name, fallback) => {
  const i = args.indexOf(name);
  return i >= 0 ? args.splice(i, 2)[1] : fallback;
};
const flag = (name) => {
  const i = args.indexOf(name);
  return i >= 0 ? (args.splice(i, 1), true) : false;
};

const base = opt("--base", "http://localhost:8765");
const widths = opt("--widths", "1440,390").split(",").map(Number);
const out = opt("--out", path.join(os.tmpdir(), "site-render"));
const sweep = flag("--sweep");
const listOnly = flag("--list");
const motion = flag("--motion");

function sweepPaths() {
  const py = `
import importlib.util, json, pathlib
spec = importlib.util.spec_from_file_location("c", "scripts/check-portfolio-v3.py")
m = importlib.util.module_from_spec(spec); spec.loader.exec_module(m)
s = pathlib.Path("index.html").read_text()
p = m.evaluate_object(m.extract_object(s, "workProjects"), "workProjects")
st = m.evaluate_object(m.extract_object(s, "workStories"), "workStories")
print(json.dumps({"worlds": list(p), "stories": [[v["company"], v["slug"]] for v in st.values()]}))
`;
  const { worlds, stories } = JSON.parse(execFileSync("python3", ["-c", py], { cwd: ROOT, encoding: "utf8" }));
  return ["/"]
    .concat(worlds.map((w) => `/?work=${w}#work`))
    .concat(stories.map(([c, s]) => `/?work=${c}&project=${s}#work`));
}

function loadPlaywright() {
  const tries = ["playwright", process.env.PLAYWRIGHT_PATH, path.join(ROOT, "../prototype/node_modules/playwright")];
  for (const t of tries.filter(Boolean)) {
    try { return require(t); } catch (e) { /* try the next one */ }
  }
  console.error("playwright not found. Set PLAYWRIGHT_PATH or run: npm i -g playwright");
  process.exit(2);
}

function nameFor(p, w) {
  const slug = p.replace(/^\/\??/, "").replace(/#.*$/, "").replace(/[^a-z0-9]+/gi, "-").replace(/^-|-$/g, "") || "home";
  return `${slug}-${w}.png`;
}

(async () => {
  const paths = sweep ? sweepPaths() : args.length ? args : ["/"];
  if (listOnly) { paths.forEach((p) => console.log(base + p)); return; }

  try { await fetch(base); } catch (e) {
    console.error(`nothing at ${base}. Start it: python3 -m http.server 8765`);
    process.exit(2);
  }

  const { chromium } = loadPlaywright();
  // Keep real scrollbars (Playwright hides them by default): Chris runs always-visible scrollbars, and a
  // scrollbar-width layout shift is invisible to a capture without them (2026-09-25).
  const browser = await chromium.launch({ channel: "chrome", ignoreDefaultArgs: ["--hide-scrollbars"] });
  fs.mkdirSync(out, { recursive: true });
  let overflow = 0;
  for (const p of paths) {
    for (const w of widths) {
      const page = await browser.newPage({ viewport: { width: w, height: 900 }, deviceScaleFactor: 2, reducedMotion: motion ? "no-preference" : "reduce" });
      await page.goto(base + p, { waitUntil: "networkidle" });
      // Worlds and stories open in a fixed overlay that scrolls on its own, so
      // the document height is the homepage underneath. Find the element that
      // actually scrolls, walk it so every reveal fires, then grow the
      // viewport to its full height and capture that.
      const m = await page.evaluate(async () => {
        const doc = document.scrollingElement;
        let el = doc;
        for (const c of document.querySelectorAll("body *")) {
          const cs = getComputedStyle(c);
          // Must fill the viewport: rules out sideways carousels and small panels.
          const r = c.getBoundingClientRect();
          if (!/(auto|scroll)/.test(cs.overflowY) || r.width < innerWidth * 0.95 || r.height < innerHeight * 0.9) continue;
          if (c.scrollHeight > c.clientHeight + 10 && c.scrollHeight > (el === doc ? 0 : el.scrollHeight)) el = c;
        }
        const step = innerHeight * 0.8;
        for (let y = 0; y < el.scrollHeight; y += step) {
          el.scrollTop = y; if (el === doc) scrollTo(0, y);
          await new Promise((r) => setTimeout(r, 120));
        }
        el.scrollTop = 0; scrollTo(0, 0);
        // Lazy images the walk brought in must finish before the capture.
        await Promise.all([...document.images].filter((i) => !i.complete)
          .map((i) => new Promise((r) => { i.onload = i.onerror = r; setTimeout(r, 4000); })));
        return {
          inner: el !== doc,
          height: el.scrollHeight,
          // Clipped (overflow-x hidden) content is not overflow the reader can scroll to.
          overflowX: doc.scrollWidth > innerWidth ||
            (/(auto|scroll)/.test(getComputedStyle(el).overflowX) && el.scrollWidth > el.clientWidth + 1),
        };
      });
      await page.waitForTimeout(600);
      if (m.inner) await page.setViewportSize({ width: w, height: Math.min(m.height + 200, 30000) });
      await page.waitForTimeout(m.inner ? 600 : 0);
      const file = path.join(out, nameFor(p, w));
      // Chrome repeats tiles past ~16k device pixels, which fakes a duplicated page. Split tall captures.
      const CHUNK = 7000;   // CSS px; x dpr 2 stays under the limit
      if (!m.inner && m.height > CHUNK) {
        for (let y = 0, n = 1; y < m.height; y += CHUNK, n++) {
          await page.screenshot({ path: file.replace(/\.png$/, `-part${n}.png`), fullPage: true,
            clip: { x: 0, y, width: w, height: Math.min(CHUNK, m.height - y) } });
        }
      } else {
        await page.screenshot({ path: file, fullPage: !m.inner });
      }
      if (m.overflowX) overflow++;
      console.log(`${m.overflowX ? "OVERFLOW" : "ok      "}  ${w}px  h=${m.height}  ${p}  ->  ${!m.inner && m.height > CHUNK ? file.replace(/\.png$/, "-part*.png") : file}`);
      await page.close();
    }
  }
  await browser.close();
  console.log(`${paths.length} page(s) x ${widths.length} width(s), ${overflow} with horizontal overflow. Read the pngs; a number is not a look.`);
  process.exit(overflow ? 1 : 0);
})();
