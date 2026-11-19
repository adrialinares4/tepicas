// Filtro de palabrotas para apodos y nombres de liga (ES/CA/EN).
// Palabras completas (con tolerancia a letras repetidas y leetspeak) + fragmentos inequívocos.
const TOKENS = `puta puto putas putos putita putito puton putero polla pollas conyo conyos cony cojon cojones collons
joder jodete jodido mierda merda cabron cabrona cabrones cabro gilipollas gilipolla imbecil idiota subnormal
retrasado retrasada mongolo mongola maricon marica maricona maricones bollera zorra zorras perra guarra furcia
ramera pendejo pendeja verga pinga culo culos cipote chocho chumino follar follo follando mamon mamona mamada
hdp ptm pajero pajillero paja pajas nazi nazis hitler sudaca sudacas panchito negrata moraco kkk sexo porno xxx
violador fuck fucker fucking shit bitch cunt dick cock pussy nigger nigga faggot fag porn sex whore slut rape rapist`
  .split(/\s+/).filter(Boolean);
const FRAGMENTS = `hijoputa hijodeputa hijaputa hijadeputa fildeputa laputa unaputa putamadre mecagoen cagoen malparid
gilipoll maricon nigger nigga faggot fuck subnormal retrasad follador`.split(/\s+/).filter(Boolean);

const LEET = { 0: 'o', 1: 'i', 3: 'e', 4: 'a', 5: 's', 7: 't', '@': 'a', $: 's', '!': 'i', '€': 'e' };
const collapse = (s) => s.replace(/(.)\1+/g, '$1');
const norm = (s) =>
  s.toLowerCase().replace(/ñ/g, 'ny').normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/[013457@$!€]/g, (c) => LEET[c]);

const TOKEN_SET = new Set(TOKENS);
const COLLAPSED = new Map(); // forma colapsada -> longitud mínima
for (const w of TOKENS) {
  const c = collapse(w);
  COLLAPSED.set(c, Math.min(COLLAPSED.get(c) ?? Infinity, w.length));
}
const FRAG_C = FRAGMENTS.map(collapse);

function badToken(t) {
  if (TOKEN_SET.has(t)) return true;
  const min = COLLAPSED.get(collapse(t));
  return min !== undefined && t.length >= min; // "puuuta" sí, "pera" (≠ perra) no
}

export function isProfane(text) {
  const tokens = norm(text).split(/[^a-z]+/).filter(Boolean);
  // une letras sueltas: "p u t a" -> "puta"
  const merged = [];
  let run = '';
  for (const t of tokens) {
    if (t.length === 1) run += t;
    else { if (run) merged.push(run); run = ''; merged.push(t); }
  }
  if (run) merged.push(run);
  if (tokens.some(badToken) || merged.some(badToken)) return true;
  const joined = collapse(tokens.join(''));
  return FRAG_C.some((f) => joined.includes(f));
}
