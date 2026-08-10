# UserDesigners — Design System (DESIGN.md)

> Documento de referencia visual. **Cualquier UI nueva DEBE respetar esto.**
> Tokens reales en `src/styles/tokens.css`. Un agente nuevo lee este archivo antes de diseñar.

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
| `--ud-brand-sky` | `#7AD7F4` | Celeste de marca (la U del logo) |
| `--ud-brand-lilac` | `#8F82DC` | Lila de marca |
| `--ud-brand-gold` | `#DEC063` | Dorado de marca |
| `--ud-brand-coral` | `#E35D52` | Coral de marca |

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

1. Antes de diseñar UI nueva → **leer este DESIGN.md** + `tokens.css`.
2. Si hay referencia visual → adjuntar screenshot + URL (no "hazlo premium").
3. Después de diseñar → correr `npm run slop` (impeccable) + screenshot + critique.
4. Iterar hasta 0 anti-patterns y un score alto.

*Generado con la metodología de hallmark/DESIGN.md (agos 2026).*
