// Prueba de los minijuegos libres en navegador móvil (node test/games.e2e.mjs)
import assert from 'node:assert/strict';
import pw from 'playwright';
const { chromium, devices } = pw;
const { startServer } = await import('./server.mjs');
const PORT = 8796, BASE = `http://localhost:${PORT}`;
const { server, env } = await startServer({ port: PORT });
const browser = await chromium.launch();
const c = await browser.newContext({ ...devices['Pixel 7'] });
await c.addInitScript(() => { localStorage.tp_age = '1'; });
const p = await c.newPage();
const errors = [];
p.on('pageerror', (e) => errors.push(e.message));
p.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
const results = {};
try {
  await p.goto(BASE + '/');
  await p.waitForSelector('.js-games .game-tile');
  assert.equal(await p.locator('#crear').count(), 1);
  assert.equal(await p.locator('.js-games .game-tile').count(), 6);

  // ¿Qué fue antes?: 5 aciertos y un fallo
  await p.goto(BASE + '/juegos/antes');
  await p.click('#g-start');
  for (let i = 0; i < 6; i++) {
    await p.waitForFunction((i) => document.querySelector('.stage-hud')?.textContent === `Racha: ${i}` && document.querySelectorAll('.vs-card:not([disabled])').length === 2, i);
    const idx = await p.evaluate(async (wrong) => {
      const { ITEMS } = await import('/antes-data.js');
      const y = Object.fromEntries(ITEMS);
      const [a, b] = [...document.querySelectorAll('.vs-card')].map((x) => y[x.textContent]);
      const right = a < b ? 0 : 1;
      return wrong ? 1 - right : right;
    }, i === 5);
    await p.locator('.vs-card').nth(idx).dispatchEvent('pointerdown');
  }
  await p.waitForSelector('#g-end:not(.hidden)');
  results.antes = await p.textContent('#g-score');
  assert.equal(results.antes, 'racha de 5');
  await p.waitForFunction(() => document.querySelector('#g-global').textContent.length > 0);

  // Caza dianas
  await p.goto(BASE + '/juegos/dianas');
  await p.click('#g-start');
  for (let i = 0; i < 20; i++) { await p.waitForSelector('.target'); await p.waitForTimeout(150); await p.locator('.target').dispatchEvent('pointerdown'); }
  await p.waitForSelector('#g-end:not(.hidden)');
  results.dianas = await p.textContent('#g-score');
  await p.waitForFunction(() => document.querySelector('#g-global').textContent.length > 0);

  // Memoria visual: lee la secuencia iluminada y la repite 3 niveles; luego falla
  await p.goto(BASE + '/juegos/secuencia');
  await p.evaluate(() => {
    window.__seq = [];
    new MutationObserver((ms) => ms.forEach((m) => { const el = m.target; if (el.classList.contains('lit')) window.__seq.push([...el.parentNode.children].indexOf(el)); }))
      .observe(document.getElementById('g-stage'), { attributes: true, subtree: true, attributeFilter: ['class'] });
  });
  await p.click('#g-start');
  for (let level = 1; level <= 4; level++) {
    await p.waitForFunction((l) => document.querySelector('.stage-hud')?.textContent === `Nivel ${l} · repite`, level);
    const seq = await p.evaluate((l) => window.__seq.slice(-l), level);
    const play = level <= 3 ? seq : [(seq[0] + 1) % 9];
    for (const i of play) await p.locator('.cell').nth(i).dispatchEvent('pointerdown');
  }
  await p.waitForSelector('#g-end:not(.hidden)');
  results.secuencia = await p.textContent('#g-score');
  assert.equal(results.secuencia, 'nivel 3');

  // Memoria de números: acierta 3 y 4 cifras, falla 5
  await p.goto(BASE + '/juegos/numeros');
  await p.click('#g-start');
  for (const n of [3, 4, 5]) {
    await p.waitForFunction((n) => document.querySelector('.stage-hud')?.textContent === `${n} cifras · memoriza`, n);
    const num = await p.textContent('.question');
    await p.waitForSelector('.num-form:not(.hidden)');
    await p.fill('.num-form input', n < 5 ? num : '0');
    await p.click('.num-form button');
  }
  await p.waitForSelector('#g-end:not(.hidden)', { timeout: 10000 });
  results.numeros = await p.textContent('#g-score');
  assert.equal(results.numeros, '4 cifras');

  // Cálculo rápido: resuelve 12 y deja correr el tiempo
  await p.goto(BASE + '/juegos/calculo');
  await p.click('#g-start');
  for (let i = 0; i < 12; i++) {
    const q = await p.textContent('.question');
    const [a, op, b] = q.split(' ');
    const r = op === '+' ? +a + +b : op === '−' ? a - b : a * b;
    await p.locator('.options .btn', { hasText: new RegExp(`^${r}$`) }).first().dispatchEvent('pointerdown');
    await p.waitForFunction((q) => document.querySelector('.question')?.textContent !== q, q).catch(() => {});
  }
  await p.waitForSelector('#g-end:not(.hidden)', { timeout: 40000 });
  results.calculo = await p.textContent('#g-score');
  assert.ok(/^1[2-9]|^[2-9]\d/.test(results.calculo) || results.calculo.startsWith('12'), results.calculo);

  // Colores locos: acierta 10 por el color de la tinta
  await p.goto(BASE + '/juegos/colores');
  await p.click('#g-start');
  const MAP = { 'rgb(255, 77, 94)': 0, 'rgb(77, 141, 255)': 1, 'rgb(47, 208, 111)': 2, 'rgb(255, 210, 63)': 3 };
  for (let i = 0; i < 10; i++) {
    const before = await p.evaluate(() => { const w = document.querySelector('.word'); return w.textContent + getComputedStyle(w).color; });
    const color = await p.evaluate(() => getComputedStyle(document.querySelector('.word')).color);
    await p.locator('.options .btn').nth(MAP[color]).dispatchEvent('pointerdown');
    await p.waitForFunction((b) => { const w = document.querySelector('.word'); return w.textContent + getComputedStyle(w).color !== b; }, before, { timeout: 2000 }).catch(() => {});
  }
  await p.waitForSelector('#g-end:not(.hidden)', { timeout: 40000 });
  results.colores = await p.textContent('#g-score');
  assert.ok(Number(results.colores.split(' ')[0]) >= 9, results.colores);
  await p.screenshot({ path: new URL('../test-results/juego-fin.png', import.meta.url).pathname, fullPage: true });
  assert.match(await p.textContent('#g-global'), /primero en jugar/);
  assert.match(await p.getAttribute('#g-next', 'href'), /\/juegos\/antes$/);

  // Récords en la portada y medición
  await p.goto(BASE + '/');
  await p.waitForSelector('.tile-best');
  assert.equal(await p.locator('.tile-best').count(), 6);
  await p.screenshot({ path: new URL('../test-results/hub.png', import.meta.url).pathname, fullPage: true });
  const pv = env.DB.raw.prepare('SELECT COUNT(*) n, COUNT(DISTINCT session_id) s FROM pageviews').get();
  const sc = env.DB.raw.prepare('SELECT COUNT(*) n FROM scores').get();
  assert.equal(pv.s, 1);
  assert.ok(pv.n >= 7, 'páginas vistas: ' + pv.n);
  assert.equal(sc.n, 6);
  assert.deepEqual(errors.filter((e) => !/ERR_|googlesyndication/.test(e)), []);
  console.log('JUEGOS OK', JSON.stringify(results), 'páginas vistas', pv.n);
} finally { await browser.close(); server.close(); }
