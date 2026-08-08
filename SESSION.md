# UserDesigners Web — Astro Migration

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
