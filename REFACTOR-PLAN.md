# Refactor UserDesigners Web — Plan por Etapas

> **Branch:** `refactor/test-fase1`  
> **Proyecto:** `~/Developer/work/userdesigners-web-migration`  
> **Status actual:** Híbrido Framer HTML + Astro nativo

---

## Diagnóstico corto

El sitio tiene **dos mundos conviviendo**:

| Mundo | Páginas | Cómo se sirven |
|-------|---------|----------------|
| **Framer HTML** | Home, Servicios, Nosotros, Contacto, Proyectos, Proyectos indiv. | HTML exportado crudo via `return new Response()` |
| **Astro nativo** | Blog, /blog/:slug, SEO Doctores | Componentes Astro con layouts |

**Problemas raíz:**
- CSS de Framer (200+ líneas solo de @font-face) + 463KB de JS de Framer que no se usa
- Navbar y Footer duplicados: en cada HTML de Framer (embebido) + Navbar.astro / Footer.astro para páginas Astro
- 200+ assets locales sin organizar
- 6 páginas Framer no se pueden editar sin re-exportar

---

## Etapa 1 — Quick wins ✅ (YA en branch)

- [x] Corregir slug del blog (`dise-o` → `diseno`) 
- [x] Eliminar `Welcome.astro` (boilerplate muerto)
- [x] Crear `public/_headers` (X-Frame-Options, CSP, CORS)
- [x] `trailingSlash: "always"` en `astro.config.mjs`
- [ ] Commitar y pushear branch

**Riesgo:** Cero. Cosas que no afectan nada si algo sale mal.

---

## Etapa 2 — Limpieza de CSS y assets

### Qué hacer

1. **Unificar framer.css y framer-global.css**
   - Ambos tienen las mismas @font-face declarations (DM Sans, Inter, Outfit, Geist Mono, etc.)
   - Dejar solo UNO con las fuentes que REALMENTE se usan
   - Las fuentes que están en `assets/local/*.woff2` vs `framerusercontent.com` — decidir local (más rápido)

2. **Auditar qué fonts se usan realmente**
   - El CSS declara 10+ familias: DM Sans, Outfit, Geist Mono, Inter (regular+italic 300/400/500/600/700/900), Inter Display, Familjen Grotesk, Manrope, Poppins, General Sans, Clash Grotesk, Satoshi
   - Probablemente solo se usan 3-4: Inter, Familjen Grotesk, DM Sans, Poppins
   - Eliminar las no usadas → ahorro de ~200KB en fonts

3. **Mover assets organizados**
   - `public/assets/local/` tiene 200+ archivos mezclados (fonts, JS, imágenes)
   - Separar:
     - `public/fonts/` — solo woff2
     - `public/images/` — PNGs, JPGs, WebP
     - `public/js/` — solo JS necesario (si algo se usa realmente)

### Archivos a modificar
- `src/styles/framer.css`
- `src/styles/framer-global.css`
- `src/layouts/BlogPost.astro` (referencia a CSS)
- `src/pages/blog/index.astro` (referencia a CSS)
- `src/pages/seo-doctores/index.astro` (referencia a CSS)

### Riesgo
- **Bajo.** Si una fuente falta, el browser usa fallback. No se rompe nada.

---

## Etapa 3 — Componentizar Navbar y Footer

### Qué hacer

1. **Analizar el navbar actual de Framer**
   - `public/navbar.html` tiene 1.3KB de HTML Framer con clases ofuscadas
   - Extraer la estructura real (logo, 6 links, CTA WhatsApp)
   - Reconstruir como HTML semántico limpio en `Navbar.astro`

2. **Analizar el footer actual de Framer**
   - `public/footer.html` tiene 21KB (mucho gradient/blur de Framer)
   - Extraer contenido real (logo, copyright, redes sociales)
   - Reconstruir con CSS limpio en `Footer.astro`

3. **Problema a resolver:**
   Hoy hay 2 navbars diferentes:
   - En páginas Framer: navbar embebido en el HTML exportado
   - En páginas Astro: `Navbar.astro` y `Footer.astro` injectados
   
   Solución temporal: que ambas versiones se vean IGUAL. Revisar que `Navbar.astro` nuevo se vea idéntico al de Framer. No reemplazar el embebido hasta etapa 4.

### Archivos a modificar
- `public/navbar.html` (referencia)
- `public/footer.html` (referencia)
- `src/components/Navbar.astro`
- `src/components/Footer.astro`
- `src/styles/navbar.css` (nuevo)

### Riesgo
- **Medio.** El navbar es crítico. Si se ve diferente en blog vs home, es mala experiencia.

---

## Etapa 4 — Reconstruir páginas Framer como Astro nativas

### Qué hacer

Una por una, convertir las 6 páginas Framer de HTML crudo a componentes Astro:

1. **Home** (`/`) — la más compleja (673KB)
2. **Servicios** (`/servicios`) — 555KB
3. **Nosotros** (`/nosotros`) — 448KB
4. **Contacto** (`/contacto`) — 384KB
5. **Proyectos** (`/proyectos`) — 366KB
6. **Proyectos individuales** (kaito, novo, utransfer, verificación) — ~265KB c/u

**Estrategia:**
- Extraer el contenido REAL de cada HTML (textos, imágenes, estructura)
- Reconstruir como componentes Astro con CSS limpio
- Preservar animaciones/efectos visuales clave
- Usar `BaseLayout.astro` como layout común (actualmente muerto)
- Reemplazar `return new Response()` con renderizado Astro real

**Para animaciones de Framer:**
- Framer usa motion.js para animaciones de entrada (appear)
- Se puede replicar con CSS animations + Intersection Observer
- El 463KB de `framer.D73RSanu.mjs` se puede eliminar al final

### Archivos a crear
- `src/components/sections/HeroSection.astro`
- `src/components/sections/ServiciosSection.astro`
- `src/components/sections/ProyectosSection.astro`
- etc.

### Riesgo
- **Alto.** Cambia TODO el sitio visualmente. Hacer de a una página, desplegar, validar.

---

## Etapa 5 — Eliminar dependencia Framer

### Qué hacer cuando todas las páginas son Astro nativas

1. Eliminar JS bundles de Framer (`public/assets/local/*.mjs`) — ahorro de ~600KB
2. Eliminar CSS de Framer inline en cada página
3. Unificar todo en `BaseLayout.astro` como layout único
4. Eliminar archivos body-*.html y componentes/content/ (sobrantes de migración)
5. Eliminar la carpeta `public/components/` entera (7 archivos HTML de ~1.3MB)

### Riesgo
- **Bajo** (si etapa 4 está completa). Solo cleanup.

---

## Etapa 6 — SEO + Performance final

### Qué hacer

1. **Blog SEO:**
   - Internal linking: conectar blog posts entre sí y con páginas de servicio
   - Breadcrumb schema en blog posts
   - Topic clusters: los posts actuales son "Product Design" — necesitan más clusters
   - Optimizar hero images (WebP con srcset)

2. **Performance:**
   - Lazy loading en imágenes below the fold (home tiene 54 imágenes)
   - Preload de hero image (LCP)
   - CSS crítico inline para el home
   - Eliminar Google Analytics y Clarity de páginas Framer (ya están en las Astro)

3. **Páginas Framer:**
   - Actualmente 404.html no existe en Astro nativo — está en `public/404.html`
   - Verificar que Cloudflare lo sirva correctamente

---

## Resumen de fases

| Fase | Qué | Riesgo | Tiempo estimado |
|------|-----|--------|-----------------|
| 1 | Quick wins (slug, _headers, trailingSlash, Welcome) | 🟢 Cero | 30 min |
| 2 | Limpieza CSS y fonts | 🟢 Bajo | 2-3 hrs |
| 3 | Componentizar Navbar y Footer | 🟡 Medio | 3-4 hrs |
| 4 | Reconstruir páginas Framer → Astro | 🔴 Alto | 2-3 semanas |
| 5 | Eliminar dependencia Framer | 🟢 Bajo | 1 día |
| 6 | SEO + Performance final | 🟢 Bajo | 2-3 días |

---

## Stack final (cuando termine)

```
userdesigners.com
├── src/
│   ├── components/
│   │   ├── Navbar.astro       ← limpio, semántico
│   │   ├── Footer.astro       ← limpio, semántico
│   │   └── sections/           ← secciones reutilizables
│   ├── layouts/
│   │   ├── BaseLayout.astro   ← layout ÚNICO para todo
│   │   └── BlogPost.astro     ← layout de blog post
│   ├── pages/                  ← TODAS nativas Astro
│   ├── content/blog/           ← posts en markdown
│   └── styles/
│       └── global.css          ← CSS unificado (sin Framer)
├── public/
│   ├── fonts/                  ← solo woff2 que se usan
│   ├── images/                 ← organizado
│   ├── _headers                ← seguridad
│   ├── robots.txt
│   └── _redirects
└── astro.config.mjs
```

Sin Framer. Sin JS bundles de 463KB. Sin @font-face duplicados. Sin dead code.