/* Epoch application page smoke suite.
   Run with the local server up (python3 -m http.server 8765), then: node tests/smoke-epoch.js
   Blocks PostHog so test plays never reach real analytics. */
const path = require('path');
let pw;
for (const t of ['playwright', process.env.PLAYWRIGHT_PATH, path.join(__dirname, '../../prototype/node_modules/playwright')]) {
  try { pw = require(t); break; } catch (e) { /* try the next one */ }
}
const BASE = process.env.BASE || 'http://localhost:8765';
const URL = BASE + '/epoch-ai-application.html';
let failed = 0;
const log = (name, ok, detail) => { if (!ok) failed++; console.log((ok ? 'PASS' : 'FAIL') + '  ' + name + (detail ? ' — ' + detail : '')); };

(async () => {
  const browser = await pw.chromium.launch({ channel: 'chrome' });
  for (const [role, w] of [['', 1440], ['', 390]]) {
    const page = await browser.newPage({ viewport: { width: w, height: 900 } });
    await page.route(/posthog\.com/, r => r.abort());
    const errors = [];
    page.on('pageerror', e => errors.push(String(e)));
    await page.goto(URL + role, { waitUntil: 'networkidle' });
    await page.waitForTimeout(1200);
    const tag = `${role || 'design'} @${w}`;
    log(`no page errors (${tag})`, errors.length === 0, errors.join('; '));
    log(`no horizontal overflow (${tag})`, !(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth)));
    // Regression 2026-09-26: code excerpts spilled over the next rows when the row height was not fixed.
    const lede = await page.evaluate(() => [...document.querySelectorAll('p.lede, p.opening')].filter(e => e.offsetParent).map(e => e.textContent).join(' '));
    log(`opening names only the Design Lead role (${tag})`, /Design Lead( \/ Head of Design)? role/.test(lede) && !/Product Manager/.test(lede));
    await page.click('#seg button[data-l="age_group"]'); await page.click('#opts button[data-g="30–44"]');
    log(`reveal waits for a guess (${tag})`, await page.isHidden('#reveal-btn'));
    const grid = page.locator('#guess-widget svg'); await grid.scrollIntoViewIfNeeded();
    const bb = await grid.boundingBox(); await page.mouse.click(bb.x + bb.width * 0.35, bb.y + bb.height * 0.25);
    log(`a tap sets a guess (${tag})`, /^\d+ of 100$/.test((await page.textContent('#guess-num')).trim()));
    await page.click('#reveal-btn');
    await page.waitForTimeout(1500);
    log(`game reveals a headline (${tag})`, /of every 100/.test(await page.textContent('#reveal-head')));
    log(`feedback: guess vs truth + pattern (${tag})`, /too (high|low)|spot on/.test(await page.textContent('#verdict')) && /compare\./.test(await page.textContent('#chart-cap')));
    await page.close();
  }
  // What an AI screener without JavaScript reads.
  const page = await browser.newPage({ javaScriptEnabled: false });
  await page.goto(URL);
  const text = await page.evaluate(() => document.body.innerText);
  for (const k of ['How I match the role', 'Leading design', 'Up close: GoodRx Research', 'most-filled prescription', 'Which group are you in?']) {
    log(`readable without JavaScript: "${k}"`, text.includes(k));
  }
  await browser.close();
  console.log(failed ? `${failed} FAILED` : 'ALL PASSED');
  process.exit(failed ? 1 : 0);
})();
