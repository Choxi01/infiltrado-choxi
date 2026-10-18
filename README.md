# Infiltrado Choxi

**👉 Abrir la app: https://choxi01.github.io/infiltrado-choxi/**

Los juegos de "todos saben algo menos uno", en una sola app, para jugar **en persona con un solo celu**
que se pasa de mano en mano. Sin servidor ni cuentas: funciona sin internet una vez abierta.

| Modo | Estado |
|---|---|
| 🕵️ **Impostor**: todos tienen la palabra menos el impostor (que recibe una pista, la categoría o nada) | ✅ |
| 🎭 **Infiltrado**: el infiltrado tiene una palabra parecida y no lo sabe; puede haber uno en blanco | ✅ |
| 🗺️ **El Espía**: todos saben el lugar menos el espía | Próximamente (V2) |
| 💡 **Una Palabra**: cooperativo, pistas que se anulan si se repiten | Próximamente (V3) |

Incluye: reparto en secreto (mantener apretado para ver), ronda de pistas con orden sorteado,
reloj de debate con sonido y vibración, votación a mano alzada o secreta, empates, adivinanza del
impostor eliminado, marcador de la sesión, deshacer, modo discreto 👁, registro para copiar
y **Mis palabras** (categorías propias con exportar/importar).

## Usarla en el celu
1. Abrí el link en **Safari** (iPhone) o **Chrome** (Android).
2. Compartir → **Agregar a pantalla de inicio**.
3. Abrila una vez con internet para que quede guardada.

## Probarla en la compu
```bash
python -m http.server 8124
```
y abrí http://localhost:8124. Pruebas de la lógica: `npm test` (o `node tests/reglas.test.js`).

## Personalizarla
| Quiero cambiar… | Archivo |
|---|---|
| Las palabras de fábrica (palabra, parecida, pista) | `js/datos/temas.js` |
| Los lugares de El Espía | `js/datos/lugares.js` |
| Cuántos impostores se sugieren, opciones por defecto, puntos | `js/presets.js` |
| El nombre del juego | `js/marca.js` (y `manifest.webmanifest`) |
| Colores | `css/estilos.css` |

Las palabras propias se pueden cargar desde la app (pestaña **Mis palabras**) sin tocar código.
Se guardan en el celu; para pasárselas a otro, **Descargar archivo** o **Copiar texto** y que el otro las importe.

## Archivos
| Archivo | Qué tiene |
|---|---|
| `index.html` | Pantallas y la pestaña "Cómo se juega" |
| `js/reglas.js` | Lógica pura: sorteo, temas sin repetir, votos, quién gana, puntos, comparar palabras, anular pistas |
| `js/presets.js` | Un objeto de reglas por modo |
| `js/estado.js` | La partida y sus acciones, con deshacer |
| `js/app.js` | Dibuja la pantalla y conecta los botones |
| `js/volver.js` | Botón "‹ Juegos" al hub (mismo archivo que en lobos y truco) |
| `sw.js` | Modo offline |
| `tests/reglas.test.js` | Pruebas |
| `fonts/` | Tipografías Alegreya (licencia OFL, ver `fonts/OFL.txt`) |

## Limitaciones
- Todo vive en un celu: si se borran los datos del navegador, se pierden Mis palabras y el marcador (exportalas).
- Para comparar la adivinanza se ignoran tildes, mayúsculas y plural simple; si el grupo la acepta igual, hay un botón.
