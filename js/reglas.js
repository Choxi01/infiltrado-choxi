// Lógica pura de Infiltrado Choxi: sin pantalla ni localStorage, para poder probarla con node.
// Sirve para los cuatro modos: el reparto de roles, los votos, quién gana, los puntos,
// comparar palabras y anular pistas repetidas de Una Palabra.
(function (raiz) {
  "use strict";

  const MIN_JUGADORES = 3;
  const MAX_JUGADORES = 20;

  // Tipos de carta que se reparten. rol: con quién juega. ve: qué le muestra la app al impostor.
  const TIPOS = {
    civil:      { rol: "civil",      ve: "palabra",   nombre: "Civil",                  emoji: "🙂" },
    infiltrado: { rol: "infiltrado", ve: "parecida",  nombre: "Infiltrado",             emoji: "🎭" },
    pista:      { rol: "impostor",   ve: "pista",     nombre: "Impostor con pista",     emoji: "🕵️" },
    categoria:  { rol: "impostor",   ve: "categoria", nombre: "Impostor con categoría", emoji: "🕵️" },
    blanco:     { rol: "impostor",   ve: "nada",      nombre: "Impostor sin nada",      emoji: "👻" },
  };

  /* ---------- Azar con semilla (para que los tests den siempre lo mismo) ---------- */
  function crearAzar(semilla) {
    let a = semilla >>> 0;
    return function () {
      a = (a + 0x6D2B79F5) >>> 0;
      let t = a;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  function barajar(lista, azar) {
    const a = lista.slice();
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(azar() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  }

  /* ---------- Reparto ---------- */
  // Cantidad sugerida de cada tipo según el preset y los jugadores: {pista: 1, blanco: 0, ...}.
  function sugerir(preset, n) {
    const c = {};
    Object.keys(preset.roles).forEach(t => {
      const v = preset.roles[t];
      c[t] = typeof v === "function" ? v(n) : v;
    });
    return c;
  }

  const contarOtros = cuentas => Object.keys(cuentas).reduce((t, k) => t + (k === "civil" ? 0 : cuentas[k] || 0), 0);
  const civiles = (cuentas, n) => n - contarOtros(cuentas);

  function validar(cuentas, n) {
    if (n < MIN_JUGADORES) return { ok: false, motivo: `Hacen falta al menos ${MIN_JUGADORES} jugadores.` };
    if (n > MAX_JUGADORES) return { ok: false, motivo: `Como mucho ${MAX_JUGADORES} jugadores.` };
    const otros = contarOtros(cuentas);
    if (otros < 1) return { ok: false, motivo: "Tiene que haber al menos un impostor o infiltrado." };
    const c = n - otros;
    if (c < 2 || c <= otros) return { ok: false, motivo: "Tiene que haber más civiles que impostores e infiltrados." };
    return { ok: true };
  }

  // Devuelve un tipo por jugador (en el orden de la lista de jugadores).
  function sortear(n, cuentas, azar) {
    const bolsa = [];
    Object.keys(cuentas).forEach(t => { for (let i = 0; i < (cuentas[t] || 0); i++) bolsa.push(t); });
    while (bolsa.length < n) bolsa.push("civil");
    return barajar(bolsa.slice(0, n), azar);
  }

  /* ---------- Temas ---------- */
  // Qué datos necesita cada tema según los roles en juego: el infiltrado usa la parecida, el impostor con pista la pista.
  function requisitos(cuentas) {
    return { parecida: (cuentas.infiltrado || 0) > 0, pista: (cuentas.pista || 0) > 0 };
  }

  // categorias: lista de nombres, o null para todas.
  function temasPosibles(temas, cuentas, categorias) {
    const req = requisitos(cuentas);
    return temas.filter(t => t.palabra &&
      (!categorias || categorias.includes(t.categoria)) &&
      (!req.parecida || t.parecida) && (!req.pista || t.pista));
  }

  const claveTema = t => normalizar(`${t.categoria}|${t.palabra}`);

  // Elige un tema que no haya salido. Si ya salieron todos los posibles, vuelve a empezar con esos.
  function elegirTema(posibles, usados, azar) {
    if (!posibles.length) return { tema: null, usados };
    let u = usados.slice();
    let libres = posibles.filter(t => !u.includes(claveTema(t)));
    if (!libres.length) {
      const claves = posibles.map(claveTema);
      u = u.filter(k => !claves.includes(k));
      libres = posibles;
    }
    const tema = libres[Math.floor(azar() * libres.length)];
    u.push(claveTema(tema));
    return { tema, usados: u };
  }

  /* ---------- Ronda de pistas ---------- */
  // Orden de la ronda: arranca alguien al azar y sigue la ronda de la mesa (orden de la lista).
  // Nunca empieza un "en blanco"; un impostor solo si la opción lo permite.
  function ordenPistas(vivos, azar, impostorEmpieza) {
    if (!vivos.length) return [];
    let candidatos = vivos.filter(j => j.ve !== "nada" && (impostorEmpieza || j.rol !== "impostor"));
    if (!candidatos.length) candidatos = vivos.filter(j => j.ve !== "nada");
    if (!candidatos.length) candidatos = vivos;
    const primero = candidatos[Math.floor(azar() * candidatos.length)];
    const i = vivos.indexOf(primero);
    return vivos.slice(i).concat(vivos.slice(0, i)).map(j => j.id);
  }

  /* ---------- Votos ---------- */
  // votos: {votante: votado}. Devuelve conteo por votado, el máximo y los más votados.
  function contarVotos(votos) {
    const conteo = {};
    Object.keys(votos).forEach(k => {
      const v = votos[k];
      if (v != null) conteo[v] = (conteo[v] || 0) + 1;
    });
    const max = Math.max(0, ...Object.values(conteo));
    const lideres = max ? Object.keys(conteo).filter(k => conteo[k] === max).map(Number) : [];
    return { conteo, max, lideres };
  }

  /* ---------- Quién gana (Impostor / Infiltrado) ---------- */
  // Por rondas: civiles sin rivales vivos → ganan. Los otros ganan cuando son tantos como los civiles
  // (o, con la opción finOtros "dos", cuando quedan 2 jugadores).
  function ganador(jugadores, op) {
    const vivos = jugadores.filter(j => j.vivo);
    const otros = vivos.filter(j => j.rol !== "civil").length;
    const civ = vivos.length - otros;
    if (!otros) return "civiles";
    if (op && op.finOtros === "dos" ? vivos.length <= 2 : otros >= civ) return "otros";
    return null;
  }

  // Después de una eliminación (eliminadoId null: no salió nadie).
  // Votación única: si no le aciertan a un impostor o infiltrado en la primera, ganan ellos.
  function ganadorTrasEliminar(jugadores, eliminadoId, op) {
    if (op && op.votacion === "unica") {
      const e = eliminadoId == null ? null : jugadores[eliminadoId];
      return e && e.rol !== "civil" ? "civiles" : "otros";
    }
    return ganador(jugadores, op);
  }

  // Puntos de la partida: {id: puntos}. ganador: civiles | otros | adivino (solo el que adivinó).
  function puntos(jugadores, gano, adivinoId, tabla) {
    const p = {};
    jugadores.forEach(j => {
      let n = 0;
      if (gano === "civiles" && j.rol === "civil") n = tabla.civil;
      if (gano === "otros" && j.rol !== "civil") n = tabla[j.rol];
      if (gano === "adivino" && j.id === adivinoId) n = tabla.impostor;
      p[j.id] = n || 0;
    });
    return p;
  }

  /* ---------- Comparar palabras ---------- */
  // Minúsculas, sin tildes ni signos, espacios simples. "¡Árbol!" → "arbol".
  function normalizar(s) {
    return String(s == null ? "" : s).toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "")
      .replace(/[^a-z0-9ñ ]+/g, " ").replace(/\s+/g, " ").trim();
  }

  // Formas posibles en singular (simple): "perros" → perro, "flores" → flor, "luces" → luz.
  function formas(t) {
    const f = [t];
    if (t.length > 3 && t.endsWith("s")) f.push(t.slice(0, -1));
    if (t.length > 4 && t.endsWith("es")) f.push(t.slice(0, -2));
    if (t.length > 4 && t.endsWith("ces")) f.push(t.slice(0, -3) + "z");
    return f;
  }

  // ¿Es la misma palabra? Sin importar tildes, mayúsculas ni plural simple.
  function iguales(a, b) {
    const x = normalizar(a), y = normalizar(b);
    if (!x || !y) return false;
    const fy = formas(y);
    return formas(x).some(f => fy.includes(f));
  }

  /* ---------- Una Palabra ---------- */
  const pistasPorJugador = n => (n === 3 ? 2 : 1);

  // Anula las pistas idénticas (todas las copias) y las que contienen la palabra misteriosa.
  // pistas: [{texto, ...}] → misma lista con {anulada, motivo}.
  function anularPistas(pistas, misteriosa) {
    const m = normalizar(misteriosa);
    const fm = formas(m).filter(f => f.length >= 3);
    return pistas.map((p, i) => {
      const t = normalizar(p.texto);
      let motivo = null;
      if (!t) motivo = "vacía";
      else if (iguales(t, m) || fm.some(f => t.replace(/ /g, "").includes(f.replace(/ /g, "")))) motivo = "es la palabra";
      else if (pistas.some((q, k) => k !== i && iguales(q.texto, t))) motivo = "repetida";
      return Object.assign({}, p, { anulada: !!motivo, motivo });
    });
  }

  // Juega una carta: acerto (+1), paso (se pierde esa) o fallo (se pierde esa y la siguiente).
  // up: {total, i, aciertos, perdidas}. Devuelve uno nuevo; fin cuando i >= total.
  function jugarCarta(up, resultado) {
    const n = Object.assign({}, up);
    if (resultado === "acerto") { n.aciertos += 1; n.i += 1; }
    else if (resultado === "paso") { n.perdidas += 1; n.i += 1; }
    else if (resultado === "fallo") {
      const quedan = n.total - n.i;
      const pierde = Math.min(2, quedan);
      n.perdidas += pierde; n.i += pierde;
    }
    n.fin = n.i >= n.total;
    return n;
  }

  function fraseUnaPalabra(p) {
    if (p >= 13) return "¡Perfecto! Ni un error: son una sola mente.";
    if (p === 12) return "¡Increíble! A un pelo de la perfección.";
    if (p === 11) return "¡Muy bien! Se leen la mente.";
    if (p >= 9) return "Bien: se nota que se conocen.";
    if (p >= 7) return "Más o menos: hay que practicar.";
    if (p >= 4) return "Flojito: ¿seguro que son amigos?";
    return "A practicar, y mucho.";
  }

  /* ---------- El Espía ---------- */
  // Reloj sugerido: 8 minutos, uno más por cada jugador desde 9, hasta 10.
  const relojEspia = n => Math.min(600, Math.max(480, (n - 1) * 60));

  // ¿Alcanzan los "sí" para condenar? Votan todos menos el acusado.
  // Con un espía tiene que ser unánime; con dos alcanza con todos menos un voto (todos los jugadores menos dos).
  function condena(si, votantes, dosEspias) {
    return dosEspias ? si >= votantes - 1 : si === votantes;
  }

  // final: tiempo (nadie condenado) | inocente (condenaron a un inocente) | acierta (se plantó y acertó)
  //        | atrapado (condenaron al espía) | falla (se plantó y erró).
  // Devuelve {id: puntos} para todos los ids.
  function puntosEspia(ids, espias, final, acusador) {
    const p = {};
    ids.forEach(id => {
      const espia = espias.includes(id);
      let n = 0;
      if (espia && final === "tiempo") n = 2;
      if (espia && (final === "inocente" || final === "acierta")) n = 4;
      if (!espia && (final === "atrapado" || final === "falla")) n = 1;
      if (!espia && final === "atrapado" && id === acusador) n = 2;
      p[id] = n;
    });
    return p;
  }

  /* ---------- Mis palabras ---------- */
  // Revisa lo que viene de un archivo o del formulario: [{categoria, palabras: [{palabra, parecida, pista}]}].
  // Devuelve {ok, categorias, avisos} o {ok:false, motivo}.
  function limpiarCategorias(datos) {
    if (!Array.isArray(datos)) return { ok: false, motivo: "El archivo no tiene una lista de categorías." };
    const txt = v => (typeof v === "string" ? v.trim().replace(/\s+/g, " ").slice(0, 60) : "");
    const categorias = [], avisos = [];
    for (let i = 0; i < datos.length; i++) {
      const c = datos[i] || {};
      const nombre = txt(c.categoria);
      if (!nombre) return { ok: false, motivo: `La categoría ${i + 1} no tiene nombre.` };
      if (!Array.isArray(c.palabras)) return { ok: false, motivo: `«${nombre}» no tiene lista de palabras.` };
      const palabras = [];
      let sinParecida = 0, sinPista = 0;
      for (let k = 0; k < c.palabras.length; k++) {
        const w = c.palabras[k] || {};
        const p = { palabra: txt(w.palabra), parecida: txt(w.parecida), pista: txt(w.pista) };
        if (!p.palabra && !p.parecida && !p.pista) continue;
        if (!p.palabra) return { ok: false, motivo: `«${nombre}», fila ${k + 1}: falta la palabra.` };
        if (palabras.some(x => iguales(x.palabra, p.palabra))) continue;
        if (!p.parecida) sinParecida++;
        if (!p.pista) sinPista++;
        palabras.push(p);
      }
      if (sinParecida) avisos.push(`«${nombre}»: ${sinParecida} sin parecida (no salen en Infiltrado).`);
      if (sinPista) avisos.push(`«${nombre}»: ${sinPista} sin pista (no salen para el impostor con pista).`);
      const previa = categorias.find(x => normalizar(x.categoria) === normalizar(nombre));
      if (previa) palabras.forEach(p => { if (!previa.palabras.some(x => iguales(x.palabra, p.palabra))) previa.palabras.push(p); });
      else categorias.push({ categoria: nombre, palabras });
    }
    return { ok: true, categorias, avisos };
  }

  const api = {
    MIN_JUGADORES, MAX_JUGADORES, TIPOS,
    crearAzar, barajar, sugerir, civiles, contarOtros, validar, sortear,
    requisitos, temasPosibles, claveTema, elegirTema, ordenPistas, contarVotos,
    ganador, ganadorTrasEliminar, puntos, normalizar, formas, iguales,
    pistasPorJugador, anularPistas, jugarCarta, fraseUnaPalabra,
    relojEspia, condena, puntosEspia, limpiarCategorias,
  };
  raiz.InfReglas = api;
  if (typeof module !== "undefined" && module.exports) module.exports = api;
})(typeof window !== "undefined" ? window : globalThis);
