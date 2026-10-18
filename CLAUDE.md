# Infiltrado Choxi — notas para Claude Code

App web estática (sin build ni dependencias) con los juegos de "todos saben algo menos uno", para jugar
en persona con **un solo celu** que se pasa. Tipo B, hermana de `lobos` y `truco` (misma estructura y tipografías).
Se publica con **GitHub Pages** desde `main` (raíz) en https://choxi01.github.io/infiltrado-choxi/.
Todo el texto, commits y respuestas en **español rioplatense** (voseo). No usar "Spyfall", "Undercover" ni "Just One" en la app.

## Estado (2026-10-17)
- **V1 hecha**: Impostor + Infiltrado completos. El Espía y Una Palabra se ven como "Próximamente",
  pero su lógica pura ya está en `reglas.js` con pruebas (`puntosEspia`, `condena`, `relojEspia`, `anularPistas`, `jugarCarta`, `fraseUnaPalabra`)
  y los datos de El Espía en `js/datos/lugares.js` (34 lugares).
- Publicada en GitHub Pages y enlazada desde el hub `choxi-juegos` (`tipo: app`).

## Cómo trabajar
1. `git pull` antes de tocar nada.
2. Lógica en `js/reglas.js` (pura) y `js/estado.js` (acciones), con prueba en `tests/reglas.test.js`. `npm test` tiene que dar todo bien.
3. Si se agrega un archivo, sumarlo a `ARCHIVOS` en `sw.js` y al `index.html`.
4. Subir `VERSION` en `js/estado.js` solo si cambia la forma del estado guardado.
5. Probar en local: `.claude/launch.json` levanta `python -m http.server 8124`.

## Arquitectura
| Archivo | Qué tiene |
|---|---|
| `js/marca.js` | Nombre del juego (único lugar) |
| `js/reglas.js` | `TIPOS` de carta (`civil`, `infiltrado`, `pista`, `categoria`, `blanco`) → `rol` (civil/infiltrado/impostor) y `ve`. Sorteo con semilla, sugerencias, temas sin repetir, orden de pistas, votos, `ganador`, puntos, `iguales`/`normalizar`, Una Palabra, El Espía, `limpiarCategorias` (valida Mis palabras). Expone `window.InfReglas` |
| `js/presets.js` | `PRESETS.impostor/infiltrado/espia/unaPalabra`: roles (número o función de n), nombres, opciones por defecto, puntos. Un modo nuevo = un preset, no `if (modo === …)` |
| `js/datos/temas.js` | Filas `[palabra, parecida, pista]` por categoría → `window.TEMAS` (con `categoria`) y `window.CATEGORIAS`. "Cosas del grupo" vacía a propósito |
| `js/estado.js` | Partida y acciones `(S, datos) → {ok}|{ok:false, motivo}`; `crearJuego()` con deshacer (máx. 80); `resultado`/`marcador` |
| `js/app.js` | Render con innerHTML + delegación por `data-a`. Lo que no va al estado (elegidos a mano alzada, pistas anotadas, intento de adivinanza) vive en `sel` |

Flujo: reparto → pistas → debate → votacion → [adivinar] → eliminado → (pistas… | fin).
- Votación secreta: `S.votos {votante: votado}`; empate → `revotar` (S.segunda) o `eliminar {nadie}` según opción.
- "Mantener apretado": la carta se agrega encima con `pointer-events: none` para que el botón siga bajo el dedo y llegue el `pointerup`.

`localStorage` (prefijo `infiltrado:` porque el dominio es compartido): `partida` (estado + deshacer), `config`, `marcador`, `reloj`, `mis-palabras`.
`sw.js` solo borra cachés que empiezan con `infiltrado` y solo atiende pedidos dentro de su carpeta.

## Diseño (2026-10-18): "expediente secreto"
- Pizarra oscura con grano de papel (`--grano`, SVG inline) y renglones apenas visibles; acento manila `--acento`, tinta roja `--sello`.
- Rótulos a máquina de escribir (`--mono`, Courier del sistema: no se agregan fuentes para que ande offline).
- Mantener apretado = carpeta manila con pestaña "ABRIR". La palabra se lee en una hoja de papel (`.carta-caja`) **igual para todos**:
  solo cambia el sello (`Confidencial` / `Impostor` / `En blanco`), así un mirón no distingue roles por el color. Vibra 25 ms al abrir.
- Sellos animados: "Descubierto"/"Eliminado" en la eliminación y "Caso cerrado" en el final.
- Configuración: "Reglas de la casa" plegadas en un `<details>` con resumen; el botón Repartir queda fijo abajo.

## Reglas decididas
- El en blanco (`ve: "nada"`) nunca empieza la ronda; el impostor con pista/categoría solo si la opción lo permite.
- Por rondas: civiles ganan sin rivales vivos; los otros cuando son tantos como los civiles (opción: cuando quedan 2).
- Votación única: si no eliminan a un impostor/infiltrado en la primera, ganan ellos (también si no sale nadie por empate).
- Solo el `impostor` eliminado adivina (el infiltrado no sabe que lo es). Si acierta gana solo (6 puntos).
- Puntos: civiles 2 c/u, impostor 6, infiltrado 10; si gana el bando de los otros suman todos los de ese bando.

## Roadmap
- **V2 El Espía**: reparto lugar + rol, reloj (`relojEspia`), quién pregunta, lista pública de lugares, acusar (unánime, una por jugador por ronda), plantarse, fin del tiempo, dos espías (sugerido desde 9).
- **V3 Una Palabra**: 13 cartas, pistas escritas pasando el celu (dos c/u con 3 jugadores), anulación automática + revisión manual, Acertó/Pasó/Falló.
- **V4 ideas**: voz con `speechSynthesis`, paquete "Cosas del grupo", modo varios celus con QR de la semilla.
