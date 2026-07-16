/* HogWare headless smoke suite — drives full runs through every microgame.
   Run: npm i playwright (once, anywhere on NODE_PATH), then: node tests/smoke-hogware.js
   Runs with ?notrack=1 so test plays never pollute real PostHog data. */
const { chromium } = require('playwright');
const path = require('path');

const SITE = path.join(__dirname, '..');
const results = [];
function log(name, ok, detail) {
  results.push({ name, ok, detail });
  console.log((ok ? 'PASS' : 'FAIL') + '  ' + name + (detail ? ' — ' + detail : ''));
}

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 900, height: 700 } });
  const errors = [];
  page.on('pageerror', e => errors.push(String(e)));
  page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
  page.on('dialog', d => d.accept());

  // optional argv[2] forces a boss, e.g. `node tests/smoke-hogware.js incident`
  const bossArg = process.argv[2] ? '&boss=' + process.argv[2] : '';
  await page.goto('file://' + path.join(SITE, 'hogware.html') + '?notrack=1' + bossArg);
  await page.reload();
  await page.waitForTimeout(400);

  log('page loads, title screen visible', await page.isVisible('#hw-titlescreen'));
  log('__phDisabled honored', await page.evaluate(() => window.__phDisabled === true));

  async function currentGame() {
    return page.evaluate(() => {
      const s = document.getElementById('hw-scene');
      if (document.getElementById('hw-stage').dataset.boss === '1') return 'boss';
      if (s.querySelector('#hw-car')) return 'drive';
      if (s.querySelector('.hw-toggles')) return 'publish';
      if (s.querySelector('#hw-w-frame')) return 'weird';
      if (s.querySelector('#hw-ship-zone')) return 'ship';
      if (s.querySelector('#hw-puck')) return 'aim';
      return null;
    });
  }
  async function waitForScene() {
    // dataset.live flips to "1" only when the zoom-in lands and input unlocks —
    // interacting earlier hits the activation barrier by design.
    await page.waitForFunction(() => {
      const scene = document.getElementById('hw-scene');
      return !scene.classList.contains('hw-hidden') && scene.children.length > 0 &&
        document.getElementById('hw-stage').dataset.live === '1';
    }, { timeout: 12000 });
    return currentGame();
  }
  async function waitResult() {
    await page.waitForFunction(() => !document.getElementById('hw-result').classList.contains('hw-hidden'), { timeout: 14000 }); // bosses run long

    const passed = await page.evaluate(() => document.getElementById('hw-result-word').classList.contains('hw-pass'));
    const flavor = await page.evaluate(() => document.getElementById('hw-result-flavor').textContent);
    await page.waitForFunction(() => document.getElementById('hw-result').classList.contains('hw-hidden'), { timeout: 6000 });
    return { passed, flavor };
  }
  async function maybeSkipQuote() {
    const q = await page.evaluate(() => !document.getElementById('hw-quote').classList.contains('hw-hidden'));
    if (q) await page.evaluate(() => document.getElementById('hw-stage').dispatchEvent(new PointerEvent('pointerdown', { bubbles: true })));
  }

  async function playOne(deliberateFail) {
    await maybeSkipQuote();
    const game = await waitForScene();
    if (game === 'boss') {
      // Boss dispatcher: the daily seed rotates which boss appears — play whichever it is.
      const kind = await page.evaluate(() => {
        if (document.getElementById('hw-curl-rink')) return 'curl';
        if (document.getElementById('hw-incident-scene')) return 'incident';
        if (document.getElementById('hw-funnel-rink')) return 'funnel';
        return '?';
      });
      if (kind === 'curl') {
        const info = await page.evaluate(() => {
          const r = document.getElementById('hw-curl-rink');
          return { target: parseFloat(r.dataset.targetpower), charge: parseFloat(r.dataset.chargems), rocks: r.dataset.rocks.split(',').map(Number) };
        });
        if (deliberateFail) {
          await page.keyboard.down('Space');
          await page.waitForTimeout(0.2 * info.charge); // feeble launch: stops far short
          await page.keyboard.up('Space');
        } else {
          await page.keyboard.down('Space');
          await page.waitForTimeout(info.target / 100 * info.charge - 40);
          await page.keyboard.up('Space');
          let hopped = 0, prevX = 0, prevT = Date.now();
          for (let t = 0; t < 120 && hopped < info.rocks.length; t++) {
            const st = await page.evaluate(() => ({
              x: parseFloat(document.getElementById('hw-curl-rink')?.dataset.hogx || '0'),
              res: !document.getElementById('hw-result').classList.contains('hw-hidden')
            }));
            if (st.res) break;
            const nowT = Date.now();
            const speed = Math.max(0.05, (st.x - prevX) / Math.max(1, nowT - prevT) * 1000);
            prevX = st.x; prevT = nowT;
            if (st.x > info.rocks[hopped] - (0.05 + speed * 0.09)) { await page.keyboard.press('Space'); hopped++; }
            await page.waitForTimeout(20);
          }
        }
      } else if (kind === 'incident') {
        if (deliberateFail) {
          // revert everything EXCEPT the bad commit: three spikes top the graph fast
          for (const b of await page.$$('.hw-commit[data-bad="0"]')) { await b.dispatchEvent('pointerdown'); await page.waitForTimeout(120); }
        } else {
          await (await page.$('.hw-commit[data-bad="1"]')).dispatchEvent('pointerdown');
          await page.waitForSelector('#hw-rollback', { timeout: 3000 });
          for (let i = 0; i < 60; i++) {
            const done = await page.evaluate(() => !document.getElementById('hw-result').classList.contains('hw-hidden'));
            if (done) break;
            const btn = await page.$('#hw-rollback');
            if (btn) await btn.dispatchEvent('pointerdown');
            await page.waitForTimeout(45);
          }
          const dbg = await page.evaluate(() => {
            const g = document.getElementById('hw-err-graph');
            return g ? `p=${g.dataset.p} err=${g.dataset.err}` : 'no graph';
          });
          console.log('  [incident debug] ' + dbg);
        }
      } else if (kind === 'funnel') {
        if (!deliberateFail) {
          // steer: hold slides right, release drifts left — chase the lowest falling user
          let holding = false;
          for (let t = 0; t < 500; t++) {
            const st = await page.evaluate(() => {
              const r = document.getElementById('hw-funnel-rink');
              return r ? { fx: parseFloat(r.dataset.fx || '0.5'), nx: parseFloat(r.dataset.nextx || '-1'), res: !document.getElementById('hw-result').classList.contains('hw-hidden') } : { res: true };
            });
            if (st.res) break;
            const wantHold = st.nx >= 0 && st.nx > st.fx + 0.01;
            if (wantHold && !holding) { await page.keyboard.down('Space'); holding = true; }
            if (!wantHold && holding) { await page.keyboard.up('Space'); holding = false; }
            await page.waitForTimeout(20);
          }
          if (holding) await page.keyboard.up('Space');
        }
        // deliberateFail: never steer; the funnel drifts to the wall and the users churn
      }
      const r = await waitResult();
      return { game, kind, ...r };
    }
    if (deliberateFail) {
      // do nothing; wait for timeout fail
      const r = await waitResult();
      return { game, ...r };
    }
    if (game === 'drive') {
      // Drive auto-wins mid-hold; also from L2 a stall car requires releasing when
      // its "!" warning shows, waiting for it to clear, then re-holding.
      await page.keyboard.down('Space');
      for (let t = 0; t < 60; t++) {
        const st = await page.evaluate(() => ({
          res: !document.getElementById('hw-result').classList.contains('hw-hidden'),
          warn: (() => { const w = document.querySelector('.hw-stall-warn'); return w && w.getAttribute('opacity') === '1'; })()
        }));
        if (st.res) break;
        if (st.warn) {
          await page.keyboard.up('Space');
          await page.waitForTimeout(650); // stall car notices you stopped, clears
          await page.keyboard.down('Space');
        }
        await page.waitForTimeout(120);
      }
      await page.keyboard.up('Space');
      const passed = await page.evaluate(() => document.getElementById('hw-result-word').classList.contains('hw-pass'));
      const flavor = await page.evaluate(() => document.getElementById('hw-result-flavor').textContent);
      await page.waitForFunction(() => document.getElementById('hw-result').classList.contains('hw-hidden'), { timeout: 6000 });
      return { game, passed, flavor };
    } else if (game === 'publish') {
      for (const t of await page.$$('.hw-toggle')) await t.dispatchEvent('pointerdown');
    } else if (game === 'weird') {
      // Aim at the pulsing ring — clicks now need real coordinates, not just any hit.
      for (let i = 0; i < 16; i++) {
        const done = await page.evaluate(() => !document.getElementById('hw-result').classList.contains('hw-hidden'));
        if (done) break;
        const pt = await page.evaluate(() => {
          const svg = document.getElementById('hw-w-frame'), ring = document.getElementById('hw-w-ring');
          if (!svg || !ring) return null;
          const r = svg.getBoundingClientRect();
          return {
            x: r.left + parseFloat(ring.getAttribute('cx')) / 200 * r.width,
            y: r.top + parseFloat(ring.getAttribute('cy')) / 110 * r.height
          };
        });
        if (!pt) break;
        await page.mouse.click(pt.x, pt.y);
        await page.waitForTimeout(70);
      }
    } else if (game === 'ship') {
      // From L2 the real button lands after a delay (and L3 shows a decoy first) — wait for it,
      // and retry the press until the result shows (guards a rare dispatch/creation race).
      await page.waitForSelector('#hw-ship-btn', { timeout: 4000 });
      for (let i = 0; i < 8; i++) {
        const done = await page.evaluate(() => !document.getElementById('hw-result').classList.contains('hw-hidden'));
        if (done) break;
        const btn = await page.$('#hw-ship-btn');
        if (btn) await btn.dispatchEvent('pointerdown');
        await page.waitForTimeout(150);
      }
    } else if (game === 'aim') {
      // Press-to-stop slider: watch the position and press as it approaches the band.
      const info = await page.evaluate(() => {
        const r = document.getElementById('hw-rink');
        return { band: parseFloat(r.dataset.band), speed: parseFloat(r.dataset.speed) };
      });
      const lead = Math.max(2, info.speed * 0.055); // compensate poll+keypress latency
      for (let t = 0; t < 400; t++) {
        const st = await page.evaluate(() => {
          const r = document.getElementById('hw-rink');
          return {
            pos: r ? parseFloat(r.dataset.pos || '0') : 0,
            dir: r ? parseFloat(r.dataset.dir || '1') : 1,
            res: !document.getElementById('hw-result').classList.contains('hw-hidden')
          };
        });
        if (st.res) break;
        const approach = (info.band - st.pos) * st.dir; // >0 while closing in
        if (approach > 0 && approach < lead) { await page.keyboard.press('Space'); break; }
        await page.waitForTimeout(12);
      }
    }
    const r = await waitResult();
    return { game, ...r };
  }

  // --- determinism check: first game today is stable across reloads ---
  await page.click('#hw-start');
  const firstA = await waitForScene();
  log('3 Max life icons render (NES count)', await page.evaluate(() =>
    document.querySelectorAll('#hw-hud-lives .hw-life').length === 3 &&
    document.querySelector('.hw-life').complete && document.querySelector('.hw-life').naturalWidth > 0));
  await page.reload();
  await page.waitForTimeout(400);
  await page.click('#hw-start');
  const firstB = await waitForScene();
  log('daily seed: same first game across reloads', firstA === firstB, firstA + ' / ' + firstB);

  // --- deliberately fail game 1: run must CONTINUE with a life lost ---
  const f = await playOne(true);
  log('deliberate fail does not end the run', true, f.game + ' failed: ' + f.flavor);
  log('fail flavor mentions lives left', /li(fe|ves) left/.test(f.flavor), f.flavor);
  const livesAfterFail = await page.evaluate(() =>
    3 - document.querySelectorAll('#hw-hud-lives .hw-life-lost').length);
  log('one Max icon dimmed after fail', livesAfterFail === 2, 'lives=' + livesAfterFail);
  const gameoverHidden = await page.evaluate(() => document.getElementById('hw-gameover').classList.contains('hw-hidden'));
  log('gameover NOT shown after single fail', gameoverHidden);

  // --- play the remaining 4 games of loop 1 properly ---
  const played = new Set([f.game]);
  for (let i = 0; i < 4; i++) {
    const r = await playOne(false);
    played.add(r.game);
    log('cleared ' + r.game, r.passed, r.flavor);
  }
  log('all 5 distinct games seen despite the fail', played.size === 5, [...played].join(','));

  // --- BOSS after the 5th game: RUN THE QUERY, clearing it restores a life ---
  const boss = await playOne(false);
  log('boss appears after loop 1', boss.game === 'boss', boss.game + ':' + boss.kind);
  log('boss cleared (' + boss.kind + ')', boss.passed, boss.flavor);
  const livesAfterBoss = await page.evaluate(() =>
    3 - document.querySelectorAll('#hw-hud-lives .hw-life-lost').length);
  log('boss restored the lost life', livesAfterBoss === 3, 'lives=' + livesAfterBoss);

  // --- loop 1 done: LEVEL UP! announcement, then loop 2 runs at L2 ---
  const announceWord = await page.waitForFunction(
    () => !document.getElementById('hw-quote').classList.contains('hw-hidden') &&
          document.getElementById('hw-announce-word').textContent, { timeout: 6000 }
  ).then(() => page.textContent('#hw-announce-word'), () => '');
  log('LEVEL UP! announced after loop 1', announceWord === 'LEVEL UP!', announceWord);

  let l2games = 0;
  for (let i = 0; i < 5; i++) {
    const r = await playOne(false);
    log('L2 ' + r.game, r.passed, r.flavor);
    if (r.passed) l2games++;
  }
  const lvl = await page.evaluate(() => document.getElementById('hw-stage').dataset.level);
  log('loop 2 ran at difficulty level 2', lvl === '2', 'data-level=' + lvl);
  log('all 5 games clearable at L2 configs', l2games === 5, l2games + '/5');

  // --- burn remaining lives to reach gameover (gameover-aware: stop early if already dead) ---
  for (let i = 0; i < 4; i++) {
    const dead = await page.evaluate(() => !document.getElementById('hw-gameover').classList.contains('hw-hidden'));
    if (dead) break;
    await playOne(true);
  }
  await page.waitForFunction(() => !document.getElementById('hw-gameover').classList.contains('hw-hidden'), { timeout: 12000 });
  log('gameover after final life lost', true);

  const trail = await page.textContent('#hw-trail');
  log('emoji trail rendered with day number', /HogWare #\d+/.test(trail) && trail.includes('🟥'), trail.trim());
  const score = parseInt(await page.textContent('#hw-final-score'), 10);
  log('score >= 4 (cleared 4 games)', score >= 4, 'score=' + score);

  // --- copy result ---
  await page.click('#hw-copy');
  const copyOk = await page.waitForFunction(
    () => /COPIED/.test(document.getElementById('hw-copy').textContent), { timeout: 3000 }
  ).then(() => true, () => false);
  log('copy button gives feedback', copyOk, await page.textContent('#hw-copy'));

  // --- submit + replay ---
  await page.fill('#hw-initials', 'CHL');
  await page.click('#hw-submit');
  const note = await page.textContent('#hw-submitted-note');
  log('submit with analytics off shows honest note', note.includes('notrack'), note);
  await page.click('#hw-again');
  const again = await waitForScene();
  log('play again restarts (same daily seed)', again === firstA, 'first game: ' + again);
  const livesReset = await page.evaluate(() =>
    document.querySelectorAll('#hw-hud-lives .hw-life-lost').length === 0);
  log('lives reset on new run', livesReset);

  log('zero console/page errors', errors.length === 0, errors.slice(0, 3).join(' | '));

  await browser.close();
  const failed = results.filter(r => !r.ok);
  console.log('\n' + (failed.length ? failed.length + ' FAILURES' : 'ALL ' + results.length + ' CHECKS PASSED'));
  process.exit(failed.length ? 1 : 0);
})().catch(e => { console.error('SMOKE CRASHED:', e.message); process.exit(2); });
