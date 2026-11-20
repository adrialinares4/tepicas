
import assert from 'node:assert/strict';
import { mkdirSync, readFileSync } from 'node:fs';

import pw from 'playwright';
const { chromium, devices } = pw;
const { startServer } = await import('./server.mjs');

const PORT = 8790, BASE = `http://localhost:${PORT}`, TOKEN = 'local-admin-token-123456';
const SHOTS = new URL('../test-results', import.meta.url).pathname; mkdirSync(SHOTS, { recursive: true });
const { server } = await startServer({ port: PORT });
const browser = await chromium.launch();
const errors = [];
const phone = { ...devices['iPhone 13'], defaultBrowserType: undefined };
delete phone.defaultBrowserType;

async function ctx(name) {
  const c = await browser.newContext({ ...phone, userAgent: devices['Pixel 7'].userAgent });
  await c.addInitScript(() => {
    window.__shares = []; window.__opens = [];
    navigator.canShare = () => true;
    navigator.share = async (d) => { window.__shares.push({ text: d.text, url: d.url, files: (d.files || []).map((f) => [f.name, f.type, f.size]) }); };
    window.open = (u) => { window.__opens.push(u); return null; };
  });
  const p = await c.newPage();
  p.on('console', (m) => m.type() === 'error' && errors.push(`${name}: ${m.text()}`));
  p.on('pageerror', (e) => errors.push(`${name}: ${e.message}`));
  return p;
}
const shot = (p, n) => p.screenshot({ path: `${SHOTS}/${n}.png`, fullPage: true });

async function playGame(p, plan) {
  // plan[i]: 'early' (toca antes), número = espera en ms tras el verde, 'instant' = toque sintético inmediato
  await p.click('#start');
  for (let i = 0; i < 5; i++) {
    let mode = plan[i];
    if (mode === 'early') {
      await p.waitForSelector('#zone.wait');
      await p.touchscreen.tap(195, 300);
      await p.waitForSelector('#zone.early');
      assert.equal(await p.textContent('#zone-msg'), '¡Demasiado pronto!');
      mode = 220;
    }
    // toque sintético dentro de la página: 'instant' = 0 ms tras el verde, número = ms tras el verde
    const after = mode === 'instant' ? 0 : mode;
    await p.waitForSelector('#zone.wait');
    await p.evaluate((after) => new Promise((res) => {
      const z = document.getElementById('zone');
      const ob = new MutationObserver(() => {
        if (!z.classList.contains('go')) return;
        ob.disconnect();
        setTimeout(() => { z.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true })); res(); }, after);
      });
      ob.observe(z, { attributes: true, attributeFilter: ['class'] });
    }), after);
    await p.waitForSelector('#zone.shown');
  }
  await p.waitForSelector('#result:not(.hidden)');
}

try {
  // ---------- Jugador A: crea liga ----------
  const a = await ctx('A');
  await a.goto(BASE + '/');
  await a.waitForSelector('.gate');
  await shot(a, '01-gate');
  await a.click('#age-yes');
  await a.fill('#create-form [name=name]', 'Los putos amos');
  await a.fill('#create-form [name=nickname]', 'Adri');
  await a.click('#create-form button');
  await a.waitForFunction(() => document.querySelector('#create-err').textContent.length > 0);
  assert.match(await a.textContent('#create-err'), /no está permitido/);
  await a.fill('#create-form [name=name]', '1ºB Bachillerato');
  await shot(a, '02-home');
  await a.click('#create-form button');
  await a.waitForURL(/\/l\/[A-Z0-9]{6}$/);
  const code = a.url().split('/').pop();
  await a.waitForSelector('#lg-invite.glow');
  assert.equal(await a.textContent('#lg-name'), '1ºB Bachillerato');
  assert.equal(await a.title(), '1ºB Bachillerato · Tepicas');
  await shot(a, '03-liga-creada');
  await a.click('#invite-btn');
  const inv = await a.evaluate(() => window.__shares[0]);
  assert.equal(inv.url, `${BASE}/l/${code}`);
  await a.click('#lg-play');
  await a.waitForURL(/\/reflejos$/);
  await a.waitForSelector('#intro:not(.hidden)');
  await shot(a, '04-intro');
  const playA = playGame(a, ['early', 230, 250, 240, 260]);
  await a.waitForSelector('#zone.wait'); await shot(a, '05-espera');
  await playA;
  const avgA = Number(await a.textContent('#r-avg'));
  assert.ok(avgA >= 230 && avgA <= 290, 'media A ≈ 245 + 1 frame: ' + avgA);
  await a.waitForSelector('#r-leagues-card:not(.hidden)');
  assert.match(await a.textContent('#r-leagues'), /1\.º/);
  await a.waitForTimeout(400); // imagen preparada
  await shot(a, '06-resultado');
  await a.click('#share-result');
  const shareA = await a.evaluate(() => window.__shares.at(-1));
  assert.equal(shareA.files.length, 1);
  assert.equal(shareA.files[0][1], 'image/png');
  assert.ok(shareA.files[0][2] > 20000);
  assert.match(shareA.text, new RegExp(`${avgA} ms.*l/${code}`));
  // segunda visita: no deja jugar otra vez
  await a.reload();
  await a.waitForSelector('#result:not(.hidden)');
  assert.ok(await a.isHidden('#intro'));
  // tarjeta: capturar la imagen generada
  const png = await a.evaluate(async () => {
    const { leagues } = await (await fetch('/api/me/leagues', { headers: { 'x-device': localStorage.tp_dev } })).json();
    return leagues.length;
  });
  assert.equal(png, 1);

  // ---------- Jugador B: se une por enlace ----------
  const b = await ctx('B');
  const og = await (await fetch(`${BASE}/l/${code}`)).text();
  assert.ok(og.includes('<title>Únete a «1ºB Bachillerato» en Tepicas</title>'));
  await b.goto(`${BASE}/l/${code}`);
  await b.click('#age-yes');
  await b.waitForSelector('#lg-join:not(.hidden)');
  await shot(b, '07-invitacion');
  await b.fill('#join-form [name=nickname]', 'adri');
  await b.click('#join-form button');
  await b.waitForFunction(() => document.querySelector('#join-err').textContent.includes('cogido'));
  await b.fill('#join-form [name=nickname]', 'Marta');
  await b.click('#join-form button');
  await b.waitForSelector('#lg-play:not(.hidden)');
  assert.match(await b.textContent('#lg-count'), /2 jugadores · tú: Marta/);
  await b.click('#lg-play');
  await b.waitForSelector('#intro:not(.hidden)');
  await playGame(b, ['instant', 'instant', 200, 210, 220]);
  const att = await b.$$eval('#r-attempts li', (l) => l.map((x) => [x.className, x.textContent]));
  assert.deepEqual(att.slice(0, 2).map((x) => x[0]), ['bad', 'bad']);
  assert.ok(att.slice(2).every((x) => x[0] === ''));
  await b.waitForTimeout(300);
  await shot(b, '08-resultado-descartes');

  // ---------- Clasificaciones ----------
  await a.goto(`${BASE}/l/${code}`);
  await a.waitForSelector('#rank-day li:nth-child(2)');
  const rank = await a.$$eval('#rank-day li', (l) => l.map((x) => x.querySelector('.nick').textContent));
  assert.equal(rank.length, 2);
  await a.click('[data-tab=week]');
  await a.waitForSelector('#tab-week:not(.hidden)');
  const week = await a.$$eval('#rank-week li .val', (l) => l.map((x) => x.textContent));
  assert.ok(week[0].startsWith('10 pts') && week[1].startsWith('8 pts'), week.join('|'));
  await shot(a, '09-semana');
  await a.click('[data-tab=day]');
  await shot(a, '10-hoy');

  // ---------- Panel ----------
  const adm = await (await browser.newContext({ acceptDownloads: true, viewport: { width: 1200, height: 900 } })).newPage();
  adm.on('pageerror', (e) => errors.push('admin: ' + e.message));
  await adm.goto(BASE + '/admin');
  await adm.fill('[name=token]', 'malo');
  await adm.click('#login-form button');
  await adm.waitForFunction(() => document.querySelector('#login-err').textContent.length > 0);
  await adm.fill('[name=token]', TOKEN);
  await adm.click('#login-form button');
  await adm.waitForSelector('#panel:not(.hidden)');
  const totals = await adm.$$eval('#totals .kpi', (k) => Object.fromEntries(k.map((x) => [x.querySelectorAll('.l')[0].textContent, x.querySelector('.v').textContent])));
  assert.equal(totals['Jugadores'], '2');
  assert.equal(totals['Ligas'], '1');
  assert.equal(totals['Visitantes únicos'], '2');
  assert.equal(totals['Invitaciones enviadas'], '1');
  assert.equal(totals['Invitaciones abiertas'], '1');
  assert.equal(totals['Resultados compartidos'], '1');
  await adm.screenshot({ path: `${SHOTS}/11-panel.png`, fullPage: true });
  const [dl] = await Promise.all([adm.waitForEvent('download'), adm.click('[data-csv=daily]')]);
  const csv = readFileSync(await dl.path(), 'utf8');
  assert.match(dl.suggestedFilename(), /^tepicas-daily-\d{4}-\d{2}-\d{2}\.csv$/);
  assert.match(csv, /day,visitors,players,new_players,leagues_created,joins,invite_shares,invite_opens,result_shares\n\d{4}-\d{2}-\d{2},2,2,2,1,1,1,1,1/);
  const [dl2] = await Promise.all([adm.waitForEvent('download'), adm.click('[data-csv=plays]')]);
  const plays = readFileSync(await dl2.path(), 'utf8');
  assert.equal(plays.trim().split('\n').length, 3);

  // privacidad
  await b.goto(BASE + '/privacidad');
  const id = await b.textContent('#my-id');
  assert.match(id, /^[0-9a-f-]{36}$/);
  await shot(b, '12-privacidad');

  assert.deepEqual(errors.filter((e) => !/status of (400|409)|ERR_|googlesyndication/.test(e)), []); // 400/409 = rechazos esperados (palabrota, apodo cogido)
  console.log('E2E OK · liga', code, '· media A', avgA, '· intentos B', att.map((x) => x[1]).join(' '));
} finally {
  await browser.close();
  server.close();
}
