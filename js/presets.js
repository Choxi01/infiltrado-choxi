// Cada modo es un preset: un objeto de reglas. Para cambiar cómo se juega un modo se toca acá,
// no en la pantalla. roles: cantidad de cada tipo de carta (número fijo o función de la cantidad de jugadores).
(function (raiz) {
  "use strict";

  // Opciones de la partida (se pueden cambiar antes de repartir):
  // votacion: rondas | unica. voto: mano (a mano alzada) | secreta. empate: revotar | nadie.
  // finOtros: iguales (ganan al ser tantos como los civiles) | dos (cuando quedan 2 jugadores).
  // revelar: mostrar el rol del eliminado. adivinar: el impostor eliminado puede adivinar la palabra.
  // impostorEmpieza: un impostor con pista o categoría puede abrir la ronda. debate: segundos (0 = sin reloj).

  const IMPOSTOR = {
    id: "impostor", nombre: "Impostor", emoji: "🕵️", disponible: true,
    lema: "Todos saben la palabra menos el impostor.",
    tipoTema: "palabra",
    roles: { pista: n => (n <= 5 ? 1 : n <= 9 ? 2 : 3), categoria: 0, blanco: 0 },
    nombres: {},
    tituloImpostor: "Sos el impostor",
    ganaOtros: "¡Ganan los impostores!",
    opciones: { votacion: "rondas", voto: "mano", empate: "revotar", finOtros: "iguales",
      revelar: true, adivinar: true, impostorEmpieza: false, debate: 120 },
    puntos: { civil: 2, impostor: 6, infiltrado: 10 },
  };

  const INFILTRADO = {
    id: "infiltrado", nombre: "Infiltrado", emoji: "🎭", disponible: true,
    lema: "El infiltrado tiene otra palabra parecida… y no lo sabe.",
    tipoTema: "palabra",
    roles: { infiltrado: n => (n <= 6 ? 1 : n <= 9 ? 2 : 3), blanco: n => (n >= 5 ? 1 : 0) },
    nombres: { blanco: "En blanco" },
    tituloImpostor: "Estás en blanco",
    ganaOtros: "¡Ganan los infiltrados!",
    opciones: { votacion: "rondas", voto: "mano", empate: "revotar", finOtros: "iguales",
      revelar: true, adivinar: true, impostorEmpieza: false, debate: 120 },
    puntos: { civil: 2, impostor: 6, infiltrado: 10 },
  };

  // V2: todavía no se puede elegir.
  const ESPIA = {
    id: "espia", nombre: "El Espía", emoji: "🗺️", disponible: false,
    lema: "Todos saben dónde están menos el espía.",
    tipoTema: "lugar", flujo: "preguntas",
    roles: { blanco: 1 },
    nombres: { blanco: "Espía" },
    tituloImpostor: "Sos el espía",
    reloj: 480, verRoles: true, dosEspias: false, espiasSeConocen: false,
  };

  // V3: todavía no se puede elegir.
  const UNA_PALABRA = {
    id: "unaPalabra", nombre: "Una Palabra", emoji: "💡", disponible: false,
    lema: "Cooperativo: pistas de una palabra que se anulan si se repiten.",
    tipoTema: "palabra", flujo: "cooperativo", cartas: 13, roles: {},
  };

  const api = { impostor: IMPOSTOR, infiltrado: INFILTRADO, espia: ESPIA, unaPalabra: UNA_PALABRA };
  raiz.PRESETS = api;
  if (typeof module !== "undefined" && module.exports) module.exports = api;
})(typeof window !== "undefined" ? window : globalThis);
