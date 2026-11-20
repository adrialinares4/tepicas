// Genera public/juegos/<slug>.html (una URL por juego: SEO y una página vista por partida).
// Uso: node scripts/gen-games.mjs
import { mkdirSync, writeFileSync } from 'node:fs';

const GAMES = [
  {
    slug: 'dianas', title: 'Caza dianas', seo: 'Test de puntería online',
    lead: 'Toca 20 dianas lo más rápido que puedas. Cuenta el tiempo total.',
    about: [
      'Caza dianas es un test de puntería y velocidad para el móvil o el ordenador: aparecen 20 dianas una detrás de otra y tienes que tocarlas lo antes posible.',
      'Mide coordinación ojo-mano y velocidad de reacción. Juega tantas veces como quieras, guarda tu récord y compáralo con el resto de jugadores del día.',
    ],
  },
  {
    slug: 'secuencia', title: 'Memoria visual', seo: 'Test de memoria visual',
    lead: 'Mira qué casillas se iluminan y repite la secuencia. Cada nivel añade una más.',
    about: [
      'Memoria visual es un test de memoria a corto plazo: se ilumina una secuencia de casillas y tienes que repetirla en el mismo orden. Cada nivel es un paso más largo.',
      'Es un reto sencillo que engancha: la mayoría de la gente se atasca entre los niveles 7 y 10. ¿Hasta dónde llegas tú?',
    ],
  },
  {
    slug: 'calculo', title: 'Cálculo rápido', seo: 'Juego de cálculo mental',
    lead: 'Sumas, restas y multiplicaciones: acierta todas las que puedas en 30 segundos.',
    about: [
      'Cálculo rápido es un juego de cálculo mental contrarreloj: tienes 30 segundos para resolver el máximo de operaciones eligiendo la respuesta correcta.',
      'Sirve para entrenar la agilidad mental antes de un examen o para picarte con tus amigos.',
    ],
  },
  {
    slug: 'numeros', title: 'Memoria de números', seo: 'Test de memoria de números',
    lead: 'Aparece un número unos segundos. Escríbelo. Cada vez tiene una cifra más.',
    about: [
      'Memoria de números mide cuántas cifras eres capaz de retener: se muestra un número, desaparece y tienes que escribirlo. Si aciertas, el siguiente es más largo.',
      'Un buen resultado está por encima de 7 u 8 cifras. Juega las veces que quieras e intenta superar tu récord.',
    ],
  },
  {
    slug: 'colores', title: 'Colores locos', seo: 'Test de Stroop online',
    lead: 'Aparece el nombre de un color pintado de otro color. Toca el color de la tinta, no lo que pone.',
    about: [
      'Colores locos es una versión del test de Stroop: tu cerebro tiende a leer la palabra, pero tienes que responder con el color de la tinta. Tienes 30 segundos.',
      'Pone a prueba la atención y el control mental. Parece fácil hasta que lo pruebas.',
    ],
  },
];

const esc = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/"/g, '&quot;');
mkdirSync(new URL('../public/juegos/', import.meta.url), { recursive: true });
for (const g of GAMES) {
  const url = `https://tepicas.com/juegos/${g.slug}`;
  const html = `<!doctype html>
<html lang="es">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">
<title>${esc(g.seo)} gratis: ${esc(g.title)} · Tepicas</title>
<meta name="description" content="${esc(g.lead)} Gratis, sin registro y desde el móvil.">
<meta name="theme-color" content="#0d0e12">
<link rel="icon" href="/favicon.svg" type="image/svg+xml">
<link rel="stylesheet" href="/style.css">
<script async src="https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=ca-pub-4361300293719479" crossorigin="anonymous"></script>
<link rel="canonical" href="${url}">
<meta property="og:type" content="website">
<meta property="og:title" content="${esc(g.title)} · Tepicas">
<meta property="og:description" content="${esc(g.lead)}">
<meta property="og:url" content="${url}">
<meta property="og:image" content="https://tepicas.com/og.png">
<meta name="twitter:card" content="summary_large_image">
<script type="module" src="/app.js"></script>
</head>
<body data-page="juego" data-game="${g.slug}">
<header class="top"><a href="/" class="logo">tepicas<span>.</span></a><span class="day js-day"></span></header>
<main>
  <section class="card" id="g-intro">
    <p class="eyebrow">Juego libre · sin límite de partidas</p>
    <h1>${esc(g.title)}</h1>
    <p class="sub">${esc(g.lead)}</p>
    <p class="done" id="g-best"></p>
    <button class="btn primary big" id="g-start">Empezar</button>
  </section>

  <section id="g-stage" class="stage hidden" aria-live="polite"></section>

  <section class="card result hidden" id="g-end">
    <p class="eyebrow">${esc(g.title)}</p>
    <p class="big-ms score" id="g-score"></p>
    <p class="sub" id="g-record"></p>
    <p class="global" id="g-global"></p>
    <button class="btn primary big" id="g-again">Otra vez</button>
    <a class="btn" id="g-next" href="/">Siguiente juego</a>
    <button class="btn wa" id="g-share">Retar por WhatsApp</button>
  </section>

  <section class="card" id="g-more">
    <h2>Más juegos</h2>
    <a class="game-tile daily" href="/reflejos"><b>Reto del día: reflejos</b><small>Uno al día, igual para todos. Compite en ligas.</small></a>
    <div class="games js-games"></div>
  </section>

  <section class="card legal">
    <h2>${esc(g.seo)}</h2>
${g.about.map((p) => `    <p>${esc(p)}</p>`).join('\n')}
  </section>
</main>
<footer><a href="/sobre">Sobre Tepicas</a> · <a href="/contacto">Contacto</a> · <a href="/privacidad">Privacidad</a> · Solo mayores de 14 años · © 2026 Tepicas</footer>
</body>
</html>
`;
  writeFileSync(new URL(`../public/juegos/${g.slug}.html`, import.meta.url), html);
}
console.log('Generados', GAMES.length, 'juegos');
