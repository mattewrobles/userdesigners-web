# Refactor UserDesigners Web — Plan por Fases (v2)

> **Branch de trabajo:** `refactor/test-fase1` → merge a `main` (producción)
> **Proyecto:** `~/Developer/work/userdesigners/userdesigners-web-migration`
> **Objetivo:** Migrar TODO a Astro nativo replicando el diseño original de Framer al pixel. Las versiones Framer originales SE QUEDAN en `src/html/` como respaldo (nunca se borran hasta fase final).

---

## Principios (reglas de trabajo)

1. **Fidelidad total, no rediseño.** Cada página Astro = misma animación, spacing, border, imagen, color, botón que la original. El DS ya contiene los tokens extraídos de Framer (`tokens.css`). Verificar con screenshot + modelo vision.
2. **Sección por sección.** Cada sección es un ciclo: analizar HTML/CSS Framer → construir en Astro con DS → build → screenshot → vision → arreglar → re-verificar (hasta 10x). Nada de "hacer la página de un tirón".
3. **DS obligatorio.** `public/styles/tokens.css` + componentes `src/components/ui/` (Button, BlobField, Container, Reveal...). Nunca hex suelto en CSS nuevo. Si falta un token → agregarlo al DS con justificación.
4. **Animación:** motion.dev (ya instalado) para reveals/micro-interacciones, GSAP para scroll choreography. Respetar `prefers-reduced-motion`.
5. **Anti-slop:** correr `npm run slop` y dejar CI verde antes de mergear.
6. **Seguridad:** fixes en partes, nunca en el mismo cambio que una migración.
7. **Verificación:** NUNCA decir "listo" sin build + screenshot + vision. Si no puedo verificar → avisar a Mau.

---

## Fase 0 — Seguridad + higiene (en partes, riesgos bajos)

### 0a. Headers de seguridad
- [ ] Agregar `Strict-Transport-Security` (HSTS) en `public/_headers`
- [ ] Agregar `Content-Security-Policy` básica (default-src 'self', allow framerusercontent mientras exista, GA4, fonts) — diseñada para NO romper las páginas Framer actuales
- [ ] Verificar en producción que los headers apliquen (incluyendo páginas servidas con `return new Response()`)

### 0b. Fixes de errores del audit
- [ ] Link interno roto: `/proyectos/verificaci-n-biom-trica` → apuntar al slug correcto `/proyectos/verificacion-biometrica`
- [ ] Home mobile: H1 desbordado ("Fintec...") → fix CSS
- [ ] CI anti-slop rojo: tokenizar colores/radios fuera del DS o actualizar DESIGN.md → dejar `npm run slop` en 0

### 0c. Cache edge
- [ ] Evaluar `Cache-Control: public, s-maxage` para HTML en `_headers` (hoy `max-age=0, must-revalidate` → cf-cache-status DYNAMIC)

---

## Fase 1 — HOME → Astro nativo (sección por sección)

El home tiene 13 secciones (mapeadas del HTML Framer):

| # | Sección Framer | Sección Astro |
|---|----------------|---------------|
| 1 | Navbar (`1j7ffam`) | `Navbar.astro` (ya existe — alinear al pixel con el Framer) |
| 2 | Content/Top (H1 + sub + CTA) | `HeroTop.astro` |
| 3 | SocialProof (logos clientes) | `SocialProof.astro` |
| 4 | Gradient Blur (blob) | `BlobField variant="home"` |
| 5 | Line (animación de línea) | `HeroLine.astro` |
| 6 | Title (título grande) | parte de HeroTop |
| 7 | Tabs container (cards servicios) | `ServiceTabs.astro` |
| 8 | Benefits (line-scroll features) | `Benefits.astro` |
| 9 | Proyectos header | `ProjectsSection.astro` |
| 10 | Team | `TeamSection.astro` |
| 11 | Content (Top Container) | sección testimonios/stats |
| 12 | Featured Articles (blog) | `FeaturedArticles.astro` (usa BlogList/content) |
| 13 | CTA final + Footer | `CTASection.astro` + `Footer.astro` |

**Orden:** Hero (secciones 1-6) → verificar 10x → Services tabs → Benefits → Proyectos → Team → Blog → CTA. Cada sección termina con build + screenshot + vision.

**Nota de fidelidad:** el original usa texto en letras separadas con blur(10px) inicial (animación letter-by-letter). Replicar con `LetterReveal`/motion.dev. El fondo negro puro + glow conic-gradients reales → tokens `--glow-*` (ya están en tokens.css).

---

## Fase 2 — NOSOTROS → Astro nativo

Misma lógica sección por sección. `src/html/nosotros.html` (458KB) como fuente de verdad.

---

## Fase 3 — SERVICIOS → Astro nativo

Misma lógica. `src/html/servicios.html` (567KB). 109 imágenes con alt — conservar las reales, organizarlas.

---

## Fase 4 — PROYECTOS → landing + template interno + automatización

### 4a. Landing `/proyectos/`
Replicar tal cual (tarjeta de casos).

### 4b. Template interno (casos de estudio)
Analizar los 4 casos actuales (`src/html/proyectos/{kaito,novo,utransfer,verificacion-biometrica}.html`). Extraer el PATRÓN común:
- estructura de secciones (hero, contexto, rol, entregables, screenshots, resultados)
- tipo de contenido (texto, imágenes, stats, quotes)
→ Crear `src/layouts/CasoEstudio.astro` + Content Collection `src/content/proyectos/` con frontmatter tipado (slug, cliente, categoría, año, descripción, imágenes, stats).

### 4c. Automatización
- Misma mecánica que el blog: Content Collections + `getStaticPaths` (ya funciona así con `src/pages/proyectos/[...slug].astro`).
- Evaluar pipeline Notion (como blogs) para publicar casos nuevos sin tocar código.

---

## Fase 5 — Eliminar dependencia Framer

Cuando todas las páginas sean nativas:
- [ ] Quitar el player remoto `script_main.*.mjs` y los 17 scripts .mjs por página (ahorro ~463KB JS)
- [ ] Reemplazar imágenes `framerusercontent.com` por locales organizadas (`/assets/local` → `/images`)
- [ ] Eliminar CSS inline Framer sobrante
- [ ] Mover fuentes a locales y eliminar refs remotas (105 por página)

---

## Fase 6 — SEO + Performance final

- [ ] Lazy loading + width/height en todas las imágenes (hoy 1 `loading="lazy"` en el home)
- [ ] Preload hero image (LCP)
- [ ] Edge cache HTML (`s-maxage`)
- [ ] Internal linking blog ↔ páginas
- [ ] Breadcrumb schema
- [ ] Sitemap final + verificación

---

## Seguridad pendiente (post-migración)

- [ ] Cuando no quede JS de framerusercontent → endurecer CSP a `script-src 'self'`
- [ ] Revisar `access-control-allow-origin: *` (lo inyecta Cloudflare)
- [ ] Rotar/limpiar `.secrets` local (GITHUB_PAT, N8N_API_KEY, tokens Notion/tokenrouter)

---

## Estado

- [x] Fase 0a-0b: análisis completo del audit (SESSION.md)
- [ ] Fase 0: fixes seguridad + CI verde
- [ ] Fase 1: Home nativo (en curso — hero primero)
- [ ] Fase 2: Nosotros
- [ ] Fase 3: Servicios
- [ ] Fase 4: Proyectos landing + template + automatización
- [ ] Fase 5: limpieza Framer
- [ ] Fase 6: SEO/perf final
