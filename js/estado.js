// Estado de la partida (Impostor / Infiltrado) y sus acciones.
// Cada acción recibe (S, datos), modifica S y devuelve {ok:true} o {ok:false, motivo}.
// crearJuego() agrega "deshacer" guardando una copia del estado antes de cada acción.
(function (raiz) {
  "use strict";
  const req = typeof require !== "undefined" ? require : null;
  const R = raiz.InfReglas || req("./reglas.js");
  const P = raiz.PRESETS || req("./presets.js");

  const VERSION = 1;
  const MAX_DESHACER = 80;
  const clonar = o => JSON.parse(JSON.stringify(o));
  const NO = motivo => ({ ok: false, motivo });
  const SI = { ok: true };

  function configPorDefecto() {
    const p = P.impostor;
    return { modo: p.id, jugadores: [], categorias: null, auto: true, cuentas: R.sugerir(p, 4), opciones: clonar(p.opciones) };
  }

  // Con qué datos sale la partida: si no hay temas posibles, motivo.
  function validarConfig(cfg, temas) {
    const v = R.validar(cfg.cuentas, cfg.jugadores.length);
    if (!v.ok) return v;
    if (!R.temasPosibles(temas, cfg.cuentas, cfg.categorias).length) {
      const r = R.requisitos(cfg.cuentas);
      const falta = r.parecida ? "palabra parecida" : r.pista ? "pista" : "palabras";
      return NO(`Las categorías elegidas no tienen palabras${falta === "palabras" ? "" : " con " + falta}.`);
    }
    return SI;
  }

  function nuevaPartida(cfg, temas, usados, azar) {
    azar = azar || Math.random;
    const posibles = R.temasPosibles(temas, cfg.cuentas, cfg.categorias);
    const e = R.elegirTema(posibles, usados || [], azar);
    const tipos = R.sortear(cfg.jugadores.length, cfg.cuentas, azar);
    return {
      v: VERSION,
      id: String(Date.now()),       // identifica la partida en el marcador
      cfg: clonar(cfg),
      tema: e.tema, usados: e.usados,
      fase: "reparto",              // reparto → pistas → debate → votacion → [adivinar] → eliminado → pistas… → fin
      ronda: 0,
      jugadores: cfg.jugadores.map((nombre, id) => crearJugador(id, nombre, tipos[id])),
      orden: [],                    // ids en el orden de la ronda de pistas
      votos: {},                    // votación secreta: {votante: votado}
      segunda: null,                // ids entre los que se revota
      eliminado: null,              // id del último eliminado (null: no salió nadie)
      adivinanza: null,             // {texto, acierta}
      ganador: null, adivino: null, puntos: null,
      registro: [],
    };
  }

  function crearJugador(id, nombre, tipo) {
    const t = R.TIPOS[tipo];
    return { id, nombre, tipo, rol: t.rol, ve: t.ve, vivo: true, visto: false };
  }

  /* ---------- Utilidades ---------- */
  const preset = S => P[S.cfg.modo];
  const op = S => S.cfg.opciones;
  const vivos = S => S.jugadores.filter(j => j.vivo);
  const vivo = (S, id) => id != null && S.jugadores[id] && S.jugadores[id].vivo;
  const nombre = (S, id) => S.jugadores[id].nombre;
  const nombreTipo = (S, j) => preset(S).nombres[j.tipo] || R.TIPOS[j.tipo].nombre;
  const candidatos = S => vivos(S).filter(j => !S.segunda || S.segunda.includes(j.id));

  function log(S, texto) { S.registro.push({ r: S.ronda, f: S.fase, t: texto }); }

  function nuevaRonda(S, azar) {
    S.ronda += 1;
    S.fase = "pistas";
    S.orden = R.ordenPistas(vivos(S), azar || Math.random, op(S).impostorEmpieza);
    S.votos = {}; S.segunda = null; S.eliminado = null; S.adivinanza = null;
    log(S, `▶ Empieza ${nombre(S, S.orden[0])}. Orden: ${S.orden.map(id => nombre(S, id)).join(", ")}.`);
  }

  function terminar(S, gano, adivinoId) {
    S.fase = "fin";
    S.ganador = gano;
    S.adivino = adivinoId == null ? null : adivinoId;
    S.puntos = R.puntos(S.jugadores, gano, S.adivino, preset(S).puntos);
    const t = S.tema;
    log(S, `🏁 ${gano === "civiles" ? "Ganan los civiles" : gano === "otros" ? preset(S).ganaOtros.replace(/[¡!]/g, "") : `${nombre(S, adivinoId)} adivinó y gana solo`}.`);
    log(S, `🔑 Palabra: ${t.palabra}${S.jugadores.some(j => j.rol === "infiltrado") ? ` · parecida: ${t.parecida}` : ""} (${t.categoria}).`);
    log(S, "🎴 " + S.jugadores.filter(j => j.rol !== "civil").map(j => `${j.nombre}: ${nombreTipo(S, j)}`).join(" · ") + ".");
  }

  /* ---------- Acciones ---------- */
  const acciones = {
    verRol(S, d) {
      if (S.fase !== "reparto") return NO("El reparto ya terminó.");
      if (!S.jugadores[d.id]) return NO("No existe ese jugador.");
      S.jugadores[d.id].visto = true;
      return SI;
    },

    // Palabra y roles nuevos (por si alguien vio lo que no tenía que ver).
    resortear(S, d) {
      if (S.fase !== "reparto") return NO("Ya empezó la partida.");
      const n = nuevaPartida(S.cfg, d.temas || [], S.usados, d.azar);
      if (!n.tema) return NO("No hay palabras para sortear.");
      S.tema = n.tema; S.usados = n.usados; S.jugadores = n.jugadores;
      return SI;
    },

    empezar(S, d) {
      if (S.fase !== "reparto") return NO("La partida ya empezó.");
      nuevaRonda(S, d.azar);
      return SI;
    },

    // d.pistas: {id: texto} anotadas (opcional), para el registro.
    aDebate(S, d) {
      if (S.fase !== "pistas") return NO("No estamos en la ronda de pistas.");
      const p = d.pistas || {};
      const anotadas = S.orden.filter(id => p[id] && String(p[id]).trim());
      if (anotadas.length) log(S, "💬 Pistas: " + anotadas.map(id => `${nombre(S, id)}: «${String(p[id]).trim().slice(0, 40)}»`).join(" · ") + ".");
      S.fase = "debate";
      return SI;
    },

    aVotar(S) {
      if (S.fase !== "debate") return NO("No estamos en el debate.");
      S.fase = "votacion";
      return SI;
    },

    // Votación secreta: un voto por jugador vivo.
    votar(S, d) {
      if (S.fase !== "votacion") return NO("No es momento de votar.");
      if (!vivo(S, d.votante)) return NO("Ese jugador no vota.");
      if (d.votante === d.votado) return NO("No te podés votar a vos.");
      if (!candidatos(S).some(j => j.id === d.votado)) return NO("No se puede votar a ese jugador.");
      S.votos[d.votante] = d.votado;
      return SI;
    },

    // Empate: se revota solo entre los empatados.
    revotar(S, d) {
      if (S.fase !== "votacion") return NO("No es momento de votar.");
      const ids = (d.ids || []).filter(id => vivo(S, id));
      if (ids.length < 2) return NO("Para revotar hacen falta al menos dos empatados.");
      log(S, `🔁 Empate entre ${ids.map(id => nombre(S, id)).join(" y ")}: se revota.`);
      S.segunda = ids; S.votos = {};
      return SI;
    },

    // d.id: el más votado; d.nadie: no sale nadie (empate sin revotar).
    eliminar(S, d) {
      if (S.fase !== "votacion") return NO("No es momento de eliminar.");
      const c = R.contarVotos(S.votos);
      if (c.max) log(S, `🗳️ Votos: ${c.lideres.concat(Object.keys(c.conteo).map(Number).filter(id => !c.lideres.includes(id)))
        .map(id => `${nombre(S, id)} ${c.conteo[id]}`).join(" · ")}.`);
      if (d.nadie) {
        S.eliminado = null;
        log(S, "⚖ No se eliminó a nadie.");
        S.fase = "eliminado";
        return SI;
      }
      if (!vivo(S, d.id)) return NO("Tocá a quién eliminan.");
      const j = S.jugadores[d.id];
      j.vivo = false;
      S.eliminado = j.id;
      log(S, `⚖ Eliminado: ${j.nombre}${op(S).revelar ? ` (${nombreTipo(S, j)})` : ""}.`);
      S.fase = j.rol === "impostor" && op(S).adivinar ? "adivinar" : "eliminado";
      return SI;
    },

    // El impostor eliminado dice una palabra. d.aceptar: el grupo la da por buena.
    adivinar(S, d) {
      if (S.fase !== "adivinar") return NO("No es momento de adivinar.");
      const texto = String(d.texto || "").trim().slice(0, 40);
      const acierta = !!d.aceptar || R.iguales(texto, S.tema.palabra);
      S.adivinanza = { texto, acierta };
      log(S, `🎯 ${nombre(S, S.eliminado)} ${texto ? `dijo «${texto}»` : "no dijo nada"}: ${acierta ? (d.aceptar ? "el grupo la dio por buena" : "¡acertó!") : "no acertó"}.`);
      if (acierta) terminar(S, "adivino", S.eliminado);
      else S.fase = "eliminado";
      return SI;
    },

    // Después de la eliminación: ¿terminó? Si no, otra ronda de pistas.
    seguir(S, d) {
      if (S.fase !== "eliminado") return NO("No hay nada para seguir.");
      const g = R.ganadorTrasEliminar(S.jugadores, S.eliminado, op(S));
      if (g) terminar(S, g);
      else nuevaRonda(S, d.azar);
      return SI;
    },
  };

  /* ---------- Marcador de la sesión ---------- */
  function resultado(S) {
    if (!S || S.fase !== "fin") return null;
    const ganaron = S.jugadores.filter(j => S.puntos[j.id] > 0).map(j => j.id);
    return {
      id: S.id, modo: S.cfg.modo, ganador: S.ganador,
      jugadores: S.jugadores.map(j => ({ nombre: j.nombre, puntos: S.puntos[j.id], gano: ganaron.includes(j.id) })),
    };
  }

  // {partidas, jugadores: [{nombre, puntos, ganadas, jugadas}]} ordenado por puntos.
  function marcador(resultados) {
    const m = { partidas: 0, jugadores: [] };
    const por = {};
    resultados.forEach(r => {
      m.partidas += 1;
      r.jugadores.forEach(j => {
        const k = j.nombre.toLowerCase();
        if (!por[k]) { por[k] = { nombre: j.nombre, puntos: 0, ganadas: 0, jugadas: 0 }; m.jugadores.push(por[k]); }
        por[k].puntos += j.puntos; por[k].jugadas += 1;
        if (j.gano) por[k].ganadas += 1;
      });
    });
    m.jugadores.sort((a, b) => b.puntos - a.puntos || b.ganadas - a.ganadas || a.nombre.localeCompare(b.nombre));
    return m;
  }

  /* ---------- Juego con deshacer ---------- */
  function crearJuego(guardado) {
    let S = guardado && guardado.S && guardado.S.v === VERSION ? guardado.S : null;
    let pila = S && Array.isArray(guardado.pila) ? guardado.pila : [];
    function recortar() { while (pila.length > MAX_DESHACER) pila.shift(); }
    return {
      get S() { return S; },
      get puedeDeshacer() { return pila.length > 0; },
      empezar(cfg, temas) {
        const usados = S ? S.usados : [];
        if (S) pila.push(clonar(S));
        S = nuevaPartida(cfg, temas, usados); recortar();
      },
      revancha(temas) {
        pila.push(clonar(S));
        S = nuevaPartida(S.cfg, temas, S.usados); recortar();
      },
      hacer(nombreAccion, datos) {
        const copia = clonar(S);
        const r = acciones[nombreAccion](S, datos || {});
        if (r.ok) { pila.push(copia); recortar(); } else { S = copia; }
        return r;
      },
      deshacer() { if (pila.length) S = pila.pop(); },
      exportar() { return { S, pila }; },
    };
  }

  const api = {
    VERSION, configPorDefecto, validarConfig, nuevaPartida, acciones, crearJuego,
    vivos, candidatos, nombreTipo, preset, resultado, marcador,
  };
  raiz.InfEstado = api;
  if (typeof module !== "undefined" && module.exports) module.exports = api;
})(typeof window !== "undefined" ? window : globalThis);
