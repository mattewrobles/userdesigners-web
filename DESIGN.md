---
version: "userdesigners-ds-2026-08"
name: "UserDesigners — Dark Fintech Editorial"
description: "Design system de la agencia: dark fintech editorial, blobs orgánicos como firma visual, tipografía display con personalidad. NO es template SaaS genérico."
colors:
  primary: "#0099FF"
  secondary: "#7AD7F4"
  accent: "#E35D52"
  background: "#030303"
  surface: "rgb(10,10,10)"
  surface-hover: "rgb(13,13,14)"
  text-primary: "#FFFFFF"
  text-secondary: "#A1A1A8"
  border: "rgba(255,255,255,0.06)"
  brand: ["#7AD7F4", "#8F82DC", "#DEC063", "#E35D52"]
typography:
  display:
    fontFamily: "Familjen Grotesk"
    weight: 500
    letterSpacing: "-0.03em"
  body:
    fontFamily: "DM Sans"
    weight: 400
  ui:
    fontFamily: "Manrope"
  mono:
    fontFamily: "Geist Mono"
  subhead:
    fontFamily: "General Sans"
  accent:
    fontFamily: "Clash Grotesk"
  display-scale:
    display-1: "clamp(42px, 6.5vw, 74px)"
    display-2: "clamp(36px, 5vw, 49px)"
    heading-1: "clamp(30px, 4vw, 42px)"
    heading-2: "clamp(26px, 3.5vw, 40px)"
    heading-3: "clamp(22px, 3vw, 32px)"
spacing:
  base: "4px"
  gap: "16px"
  card-padding: "24px"
  section-padding: "72px"
  container-max: "1120px"
rounded:
  sm: "8px"
  md: "14px"
  card: "20px"
  button: "12px"
  pill: "999px"
motion:
  ease: "cubic-bezier(0.22, 1, 0.36, 1)"
  duration-fast: "0.2s"
  duration-base: "0.3s"
  duration-slow: "0.5s"
guardrails:
  - "NUNCA Inter/Geist como única fuente"
  - "NUNCA gradientes azul->púrpura en hero"
  - "NUNCA backdrop-blur genérico en navbar"
  - "NUNCA stats fake, terminal con 3 dots, badge pulse"
  - "NUNCA grid uniforme de 3, py-20 en todo, bento genérico"
  - "NUNCA neo-brutalism ni mesh gradients"
---

# UserDesigners — Design System (DESIGN.md)

> Documento de referencia visual. **Cualquier UI nueva DEBE respetar esto.**
> Tokens reales en `public/styles/tokens.css`. Un agente nuevo lee este archivo antes de diseñar.

## Identidad

Agencia de UX/UI para **fintechs, bancos y neobancos de Latinoamérica**. El tono: **preciso, frío, profesional pero con carácter**. Dark mode siempre.

**Estética:** "dark fintech editorial" — fondo negro profundo `#030303`, tipografía display con personalidad, asimetría intencional, blobs orgánicos como acento, datos densos.

## Colores (de `tokens.css`)

| Token | Valor | Uso |
|-------|-------|-----|
| `--ud-black` | `#030303` | Fondo principal (siempre) |
| `--ud-white` | `#ffffff` | Texto primario |
| `--ud-gray-400/500` | grises | Texto secundario/terciario |
| `--ud-blue` | `#0099ff` | Accent principal |
| `--ud-cyan` | `#00f0ff` | Accent secundario (highlights) |
| `--ud-brand-sky` | `#7ad7f4` | Celeste de marca (la U del logo) |
| `--ud-brand-lilac` | `#8f82dc` | Lila de marca |
| `--ud-brand-gold` | `#dec063` | Dorado de marca |
| `--ud-brand-coral` | `#e35d52` | Coral de marca |
| `--ud-glass` | `rgba(255,255,255,0.08)` | Superficies glass |

**Reglas:**
- **Accent < 5% del layout.** Neutros con 3-5% de hue de la marca (no gris puro).
- `::selection` y `:focus-visible` SIEMPRE con `--ud-blue`.
- En dark mode, las superficies son `--ud-card` (10,10,10) y `--ud-card-hover`.
- **NO usar gradientes azul→púrpura** (delata al AI). Blobs orgánicos sí (ver BlobField).
- **Brand colors** (`sky/lilac/gold/coral`) = acentos de marca: usarlos en hover de cards, líneas de acento, highlights. Nunca como relleno completo.

## Tipografía

| Token | Fuente | Uso |
|-------|--------|-----|
| `--ud-font-display` | **Familjen Grotesk** | Títulos (h1-h6) |
| `--ud-font-body` | **DM Sans** | Texto, párrafos |
| `--ud-font-ui` | Manrope | UI/buttons |
| `--ud-font-mono` | Geist Mono | Código/datos |

**Reglas:**
- **NUNCA Inter como fuente principal** (fallback solo). NUNCA Geist solo.
- Display + body SIEMPRE distintos. 2 familias mínimas.
- Títulos: `letter-spacing: -0.03em`, `text-wrap: balance`.
- Escala tipográfica custom, no la default de Tailwind.

## Radius & spacing

- `--ud-radius-sm: 8px`, `--ud-radius-md: 14px`, `--ud-radius-lg` (16px+).
- **Esquinas NO 0px en cards** (la mediana humana usa ~50px en cards/hero).
- Spacing por tokens, no hardcodeado.

## Componentes del DS (`src/components/ui/`)

- **BlobField** — blobs gooey animados (masa líquida orgánica, colores rojo/violeta/magenta, NUNCA verde pastel).
- **Button** — `variant="stroke"` para el efecto glow animado premium.
- Card, Badge, Text, Icon, Input, Divider, Container, SectionLabel, Skeleton, Marquee, Reveal, LetterReveal, Logo.

## Blobs (el signature visual)

Los blobs orgánicos que morphan y se funden (efecto gooey/metaball tipo Framer) son el **firma visual de la marca**. Paleta: rojos/corales, violetas/magentas, ámbar. **SIN verde, SIN cian pastel.** Colores análogos random por refresh. Masa a la izquierda, lado derecho limpio para texto.

## WebGL & Effects (capa atmosférica)

Los efectos atmosféricos (canvas, WebGL, Three.js, orbs, partículas) SIEMPRE van **detrás del contenido**, como capa de soporte. Reglas:

- **Primero legibilidad, después efecto.** El texto y la jerarquía nunca se sacrifican por el fondo.
- **Performantes:** el efecto se pausa con `prefers-reduced-motion`, se degrada en mobile si el FPS cae.
- **Paleta:** los orbs/blobs usan los colores de marca (`--ud-brand-sky/lilac/gold/coral`) o los `--glow-*` reales de Framer. NUNCA verde, NUNCA cian pastel.
- **Orbs:** si se usan orbs tipo Auralis/ForgeUI (blur alto + `mix-blend-screen` que cambian de color/posición por sección), el blur es `--ud-blur-3xl/4xl` (70-80px) y la intensidad se mantiene sutil — acento, no protagonista.
- **Interacción:** IntersectionObserver/ScrollTrigger para que el efecto reaccione por sección, timing suave con `--ease-out`.
- **Contraste:** nada de full-brightness en el fondo. Los gradientes `--glow-hero` y conic-gradients reales de Framer son los únicos permitidos como ambiente.

**Anti-slop de efectos:** NUNCA partículas genéricas tipo "starfield", NUNCA glow shadows de color (`drop-shadow` con cyan/magenta), NUNCA confetti, NUNCA fondo que compita con el texto.

## Animación

- **`motion/react`** (ex Framer Motion) como base para reveals/micro-interactions.
- **GSAP + ScrollTrigger + SplitText** para scroll choreography premium (text reveals por caracter, pinning, scrub).
- **Lenis** para smooth scroll.
- Easing: `cubic-bezier(0.16,1,0.3,1)` (exponential out) — NUNCA `ease-in-out` genérico.
- Entrances variados (no fade-up en todo). `prefers-reduced-motion` respetado.

## Anti-slop (lo que NUNCA)

- Inter/Geist/Roboto como única fuente.
- Gradientes azul→púrpura en hero.
- `backdrop-blur` en navbar (glass genérico).
- Terminal con 3 dots, stats fake ("10K+ usuarios"), badge pulse.
- Hero centrado + 2 CTAs + secuencia template.
- `grid-cols-3` uniforme, `py-20` en todo, `rounded-2xl` global.
- Bento grid uniforme, neo-brutalism, mesh gradients.

## Cómo usar este documento

1. Antes de diseñar UI nueva → **leer este DESIGN.md** + `public/styles/tokens.css`.
2. Si hay referencia visual → adjuntar screenshot + URL (no "hazlo premium").
3. Después de diseñar → correr `npm run slop` (impeccable) + screenshot + critique.
4. Iterar hasta 0 anti-patterns y un score alto.

*Generado con la metodología de hallmark/DESIGN.md (agos 2026).*
