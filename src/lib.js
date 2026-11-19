export const TZ = 'Europe/Madrid';
export const ATTEMPTS = 5;
export const MIN_MS = 100;        // antitrampas: reacciones por debajo se descartan
export const MIN_VALID = 3;       // intentos válidos necesarios para puntuar
export const WEEK_POINTS = [10, 8, 6, 5, 4, 3, 2]; // resto: 1 punto por jugar

const dayFmt = new Intl.DateTimeFormat('en-CA', { timeZone: TZ, year: 'numeric', month: '2-digit', day: '2-digit' });
const hmsFmt = new Intl.DateTimeFormat('en-GB', { timeZone: TZ, hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23' });

export const nowMs = (env) => (typeof env?.__now === 'function' ? env.__now() : Date.now());
export const dayOf = (ms) => dayFmt.format(new Date(ms));
export function secondsIntoDay(ms) {
  const [h, m, s] = hmsFmt.format(new Date(ms)).split(':').map(Number);
  return h * 3600 + m * 60 + s;
}
export function addDays(day, n) {
  const d = new Date(day + 'T00:00:00Z');
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}
export function weekStart(day) {
  const wd = (new Date(day + 'T00:00:00Z').getUTCDay() + 6) % 7; // lunes = 0
  return addDays(day, -wd);
}

// Retrasos del día: iguales para todos (semilla = fecha).
function hash(str) {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619); }
  return h >>> 0;
}
function mulberry32(a) {
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
export function delaysFor(day) {
  const r = mulberry32(hash('reflejos:' + day));
  return Array.from({ length: ATTEMPTS }, () => 1500 + Math.round(r() * 3000));
}

export function scoreAttempts(attempts) {
  const valid = attempts.filter((ms) => ms >= MIN_MS);
  const avg = valid.length >= MIN_VALID ? Math.round(valid.reduce((a, b) => a + b, 0) / valid.length) : null;
  const discarded = attempts.map((ms, i) => (ms < MIN_MS ? i : -1)).filter((i) => i >= 0);
  return { avg, validCount: valid.length, discarded };
}

const NICK_RE = /^[\p{L}\p{N}][\p{L}\p{N} ._'-]*$/u;
const LEAGUE_RE = /^[\p{L}\p{N}ºª#][\p{L}\p{N} ._'!?ºª#&-]*$/u;
function clean(s, min, max, re) {
  if (typeof s !== 'string') return null;
  s = s.normalize('NFC').replace(/\s+/g, ' ').trim();
  return s.length >= min && s.length <= max && re.test(s) ? s : null;
}
export const cleanNick = (s) => clean(s, 2, 16, NICK_RE);
export const cleanLeagueName = (s) => clean(s, 3, 30, LEAGUE_RE);

const CODE_ALPHABET = '23456789ABCDEFGHJKMNPQRSTUVWXYZ';
export function newCode() {
  const b = new Uint8Array(6);
  crypto.getRandomValues(b);
  return Array.from(b, (x) => CODE_ALPHABET[x % CODE_ALPHABET.length]).join('');
}

export const escapeHtml = (s) =>
  String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
