# UserDesigners Web — Astro Migration

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

## Pendientes (optimización)
- Optimizar imágenes (WebP/AVIF, lazy loading, srcset)
- Schema.org ya incluido en todos los HTMLs
- Mixpanel ya inyectado
- Geo/AEO tags por página
- Comprimir assets
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
