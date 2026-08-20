# UserDesigners Web — Astro Migration

## Ago 20 — Loop de auto-corrección de longitud + tolerancia de título (pedido explícito de Mau)
Mau pidió: (a) que el gate de 1200 palabras no sea un tope duro que rechace por
3-4 palabras, (b) que el propio pipeline corrija en vez de solo rechazar, (c)
preocupación de que bajar el mínimo a 1000 hiciera que el modelo apunte más
bajo (aclarado: NO, el target sigue en 1500-2200, ver entrada anterior).

- **Título:** `seo-rules.mjs` ahora solo bloquea sobre 75 chars (antes 65 duro).
  61-75 queda como warning no bloqueante ("Google puede truncarlo") en vez de
  crítico. El prompt de generación sigue apuntando a ≤65 como objetivo.
- **Loop de expansión real (vivo en n8n, `s2eM6QlvIuQqNjN6`):** agregados 4
  nodos nuevos entre "Aplicar crítica + quality filter" y "Data Table:
  Imágenes usadas": IF `Necesita expansión?` (wordCount<1200 Y
  expandAttempts<2) → `Expandir contenido (Agent)` (prompt específico:
  profundizar con ejemplos/pasos/matices reales, NUNCA relleno ni repetir con
  otras palabras, NUNCA estadísticas inventadas) → `Aplicar expansión` (código,
  incrementa `expandAttempts`, vuelve a chequear) → loop de vuelta al IF. Máx
  2 rondas de expansión por post; si sigue corto después de eso, continúa
  igual (evita loop infinito / rate limit de TokenRouter).
- **Grounding real de la empresa:** agregado un bloque "CONTEXTO REAL DE
  USERDESIGNERS" al system prompt de `Generar borrador (Agent)` y `Expandir
  contenido (Agent)` — compilado de contenido YA existente en el sitio
  (servicios reales: Diseño de Apps/Web/Branding/Research; 12+ años;
  proyectos reales: Utransfer, Airpals, Kaito, verificación biométrica),
  con instrucción explícita de NUNCA inventar métricas de resultado de
  cliente. Esto es un primer paso liviano hacia lo que Mau pidió ("base de
  datos de todo Users") — sin necesidad de vector DB, solo texto inyectado
  en el prompt porque es corto. **Pendiente (requiere a Mau):** si quiere
  citar resultados numéricos reales de clientes (ej. "aumentó conversión
  X%") en los posts, esos números tienen que venir de él — no los voy a
  inventar ni aunque estén en Notion, sino confirmados explícitamente.

## Ago 20 — 3 errores reales del pipeline n8n, reportados por Mau vía screenshots de Slack
1. **Race condition en "Elegir imagen sin repetir"** — el nodo referenciaba
   `$('Data Table: Imágenes usadas')` pero ese Data Table corría en una rama
   PARALELA (sin Merge) a `Unsplash: Buscar imagen`, no como ancestro real →
   "hasn't been executed" intermitente. Fix aplicado vía PUT directo a la API
   de n8n (`s2eM6QlvIuQqNjN6`): reconectado en serie
   (`Aplicar crítica → Data Table: Imágenes usadas → Unsplash: Buscar imagen
   → Elegir imagen sin repetir`) para que el Data Table sea ancestro real.
2. **"Parsear borrador" rompía con JSON malformado del LLM** (comillas sin
   escapar dentro de un string, "after property name in JSON"). Fix: agregado
   fallback `extractFieldsFallback()` con regex directo sobre `description`/
   `content` cuando `safeParse` falla — mismo nodo, aplicado vía la misma PUT.
3. **Gate de palabras mínimas muy estricto** — 1200 rechazaba posts buenos por
   poco (`notion-vs-airtable-design-system` a 1166 palabras). Bajado a 1000 en
   `scripts/lib/seo-rules.mjs` (única fuente de verdad validate+QA). **El
   target de generación NO cambió** — sigue en 1500-2200 tanto en el prompt
   del AI Agent de n8n como en cualquier script nuevo; 1000 es piso de
   seguridad, no lo que se le pide al modelo (aclarado explícitamente porque
   Mau preguntó si esto haría que el modelo apunte más bajo — no es el caso).

Regenerado `errores-comunes-diseno-ux` (título >65 chars + frase genérica
"en este artículo") con `scripts/fix-ready-drafts.mjs` (nuevo, reutilizable
para posts Ready — a diferencia de `regenerate-published-posts.mjs` SÍ puede
cambiar el título porque el post no está indexado todavía). Pasa el gate
crítico (0 issues), quedan solo warnings no bloqueantes (links internos/
autoridad — el mini-prompt del script no los genera, a diferencia del de
posts Published).

`senales-auditoria-web-posicionamiento` (el otro post excluido en los logs
de Slack) **ya no existe en Notion** — ninguna página con ese slug en toda
la base, ni archivo local. Se perdió en los 2 intentos fallidos de
regenerar el mismo tema (09:25-09:27, antes de estos fixes). Con los 3 bugs
arreglados, un `/blog` nuevo sobre ese tema debería generar limpio.

## Ago 20 — Fix concurrency sync-blog.yml
3 disparos manuales seguidos de `sync-blog.yml` (14:24-14:29) pisaron el
`git push origin main` entre sí → job marcó failure aunque 2 de 3 sí
commitearon. Fix: agregado `concurrency: group: sync-blog-<branch>` +
`cancel-in-progress: false` (encola en vez de cancelar, para no abortar un
push a medias). Push directo a main: commit `0ac2659`.
Pendiente: no verificable desde GitHub — estado de Reddit 403 y cola de
`blog_idea_queue` hay que chequearlos en el panel n8n directo.

## Ago 20 — Auditoría + mejoras automatización de blog (rama `feat/blog-automation-improvements`, sin mergear)

**Confirmado (no cambiado):** el bug de "Validate SEO" bloqueando el sync ya
estaba resuelto por el commit `125d9b1` (19-ago 19:33). Los 3 runs fallidos
previos eran anteriores a ese fix; el run de las 00:36 (posterior) ya pasó OK.

**Nuevo — QA temprano de posts Ready:**
- `scripts/lib/seo-rules.mjs` — reglas SEO/GEO críticas y de warning extraídas
  de `validate-blog-seo.mjs` a un módulo compartido (DRY), ahora también usado
  por el nuevo QA check.
- `scripts/qa-check-ready-posts.mjs` + `.github/workflows/qa-check-ready.yml`
  (cron diario 9am ET) — avisa a Slack SI un post en Notion Status=Ready tiene
  problemas críticos, sin esperar al sync semanal (que además solo procesa 1
  post por corrida).

**Nuevo — GEO/AEO:**
- `scripts/generate-llms-txt.mjs` — regenera `public/llms.txt` automático en
  cada sync con TODOS los posts (antes era una lista manual desactualizada,
  solo tenía 7 de 22 posts).
- Reglas GEO nuevas en `seo-rules.mjs` (respuesta directa post-H2, señal de
  frescura, preguntas FAQ en negrita) + reforzado el prompt de
  `generate-blog-draft.js` con instrucciones GEO explícitas.
- `docs/SEO-GEO-AEO-CHECKLIST.md` — referencia viva de qué está automatizado
  y qué queda a criterio humano.

**Anti-slop check — diagnóstico:**
- 1 falso positivo real encontrado y arreglado (`broken-image` en
  `servicios/index.astro` — era un regex de string, no markup real; ignorado
  vía `.impeccable/config.json` con `hook-admin ignore-value`).
- Los 4 warnings restantes (gradient-text en `seo-doctores`, flat-type-hierarchy
  en `contacto`, layout-transition en `ServiceTabs`) son reales pero fuera del
  scope de blog — el gate nunca fue verde históricamente por deuda acumulada
  en todo el sitio. Necesita una sesión de diseño dedicada, no lo tapé.

**Nuevo — forum listening (sin auto-post, Mau publica siempre manual):**
- `scripts/n8n-forum-listening-workflow.json` — workflow n8n NUEVO (no toca
  el protegido de blog) que lee alertas de F5Bot por Gmail y avisa a Slack.
- `docs/FORUM-LISTENING.md` — setup manual (F5Bot signup, credenciales n8n) +
  guías de participación orgánica.

**Nuevo — distribución LinkedIn:**
- `scripts/post-to-linkedin.mjs` + paso nuevo en `sync-blog.yml` (se salta
  solo si faltan `LINKEDIN_ACCESS_TOKEN`/`LINKEDIN_ORG_URN`).
- `docs/LINKEDIN-DISTRIBUTION.md` — setup manual (requiere OAuth de un admin
  de la página, no automatizable).

**Pendiente (requiere a Mau):** signup F5Bot + credenciales Gmail/Slack en
n8n, app de LinkedIn + token, revisar los 4 warnings de anti-slop fuera de
scope, decidir si mergear la rama a main.

## Ago 15 — Analytics completo: SA + Sentry full stack (deploy live)

**Herramientas en producción (todas conviven):** GA4 (G-PDZVJDG9Y5) + Clarity (xytbbmamwh) + Mixpanel (nosotros/servicios) + SimpleAnalytics + Sentry.

**Sentry (@sentry/astro v10.70):**
- SDK oficial en páginas Astro nativas (blog, contacto, seo-doctores); browser loader en HTML de Framer (src/html/*)
- Config: sentry.client.config.js + sentry.server.config.js + astro.config.mjs (org user-designers, proyecto users-website)
- `SENTRY_AUTH_TOKEN` en ~/.apikeys.sh (personal, scope project:write) — source maps OK
- **Métricas:** src/lib/analytics.ts — page_view, blog_post_click, blog_post_read (scroll 50%), blog_read_time_ms, contact_channel_click, contact_form_submit/error, seo_doctor_cta_click
- **Feedback widget** flotante (colorScheme system, isNameRequired)
- **Replays:** maskAllText:false + maskAllInputs:true (texto visible, form protegido); 10% sesiones / 100% en error
- **Logs:** enableLogs:true (console + network automático)
- **Profiling browser:** 50% sesiones, Document-Policy js-profiling en _headers
- CLI Sentry instalado en ~/.local/bin/sentry (`sentry issue list user-designers/users-website`)

**Pendiente:** cloudflare env var SENTRY_AUTH_TOKEN si se quieren source maps desde el build de Cloudflare.

## Ago 12 — Contacto nativo final + Framer eliminado del blog ★

**Contacto `/contacto/` definido como página final** (100% Astro nativo):
- Form por WhatsApp, BlobField 2 glows grandes, H1 centrado blanco, canales (WhatsApp/email/ubicación) con iconos blancos
- **Testimonios en marquee infinito** (2 filas direcciones opuestas, componente `Marquee.astro` + `TestimonialCard.astro` nuevo): cards 400×260px, radius 16px, gap 24px, avatares circulares con fotos reales (descargadas de Framer a `public/assets/local/testimonio-{juan,sandra,diego,rosalia,grecia,janne}.{png,jpeg}`)
- Fix box-sizing en card (desbordaba 260→326px y se cortaba), quote clamp 5 líneas
- Fix Button.astro para `type="submit"` y Marquee.astro para `reverse` real (keyframes invertidos) + gap configurable
- **Basura Framer eliminada:** `src/html/contacto.html` borrado

**Blog liberado de Framer** (12 ago):
- `src/styles/framer.css` (195KB) ELIMINADO — se inyectaba en `blog/index.astro`, `blog/page/[page].astro`, `layouts/BlogPost.astro` (3 páginas)
- Overrides `.framer-*` obsoletos removidos de blog/index.astro
- Blog verificado: lista + featured + posts + paginación OK, 0 errores, sin rastro framer.css

**Pendientes:** home, servicios, nosotros, proyectos (siguen con `src/html/*.html` Framer). Resto de assets Framer en `/assets/local` sin organizar.

## Ago 12 — Contacto migrado a Astro nativo ★ (ramas refactor/test-fase1)

**Página `/contacto/` reconstruida en Astro nativo** (ya no sirve `src/html/contacto.html` — archivo ELIMINADO).

- **Contenido real preservado:** hero "Hablemos de tu proyecto", canales (WhatsApp +593 0961026799, latam@userdesigners.com, Cuenca Ecuador), form (Nombre/Email/Concepto/Descripción) y los 6 testimonios originales Framer (Juan Méndez, Sandra García, Diego Morales, Rosalía Moscoso, Grecia Ochoa, Dra. Janne).
- **Basura de template Framer eliminada:** bloques ocultos demo (Gujarat India, +91, Rehandon@gmail.com), páginas demo.
- **Form → WhatsApp:** al enviar arma mensaje (nombre/email/concepto/descripción) y abre `wa.me/593961026799`. Sin backend externo.
- **DS completo:** BlobField variant="contacto", Navbar/Footer, Button stroke, Reveal, SectionLabel, tokens semánticos.
- **SEO:** title/desc/canonical/OG/Twitter + schema ContactPage+Organization+ContactPoint+WebSite, GA4 G-PDZVJDG9Y5.
- **0 anti-patterns** en `npm run slop` (impeccable) para la página nueva.

**Cambios a componentes del DS (reusables):**
- `Button.astro`: soporta `type="submit"` (antes siempre renderizaba `<a href="#">`).
- `Reveal.astro`: acepta `class` para fusionar con clases externas.
- `Footer.astro`: `overflow: hidden` en `.f-footer` — arregla scroll horizontal en mobile (afectaba TODAS las páginas).

**Nota:** el resto de páginas principales (home, servicios, nosotros, proyectos) siguen en Framer con `src/html/*.html`. Contacto ya no depende de Framer.

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

## Ago 13 — Home migración: HERO reconstruido en Astro nativo ★ (en curso)

**Inicio de la migración total Framer→Astro** (plan en REFACTOR-PLAN.md v2). Estrategia: fidelidad 1:1, sección por sección, verificación visual iterativa.

**Hero del home reconstruido** (`src/components/home/HomeHero.astro`):
- Replica exacta de: Content(Top+SocialProof) + Gradient Blur + Line + Title del HTML Framer
- H1 "Agencia de UX/UI orientada a Fintechs": Familjen Grotesk clamp(38px,5.2vw,72px) 500, -0.03em, balance, centrado (break natural: "Agencia de UX/UI" / "orientada a Fintechs")
- Sub: blanco 94%, glow corregido (ya no tapa el texto)
- Botón "Ver servicios": Button stroke + borde brillante glass (box-shadow inset) reforzado
- Glow: masa linear-gradient 140deg oro→coral→lila→cian (blur 80px, hard-light, left -167px) + 2 radial-gradients (amarillo arriba-izq, cian abajo) — fiel al original
- Línea con pulso blanco animado (keyframes CSS)
- Kicker "NUESTROS SERVICIOS" (14px, rgb(187,187,187), uppercase) + H2 "Más de 12 años..." (49px -0.04em 1.4em)

**Logos de clientes** (`src/components/home/HomeLogos.astro`):
- Extraídos del HTML Framer: 7 SVGs (con <use> resueltos) + 4 SVGs data-URI + 3 PNG
- Guardados en `public/assets/local/logos/` (14 assets)
- Carrusel infinito con `Marquee` (mask fade, speed 32), blancos brillantes (filter brightness(0) invert(1))

**BUGS RAÍZ encontrados y arreglados (mejoras globales del DS):**
- `Reveal.astro` y `LetterReveal.astro`: añadido fallback de robustez (3s) que CANCELA las animaciones WAAPI congeladas y fuerza el estado visible. El contenido ya NUNCA queda oculto/borroso si la animación no corre (headless, tab oculta, JS pausado). Antes el H1/sub podían quedar en opacity 0 o blur(10px) — el mismo anti-pattern que tenía el Framer original.
- H1 wrap: el flex item no wrappaba por `min-width:auto`. Fix: hero-text como block + `min-width:0` + `text-wrap:balance`.

**Verificación:** 13 iteraciones build+screenshot+modelo vision. H1 10/10, botón 8/10, glow 8/10. NOTA: el modelo vision de bajo costo FALLA en contrastes de textos secundarios sobre negro (percibe oscuro lo que PIL mide blanco puro) — verificar el sub/kicker en browser real.

**Páginas temporales (borrar al finalizar migración):**
- `src/pages/hero-preview.astro` — preview del hero (localhost:4322/hero-preview)
- `src/pages/diag.astro` — diagnóstico de medidas (h1 wrap, colores)

**Próximo:** sección Service Tabs (5r60op) del home → luego Benefits (clnx2s) → Proyectos → Team → Blog → CTA. Repetir ciclo por sección.

## Ago 13 — Home hero: FIXES feedback de Mau (glow blog + logos + textos)

**Feedback Mau y fixes (v14-v22):**
- **Textos secundarios blancos y más pequeños:** sub a clamp(14px,1.3vw,15px) weight 400 + trust 14px regular — ANTES estaban en rgba(255,255,255,0.94)/19px. **Causa raíz del "apagado":** los textos estaban envueltos en `Reveal` (opacity 0 + blur inicial) → si la animación no corría, quedaban invisibles. **Fix global:** los textos secundarios del hero ya NO usan Reveal (visibles desde el primer frame). Los componentes Reveal/LetterReveal tienen fallback 3s que cancela WAAPI.
- **Glow animado tipo blog:** reemplazado el glow estático (masa linear-gradient) por **BlobField variant="hero"** (creada). 3 blobs arriba-izquierda, colores análogos con sat 95-100% + lum 60-72% (antes 90-100/52-66 → se veían apagados), opacity 0.65, blur 24.
- **BUG importante del BlobField:** el `<script>` tiene su PROPIO mapa `schemes` por variante (separado del frontmatter `variants`). Si una variante no existe en el script, cae a `schemes.blog` (blobs ABAJO). Hubo que agregar `hero` al schemes del script. **LECCIÓN:** al crear una variante nueva hay que agregarla en 2 lugares (frontmatter + script schemes).
- **Logos del marquee:** tamaños EXACTOS del original (extraídos del CSS Framer: Banco 141x28, Toyota 123x21, Logo2 140x21, Group1316 135x22, Logo3 107x29, Logo1 140x29, Logo4 115x24, Group355 89x22, Logo5 124x25, Logo6 117x29, Logo7 84x29, AIG 78x40...). Width fijo en cada logo → marquee estable.
- **SVGs de logos rotos (por eso se veía "Cliente"):** los SVGs extraídos del `#svg-templates` del Framer tenían `fill="none"` en el raíz → los paths no dibujaban. Fix: `fill="none"` → `fill="black"` en los 7 SVGs `<use>`. Los data-URI tienen fill rgb(188,188,188) → con el filter brightness(0) invert(1) quedan blancos. Los 3 PNG son blancos (para fondo oscuro) → OK con el filter.

**Estado hero v22:** glow 9/10 (rojos/corales/magentas vivos arriba-izq, legibilidad 10/10), H1 9-10/10, botón 8/10, sub blanco 9/10. Global ~8.5/10.

**Pendiente:** Mau verificar en browser real (el modelo vision de bajo costo falla en contrastes y alucina alts). Luego siguiente sección del home (Service Tabs 5r60op).

## Ago 13 — Home hero v23-24: marquee 620px + logos SVG inline (fix definitivo "textos")

**Feedback Mau:**
- Marquee original "no tan ancha" → `max-width: 620px` (ancho del SocialProof del Framer). Animación más suave → Marquee `speed={70}`.
- Blob "no tan arriba" → scheme hero `[{x:30,y:190},{x:210,y:300},{x:110,y:420}]` (punto medio entre el blog y el extremo superior).
- **"Logos sin imagen, estás poniendo textos"** → causa raíz: los `<img src=".svg">` fallan en Chrome real de Mau (los SVGs data-URI decodificados + refs a clipPath ausentes) → el browser muestra el ALT como texto. **Fix definitivo: SVGs INLINE** en el componente (no dependen de archivos externos). 11 SVGs inline con `fill: currentColor` + `color:#fff`. PNG (utransfer/banner/blanco) siguen como img con aria-hidden. Contenedor con aria-label. A11y correcto sin mostrar texto si algo falla.

**Estado hero v24:** vision confirma logos CHANGAN/FIDEVAL/Utransfer/BCP/Toyota visibles, sin textos raros. Glow OK. Global 8.5/10.

## Ago 13 — Home hero: responsive arreglado (box-sizing) + logos OK

- **Bug responsive mobile:** el hero usaba content-box → width 100% + padding 16 = 532px (desborde 32px). Fix: `box-sizing: border-box` en .hero + hijos. El H1 ya no se expande a 500px (wrap correcto en 2 líneas).
- **Logo mancha blanca (logo-117x29):** el CSS `svg * { fill: currentColor }` rellenaba el rectángulo `fill="transparent"` del SVG → bloque blanco. Fix: `filter: brightness(0) invert(1)` en los SVG inline (respeta transparente, blanquea paths). Ninguna mancha restante (vision: "ninguna").
- **Colores del glow:** baseHue ahora SIN verde/ámbar → rojos/corales (0-45), azules/violetas (210-270), magentas/violetas (300-360).
- **Páginas diag temporales:** diag.astro, diag-logos.astro, diag-logos2.astro, hero-preview.astro (borrar al final).
- **Estado hero:** listo (desktop 9/10, mobile sin overflow). SIGUIENTE: Service Tabs (5r60op) del home.

## Ago 13 — Home: ServiceTabs construido (v1)

**`src/components/home/ServiceTabs.astro`** — sección de servicios del home (Framer 5r60op):
- Split: mockup UI a la izquierda (card oscura border 1px rgb(40,40,40), radius 22, dashboard fintech: barras doradas gradient + gráfica de línea oro→cian + "DOM LUN MAR..." + "$4,508.00 Esta semana") + 4 servicios a la derecha.
- 4 servicios interactivos (Research, UX/UI & Redesign, Métricas y OKRs, Consultoría de MVPs) con título + descripción. Active state (título dorado, bg sutil). Click cambia.
- Responsive: column-reverse <900px, ajustes <480px.
- Pendiente: verificar en browser real + refinar los mockups de los otros tabs (hoy dashboard/wireframe genéricos).

**Verificado v1:** split correcto, mockup fintech OK, Research activo dorado OK.

**Próximo:** Benefits (clnx2s, line-scroll) → Proyectos (1024udx) → Team (14rvqy3) → Blog (161p1ww) → CTA. Luego ensamblar index.astro nativo.

## Ago 14 — Análisis real del original (playwright con scroll) + fixes hero

**Método nuevo (lo que Mau pidió):** monté playwright (chromium cache ms-playwright) para capturar el home ORIGINAL con scroll real (10 posiciones, /tmp/udcaptures/original/) y comparar contra mi versión con el modelo vision + muestreo de pixels (PIL).

**Hero — glow CORREGIDO con datos:** muestreo de pixels mostró que el original tiene CIAN ancho a la izquierda (x5-35%) + franja naranja en x45% + derecha limpia. Mi glow ahora coincide estructuralmente: masa estática horizontal (cian 0-55% → coral 80% → oro 93% → transparente) + BlobField sutil (0.3, colors cian/azul/coral/oro sin lila/magenta). Blobs solo a la izquierda.
- H1 (66px Familjen), sub (15px), botón (borde sutil), logos: vision confirma "coinciden".
- Animaciones de appear al scroll: re-activados los Reveal (fade up, blur=false) con fallback robusto.
- padding-top subido a clamp(120px,15vh,170px) para compensar navbar.

**ServiceTabs v1 — DIFIERE del original (a rehacer):**
- Original: mockup izquierdo = DASHBOARD FINANCIERO complejo (sidebar Dashboard/Transactions/Payments, tablas, gráfica de líneas, tarjeta "Bono" flotante). Items derecha = TEXTO PLANO (sin cards), primer ítem activo.
- Mi v1: mockup = barras simplificadas (NO es el dashboard original), items en cards. **Rehacer: mockup dashboard original + items texto plano.**
- El mockup original = componente "Shoperz_screen" del HTML Framer.

**Próximo:** analizar Shoperz_screen del HTML → replicar dashboard en ServiceTabs → luego Benefits (line-scroll), Proyectos, Team, Blog, CTA. Comparar cada sección contra orig_*.png.

## Ago 14 — HOME COMPLETO ENSAMBLADO (esqueleto nativo + comparación real vs original)

**Secciones construidas (todas en `src/components/home/`):**
1. `HomeHero.astro` — glow masa gradiente horizontal cian→coral→oro (ajustado por muestreo de pixels vs original: cian x5-35% + naranja x45% + limpio der) + BlobField sutil (colores fijos 4 del original, sin lila/magenta). H1 66px Familjen, sub 15px blanco 1.7, botón borde sutil, logos marquee 620px. Reveals con fallback.
2. `ServiceTabs.astro` — split: dashboard fintech (sidebar Dashboard/Transactions/Payments/Cards/Capital/Accounts + Bill Pay, Search with IA, Transactions, Net cash $2.3M + gráfica coral, tabla transacciones, tarjeta Bono flotante) + 4 servicios texto plano (activo = título blanco, scrollspy con IntersectionObserver cambia el mockup).
3. `Benefits.astro` — PROCESO DE DISEÑO + H2 + timeline 4 pasos (Kick-off, Planning, Ejecutamos, Metodologías ágiles) con línea que se dibuja al scroll (motion useScroll scaleY) + stats 100%/+200/↑100 + marquee herramientas (Figma, Rive, Framer, Webflow...) + frases finales.
4. `Proyectos.astro` — CASOS DE ESTUDIO + grid cards (Utransfer, N***, K***, Papers, Verificación biométrica).
5. `Team.astro` — Nuestro team + grid 7 miembros (fotos descargadas a /assets/local/team/).
6. `Metricas.astro` — DAMOS VIDA A TU IDEA + título.
7. `BlogSection.astro` — BLOG + 3 posts reales (content/blog) con fecha/readTime.
8. `CTASection.astro` — botón "Conoce más".
9. Navbar + Footer (componentes existentes).

**Preview ensamblado:** `src/pages/hero-preview.astro` (localhost:4322/hero-preview, scrollHeight 7311 vs original 16967 — el original tiene los 4 mockups grandes y más contenido).

**Verificado con vision:** secciones todas presentes en orden. Imágenes proyectos/team/blog son DARK (diseño dark, no rotas). Marquee tools OK. El vision falla en contrastes del sub (blanco real).

**IMPORTANTE:** index.astro sigue sirviendo el HTML Framer original (producción intacta). El home nativo se activa cuando se complete la fidelidad fina.

**Pendiente de fidelidad fina (próximas sesiones):**
- Mockups de los otros 3 tabs de servicios (hoy variación simple del dashboard; el original tiene 4 mockups distintos).
- Animaciones scroll del original por sección (aparecer por elementos, line-scroll ya hecho).
- Espaciados verticales reales vs original (scrollHeight 7311 vs 16967).
- Ensamblar index.astro nativo + quitar dependencia Framer (Fase 5 del plan).

## Ago 14 — Fixes "arregla todo" (textos negros, blob estático, team fotos, quotes GSAP)

- **Textos del hero en NEGRO (bug raíz):** al envolver sub/trust/logos/kicker/h2 en `<Reveal>` (componente hijo), el CSS scoped del HomeHero dejó de aplicar (el elemento tiene el data-astro-cid del Reveal, no del hero) → color negro por defecto. **Fix: `:global(.hero-sub)`, `:global(.hero-trust)`, `:global(.hero-cta)`, `:global(.hero-logos)`, `:global(.hero-kicker)`, `:global(.hero-h2)`.** Verificado con getComputedStyle: sub/trust rgb(255,255,255). LECCIÓN: en Astro, CSS scoped de un componente NO aplica a elementos de componentes hijos → usar :global.
- **Blob "estático":** el BlobField con opacity 0.3 + blur 48 era casi imperceptible. Subido a opacity 0.55 + blur 38. Verificado: 42.8% de pixels cambian entre frames → el glow ANIMA (morphing de blobs).
- **Team fotos repetidas:** extraídas las 7 URLs correctas del HTML original (mapeo por nombre → background-image). Descargadas: foto-cristian (WPIobh4jp), foto-5 (Liseth/y0HpMVZj), foto-1 (Nahomi/uTn11lno), foto-gabriela (PwBtYRp1), foto-2 (Bernarda/e4ooxdfx), foto-3 (John/k0CDPF0b), foto-4 (Mauricio/BYhaqTSS). Sin repeticiones.
- **Team con GSAP:** reveal premium (fade up + blur + stagger 0.08) al scroll, respeta prefers-reduced-motion.
- **Quotes del Benefits con GSAP:** las 4 frases con reveal de PALABRAS (yPercent 115 + blur 8px → stagger 0.045, power4.out) via ScrollTrigger. Verificado: 44 palabras, opacity 1 tras scroll. Fallback: `html.has-motion` + visibility hidden solo si JS corre.
- **Mobile:** H1 3 líneas sin cortes, sin overflow (vision 8/10).

**Estado:** hero + services + benefits + proyectos + team + métricas + blog + cta + footer todos funcionales con animaciones GSAP/motion. Producción (index.astro) intacta. Pendiente: fidelidad fina de espaciados/mockups de tabs vs original.

## Ago 14 — RÉPLICA EXACTA del home (HTML original sin player) ★ MÉTODO DEFINITIVO

**El problema:** mis secciones interpretadas (HomeHero/ServiceTabs/Benefits...) NO eran clones del original. Mau: "se ve genérico".

**Solución definitiva — `src/components/home/HomeFramer.astro` (página `/home-framer/`):**
- Inyecta el HTML LITERAL de `src/html/index.html` (Framer) sin scripts ni <style> inline.
- CSS exacto en `public/framer-home.css` (193KB, servido estático, sin minificar — lightningcss rechazaba selectores vacíos inline).
- Forza visibilidad: `opacity:0.001/0` → 1, `translateY/translateX` → none, `blur(10px)` → none.
- Canvas Gradients reimplementado (el script remoto del player no existe): 4 blobs radiales (cian izq grande + lila + coral centro + oro abajo) que morphean con rAF. El canvas queda DENTRO del contenedor original (glow 1lkyifs, blur 50, mix-blend normal).
- Reveals GSAP sobre el HTML: los `data-framer-appear-id` (12 elementos) aparecen con stagger/scroll, letter reveal del H1.
- **scrollHeight IDÉNTICO al original (16967px).** Vision: "se ven casi idénticas, estructura/tipografía/atmósfera muy precisa".

**Bugs resueltos en el camino:**
- lightningcss "Invalid empty selector" → CSS a archivo estático.
- Canvas no visible: (1) el CSS override scoped NO aplicaba al HTML inyectado → `:global()`; (2) `Math.sin` recibía el string de color → NaN → `ph` numérico; (3) el contenedor colapsaba (height:unset del CSS Framer) → override height 72%; (4) gradiente con alpha bajo → stops sólidos.
- **LECCIÓN clave:** el CSS scoped de Astro NO aplica a HTML inyectado con set:html → usar `:global()`.

**Comparar:** `/home-framer/` (réplica exacta) vs `/` (original). El hero-preview sigue con las secciones interpretadas (referencia de animaciones custom).

**Pendiente:** balance fino del cian en el glow (el original tiene cian más extenso a la izquierda). Las secciones interpretadas (HomeHero etc.) pueden descartarse o usarse como referencia — el camino real es HomeFramer.

## Ago 14 — HOME MIGRADO A ASTRO 100% (sin nada de Framer) ★★

**Mau: "no quiero que tenga nada de framer, migra todo a astro".** Hecho para el home:

1. **`src/html/home-native.html`** (343KB) — el HTML del home CONVERTIDO:
   - 619 clases `framer-XXX` → `ud-XXX` (renombrado automático).
   - 37 imágenes + 1 SVG de `framerusercontent.com` → `/assets/local/home/` (38 locales).
   - Navbar embebido (era un `<header id="hero">` que contenía TODO el hero — ojo, quitar el header completo mataba el hero; se quitó SOLO la sección `id="navbar"`).
   - Footers embebidos (variantes `id="footer"`) → eliminados.
   - Scripts/`.mjs`/comentarios SSR → eliminados.
   - 0 refs a "framer".

2. **`public/home.css`** (175KB) — el CSS de Framer renombrado (ud-) + URLs locales + 94 fuentes woff2 descargadas a `/assets/fonts/`.

3. **`HomeFramer.astro`** — ahora renderiza: `Navbar.astro` (nativo) + body renombrado + `Footer.astro` (nativo) + home.css. Canvas de blobs propio + reveals GSAP.

4. **Verificado:** Navbar IDÉNTICO al original (el nativo ya tenía Contacto), H1 correcto, scrollHeight 16791 vs 16967 original (diff 176px del navbar). Vision: "Navbar idéntico, Hero muy similar".

**Estado del home:** migrado a Astro sin dependencia de Framer (el HTML/CSS están en el repo, las imágenes y fuentes locales, el JS es propio). La página `/home-framer/` es la referencia.

**Pendiente para activar en producción:**
- `index.astro` aún sirve el HTML Framer original (producción intacta). Cuando se valide `/home-framer/`, swap de index.astro.
- Limpiar páginas temporales (hero-preview, diag, diag-logos, diag-logos2) y `framer-home.css` (ya no se usa).
- Las secciones interpretadas (HomeHero/ServiceTabs/Benefits...) quedan como referencia; el camino real es home-native.

## Ago 14 — Home nativo: fixes de interacciones (feedback Mau)

**Feedback:** marquees no se mueven / hovers de cards / botones DS / textos cortados.

**Fixes aplicados en HomeFramer.astro:**
- **Marquee de logos animado:** el carrusel del hero (`.ud-12n3d87-container > section`) se duplicó + anima translateX con GSAP (38s loop). VERIFICADO: 35.4% de la zona cambia entre frames → se mueve.
- **Hovers de cards de proyectos:** `.ud-1ffk5y7` (Image Container) → imagen scale 1.05 en hover (CSS).
- **Hovers del team:** `.ud-14rvqy3 img` → grayscale(0.3) → color + scale en hover.
- **Botones:** los CTAs del home ("Ver servicios", "Conoce más") son del HTML original con su sistema Stroke/Fill (glow del borde) — look idéntico al original y consistente con el Button DS. El Button.astro literal no aplica al HTML inyectado (CSS scoped).
- **Textos cortados:** no detectados en las secciones verificadas (servicios, team). Pendiente: Mau indique cuáles exactos si los ve.

**Verificación:** marquee OK, secciones OK (vision no encontró cortes graves).

## ⚠️ PUNTO DE CONTINUACIÓN (para retomar la sesión)

**Mau pausó la sesión aquí. Para continuar:**
1. Leer la memoria guardada (supermemory project) — contiene estado completo + bugs aprendidos.
2. El home migrado a Astro nativo está en `/home-framer/` (localhost:4322). Producción (index.astro) sigue con el Framer original.
3. Pasos pendientes: (a) Mau valida /home-framer/ visualmente, (b) swap de index.astro a nativo, (c) limpiar páginas temporales (hero-preview, diag, diag-logos, diag-logos2, framer-home.css), (d) convertir secciones a componentes DS propios, (e) migrar nosotros/servicios/proyectos.
4. Preview server: `./node_modules/.bin/astro preview --port 4322` (el binario local, no npx).

## Ago 16 — Migración a Astro: home 1:1 + previews de páginas (avance nocturno)

**Estado:** el home migrado a Astro nativo está en `/hero-preview` (hero nuevo aprobado con glow cian/rojo fijo + secciones 1:1 del home-native.html + BlogSection dinámico). Producción `/` sigue con el Framer original (localhost:4321). **NO usar `/home-framer/` (fue eliminado).**

### Lo que funciona (verificado)
- `/hero-preview`: hero nuevo (HomeHero.astro, glow cian rgb(20,138,188) + rojo rgb(175,2,2), screen+blur40, blobs morph) + Product/Solutions/Service/Team/Bannner 1:1 (alturas idénticas al original) + blog dinámico CMS.
- `scripts/migrate-pages.mjs` genera `servicios/nosotros/proyectos-native.html` desde los framer (renombra framer→ud, limpia player, URLs locales, quita nav/footer).
- 71 imágenes framer descargadas a `public/assets/local/`.
- `servicios-preview.astro`: hero de servicios OK (título + mockup de app), navbar/footer DS OK, logos OK. **PENDIENTE**: carruseles internos (proceso, tarjetas Works) se ven superpuestos/espacios negros — el player de Framer rotaba slides; sin player quedan en fila/inflados.

### Bugs aprendidos (clave para retomar)
1. **Wrapper root:** los selectores del CSS nativo usan `.ud-pRmuk .ud-X` — el wrapper del preview debe tener `class="ud-tqfFO ud-72rtr7 ud-pRmuk"` (3 clases). Sin `ud-pRmuk` TODO colapsa a 196px.
2. **Header del hero sin cierre:** el `<header data-ud-name="Hero">` del export NO tiene `</header>`. En el preview hay que separarlo del contenido y cerrarlo (`+ "</header>"`), si no el navegador mete las secciones siguientes DENTRO.
3. **Astro pierde `<style>` y `<script>` inline** de página cuando hay `set:html` masivo → usar `is:inline` en ambos, o no se sirven.
4. **Fix de alturas:** `height:min-content` + hijos `position:absolute` colapsan sin el player. El script `fixLayout` (is:inline) mide el bottom real de los hijos visibles y setea `min-height`. OJO: infla si hay carruseles horizontales (slides a left:9000) — el filtro de ancho (`cr.left > childRect.right`) ayuda pero el hero quedó a 2297px (debería ~700px).
5. **Carruseles de Framer (Stack rotativo)** no se replican sin JS: muestran la 1ª slide o fila horizontal. En servicios afectan: proceso (rectángulo blanco) y tarjetas Works (solo Diseño de Apps visible, resto oculto con display:none de slides 1tww95g/pclehy/3ayvaa).
6. **cleo-vision rate limit:** máx 2 req/min → esperar ~65s entre llamadas.
7. **Dev server:** reiniciar con `kill <pid astro>` (ps aux | grep astro) y `npx astro dev --host 127.0.0.1`. `pkill -f "astro dev"` NO matchea el proceso real (`astro.mjs dev`).

### Siguiente sesión
1. Terminar servicios-preview: arreglar carrusel del proceso (mockup vertical) y tarjetas Works (grid). Considerar: ocultar las slides internas que inflan, o aceptar 1ª slide.
2. Crear `nosotros-preview.astro` y `proyectos-preview.astro` (mismo patrón: wrapper ud-tqfFO ud-72rtr7 ud-pRmuk + hero separado + style/script is:inline + fixLayout).
3. Mau valida `/hero-preview` y `/servicios-preview`, luego swap de index.astro a nativo.
4. Limpiar páginas temporales (diag, diag-logos, diag-logos2) y framer-home.css.
5. Verificación final: 0 código Framer en render + agente crítico >95% por sección.

## Ago 16 (continuación) — Home fixes + 3 páginas migradas

**Home corregido** (lo que Mau reportó):
- **Duplicado "NUESTROS SERVICIOS"**: el `HomeHero.astro` tenía un bloque intro (hero-kicker "NUESTROS SERVICIOS" + h2 "Más de 12 años") que duplicaba la Product section nativa inyectada. **Fix**: se quitó el bloque hero-title del HomeHero.
- **Textos cortados** ("uestros números..." con N cortada): los estados de entrada del player usaban `translateX(±Npx)` con `opacity:0` que quedaban congelados → desplazaban el texto fuera del contenedor overflow:hidden. **Fix**: regex en hero-preview que limpia `translateX(±Npx)` (NO los `-50%` de centrado). 17 desplazamientos limpiados, 0 problemas de desbordamiento tras el fix.

**Páginas migradas (previews nuevos):**
- `src/pages/servicios-preview.astro` — hero con mockup (fix scale/opacity), tarjetas de servicios reposicionadas en columna (left:100, gaps 249) con `position:absolute !important` sobre el contenedor sticky.
- `src/pages/nosotros-preview.astro` — hero + NUESTRA EXPERIENCIA + CONOCE NUESTRO EQUIPO (7 miembros con fotos cargadas) + ÁREAS DE EXPERTIZ + CTA + footer. **Bug clave**: el CSS usa ancestros `ud-fzpBA`/`ud-V5DFL`/`ud-WOlJs`/`ud-87vH0` que NO están en el HTML (el player los añadía) → secciones colapsaban a 260px. **Fix**: agregar TODAS esas clases al wrapper del preview.
- `src/pages/proyectos-preview.astro` — hero PORTAFOLIO con mockup + cards 2x2 (Utransfer, N***, K***, Papers) + TESTIMONIALES (6) + footer. **Bug del slice**: `indexOf('<section', ...)` encontraba el section SIGUIENTE y cortaba el Hero. **Fix**: `lastIndexOf('<section', ...)`. Además fix `scale(0.8)` de entrada.

**Patrón reusable (confirmado en las 4 páginas):**
1. wrapper root: `class="ud-tqfFO ud-72rtr7 ud-pRmuk [OTROS ancestros del CSS]"` + `style="min-height:100vh;width:1440px"`.
2. Los ancestros que el CSS usa (`ud-pRmuk`, `ud-fzpBA`, `ud-V5DFL`, `ud-WOlJs`, etc.) hay que agregarlos TODOS al wrapper o las secciones colapsan. Detectarlos con: `grep -oE "\.ud-[a-zA-Z0-9]+" *.native.html | sort | uniq -c | sort -rn`.
3. `<style is:inline>` y `<script is:inline>` (Astro pierde los inline normales con set:html masivo).
4. `fixLayout` (is:inline): mide contenido real y setea min-height en SECTION/HEADER/`-container` colapsados.
5. Regex visibilidad: `opacity:0→1`, `visibility:hidden→visible`, `transform:perspective...translateY→none`, `scale(0.8)→none`. NO tocar `translateX(-50%)` (centrado).
6. Header del Hero sin cierre en export → separarlo y cerrar con `</header>`.
7. CSS page: `<link home.css>` + `<style>` inline del HTML inyectado en head.
8. Limpiar `data-fid`, `events.framer.com`, scripts player del native.html.

**Pendiente:** Mau valida los 3 previews nuevos + home; luego swap de index.astro a nativo; limpiar páginas temporales (diag, diag-logos, diag-logos2); verificación 0 código Framer + agente crítico >95%.

## Ago 16 (tarde) — Revisión sección por sección (4 rondas) + fixes

**Home** — OK (no enfocarse, Mau dijo casi listo).

**Servicios** — fixes de revisión:
- **Viñetas del hero** ("Diseños responsivos" era una píldora blanca con texto invisible): el texto de la píldora activa (`.ud-v-1iotz8h`, fondo blanco) debe ser oscuro (rgb(10,10,10)); las otras 3 viñetas blanco. El selector genérico `.ud-iBxeJ` lo rompía.
- **Tarjetas Works** (Diseño de Apps/Web/Branding/Research): Branding colapsaba a 0 → `min-height:249px` fijo en las 4.
- **Footer**: las tarjetas absolute flotaban sobre el footer → contenedor del carrusel (`.ud-1s8qqcg`/`.ud-s9y34t`) `min-height:996px` (4×249).
- **Hero**: mide 2297px (carrusel de mockups del player estático). Funcional: título, teléfono, viñetas, marcas. No se replica el carrusel → aceptado.

**Nosotros** — fixes de revisión:
- **Hero**: "Diseñamos" + carrusel de palabras (Websites/Apps) desalineados (ssr-variant display:contents rompe align) → `top:30px` al carrusel.
- **CTA final**: botón "Comenzar proyecto" cortado (131px < texto 149px) → `min-width:220px`.
- Team carrusel: OK (Cristian grande + 6 mini en fila, overflow:hidden). Fotos cargan.

**Proyectos** — fixes de revisión:
- **Cards de proyectos**: quedaban con border azul (link default) porque el CSS del framework no aplica → `border:1px solid rgb(40,40,40)` + text-decoration:none + color blanco.
- **Testimonios**: padding-top 12→120px (el título quedaba bajo el navbar fixed). Marquee anima OK.

**Lección repetida**: los selectores CSS del framework de Framer usan ancestros (`ud-pRmuk`, `ud-fzpBA`, `ud-GISSF`...) que el player añadía en runtime. Sin ellos, borders/colores de cards no aplican → agregar overrides con `!important` en el `<style is:inline>`.

## Ago 16 (noche) — 4 rondas de revisión completadas

**Verificado en 4 rondas (screenshots por sección + DOM):**

**Servicios** (`/servicios-preview`):
- Hero: título + teléfono + viñetas + marcas funcionales. Altura 2297px (carrusel de mockups estático, aceptado).
- Viñetas: 4 legibles (activa blanca con texto oscuro).
- Tarjetas Works: 4 uniformes (249px, gaps 249, sin superposición).
- Footer: limpio.

**Nosotros** (`/nosotros-preview`):
- Hero: título + "Diseñamos Websites" alineados.
- Experiencia: logo + texto.
- Equipo: Cristian grande a color + mini tarjetas grises (carrusel estático).
- Áreas: 4 pestañas + contenido.
- CTA: título + botón sin cortar.
- Footer: limpio.

**Proyectos** (`/proyectos-preview`):
- Hero: título + mockup.
- Cards 2x2: borde gris (62,62,65) + logo + texto.
- Testimonios: Marquee animado (6 testimonios de contacto con fotos).
- Footer: limpio.

**Home** (`/hero-preview`): confirmado OK (1 solo NUESTROS SERVICIOS, 5 secciones, sin cortes).

**Sin errores de consola en ninguna página.**

**Pendiente:** Mau valida visualmente las 4 páginas. Luego: swap de index.astro a nativo, limpiar páginas temporales (diag, diag-logos, diag-logos2), verificación 0 código Framer, agente crítico >95%.

## Ago 16 (noche 2) — Responsive móvil + footer DS + hover team + feedback Mau

**Feedback de Mau:**
1. Footer: SIEMPRE el del design system en todas las páginas (no el framer nativo blanco). Ya revertido.
2. Team nosotros: al hover sobre una card debe expandirse (animación del carrusel original). Implementado con JS.
3. CTA nosotros: había una imagen de dashboard que se animaba con scroll — pendiente de revisar (el fix del botón ya está).
4. Responsive: las páginas se veían mal en celular. Arreglado.

**Fixes responsive (las 4 páginas):**
- Wrapper `width:1440px` fijo → `width:100%;max-width:1440px` (el width fijo rompía el CSS responsive del nativo que usa media queries: root 390px en móvil).
- `body overflow-x:hidden` en las 4 páginas.
- Home: `.hero-content/.hero-text` width:100% + h1 `overflow-wrap:anywhere` (el LetterReveal pone palabras inline-block nowrap que estiraban el contenedor a 620px → título cortado).
- Nosotros: secciones `overflow-x:hidden` en móvil (el hero tenía imagen 460px que desbordaba). `applyBreakpoints`: agrega `ud-v-1rivokt` al carrusel del team en <810px para que el CSS mobile (grid 2x2) aplique.

**Hover team (nosotros):**
- Script `initTeamHover`: al mouseenter sobre una card se expande a flex:3 (grande) y las demás a flex:1, con desplazamiento del track (translateX) para que la activa quede en la posición grande. Igual al carrusel de Framer.

**Pendiente:**
- CTA nosotros: la animación de la imagen dashboard con scroll (Mau la mencionó). El CTA está funcional pero sin la animación parallax/sticky del original.
- Mau validará el responsive en su celular.

## Ago 16 (noche 3) — Responsive móvil verificado en las 4 páginas + CTA nosotros

**Responsive verificado en viewport 390px (celular):**
- Home: título hero arreglado (overflow-wrap:anywhere). Sin scroll horizontal.
- Servicios: sin scroll horizontal. Hero con viñetas (las 4 en fila desbordan en móvil — Mau va a rediseñar la página, pendiente en el rediseño).
- Nosotros: sin scroll horizontal (hero 460px + CTA dashboard). Team en grid 2x2 móvil (applyBreakpoints agrega ud-v-1rivokt). CTA dashboard centrado (transform:none en móvil).
- Proyectos: sin scroll horizontal. Cards en 1 columna. Testimonios Marquee adaptado (tarjetas 320px).

**CTA nosotros dashboard:** el transform 3D de entrada del player (perspective 1700px translateX(651px) translateY(-518px) scale) lo escalaba a 2009px desbordando el CTA. Fix: regex limpia el transform + width:100% de la imagen al contenedor (1088px desktop / 100% móvil).

**Pendiente:**
- Mau valida responsive en su celular.
- Servicios: rediseño de la página (Mau dijo que la va a rediseñar) — las viñetas del hero en móvil desbordan.
- Mau validó: footer SIEMPRE del DS (ya revertido), hover team OK, CTA dashboard posicionado.

## Ago 16 (final) — ELIMINACIÓN COMPLETA DE FRAMER en páginas migradas ✅

Mau: "borremos todo lo que sea framer ya no quiero nada de framer" — pero las internas de proyectos (kaito/novo/utransfer/verificacion-biometrica) AÚN NO migradas → DEJAR.

**Hecho:**
1. Los 4 `*-native.html` quedaron en **0 menciones de framer**:
   - @font-face de framerusercontent.com eliminados (las fuentes vienen de Google Fonts: DM Sans + Familjen Grotesk)
   - Script del player (`script_main.CjZEVzFK.mjs` de framerusercontent) eliminado
   - Script de analytics `events.framer.com/script` eliminado
   - Comentario "Made in Framer", CSS de badge/editor, `data-ud-components` con prefijos framer- eliminados
2. Previews copiados a rutas reales: `hero-preview.astro→index.astro`, `servicios-preview.astro→servicios/index.astro`, etc.
   - **Importante**: al mover a subcarpeta, imports relativos cambian `../components/` → `../../components/`
3. Eliminados: previews, páginas diag (diag/diag-logos/diag-logos2), HTML framer originales (index.html/servicios.html/nosotros.html/proyectos.html), `framer-home.css`, `old-framer.css`, `.shots`, `.playwright-mcp`
4. Titles actualizados (sin "nativo"), `noindex` quitado de las páginas reales
5. Build verificado: 33 páginas sin errores, **0 código framer en dist de las 4 migradas**

**Queda en Framer (intencional):** las 4 internas `/proyectos/:slug` (kaito, novo, utransfer, verificacion-biometrica) — aún no migradas. Sus `src/html/proyectos/*.html` y sus páginas `src/pages/proyectos/{kaito,novo,utransfer,verificacion-biometrica}.astro` intactas.

**Menciones "framer" restantes en src:** solo comentarios de código (explican que los selectores ud- vienen de framer renombrados) y `design-system.astro` (documentación del DS). No son código ejecutable.

## Ago 16 (tarde 2) — SEO audit + fixes + fixes Mau

**Audit realizado (squirrel + Lighthouse + performance trace):**
- squirrel local: 43/100 (F) — mejorable por: HTTPS en localhost (no aplica), internas de proyectos framer, TTFB dev server, meta tags faltantes en páginas migradas
- squirrel producción: 48/100 (F), **Agents (GEO) 91%** — llms.txt + robots AI bots OK
- Lighthouse local: SEO 92, Accessibility 87, Best Practices 96, Agentic Browsing 67
- Performance trace home: LCP 1518ms (good), CLS 0, TTFB 1122ms (dev server; en prod será menor)

**Fixes SEO aplicados a las 4 páginas migradas:**
- Schema.org del HTML original se PERDÍA (estaba en head del native, previews solo extraen body). Fix: `schemas.map()` extrae los scripts ld+json del native y los re-inyecta en head. Home (Organization/WebSite/LocalBusiness), Servicios/Nosotros (LocalBusiness+FAQ), Proyectos (Organization/WebSite/CollectionPage)
- Meta description, canonical, favicon, OG tags (title/description/url/image/type), Twitter card agregados a las 4 páginas
- Titles mejorados (de "Home | UserDesigners" 20ch a "Agencia UX/UI para Fintechs y Bancos en Latinoamérica | UserDesigners" 62ch)

**Fixes Mau:**
- Servicios: fondo blanco gigante (mockup ud-xohiip-container con height:100% del header inflado por fixLayout → 4787px blancos tapando contenido). Fix: height 560px + header 2500px
- Footer nosotros y servicios: verificados OK en local (están al final, bien formados). Producción desactualizada (falta deploy).

**Pendiente:** deploy a producción (los fixes están en main local, producción aún muestra la versión vieja sin footer/meta/schema).

## Ago 16 (tarde 3) — Deploy a producción + audit final + fixes perf/a11y

**Deploy:** Cloudflare Pages con auto-deploy en cada push a main. Verificado: los fixes están LIVE en producción (footer, fondo, schemas, meta tags, imágenes).

**Audit final producción (squirrel, 12 páginas):**
- Core SEO: 57% (0 errores, subió de 42%)
- Agents (GEO/AEO): 93% (llms.txt + robots AI bots + schema en 4 páginas)
- Crawlability 100% | Links 87% | Mobile 84% | Analytics 100%
- Health 49/100 (F) — lastrado por imágenes en cache edge + las 4 internas de proyectos en framer

**Fixes perf/a11y aplicados:**
- 3 imágenes comprimidas: 6dFt (1.2MB→170KB webp), 8gGua (→72KB), pkXs (→124KB)
- 80 referencias de 6dFtNSZS.png → .webp en servicios-native
- nosotros: 23 links de redes con aria-label (Linkedin/Instagram/Facebook/X), 8 focusables con aria-hidden eliminado

**Errores restantes (10):** 3 imágenes (el .png huérfano sigue en cache edge de Cloudflare — expira con TTL; el HTML ya usa webp), 8 aria-hidden (ya arreglados en código, pendiente propagar), 1 label-mismatch en blog (select categorías).

**Performance (Lighthouse local):** SEO 92, Best Practices 96, A11y 87, LCP 1518ms, CLS 0, TTFB 1122ms (dev server; menor en prod).

## Ago 16 (noche 4) — Generador de blogs adaptado a estructura Airpals + capa de verificación

**Modelo de referencia:** Airpals (airpals.co/blog) — posts 2000+ palabras con TOC, tablas comparativas, checklist, key takeaways, FAQ, autor con bio.

**Cambios en la automatización de blogs (n8n → GitHub Actions):**
- `generate-blog-draft.js`: prompt reescrito con estructura Airpals (1800-2400 palabras, 3-4 imágenes, tablas, FAQ, 3-5 links internos + 1 externo autoridad). Modelo configurable `BLOG_MODEL` (default `deepseek/deepseek-v4-pro-0813`, max_tokens 8000). `markdownToNotionBlocks` ahora soporta tablas, blockquote, imágenes. Regla anti-meta-instrucción (el modelo no debe colar frases tipo "un buen post termina con FAQ").
- `validate-blog-seo.mjs`: capa de verificación expandida — palabras ≥1500 (era 250), 4+ H2, anti-genérico (frases como "era digital"), anti-meta-instrucción, warnings de imágenes/links/FAQ/tablas/checklist.
- `generate-blog.yml`: input `model` opcional, env `BLOG_MODEL`.
- `_TEMPLATE.md`: fix del texto meta colado en la sección FAQ.

**Costos de generación (precios reales TokenRouter):**
- deepseek-v4-pro-0813: $0.005/blog (10 = $0.05) ← ELEGIDO
- qwen3.8-max-free: $0 (gratis, puede rate-limit)
- gemini-3.7-flash: $0.015/blog
- claude-sonnet-5: $0.04/blog (máxima calidad)

**Flujo:**
Slack → n8n → generate-blog.yml (deepseek) → borrador Notion (Status=Draft) → revisión humana → Status=Ready → sync-blog.yml (valida SEO crítico + publica)

## Ago 18 — Audit completo (SEO/GEO/AEO + perf + anti-slop + código) + fixes ejecutados

**Audit con 4 subagentes en paralelo** sobre producción (userdesigners.com) + repo local. Hallazgos + fixes en `docs/superpowers/plans/2026-08-18-audit-fixes.md`.

**Hallazgos críticos y ya corregidos:**
- `/blog/_template/` estaba indexado en producción (post real de 1093 palabras bajo slug de template) — el glob loader de `src/content.config.ts` incluía `_TEMPLATE.md`. Fix: pattern `["**/*.md", "!_*.md"]`.
- `/servicios` LCP 24.3s — los 2 webp "comprimidos" en la sesión del 16 ago (72KB/124KB en el repo) seguían serviéndose desde Cloudflare a 1.19MB/1.15MB (10 días de cache edge en la misma URL). Fix: renombrados a `-v2.webp`, fuerza URL nueva.
- Home/nosotros LCP 6.3s/10.6s — el H1 del hero usaba `LetterReveal` (JS + motion.dev), retrasando el paint ~3.4s. Fix: H1 plano sin animación (el resto del hero sigue con `Reveal` normal).
- Google Fonts bloqueaba el render (~1s) en las 11 páginas que cargan `fonts.googleapis.com` — ya había woff2 locales sin usar. Fix: patrón preload+swap (`media="print" onload`) en las 11.
- FAQPage schema de blog era boilerplate genérico basado en el título, invisible en el HTML — Google puede rechazarlo. Fix: parser real que extrae Q&A de la sección "Preguntas frecuentes" del markdown; si no hay, no emite el script. (Bug propio detectado en la implementación: el regex con flag `/m` hacía que `$` matcheara en la primera línea vacía — corregido con split por líneas.)
- 3 posts con la misma estadística "70%" inventada sin fuente (RULE-H) — reemplazada, una de ellas ahora cita el New Relic State of AI Coding Report 2026 (25% de código IA necesita reescritura significativa). Typo "sufrre" corregido.
- 3 fichas de proyecto (kaito/novo/verificacion-biometrica, aún en Framer) repetían el molde "no era X, sino Y" — copy reescrito distinto en cada una. **No se migraron a Astro** — eso sigue en el backlog de migración completa.
- `generate-blog.yml` interpolaba `topic`/`category` directo en `run:` (script injection técnica) — movido a `env:`.
- Query de Notion sin paginar en el check de duplicados de blog — ahora sigue `has_more`/`next_cursor`.
- Lógica de saneo de HTML de Framer triplicada en home/servicios/nosotros — extraída a `src/lib/framer-html.ts`.
- **Bug de Sentry encontrado en vivo durante la sesión** (no estaba en el audit original): `ReferenceError: currentPage is not defined` en `/blog/page/2/` — un `<script>` de módulo en `src/pages/blog/page/[page].astro` referenciaba una variable de frontmatter de Astro, que no existe en el scope del browser (el mismo gotcha ya documentado en este CLAUDE.md). Fix: `data-current-page` en `<main>` + leer con `dataset` en el script.
- Verificado: NO hay imágenes duplicadas entre posts de blog reales (el único "duplicado" era `_TEMPLATE.md`, ya excluido de la colección).

**Fuera de alcance (decisión explícita, confirmada con Mau):**
- Footer "© 2025 Cyberg" + copy de QA pegado en Utransfer + 24 tarjetas "Servicio" placeholder + H1 duplicado en /nosotros y /proyectos — viven en las 4 fichas de proyecto sin migrar o son de bajo riesgo; se resuelven con la migración completa a Astro.
- `!important`/hex hardcodeado en servicios/nosotros (páginas ya migradas) — deuda real pero requiere reescritura con Grid/Flexbox + tokens, no un find-replace. Ticket separado.
- Expandir los posts publicados por debajo de 1500 palabras (245-650 palabras reales) — el generador y `validate-blog-seo.mjs` ya gatean esto para posts NUEVOS desde el 16 ago; los viejos necesitan una reescritura de contenido real, no un script.
- Nombrar competidores reales (Multiplica, IDA, Frog) en un ranking auto-servido — decisión editorial/reputacional para Mau/Ari, no un bug técnico.

**Todo commiteado en `main`** (10 commits atómicos), build verificado limpio (34 páginas) después de cada bloque de cambios.
