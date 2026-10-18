// Pruebas de la lógica: node tests/reglas.test.js
const assert = require("assert");
const R = require("../js/reglas.js");
const P = require("../js/presets.js");
const E = require("../js/estado.js");
const { TEMAS, CATEGORIAS } = require("../js/datos/temas.js");
const { LUGARES } = require("../js/datos/lugares.js");

let ok = 0, mal = 0;
function prueba(nombre, fn) {
  try { fn(); ok++; } catch (e) { mal++; console.log(`✗ ${nombre}\n  ${e.message}`); }
}
const nombres = n => Array.from({ length: n }, (_, i) => `J${i + 1}`);
const contar = (lista, x) => lista.filter(y => y === x).length;

/* ---------- Reparto ---------- */
prueba("sortear respeta las cantidades", () => {
  for (let s = 1; s < 50; s++) {
    const t = R.sortear(9, { infiltrado: 2, blanco: 1 }, R.crearAzar(s));
    assert.strictEqual(t.length, 9);
    assert.strictEqual(contar(t, "infiltrado"), 2);
    assert.strictEqual(contar(t, "blanco"), 1);
    assert.strictEqual(contar(t, "civil"), 6);
  }
});

prueba("sugerencias válidas de 3 a 20 jugadores en los modos jugables", () => {
  ["impostor", "infiltrado"].forEach(m => {
    for (let n = 3; n <= 20; n++) assert.ok(R.validar(R.sugerir(P[m], n), n).ok, `${m} con ${n}`);
  });
  assert.deepStrictEqual(R.sugerir(P.impostor, 4), { pista: 1, categoria: 0, blanco: 0 });
  assert.deepStrictEqual(R.sugerir(P.infiltrado, 7), { infiltrado: 2, blanco: 1 });
});

prueba("validar frena mesas imposibles", () => {
  assert.ok(!R.validar({ pista: 1 }, 2).ok);
  assert.ok(!R.validar({ pista: 0 }, 5).ok);
  assert.ok(!R.validar({ pista: 2 }, 4).ok);   // 2 contra 2: ganarían de entrada
  assert.ok(R.validar({ pista: 1 }, 3).ok);
});

prueba("el en blanco nunca empieza la ronda; el impostor solo con la opción", () => {
  for (let s = 1; s < 300; s++) {
    const azar = R.crearAzar(s);
    const tipos = R.sortear(6, { infiltrado: 1, blanco: 1, pista: 1 }, azar);
    const js = tipos.map((t, id) => Object.assign({ id }, R.TIPOS[t]));
    const orden = R.ordenPistas(js, azar, false);
    assert.strictEqual(orden.length, 6);
    assert.notStrictEqual(js[orden[0]].ve, "nada");
    assert.notStrictEqual(js[orden[0]].rol, "impostor");
    assert.notStrictEqual(js[R.ordenPistas(js, azar, true)[0]].ve, "nada");
  }
});

prueba("el orden sigue la ronda de la mesa", () => {
  const js = [0, 1, 2, 3].map(id => Object.assign({ id }, R.TIPOS.civil));
  const o = R.ordenPistas(js, () => 0.6, false); // empieza el 2
  assert.deepStrictEqual(o, [2, 3, 0, 1]);
});

/* ---------- Temas ---------- */
prueba("no se repiten palabras hasta agotar", () => {
  const pool = R.temasPosibles(TEMAS, { pista: 1 }, ["Animales"]);
  const azar = R.crearAzar(7);
  let usados = [];
  const vistas = new Set();
  for (let i = 0; i < pool.length; i++) {
    const e = R.elegirTema(pool, usados, azar);
    usados = e.usados;
    assert.ok(!vistas.has(e.tema.palabra), `repetida: ${e.tema.palabra}`);
    vistas.add(e.tema.palabra);
  }
  assert.strictEqual(vistas.size, pool.length);
  const otra = R.elegirTema(pool, usados, azar); // agotadas: vuelve a empezar
  assert.ok(otra.tema);
  assert.strictEqual(otra.usados.filter(k => k.startsWith("animales")).length, 1);
});

prueba("los temas sin parecida o sin pista no entran donde hacen falta", () => {
  const t = [
    { palabra: "A", parecida: "", pista: "x", categoria: "C" },
    { palabra: "B", parecida: "b", pista: "", categoria: "C" },
  ];
  assert.deepStrictEqual(R.temasPosibles(t, { infiltrado: 1 }, null).map(x => x.palabra), ["B"]);
  assert.deepStrictEqual(R.temasPosibles(t, { pista: 1 }, null).map(x => x.palabra), ["A"]);
  assert.strictEqual(R.temasPosibles(t, { blanco: 1 }, null).length, 2);
});

/* ---------- Votos y victorias ---------- */
prueba("contar votos y empates", () => {
  const c = R.contarVotos({ 0: 2, 1: 2, 2: 3, 3: 1 });
  assert.strictEqual(c.max, 2);
  assert.deepStrictEqual(c.lideres, [2]);
  assert.deepStrictEqual(R.contarVotos({ 0: 1, 1: 0 }).lideres.sort(), [0, 1]);
  assert.strictEqual(R.contarVotos({}).max, 0);
});

const mesa = (roles, muertos) => roles.map((rol, id) => ({ id, rol, vivo: !(muertos || []).includes(id) }));
prueba("victorias por rondas", () => {
  const op = { votacion: "rondas", finOtros: "iguales" };
  assert.strictEqual(R.ganador(mesa(["civil", "civil", "civil", "impostor"], [3]), op), "civiles");
  assert.strictEqual(R.ganador(mesa(["civil", "civil", "civil", "impostor"], [0]), op), null);
  assert.strictEqual(R.ganador(mesa(["civil", "civil", "civil", "impostor"], [0, 1]), op), "otros");
  // Infiltrado + en blanco: tienen que salir los dos.
  assert.strictEqual(R.ganador(mesa(["civil", "civil", "civil", "civil", "infiltrado", "impostor"], [4]), op), null);
  assert.strictEqual(R.ganador(mesa(["civil", "civil", "civil", "civil", "infiltrado", "impostor"], [4, 5]), op), "civiles");
  // Opción: los otros ganan recién cuando quedan 2.
  const dos = { votacion: "rondas", finOtros: "dos" };
  assert.strictEqual(R.ganador(mesa(["civil", "civil", "impostor", "impostor", "civil"], [0, 1]), dos), null);
  assert.strictEqual(R.ganador(mesa(["civil", "civil", "civil", "impostor"], [0, 1]), dos), "otros");
});

prueba("votación única", () => {
  const op = { votacion: "unica" };
  const m = mesa(["civil", "civil", "impostor"]);
  assert.strictEqual(R.ganadorTrasEliminar(m, 2, op), "civiles");
  assert.strictEqual(R.ganadorTrasEliminar(m, 0, op), "otros");
  assert.strictEqual(R.ganadorTrasEliminar(m, null, op), "otros");
});

prueba("puntos de Impostor / Infiltrado", () => {
  const m = mesa(["civil", "civil", "infiltrado", "impostor"]);
  const t = P.infiltrado.puntos;
  assert.deepStrictEqual(R.puntos(m, "civiles", null, t), { 0: 2, 1: 2, 2: 0, 3: 0 });
  assert.deepStrictEqual(R.puntos(m, "otros", null, t), { 0: 0, 1: 0, 2: 10, 3: 6 });
  assert.deepStrictEqual(R.puntos(m, "adivino", 3, t), { 0: 0, 1: 0, 2: 0, 3: 6 });
});

/* ---------- Comparar palabras y Una Palabra ---------- */
prueba("comparar sin tildes, mayúsculas ni plural", () => {
  assert.ok(R.iguales("  León ", "leon"));
  assert.ok(R.iguales("Perros", "perro"));
  assert.ok(R.iguales("flores", "Flor"));
  assert.ok(R.iguales("luces", "luz"));
  assert.ok(R.iguales("tomates", "tomate"));
  assert.ok(R.iguales("Pan de queso", "pan de queso!"));
  assert.ok(!R.iguales("gato", "pato"));
  assert.ok(!R.iguales("", ""));
});

prueba("anulación de pistas de Una Palabra", () => {
  const r = R.anularPistas([
    { texto: "Ladrido" }, { texto: "ladridos" }, { texto: "Hueso" }, { texto: "Perrito" },
    { texto: "perros" }, { texto: "" }, { texto: "Collar" },
  ], "Perro");
  assert.deepStrictEqual(r.map(x => x.anulada), [true, true, false, false, true, true, false]);
  assert.strictEqual(r[0].motivo, "repetida");
  assert.strictEqual(r[4].motivo, "es la palabra");
  assert.strictEqual(R.anularPistas([{ texto: "Girasol" }], "Sol")[0].motivo, "es la palabra");
  assert.strictEqual(R.pistasPorJugador(3), 2);
  assert.strictEqual(R.pistasPorJugador(5), 1);
});

prueba("cartas de Una Palabra", () => {
  let up = { total: 13, i: 0, aciertos: 0, perdidas: 0 };
  up = R.jugarCarta(up, "acerto");
  up = R.jugarCarta(up, "paso");
  up = R.jugarCarta(up, "fallo");
  assert.deepStrictEqual([up.i, up.aciertos, up.perdidas, up.fin], [4, 1, 3, false]);
  up = Object.assign(up, { i: 12 });
  up = R.jugarCarta(up, "fallo"); // última carta: no hay siguiente para perder
  assert.strictEqual(up.i, 13);
  assert.ok(up.fin);
  assert.ok(R.fraseUnaPalabra(13).startsWith("¡Perfecto"));
});

/* ---------- El Espía ---------- */
prueba("puntaje de El Espía", () => {
  const ids = [0, 1, 2, 3];
  assert.deepStrictEqual(R.puntosEspia(ids, [2], "tiempo"), { 0: 0, 1: 0, 2: 2, 3: 0 });
  assert.deepStrictEqual(R.puntosEspia(ids, [2], "inocente"), { 0: 0, 1: 0, 2: 4, 3: 0 });
  assert.deepStrictEqual(R.puntosEspia(ids, [2], "acierta"), { 0: 0, 1: 0, 2: 4, 3: 0 });
  assert.deepStrictEqual(R.puntosEspia(ids, [2], "atrapado", 1), { 0: 1, 1: 2, 2: 0, 3: 1 });
  assert.deepStrictEqual(R.puntosEspia(ids, [2], "falla"), { 0: 1, 1: 1, 2: 0, 3: 1 });
  assert.deepStrictEqual(R.puntosEspia(ids, [1, 2], "acierta"), { 0: 0, 1: 4, 2: 4, 3: 0 });
});

prueba("condena unánime (o todos menos uno con dos espías)", () => {
  assert.ok(R.condena(5, 5, false));
  assert.ok(!R.condena(4, 5, false));
  assert.ok(R.condena(8, 9, true));
  assert.ok(!R.condena(7, 9, true));
  assert.strictEqual(R.relojEspia(5), 480);
  assert.strictEqual(R.relojEspia(10), 540);
  assert.strictEqual(R.relojEspia(12), 600);
});

/* ---------- Mis palabras ---------- */
prueba("validar Mis palabras", () => {
  assert.ok(!R.limpiarCategorias({}).ok);
  assert.ok(!R.limpiarCategorias([{ categoria: "", palabras: [] }]).ok);
  assert.ok(!R.limpiarCategorias([{ categoria: "X", palabras: [{ palabra: "", pista: "algo" }] }]).ok);
  const r = R.limpiarCategorias([
    { categoria: " Grupo ", palabras: [{ palabra: "Pepe", parecida: "Pepa", pista: "" }, { palabra: "pepe" }, {}] },
    { categoria: "grupo", palabras: [{ palabra: "Toto", parecida: "Tito", pista: "Viaje" }] },
  ]);
  assert.ok(r.ok);
  assert.strictEqual(r.categorias.length, 1);
  assert.deepStrictEqual(r.categorias[0].palabras.map(p => p.palabra), ["Pepe", "Toto"]);
  assert.ok(r.avisos.some(a => a.includes("sin pista")));
});

/* ---------- Partida completa ---------- */
prueba("partida de Impostor con deshacer y adivinanza", () => {
  const cfg = { modo: "impostor", jugadores: nombres(5), categorias: ["Animales"], auto: false,
    cuentas: { pista: 1, categoria: 0, blanco: 0 }, opciones: Object.assign({}, P.impostor.opciones) };
  assert.ok(E.validarConfig(cfg, TEMAS).ok);
  const juego = E.crearJuego(null);
  juego.empezar(cfg, TEMAS);
  const S = () => juego.S;
  assert.strictEqual(S().tema.categoria, "Animales");
  const imp = S().jugadores.find(j => j.rol === "impostor").id;
  const civ = S().jugadores.filter(j => j.rol === "civil").map(j => j.id);
  assert.ok(juego.hacer("empezar", { azar: R.crearAzar(1) }).ok);
  assert.notStrictEqual(S().orden[0], imp);
  assert.ok(juego.hacer("aDebate", { pistas: { [civ[0]]: "Patas" } }).ok);
  assert.ok(juego.hacer("aVotar").ok);
  // Votación secreta: no se puede votar a uno mismo.
  assert.ok(!juego.hacer("votar", { votante: 0, votado: 0 }).ok);
  assert.ok(juego.hacer("eliminar", { id: civ[0] }).ok);
  assert.strictEqual(S().fase, "eliminado");
  juego.deshacer();
  assert.strictEqual(S().fase, "votacion");
  assert.ok(S().jugadores[civ[0]].vivo);
  assert.ok(juego.hacer("eliminar", { id: imp }).ok);
  assert.strictEqual(S().fase, "adivinar");
  assert.ok(juego.hacer("adivinar", { texto: "cualquiera" }).ok);
  assert.strictEqual(S().fase, "eliminado");
  assert.ok(juego.hacer("seguir").ok);
  assert.strictEqual(S().fase, "fin");
  assert.strictEqual(S().ganador, "civiles");
  const res = E.resultado(S());
  assert.strictEqual(res.jugadores.filter(j => j.puntos === 2).length, 4);
  // Revancha: otra palabra.
  const antes = S().tema.palabra;
  juego.revancha(TEMAS);
  assert.notStrictEqual(S().tema.palabra, antes);
  assert.strictEqual(S().usados.length, 2);
});

prueba("el impostor que adivina gana solo", () => {
  const cfg = { modo: "impostor", jugadores: nombres(4), categorias: null, auto: false,
    cuentas: { pista: 0, categoria: 0, blanco: 1 }, opciones: Object.assign({}, P.impostor.opciones) };
  const juego = E.crearJuego(null);
  juego.empezar(cfg, TEMAS);
  const imp = juego.S.jugadores.find(j => j.rol === "impostor").id;
  ["empezar", "aDebate", "aVotar"].forEach(a => assert.ok(juego.hacer(a).ok));
  juego.hacer("eliminar", { id: imp });
  juego.hacer("adivinar", { texto: juego.S.tema.palabra.toUpperCase() });
  assert.strictEqual(juego.S.ganador, "adivino");
  assert.strictEqual(juego.S.puntos[imp], 6);
});

prueba("Infiltrado: empate, revotación y victoria de los infiltrados", () => {
  const cfg = { modo: "infiltrado", jugadores: nombres(4), categorias: null, auto: false,
    cuentas: { infiltrado: 1, blanco: 0 }, opciones: Object.assign({}, P.infiltrado.opciones) };
  const juego = E.crearJuego(null);
  juego.empezar(cfg, TEMAS);
  assert.ok(juego.S.tema.parecida);
  const inf = juego.S.jugadores.find(j => j.rol === "infiltrado").id;
  const civ = juego.S.jugadores.filter(j => j.rol === "civil").map(j => j.id);
  ["empezar", "aDebate", "aVotar"].forEach(a => juego.hacer(a));
  assert.ok(juego.hacer("revotar", { ids: [civ[0], civ[1]] }).ok);
  assert.ok(!juego.hacer("votar", { votante: inf, votado: civ[2] }).ok); // no está en la revotación
  assert.ok(juego.hacer("eliminar", { id: civ[0] }).ok);
  assert.strictEqual(juego.S.fase, "eliminado"); // el infiltrado no adivina
  juego.hacer("seguir");
  assert.strictEqual(juego.S.ronda, 2);
  ["aDebate", "aVotar"].forEach(a => juego.hacer(a));
  juego.hacer("eliminar", { id: civ[1] });
  juego.hacer("seguir");
  assert.strictEqual(juego.S.ganador, "otros");
  assert.strictEqual(juego.S.puntos[inf], 10);
});

/* ---------- Datos ---------- */
prueba("temas completos y sin repetir", () => {
  CATEGORIAS.filter(c => c !== "Cosas del grupo").forEach(c => {
    const ts = TEMAS.filter(t => t.categoria === c);
    assert.ok(ts.length >= 30 && ts.length <= 40, `${c}: ${ts.length} palabras`);
    ts.forEach(t => assert.ok(t.palabra && t.parecida && t.pista, `${c}: ${t.palabra}`));
    ts.forEach(t => assert.ok(!R.iguales(t.palabra, t.parecida), `${c}: ${t.palabra} = parecida`));
    const claves = ts.map(t => R.normalizar(t.palabra));
    assert.strictEqual(new Set(claves).size, claves.length, `${c}: hay palabras repetidas`);
  });
});

prueba("lugares de El Espía", () => {
  assert.ok(LUGARES.length >= 30);
  LUGARES.forEach(l => assert.ok(l.roles.length >= 6 && l.roles.length <= 10, l.lugar));
});

console.log(`${ok} bien, ${mal} mal`);
if (mal) process.exit(1);
