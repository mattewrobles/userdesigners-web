## Development

When starting the dev server, use background mode:

```
astro dev --background
```

Manage the background server with `astro dev stop`, `astro dev status`, and `astro dev logs`.

## Reglas de trabajo (aprendidas)

### Verificación obligatoria
- **NUNCA decir "listo" sin verificar**: corre el build + un screenshot o curl de la página. Si es visual, toma screenshot y confirma que el contenido/color/animación se renderiza.
- Si no puedes verificar visualmente, avisa a Mau que lo revise en el browser antes de dar por terminado.

### Iteración inteligente
- **Después de 2 fixes fallidos por lo mismo → resetear** (`/clear` o cambiar de enfoque). El contexto se contamina con enfoques fallidos.
- Para componentes de diseño: verifica visualmente ANTES de commitear, no después de 5 commits puliendo a ciegas.

### Anti-slop (diseño premium, no genérico)
- **NO usar Inter, Roboto, Space Grotesk, Geist como fuente principal.** Usar las fuentes del DS: `--font-display` (Familjen Grotesk) y `--font-body` (DM Sans).
- **NO gradientes azul→púrpura, NO glow shadows de color** (dark-glow), NO hero centrado con badge + headline gigante, NO icon-cards idénticas.
- **SIEMPRE usar tokens del DS** (`src/styles/tokens.css`): colores, spacing, radius, tipografía. Nunca hex/rgba hardcodeados.
- Verificar con el detector: `npm run slop` (impeccable detect src --ci). Buscar 0 anti-patterns en código nuevo.

### Actualizar README en cada merge a main (OBLIGATORIO)
- **SIEMPRE que se haga un merge a `main`**, actualizar el README.md (sección "Estado de la migración Framer → Astro") marcando/desmarcando los checkboxes según lo que cambió.
- Mantener el progreso al día: páginas migradas a Astro, etapas completadas, componentes nuevos.
- Esto sirve de memoria del proyecto: cualquiera (o un agente nuevo) lee el README y sabe exactamente en qué punto está la migración.
- Si el merge no cambió nada de la migración (ej: solo README o config), igual verificar que el estado siga siendo correcto.

### Design system
- El DS vive en `src/styles/tokens.css` + `src/components/ui/`.
- Componentes UI listos: Button, Card, Badge, Text, Icon, Input, Divider, Skeleton, SkeletonMatch, Container, SectionLabel, Blob, Marquee, LetterReveal, Reveal, Logo.
- Animación con motion.dev (importado de "motion"), no CSS keyframes manuales cuando hay un componente disponible.
- En componentes .astro, las variables del frontmatter NO se inyectan en `<script>` de módulo → usar `data-*` attributes + `querySelectorAll`.

### Logo
- El logo es el PNG: `/assets/local/THPlYhmIylZZQK7C2oB2vUpYec.png`. No reconstruirlo como SVG (el gradiente de la U es complejo). Usar `<Logo />` si se necesita.

## Documentation

Full documentation: https://docs.astro.build

Consult these guides before working on related tasks:

- [Adding pages, dynamic routes, or middleware](https://docs.astro.build/en/guides/routing/)
- [Working with Astro components](https://docs.astro.build/en/basics/astro-components/)
- [Using React, Vue, Svelte, or other framework components](https://docs.astro.build/en/guides/framework-components/)
- [Adding or managing content](https://docs.astro.build/en/guides/content-collections/)
- [Adding styles or using Tailwind](https://docs.astro.build/en/guides/styling/)
- [Supporting multiple languages](https://docs.astro.build/en/guides/internationalization/)

### DESIGN.md (OBLIGATORIO antes de diseñar UI)
- **LEER `DESIGN.md` del proyecto antes de crear/modificar cualquier UI.** Contiene identidad, colores, tipografía, componentes y anti-slop del DS.
- Tokens reales en `src/styles/tokens.css`. Nunca hardcodear colores/fuentes.
- Después de diseñar: correr `npm run slop` (impeccable detect src --ci) + screenshot + critique antes de 'listo'.
