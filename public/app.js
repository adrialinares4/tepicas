// Tepicas · cliente (sin dependencias)
const $ = (s, el = document) => el.querySelector(s);
const show = (el, on = true) => el && el.classList.toggle('hidden', !on);
function h(tag, attrs = {}, ...kids) {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (v == null || v === false) continue;
    if (k === 'class') el.className = v; else el.setAttribute(k, v === true ? '' : v);
  }
  for (const k of kids.flat()) if (k != null && k !== false) el.append(k);
  return el;
}

// ---------- almacenamiento y ID anónimo ----------
const mem = {};
const store = {
  get: (k) => { try { return localStorage.getItem(k); } catch { return mem[k] ?? null; } },
  set: (k, v) => { try { localStorage.setItem(k, v); } catch { mem[k] = v; } },
};
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
function uuid() {
  if (crypto.randomUUID) return crypto.randomUUID();
  const b = crypto.getRandomValues(new Uint8Array(16));
  b[6] = (b[6] & 15) | 64; b[8] = (b[8] & 63) | 128;
  const x = [...b].map((n) => n.toString(16).padStart(2, '0')).join('');
  return `${x.slice(0, 8)}-${x.slice(8, 12)}-${x.slice(12, 16)}-${x.slice(16, 20)}-${x.slice(20)}`;
}
let DEV = store.get('tp_dev');
if (!DEV || !UUID.test(DEV)) { DEV = uuid(); store.set('tp_dev', DEV); }

async function api(path, { method = 'GET', body, keepalive } = {}) {
  let res;
  try {
    res = await fetch('/api' + path, {
      method, keepalive,
      headers: { 'x-device': DEV, ...(body ? { 'content-type': 'application/json' } : {}) },
      body: body ? JSON.stringify(body) : undefined,
    });
  } catch { throw new Error('Sin conexión. Inténtalo de nuevo.'); }
  const data = res.status === 204 ? null : await res.json().catch(() => null);
  if (!res.ok) throw Object.assign(new Error(data?.message || 'Algo ha fallado'), { status: res.status, code: data?.error });
  return data;
}
const track = (type, code) => api('/event', { method: 'POST', body: { type, code }, keepalive: true }).catch(() => {});

// ---------- utilidades ----------
const madridDay = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Madrid' }).format(new Date());
const dayLabel = (day, opts = { weekday: 'long', day: 'numeric', month: 'short' }) =>
  new Intl.DateTimeFormat('es-ES', { ...opts, timeZone: 'UTC' }).format(new Date(day + 'T12:00:00Z'));
const ord = (n) => n + '.º';
function verdict(ms) {
  if (ms == null) return 'Sin puntuación: necesitas al menos 3 intentos válidos.';
  if (ms < 180) return 'Reflejos de portero. Brutal.';
  if (ms < 230) return 'Muy rápido. Difícil de ganar.';
  if (ms < 280) return 'Bien. Pero se puede mejorar.';
  if (ms < 350) return 'Normalito. Mañana más.';
  return '¿Recién levantado?';
}
function globalLine(gl) {
  if (!gl || !gl.players) return '';
  if (gl.players === 1) return 'Eres el primero en jugar hoy. Reta a alguien.';
  const best = gl.best != null ? ` · Récord de hoy: ${gl.best} ms` : '';
  return gl.beat != null ? `Más rápido que el ${gl.beat} % de los ${gl.players} jugadores de hoy${best}` : `${gl.players} jugadores hoy${best}`;
}
const leagueUrl = (code) => `${location.origin}/l/${code}`;
const isTouch = matchMedia('(pointer: coarse)').matches;

async function shareLink({ title, text, url }) {
  if (navigator.share && isTouch) {
    try { await navigator.share({ title, text, url }); return true; } catch (e) { if (e.name === 'AbortError') return false; }
  }
  window.open('https://wa.me/?text=' + encodeURIComponent(`${text} ${url}`), '_blank', 'noopener');
  return true;
}

// ---------- catálogo de juegos ----------
export const CATALOG = [
  { slug: 'dianas', title: 'Caza dianas', desc: 'Toca 20 dianas lo más rápido posible', lower: true, fmt: (v) => (v / 1000).toFixed(2).replace('.', ',') + ' s' },
  { slug: 'secuencia', title: 'Memoria visual', desc: 'Repite la secuencia que se ilumina', fmt: (v) => `nivel ${v}` },
  { slug: 'calculo', title: 'Cálculo rápido', desc: 'Cuántas operaciones aciertas en 30 s', fmt: (v) => `${v} aciertos` },
  { slug: 'numeros', title: 'Memoria de números', desc: 'Recuerda números cada vez más largos', fmt: (v) => `${v} cifras` },
  { slug: 'colores', title: 'Colores locos', desc: 'Toca el color de la tinta, no la palabra', fmt: (v) => `${v} aciertos` },
];
export function renderGameGrid(el, exclude) {
  el.replaceChildren(...CATALOG.filter((g) => g.slug !== exclude).map((g) => {
    const best = store.get('tp_best_' + g.slug);
    return h('a', { class: 'game-tile', href: '/juegos/' + g.slug },
      h('b', {}, g.title), h('small', {}, g.desc), best ? h('span', { class: 'tile-best' }, 'Tu récord: ' + g.fmt(Number(best))) : null);
  }));
}

// ---------- páginas vistas (sin cookies; sesión = 30 min de inactividad) ----------
function trackPageview() {
  const now = Date.now();
  let sid = store.get('tp_sid');
  if (!sid || now - Number(store.get('tp_sid_t') || 0) > 30 * 60 * 1000) {
    sid = Array.from(crypto.getRandomValues(new Uint8Array(8)), (b) => b.toString(16).padStart(2, '0')).join('');
    store.set('tp_sid', sid);
  }
  store.set('tp_sid_t', String(now));
  const path = location.pathname.replace(/\/$/, '') || '/';
  api('/pv', { method: 'POST', body: { sid, path }, keepalive: true }).catch(() => {});
}

// ---------- puerta de edad (+14) ----------
function ageGate() {
  if (store.get('tp_age') === '1') return Promise.resolve();
  return new Promise((resolve) => {
    const msg = h('p', { class: 'sub' }, 'Sin registro ni cookies. Guardamos un ID anónimo en tu dispositivo para tus ligas y resultados. ', h('a', { href: '/privacidad' }, 'Privacidad'));
    const yes = h('button', { class: 'btn primary big', id: 'age-yes' }, 'Tengo 14 años o más');
    const no = h('button', { class: 'btn ghost' }, 'Tengo menos de 14');
    const box = h('div', { class: 'gate-box', role: 'dialog', 'aria-modal': 'true', 'aria-labelledby': 'gate-t' },
      h('span', { class: 'logo' }, 'tepicas', h('span', {}, '.')), h('h2', { id: 'gate-t' }, 'Tepicas es para mayores de 14 años'), msg, yes, no);
    const gate = h('div', { class: 'gate' }, box);
    yes.onclick = () => { store.set('tp_age', '1'); gate.remove(); resolve(); };
    no.onclick = () => { box.replaceChildren(h('h2', {}, 'Lo sentimos'), h('p', { class: 'sub' }, 'Tepicas es solo para mayores de 14 años. ¡Vuelve cuando los cumplas!')); };
    document.body.append(gate);
    yes.focus();
  });
}

// ---------- tarjeta de resultado (imagen para compartir) ----------
function drawCard({ avg, attempts, discarded, day, league, inviteUrl, gl }) {
  const W = 1080, H = 1350;
  const c = document.createElement('canvas');
  c.width = W; c.height = H;
  const g = c.getContext('2d');
  const F = 'ui-rounded, "SF Pro Rounded", system-ui, -apple-system, "Segoe UI", Roboto, sans-serif';
  g.fillStyle = '#0d0e12'; g.fillRect(0, 0, W, H);
  const grad = g.createRadialGradient(W * 0.85, 120, 40, W * 0.85, 120, 700);
  grad.addColorStop(0, 'rgba(212,255,58,0.22)'); grad.addColorStop(1, 'rgba(212,255,58,0)');
  g.fillStyle = grad; g.fillRect(0, 0, W, H);
  g.textBaseline = 'alphabetic';
  g.fillStyle = '#f3f4f6'; g.font = `900 64px ${F}`; g.fillText('tepicas', 80, 140);
  const lw = g.measureText('tepicas').width;
  g.fillStyle = '#d4ff3a'; g.fillText('.', 80 + lw, 140);
  g.fillStyle = '#9aa0ab'; g.font = `700 38px ${F}`;
  g.fillText(('Reto de reflejos · ' + dayLabel(day, { weekday: 'short', day: 'numeric', month: 'short' })).toUpperCase(), 80, 260);
  if (avg != null) {
    g.fillStyle = '#d4ff3a'; g.font = `900 300px ${F}`; g.fillText(String(avg), 70, 560);
    const w = g.measureText(String(avg)).width;
    g.fillStyle = '#f3f4f6'; g.font = `800 96px ${F}`; g.fillText('ms', 90 + w, 560);
  } else {
    g.fillStyle = '#d4ff3a'; g.font = `900 120px ${F}`; g.fillText('Sin nota', 80, 520);
  }
  g.fillStyle = '#f3f4f6'; g.font = `700 46px ${F}`; g.fillText(verdict(avg), 80, 650);
  // barras de los 5 intentos
  const max = Math.max(400, ...attempts);
  attempts.forEach((ms, i) => {
    const y = 730 + i * 70, bw = Math.max(12, (ms / max) * 640);
    g.fillStyle = discarded.includes(i) ? '#ff6b7d' : '#262932';
    g.beginPath(); g.roundRect(80, y, bw, 44, 10); g.fill();
    g.fillStyle = '#c9ccd3'; g.font = `700 34px ${F}`; g.fillText(discarded.includes(i) ? `${ms} ms ✕` : `${ms} ms`, 100 + bw, y + 34);
  });
  const foot = league?.pos ? `${ord(league.pos)} de ${league.played} en ${league.name}`.slice(0, 40)
    : gl?.beat != null && gl.players >= 10 ? `Más rápido que el ${gl.beat} % de hoy` : '';
  if (foot) { g.fillStyle = '#f3f4f6'; g.font = `800 52px ${F}`; g.fillText(foot, 80, 1150); }
  g.fillStyle = '#d4ff3a'; g.beginPath(); g.roundRect(80, 1195, W - 160, 96, 48); g.fill();
  g.fillStyle = '#0d0e12'; g.font = `800 40px ${F}`;
  const t = '¿Me ganas? ' + inviteUrl.replace(/^https?:\/\//, '');
  g.fillText(t, (W - g.measureText(t).width) / 2, 1257);
  return new Promise((res) => c.toBlob(res, 'image/png'));
}

// ---------- páginas ----------
function renderLeagueList(ul, leagues) {
  ul.replaceChildren(...leagues.map((l) =>
    h('li', {}, h('a', { href: '/l/' + l.code },
      h('span', {}, h('b', {}, l.name), h('small', {}, `${l.members} ${l.members === 1 ? 'jugador' : 'jugadores'} · tú: ${l.nickname}`)),
      l.pos
        ? h('span', { class: 'li-side' }, ord(l.pos), h('small', {}, `de ${l.played} hoy`))
        : h('span', { class: 'li-side todo' }, l.played ? `${l.played} ya han jugado` : 'Nadie ha jugado')))));
}

async function pageHome() {
  const [t, my] = await Promise.all([api('/today'), api('/me/leagues')]);
  if (t.mine) {
    $('#my-ms').textContent = t.mine.avg != null ? `${t.mine.avg} ms` : 'sin puntuación';
    show($('#played')); $('#play-btn').textContent = 'Ver mi resultado';
  }
  if (t.global?.players >= 20) $('#players-today').textContent = `${t.global.players} personas han jugado hoy`;
  if (my.leagues.length) { show($('#my-leagues')); renderLeagueList($('#league-list'), my.leagues); }
  const form = $('#create-form');
  form.nickname.value = store.get('tp_nick') || '';
  if (location.hash === '#crear') form.name.focus();
  form.onsubmit = async (e) => {
    e.preventDefault();
    const btn = form.querySelector('button'); btn.disabled = true; $('#create-err').textContent = '';
    try {
      const r = await api('/leagues', { method: 'POST', body: { name: form.name.value, nickname: form.nickname.value, ageOk: true } });
      store.set('tp_nick', r.nickname); store.set('tp_last_league', r.code);
      location.href = `/l/${r.code}?nueva=1`;
    } catch (err) { $('#create-err').textContent = err.message; btn.disabled = false; }
  };
}

async function pageLeague() {
  const code = (location.pathname.split('/')[2] || '').toUpperCase();
  const isNew = new URLSearchParams(location.search).has('nueva');
  if (isNew) history.replaceState(null, '', '/l/' + code);
  let lg, t;
  try { [lg, t] = await Promise.all([api('/leagues/' + code), api('/today')]); }
  catch (e) {
    if (e.status === 404) { show($('#lg-head'), false); show($('#lg-404')); return; }
    throw e;
  }
  const url = leagueUrl(code);
  const render = () => {
    document.title = `${lg.name} · Tepicas`;
    $('#lg-code').textContent = code;
    $('#lg-name').textContent = lg.name;
    $('#lg-count').textContent = `${lg.members} ${lg.members === 1 ? 'jugador' : 'jugadores'}` + (lg.me ? ` · tú: ${lg.me.nickname}` : '');
    show($('#lg-join'), !lg.me);
    show($('#lg-play'), !!lg.me && !t.mine);
    show($('#lg-invite'), !!lg.me);
    show($('#lg-rank'));
    const rd = $('#rank-day');
    rd.replaceChildren(...(lg.daily.length
      ? lg.daily.map((r) => h('li', { class: r.me ? 'me' : null }, h('span', { class: 'pos' }, r.pos), h('span', { class: 'nick' }, r.nick), h('span', { class: 'val' }, `${r.ms} ms`)))
      : [h('li', { class: 'empty' }, 'Nadie ha jugado hoy todavía. ¡Sé el primero!')]));
    const waiting = [...lg.pending, ...lg.noScore];
    $('#pending').textContent = waiting.length ? 'Aún sin nota hoy: ' + waiting.map((p) => p.nick + (p.me ? ' (tú)' : '')).join(', ') : '';
    $('#rank-week').replaceChildren(...lg.weekly.map((r) => h('li', { class: r.me ? 'me' : null },
      h('span', { class: 'pos' }, r.pos), h('span', { class: 'nick' }, r.nick),
      h('span', { class: 'val' }, `${r.points} pts`, h('small', {}, `${r.days} ${r.days === 1 ? 'día' : 'días'}${r.avg ? ' · ' + r.avg + ' ms' : ''}`)))));
  };
  render();
  $('#invite-url').textContent = url.replace(/^https?:\/\//, '');
  if (lg.me) store.set('tp_last_league', code);
  if (isNew) {
    $('#invite-title').textContent = 'Liga creada. Ahora pásala al grupo';
    $('#lg-invite').classList.add('glow');
    $('#lg-head').after($('#lg-invite'));
  }
  if (!lg.me && !store.get('tp_open_' + code)) { store.set('tp_open_' + code, '1'); track('invite_open', code); }

  const inviteText = `Te reto en Tepicas: reflejos, 30 segundos al día. Liga «${lg.name}»`;
  $('#invite-btn').onclick = async () => { if (await shareLink({ title: 'Tepicas', text: inviteText, url })) track('invite_share', code); };
  $('#copy-btn').onclick = async () => {
    try { await navigator.clipboard.writeText(url); $('#copy-btn').textContent = '¡Copiado!'; track('invite_share', code); }
    catch { $('#copy-btn').textContent = url; }
  };
  document.querySelectorAll('.tabs button').forEach((b) => (b.onclick = () => {
    document.querySelectorAll('.tabs button').forEach((x) => x.setAttribute('aria-selected', String(x === b)));
    show($('#tab-day'), b.dataset.tab === 'day'); show($('#tab-week'), b.dataset.tab === 'week');
  }));
  const form = $('#join-form');
  form.nickname.value = store.get('tp_nick') || '';
  form.onsubmit = async (e) => {
    e.preventDefault();
    const btn = form.querySelector('button'); btn.disabled = true; $('#join-err').textContent = '';
    try {
      const r = await api(`/leagues/${code}/join`, { method: 'POST', body: { nickname: form.nickname.value, ageOk: true } });
      store.set('tp_nick', r.nickname); store.set('tp_last_league', code);
      lg = await api('/leagues/' + code);
      render();
    } catch (err) { $('#join-err').textContent = err.message; }
    btn.disabled = false;
  };
}

async function pageReflejos() {
  const t = await api('/today');
  if (t.mine) return showResult(t, t.mine);
  show($('#intro'));
  $('#start').onclick = () => { show($('#intro'), false); runGame(t); };
}

function runGame(t) {
  const zone = $('#zone');
  const times = [];
  let i = 0, state = 'idle', timer = 0, t0 = 0;
  document.body.classList.add('playing');
  show(zone);
  const set = (cls, msg, sub = '') => {
    zone.className = 'zone ' + cls;
    $('#zone-n').textContent = i < 5 ? `INTENTO ${i + 1}/5` : '';
    $('#zone-msg').textContent = msg; $('#zone-sub').textContent = sub;
  };
  const arm = () => { state = 'wait'; set('wait', 'Espera…', 'Toca cuando se ponga verde'); timer = setTimeout(go, t.delays[i]); };
  const go = () => {
    state = 'go'; t0 = performance.now(); set('go', '¡YA!');
    requestAnimationFrame((ts) => { if (ts > t0) t0 = ts; }); // instante del siguiente frame (pintado)
  };
  const tap = (stamp) => {
    if (state === 'wait') {
      clearTimeout(timer); state = 'early'; set('early', '¡Demasiado pronto!', 'Repetimos este intento');
      setTimeout(arm, 1300);
    } else if (state === 'go') {
      const ms = Math.max(0, Math.round(stamp - t0));
      times.push(ms); state = 'shown';
      set('shown', `${ms} ms`, ms < 100 ? 'Demasiado rápido: no cuenta' : '');
      i += 1;
      setTimeout(i < 5 ? arm : finish, 1000);
    }
  };
  zone.addEventListener('pointerdown', (e) => { e.preventDefault(); tap(e.timeStamp); });
  const onKey = (e) => { if ((e.code === 'Space' || e.code === 'Enter') && !e.repeat) { e.preventDefault(); tap(e.timeStamp); } };
  document.addEventListener('keydown', onKey);
  document.addEventListener('visibilitychange', () => {
    if (document.hidden && (state === 'wait' || state === 'go')) { clearTimeout(timer); state = 'paused'; }
    else if (!document.hidden && state === 'paused') arm();
  });
  async function finish() {
    state = 'sending'; set('sending', 'Calculando…');
    try {
      const r = await api('/play', { method: 'POST', body: { day: t.day, attempts: times } });
      document.removeEventListener('keydown', onKey);
      show(zone, false); document.body.classList.remove('playing');
      showResult(t, r);
    } catch (err) {
      state = 'error'; set('error', 'Uy', err.message);
      const b = $('#retry'); show(b); b.onclick = () => { show(b, false); finish(); };
    }
  }
  arm();
}

async function showResult(t, r) {
  show($('#intro'), false); show($('#result'));
  const big = $('#r-big');
  if (r.avg != null) $('#r-avg').textContent = r.avg;
  else { big.classList.add('none'); big.textContent = 'Sin puntuación'; }
  $('#r-verdict').textContent = verdict(r.avg);
  const gl = r.global || t.global;
  const glText = globalLine(gl);
  $('#r-global').textContent = glText;
  $('#r-attempts').replaceChildren(...r.attempts.map((ms, i) =>
    h('li', { class: r.discarded.includes(i) ? 'bad' : null, title: r.discarded.includes(i) ? 'Descartado (<100 ms)' : null }, ms, h('small', {}, r.discarded.includes(i) ? 'no cuenta' : 'ms'))));
  let left = t.nextIn;
  const tick = () => {
    const s = Math.max(0, left--);
    $('#r-next').textContent = [s / 3600, (s % 3600) / 60, s % 60].map((x) => String(Math.floor(x)).padStart(2, '0')).join(':');
    if (s === 0) location.reload();
  };
  tick(); setInterval(tick, 1000);

  const { leagues } = await api('/me/leagues').catch(() => ({ leagues: [] }));
  if (leagues.length) { show($('#r-leagues-card')); renderLeagueList($('#r-leagues'), leagues); }
  else show($('#r-noleague'));
  const last = store.get('tp_last_league');
  const league = leagues.find((l) => l.code === last) || leagues[0] || null;
  const inviteUrl = league ? leagueUrl(league.code) : `${location.origin}/reflejos`;
  const text = r.avg != null
    ? `Hoy he hecho ${r.avg} ms en el reto de reflejos de Tepicas${league?.pos ? ` (${ord(league.pos)} de ${league.played} en «${league.name}»)` : gl?.beat != null && gl.players >= 10 ? ` (más rápido que el ${gl.beat} % de hoy)` : ''}. ¿Me ganas?`
    : 'Hoy me he quedado sin nota en el reto de reflejos de Tepicas. ¿Lo haces mejor?';
  // la imagen se prepara antes del toque: iOS exige llamar a share() dentro del gesto
  let file = null;
  drawCard({ ...r, day: r.day || t.day, league, inviteUrl, gl }).then((blob) => { if (blob) file = new File([blob], `tepicas-${t.day}.png`, { type: 'image/png' }); });
  $('#share-result').onclick = async () => {
    if (file && isTouch && navigator.canShare?.({ files: [file] })) {
      try { await navigator.share({ files: [file], text: `${text} ${inviteUrl}` }); track('result_share', league?.code); return; }
      catch (e) { if (e.name === 'AbortError') return; }
    }
    window.open('https://wa.me/?text=' + encodeURIComponent(`${text} ${inviteUrl}`), '_blank', 'noopener');
    track('result_share', league?.code);
  };
}

function pagePrivacy() { $('#my-id').textContent = DEV; }

// ---------- arranque ----------
const pageGame = async () => (await import('/games.js')).pageGame();
const PAGES = { home: pageHome, liga: pageLeague, reflejos: pageReflejos, privacidad: pagePrivacy, juego: pageGame };
(async () => {
  document.querySelectorAll('.js-day').forEach((el) => (el.textContent = dayLabel(madridDay())));
  const page = document.body.dataset.page;
  if (page === 'privacidad') return pagePrivacy();
  await ageGate();
  const today = madridDay();
  if (store.get('tp_visit') !== today) { store.set('tp_visit', today); track('visit'); }
  trackPageview();
  document.querySelectorAll('.js-games').forEach((el) => renderGameGrid(el, document.body.dataset.game));
  try { await PAGES[page]?.(); }
  catch (e) {
    console.error(e);
    $('main').prepend(h('section', { class: 'card' }, h('h2', {}, 'Algo ha fallado'), h('p', { class: 'sub' }, e.message), h('button', { class: 'btn', onclick: null, id: 'reload' }, 'Recargar')));
    $('#reload').onclick = () => location.reload();
  }
})();

export { $, show, h, store, api, track, isTouch };
