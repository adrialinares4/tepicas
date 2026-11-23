import {
  ATTEMPTS, WEEK_POINTS, addDays, cleanLeagueName, cleanNick, dayOf, delaysFor, newCode,
  nowMs, scoreAttempts, secondsIntoDay, weekStart,
} from './lib.js';
import { isProfane } from './profanity.js';
import { GAMES } from './games.js';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
const EVENT_TYPES = new Set(['visit', 'invite_open', 'invite_share', 'result_share']);
const MAX_MEMBERS = 100;
const MAX_LEAGUES_PER_DAY = 10;
const GRACE_SECONDS = 15 * 60; // tras medianoche se acepta aún el reto de ayer

class HttpError extends Error {
  constructor(status, code, message) { super(message); this.status = status; this.code = code; }
}
const fail = (status, code, message) => { throw new HttpError(status, code, message); };
const json = (data, status = 200) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' },
  });

async function body(request) {
  const text = await request.text();
  if (text.length > 4000) fail(413, 'too_large', 'Petición demasiado grande');
  try { return JSON.parse(text || '{}'); } catch { fail(400, 'bad_json', 'JSON no válido'); }
}
const needDevice = (dev) => dev || fail(400, 'no_device', 'Falta el ID de dispositivo');

// Tablas añadidas después del primer despliegue: se crean solas en D1 (idempotente, una vez por instancia).
const schemaReady = new WeakMap();
function ensureSchema(db) {
  if (!schemaReady.has(db)) {
    schemaReady.set(db, db.batch([
      db.prepare(`CREATE TABLE IF NOT EXISTS sessions (session_id TEXT PRIMARY KEY, device_id TEXT NOT NULL, day TEXT NOT NULL,
        source TEXT NOT NULL, campaign TEXT NOT NULL DEFAULT '', landing TEXT NOT NULL, created_at INTEGER NOT NULL)`),
      db.prepare('CREATE INDEX IF NOT EXISTS idx_sessions_device ON sessions(device_id, created_at)'),
      db.prepare('CREATE INDEX IF NOT EXISTS idx_pv_device ON pageviews(device_id, day)'),
    ]).catch((e) => { schemaReady.delete(db); throw e; }));
  }
  return schemaReady.get(db);
}

export async function handleApi(request, env) {
  const url = new URL(request.url);
  const path = url.pathname.replace(/^\/api/, '').replace(/\/$/, '') || '/';
  const method = request.method;
  const rawDev = (request.headers.get('x-device') || '').toLowerCase();
  const dev = UUID.test(rawDev) ? rawDev : null;
  const now = nowMs(env);
  const ctx = { env, db: env.DB, dev, now, day: dayOf(now) };
  let m;
  try {
    if (path === '/today' && method === 'GET') return json(await today(ctx));
    if (path === '/play' && method === 'POST') return json(await play(ctx, await body(request)));
    if (path === '/leagues' && method === 'POST') return json(await createLeague(ctx, await body(request)), 201);
    if ((m = path.match(/^\/leagues\/([a-z0-9]{6})$/i)) && method === 'GET') return json(await getLeague(ctx, m[1].toUpperCase()));
    if ((m = path.match(/^\/leagues\/([a-z0-9]{6})\/join$/i)) && method === 'POST')
      return json(await joinLeague(ctx, m[1].toUpperCase(), await body(request)));
    if (path === '/me/leagues' && method === 'GET') return json(await myLeagues(ctx));
    if (path === '/score' && method === 'POST') return json(await score(ctx, await body(request)));
    if (path === '/pv' && method === 'POST') { await pageview(ctx, await body(request)); return new Response(null, { status: 204 }); }
    if (path === '/event' && method === 'POST') { await event(ctx, await body(request)); return new Response(null, { status: 204 }); }
    if (path.startsWith('/admin/')) {
      checkAdmin(request, env);
      if (path === '/admin/stats' && method === 'GET') return json(await stats(ctx));
      if (path === '/admin/csv' && method === 'GET') return csvResponse(await exportCsv(ctx, url.searchParams.get('kind')), url.searchParams.get('kind'), ctx.day);
    }
    return json({ error: 'not_found', message: 'No encontrado' }, 404);
  } catch (e) {
    if (e instanceof HttpError) return json({ error: e.code, message: e.message }, e.status);
    console.error(e);
    return json({ error: 'server', message: 'Error del servidor' }, 500);
  }
}

// ---------- juego ----------
async function today({ db, dev, now, day }) {
  let mine = null;
  if (dev) {
    const r = await db.prepare('SELECT avg_ms, attempts FROM plays WHERE device_id = ? AND day = ?').bind(dev, day).first();
    if (r) mine = { attempts: JSON.parse(r.attempts), ...scoreAttempts(JSON.parse(r.attempts)) };
  }
  const global = await globalStats(db, day, mine?.avg);
  return { day, weekStart: weekStart(day), delays: delaysFor(day), nextIn: 86400 - secondsIntoDay(now), mine, global };
}

// Comparación con todos los jugadores del día (sin nombres).
async function globalStats(db, day, avg) {
  const r = await db
    .prepare('SELECT COUNT(*) AS total, MIN(avg_ms) AS best, SUM(avg_ms > ?) AS slower FROM plays WHERE day = ? AND avg_ms IS NOT NULL')
    .bind(avg ?? 0, day).first();
  const total = r.total || 0;
  const beat = avg != null && total > 1 ? Math.round(((r.slower || 0) / (total - 1)) * 100) : null;
  return { players: total, best: r.best ?? null, beat };
}

async function play({ db, dev, now, day }, b) {
  needDevice(dev);
  const yesterday = addDays(day, -1);
  if (b.day !== day && !(b.day === yesterday && secondsIntoDay(now) < GRACE_SECONDS))
    fail(400, 'bad_day', 'El reto ha cambiado. Recarga la página.');
  const a = b.attempts;
  if (!Array.isArray(a) || a.length !== ATTEMPTS || !a.every((x) => Number.isInteger(x) && x >= 0 && x <= 10000))
    fail(400, 'bad_attempts', 'Intentos no válidos');
  const s = scoreAttempts(a);
  const r = await db
    .prepare('INSERT INTO plays (device_id, day, avg_ms, attempts, valid_count, created_at) VALUES (?, ?, ?, ?, ?, ?) ON CONFLICT DO NOTHING')
    .bind(dev, b.day, s.avg, JSON.stringify(a), s.validCount, now).run();
  if (r.meta.changes === 0) {
    const old = await db.prepare('SELECT attempts FROM plays WHERE device_id = ? AND day = ?').bind(dev, b.day).first();
    const oa = JSON.parse(old.attempts);
    const os = scoreAttempts(oa);
    return { day: b.day, attempts: oa, ...os, already: true, global: await globalStats(db, b.day, os.avg) };
  }
  return { day: b.day, attempts: a, ...s, already: false, global: await globalStats(db, b.day, s.avg) };
}

// ---------- ligas ----------
function validateNames(b, withLeague) {
  if (b.ageOk !== true) fail(400, 'age', 'Tepicas es solo para mayores de 14 años');
  const nickname = cleanNick(b.nickname);
  if (!nickname) fail(400, 'bad_nick', 'Apodo: 2–16 letras o números');
  if (isProfane(nickname)) fail(400, 'profane_nick', 'Ese apodo no está permitido');
  let name = null;
  if (withLeague) {
    name = cleanLeagueName(b.name);
    if (!name) fail(400, 'bad_name', 'Nombre de liga: 3–30 caracteres, sin símbolos raros');
    if (isProfane(name)) fail(400, 'profane_name', 'Ese nombre de liga no está permitido');
  }
  return { nickname, name };
}

async function createLeague({ db, dev, now, day }, b) {
  needDevice(dev);
  const { nickname, name } = validateNames(b, true);
  const n = await db.prepare('SELECT COUNT(*) AS n FROM leagues WHERE creator_device = ? AND day = ?').bind(dev, day).first('n');
  if (n >= MAX_LEAGUES_PER_DAY) fail(429, 'too_many', 'Has creado demasiadas ligas hoy');
  for (let i = 0; i < 5; i++) {
    const code = newCode();
    const row = await db
      .prepare('INSERT INTO leagues (code, name, creator_device, day, created_at) VALUES (?, ?, ?, ?, ?) ON CONFLICT DO NOTHING RETURNING id')
      .bind(code, name, dev, day, now).first();
    if (!row) continue;
    await db.prepare("INSERT INTO members (league_id, device_id, nickname, role, day, joined_at) VALUES (?, ?, ?, 'owner', ?, ?)")
      .bind(row.id, dev, nickname, day, now).run();
    return { code, name, nickname };
  }
  fail(500, 'code', 'No se pudo generar el código');
}

const leagueByCode = (db, code) => db.prepare('SELECT id, code, name FROM leagues WHERE code = ?').bind(code).first();

async function joinLeague({ db, dev, now, day }, code, b) {
  needDevice(dev);
  const lg = await leagueByCode(db, code);
  if (!lg) fail(404, 'no_league', 'Esa liga no existe');
  const existing = await db.prepare('SELECT nickname FROM members WHERE league_id = ? AND device_id = ?').bind(lg.id, dev).first();
  if (existing) return { code, nickname: existing.nickname, already: true };
  const { nickname } = validateNames(b, false);
  const count = await db.prepare('SELECT COUNT(*) AS n FROM members WHERE league_id = ?').bind(lg.id).first('n');
  if (count >= MAX_MEMBERS) fail(409, 'full', 'La liga está llena');
  const r = await db
    .prepare("INSERT INTO members (league_id, device_id, nickname, role, day, joined_at) VALUES (?, ?, ?, 'member', ?, ?) ON CONFLICT DO NOTHING")
    .bind(lg.id, dev, nickname, day, now).run();
  if (r.meta.changes === 0) fail(409, 'nick_taken', 'Ese apodo ya está cogido en esta liga');
  return { code, nickname, already: false };
}

function rankDay(rows) {
  return rows
    .filter((r) => r.avg_ms != null)
    .sort((a, b) => a.avg_ms - b.avg_ms || a.created_at - b.created_at);
}

export function buildRankings(rows, dev, day, wkStart) {
  // rows: un registro por miembro y día jugado (LEFT JOIN, day null si no jugó en la semana)
  const members = new Map();
  for (const r of rows) {
    if (!members.has(r.device_id)) members.set(r.device_id, { nick: r.nickname, me: r.device_id === dev, points: 0, days: 0, sum: 0, scored: 0 });
  }
  const byDay = new Map();
  for (const r of rows) if (r.day) (byDay.get(r.day) || byDay.set(r.day, []).get(r.day)).push(r);
  for (const [d, list] of byDay) {
    if (d < wkStart || d > day) continue;
    list.forEach((r) => (members.get(r.device_id).days += 1));
    rankDay(list).forEach((r, i) => {
      const m = members.get(r.device_id);
      m.points += WEEK_POINTS[i] ?? 1;
      m.sum += r.avg_ms; m.scored += 1;
    });
  }
  const todayList = byDay.get(day) || [];
  const daily = rankDay(todayList).map((r, i) => ({ pos: i + 1, nick: r.nickname, ms: r.avg_ms, me: r.device_id === dev }));
  const played = new Set(todayList.map((r) => r.device_id));
  const noScore = todayList.filter((r) => r.avg_ms == null).map((r) => ({ nick: r.nickname, me: r.device_id === dev }));
  const pending = [...members].filter(([id]) => !played.has(id)).map(([, m]) => ({ nick: m.nick, me: m.me }));
  const weekly = [...members.values()]
    .map((m) => ({ nick: m.nick, me: m.me, points: m.points, days: m.days, avg: m.scored ? Math.round(m.sum / m.scored) : null }))
    .sort((a, b) => b.points - a.points || (a.avg ?? 1e9) - (b.avg ?? 1e9) || a.nick.localeCompare(b.nick))
    .map((m, i) => ({ pos: i + 1, ...m }));
  return { daily, noScore, pending, weekly };
}

async function getLeague({ db, dev, day }, code) {
  const lg = await leagueByCode(db, code);
  if (!lg) fail(404, 'no_league', 'Esa liga no existe');
  const wk = weekStart(day);
  const { results } = await db
    .prepare(`SELECT m.device_id, m.nickname, p.day, p.avg_ms, p.created_at
              FROM members m LEFT JOIN plays p ON p.device_id = m.device_id AND p.day BETWEEN ? AND ?
              WHERE m.league_id = ? ORDER BY m.joined_at`)
    .bind(wk, day, lg.id).all();
  const me = results.find((r) => r.device_id === dev);
  return {
    code: lg.code, name: lg.name, day, weekStart: wk,
    members: new Set(results.map((r) => r.device_id)).size,
    me: me ? { nickname: me.nickname } : null,
    ...buildRankings(results, dev, day, wk),
  };
}

async function myLeagues({ db, dev, day }) {
  if (!dev) return { leagues: [] };
  const { results } = await db
    .prepare(`SELECT l.code, l.name, mine.nickname AS my_nick, mine.joined_at, m2.device_id, p.avg_ms, p.created_at
              FROM members mine JOIN leagues l ON l.id = mine.league_id
              JOIN members m2 ON m2.league_id = l.id
              LEFT JOIN plays p ON p.device_id = m2.device_id AND p.day = ?
              WHERE mine.device_id = ? ORDER BY mine.joined_at DESC`)
    .bind(day, dev).all();
  const map = new Map();
  for (const r of results) {
    if (!map.has(r.code)) map.set(r.code, { code: r.code, name: r.name, nickname: r.my_nick, members: 0, rows: [] });
    const lg = map.get(r.code);
    lg.members += 1;
    lg.rows.push(r);
  }
  return {
    leagues: [...map.values()].map(({ rows, ...lg }) => {
      const ranked = rankDay(rows);
      const pos = ranked.findIndex((r) => r.device_id === dev);
      return { ...lg, played: ranked.length, pos: pos >= 0 ? pos + 1 : null };
    }),
  };
}

// ---------- minijuegos libres ----------
async function score({ db, dev, now, day }, b) {
  needDevice(dev);
  const g = GAMES[b.game];
  if (!g) fail(400, 'bad_game', 'Juego no válido');
  const v = b.score;
  if (!Number.isInteger(v) || v < g.min || v > g.max) fail(400, 'bad_score', 'Puntuación no válida');
  const keep = g.lower ? 'MIN(best, excluded.best)' : 'MAX(best, excluded.best)';
  await db
    .prepare(`INSERT INTO scores (device_id, game, day, best, runs, updated_at) VALUES (?, ?, ?, ?, 1, ?)
              ON CONFLICT (device_id, game, day) DO UPDATE SET best = ${keep}, runs = runs + 1, updated_at = excluded.updated_at`)
    .bind(dev, b.game, day, v, now).run();
  const r = await db
    .prepare(`SELECT COUNT(*) AS total, ${g.lower ? 'MIN' : 'MAX'}(best) AS record, SUM(best ${g.lower ? '>' : '<'} ?) AS worse
              FROM scores WHERE game = ? AND day = ?`)
    .bind(v, b.game, day).first();
  const total = r.total || 0;
  return { score: v, players: total, record: r.record, beat: total > 1 ? Math.round(((r.worse || 0) / (total - 1)) * 100) : null };
}

async function pageview({ db, dev, now, day }, b) {
  needDevice(dev);
  if (typeof b.path !== 'string' || !/^\/[a-z0-9/_-]{0,60}$/i.test(b.path)) fail(400, 'bad_path', 'Ruta no válida');
  if (typeof b.sid !== 'string' || !/^[a-z0-9]{8,32}$/i.test(b.sid)) fail(400, 'bad_sid', 'Sesión no válida');
  if (b.src != null && (typeof b.src !== 'string' || !/^[a-z0-9._-]{1,40}$/.test(b.src))) fail(400, 'bad_src', 'Origen no válido');
  const path = b.path.replace(/^\/l\/[a-z0-9]{6}$/i, '/l/:code');
  await db.prepare('INSERT INTO pageviews (day, device_id, session_id, path, created_at) VALUES (?, ?, ?, ?, ?)')
    .bind(day, dev, b.sid, path, now).run();
  if (b.src != null) { // solo en la primera página de la sesión
    const cmp = typeof b.cmp === 'string' && /^[a-z0-9._-]{0,40}$/.test(b.cmp) ? b.cmp : '';
    await ensureSchema(db);
    await db.prepare('INSERT OR IGNORE INTO sessions (session_id, device_id, day, source, campaign, landing, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)')
      .bind(b.sid, dev, day, b.src, cmp, path, now).run();
  }
}

// Por origen del primer contacto: usuarios, páginas por usuario y vuelta al día 2 (cualquier visita).
async function sourcesTable(db, day) {
  await ensureSchema(db);
  const closed = addDays(day, -1);
  const { results } = await db
    .prepare(`SELECT f.source, COUNT(*) AS users,
                SUM((SELECT COUNT(*) FROM pageviews p WHERE p.device_id = f.device_id)) AS pageviews,
                SUM(f.day < ?) AS eligible,
                SUM(f.day < ? AND EXISTS (SELECT 1 FROM pageviews p WHERE p.device_id = f.device_id AND p.day = date(f.day, '+1 day'))) AS returned_day2
              FROM (SELECT device_id, source, day, MIN(created_at) AS t FROM sessions GROUP BY device_id) f
              GROUP BY f.source ORDER BY users DESC`)
    .bind(closed, closed).all();
  return results.map((r) => ({
    source: r.source, users: r.users, pageviews: r.pageviews ?? 0,
    pages_per_user: r.users ? Math.round(((r.pageviews ?? 0) / r.users) * 10) / 10 : null,
    eligible_day2: r.eligible ?? 0, returned_day2: r.returned_day2 ?? 0, pct_day2: pct(r.returned_day2 ?? 0, r.eligible ?? 0),
  }));
}

// ---------- medición ----------
async function event({ db, dev, now, day }, b) {
  needDevice(dev);
  if (!EVENT_TYPES.has(b.type)) fail(400, 'bad_event', 'Evento no válido');
  let leagueId = null;
  if (typeof b.code === 'string' && /^[a-z0-9]{6}$/i.test(b.code)) {
    const lg = await leagueByCode(db, b.code.toUpperCase());
    leagueId = lg ? lg.id : null;
  }
  await db.prepare('INSERT OR IGNORE INTO events (day, type, device_id, league_id, created_at) VALUES (?, ?, ?, ?, ?)')
    .bind(day, b.type, dev, leagueId, now).run();
}

function checkAdmin(request, env) {
  const token = env.ADMIN_TOKEN || '';
  if (token.length < 16) fail(503, 'no_admin_token', 'Configura ADMIN_TOKEN (mín. 16 caracteres)');
  const got = (request.headers.get('authorization') || '').replace(/^Bearer\s+/i, '');
  let diff = got.length ^ token.length;
  for (let i = 0; i < token.length; i++) diff |= token.charCodeAt(i) ^ (got.charCodeAt(i) || 0);
  if (diff !== 0) fail(401, 'unauthorized', 'Token incorrecto');
}

const pct = (a, b) => (b ? Math.round((a / b) * 1000) / 10 : null);
// Actividad = jugar el reto o un minijuego (cualquier día cuenta para la vuelta al día 2).
const ACTIVE = 'SELECT device_id, day FROM plays UNION SELECT device_id, day FROM scores';
const FIRST = `SELECT device_id, MIN(day) AS fd FROM (${ACTIVE}) GROUP BY device_id`;
const RETURNED = `EXISTS (SELECT 1 FROM (${ACTIVE}) p WHERE p.device_id = f.device_id AND p.day = date(f.fd, '+1 day'))`;

async function cohorts(db, day) {
  const { results } = await db
    .prepare(`SELECT f.fd AS day, COUNT(*) AS new_players, SUM(${RETURNED}) AS returned_day2 FROM (${FIRST}) f GROUP BY f.fd ORDER BY f.fd`)
    .all();
  return results.map((r) => ({
    ...r, returned_day2: r.returned_day2 ?? 0,
    status: r.day >= day ? 'día 1 en curso' : r.day === addDays(day, -1) ? 'día 2 en curso' : 'cerrada',
    pct_day2: r.day < addDays(day, -1) ? pct(r.returned_day2 ?? 0, r.new_players) : null,
  }));
}

async function leaguesTable(db) {
  const { results } = await db
    .prepare(`SELECT l.code, l.name, l.day AS created_day, COUNT(m.device_id) AS members,
                (SELECT COUNT(DISTINCT p.device_id) FROM members mm JOIN plays p ON p.device_id = mm.device_id WHERE mm.league_id = l.id) AS members_played
              FROM leagues l LEFT JOIN members m ON m.league_id = l.id GROUP BY l.id ORDER BY l.created_at`)
    .all();
  return results;
}

async function daily(db) {
  const q = async (sql) => (await db.prepare(sql).all()).results;
  const [visitors, players, newPlayers, created, joins, evs] = await Promise.all([
    q("SELECT day, COUNT(DISTINCT device_id) AS n FROM events WHERE type = 'visit' GROUP BY day"),
    q(`SELECT day, COUNT(DISTINCT device_id) AS n FROM (${ACTIVE}) GROUP BY day`),
    q(`SELECT fd AS day, COUNT(*) AS n FROM (${FIRST}) GROUP BY fd`),
    q('SELECT day, COUNT(*) AS n FROM leagues GROUP BY day'),
    q("SELECT day, COUNT(*) AS n FROM members WHERE role = 'member' GROUP BY day"),
    q("SELECT day, type, COUNT(*) AS n FROM events WHERE type != 'visit' GROUP BY day, type"),
  ]);
  const rows = new Map();
  const row = (d) => rows.get(d) || rows.set(d, { day: d, visitors: 0, players: 0, new_players: 0, leagues_created: 0, joins: 0, invite_shares: 0, invite_opens: 0, result_shares: 0 }).get(d);
  visitors.forEach((r) => (row(r.day).visitors = r.n));
  players.forEach((r) => (row(r.day).players = r.n));
  newPlayers.forEach((r) => (row(r.day).new_players = r.n));
  created.forEach((r) => (row(r.day).leagues_created = r.n));
  joins.forEach((r) => (row(r.day).joins = r.n));
  const key = { invite_share: 'invite_shares', invite_open: 'invite_opens', result_share: 'result_shares' };
  evs.forEach((r) => (row(r.day)[key[r.type]] = r.n));
  return [...rows.values()].sort((a, b) => (a.day < b.day ? -1 : 1));
}

async function stats({ db, day }) {
  const one = (sql, ...a) => db.prepare(sql).bind(...a).first();
  const [sess, topPaths, gamesRows] = await Promise.all([
    one(`SELECT COUNT(*) AS sessions, SUM(n) AS pageviews, AVG(n) AS pps, AVG(dur) AS dur
         FROM (SELECT COUNT(*) AS n, (MAX(created_at) - MIN(created_at)) / 1000.0 AS dur FROM pageviews GROUP BY session_id)`),
    db.prepare('SELECT path, COUNT(*) AS n FROM pageviews GROUP BY path ORDER BY n DESC LIMIT 15').all(),
    db.prepare('SELECT game, COUNT(DISTINCT device_id) AS players, SUM(runs) AS runs FROM scores GROUP BY game ORDER BY runs DESC').all(),
  ]);
  const [tot, sharers, evTotals, coh, lgs, days] = await Promise.all([
    one(`SELECT (SELECT COUNT(DISTINCT device_id) FROM (${ACTIVE})) AS players, (SELECT COUNT(*) FROM plays) AS plays`),
    one(`SELECT COUNT(DISTINCT device_id) AS n FROM events WHERE type IN ('result_share', 'invite_share') AND device_id IN (SELECT device_id FROM (${ACTIVE}))`),
    db.prepare("SELECT type, COUNT(*) AS n, COUNT(DISTINCT device_id) AS devices FROM events GROUP BY type").all(),
    cohorts(db, day), leaguesTable(db), daily(db),
  ]);
  const sources = await sourcesTable(db, day);
  const closed = coh.filter((c) => c.status === 'cerrada');
  const eligible = closed.reduce((a, c) => a + c.new_players, 0);
  const returned = closed.reduce((a, c) => a + c.returned_day2, 0);
  const big = lgs.filter((l) => l.members >= 5).length;
  const ev = Object.fromEntries(evTotals.results.map((r) => [r.type, r]));
  const sizes = { '1': 0, '2': 0, '3': 0, '4': 0, '5-9': 0, '10+': 0 };
  lgs.forEach((l) => sizes[l.members >= 10 ? '10+' : l.members >= 5 ? '5-9' : String(l.members)]++);
  return {
    day,
    totals: {
      visitors: ev.visit?.devices ?? 0, players: tot.players, plays: tot.plays, leagues: lgs.length,
      members: lgs.reduce((a, l) => a + l.members, 0),
      invite_shares: ev.invite_share?.n ?? 0, invite_opens: ev.invite_open?.n ?? 0, result_shares: ev.result_share?.n ?? 0,
    },
    gate: {
      day2: { value: pct(returned, eligible), target: 25, returned, eligible },
      leagues5: { value: pct(big, lgs.length), target: 40, big, leagues: lgs.length },
      share: { value: pct(sharers.n, tot.players), target: 10, sharers: sharers.n, players: tot.players },
    },
    sessions: {
      sessions: sess.sessions || 0, pageviews: sess.pageviews || 0,
      pagesPerSession: sess.pps ? Math.round(sess.pps * 10) / 10 : null, avgSeconds: sess.dur != null ? Math.round(sess.dur) : null,
    },
    topPaths: topPaths.results, games: gamesRows.results,
    leagueSizes: sizes, cohorts: coh, daily: days.slice(-60), leagues: lgs, sources,
  };
}

function toCsv(rows, cols) {
  const esc = (v) => {
    const s = v == null ? '' : String(v);
    const safe = /^[=+\-@\t\r]/.test(s) ? "'" + s : s; // evita inyección de fórmulas en Excel
    return /[",\n;]/.test(safe) ? '"' + safe.replace(/"/g, '""') + '"' : safe;
  };
  return [cols.join(','), ...rows.map((r) => cols.map((c) => esc(r[c])).join(','))].join('\n') + '\n';
}

async function exportCsv({ db, day }, kind) {
  if (kind === 'daily') return toCsv(await daily(db), ['day', 'visitors', 'players', 'new_players', 'leagues_created', 'joins', 'invite_shares', 'invite_opens', 'result_shares']);
  if (kind === 'cohorts') return toCsv(await cohorts(db, day), ['day', 'new_players', 'returned_day2', 'pct_day2', 'status']);
  if (kind === 'leagues') return toCsv(await leaguesTable(db), ['code', 'name', 'created_day', 'members', 'members_played']);
  if (kind === 'sources') return toCsv(await sourcesTable(db, day), ['source', 'users', 'pageviews', 'pages_per_user', 'eligible_day2', 'returned_day2', 'pct_day2']);
  if (kind === 'events') {
    const { results } = await db
      .prepare('SELECT e.id, e.day, e.type, e.device_id, l.code AS league, e.created_at FROM events e LEFT JOIN leagues l ON l.id = e.league_id ORDER BY e.id')
      .all();
    return toCsv(results.map((r) => ({ ...r, created_at: new Date(r.created_at).toISOString() })), ['id', 'day', 'type', 'device_id', 'league', 'created_at']);
  }
  if (kind === 'sessions') {
    const { results } = await db
      .prepare(`SELECT day, COUNT(*) AS sessions, SUM(n) AS pageviews, ROUND(AVG(n), 2) AS pages_per_session, ROUND(AVG(dur)) AS avg_seconds
                FROM (SELECT MIN(day) AS day, session_id, COUNT(*) AS n, (MAX(created_at) - MIN(created_at)) / 1000.0 AS dur FROM pageviews GROUP BY session_id)
                GROUP BY day ORDER BY day`)
      .all();
    return toCsv(results, ['day', 'sessions', 'pageviews', 'pages_per_session', 'avg_seconds']);
  }
  if (kind === 'plays') {
    const { results } = await db.prepare('SELECT device_id, day, avg_ms, valid_count, attempts FROM plays ORDER BY day, created_at').all();
    return toCsv(results, ['device_id', 'day', 'avg_ms', 'valid_count', 'attempts']);
  }
  fail(400, 'bad_kind', 'Tipo de exportación no válido');
}

const csvResponse = (csv, kind, day) =>
  new Response('﻿' + csv, {
    headers: {
      'content-type': 'text/csv; charset=utf-8', 'cache-control': 'no-store',
      'content-disposition': `attachment; filename="tepicas-${kind}-${day}.csv"`,
    },
  });
