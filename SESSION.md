# UserDesigners Web — Astro Migration

## Ago 9-10 — BlobField: efecto GOOEY (metaball tipo Framer) ★ FINAL 9/10

**El efecto que Mau quería:** blobs que se funden en UNA sola masa líquida orgánica (como el home de Framer), con morph continuo, sin verse planos ni como formas separadas.

**Técnica definitiva (en `src/components/ui/BlobField.astro`):**
- **Filtro SVG GOOEY** (el metaball real, de `luukdv/gooey-react`): `feGaussianBlur stdDeviation=14` + `feColorMatrix values="1 0 0 0 0  0 1 0 0 0  0 0 1 0 0  0 0 0 84 -32"` aplicado al contenedor con `filter: url(#bf-gooey)`.
- **NO usar:** CSS `filter: contrast()` (quema a blanco con colores claros), `mix-blend-mode` solo (deja cortes entre formas).
- **Paths orgánicos** (8 puntos de control que morphan con senos via requestAnimationFrame) → la forma cambia continuamente, nunca plana.
- **Blur extra** en el contenedor: `blur(22px)` para suavizar bordes.
- **Paleta:** rojo/coral (0-40), violeta/morado (255-310), magenta/rosa (330-360). SIN verde, SIN ámbar sucio, SIN pastel (luminosidad 52-66%, saturación 90-100%). Colores random por refresh.
- **Blog config:** `<BlobField variant="blog" opacity={0.55} blur={22} />`, esquema `[{x:60,y:560,s:1500},{x:320,y:520,s:1350}]` → masa a la IZQUIERDA, lado derecho limpio para el título.
- **Verificado:** 9/10 (gemini vision) — masa líquida orgánica, blur suave, título legible, sin verde.

**Referencia de la técnica:** [gooey-react](https://github.com/luukdv/gooey-react) (677★, "shape blobbing / metaballs"). El efecto no necesita GSAP/motion — el filtro SVG + rAF es liviano (0 dependencias).

**Historial de intentos fallidos (para no repetir):** div con border-radius+blur = niebla; SVG paths separados con blur = jellybeans; mesh gradient 1 div = plano; CSS contrast() = quemado a blanco; elipses = planas. La solución final = paths morph + filtro SVG gooey + blur.

## Ago 9 (parte 16) — FINAL: estado cerrado del blog + componentes ✓

**Estado final del blog hero (validado por Mau en browser):**
- `<BlobField variant="blog" opacity={0.7} blur={14} />` en `src/pages/blog/index.astro`
- Esquema blog: 2 blobs `{x:100,y:620,s:1350}`, `{x:380,y:560,s:1250}` (~45% ancho), blur path 52px
- Colores análogos (saturación 95-100%), un solo SVG + blend lighten, mezcla suave
- Tipografía: blog/page/[page].astro usa DM Sans (sin Inter)

**Componentes nuevos/modificados en esta sesión:**
- `src/components/ui/BlobField.astro` (NUEVO) — el componente final de blobs con variantes (blog/home/contacto/servicios/proyectos/left/right/center/bicolor), colores análogos random por refresh, un solo SVG para fusión
- `src/pages/blog/index.astro` — usa BlobField + limpieza de blobs inline viejos
- `src/pages/blog/page/[page].astro` — DM Sans en vez de Inter

**Pendiente:** commitear los cambios (rama refactor/test-fase1). SESSION.md actualizado con toda la evolución del componente (partes 1-16).

## Ago 9 (parte 15) — Blog: blobs MÁXIMOS + saturación 100%

**Feedback Mau:** blob más grande + verificar si el color se ve apagado.

**Cambio:**
- Tamaño: s 1250/1150 (~42% del ancho del hero) — los más grandes hasta ahora
- **Saturación 100% fija** en colores análogos (95-100%) + luminosidad 60-80% → color vivo garantizado en cualquier refresh
- Opacity 0.7, gradiente interno alpha 1/0.9/0.65, blur 45px
- Nota: el modelo vision siempre percibe los blobs difuminados en dark mode como "apagados" (límite del screenshot estático) — el color real con sat 100% se ve vivo en el browser. Mau verifica en vivo.

## Ago 9 (parte 14) — Blog: colores ANÁLOGOS (teoría de color) ★ 8/10

**Feedback Mau:** los 2 blobs con colores random chocaban (ej: lila frío + marrón terracota = opuestos, se veían sucios/desbalanceados). Propuso teoría de color.

**Cambio (opción B de Mau):**
- Nuevo generador de colores **análogos**: un `hue base` al azar por refresh (familia cálida 35% / violeta-azul 25% / verde-cian 25% / magenta 15%), todos los blobs se derivan de él con variaciones suaves (±22° por paso)
- Resultado: los blobs SIEMPRE armonizan y se funden (nunca chocan colores opuestos)
- Blobs siguen grandes (s 1100/1000 = ~37% ancho), blur 45px, un solo SVG + blend lighten
- **Verificado:** 8/10 en 2 refreshes (azul cobalto + violeta armonizan), título se lee bien
- **Lección:** para blobs que se fundan → usar colores ANÁLOGOS de una misma familia (teoría de color), no colores independientes que pueden ser opuestos en el círculo cromático

## Ago 9 (parte 13) — Blog: blobs MÁS GRANDES arriba-izquierda

**Feedback Mau:** más grandes y a la izquierda, sin competir con el texto.

**Cambio:** blog blobs → x 110/300, y 420/380 (arriba-izquierda, fuera del centro del título), s 860/720 (≈29% ancho), blur path 30px, opacity 0.55 (título blanco gana contraste).
- Verificado: 8/10 (gemini vision), blobs a la izquierda como fondo ambiental, título mayormente limpio.
- Nota: los blobs grandes inevitablemente se extienden hacia el centro — la opacidad baja (0.55) es lo que mantiene el título legible.

## Ago 9 (parte 12) — Blog: blobs grandes que SE MEZCLAN (un solo SVG + blend lighten)

**Feedback Mau:** blobs más grandes (30-40% del hero como referencia), que se mezclen como pintura sin "efecto alfa".

**Implementación final (metaball/mezcla):**
- **Un solo SVG** (`.bf-canvas`) con todos los paths — mismo lienzo, sin capas HTML superpuestas
- **`mix-blend-mode: lighten`** en el contenedor + `blur(34px)` en cada path → los colores se funden donde los blobs se tocan
- Tamaño derivado del esquema: `baseR = s/6` (blog s=820/700 → blobs grandes 27-30% del ancho)
- Gradientes con alpha 0.85→0.55 (color real, sin quemar a blanco puro)
- Blog: 2 blobs (x 260/480, y 540/520 — hacia abajo, fuera del área del título)
- **Verificado:** 8/10 (gemini vision), título legible, mezcla suave. El centro puede verse claro donde 2 blobs se superponen (inherente al lighten).
- NOTA: `filter: contrast()` (metaball clásico) QUEMA a blanco con colores claros — NO usar. Blend lighten + blur alto es el equilibrio correcto.

## Ago 9 (parte 11) — Blog: 2 blobs grandes a la izquierda, un color c/u

**Feedback Mau:** 2 blobs (no 4), más grandes, más a la izquierda, más blur para mezclarse, y cada blob de UN solo color (el bicolor hacía "rojo centro → celeste borde" = raro).

**Cambio:**
- Blog usa `<BlobField variant="blog" opacity={0.6} blur={14} />`
- Variante `blog`: SOLO 2 blobs (antes 4), grandes (520/460px), a la izquierda (x -22 / 46), radios de trayectoria moderados
- Gradiente monocromo por blob (cada blob = 1 solo color) — el "bicolor" ya no se usa en blog
- Nuevo prop `blur` en el componente (default 16px) — blog usa 14px
- **Verificado:** 2 elementos SVG con centros propios, movimiento real (spread X 39%), build OK
- Nota: el modelo vision tiende a percibir "1 mancha" con 2 blobs grandes difusos en dark mode — verificar en vivo. Si Mau quiere que se distingan más: bajar blur a 10-12 o separar x a (-30, 55).

## Ago 9 (parte 10) — Blog: blobs a la IZQUIERDA + BICOLOR

**Feedback Mau:** mandar la masa más a la izquierda y dejarlo bicolor.

**Cambio:**
- Blog usa `<BlobField variant="bicolor" opacity={0.55} />`
- Variante `bicolor` reposicionada: masa compacta a la IZQUIERDA (x -2→44%, y 26→70%), radios bajos (10-13) para mantenerse unida
- Bicolor: cada blob mezcla 2 colores complementarios (gradiente c1 → c2 → c1)
- Opacidad 0.55 (el título se lee limpio)
- **Verificado:** título limpio, masa izquierda + bicolor, movimiento real. El modelo vision nota que la derecha queda más vacía (trade-off de la posición izquierda).

## Ago 9 (parte 9) — Blog: blobs MÁS UNIDOS (masa compacta)

**Feedback Mau:** que los blobs del blog no se separen mucho, se mantengan unidos.

**Cambio:** variante `blog` reposicionada a zona compacta:
- Antes: x -8→100%, y -6→90% (dispersos en todo el hero)
- Ahora: x 18→72%, y 18→62%, radios de trayectoria reducidos (rx 10-13, ry 7-9) → los 4 blobs se mantienen en una masa central compacta que se funde
- Tamaños 420-480px (sus halos se solapan mucho más)
- **Verificado:** spread X 49-53% / Y 42-49% (antes dispersos 0-116%); siguen moviéndose (translación elíptica)
- Vision: "masa única, compacta y centralizada, se funden perfectamente, 8/10"

## Ago 9 (parte 8) — BlobField: VARIANTES + colores RANDOM por refresh

**Feedback Mau:** bajar tamaño, subir opacidad, colores varían en cada refresh, más versiones para otras páginas.

**Cambios:**
- **Colores RANDOM por refresh** — cada blob genera color aleatorio (40% cálidos / 30% cian-azul / 30% violetas). El primer blob siempre brillante (foco vivo). Saturación 85-100%, luminosidad 58-80%.
- **Tamaños reducidos** (blog: 400-460px, antes 560-640px)
- **Opacidad subida** (0.8), blur 12px, stops del gradiente más intensos (alpha 1 → 0.8 → 0.4)
- **8 VARIANTES disponibles:**
  - `blog` — esquinas
  - `home` — repartido
  - `contacto` / `servicios` / `proyectos` — posiciones propias
  - `left` — blobs salen por la izquierda (rx grande hacia centro)
  - `right` — blobs salen por la derecha
  - `center` — blobs se concentran y funden en el centro
  - `bicolor` — cada blob mezcla 2 colores complementarios
- Uso: `<BlobField variant="left" opacity={0.8} />`
- Verificado: movimiento real (translación elíptica JS), build OK

## Ago 9 (parte 7) — BlobField v2: 4 blobs GRANDES que DERIVAN (translación real) ★

**Feedback Mau:** blobs más grandes, más unidos, que se muevan de verdad (no girar en sitio), 4 blobs, a veces se funden en uno solo. El mesh single-div se veía como "gradiente gigante plano" → revertido.

**Nueva implementación:**
- 4 blobs SVG individuales GRANDES (560-640px) en las ESQUINAS (x:-8/68/100/12, y:12/-6/52/88) — asoman por los bordes, centro limpio
- **Movimiento REAL:** cada blob deriva en trayectoria elíptica via JS (`translate3d` con senos) — el centro viaja, no rota en sitio. Verificado: posiciones cambian en el tiempo (translación ✓)
- Radios de translación grandes (26-32%) → los blobs se acercan al centro y **se funden entre sí en ciertos momentos** (screen blending), luego se separan — como lava viva
- blur 18px, opacity 0.55 (grandes pero ambientales, no compiten con el texto)
- **Verificado (gemini vision):** "blobs grandes y protagonistas, mejor integrados como telón ambiental, título se lee drásticamente mejor, ya no hay foco de color saturado atravesando las letras"

**Lección:** para blobs que se muevan de verdad → JS con translación elíptica (senos), NO rotación CSS en sitio. Y para que sean grandes sin tapar texto → esquinas + opacity moderada + blur.

## Ago 9 (parte 6) — BlobField: MASA LÍQUIDA CONTINUA (mesh gradient) ★ 9/10

**Cambio definitivo — de amebas separadas a masa líquida:**
- Los blobs SVG separados (cada uno con núcleo propio) NUNCA se fundían → se veían como jellybeans sueltos
- **Nueva técnica:** UN solo contenedor con múltiples `radial-gradient` superpuestos (mesh gradient) — los colores comparten el canvas y fluyen entre sí (como el canvas `#Gradients` del home original)
- `inset: -25%` + `blur: 30px` + gradientes que terminan en 72% → desvanecimiento gradual al negro SIN viñeta dura
- `mix-blend-mode: screen`, animación `bf-breathe` (respiración lenta del conjunto, sin alternate brusco)
- Variantes por página siguen: cada `variant` define sus colores + posiciones de orbes
- Uso: `<BlobField variant="blog" opacity={0.65} speed={20} />`
- **Verificado (gemini vision): "transición suave, natural, homogénea, no manchas separadas; se funde bien sin bordes duros; 9/10"**

**Lección clave:** para que los blobs se fundan → NO usar elementos separados con blur (quedan como manchas independientes); usar UN contenedor con múltiples radial-gradients superpuestos (mesh) que comparten el mismo background.

## Ago 9 (parte 5) — BlobField: volumen jelly 3D (blur + punto de luz)

**Fix "se veían planos":**
- blur 2px → **5px** (suave sin ser niebla)
- Gradiente interno con **punto de luz blanco** (stop 0% white opacity 0.9, luego color vivo → halo transparente) — da profundidad 3D tipo jelly/gominola
- Verificado (gemini vision): "**volumen y profundidad 3D, suaves con brillos tipo jelly, orgánicos tipo lava, 8/10**"
- Título se lee limpio, blobs en esquinas (sin tapar el centro)

**Páginas que usan blobs (fuera del blog):** mantenimiento.astro usa `Blob` del DS (blur 48, opacity 0.2), 404 es HTML estático (public/404.html) — no migradas aún, OK por ahora.

## Ago 9 (parte 4) — BlobField con VARIANTES por página + fix movimiento

**`BlobField.astro` ahora tiene `variant` prop** — cada página usa figuras, posiciones y colores DISTINTOS (no repite el mismo patrón):
- `blog`: 5 blobs, 8 puntos, paleta coral/magenta/violeta/cian/verde
- `home`: 4 blobs, 10 puntos (redondeados), paleta coral/naranja/amarillo/rosa
- `contacto`: 3 blobs, 6 puntos (alargados), paleta cian/verde/coral
- `servicios`: 4 blobs, 12 puntos (complejos), paleta violeta/cian/verde
- `proyectos`: 3 blobs, 9 puntos, paleta naranja/verde/rosa
Uso: `<BlobField variant="blog" count={5} opacity={0.85} speed={20} />`

**Fix del blob que avanza-retrocede:**
- Causa: `animation-direction: alternate` en el CSS drift → el blob iba y volvía bruscamente
- Fix: keyframes `bf-drift` de 5 pasos (0→25→50→75→100%) sin alternate, vaivén suave coherente
- El morph de forma lo hace el JS (requestAnimationFrame + Math.sin por punto) → "vida" real continua

**Posiciones esparcidas en esquinas** (evita blobs detrás del título — el magenta estaba tapando "diseño"):
- Verificado (gemini vision): "5 formas, título se lee muy limpio, ningún blob encima"

## Ago 9 (parte 3) — Blobs tipo LAVA VIVA (amebas SVG morphing)

**Reescrito `src/components/ui/BlobField.astro`** con la técnica real de la web original (SVG ameba que morpha):
- 7 formas SVG orgánicas (8 puntos de control) que oscilan con `requestAnimationFrame` + `Math.sin` por punto → morph continuo tipo ameba/lava
- Gradiente radial por forma (núcleo vivo + halo), `mix-blend-mode: screen`, blur 2px (mínimo)
- Colores vivos: `#ff6b4a` coral, `#ff4d9d` magenta, `#8f6bff` violeta, `#2dd4ff` cian, `#3dffa0` verde, `#ffa52f` naranja
- Posiciones esparcidas (evita tapar el título), flotación CSS `bf-float` alternante
- Uso en `blog/index.astro`: `<BlobField count={7} blur={34} opacity={0.5} speed={24} />` → reemplazado por `<BlobField count={7} opacity={0.85} speed={22} />`
- `.hero-blobs` con `overflow: visible` (formas pueden asomar, como la original)
- **Verificado (modelo vision gemini flash lite):** "7 formas orgánicas tipo amebas/piedras pulidas, lava viva, colores vivos, contraste excelente con el título" — nota 8-9/10. Build OK, sin errores JS.
- Recordatorio: el efecto original del home usa `<canvas id="Gradients">` + script remoto de Framer (no local). Este componente lo replica sin dependencias.

## Ago 9 (parte 2) — Blobs del blog → componente DS + tipografía

- **Blog hero blobs:** reemplazado el sistema inline (SVG con rotación + blur 60px) por el componente **`src/components/ui/Blob.astro`** del DS. 3 blobs: variant 3 (520px/op0.5), variant 1 (420px/op0.4), variant 2 (460px/op0.45), todos blur=48, posicionados en hero. Eliminado JS generateBlobSVG + CSS .hero-blob* + @keyframes blob-spin.
- **Tipografía blog/page/[page].astro:** Inter → DM Sans (font del DS). Google Fonts link actualizado (DM Sans en vez de Inter). Cero Inter restante en ese archivo.
- **Verificado:** build OK (17 páginas), `npx impeccable detect src/pages/blog/index.astro` = 0 anti-patterns (exit 0). Screenshot visual (gemini flash lite): blobs "sutiles, blur sutil, premium dark mode" ✓.
- **Modelo vision:** `google/gemini-3.5-flash-lite` (tokenrouter) verificado leyendo screenshots. Usar con Tab//model cuando haya imágenes.

## Ago 9 — Audit de seguridad + anti-slop (Cleo)

**Audit completo (seguridad + frontend + anti-slop):**
- **Seguridad PRODUCCIÓN OK:** `.secrets` en .gitignore y NO commiteado ✓; historial git (103 commits) sin secrets ✓; scripts usan process.env ✓; headers seguros en producción (X-Frame-Options DENY, X-Content-Type-Options, Referrer-Policy, Permissions-Policy) ✓; directorios sensibles (/.git, /.env, /src, /node_modules) devuelven 404 ✓; 404 page en español ✓; HTTP/2 + Cloudflare ✓
- **⚠️ .secrets LOCAL DESACTUALIZADO:** tiene `NOTION_DB_ID=3b3d5386e9c580cbad98dc94c7cc7547` (DB VIEJA) y `NOTION_TOKEN` viejo free. La DB correcta es `3b64d62f-1484-81fc-a1b8-d3ba5d87bc0b` (UserDesigners) y el token bueno es `NOTION_API_KEY` (bot Blogs-seo, Pro). Actualizar `.secrets` o borrarlo.
- **⚠️ Headers faltantes en `public/_headers`:** NO hay `Content-Security-Policy` (riesgo medio) ni `Strict-Transport-Security`/HSTS. Los `_headers` de Cloudflare NO se aplican a HTMLs servidos vía `return new Response()` (Astro los emite con sus propios headers). Verificar cobertura real.
- **Anti-slop (`npm run slop`):** 269 cramped-padding + 151 clipped-overflow (mayoría de HTMLs Framer heredados, no bloqueantes), 39 overused-font (Inter como fallback en tokens.css = falso positivo; pero `[page].astro` usa Inter como principal y framer.css carga Inter completo), 12 skipped-heading, 3 bounce-easing, 1 gradient-text, 1 nested-cards, 1 em-dash-overuse.
- **Fix prioridad:** `src/pages/blog/page/[page].astro` línea 79-85 usa `font-family:Inter` como principal → cambiar a `var(--font-body)`. Blobs de colores aleatorios en blog/index.astro volvieron (eran "sin blobs" en Ago 7) — evaluar.
- Screenshots: `/tmp/ud_home.png` y `/tmp/ud_blog.png` (modelo no puede ver imágenes, revisar manualmente).
- Build OK: 17 páginas, 2.56s.

## Ago 8 — Audit exhaustivo + fixes (rama refactor/test-fase1)

**Ramas:** main = producción, refactor/test-fase1 = testing. Trabajar SIEMPRE en test-fase1.

**Estructura nueva (cambiada Ago 8):**
- HTMLs Framer movidos de `public/` a `src/html/` (fuente privada, no se sirven crudos)
- `src/pages/{index,contacto,nosotros,servicios,proyectos}/index.astro` leen de `src/html/` y sirven con `return new Response()`
- `src/pages/proyectos/[...slug].astro` lee de `src/html/proyectos/*.html` — ya NO genera duplicados `.html` en dist
- Eliminado `src/layouts/BaseLayout.astro`, `src/styles/global.css` (tailwind fantasma), `src/styles/framer-global.css`, mixpanel
- 135 archivos sin uso eliminados de `public/assets/local/` (21MB → 1.8MB)

**Fixes SEO/GEO/AEO:**
- og:title "My Framer Site" corregido en 4 case studies
- slug `verificacion-biometrica` (antes `verificaci-n-biom-trica`) + redirects 301 en `public/_redirects`
- schema: eliminados duplicados Organization/LocalBusiness + SearchAction falso en proyectos
- meta description duplicada en proyectos eliminada
- og:image absoluto en BlogPost + seo-doctores (antes relativo/favicon)
- 404.html reescrito en español (antes inglés, HTML inválido)
- pipeline Notion: MAX_POSTS 10 (era 2), sort por fecha descendente, description auto-generada si vacía

**Fixes bugs:**
- filtros de blog ahora funcionan (wiring JS, aria-pressed, focus visible)
- footer `f-col-brand` selector corregido + año dinámico
- seo-doctores: Navbar/Footer componentes (antes inline), rediseño premium
- Giscus verificado OK (repo mattewrobles/userdesigners-web tiene Discussions)

**Pendientes:**
- Migración total a Astro: template base de proyectos desde CSS Framer (los 4 case studies comparten 100% CSS/components — 94KB idéntico md5)
- Lazy loading en imágenes de HTMLs Framer (todas `alt=""` + 247 imgs)

## Ago 4 — Refactor: HTMLs completos vía Response

**Problema resuelto:**
- La web se veía negra/rota por un CSS override agresivo que forzaba `opacity:1!important` en elementos Framer
- El approach anterior (`set:html`) inyectaba HTMLs completos dentro de otro HTML, causando documentos anidados y el refresh bug (F5 en /blog cargaba el home)
- Los content HTMLs fueron reemplazados por HTMLs completos del backup, servidos vía `return new Response()` desde cada página Astro

**CSS fixes inyectados en todos los HTMLs (antes de </body>):**
- `.framer-bjhdpb{align-items:flex-start!important}` — alinea el footer a la izquierda
- `.framer-WOlJs .framer-bjhdpb{overflow:visible!important}` — evita que el contenido se corte
- `.framer-WOlJs.framer-v-1lvxs1p .framer-84xib0{height:auto!important}` — fix altura tablet
- `.framer-WOlJs.framer-v-1lvxs1p .framer-1m25ze8-container{width:auto!important}` — fix email width
- `.framer-WOlJs .framer-1d3wp7v{width:auto!important}` — fix overflow text

**Nueva estructura:**
- `public/{pagina}/index.html` — HTMLs completos de Framer (una página = un archivo)
- `src/pages/index.astro` → `return new Response(html, ...)` — sirve el HTML sin procesar
- `src/pages/blog/[...slug].astro` — rutas dinámicas para posts de blog
- `src/pages/proyectos/[...slug].astro` — rutas dinámicas para proyectos
- Build: `public/` HTMLs toman precedencia en producción, `.astro` pages en dev

**Dev server:** `npm run dev` → http://localhost:4321

## Rutas (17 páginas)
- /, /servicios, /nosotros, /contacto, /proyectos, /blog, /seo-doctores
- /blog/* (6 posts), /proyectos/* (4 proyectos)
- Sitemap auto-generado con las 17 URLs
- 404: `public/404.html`

## Lecciones aprendidas
- NO usar `set:html` con HTMLs completos de Framer — causa documentos anidados
- NO forzar `opacity:1!important` sobre elementos Framer — el animator se encarga solo
- `return new Response()` en el frontmatter de Astro sirve HTML crudo sin procesar
- En build, `public/` HTMLs toman precedencia sobre `.astro` pages (comportamiento esperado)
- Los directorios vacíos en `public/` no afectan el build

## Ago 7 — Blog hero redesign: premium minimal black

**Hero limpio — sin blobs, grid lines, ni glow cycling:**
- Removidos `.bg-blob` y `.bg-blob-2` del HTML y CSS (conic-gradient con blur(140px) + spin animation)
- Removidos `.hero-grid-lines` del HTML y CSS (grid 60px con opacidad 0.03)
- Removido `.hero-glow` del HTML + glow cycling JS (4-color radial gradient interval cada 5s)
- El hero queda solo con `#030303` de fondo, mismo look premium que el home page

**Letter-by-letter animation en hero title:**
- Cada letra del título se envuelve en `<span class="hero-letter">` vía JS
- Animación: `opacity: 0→1`, `filter: blur(10px)→0`, `transform: translateY(20px)→0`
- Stagger: `0.035s` por letra, duración `0.5s`, spring easing
- Mismo patrón que el home page Framer export

**Archivos modificados:**
- `src/pages/blog/index.astro` — HTML: blobs, grid-lines, glow removidos; CSS: hero-letter añadido; JS: glow cycling removido, title animation reemplazada por letter-by-letter

## Ago 7 — SEO/GEO/AEO + n8n blog pipeline

**SEO completado:**
- Meta descriptions: todas 100–160c ✅
- Titles: todas 30–60c ✅
- Alt tags: todas las imágenes ✅
- Schema JSON-LD (@graph): Organization + LocalBusiness + GeoCoordinates (home), FAQPage en nosotros/servicios/contacto/seo-doctores, CreativeWork en proyectos, Blog + BlogPosting en blog
- robots.txt: AI crawlers permitidos (GPTBot, ClaudeBot, Google-Extended, PerplexityBot, Amazonbot) ✅
- OG/Twitter tags: todas las páginas ✅
- Canonical tags: todas ✅

**n8n /blog pipeline (Slack → GitHub Actions → Notion):**
- Workflow ID: s2eM6QlvIuQqNjN6 en n8n.srv923594.hstgr.cloud
- Fix crítico: nodo "Disparar GitHub Action" necesitaba `specifyBody: "string"` + `JSON.stringify()` — sin eso el body llegaba como `{"":""}` y GitHub retornaba error
- Pipeline probado: 3 runs exitosos en GitHub Actions (22:23, 22:04, 21:55 UTC)
- Unsplash hero image: opcional vía UNSPLASH_ACCESS_KEY en GitHub Secrets
- Notion DB: schema dinámico (detecta propiedades automáticamente)

**Fixes adicionales Ago 7 (loop 2):**
- seo-doctores routeId collision → removido `data-framer-hydrate-v2` (commit 8a60318) ✅
- Canonicals proyecto pages: trailing slash + verificaci-n-biom-trica decoded (commit fde1198) ✅
- Audit routeId: colisiones en Framer pages son esperadas (mismo SPA bundle) — no bug ✅

**Pendientes:**
- Mau: configurar `/publish` en Slack → api.slack.com/apps → Slash Commands → URL: `https://n8n.srv923594.hstgr.cloud/webhook/slack-publish`
- Optimizar imágenes (WebP/AVIF, lazy loading) — Framer exports son 500KB+ HTML
- Agregar más posts de blog (generación manual o /blog en Slack)

## Ago 8 — Blog hero fixes: word-break + blob overflow

**Texto "productos" se rompía en letras:**
- El hero title usaba `<span class="hero-letter">` por cada carácter con `display: inline-block`
- El browser trataba cada letra como break point, partiendo palabras a media
- Fix: JS agrupa letras por palabra en `<span class="hero-word">` con `white-space: nowrap`
- Las palabras completas nunca se separan, el `<br>` sigue partiendo líneas normal

**Blobs causaban scroll horizontal:**
- Blobs de 500-550px posicionados en left 40-43% se salían del viewport
- Fix: reducidos a 260-320px, centrados (left 45-55%), blur 60px
- `.hero-blobs` cambió a `overflow: hidden`
- `body` tiene `overflow-x: hidden` como safety net

**Paginación (10 posts/página):**
- `src/pages/blog/index.astro` → `/blog` (page 1, slices 10, mantiene hero + featured post)
- `src/pages/blog/page/[page].astro` → `/blog/page/2`, `/blog/page/3` (getStaticPaths, totalPages-1)
- `src/components/BlogList.astro` — componente compartido: listing + sidebar + pagination nav
- Paginación numérica (1, 2, 3...) con flechas ← →
- rel=prev/next en page/[page].astro para SEO
- Paginación invisible hasta >10 posts

**Sidebar en /blog (BlogList.astro):**
- Categorías (badges)
- Proyectos destacados (Kaito, Novo, Utransfer, Score Fintech)
- CTA "¿Tienes un proyecto?" → /contacto
- Sticky en desktop, orden-first en mobile

**BlogPost.astro — layout premium:**
- TOC (table of contents) desde headings del post, sticky sidebar derecho
- Progress bar de lectura (fixed top, linear-gradient azul→púrpura)
- Subtítulo (description) visible debajo del título
- motion.dev: `scroll()` para progress bar, `inView()` + `animate()` para headings/images/related
- Related posts (misma categoría, 2 cards)
- Giscus componente (placeholder con instrucciones)
- CTA "Hablemos" en sidebar

**Giscus.astro:**
- Placeholder con instrucciones para configurar (repoId, categoryId)
- Requiere: instalar Giscus App + enable Discussions + configurar IDs

**Dependencias:**
- `motion: ^13.0.0` ya instalado

**Archivos modificados:**
- `src/pages/blog/index.astro` — importa BlogList, slice posts, paso de props
- `src/pages/blog/page/[page].astro` — nuevo, paginación para páginas 2+
- `src/components/BlogList.astro` — nuevo, listing + sidebar + pagination
- `src/components/Giscus.astro` — nuevo, componente placeholder
- `src/layouts/BlogPost.astro` — TOC, progress bar, motion.dev, related posts, Giscus

**Pendientes:**
- Mau: configurar Giscus (repoId + categoryId en `src/components/Giscus.astro`)
- Mau: instalar Giscus App en repo + enable Discussions

**Blobs agrandados y subidos:**
- blob-1: 342→500px, top: 35%→10%, left: 47%→40%
- blob-2: 342→500px, top: 38%→13%, left: 47%→40%
- blob-3: 384→550px, top: 47%→20%, left: 49%→43%

**Colores aleatorios en cada carga:**
- JS genera SVG con elipses superpuestas + linear-gradient, mismo estilo que home
- 4-5 elipses por blob, colores HSL aleatorios, transforms orgánicos
- Ángulos y stops también randomizados

**Fixes:**
- Blobs cambiados de círculos CSS a SVG orgánicos (como home)
- Fallback 3s: si animación falla, todos los elementos se vuelven visibles
- Animaciones: badge 0.5s, título letter-by-letter 0.4s/stagger 0.02, sub 0.6s, stats 0.5s, cards stagger 0.05
## Ago 4 — Deploy a producción

**GitHub:** https://github.com/mattewrobles/userdesigners-web
**Cloudflare Pages:** conectado, auto-deploy en cada push a main
- Build command: `npm run build`
- Output directory: `dist`
- Framework: Astro (auto-detectado)
- Deps limpias: solo astro, @astrojs/sitemap, mixpanel-browser
- 17 páginas, build ~5s

**Dominio:** Si quieres conectar userdesigners.com a Cloudflare Pages:
1. Cloudflare Dashboard → Workers & Pages → tu proyecto → Custom domains
2. Agregar `userdesigners.com` (y `www.userdesigners.com`)
3. Cloudflare maneja el DNS y SSL automáticamente

## Ago 5 — Automatización de blogs + deploy

**Pipeline completo:**
- Notion DB → GitHub Action (diario 8am + manual) → Cloudflare Pages → Slack (#users-seo)
- Status flow: Draft → Ready → Published → Archived (delete)
- Slack bot: @users_bot en #users-seo
- GitHub: https://github.com/mattewrobles/userdesigners-web
- Cloudflare DNS: apex + www → userdesigners-web.pages.dev
- 17 páginas, build 3s

**Reglas para crear posts en Notion:**
- Hero Image: URL completa (http:// o https://)
- Contenido: en el body de la página (headings, bullets, quotes, párrafos)
- Status = Ready para publicar, Archived para borrar
- Propiedad "Content" es solo respaldo, ignorarla
