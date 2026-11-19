// Tepicas · minijuegos libres (partidas ilimitadas, récord personal y comparación del día)
import { $, show, h, store, api, track, isTouch, CATALOG } from '/app.js';

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const rnd = (a, b) => a + Math.floor(Math.random() * (b - a + 1));
const shuffle = (a) => { for (let i = a.length - 1; i > 0; i--) { const j = rnd(0, i); [a[i], a[j]] = [a[j], a[i]]; } return a; };
const tap = isTouch ? 'pointerdown' : 'click';

// Cada juego recibe el escenario y devuelve una promesa con la puntuación.
const GAMES = {
  async dianas(stage) {
    stage.className = 'stage arena';
    const counter = h('p', { class: 'stage-hud' }, '0/20');
    stage.replaceChildren(counter);
    const t0 = performance.now();
    for (let i = 0; i < 20; i++) {
      const r = stage.getBoundingClientRect();
      const size = 56;
      const dot = h('button', { class: 'target', 'aria-label': 'Diana' });
      dot.style.left = rnd(8, Math.max(8, r.width - size - 8)) + 'px';
      dot.style.top = rnd(40, Math.max(40, r.height - size - 8)) + 'px';
      stage.append(dot);
      await new Promise((res) => dot.addEventListener('pointerdown', (e) => { e.preventDefault(); res(); }, { once: true }));
      dot.remove();
      counter.textContent = `${i + 1}/20`;
    }
    return Math.round(performance.now() - t0);
  },

  async secuencia(stage) {
    stage.className = 'stage';
    const hud = h('p', { class: 'stage-hud' }, 'Nivel 1');
    const cells = Array.from({ length: 9 }, () => h('button', { class: 'cell', 'aria-label': 'Casilla' }));
    stage.replaceChildren(hud, h('div', { class: 'grid9' }, cells));
    const seq = [];
    for (let level = 1; ; level++) {
      hud.textContent = `Nivel ${level} · mira`;
      seq.push(rnd(0, 8));
      cells.forEach((c) => (c.disabled = true));
      await sleep(600);
      for (const i of seq) { cells[i].classList.add('lit'); await sleep(420); cells[i].classList.remove('lit'); await sleep(180); }
      hud.textContent = `Nivel ${level} · repite`;
      cells.forEach((c) => (c.disabled = false));
      for (let k = 0; k < seq.length; k++) {
        const idx = await new Promise((res) => cells.forEach((c, i) => (c.onpointerdown = (e) => { e.preventDefault(); res(i); })));
        cells[idx].classList.add(idx === seq[k] ? 'ok' : 'bad');
        setTimeout(() => cells[idx].classList.remove('ok', 'bad'), 200);
        if (idx !== seq[k]) { cells.forEach((c) => (c.onpointerdown = null)); await sleep(400); return level - 1; }
      }
      cells.forEach((c) => (c.onpointerdown = null));
      if (level >= 40) return 40;
    }
  },

  async calculo(stage) {
    stage.className = 'stage';
    const hud = h('p', { class: 'stage-hud' }, '30 s · 0 aciertos');
    const q = h('p', { class: 'question' });
    const opts = h('div', { class: 'options' });
    stage.replaceChildren(hud, q, opts);
    const end = performance.now() + 30000;
    let ok = 0;
    const timer = setInterval(() => (hud.textContent = `${Math.max(0, Math.ceil((end - performance.now()) / 1000))} s · ${ok} aciertos`), 200);
    while (performance.now() < end) {
      const op = rnd(0, 2);
      let a, b, res;
      if (op === 0) { a = rnd(5, 60); b = rnd(5, 60); res = a + b; q.textContent = `${a} + ${b}`; }
      else if (op === 1) { a = rnd(20, 90); b = rnd(1, a); res = a - b; q.textContent = `${a} − ${b}`; }
      else { a = rnd(2, 12); b = rnd(2, 12); res = a * b; q.textContent = `${a} × ${b}`; }
      const set = new Set([res]);
      while (set.size < 4) set.add(Math.max(0, res + rnd(-10, 10)));
      const btns = shuffle([...set]).map((v) => h('button', { class: 'btn opt' }, String(v)));
      opts.replaceChildren(...btns);
      const pick = await Promise.race([
        new Promise((r) => btns.forEach((bt) => bt.addEventListener(tap, (e) => { e.preventDefault(); r(Number(bt.textContent)); }, { once: true }))),
        sleep(Math.max(0, end - performance.now())).then(() => null),
      ]);
      if (pick === null) break;
      if (pick === res) ok++; else { stage.classList.add('shake'); setTimeout(() => stage.classList.remove('shake'), 250); }
    }
    clearInterval(timer);
    return Math.min(ok, 60);
  },

  async numeros(stage) {
    stage.className = 'stage';
    const hud = h('p', { class: 'stage-hud' });
    const show_ = h('p', { class: 'question mono' });
    const form = h('form', { class: 'form num-form' },
      h('input', { name: 'n', inputmode: 'numeric', autocomplete: 'off', pattern: '[0-9]*', 'aria-label': 'Número' }),
      h('button', { class: 'btn primary' }, 'Comprobar'));
    stage.replaceChildren(hud, show_, form);
    for (let n = 3; n <= 25; n++) {
      const num = String(rnd(1, 9)) + Array.from({ length: n - 1 }, () => rnd(0, 9)).join('');
      hud.textContent = `${n} cifras · memoriza`;
      show_.textContent = num; show(show_); show(form, false);
      await sleep(1000 + n * 450);
      show(show_, false); show(form); form.n.value = ''; form.n.focus();
      hud.textContent = `${n} cifras · escríbelo`;
      const val = await new Promise((r) => (form.onsubmit = (e) => { e.preventDefault(); r(form.n.value.trim()); }));
      if (val !== num) { hud.textContent = `Era ${num}`; await sleep(1200); return n - 1 < 3 ? 0 : n - 1; }
    }
    return 25;
  },

  async colores(stage) {
    stage.className = 'stage';
    const C = [['ROJO', '#ff4d5e'], ['AZUL', '#4d8dff'], ['VERDE', '#2fd06f'], ['AMARILLO', '#ffd23f']];
    const hud = h('p', { class: 'stage-hud' }, '30 s · 0 aciertos');
    const word = h('p', { class: 'question word' });
    const btns = C.map(([name]) => h('button', { class: 'btn opt' }, name));
    stage.replaceChildren(hud, h('p', { class: 'hint center' }, 'Toca el COLOR de la tinta'), word, h('div', { class: 'options' }, btns));
    const end = performance.now() + 30000;
    let ok = 0;
    const timer = setInterval(() => (hud.textContent = `${Math.max(0, Math.ceil((end - performance.now()) / 1000))} s · ${ok} aciertos`), 200);
    while (performance.now() < end) {
      const w = rnd(0, 3);
      let ink = rnd(0, 3);
      if (ink === w && Math.random() < 0.75) ink = (ink + rnd(1, 3)) % 4;
      word.textContent = C[w][0]; word.style.color = C[ink][1];
      const pick = await Promise.race([
        new Promise((r) => btns.forEach((bt, i) => (bt[tap === 'click' ? 'onclick' : 'onpointerdown'] = (e) => { e.preventDefault(); r(i); }))),
        sleep(Math.max(0, end - performance.now())).then(() => null),
      ]);
      if (pick === null) break;
      if (pick === ink) ok++; else { stage.classList.add('shake'); setTimeout(() => stage.classList.remove('shake'), 250); }
    }
    clearInterval(timer);
    return Math.min(ok, 60);
  },
};

export async function pageGame() {
  const slug = document.body.dataset.game;
  const meta = CATALOG.find((g) => g.slug === slug);
  const bestKey = 'tp_best_' + slug;
  const best = store.get(bestKey);
  if (best) $('#g-best').textContent = 'Tu récord: ' + meta.fmt(Number(best));
  const idx = CATALOG.findIndex((g) => g.slug === slug);
  const next = CATALOG[(idx + 1) % CATALOG.length];
  $('#g-next').href = '/juegos/' + next.slug;
  $('#g-next').textContent = 'Siguiente: ' + next.title;

  $('#g-start').onclick = async () => {
    show($('#g-intro'), false); show($('#g-more'), false);
    const stage = $('#g-stage');
    show(stage);
    stage.scrollIntoView({ block: 'start' });
    const score = await GAMES[slug](stage);
    show(stage, false);
    const prev = store.get(bestKey);
    const isRecord = prev == null || (meta.lower ? score < Number(prev) : score > Number(prev));
    if (isRecord) store.set(bestKey, String(score));
    $('#g-score').textContent = meta.fmt(score);
    $('#g-record').textContent = isRecord ? (prev == null ? 'Primera marca' : '¡Nuevo récord personal!') : 'Tu récord: ' + meta.fmt(Number(prev));
    show($('#g-end')); show($('#g-more'));
    $('#g-end').scrollIntoView({ block: 'start' });
    const url = `${location.origin}/juegos/${slug}`;
    const text = `He hecho ${meta.fmt(score)} en ${meta.title} de Tepicas. ¿Me superas?`;
    $('#g-share').onclick = () => {
      if (navigator.share && isTouch) navigator.share({ text, url }).then(() => track('result_share')).catch(() => {});
      else { window.open('https://wa.me/?text=' + encodeURIComponent(`${text} ${url}`), '_blank', 'noopener'); track('result_share'); }
    };
    try {
      const r = await api('/score', { method: 'POST', body: { game: slug, score } });
      $('#g-global').textContent = r.players > 1
        ? `Mejor que el ${r.beat} % de los ${r.players} jugadores de hoy · Récord de hoy: ${meta.fmt(r.record)}`
        : 'Eres el primero en jugar a esto hoy.';
    } catch { $('#g-global').textContent = ''; }
  };
  $('#g-again').onclick = () => location.reload(); // nueva partida = nueva página, a petición del usuario
}
