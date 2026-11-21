// Minijuegos libres: sentido de la puntuación y límites antitrampas (servidor).
export const GAMES = {
  dianas: { lower: true, min: 2500, max: 120000 },   // ms para 20 dianas
  secuencia: { lower: false, min: 0, max: 40 },      // niveles completados
  calculo: { lower: false, min: 0, max: 60 },        // aciertos en 30 s
  numeros: { lower: false, min: 0, max: 25 },        // cifras recordadas
  colores: { lower: false, min: 0, max: 60 },        // aciertos en 30 s
  antes: { lower: false, min: 0, max: 300 },         // racha de aciertos
};
