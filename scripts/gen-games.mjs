// Genera public/juegos/<slug>.html (una URL por juego: SEO y una página vista por partida).
// Uso: node scripts/gen-games.mjs
import { mkdirSync, writeFileSync } from 'node:fs';

const GAMES = [
  {
    slug: 'antes', title: '¿Qué fue antes?', seo: 'Juego de cultura general',
    lead: 'Dos cosas: una app, un videojuego, una peli o un hecho histórico. Elige cuál apareció antes. ¿Hasta dónde llega tu racha?',
    intro: [
      '¿Qué fue antes? es un juego de cultura general por rachas: te enseñamos dos cosas, como WhatsApp e Instagram o el Muro de Berlín y la Game Boy, y tienes que adivinar cuál es más antigua. Si aciertas, sigues; al primer fallo, se acaba.',
      'Mezcla tecnología, videojuegos, cine, series, música, fútbol e historia. Cada respuesta muestra el año, así que también aprendes mientras juegas.',
    ],
    how: [
      'Pulsa Empezar: aparecen dos cosas, por ejemplo una app y una película.',
      'Toca la que apareció antes. Verás el año de las dos.',
      'Si aciertas, sumas 1 a tu racha y sale otra pareja. Al primer fallo, se acaba la partida.',
    ],
    levels: {
      note: 'Escala orientativa de Tepicas:',
      rows: [['0–4', 'Calentando'], ['5–9', 'Bien'], ['10–19', 'Muy bien: controlas de historia y de internet'], ['20 o más', 'Enciclopedia andante']],
    },
    tips: [
      'Las redes sociales y las apps que usas a diario son casi todas posteriores a 2004.',
      'Las sagas engañan: la primera película de Star Wars es de 1977, aunque haya estrenos cada pocos años.',
      'Si dudas entre dos cosas recientes, piensa en qué curso estabas cuando salieron.',
    ],
    faq: [
      ['¿De dónde salen las fechas?', 'Usamos el año de lanzamiento o de estreno más aceptado (el primer estreno en cines, la salida a la venta o la fundación). Si ves un error, escríbenos desde Contacto.'],
      ['¿Se repiten las preguntas?', 'Las parejas se eligen al azar y la misma pareja no se repite dentro de una racha. Vamos añadiendo hechos nuevos.'],
    ],
  },
  {
    slug: 'dianas', title: 'Caza dianas', seo: 'Test de puntería online',
    lead: 'Toca 20 dianas lo más rápido que puedas. Cuenta el tiempo total.',
    intro: [
      'Caza dianas es un test de puntería y velocidad para el móvil o el ordenador: aparecen 20 dianas una detrás de otra y tienes que tocarlas lo antes posible.',
      'Mide coordinación ojo-mano y velocidad de reacción. Juega tantas veces como quieras, guarda tu récord y compáralo con el resto de jugadores del día.',
    ],
    how: [
      'Pulsa Empezar.',
      'Aparece una diana: tócala lo antes posible. Al tocarla, sale la siguiente en otro sitio.',
      'Cuando tocas las 20, ves tu tiempo total. Cuanto menos, mejor.',
    ],
    tips: [
      'Apoya el móvil en la mesa y usa el índice de tu mano buena: si el móvil se mueve, fallas.',
      'Busca la siguiente diana con la vista antes de mover el dedo: los ojos van por delante de la mano.',
      'Con ratón, si te pasas de la diana a menudo, baja un poco la sensibilidad.',
    ],
    faq: [
      ['¿Qué es un buen tiempo?', 'Depende mucho de si juegas con el dedo o con ratón, así que no hay una cifra universal. Lo más justo es comparar tu tiempo con el «mejor que el X % de hoy» que verás al terminar, o con amigos que jueguen igual que tú.'],
      ['¿Para qué sirve un test de puntería?', 'Para entrenar la coordinación entre la vista y la mano, útil en videojuegos de disparos y deportes de raqueta, o simplemente para picarte.'],
    ],
  },
  {
    slug: 'secuencia', title: 'Memoria visual', seo: 'Test de memoria visual',
    lead: 'Mira qué casillas se iluminan y repite la secuencia. Cada nivel añade una más.',
    intro: [
      'Memoria visual es un test de memoria a corto plazo: se ilumina una secuencia de casillas y tienes que repetirla en el mismo orden. Cada nivel es un paso más largo.',
      'Es fácil al principio y se complica rápido, porque cada nivel añade un paso más que tienes que recordar. ¿Hasta dónde llegas tú?',
    ],
    how: [
      'Pulsa Empezar y mira la cuadrícula de 9 casillas.',
      'Se iluminan unas casillas en orden. Cuando ponga «repite», tócalas en el mismo orden.',
      'Cada nivel añade una casilla más a la secuencia. Si fallas una, se acaba.',
    ],
    tips: [
      'Ponles nombre a las casillas (arriba, centro, abajo-derecha…) y repítelo mentalmente.',
      'Agrupa la secuencia en bloques de 3 o 4 pasos: es más fácil recordar bloques que pasos sueltos.',
      'Imagina el dibujo que forma el recorrido, como un patrón de desbloqueo del móvil.',
    ],
    faq: [
      ['¿Qué mide este test?', 'La memoria de trabajo visoespacial: tu capacidad de retener durante unos segundos dónde y en qué orden han pasado las cosas.'],
      ['¿Se puede mejorar?', 'Con práctica y con trucos como agrupar los pasos, el resultado suele subir. Juega unas cuantas partidas y compara con tu primer nivel.'],
    ],
  },
  {
    slug: 'calculo', title: 'Cálculo rápido', seo: 'Juego de cálculo mental',
    lead: 'Sumas, restas y multiplicaciones: acierta todas las que puedas en 30 segundos.',
    intro: [
      'Cálculo rápido es un juego de cálculo mental contrarreloj: tienes 30 segundos para resolver el máximo de operaciones eligiendo la respuesta correcta.',
      'Sirve para entrenar la agilidad mental antes de un examen o para picarte con tus amigos.',
    ],
    how: [
      'Tienes 30 segundos.',
      'Aparece una operación (suma, resta o multiplicación) y cuatro respuestas. Toca la correcta.',
      'Si fallas, no sumas pero sigues jugando. Al final cuenta el número de aciertos.',
    ],
    tips: [
      'Para sumar 47 + 38, suma primero las decenas (40 + 30 = 70) y luego las unidades (7 + 8 = 15): 85.',
      'Para restar, redondea: 83 − 29 es lo mismo que 83 − 30 + 1 = 54.',
      'Las tablas del 2 al 12 son la mitad del juego: si las tienes frescas, subes de golpe.',
      'Mira la última cifra de las opciones: muchas veces basta para descartar las incorrectas.',
    ],
    faq: [
      ['¿Hay números negativos o divisiones?', 'No. Las restas siempre dan cero o más, y solo hay sumas, restas y multiplicaciones hasta 12 × 12.'],
      ['¿Sirve para algo?', 'Hacer cuentas de cabeza con rapidez ayuda en exámenes sin calculadora y en el día a día: cambios, descuentos o dividir una cuenta.'],
    ],
  },
  {
    slug: 'numeros', title: 'Memoria de números', seo: 'Test de memoria de números',
    lead: 'Aparece un número unos segundos. Escríbelo. Cada vez tiene una cifra más.',
    intro: [
      'Memoria de números mide cuántas cifras eres capaz de retener: se muestra un número, desaparece y tienes que escribirlo. Si aciertas, el siguiente es más largo.',
      'En 1956 el psicólogo George A. Miller describió que la mayoría de las personas retiene entre 5 y 9 elementos a la vez en la memoria a corto plazo: el famoso «7 ± 2». Este test te dice dónde estás tú.',
    ],
    how: [
      'Aparece un número durante unos segundos.',
      'Cuando desaparece, escríbelo y pulsa Comprobar.',
      'Si aciertas, el siguiente tiene una cifra más. Empieza en 3 cifras y llega hasta 25.',
    ],
    levels: {
      note: 'Escala orientativa basada en el «7 ± 2»:',
      rows: [['Menos de 5 cifras', 'Por debajo de lo habitual'], ['5–9 cifras', 'Lo habitual'], ['10–12 cifras', 'Muy buena memoria'], ['13 o más', 'Nivel campeón: seguro que agrupas las cifras']],
    },
    tips: [
      'Agrupa las cifras de dos en dos o de tres en tres, como un número de teléfono: 482 917 305.',
      'Repítelo en voz baja mientras lo miras: oírlo ayuda a recordarlo.',
      'Asocia grupos a cosas que conozcas: un año, una edad, un dorsal.',
    ],
    faq: [
      ['¿Por qué me cuesta tanto a partir de 8 o 9 cifras?', 'Porque superas la capacidad normal de la memoria a corto plazo. A partir de ahí solo se avanza agrupando las cifras en bloques.'],
    ],
  },
  {
    slug: 'colores', title: 'Colores locos', seo: 'Test de Stroop online',
    lead: 'Aparece el nombre de un color pintado de otro color. Toca el color de la tinta, no lo que pone.',
    intro: [
      'Colores locos es una versión del test de Stroop: tu cerebro tiende a leer la palabra, pero tienes que responder con el color de la tinta. Tienes 30 segundos.',
      'El efecto lo describió el psicólogo John Ridley Stroop en 1935: tardamos más en decir el color de la tinta cuando la palabra escrita es otro color, porque leer es casi automático. Parece fácil hasta que lo pruebas.',
    ],
    how: [
      'Aparece el nombre de un color (ROJO, AZUL, VERDE o AMARILLO) pintado de un color.',
      'Toca el botón del color de la TINTA, no el de la palabra.',
      'Tienes 30 segundos. Cuenta el número de aciertos.',
    ],
    tips: [
      'Fíjate en la mancha de color, no en las letras: desenfoca un poco la mirada.',
      'No leas mentalmente la palabra: es justo lo que te hace fallar.',
      'Ve a un ritmo constante: correr de más provoca rachas de fallos.',
    ],
    faq: [
      ['¿Qué mide el test de Stroop?', 'La atención selectiva y el control inhibitorio: la capacidad de frenar una respuesta automática (leer) para dar la correcta (el color).'],
      ['¿Y si soy daltónico?', 'El juego usa rojo, verde, azul y amarillo, y algunas personas con daltonismo tienen dificultades para distinguirlos. En ese caso el resultado no refleja tu atención.'],
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
${g.intro.map((p) => `    <p>${esc(p)}</p>`).join('\n')}
    <h3>Cómo se juega</h3>
    <ol>${g.how.map((x) => `<li>${esc(x)}</li>`).join('')}</ol>
${g.levels ? `    <h3>¿Qué es un buen resultado?</h3>
    <p>${esc(g.levels.note)}</p>
    <table><tbody>${g.levels.rows.map(([a, b]) => `<tr><th>${esc(a)}</th><td>${esc(b)}</td></tr>`).join('')}</tbody></table>
` : ''}    <h3>Consejos para mejorar</h3>
    <ul>${g.tips.map((x) => `<li>${esc(x)}</li>`).join('')}</ul>
    <h3>Preguntas frecuentes</h3>
${g.faq.map(([q, a]) => `    <p><b>${esc(q)}</b><br>${esc(a)}</p>`).join('\n')}
  </section>
</main>
<footer><a href="/sobre">Sobre Tepicas</a> · <a href="/contacto">Contacto</a> · <a href="/privacidad">Privacidad</a> · Solo mayores de 14 años · © 2026 Tepicas</footer>
</body>
</html>
`;
  writeFileSync(new URL(`../public/juegos/${g.slug}.html`, import.meta.url), html);
}
console.log('Generados', GAMES.length, 'juegos');
