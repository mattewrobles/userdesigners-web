# Baseline SEO / GEO / AEO — UserDesigners

**Fecha:** 12 ago 2026 · **URL:** https://www.userdesigners.com
**Nota crítica:** Producción sirve HTML de **Framer** ("Made in Framer", publicado 22 jul 2026). La migración a Astro es **incremental**: las páginas principales siguen en Framer, se migran de a poco (repo `userdesigners-web-migration`, rama `refactor/test-fase1`). Este baseline mide el sitio Framer actual = lo que Google/AI ven hoy. NO cuenta como falla "no desplegar"; es el plan de migración por partes.

---

## 1. Health general (squirrelscan, 25 páginas)

| Métrica | Valor |
|---|---|
| **Score global** | **47/100 (F)** |
| SEO | 50 |
| Performance | 40 |
| Security | 43 |
| Agents (AI readiness) | 49 |
| Structured Data | 96 |
| Crawlability | 94 |
| E-E-A-T | 89 |
| Accessibility | 49 |
| Images | 45 |
| Core SEO | 49 |
| Content | 49 |
| Links | 84 |
| Mobile | 84 |
| Analítica | 100 |
| i18n | 100 |
| Resultados | 2515 pass · 626 warn · **24 fail** |

## 2. Indexación (12 ago 2026)

| Motor | Estado |
|---|---|
| **Google (Startpage proxy)** | Indexado. Home posiciona por marca. |
| **Bing** | ~70 resultados para `site:userdesigners.com` (mezcla Framer + páginas viejas) |
| **DuckDuckGo** | Indexa sitio Framer viejo (main-demo, faqs, portfolio, services) |
| **Bing `site:www.userdesigners.com`** | 0 URLs detectadas |
| **ddg `site:www.userdesigners.com`** | 0 URLs detectadas |

**⚠ Problema:** páginas del template Framer demo (`/main-demo`, `/faqs/`, `/home-3/`, `/portfolio/`) siguen indexadas y compiten. El nuevo dominio www casi no aparece.

## 3. Posiciones en Google (Startpage proxy de Google, 12 ago 2026)

| Keyword | Posición |
|---|---|
| userdesigners (marca) | **#1-2** (home + /contacto) |
| agencia ux ui cuenca ecuador | **#2** (con página /contacto, no home) |
| agencia ux ui latinoamerica | **#16** (post blog "mejores-agencias-ux-latam") |
| agencia ux ui ecuador | No aparece (top: novumec.com, proton vpn ads) |
| diseño de productos digitales ecuador | No aparece |
| ux ui fintech ecuador | No aparece (top: LinkedIn jobs) |
| agencia de diseño cuenca | No aparece (top: Instagram inhausestudio) |
| best ux agency latin america | No aparece (top: Clutch) |

**Conclusión:** solo posiciona por marca + 2 keywords transaccionales con páginas secundarias. Keyword core (agencia ux ui ecuador/latam) fuera del top 10.

## 4. GEO/AEO (visibilidad en motores AI)

| Check | Estado |
|---|---|
| robots.txt permite GPTBot, ClaudeBot, PerplexityBot, Google-Extended, Bytespider, Applebot-Extended, Amazonbot | ✅ |
| Sitemap (`sitemap-index.xml`) con 32 URLs | ✅ |
| Todos los bots AI reciben HTTP 200 | ✅ (verificado) |
| `llms.txt` | ❌ **404** — no existe |
| Schema Organization (home) | ✅ completo (dirección, logo, red social) |
| Schema BlogPosting (posts) | ✅ con headline/description/image/fechas |
| **Schema con autor (Person)** | ❌ **sin autor** → E-E-A-T de blog incompleto |
| Verificación de dominio OpenAI + Anthropic (TXT) | ✅ (ambas presentes) |
| Perplexity (test real) | No cita a userdesigners (requiere login, resultado parcial) |
| SEO IndexNow / AI | Depende del deploy |

**Fallas GEO relevantes del audit:**
- No hay `/llms.txt` (clave para descubrimiento por agentes AI)
- Blog sin autor visible (schema ni UI) → menos E-E-A-T ante LLMs
- Post GEO en posición 16 (mejores-agencias-ux-latam) — único contenido que cita

## 5. Fallas técnicas principales (squirrelscan, top)

- **Accessibility (15 errors):** inputs sin label en /contacto, elementos aria-hidden con foco, links sin texto accesible (instagram/x/linkedin), sin `<main>` landmark, sin skip-link
- **Performance (3 errors):** scripts bloqueantes, imágenes sin optimizar (Image CDN ausente)
- **Meta titles:** 13 páginas con title muy largo (>70 chars) o muy corto
- **Broken links externos:** 5 en /nosotros
- **Páginas noindex en sitemap:** /design-system, /mantenimiento
- **2 páginas sin OG/Twitter cards:** /design-system, /mantenimiento
- **Content:** texto oculto en /contacto y /proyectos

## 6. Qué medir en un mes (comparativa)

1. Score squirrelscan (47 → objetivo 70+)
2. Posiciones Google para: "agencia ux ui cuenca ecuador", "agencia ux ui ecuador", "agencia ux ui latinoamerica", "userdesigners"
3. Nº de URLs indexadas en Bing/DDG para `site:www.userdesigners.com` (hoy 0)
4. Indexación del template Framer viejo (main-demo, faqs, portfolio) — deben desaparecer o 301
5. `/llms.txt` presente y sirviendo
6. Presencia en Perplexity/ChatGPT/Claude: que citen userdesigners.com
7. Schema de autor en blog posts

## 7. Prioridades sugeridas (orden de impacto)

1. **Continuar migración incremental a Astro** (páginas principales aún en Framer; al migrar cada página verificar su SEO on-page y re-indexación)
2. **Bloquear/301 las páginas del template Framer** (main-demo, faqs, home-3, portfolio) para limpiar indexación
3. Crear `/llms.txt`
4. Agregar autor (Person schema) + byline a posts de blog
5. Arreglar a11y de /contacto (labels) — 15 errors
6. Meta titles > 70 chars en blog
7. Imágenes con CDN/optimización
