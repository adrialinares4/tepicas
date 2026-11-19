// Panel privado de medición
const $ = (s) => document.querySelector(s);
let token = sessionStorage.getItem('tp_admin') || '';

function h(tag, cls, text) {
  const el = document.createElement(tag);
  if (cls) el.className = cls;
  if (text != null) el.textContent = text;
  return el;
}
const fmtPct = (v) => (v == null ? '—' : v.toLocaleString('es-ES') + ' %');

async function get(path) {
  const res = await fetch('/api' + path, { headers: { authorization: 'Bearer ' + token } });
  if (!res.ok) throw Object.assign(new Error((await res.json().catch(() => ({}))).message || 'Error ' + res.status), { status: res.status });
  return res;
}

function kpi(label, value, extra, state) {
  const k = h('div', 'kpi' + (state ? ' ' + state : ''));
  k.append(h('div', 'v', value), h('div', 'l', label));
  if (extra) k.append(h('div', 'l', extra));
  return k;
}

function table(rows, cols) {
  if (!rows.length) return h('p', 'sub', 'Sin datos todavía.');
  const t = h('table');
  const tr = h('tr');
  cols.forEach(([, label]) => tr.append(h('th', null, label)));
  t.append(tr);
  rows.forEach((r) => {
    const row = h('tr');
    cols.forEach(([key, , f]) => row.append(h('td', null, f ? f(r[key], r) : r[key] ?? '—')));
    t.append(row);
  });
  return t;
}

async function load() {
  const s = await (await get('/admin/stats')).json();
  $('#a-day').textContent = 'Hoy: ' + s.day;
  const g = s.gate;
  const st = (x) => (x.value == null ? null : x.value >= x.target ? 'ok' : 'ko');
  $('#gate').replaceChildren(
    kpi('Vuelve al día 2 (cohortes cerradas)', fmtPct(g.day2.value), `${g.day2.returned} de ${g.day2.eligible} · objetivo ≥${g.day2.target} %`, st(g.day2)),
    kpi('Ligas con 5+ jugadores', fmtPct(g.leagues5.value), `${g.leagues5.big} de ${g.leagues5.leagues} · objetivo ≥${g.leagues5.target} %`, st(g.leagues5)),
    kpi('Jugadores que comparten', fmtPct(g.share.value), `${g.share.sharers} de ${g.share.players} · objetivo ≥${g.share.target} %`, st(g.share)),
  );
  const se = s.sessions;
  $('#sess').replaceChildren(
    kpi('Sesiones', se.sessions), kpi('Páginas vistas', se.pageviews),
    kpi('Páginas por sesión', se.pagesPerSession ?? '—'), kpi('Duración media', se.avgSeconds != null ? se.avgSeconds + ' s' : '—'),
  );
  $('#games').replaceChildren(table(s.games, [['game', 'Juego'], ['players', 'Jugadores'], ['runs', 'Partidas']]));
  $('#paths').replaceChildren(table(s.topPaths, [['path', 'Página'], ['n', 'Vistas']]));
  const t = s.totals;
  $('#totals').replaceChildren(
    kpi('Visitantes únicos', t.visitors), kpi('Jugadores', t.players), kpi('Partidas', t.plays), kpi('Ligas', t.leagues),
    kpi('Miembros en ligas', t.members), kpi('Invitaciones enviadas', t.invite_shares), kpi('Invitaciones abiertas', t.invite_opens),
    kpi('Resultados compartidos', t.result_shares),
  );
  const max = Math.max(1, ...Object.values(s.leagueSizes));
  $('#sizes').replaceChildren(...Object.entries(s.leagueSizes).map(([k, v]) => {
    const row = h('div', 'bar'); const bar = h('i'); bar.style.width = (v / max) * 100 + '%';
    const wrap = h('div'); wrap.append(bar);
    row.append(h('span', null, k), wrap, h('span', null, String(v)));
    return row;
  }));
  $('#cohorts').replaceChildren(table([...s.cohorts].reverse(), [
    ['day', 'Primer día'], ['new_players', 'Nuevos'], ['returned_day2', 'Vuelven día 2'], ['pct_day2', '%', fmtPct], ['status', 'Estado'],
  ]));
  $('#daily').replaceChildren(table([...s.daily].reverse(), [
    ['day', 'Día'], ['visitors', 'Visitantes'], ['players', 'Jugadores'], ['new_players', 'Nuevos'], ['leagues_created', 'Ligas creadas'],
    ['joins', 'Uniones'], ['invite_shares', 'Invit. enviadas'], ['invite_opens', 'Invit. abiertas'], ['result_shares', 'Compartidos'],
  ]));
  $('#leagues').replaceChildren(table([...s.leagues].sort((a, b) => b.members - a.members), [
    ['code', 'Código'], ['name', 'Nombre'], ['created_day', 'Creada'], ['members', 'Miembros'], ['members_played', 'Han jugado'],
  ]));
  $('#login').classList.add('hidden');
  $('#panel').classList.remove('hidden');
}

async function tryLoad() {
  try { await load(); }
  catch (e) {
    $('#login').classList.remove('hidden'); $('#panel').classList.add('hidden');
    $('#login-err').textContent = e.message;
    if (e.status === 401) { sessionStorage.removeItem('tp_admin'); token = ''; }
  }
}

$('#login-form').onsubmit = (e) => {
  e.preventDefault();
  token = e.target.token.value.trim();
  sessionStorage.setItem('tp_admin', token);
  tryLoad();
};
$('#logout').onclick = () => { sessionStorage.removeItem('tp_admin'); location.reload(); };
document.querySelectorAll('[data-csv]').forEach((b) => (b.onclick = async () => {
  try {
    const res = await get('/admin/csv?kind=' + b.dataset.csv);
    const name = (res.headers.get('content-disposition') || '').match(/filename="([^"]+)"/)?.[1] || b.dataset.csv + '.csv';
    const a = document.createElement('a');
    a.href = URL.createObjectURL(await res.blob()); a.download = name;
    document.body.append(a); a.click(); a.remove();
  } catch (e) { alert(e.message); }
}));
if (token) tryLoad();
