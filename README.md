<div align="center">

# UserDesigners Web

**Agencia de UX/UI orientada a Fintechs — Sitio oficial**

[![Astro](https://img.shields.io/badge/Astro-7.0-FF5D01?logo=astro&logoColor=white)](https://astro.build)
[![Cloudflare Pages](https://img.shields.io/badge/Deploy-Cloudflare_Pages-F38020?logo=cloudflare&logoColor=white)](https://pages.cloudflare.com)
[![TypeScript](https://img.shields.io/badge/TypeScript-strict-3178C6?logo=typescript&logoColor=white)](https://www.typescriptlang.org)
[![Anti-slop CI](https://img.shields.io/badge/CI-anti--slop_checked-22c55e)](https://github.com/mattewrobles/userdesigners-web)

**Live:** [userdesigners.com](https://www.userdesigners.com) · **Español (ES-EC)**

</div>

---

## Sobre el proyecto

Sitio web de [UserDesigners](https://www.userdesigners.com), agencia de diseño UX/UI especializada en **fintechs, bancos y neobancos de Latinoamérica**. Migrado de **Framer a Astro** para ganar rendimiento, SEO y un design system propio.

### Lo que incluye

- **Blog de contenido** con design system propio, paginación, categorías y SEO técnico (canonical, Open Graph, JSON-LD).
- **Design system completo** (`src/components/ui/`) — 17 componentes con tokens reales: Button, Card, Badge, Text, Icon, Input, Divider, Blob, BlobField, Container, SectionLabel, Skeleton, Marquee, Reveal, LetterReveal, Logo.
- **Páginas de marketing** (home, servicios, nosotros, contacto, proyectos) migradas de Framer manteniendo el look original.
- **Página de documentación del DS** (`/design-system`).
- **Blobs orgánicos animados** (`BlobField`) — figuras tipo lava que morphan y se mezclan, con colores análogos aleatorios por carga.

---

## Stack

| Capa | Tecnología |
|------|-----------|
| Framework | [Astro](https://astro.build) (static output) |
| Estilos | CSS con tokens (`src/styles/tokens.css`) |
| Animación | [Motion.dev](https://motion.dev) |
| Blog | Content Collections (Markdown) |
| Deploy | [Cloudflare Pages](https://pages.cloudflare.com) (auto-deploy desde `main`) |
| CI | Anti-slop check ([impeccable](https://impeccable.style)) en push/PR |

---

## Comandos

```bash
npm install          # instalar dependencias
npm run dev          # dev server → localhost:4321
npm run build        # build a dist/
npm run preview      # preview del build local
npm run slop         # detectar UI anti-patterns (AI slop)
```

---

## Estructura

```
src/
├── components/
│   ├── ui/              # Design system (17 componentes)
│   └── *.astro          # Navbar, Footer, BlogList, secciones
├── content/blog/        # Blog posts (Markdown, 9 publicados)
├── html/                # HTMLs heredados de Framer (marketing)
├── layouts/             # Layouts de página
├── lib/                 # Utilidades (icons, etc.)
├── pages/               # Rutas Astro
│   ├── blog/            # Blog + paginación + posts
│   ├── proyectos/       # Casos de estudio
│   └── *.astro          # home, servicios, contacto, nosotros, seo-doctores, design-system, mantenimiento
└── styles/              # tokens.css, base.css, utilities.css
```

---

## Design System

El DS vive en `src/components/ui/` con tokens en `src/styles/tokens.css`.

**Reglas del DS:**
- Tipografía: `--font-display` (Familjen Grotesk) + `--font-body` (DM Sans). **Nunca** Inter como fuente principal.
- Colores, spacing, radius y tipografía **siempre** desde tokens. Nunca hex/rgba hardcodeados.
- Animación con motion.dev.
- Verificado contra AI slop: `npm run slop` debe dar **0 anti-patterns** antes de decir "listo".

---

## Anti-slop (calidad de UI)

El proyecto usa [impeccable](https://impeccable.style) como detector de anti-patterns de IA (gradientes genéricos, fuentes overused, bounce easing, padding apretado, etc.).

```bash
npm run slop
```

El CI corre el check en cada push a `main` y cada PR. Los HTMLs export de Framer y la página de documentación del DS están en `.impeccable/config.json` (son heredados/demo, no UI de producción).

---

## Deploy

El deploy es automático: cada push a `main` dispara Cloudflare Pages → build de Astro → publicación.

- **Producción:** [userdesigners.com](https://www.userdesigners.com)
- **Branches:** `main` (producción), `refactor/test-fase1` (refactor en progreso)

---

## Blog & Notion

El blog se sincroniza desde una base de datos de Notion (pipeline n8n → GitHub Actions). Los posts en `src/content/blog/` se publican como Markdown.

---

## Licencia

© UserDesigners. Todos los derechos reservados.
