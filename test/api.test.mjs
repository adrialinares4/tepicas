import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createD1 } from './d1.mjs';
import { handleApi } from '../src/api.js';
import { leaguePage } from '../src/pages.js';
import { isProfane } from '../src/profanity.js';
import { delaysFor, weekStart } from '../src/lib.js';

const TOKEN = 'test-admin-token-1234567890';
const madrid = (iso) => Date.parse(iso); // ISO con zona explícita
function setup(startIso = '2026-11-19T12:00:00+01:00') {
  let now = madrid(startIso);
  const env = { DB: createD1(), ADMIN_TOKEN: TOKEN, __now: () => now };
  const call = async (method, path, { dev, body, token } = {}) => {
    const headers = { 'content-type': 'application/json' };
    if (dev) headers['x-device'] = dev;
    if (token) headers.authorization = 'Bearer ' + token;
    const res = await handleApi(new Request('https://tepicas.com/api' + path, { method, headers, body: body ? JSON.stringify(body) : undefined }), env);
    const text = await res.text();
    let data = null;
    try { data = JSON.parse(text); } catch { data = text; }
    return { status: res.status, data, text, headers: res.headers };
  };
  return { env, call, setNow: (iso) => (now = madrid(iso)) };
}
const D = (n) => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;

test('reto del día: mismos retrasos para todos, cambian cada día', async () => {
  const { call } = setup();
  const a = await call('GET', '/today', { dev: D(1) });
  const b = await call('GET', '/today', { dev: D(2) });
  assert.equal(a.data.day, '2026-11-19');
  assert.equal(a.data.weekStart, '2026-11-16');
  assert.deepEqual(a.data.delays, b.data.delays);
  assert.equal(a.data.delays.length, 5);
  assert.ok(a.data.delays.every((d) => d >= 1500 && d <= 4500));
  assert.notDeepEqual(delaysFor('2026-11-19'), delaysFor('2026-11-20'));
  assert.equal(a.data.mine, null);
});

test('día en hora de Madrid', async () => {
  const { call } = setup('2026-11-19T23:30:00Z'); // 00:30 del 20 en Madrid
  assert.equal((await call('GET', '/today')).data.day, '2026-11-20');
});

test('antitrampas: <100 ms se descarta en servidor; una partida oficial por día', async () => {
  const { call } = setup();
  const r = await call('POST', '/play', { dev: D(1), body: { day: '2026-11-19', attempts: [250, 40, 230, 99, 260] } });
  assert.equal(r.status, 200);
  assert.equal(r.data.avg, 247);
  assert.equal(r.data.validCount, 3);
  assert.deepEqual(r.data.discarded, [1, 3]);
  const again = await call('POST', '/play', { dev: D(1), body: { day: '2026-11-19', attempts: [150, 150, 150, 150, 150] } });
  assert.equal(again.data.already, true);
  assert.equal(again.data.avg, 247);
  const t = await call('GET', '/today', { dev: D(1) });
  assert.equal(t.data.mine.avg, 247);
});

test('menos de 3 válidos = sin puntuación; payload inválido rechazado', async () => {
  const { call } = setup();
  const r = await call('POST', '/play', { dev: D(2), body: { day: '2026-11-19', attempts: [50, 60, 200, 210, 70] } });
  assert.equal(r.data.avg, null);
  for (const attempts of [[1, 2, 3], [100, 200, 300, 400, 'x'], [100, 200, 300, 400, 99999], [100.5, 200, 300, 400, 500]])
    assert.equal((await call('POST', '/play', { dev: D(3), body: { day: '2026-11-19', attempts } })).status, 400);
  assert.equal((await call('POST', '/play', { body: { day: '2026-11-19', attempts: [200, 200, 200, 200, 200] } })).status, 400);
  assert.equal((await call('POST', '/play', { dev: 'no-uuid', body: { day: '2026-11-19', attempts: [200, 200, 200, 200, 200] } })).status, 400);
  assert.equal((await call('POST', '/play', { dev: D(3), body: { day: '2026-11-18', attempts: [200, 200, 200, 200, 200] } })).status, 400);
});

test('reto de ayer aceptado solo 15 min tras medianoche', async () => {
  const { call, setNow } = setup('2026-11-20T00:10:00+01:00');
  assert.equal((await call('POST', '/play', { dev: D(1), body: { day: '2026-11-19', attempts: [200, 200, 200, 200, 200] } })).status, 200);
  setNow('2026-11-20T00:20:00+01:00');
  assert.equal((await call('POST', '/play', { dev: D(2), body: { day: '2026-11-19', attempts: [200, 200, 200, 200, 200] } })).status, 400);
});

test('filtro de palabrotas', () => {
  for (const bad of ['puta', 'P U T A', 'PUT4', 'puuuuta', 'hijodeputa', 'Gilipollas', 'g1l1p0llas', 'perrrra', 'coño', 'Zorra 3', 'fuckboy', 'el_cabrón', 'mi3rda'])
    assert.equal(isProfane(bad), true, bad);
  for (const ok of ['Adri', 'Marta_07', 'Computadora', 'Disputa', 'Pera', 'Pol', '1ºB Bachillerato', 'Los Reyes', 'Sergi B', 'Repollo'])
    assert.equal(isProfane(ok), false, ok);
});

test('ligas: crear, unirse, validaciones, clasificación sin filtrar IDs', async () => {
  const { call } = setup();
  assert.equal((await call('POST', '/leagues', { dev: D(1), body: { name: '1ºB Bachillerato', nickname: 'Adri' } })).data.error, 'age');
  assert.equal((await call('POST', '/leagues', { dev: D(1), body: { name: 'Los putos amos', nickname: 'Adri', ageOk: true } })).data.error, 'profane_name');
  assert.equal((await call('POST', '/leagues', { dev: D(1), body: { name: '1ºB', nickname: 'cabrón', ageOk: true } })).data.error, 'profane_nick');
  assert.equal((await call('POST', '/leagues', { dev: D(1), body: { name: '<script>', nickname: 'Adri', ageOk: true } })).data.error, 'bad_name');
  const c = await call('POST', '/leagues', { dev: D(1), body: { name: '  1ºB   Bachillerato ', nickname: 'Adri', ageOk: true } });
  assert.equal(c.status, 201);
  assert.match(c.data.code, /^[A-Z0-9]{6}$/);
  assert.equal(c.data.name, '1ºB Bachillerato');
  const code = c.data.code;

  assert.equal((await call('POST', `/leagues/${code}/join`, { dev: D(2), body: { nickname: 'adri', ageOk: true } })).data.error, 'nick_taken');
  assert.equal((await call('POST', `/leagues/${code}/join`, { dev: D(2), body: { nickname: 'Marta', ageOk: true } })).status, 200);
  assert.equal((await call('POST', `/leagues/${code.toLowerCase()}/join`, { dev: D(2), body: { nickname: 'Otro', ageOk: true } })).data.already, true);
  await call('POST', `/leagues/${code}/join`, { dev: D(3), body: { nickname: 'Pau', ageOk: true } });
  assert.equal((await call('POST', '/leagues/ZZZZZZ/join', { dev: D(4), body: { nickname: 'X1', ageOk: true } })).status, 404);

  await call('POST', '/play', { dev: D(1), body: { day: '2026-11-19', attempts: [300, 300, 300, 300, 300] } });
  await call('POST', '/play', { dev: D(2), body: { day: '2026-11-19', attempts: [200, 200, 200, 200, 200] } });
  const lg = await call('GET', `/leagues/${code}`, { dev: D(1) });
  assert.equal(lg.data.members, 3);
  assert.deepEqual(lg.data.me, { nickname: 'Adri' });
  assert.deepEqual(lg.data.daily.map((r) => [r.pos, r.nick, r.ms, r.me]), [[1, 'Marta', 200, false], [2, 'Adri', 300, true]]);
  assert.deepEqual(lg.data.pending.map((r) => r.nick), ['Pau']);
  assert.ok(!lg.text.includes(D(2)) && !lg.text.includes(D(1)), 'no debe exponer IDs de dispositivo');
  const anon = await call('GET', `/leagues/${code}`, { dev: D(9) });
  assert.equal(anon.data.me, null);

  const mine = await call('GET', '/me/leagues', { dev: D(1) });
  assert.deepEqual(mine.data.leagues, [{ code, name: '1ºB Bachillerato', nickname: 'Adri', members: 3, played: 2, pos: 2 }]);
});

test('clasificación semanal por puntos', async () => {
  const { call, setNow } = setup('2026-11-17T10:00:00+01:00'); // martes
  const code = (await call('POST', '/leagues', { dev: D(1), body: { name: 'Semana', nickname: 'A1', ageOk: true } })).data.code;
  await call('POST', `/leagues/${code}/join`, { dev: D(2), body: { nickname: 'B2', ageOk: true } });
  await call('POST', `/leagues/${code}/join`, { dev: D(3), body: { nickname: 'C3', ageOk: true } });
  const p = (d, day, ms) => call('POST', '/play', { dev: D(d), body: { day, attempts: [ms, ms, ms, ms, ms] } });
  await p(1, '2026-11-17', 200); await p(2, '2026-11-17', 250);
  setNow('2026-11-18T10:00:00+01:00');
  await p(2, '2026-11-18', 180); await p(1, '2026-11-18', 300); await p(3, '2026-11-18', 190);
  const lg = (await call('GET', `/leagues/${code}`, { dev: D(3) })).data;
  // A1: 10+6=16, B2: 8+10=18, C3: 8
  assert.deepEqual(lg.weekly.map((r) => [r.nick, r.points, r.days]), [['B2', 18, 2], ['A1', 16, 2], ['C3', 8, 1]]);
  assert.equal(lg.weekly[2].me, true);
  assert.equal(weekStart('2026-11-23'), '2026-11-23');
  setNow('2026-11-23T10:00:00+01:00'); // lunes siguiente: semana nueva
  const lg2 = (await call('GET', `/leagues/${code}`, { dev: D(3) })).data;
  assert.ok(lg2.weekly.every((r) => r.points === 0));
});

test('eventos y panel: vuelta al día 2, ligas 5+, compartidos, CSV', async () => {
  const { call, setNow } = setup('2026-11-17T10:00:00+01:00');
  assert.equal((await call('POST', '/event', { dev: D(1), body: { type: 'hack' } })).status, 400);
  const play = (d, day) => call('POST', '/play', { dev: D(d), body: { day, attempts: [210, 220, 230, 240, 250] } });
  // día 17: 4 jugadores nuevos
  for (const d of [1, 2, 3, 4]) { await call('POST', '/event', { dev: D(d), body: { type: 'visit' } }); await play(d, '2026-11-17'); }
  await call('POST', '/event', { dev: D(1), body: { type: 'visit' } }); // duplicado, se ignora
  const code = (await call('POST', '/leagues', { dev: D(1), body: { name: 'Clase', nickname: 'Uno', ageOk: true } })).data.code;
  for (const d of [2, 3, 4, 5]) await call('POST', `/leagues/${code}/join`, { dev: D(d), body: { nickname: 'Jug' + d, ageOk: true } });
  await call('POST', '/leagues', { dev: D(6), body: { name: 'Sola', nickname: 'Seis', ageOk: true } });
  await call('POST', '/event', { dev: D(1), body: { type: 'invite_share', code } });
  await call('POST', '/event', { dev: D(5), body: { type: 'invite_open', code } });
  await call('POST', '/event', { dev: D(2), body: { type: 'result_share' } });
  // día 18: vuelven 1 y 2; entra el 5
  setNow('2026-11-18T10:00:00+01:00');
  await play(1, '2026-11-18'); await play(2, '2026-11-18'); await play(5, '2026-11-18');
  setNow('2026-11-19T10:00:00+01:00');
  await play(5, '2026-11-19');

  assert.equal((await call('GET', '/admin/stats')).status, 401);
  assert.equal((await call('GET', '/admin/stats', { token: 'mal' })).status, 401);
  const s = (await call('GET', '/admin/stats', { token: TOKEN })).data;
  assert.equal(s.totals.players, 5);
  assert.equal(s.totals.visitors, 4);
  assert.deepEqual(s.gate.day2, { value: 50, target: 25, returned: 2, eligible: 4 }); // cohorte 18 aún en curso
  assert.deepEqual(s.gate.leagues5, { value: 50, target: 40, big: 1, leagues: 2 });
  assert.deepEqual(s.gate.share, { value: 40, target: 10, sharers: 2, players: 5 });
  assert.deepEqual(s.leagueSizes, { 1: 1, 2: 0, 3: 0, 4: 0, '5-9': 1, '10+': 0 });
  assert.equal(s.cohorts.find((c) => c.day === '2026-11-18').status, 'día 2 en curso');
  const d17 = s.daily.find((r) => r.day === '2026-11-17');
  assert.deepEqual(d17, { day: '2026-11-17', visitors: 4, players: 4, new_players: 4, leagues_created: 2, joins: 4, invite_shares: 1, invite_opens: 1, result_shares: 1 });

  const csv = await call('GET', '/admin/csv?kind=daily', { token: TOKEN });
  assert.equal(csv.headers.get('content-type'), 'text/csv; charset=utf-8');
  assert.match(csv.text, /^﻿?day,visitors,players,new_players,leagues_created,joins,invite_shares,invite_opens,result_shares\n2026-11-17,4,4,4,2,4,1,1,1\n/);
  for (const kind of ['cohorts', 'leagues', 'events', 'plays']) assert.equal((await call('GET', '/admin/csv?kind=' + kind, { token: TOKEN })).status, 200);
  assert.equal((await call('GET', '/admin/csv?kind=x', { token: TOKEN })).status, 400);
});

test('panel sin ADMIN_TOKEN configurado → 503', async () => {
  const { env, call } = setup();
  env.ADMIN_TOKEN = '';
  assert.equal((await call('GET', '/admin/stats', { token: '' })).status, 503);
});

test('página de liga con vista previa para WhatsApp', async () => {
  const { env, call } = setup();
  const code = (await call('POST', '/leagues', { dev: D(1), body: { name: "Los d'Adri & co", nickname: 'Adri', ageOk: true } })).data.code;
  const base = '<title>Liga · Tepicas</title><meta property="og:title" content="Liga en Tepicas"><meta property="og:url" content="https://tepicas.com/"><meta property="og:image" content="https://tepicas.com/og.png">';
  env.ASSETS = { fetch: async (u) => { assert.equal(new URL(u).pathname, '/liga'); return new Response(base); } };
  const res = await leaguePage(new Request('https://x.pages.dev/l/' + code), env, code.toLowerCase());
  const html = await res.text();
  assert.equal(res.status, 200);
  assert.ok(html.includes('<title>Únete a «Los d&#39;Adri &amp; co» en Tepicas</title>'));
  assert.ok(html.includes(`og:url" content="https://x.pages.dev/l/${code}"`));
  assert.ok(html.includes('content="https://x.pages.dev/og.png"'));
  assert.equal((await leaguePage(new Request('https://x.pages.dev/l/NOPE00'), env, 'NOPE00')).status, 404);
});

test('comparación global del día (percentil y récord)', async () => {
  const { call } = setup();
  const p = (d, ms) => call('POST', '/play', { dev: D(d), body: { day: '2026-11-19', attempts: [ms, ms, ms, ms, ms] } });
  const first = await p(1, 300);
  assert.deepEqual(first.data.global, { players: 1, best: 300, beat: null });
  await p(2, 200); await p(3, 250); await p(4, 350);
  await call('POST', '/play', { dev: D(5), body: { day: '2026-11-19', attempts: [10, 10, 10, 200, 200] } }); // sin nota: no cuenta
  const t = await call('GET', '/today', { dev: D(3) });
  assert.deepEqual(t.data.global, { players: 4, best: 200, beat: 67 }); // gana a 2 de 3
  const anon = await call('GET', '/today');
  assert.deepEqual(anon.data.global, { players: 4, best: 200, beat: null });
});
