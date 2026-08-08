# UserDesigners Web

Sitio web de [UserDesigners](https://www.userdesigners.com) — Agencia de UX/UI especializada en Fintechs.

## Stack

- **Framework:** Astro 7 (static output)
- **Despliegue:** Cloudflare Pages (auto-deploy via GitHub Actions)
- **Blog:** Content collections (Markdown)

## Estado del proyecto

El sitio fue migrado de Framer a Astro. Migración en progreso:
- **Páginas nativas Astro:** `/blog`, `/blog/:slug`, `/seo-doctores`
- **Páginas Framer (HTML estático):** `/`, `/servicios`, `/nosotros`, `/contacto`, `/proyectos`, `/proyectos/:slug`
- **Plan de refactor:** `REFACTOR-PLAN.md`

## Comandos

```bash
npm run dev          # localhost:4321
npm run build        # build a dist/
npm run preview      # preview build local
```

## Estructura

```
src/
├── components/      # Navbar, Footer, secciones
├── content/blog/    # Blog posts en markdown
├── layouts/         # BaseLayout, BlogPost
├── pages/           # Páginas Astro + proxies Framer
├── styles/          # CSS global + CSS heredado de Framer
└── assets/          # Assets locales (SVG, etc.)
```

## Branches

- `main` — producción
- `refactor/test-fase1` — refactor en progreso (Fase 1)