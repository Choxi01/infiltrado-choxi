// Pantalla: dibuja todo de nuevo en cada acción y conecta los botones (delegación de eventos por data-a).
(function () {
  "use strict";
  const R = window.InfReglas, P = window.PRESETS, E = window.InfEstado, M = window.MARCA;
  // El dominio choxi01.github.io es compartido con otras apps: todas las claves llevan prefijo.
  const PRE = "infiltrado:";
  const CLAVE = PRE + "partida", CLAVE_CFG = PRE + "config", CLAVE_MAR = PRE + "marcador",
    CLAVE_RELOJ = PRE + "reloj", CLAVE_MIS = PRE + "mis-palabras";
  const $ = id => document.getElementById(id);
  const esc = s => String(s).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
  const plural = (n, uno, varios) => `${n} ${n === 1 ? uno : varios}`;

  function leer(k) { try { return JSON.parse(localStorage.getItem(k)); } catch (e) { return null; } }
  function escribir(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} }

  let juego = E.crearJuego(leer(CLAVE));
  let cfg = Object.assign(E.configPorDefecto(), leer(CLAVE_CFG) || {});
  if (!P[cfg.modo] || !P[cfg.modo].disponible) cfg = E.configPorDefecto();
  cfg.opciones = Object.assign({}, P[cfg.modo].opciones, cfg.opciones);
  let mis = leer(CLAVE_MIS) || [{ categoria: "Cosas del grupo", palabras: [] }];
  let tab = "juego";
  let enConfig = !juego.S;
  let sel = selVacia();
  let velo = null;      // {tipo: "rol"|"voto", id, ver, fija, mirado}
  let discreto = false;
  let editando = null;  // Mis palabras: {i (-1 si es nueva), cat: borrador}
  const reloj = Object.assign({ clave: null, total: 0, resta: 0, corre: false, fin: 0 }, leer(CLAVE_RELOJ) || {});
  const mar = Object.assign({ partidas: {} }, leer(CLAVE_MAR) || {});

  // ids: elegidos a mano alzada. pistas: anotadas en la ronda. intento: adivinanza que no coincidió.
  function selVacia() { return { ids: [], pistas: {}, intento: null }; }
  const S = () => juego.S;
  const guardar = () => escribir(CLAVE, juego.exportar());
  const guardarCfg = () => escribir(CLAVE_CFG, cfg);
  const guardarMis = () => escribir(CLAVE_MIS, mis);
  const guardarReloj = () => escribir(CLAVE_RELOJ, reloj);

  // Temas de fábrica + Mis palabras.
  function temas() {
    const propios = [];
    mis.forEach(c => c.palabras.forEach(p => propios.push({ palabra: p.palabra, parecida: p.parecida || "", pista: p.pista || "", categoria: c.categoria })));
    return window.TEMAS.concat(propios);
  }
  function categorias() {
    const lista = window.CATEGORIAS.slice();
    mis.forEach(c => { if (!lista.includes(c.categoria)) lista.push(c.categoria); });
    return lista;
  }

  function hacer(accion, datos) {
    const r = juego.hacer(accion, datos);
    if (!r.ok) { aviso(r.motivo); return r; }
    sel = selVacia();
    guardar();
    render();
    window.scrollTo(0, 0);
    animar($("escena"), "entra");
    return r;
  }

  /* ---------- Aviso flotante ---------- */
  let avisoT = null;
  function aviso(texto, ms) {
    const t = $("toast");
    t.textContent = texto; t.hidden = false;
    clearTimeout(avisoT);
    avisoT = setTimeout(() => (t.hidden = true), ms || 2600);
  }
  function animar(el, clase) { el.classList.remove(clase); void el.offsetWidth; el.classList.add(clase); }

  /* ---------- Navegación ---------- */
  function irA(nuevo) {
    tab = nuevo;
    document.querySelectorAll(".tabs button").forEach(b => b.setAttribute("aria-selected", String(b.dataset.tab === tab)));
    $("config").hidden = !(tab === "juego" && enConfig);
    $("juego").hidden = !(tab === "juego" && !enConfig);
    ["mis", "reglas", "registro"].forEach(id => ($(id).hidden = tab !== id));
    if (history.replaceState) history.replaceState(null, "", "#" + tab);
    window.scrollTo(0, 0);
  }

  /* ======================================================================
     CONFIGURACIÓN
     ====================================================================== */
  const DESC = {
    infiltrado: "Tiene otra palabra parecida y no sabe que es distinta.",
    pista: "Sabe que es impostor y recibe una pista vaga.",
    categoria: "Sabe que es impostor y recibe la categoría.",
    blanco: "Sabe que no tiene palabra: no recibe nada. Nunca empieza.",
  };
  const nombreTipo = (preset, t) => preset.nombres[t] || R.TIPOS[t].nombre;

  function renderConfig() {
    const preset = P[cfg.modo];
    const n = cfg.jugadores.length, nn = Math.max(n, R.MIN_JUGADORES);
    if (cfg.auto) cfg.cuentas = R.sugerir(preset, nn);
    const cats = categorias();
    if (cfg.categorias) {
      cfg.categorias = cfg.categorias.filter(c => cats.includes(c));
      if (!cfg.categorias.length) cfg.categorias = null;
    }
    const T = temas();

    $("cuentaJug").textContent = n ? `· ${n}` : "";
    $("listaJug").innerHTML = n
      ? cfg.jugadores.map((nom, i) => `<span class="chip-jug">${esc(nom)}<button data-a="quitarJug" data-i="${i}" aria-label="Quitar a ${esc(nom)}">×</button></span>`).join("") +
        `<button class="link" data-a="borrarJug">Borrar todos</button>`
      : `<p class="vacio">Agregá a los que van a jugar, en el orden en que están sentados. Podés pegar varios nombres separados por coma.</p>`;

    $("modos").innerHTML = Object.values(P).map(p => `<button class="modo" data-a="modo" data-modo="${p.id}" aria-pressed="${p.id === cfg.modo}" ${p.disponible ? "" : "disabled"}>
      <span class="emoji">${p.emoji}</span><b>${p.nombre}</b>${p.disponible ? `<small>${esc(p.lema)}</small>` : `<span class="pronto">Próximamente</span>`}</button>`).join("");

    $("categorias").innerHTML = `<button class="cat" data-a="cat" data-cat="" aria-pressed="${!cfg.categorias}">Todas</button>` +
      cats.map(c => {
        const k = R.temasPosibles(T, cfg.cuentas, [c]).length;
        const on = !!cfg.categorias && cfg.categorias.includes(c);
        return `<button class="cat" data-a="cat" data-cat="${esc(c)}" aria-pressed="${on}" ${k || on ? "" : "disabled"}>${esc(c)} <small>${k}</small></button>`;
      }).join("");

    const tipos = Object.keys(preset.roles);
    const sug = R.sugerir(preset, nn);
    const textoSug = tipos.filter(t => sug[t]).map(t => `${sug[t]} ${nombreTipo(preset, t).toLowerCase()}`).join(" y ");
    $("roles").innerHTML = `<p class="reco">${n >= R.MIN_JUGADORES ? `Para <b>${n} jugadores</b> se sugiere ${textoSug}.` : `Mínimo ${R.MIN_JUGADORES} jugadores; mientras, se muestra una mesa de ${R.MIN_JUGADORES}.`}
        ${cfg.auto ? "" : `<button class="link" data-a="sugerir">Usar la sugerencia</button>`}</p>
      <div class="lista-roles">` + tipos.map(t => {
        const c = cfg.cuentas[t] || 0;
        return `<div class="fila-rol ${c ? "" : "apagado"}"><span class="emoji">${R.TIPOS[t].emoji}</span>
          <div class="txt"><b>${nombreTipo(preset, t)}</b><small>${DESC[t]}</small></div>
          <div class="stepper"><button class="paso-btn" data-a="menos" data-t="${t}" ${c <= 0 ? "disabled" : ""} aria-label="Uno menos">−</button>
          <span class="cant">${c}</span>
          <button class="paso-btn" data-a="mas" data-t="${t}" aria-label="Uno más">+</button></div></div>`;
      }).join("") +
      `<div class="fila-rol"><span class="emoji">🙂</span><div class="txt"><b>Civiles</b><small>El resto: tienen la palabra.</small></div>
        <div class="stepper"><span class="cant solo">${R.civiles(cfg.cuentas, nn)}</span></div></div></div>`;

    const o = cfg.opciones;
    const sino = (k, titulo, ayuda) => `<button class="opcion" role="switch" aria-checked="${!!o[k]}" data-a="opt" data-k="${k}" data-v="${o[k] ? "false" : "true"}">
      <span><b>${titulo}</b><small>${ayuda}</small></span><span class="interruptor" aria-hidden="true"></span></button>`;
    const seg = (k, titulo, ayuda, valores) => `<div class="opcion con-seg"><div><b>${titulo}</b><small>${ayuda}</small></div>
      <div class="seg">${valores.map(([v, txt]) => `<button data-a="opt" data-k="${k}" data-v='${JSON.stringify(v)}' aria-pressed="${o[k] === v}">${txt}</button>`).join("")}</div></div>`;
    const otros = cfg.modo === "infiltrado" ? "los infiltrados" : "los impostores";
    $("opciones").innerHTML =
      seg("votacion", "Votación", o.votacion === "unica" ? `Una sola: si no aciertan, ganan ${otros}.` : "Se elimina a uno por ronda hasta que gane un bando.",
        [["rondas", "Por rondas"], ["unica", "Única"]]) +
      seg("voto", "Cómo se vota", o.voto === "secreta" ? "Se pasa el celu y cada uno vota en privado." : "Todos señalan a la vez y se toca al más votado.",
        [["mano", "A mano alzada"], ["secreta", "Secreta"]]) +
      seg("empate", "Si hay empate", "Entre los más votados.", [["revotar", "Se revota"], ["nadie", "No sale nadie"]]) +
      (o.votacion === "rondas" ? seg("finOtros", `Ganan ${otros} cuando…`, "Si siguen vivos.", [["iguales", "Son tantos como los civiles"], ["dos", "Quedan 2 jugadores"]]) : "") +
      sino("revelar", "Revelar el rol al eliminar", "Se dice si el eliminado era civil o no.") +
      sino("adivinar", "El impostor eliminado adivina", "Si adivina la palabra, gana él solo.") +
      sino("impostorEmpieza", "El impostor puede empezar", "Si no, siempre arranca alguien con la palabra.") +
      seg("debate", "Reloj del debate", "Cuenta regresiva con sonido y vibración.", [[0, "Sin reloj"], [60, "1′"], [120, "2′"], [180, "3′"], [300, "5′"]]);

    const v = E.validarConfig(cfg, T);
    $("errorConfig").hidden = v.ok || n === 0;
    $("errorConfig").textContent = v.ok ? "" : v.motivo;
    $("volver").hidden = !S();
  }

  function agregarJugadores(texto) {
    const nuevos = texto.split(/[,\n;]+/).map(s => s.trim().replace(/\s+/g, " ")).filter(Boolean);
    let repetidos = 0;
    nuevos.forEach(nom => {
      nom = nom.slice(0, 16);
      if (cfg.jugadores.some(x => x.toLowerCase() === nom.toLowerCase())) { repetidos++; return; }
      if (cfg.jugadores.length < R.MAX_JUGADORES) cfg.jugadores.push(nom);
    });
    if (repetidos) aviso(repetidos === 1 ? "Ese nombre ya está." : "Algunos nombres ya estaban.");
    guardarCfg(); renderConfig();
  }

  /* ======================================================================
     PARTIDA
     ====================================================================== */
  const FASES = { reparto: "Reparto", pistas: "Pistas", debate: "Debate", votacion: "Votación", adivinar: "Adivinanza", eliminado: "Eliminación", fin: "Final" };

  function renderJuego() {
    const s = S();
    if (!s) return;
    const p = E.preset(s);
    $("barra").innerHTML = `<span class="chip fuerte">${s.ronda && s.fase !== "fin" ? `Ronda ${s.ronda} · ` : ""}${FASES[s.fase]}</span>
      <span class="chip" title="${p.nombre}">${p.emoji}</span>
      <span class="chip" title="Jugadores en juego">👥 ${E.vivos(s).length}</span>
      <span class="espacio"></span>
      <button class="icono" data-a="discreto" aria-pressed="${discreto}" title="Ocultar lo secreto" aria-label="Ocultar lo secreto">${discreto ? "🙈" : "👁"}</button>
      <button class="icono" data-a="nueva" title="Nueva partida" aria-label="Nueva partida">＋</button>`;
    const f = { reparto: escenaReparto, pistas: escenaPistas, debate: escenaDebate, votacion: escenaVotacion,
      adivinar: escenaAdivinar, eliminado: escenaEliminado, fin: escenaFin }[s.fase];
    $("escena").classList.remove("entra");
    $("escena").innerHTML = f(s);
    if (s.fase === "debate") prepararReloj(s);
    pintarReloj();
  }

  const pie = botones => `<div class="pie">${botones}</div>`;
  const btnDeshacer = () => `<button class="btn" data-a="deshacer" ${juego.puedeDeshacer ? "" : "disabled"}>↶ Deshacer</button>`;
  const falta = texto => `<button class="btn-principal" aria-disabled="true" data-a="falta" data-v="${esc(texto)}">👆 ${texto}</button>`;
  const nom = (s, id) => esc(s.jugadores[id].nombre);

  /* ---------- Reparto ---------- */
  function escenaReparto(s) {
    const vistos = s.jugadores.filter(j => j.visto).length;
    return `<h1>Reparto</h1>
      <p class="aviso">Pasá el celu: cada uno toca su nombre, mantiene apretado para ver su palabra y se lo pasa al siguiente.</p>
      <div class="grilla">${s.jugadores.map(j => `<button class="jug ${j.visto ? "listo" : ""}" data-a="ver" data-id="${j.id}">${esc(j.nombre)}${j.visto ? " ✓" : ""}</button>`).join("")}</div>
      <p class="progreso">${vistos} de ${s.jugadores.length} ya vieron su palabra</p>
      <button class="link" data-a="resortear">🎲 Volver a sortear (palabra y roles nuevos)</button>` +
      pie(`${btnDeshacer()}<button class="btn-principal" data-a="empezar">▶ Empezar la ronda</button>`);
  }

  function cartaRol(s, j) {
    const p = E.preset(s);
    if (j.rol === "impostor") {
      const ayuda = j.ve === "pista" ? `Tu pista: <b>${esc(s.tema.pista)}</b>`
        : j.ve === "categoria" ? `Categoría: <b>${esc(s.tema.categoria)}</b>` : "No tenés ninguna pista.";
      return `<div class="carta-caja r-impostor"><div class="carta-emoji">${R.TIPOS[j.tipo].emoji}</div>
        <p class="tenue">${esc(j.nombre)}</p><h1 class="grande">${p.tituloImpostor}</h1>
        <p class="pista-imp">${ayuda}</p>
        <p>Escuchá a los demás y mezclate.${s.cfg.opciones.adivinar ? " Si te descubren, vas a poder adivinar la palabra." : ""}</p>`;
    }
    const palabra = j.rol === "infiltrado" ? s.tema.parecida : s.tema.palabra;
    return `<div class="carta-caja"><p class="tenue">${esc(j.nombre)}, tu palabra es</p>
      <h1 class="palabra">${esc(palabra)}</h1>
      <p>No la digas: cuando te toque, decí una sola palabra que tenga que ver.</p>`;
  }

  function htmlCarta() {
    const s = S(), j = s.jugadores[velo.id];
    return `<div class="carta ${velo.fija ? "fija" : ""}" id="carta">${cartaRol(s, j)}
      ${velo.fija ? `<button class="btn-principal grande" data-a="ocultar">Ocultar</button>` : `<p class="tenue">Soltá para ocultar</p>`}</div></div>`;
  }

  function renderVelo() {
    const v = $("velo");
    const s = S();
    if (!velo || !s) { v.hidden = true; v.innerHTML = ""; return; }
    const j = s.jugadores[velo.id];
    v.hidden = false;
    if (velo.tipo === "voto") { v.innerHTML = veloVoto(s, j); return; }
    v.innerHTML = `<div class="velo-caja">
        <p class="tenue">Pasale el celu a</p>
        <h1 class="grande">${esc(j.nombre)}</h1>
        <p class="tenue">Que nadie más mire la pantalla.</p>
        <button class="mantener" data-hold><span aria-hidden="true">👆</span>Mantené apretado para ver</button>
        ${velo.mirado ? `<button class="btn-principal grande" data-a="listoVer">Listo, ya lo vi</button>` : ""}
        <button class="btn" data-a="verFijo">Ver sin mantener apretado</button>
        <button class="link" data-a="cerrarVelo">Cancelar</button></div>` + (velo.ver ? htmlCarta() : "");
  }

  function veloVoto(s, j) {
    if (!velo.ver) return `<div class="velo-caja">
      <p class="tenue">Pasale el celu a</p><h1 class="grande">${esc(j.nombre)}</h1>
      <p class="tenue">Vota en secreto: que nadie más mire.</p>
      <button class="btn-principal grande" data-a="mostrarVoto">Soy ${esc(j.nombre)}: votar</button>
      <button class="link" data-a="cerrarVelo">Cancelar</button></div>`;
    const cands = E.candidatos(s).filter(c => c.id !== j.id);
    return `<div class="velo-caja"><h1>${esc(j.nombre)}, ¿a quién eliminás?</h1>
      <div class="grilla">${cands.map(c => `<button class="jug" data-a="votarA" data-id="${c.id}">${esc(c.nombre)}</button>`).join("")}</div>
      <button class="link" data-a="cerrarVelo">Cancelar</button></div>`;
  }

  /* ---------- Pistas y debate ---------- */
  function escenaPistas(s) {
    return `<div class="paso-num">Ronda ${s.ronda}</div><h1>Ronda de pistas</h1>
      <p class="decir">Empieza <b>${nom(s, s.orden[0])}</b>. Cada uno dice <b>una sola palabra</b>, en este orden.</p>
      <ol class="orden">${s.orden.map((id, i) => `<li><span class="num">${i + 1}</span><b>${nom(s, id)}</b>
        <input data-pista="${id}" maxlength="40" placeholder="Anotar (opcional)" value="${esc(sel.pistas[id] || "")}" aria-label="Pista de ${nom(s, id)}" enterkeyhint="next"></li>`).join("")}</ol>
      <ul class="reglitas"><li>Decir la palabra</li><li>Pedir aclaraciones</li><li>Comentar mientras otro habla</li></ul>` +
      pie(`${btnDeshacer()}<button class="btn-principal" data-a="aDebate">🗣️ Al debate</button>`);
  }

  function escenaDebate(s) {
    const seg = s.cfg.opciones.debate;
    return `<div class="paso-num">Ronda ${s.ronda}</div><h1>Debate</h1>
      <p class="decir">¿Quién tiene otra palabra? Acusen, defiéndanse y pónganse de acuerdo.</p>
      ${seg ? `<div class="reloj"><div class="reloj-num" id="relojNum">0:00</div>
        <div class="reloj-btns"><button class="btn" data-a="reloj" data-v="play" id="relojPlay">▶ Empezar</button>
        <button class="btn" data-a="reloj" data-v="mas">+30″</button><button class="btn" data-a="reloj" data-v="reset">↺</button></div></div>`
        : `<p class="nota">Sin reloj: voten cuando estén listos.</p>`}` +
      pie(`${btnDeshacer()}<button class="btn-principal" data-a="aVotar">🗳️ A votar</button>`);
  }

  /* ---------- Votación ---------- */
  function botonEmpate(s, ids) {
    return s.cfg.opciones.empate === "revotar"
      ? `<button class="btn-principal" data-a="revotar" data-ids="${ids.join(",")}">🔁 Empate: revotar entre ${ids.length}</button>`
      : `<button class="btn-principal" data-a="nadie">⚖ Empate: no sale nadie</button>`;
  }

  function escenaVotacion(s) {
    const cands = E.candidatos(s);
    const entre = s.segunda ? ` Solo entre ${s.segunda.map(id => nom(s, id)).join(" y ")}.` : "";
    let h = `<div class="paso-num">Ronda ${s.ronda}</div><h1>${s.segunda ? "Revotación" : "Votación"}</h1>`;
    let boton;

    if (s.cfg.opciones.voto === "mano") {
      h += `<p class="decir">A la cuenta de tres, todos señalan a quién quieren eliminar.${entre}</p>
        <p class="nota">Tocá al más votado. Si hubo empate, tocá a todos los empatados.</p>
        <div class="grilla elegir">${cands.map(j => `<button class="jug" data-a="elegir" data-id="${j.id}" aria-pressed="${sel.ids.includes(j.id)}">${esc(j.nombre)}</button>`).join("")}</div>`;
      if (!sel.ids.length) boton = falta("Tocá al más votado");
      else if (sel.ids.length === 1) boton = `<button class="btn-principal" data-a="eliminar" data-id="${sel.ids[0]}">⚖ Eliminar a ${nom(s, sel.ids[0])}</button>`;
      else boton = botonEmpate(s, sel.ids);
    } else {
      const votantes = E.vivos(s);
      const faltan = votantes.filter(j => s.votos[j.id] == null).length;
      h += `<p class="decir">Pasen el celu: cada uno toca su nombre y vota en secreto.${entre}</p>
        <div class="grilla">${votantes.map(j => `<button class="jug ${s.votos[j.id] != null ? "listo" : ""}" data-a="votarDe" data-id="${j.id}">${esc(j.nombre)}${s.votos[j.id] != null ? " ✓" : ""}</button>`).join("")}</div>
        <p class="progreso">${votantes.length - faltan} de ${votantes.length} votaron</p>`;
      if (faltan) boton = falta(`Faltan ${plural(faltan, "voto", "votos")}`);
      else {
        const c = R.contarVotos(s.votos);
        h += `<div class="lista-votos">${Object.keys(c.conteo).map(Number).sort((a, b) => c.conteo[b] - c.conteo[a])
          .map(id => `<div class="fila-voto ${c.lideres.includes(id) ? "lider" : ""}"><span>${nom(s, id)}</span><span class="cant">${c.conteo[id]}</span></div>`).join("")}</div>`;
        if (c.lideres.length === 1) boton = `<button class="btn-principal" data-a="eliminar" data-id="${c.lideres[0]}">⚖ Eliminar a ${nom(s, c.lideres[0])}</button>`;
        else {
          h += `<p class="veredicto-votos">Empate entre ${c.lideres.map(id => nom(s, id)).join(" y ")}.</p>`;
          boton = botonEmpate(s, c.lideres);
        }
      }
    }
    return h + pie(`${btnDeshacer()}${boton}`);
  }

  /* ---------- Eliminación y adivinanza ---------- */
  function eraTexto(s, j) {
    const n = E.nombreTipo(s, j);
    return n === "En blanco" ? "estaba en blanco" : `era ${n.toLowerCase()}`;
  }

  function escenaAdivinar(s) {
    const j = s.jugadores[s.eliminado];
    const cuerpo = sel.intento == null
      ? `<input id="intento" class="campo" maxlength="40" placeholder="La palabra es…" autocomplete="off" enterkeyhint="done" aria-label="La palabra">
        <button class="btn-principal grande" data-a="comprobar">Comprobar</button>
        <button class="link" data-a="noAdivino">No sabe: se rinde</button>`
      : `<p class="veredicto-votos">«${esc(sel.intento)}» no es la palabra exacta.</p>
        <button class="btn-principal grande" data-a="aceptar">✅ El grupo la da por buena</button>
        <button class="btn" data-a="noAdivino">❌ No adivinó</button>
        <button class="link" data-a="otraVez">Escribir otra vez</button>`;
    return `<div class="paso-num">Ronda ${s.ronda}</div>
      <div class="revela r-impostor"><div class="carta-emoji">${R.TIPOS[j.tipo].emoji}</div>
        <h1>${esc(j.nombre)} ${eraTexto(s, j)}</h1><p>Última chance: si adivina la palabra, gana solo.</p></div>
      <div class="adivinar">${cuerpo}</div>` + pie(`${btnDeshacer()}<span></span>`);
  }

  function escenaEliminado(s) {
    const g = R.ganadorTrasEliminar(s.jugadores, s.eliminado, s.cfg.opciones);
    let h = `<div class="paso-num">Ronda ${s.ronda}</div>`;
    if (s.eliminado == null) h += `<h1>No sale nadie</h1><p class="decir">Hubo empate y nadie queda afuera esta ronda.</p>`;
    else {
      const j = s.jugadores[s.eliminado];
      if (s.cfg.opciones.revelar || j.rol === "impostor" && s.adivinanza) {
        const extra = j.rol === "infiltrado" ? "<p>Tenía la palabra parecida.</p>"
          : s.adivinanza ? `<p>${s.adivinanza.texto ? `Dijo «${esc(s.adivinanza.texto)}»: no era.` : "No se animó a adivinar."}</p>` : "";
        h += `<div class="revela r-${j.rol} secreto"><div class="carta-emoji">${R.TIPOS[j.tipo].emoji}</div>
          <h1>${esc(j.nombre)} ${eraTexto(s, j)}</h1>${extra}</div>`;
      } else {
        h += `<div class="revela"><div class="carta-emoji">🚪</div><h1>${esc(j.nombre)} queda afuera</h1><p class="tenue">Qué era se sabe al final.</p></div>`;
      }
    }
    if (!g) h += `<p class="nota">Siguen ${plural(E.vivos(s).length, "jugador", "jugadores")}. Nueva ronda de pistas con la misma palabra.</p>`;
    return h + pie(`${btnDeshacer()}<button class="btn-principal" data-a="seguir">${g ? "🏁 Ver el final" : "▶ Siguiente ronda"}</button>`);
  }

  /* ---------- Final ---------- */
  function escenaFin(s) {
    const p = E.preset(s);
    const t = s.tema;
    const titulo = s.ganador === "civiles" ? "¡Ganan los civiles!" : s.ganador === "otros" ? p.ganaOtros : `¡${nom(s, s.adivino)} adivinó la palabra!`;
    const sub = s.ganador === "adivino" ? "Gana solo." : s.ganador === "civiles" ? "Descubrieron a todos." : "Se mezclaron bien.";
    const hayInf = s.jugadores.some(j => j.rol === "infiltrado"), hayPista = s.jugadores.some(j => j.ve === "pista");
    return `<div class="final g-${s.ganador}"><h1 class="grande">${titulo}</h1><p>${sub}</p></div>
      <div class="palabras-fin"><div><small>Palabra</small><b>${esc(t.palabra)}</b></div>
        ${hayInf ? `<div><small>Parecida</small><b>${esc(t.parecida)}</b></div>` : ""}
        ${hayPista ? `<div><small>Pista</small><b>${esc(t.pista)}</b></div>` : ""}
        <div><small>Categoría</small><b>${esc(t.categoria)}</b></div></div>
      <h2>Quién era quién</h2>
      <div class="lista-final">${s.jugadores.map(j => `<div class="fila-final t-${j.rol} ${j.vivo ? "" : "eliminado"}">
        <span class="emoji">${R.TIPOS[j.tipo].emoji}</span><b>${esc(j.nombre)}</b><span class="pts">${s.puntos[j.id] ? "+" + s.puntos[j.id] : ""}</span>
        <small>${esc(E.nombreTipo(s, j))}${j.vivo ? "" : " · eliminado"}${s.adivino === j.id ? " · adivinó" : ""}</small></div>`).join("")}</div>
      <h2>Marcador de la sesión</h2>${tablaMarcador(s.jugadores.map(j => j.nombre))}
      <div class="acciones">
        <button class="btn-principal" data-a="revancha">🎲 Revancha (mismos jugadores, palabra nueva)</button>
        <button class="btn" data-a="nueva">Nueva partida</button>
        <button class="btn" data-a="tab" data-tab="registro">Ver todo lo que pasó</button>
        <button class="link" data-a="deshacer">↶ Deshacer el último paso (si terminó por error)</button>
      </div>`;
  }

  /* ---------- Marcador de la sesión ---------- */
  function sincronizarMarcador() {
    const s = S();
    if (!s || !s.id) return;
    const r = E.resultado(s), antes = mar.partidas[s.id];
    if (r && (!antes || antes.ganador !== r.ganador)) mar.partidas[s.id] = r;
    else if (!r && antes) delete mar.partidas[s.id];
    else return;
    escribir(CLAVE_MAR, mar);
  }
  function tablaMarcador(soloEstos) {
    const lista = Object.values(mar.partidas);
    if (!lista.length) return `<p class="vacio">Acá se van sumando los puntos de cada partida.</p>`;
    const m = E.marcador(lista);
    const filtro = soloEstos && soloEstos.map(n => n.toLowerCase());
    const filas = m.jugadores.filter(j => !filtro || filtro.includes(j.nombre.toLowerCase()));
    return `<div class="resumen"><span class="chip">${plural(m.partidas, "partida", "partidas")}</span></div>
      <div class="tabla-wrap"><table><thead><tr><th>Jugador</th><th>Puntos</th><th>Ganadas</th></tr></thead>
      <tbody>${filas.map(j => `<tr><td>${esc(j.nombre)}</td><td class="q">${j.puntos}</td><td>${j.ganadas} de ${j.jugadas}</td></tr>`).join("")}</tbody></table></div>
      <button class="link" data-a="borrarMarcador">Borrar el marcador</button>`;
  }

  /* ---------- Reloj del debate ---------- */
  function prepararReloj(s) {
    const clave = `${s.id}-${s.ronda}`;
    if (reloj.clave === clave) return;
    reloj.clave = clave; reloj.total = s.cfg.opciones.debate; reloj.resta = reloj.total; reloj.corre = false;
    guardarReloj();
  }
  function pintarReloj() {
    const n = $("relojNum");
    if (!n) return;
    const r = Math.ceil(reloj.resta);
    n.textContent = `${Math.floor(r / 60)}:${String(r % 60).padStart(2, "0")}`;
    n.classList.toggle("poco", r <= 15 && r > 0);
    n.classList.toggle("cero", r === 0);
    $("relojPlay").textContent = reloj.corre ? "❚❚ Pausa" : (reloj.resta < reloj.total && reloj.resta > 0 ? "▶ Seguir" : "▶ Empezar");
  }
  function controlReloj(v) {
    if (v === "play") {
      if (reloj.corre) reloj.corre = false;
      else { if (reloj.resta <= 0) reloj.resta = reloj.total; reloj.corre = true; reloj.fin = Date.now() + reloj.resta * 1000; prepararAudio(); }
    } else if (v === "mas") {
      reloj.resta += 30; if (reloj.corre) reloj.fin += 30000;
    } else if (v === "reset") {
      reloj.corre = false; reloj.resta = reloj.total;
    }
    guardarReloj(); pintarReloj();
  }
  setInterval(() => {
    if (!reloj.corre) return;
    reloj.resta = Math.max(0, (reloj.fin - Date.now()) / 1000);
    if (reloj.resta === 0) { reloj.corre = false; guardarReloj(); alarma(); }
    pintarReloj();
  }, 250);
  // El iPhone solo deja sonar audio preparado al tocar un botón: se prepara al tocar «Empezar».
  let audio = null;
  function prepararAudio() {
    try {
      audio = audio || new (window.AudioContext || window.webkitAudioContext)();
      if (audio.state === "suspended") audio.resume();
      const src = audio.createBufferSource();
      src.buffer = audio.createBuffer(1, 1, 22050); src.connect(audio.destination); src.start(0);
    } catch (e) {}
  }
  function alarma() {
    if (navigator.vibrate) navigator.vibrate([300, 150, 300]);
    try {
      const ctx = audio || new (window.AudioContext || window.webkitAudioContext)();
      [0, 0.35, 0.7].forEach(t => {
        const o = ctx.createOscillator(), g = ctx.createGain();
        o.frequency.value = 660; o.connect(g); g.connect(ctx.destination);
        g.gain.setValueAtTime(0.25, ctx.currentTime + t);
        g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + t + 0.3);
        o.start(ctx.currentTime + t); o.stop(ctx.currentTime + t + 0.3);
      });
    } catch (e) {}
    aviso("⏰ ¡Se terminó el tiempo! A votar.");
  }

  /* ======================================================================
     MIS PALABRAS
     ====================================================================== */
  function renderMis() {
    if (editando) {
      const c = editando.cat;
      $("mis").innerHTML = `<h2>${editando.i < 0 ? "Nueva categoría" : "Editar categoría"}</h2>
        <input class="campo" data-ed="nombre" maxlength="60" placeholder="Nombre de la categoría" value="${esc(c.categoria)}" aria-label="Nombre de la categoría">
        <p class="nota">La palabra es obligatoria. La <b>parecida</b> es para el infiltrado (café → té) y la <b>pista</b> para el impostor: vaga, nunca un sinónimo.</p>
        <div class="filas-palabra">${c.palabras.map((p, i) => `<div class="fila-palabra">
          <input data-ed="palabra" data-i="${i}" maxlength="60" placeholder="Palabra" value="${esc(p.palabra)}" aria-label="Palabra ${i + 1}">
          <input data-ed="parecida" data-i="${i}" maxlength="60" placeholder="Parecida" value="${esc(p.parecida)}" aria-label="Parecida ${i + 1}">
          <input data-ed="pista" data-i="${i}" maxlength="60" placeholder="Pista" value="${esc(p.pista)}" aria-label="Pista ${i + 1}">
          <button class="quitar" data-a="quitarFila" data-i="${i}" aria-label="Quitar fila ${i + 1}">×</button></div>`).join("")}</div>
        <button class="btn" data-a="agregarFila">＋ Agregar palabra</button>
        <div class="botonera">
          <button class="btn-principal" data-a="guardarCat">Guardar</button>
          <button class="btn" data-a="cancelarCat">Cancelar</button>
          ${editando.i >= 0 ? `<button class="btn btn-peligro" data-a="borrarCat">Borrar categoría</button>` : ""}
        </div>`;
      return;
    }
    $("mis").innerHTML = `<h2>Mis palabras</h2>
      <p class="nota">Categorías propias que se suman a las de fábrica. Se guardan en este celu.</p>
      <div class="lista-cats">${mis.length ? mis.map((c, i) => `<div class="fila-cat"><div><b>${esc(c.categoria)}</b>
        <small>${plural(c.palabras.length, "palabra", "palabras")}</small></div>
        <button class="mini" data-a="editarCat" data-i="${i}">Editar</button></div>`).join("") : `<p class="vacio">Todavía no armaste ninguna.</p>`}</div>
      <div class="botonera"><button class="btn-principal" data-a="nuevaCat">＋ Nueva categoría</button></div>
      <h2>Pasárselas a un amigo</h2>
      <p class="nota">Descargá el archivo (o copiá el texto) y mandáselo. Al importarlo se suman las palabras nuevas sin borrar las que ya hay.</p>
      <div class="botonera">
        <button class="btn" data-a="exportar">⬇ Descargar archivo</button>
        <button class="btn" data-a="copiarMis">📋 Copiar texto</button>
        <button class="btn" data-a="elegirArchivo">⬆ Importar archivo</button>
      </div>
      <input type="file" id="archivo" accept=".json,application/json,text/plain" hidden>
      <details class="desplegable"><summary>Pegar el texto que te pasaron</summary>
        <textarea id="pegado" class="campo" placeholder='[{"categoria": "…", "palabras": [{"palabra": "…", "parecida": "…", "pista": "…"}]}]'></textarea>
        <button class="btn" data-a="importarPegado">Importar lo pegado</button></details>`;
  }

  // Suma las categorías revisadas a Mis palabras (por nombre, sin repetir palabras).
  function importar(datos) {
    const r = R.limpiarCategorias(datos);
    if (!r.ok) { aviso(r.motivo, 4000); return; }
    let nuevas = 0;
    r.categorias.forEach(c => {
      const ya = mis.find(x => R.normalizar(x.categoria) === R.normalizar(c.categoria));
      if (!ya) { mis.push(c); nuevas += c.palabras.length; return; }
      c.palabras.forEach(p => { if (!ya.palabras.some(x => R.iguales(x.palabra, p.palabra))) { ya.palabras.push(p); nuevas++; } });
    });
    guardarMis(); render();
    aviso(`Listo: ${plural(nuevas, "palabra nueva", "palabras nuevas")}.${r.avisos.length ? " " + r.avisos.join(" ") : ""}`, 4500);
  }

  function guardarCategoria() {
    const c = editando.cat;
    const r = R.limpiarCategorias([c]);
    if (!r.ok) { aviso(r.motivo, 3500); return; }
    const limpia = r.categorias[0];
    if (mis.some((x, i) => i !== editando.i && R.normalizar(x.categoria) === R.normalizar(limpia.categoria))) {
      aviso("Ya tenés una categoría con ese nombre."); return;
    }
    if (editando.i < 0) mis.push(limpia); else mis[editando.i] = limpia;
    editando = null;
    guardarMis(); render();
    aviso(r.avisos.length ? "Guardada. " + r.avisos.join(" ") : "Guardada.", r.avisos.length ? 4500 : 2000);
  }

  const textoMis = () => JSON.stringify(mis, null, 2);

  /* ======================================================================
     REGISTRO
     ====================================================================== */
  const tituloGrupo = x => x.f === "fin" ? "Final" : x.r === 0 ? "Reparto" : `Ronda ${x.r}`;
  function renderRegistro() {
    const s = S();
    if (!s || !s.registro.length) { $("reg").innerHTML = `<p class="vacio">Acá queda anotado lo que pasa en cada ronda: pistas, votos y eliminados.</p>`; return; }
    let h = "", actual = null;
    s.registro.forEach(x => {
      const t = tituloGrupo(x);
      if (t !== actual) { if (actual) h += `</ul>`; h += `<h3 class="grupo">${t}</h3><ul class="lista-reg">`; actual = t; }
      h += `<li>${esc(x.t)}</li>`;
    });
    $("reg").innerHTML = `<div class="reg-top"><h2>Registro</h2><button class="btn" data-a="copiar">📋 Copiar</button></div>
      <div class="secreto">${h}</ul></div>`;
  }
  function textoRegistro() {
    const s = S();
    let actual = null, out = `${M.nombre} · ${E.preset(s).nombre}\n`;
    s.registro.forEach(x => {
      const t = tituloGrupo(x);
      if (t !== actual) { out += `\n${t}\n`; actual = t; }
      out += `• ${x.t}\n`;
    });
    return out;
  }

  /* ======================================================================
     RENDER GENERAL
     ====================================================================== */
  function render() {
    sincronizarMarcador();
    document.body.classList.toggle("discreto", discreto);
    if (enConfig) renderConfig(); else renderJuego();
    renderMis();
    renderRegistro();
    renderVelo();
  }

  function copiar(texto, ok) {
    if (navigator.clipboard) navigator.clipboard.writeText(texto).then(() => aviso(ok), () => aviso("No se pudo copiar"));
    else aviso("Tu navegador no deja copiar");
  }

  /* ---------- Eventos ---------- */
  $("formJugador").addEventListener("submit", e => {
    e.preventDefault();
    const inp = $("nuevoJugador");
    if (inp.value.trim()) agregarJugadores(inp.value);
    inp.value = "";
    inp.focus();
  });

  // Lo que se escribe se guarda sin redibujar (para no perder el foco).
  document.addEventListener("input", e => {
    const t = e.target;
    if (t.dataset.pista !== undefined) sel.pistas[t.dataset.pista] = t.value;
    if (t.dataset.ed && editando) {
      if (t.dataset.ed === "nombre") editando.cat.categoria = t.value;
      else editando.cat.palabras[+t.dataset.i][t.dataset.ed] = t.value;
    }
  });
  document.addEventListener("keydown", e => {
    if (e.key === "Enter" && e.target.id === "intento") { e.preventDefault(); document.querySelector('[data-a="comprobar"]').click(); }
  });
  document.addEventListener("change", e => {
    if (e.target.id !== "archivo" || !e.target.files[0]) return;
    e.target.files[0].text().then(txt => {
      try { importar(JSON.parse(txt)); } catch (err) { aviso("Ese archivo no es un JSON válido.", 3500); }
    });
    e.target.value = "";
  });

  // Mantener apretado para ver: la carta aparece encima sin tocar el botón (sigue bajo el dedo).
  document.addEventListener("pointerdown", e => {
    if (!e.target.closest("[data-hold]") || !velo || velo.ver) return;
    e.preventDefault();
    velo.ver = true; velo.fija = false;
    $("velo").insertAdjacentHTML("beforeend", htmlCarta());
  });
  const soltar = () => {
    if (!velo || !velo.ver || velo.fija) return;
    velo.ver = false; velo.mirado = true;
    renderVelo();
  };
  document.addEventListener("pointerup", soltar);
  document.addEventListener("pointercancel", soltar);
  document.addEventListener("contextmenu", e => { if (e.target.closest("[data-hold]")) e.preventDefault(); });

  document.addEventListener("click", e => {
    const b = e.target.closest("[data-a]");
    if (!b || b.disabled) return;
    const a = b.dataset.a, id = b.dataset.id === undefined || b.dataset.id === "" ? null : +b.dataset.id;
    const s = S();
    switch (a) {
      case "tab": irA(b.dataset.tab); break;

      // Configuración
      case "quitarJug": cfg.jugadores.splice(+b.dataset.i, 1); guardarCfg(); renderConfig(); break;
      case "borrarJug": if (confirm("¿Borrar todos los jugadores?")) { cfg.jugadores = []; guardarCfg(); renderConfig(); } break;
      case "modo": {
        const p = P[b.dataset.modo];
        cfg.modo = p.id; cfg.auto = true; cfg.opciones = JSON.parse(JSON.stringify(p.opciones));
        cfg.cuentas = R.sugerir(p, Math.max(cfg.jugadores.length, R.MIN_JUGADORES));
        guardarCfg(); renderConfig(); break;
      }
      case "cat": {
        const c = b.dataset.cat;
        if (!c) cfg.categorias = null;
        else {
          const lista = cfg.categorias ? cfg.categorias.slice() : [];
          cfg.categorias = lista.includes(c) ? lista.filter(x => x !== c) : lista.concat(c);
          if (!cfg.categorias.length) cfg.categorias = null;
        }
        guardarCfg(); renderConfig(); break;
      }
      case "mas": case "menos": {
        cfg.auto = false;
        const t = b.dataset.t;
        cfg.cuentas[t] = Math.max(0, (cfg.cuentas[t] || 0) + (a === "mas" ? 1 : -1));
        guardarCfg(); renderConfig(); break;
      }
      case "sugerir": cfg.auto = true; guardarCfg(); renderConfig(); break;
      case "opt": cfg.opciones[b.dataset.k] = JSON.parse(b.dataset.v); guardarCfg(); renderConfig(); break;
      case "repartir": {
        const v = E.validarConfig(cfg, temas());
        if (!v.ok) {
          aviso(v.motivo); $("errorConfig").hidden = false; $("errorConfig").textContent = v.motivo;
          const pocos = cfg.jugadores.length < R.MIN_JUGADORES;
          const bloque = (pocos ? $("formJugador") : $("roles")).closest(".bloque");
          bloque.scrollIntoView({ behavior: "smooth", block: "start" });
          animar(bloque, "marcado");
          if (pocos) $("nuevoJugador").focus({ preventScroll: true });
          break;
        }
        if (s && s.fase !== "fin" && s.fase !== "reparto" && !confirm("Hay una partida en juego. ¿Dejarla y repartir una nueva? (Se puede deshacer.)")) break;
        juego.empezar(cfg, temas()); sel = selVacia(); velo = null;
        guardar(); enConfig = false; irA("juego"); render(); break;
      }
      case "volver": enConfig = false; irA("juego"); render(); break;
      case "nueva": enConfig = true; irA("juego"); render(); break;

      // Reparto
      case "ver": {
        const j = s.jugadores[id];
        if (j.visto && !confirm(`${j.nombre} ya vio su palabra. ¿Verla de nuevo? Que nadie más mire.`)) break;
        velo = { tipo: "rol", id, ver: false, fija: false, mirado: false }; renderVelo(); break;
      }
      case "verFijo": velo.ver = true; velo.fija = true; renderVelo(); break;
      case "ocultar": velo.ver = false; velo.fija = false; velo.mirado = true; renderVelo(); break;
      case "cerrarVelo": velo = null; renderVelo(); break;
      case "listoVer": { const v = velo; velo = null; hacer("verRol", { id: v.id }); break; }
      case "resortear":
        if (s.jugadores.some(j => j.visto) && !confirm("¿Sortear palabra y roles de nuevo? Todos tienen que volver a mirar.")) break;
        hacer("resortear", { temas: temas() }); break;
      case "empezar": {
        const faltan = s.jugadores.filter(j => !j.visto).length;
        if (faltan && !confirm(`${plural(faltan, "jugador no vio", "jugadores no vieron")} su palabra. ¿Empezar igual?`)) break;
        hacer("empezar"); break;
      }

      // Ronda
      case "aDebate": hacer("aDebate", { pistas: sel.pistas }); break;
      case "aVotar": reloj.corre = false; guardarReloj(); hacer("aVotar"); break;
      case "reloj": controlReloj(b.dataset.v); break;
      case "elegir": sel.ids = sel.ids.includes(id) ? sel.ids.filter(x => x !== id) : sel.ids.concat(id); renderJuego(); break;
      case "falta": aviso(b.dataset.v); break;
      case "eliminar": hacer("eliminar", { id }); break;
      case "nadie": hacer("eliminar", { nadie: true }); break;
      case "revotar": hacer("revotar", { ids: b.dataset.ids.split(",").map(Number) }); break;
      case "votarDe": {
        if (s.votos[id] != null && !confirm(`${s.jugadores[id].nombre} ya votó. ¿Cambiar su voto?`)) break;
        velo = { tipo: "voto", id, ver: false }; renderVelo(); break;
      }
      case "mostrarVoto": velo.ver = true; renderVelo(); break;
      case "votarA": {
        const votante = velo.id; velo = null;
        const r = hacer("votar", { votante, votado: id });
        if (r.ok) aviso("Voto guardado. Pasá el celu.");
        break;
      }
      case "comprobar": {
        const texto = $("intento").value.trim();
        if (!texto) { aviso("Escribí la palabra."); break; }
        if (R.iguales(texto, s.tema.palabra)) hacer("adivinar", { texto });
        else { sel.intento = texto; renderJuego(); }
        break;
      }
      case "aceptar": hacer("adivinar", { texto: sel.intento, aceptar: true }); break;
      case "noAdivino": hacer("adivinar", { texto: sel.intento || "" }); break;
      case "otraVez": sel.intento = null; renderJuego(); $("intento").focus(); break;
      case "seguir": hacer("seguir"); break;
      case "deshacer":
        if (juego.puedeDeshacer) { juego.deshacer(); sel = selVacia(); velo = null; guardar(); render(); aviso("Deshecho"); }
        break;

      // Final
      case "revancha": {
        const v = E.validarConfig(s.cfg, temas());
        if (!v.ok) { aviso(v.motivo); break; }
        juego.revancha(temas()); sel = selVacia(); guardar(); render(); window.scrollTo(0, 0); break;
      }
      case "borrarMarcador":
        if (confirm("¿Borrar el marcador de todas las partidas?")) { mar.partidas = {}; escribir(CLAVE_MAR, mar); render(); }
        break;
      case "discreto": discreto = !discreto; render(); break;
      case "copiar": copiar(textoRegistro(), "Registro copiado"); break;

      // Mis palabras
      case "nuevaCat": editando = { i: -1, cat: { categoria: "", palabras: [{ palabra: "", parecida: "", pista: "" }] } }; renderMis(); break;
      case "editarCat": {
        const c = JSON.parse(JSON.stringify(mis[+b.dataset.i]));
        if (!c.palabras.length) c.palabras.push({ palabra: "", parecida: "", pista: "" });
        editando = { i: +b.dataset.i, cat: c }; renderMis(); break;
      }
      case "agregarFila": {
        editando.cat.palabras.push({ palabra: "", parecida: "", pista: "" }); renderMis();
        const ins = document.querySelectorAll('[data-ed="palabra"]');
        ins[ins.length - 1].focus();
        break;
      }
      case "quitarFila": editando.cat.palabras.splice(+b.dataset.i, 1); renderMis(); break;
      case "guardarCat": guardarCategoria(); break;
      case "cancelarCat": editando = null; renderMis(); window.scrollTo(0, 0); break;
      case "borrarCat":
        if (confirm(`¿Borrar la categoría «${mis[editando.i].categoria}» con todas sus palabras?`)) {
          mis.splice(editando.i, 1); editando = null; guardarMis(); render();
        }
        break;
      case "exportar": {
        const url = URL.createObjectURL(new Blob([textoMis()], { type: "application/json" }));
        const enlace = document.createElement("a");
        enlace.href = url; enlace.download = "mis-palabras-infiltrado.json";
        document.body.appendChild(enlace); enlace.click(); enlace.remove();
        setTimeout(() => URL.revokeObjectURL(url), 1000);
        break;
      }
      case "copiarMis": copiar(textoMis(), "Copiado: pegalo en un mensaje"); break;
      case "elegirArchivo": $("archivo").click(); break;
      case "importarPegado": {
        const txt = $("pegado").value.trim();
        if (!txt) { aviso("Pegá el texto primero."); break; }
        try { importar(JSON.parse(txt)); } catch (err) { aviso("Ese texto no es un JSON válido.", 3500); }
        break;
      }
    }
  });

  /* ---------- Pantalla siempre encendida durante la partida ---------- */
  let wakeLock = null;
  async function pedirPantallaEncendida() {
    if (!("wakeLock" in navigator) || wakeLock || document.visibilityState !== "visible") return;
    try {
      wakeLock = await navigator.wakeLock.request("screen");
      wakeLock.addEventListener("release", () => (wakeLock = null));
    } catch (e) { wakeLock = null; }
  }
  document.addEventListener("visibilitychange", () => { if (document.visibilityState === "visible") pedirPantallaEncendida(); });
  document.addEventListener("pointerdown", pedirPantallaEncendida, { once: true });

  /* ---------- iPhone: sin zoom por doble toque ni pellizco ---------- */
  let ultimoToque = 0;
  document.addEventListener("touchend", e => {
    const ahora = Date.now();
    if (ahora - ultimoToque < 350 && !e.target.closest("input,select,textarea,label,summary,[data-hold]")) {
      e.preventDefault();
      const b = e.target.closest("button");
      if (b && !b.disabled) b.click();
    }
    ultimoToque = ahora;
  }, { passive: false });
  ["gesturestart", "gesturechange"].forEach(t => document.addEventListener(t, e => e.preventDefault(), { passive: false }));

  /* ---------- Modo offline ---------- */
  let enMarco = true; try { enMarco = window.self !== window.top; } catch (e) {}
  if ("serviceWorker" in navigator && location.protocol === "https:" && !enMarco) {
    addEventListener("load", () => navigator.serviceWorker.register("sw.js").catch(() => {}));
  }

  /* ---------- Arranque ---------- */
  document.querySelectorAll("[data-marca]").forEach(el => (el.textContent = M.nombre));
  const h = location.hash.slice(1);
  irA(["juego", "mis", "reglas", "registro"].includes(h) ? h : "juego");
  render();
})();
