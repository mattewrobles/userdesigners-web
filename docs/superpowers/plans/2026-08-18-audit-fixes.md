# Audit Fixes (SEO/Perf/Blog/Código) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Resolver los hallazgos del audit completo (SEO/GEO/AEO, performance, anti-slop, code review) del 2026-08-18 sobre las 4 páginas ya migradas a Astro y el pipeline de blog — sin tocar las páginas de proyecto todavía en Framer (kaito/novo/utransfer/verificacion-biometrica quedan para la migración completa futura, excepto 3 correcciones de copy puntuales confirmadas por Mau).

**Architecture:** Sitio Astro estático (`output: "static"`), deploy en Cloudflare Pages con auto-deploy en push a `main`. Sin test suite — este es un sitio de contenido, no una app con lógica de negocio. La verificación de cada tarea es: `npm run build` limpio + inspección del HTML/JSON generado (grep) + revisión visual cuando aplique. No hay pytest/vitest que escribir.

**Tech Stack:** Astro 7, contenido markdown vía `astro:content` (glob loader), scripts Node standalone (`scripts/*.js`/`*.mjs`), GitHub Actions para el pipeline de blog (n8n → GH Actions → Notion).

**Spec:** Este documento — no hay spec externo, el alcance viene directo del audit + confirmación de Mau en conversación (2026-08-18).

## Global Constraints

- NO tocar `src/html/proyectos/{kaito,novo,utransfer,verificacion-biometrica}.html` salvo la corrección puntual de copy del Task 9 (mismo texto repetido) — la migración completa de esas 4 páginas es un proyecto separado, ya en el backlog.
- NO usar hex/rgba hardcodeados nuevos ni `!important` nuevo — si una tarea lo requeriría, escalar en vez de parchear (regla del proyecto, `common/coding-style.md`).
- Cada cambio debe pasar `npm run build` sin errores antes de commit.
- Commits pequeños y atómicos, uno por task, mensajes en español siguiendo el estilo del repo (`feat:`, `fix:`, `perf:`, `seo:`, `chore:`).
- No tocar `.secrets` ni imprimir su contenido.

---

### Task 1: Excluir `_TEMPLATE.md` de la colección de blog

**Files:**
- Modify: `src/content/config.ts:6`

**Interfaces:**
- Produces: la colección `blog` (usada por `src/pages/blog/index.astro`, `src/pages/blog/[...slug].astro`, `src/pages/blog/page/[page].astro`) deja de incluir `_TEMPLATE.md` o cualquier archivo que empiece con `_`.

- [ ] **Step 1: Cambiar el patrón del glob loader**

En `src/content/config.ts`, la definición actual es:
```ts
const blog = defineCollection({
  loader: glob({ pattern: "**/*.md", base: "./src/content/blog" }),
  ...
```
Cambiar a:
```ts
const blog = defineCollection({
  loader: glob({ pattern: ["**/*.md", "!_*.md"], base: "./src/content/blog" }),
  ...
```

- [ ] **Step 2: Verificar que el build ya no genera la ruta**

Run: `npm run build 2>&1 | tail -5 && ls dist/blog/ | grep -i template`
Expected: el `ls` no imprime nada (sin carpeta `_template`), el build termina sin errores.

- [ ] **Step 3: Commit**

```bash
git add src/content/config.ts
git commit -m "fix: excluir _TEMPLATE.md de la coleccion de blog (estaba indexado en produccion)"
```

---

### Task 2: FAQPage schema real (o ninguno) en vez de boilerplate

**Files:**
- Modify: `src/layouts/BlogPost.astro:71-91` (bloque `FAQPage`)

**Interfaces:**
- Consumes: `post.body` (markdown crudo del entry, disponible en `CollectionEntry<"blog">` con loader `glob`), `title` (ya desestructurado en el frontmatter del archivo).
- Produces: script `application/ld+json` FAQPage solo cuando hay preguntas reales visibles en el post; si no hay, no se emite el script.

- [ ] **Step 1: Agregar el parser de FAQ real antes del frontmatter final**

En `src/layouts/BlogPost.astro`, justo después de la línea `const hasToc = headings && headings.length > 0;`, agregar:

```astro
function extractFaqPairs(markdown) {
  if (!markdown) return [];
  const section = markdown.match(/^##\s+.*(?:preguntas frecuentes|faq)[^\n]*\n([\s\S]*?)(?=\n##\s|\n*$)/im);
  if (!section) return [];
  const pairs = [...section[1].matchAll(/\*\*(.+?)\*\*\s*\n+([^\n][\s\S]*?)(?=\n\*\*|\n*$)/g)];
  return pairs
    .map(([, q, a]) => ({ q: q.trim(), a: a.trim().replace(/\s+/g, " ") }))
    .filter((p) => p.q && p.a);
}
const faqPairs = extractFaqPairs(post.body);
```

- [ ] **Step 2: Reemplazar el bloque FAQPage boilerplate**

Reemplazar el bloque completo (líneas 71-91, el que arma `mainEntity` con 3 preguntas genéricas basadas en `title`) por:

```astro
{faqPairs.length > 0 && (
  <script type="application/ld+json" set:html={JSON.stringify({
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: faqPairs.map((p) => ({
      "@type": "Question",
      name: p.q,
      acceptedAnswer: { "@type": "Answer", text: p.a }
    }))
  })} />
)}
```

- [ ] **Step 3: Verificar contra un post real con sección de FAQ**

Run: `npm run build 2>&1 | tail -5 && grep -A3 "FAQPage" dist/blog/inteligencia-artificial-en-diseno-de-productos/index.html | head -20`
Expected: el JSON-LD contiene las preguntas reales del post ("¿La IA reemplazará a los diseñadores de productos?", etc.), no las genéricas basadas en el título.

- [ ] **Step 4: Verificar que un post sin sección de FAQ no emite el script**

Run: `grep -c "FAQPage" dist/blog/prototipado-rapido-valida-idea/index.html || true`
(revisar antes cuál post no tiene "## Preguntas frecuentes" — si todos la tienen, este step se documenta como N/A en el commit)

- [ ] **Step 5: Commit**

```bash
git add src/layouts/BlogPost.astro
git commit -m "seo: FAQPage schema real desde el contenido visible, no boilerplate generico"
```

---

### Task 3: Quitar el gate de JS del H1 del hero (Home) — LCP

**Files:**
- Modify: `src/components/home/HomeHero.astro:21`

**Interfaces:**
- Produces: el H1 del hero se pinta desde el primer render del HTML (sin depender de que cargue/ejecute `motion` + `LetterReveal`), eliminando el `elementRenderDelay` de ~3.4s medido por Lighthouse en producción.

- [ ] **Step 1: Reemplazar `LetterReveal` por un `<h1>` plano**

Cambiar:
```astro
<LetterReveal as="h1" stagger={0.035} duration={0.5}>Agencia de UX/UI orientada a Fintechs</LetterReveal>
```
por:
```astro
<h1>Agencia de UX/UI orientada a Fintechs</h1>
```

- [ ] **Step 2: Quitar el import ya no usado si no se usa en otro lado del archivo**

Run: `grep -n "LetterReveal" src/components/home/HomeHero.astro`
Si solo aparece en el `import`, borrar la línea `import LetterReveal from "../ui/LetterReveal.astro";`.

- [ ] **Step 3: Verificar visualmente que el H1 se ve igual (sin la animación letra-por-letra)**

Run: `npm run dev` y abrir `http://localhost:4321/` — confirmar que el título se muestra de inmediato, sin el efecto de aparición letra por letra (el resto del hero —subtítulo, CTA, logos— sigue con su `Reveal` normal).

- [ ] **Step 4: Commit**

```bash
git add src/components/home/HomeHero.astro
git commit -m "perf: quitar animacion JS del H1 del hero (era el LCP, retrasaba el paint ~3.4s)"
```

---

### Task 4: Google Fonts no-bloqueante en las 9 páginas

**Files:**
- Modify: `src/pages/index.astro`, `src/pages/nosotros/index.astro`, `src/pages/servicios/index.astro`, `src/pages/proyectos/index.astro`, `src/pages/contacto/index.astro`, `src/pages/mantenimiento.astro`, `src/pages/design-system.astro`, `src/pages/seo-doctores/index.astro`, `src/pages/blog/index.astro`, `src/pages/blog/page/[page].astro`, `src/layouts/BlogPost.astro`

**Interfaces:**
- Produces: el `<link>` de Google Fonts deja de bloquear el render (era ~1000-1150ms de `wastedMs` reportado por Lighthouse en cada página).

- [ ] **Step 1: Aplicar el patrón preload+swap en cada archivo**

El patrón actual en cada archivo es (ejemplo de `src/pages/index.astro:99-104`):
```astro
<link rel="preconnect" href="https://fonts.googleapis.com" />
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
<link
  href="https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600&family=Familjen+Grotesk:wght@400;500;600&display=swap"
  rel="stylesheet"
/>
```
Reemplazar por (mismo href de cada archivo — respetar los pesos que ya tenía cada página, algunas usan solo `Familjen+Grotesk` o pesos distintos como `300;400;500` en `mantenimiento.astro`):
```astro
<link rel="preconnect" href="https://fonts.googleapis.com" />
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
<link
  rel="preload"
  as="style"
  href="https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600&family=Familjen+Grotesk:wght@400;500;600&display=swap"
/>
<link
  rel="stylesheet"
  href="https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600&family=Familjen+Grotesk:wght@400;500;600&display=swap"
  media="print"
  onload="this.media='all'"
/>
<noscript>
  <link
    rel="stylesheet"
    href="https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600&family=Familjen+Grotesk:wght@400;500;600&display=swap"
  />
</noscript>
```

- [ ] **Step 2: Repetir en los 11 archivos, usando el href exacto que cada uno ya tenía**

Confirmar el href de cada archivo antes de tocarlo:
Run: `grep -A2 "fonts.googleapis.com/css2" src/pages/*.astro src/pages/*/*.astro src/pages/*/*/*.astro src/layouts/BlogPost.astro 2>/dev/null`
Aplicar el mismo patrón (Step 1) a cada uno, preservando su combinación de familias/pesos.

- [ ] **Step 3: Verificar que no hay render-blocking en el build**

Run: `npm run build 2>&1 | tail -5 && grep -c 'media="print"' dist/index.html dist/nosotros/index.html dist/servicios/index.html dist/proyectos/index.html`
Expected: cada archivo imprime al menos `1`.

- [ ] **Step 4: Commit**

```bash
git add src/pages src/layouts/BlogPost.astro
git commit -m "perf: cargar Google Fonts sin bloquear el render (preload+swap) en todas las paginas"
```

---

### Task 5: Cache-bust de las 2 imágenes de /servicios atascadas en el edge de Cloudflare

**Files:**
- Modify: `public/assets/local/8gGuaBwL0C4BFlIObKpdcZLOCmA.webp` → renombrar
- Modify: `public/assets/local/pkXs73A7T3I8wb8CTf0PPstI.webp` → renombrar
- Modify: `src/html/servicios-native.html` (80 referencias entre los dos nombres)

**Interfaces:**
- Produces: nuevas URLs de imagen (mismo contenido, hash de nombre distinto) que Cloudflare no puede servir desde caché viejo porque la URL nunca existió antes.

**Contexto:** el archivo de origen en el repo YA está corregido (72KB y 124KB, confirmado con `ls -la`), pero producción sigue sirviendo 1.19MB/1.15MB con `cache-control: immutable` y `cf-cache-status: HIT` — el edge cacheó la versión vieja en esa URL exacta antes del fix y nunca se invalidó. Cambiar el nombre del archivo fuerza una URL nueva.

- [ ] **Step 1: Renombrar los archivos con un sufijo de versión**

```bash
cd "/Users/mau/Developer/work/userdesigners/userdesigners-web-migration"
git mv public/assets/local/8gGuaBwL0C4BFlIObKpdcZLOCmA.webp public/assets/local/8gGuaBwL0C4BFlIObKpdcZLOCmA-v2.webp
git mv public/assets/local/pkXs73A7T3I8wb8CTf0PPstI.webp public/assets/local/pkXs73A7T3I8wb8CTf0PPstI-v2.webp
```

- [ ] **Step 2: Actualizar las referencias en el HTML**

```bash
sed -i '' 's/8gGuaBwL0C4BFlIObKpdcZLOCmA\.webp/8gGuaBwL0C4BFlIObKpdcZLOCmA-v2.webp/g' src/html/servicios-native.html
sed -i '' 's/pkXs73A7T3I8wb8CTf0PPstI\.webp/pkXs73A7T3I8wb8CTf0PPstI-v2.webp/g' src/html/servicios-native.html
```

- [ ] **Step 3: Verificar que no quedan referencias al nombre viejo y que el nuevo aparece**

Run: `grep -c "8gGuaBwL0C4BFlIObKpdcZLOCmA\.webp\"" src/html/servicios-native.html; grep -c "8gGuaBwL0C4BFlIObKpdcZLOCmA-v2.webp" src/html/servicios-native.html`
Expected: el primer grep da `0` (sin contar el nuevo), el segundo da `40`.

- [ ] **Step 4: Build y confirmar peso real de los assets generados**

Run: `npm run build 2>&1 | tail -5 && ls -la dist/assets/local/8gGuaBwL0C4BFlIObKpdcZLOCmA-v2.webp dist/assets/local/pkXs73A7T3I8wb8CTf0PPstI-v2.webp`
Expected: 72212 bytes y 124184 bytes respectivamente (no ~1.2MB).

- [ ] **Step 5: Commit**

```bash
git add public/assets/local/ src/html/servicios-native.html
git commit -m "perf: renombrar 2 imagenes de servicios para forzar invalidacion de cache CDN (servian 1.2MB viejos)"
```

**Nota post-deploy:** después de mergear a `main` y que Cloudflare Pages haga el deploy automático, confirmar con `curl -I https://www.userdesigners.com/assets/local/8gGuaBwL0C4BFlIObKpdcZLOCmA-v2.webp` que el `content-length` ya es ~72KB.

---

### Task 6: `fetchpriority="high"` en las imágenes LCP de servicios y proyectos

**Files:**
- Modify: `src/pages/servicios/index.astro`
- Modify: `src/pages/proyectos/index.astro`

**Interfaces:**
- Produces: el navegador prioriza la descarga de la imagen LCP en vez de tratarla como una imagen más.

- [ ] **Step 1: Ubicar el `<img>` del hero en cada página y confirmar que está en el HTML server-rendered**

Run: `grep -n 'ud-ajhakw\|<img' src/pages/servicios/index.astro | head -5`
(el selector exacto lo dio Lighthouse: `div.ud-ajhakw > div.ud-17v9y86 > div > img` — si el HTML de esta página se construye con `fs.readFileSync` + regex como los otros, el `<img>` real vive en `src/html/servicios-native.html`, no en el `.astro`. Verificar con:)
Run: `grep -n 'ud-ajhakw' src/html/servicios-native.html | head -3`

- [ ] **Step 2: Agregar `fetchpriority="high"` con un post-proceso de string en el `.astro`, igual al patrón ya usado para otros fixes**

En `src/pages/servicios/index.astro`, después de los `html.replace(...)` existentes, agregar:
```js
// LCP: la imagen hero necesita prioridad de descarga (Lighthouse: priorityHinted=false)
html = html.replace(
  /(<img[^>]*class="ud-[^"]*"[^>]*style="[^"]*width:100%[^"]*")(?!.*fetchpriority)/i,
  '$1 fetchpriority="high" loading="eager"'
);
```
(si el regex no captura el `<img>` correcto en la verificación del Step 1, ajustar el selector al atributo real que identifique unívocamente esa imagen — no aplicar un regex genérico que pueda matchear más de una imagen.)

- [ ] **Step 3: Repetir en `src/pages/proyectos/index.astro` para su hero image**

Mismo patrón, adaptado al selector real de esa página (confirmar primero con `grep -n '<img' src/html/proyectos-native.html | head -5`).

- [ ] **Step 4: Verificar en el HTML generado**

Run: `npm run build 2>&1 | tail -5 && grep -o '<img[^>]*fetchpriority="high"[^>]*>' dist/servicios/index.html dist/proyectos/index.html`
Expected: una coincidencia por archivo (no cero, no múltiples).

- [ ] **Step 5: Commit**

```bash
git add src/pages/servicios/index.astro src/pages/proyectos/index.astro
git commit -m "perf: fetchpriority=high en las imagenes LCP de servicios y proyectos"
```

---

### Task 7: Quitar estadísticas inventadas sin fuente (regla RULE-H) en 3 posts publicados

**Files:**
- Modify: `src/content/blog/inteligencia-artificial-en-diseno-de-productos.md:15`
- Modify: `src/content/blog/mejores-agencias-ux-latam.md:15`
- Modify: `src/content/blog/como-hacer-un-redesign-sin-morir-en-el-intento.md:15`

**Interfaces:**
- Produces: la misma idea de cada párrafo, sin el "70%" sin fuente ni la estructura idéntica "El 70% de X fracasan no por Y, sino porque Z" repetida en los 3.

- [ ] **Step 1: Reescribir la línea 15 de `inteligencia-artificial-en-diseno-de-productos.md`**

Texto actual:
```
El 70% de las herramientas de IA generativa de UI fallan en integrarse a sistemas de diseño reales porque generan código basura e inconsistencias visuales. Si eres CTO, separar el marketing de la utilidad real en UX no es opcional: es cuestión de presupuesto.
```
Reemplazar por (afirmación calificada, sin estadística inventada):
```
La mayoría de las herramientas de IA generativa de UI que probamos con clientes fintech fallan al integrarse a un sistema de diseño real: generan componentes que no respetan tokens ni variantes, y el equipo termina reescribiéndolos a mano. Si eres CTO, separar el marketing de la utilidad real en UX no es opcional: es cuestión de presupuesto.
```

- [ ] **Step 2: Reescribir la línea 15 de `mejores-agencias-ux-latam.md`**

Texto actual:
```
El 70% de los rediseños digitales en Latinoamérica fracasan no por falta de estética, sino porque ignoran la fragmentación de medios de pago y la latencia móvil de la región. Si eres CTO o CPO y buscas externalizar el diseño de producto, elegir mal al socio estratégico destruye tu runway.
```
Reemplazar por:
```
Los rediseños digitales que fallan en Latinoamérica casi nunca fallan por estética: fallan porque ignoran la fragmentación de medios de pago y la latencia móvil real de la región. Si eres CTO o CPO y buscas externalizar el diseño de producto, elegir mal al socio estratégico destruye tu runway.
```

- [ ] **Step 3: Reescribir la línea 15 de `como-hacer-un-redesign-sin-morir-en-el-intento.md`**

Texto actual:
```
El 70% de los rediseños de software fracasan no por falta de talento visual, sino porque destruyen la memoria muscular del usuario en nombre de la 'modernización'. Cambiar componentes sin datos previos genera una caída inmediata en la retención y colapsa el soporte técnico.
```
Reemplazar por:
```
Los rediseños de software que fracasan casi nunca fracasan por falta de talento visual: fracasan porque destruyen la memoria muscular del usuario en nombre de la "modernización". Cambiar componentes sin datos previos genera una caída inmediata en la retención y colapsa el soporte técnico.
```

- [ ] **Step 4: Confirmar que no quedan porcentajes redondos sin fuente en el blog**

Run: `grep -rn "70%\|80%\|90%" src/content/blog/*.md`
Expected: sin coincidencias (o coincidencias con fuente citada explícita, revisar caso por caso si aparece alguna).

- [ ] **Step 5: Commit**

```bash
git add src/content/blog/inteligencia-artificial-en-diseno-de-productos.md src/content/blog/mejores-agencias-ux-latam.md src/content/blog/como-hacer-un-redesign-sin-morir-en-el-intento.md
git commit -m "content: quitar estadisticas 70% sin fuente repetidas en 3 posts (RULE-H)"
```

---

### Task 8: Fix typo "sufrre" en post publicado

**Files:**
- Modify: `src/content/blog/mejores-agencias-ux-latam.md`

- [ ] **Step 1: Corregir el typo**

Run: `grep -n "sufrre" src/content/blog/mejores-agencias-ux-latam.md`
Reemplazar `sufrre` por `sufre` en esa línea exacta.

- [ ] **Step 2: Verificar**

Run: `grep -c "sufrre" src/content/blog/mejores-agencias-ux-latam.md`
Expected: `0`.

- [ ] **Step 3: Commit**

```bash
git add src/content/blog/mejores-agencias-ux-latam.md
git commit -m "fix: typo 'sufrre' -> 'sufre' en post publicado"
```

---

### Task 9: Reescribir el molde repetido "no era X, sino Y" en las 3 fichas de proyecto

**Files:**
- Modify: `src/html/proyectos/kaito.html`
- Modify: `src/html/proyectos/novo.html`
- Modify: `src/html/proyectos/verificacion-biometrica.html`

**Nota:** esto es una corrección de copy puntual (2 ocurrencias por archivo, texto duplicado dentro del mismo HTML — probablemente una variante desktop y otra mobile del mismo bloque). NO implica migrar estas páginas a Astro — eso queda para después.

- [ ] **Step 1: Kaito — reemplazar las 2 ocurrencias**

Texto actual:
```
no era únicamente unificar la interfaz, sino crear un sistema de diseño que funcionara como infraestructura del producto.
```
Reemplazar por:
```
era construir un sistema de diseño que Kaito pudiera operar como infraestructura: componentes versionados, tokens compartidos entre equipos, y una base que escalara con cada nuevo flujo de pago B2B.
```
(ajustar la frase previa si hace falta para que la oración completa siga leyendo bien — verificar el contexto exacto con `grep -B2 "no era únicamente unificar" src/html/proyectos/kaito.html` antes de reemplazar, ya que el "no" inicial puede venir de una frase anterior tipo "El objetivo...").

- [ ] **Step 2: Novo — reemplazar las 2 ocurrencias**

Texto actual:
```
no era solo "unificar la interfaz", sino crear una base sólida que permitiera diseñar, desarrollar y escalar el producto con coherencia y velocidad.
```
Reemplazar por:
```
era diseñar una base de componentes que Novo pudiera escalar sin fricción entre diseño y desarrollo — coherencia visual y velocidad de entrega como el mismo problema, no dos.
```

- [ ] **Step 3: Verificación biométrica — reemplazar las 2 ocurrencias**

Texto actual:
```
no era únicamente entregar una interfaz visual, sino validar una metodología de trabajo completa que fuera desde el research, el buen UX hasta la ejecución UI.
```
Reemplazar por:
```
era validar el flujo completo de verificación de identidad de punta a punta: research con usuarios reales, arquitectura UX del flujo, y la ejecución UI que redujera el abandono en el paso más sensible del onboarding.
```

- [ ] **Step 4: Confirmar que el molde no se repite entre las 3 fichas**

Run: `grep -o "no era[^.]*\." src/html/proyectos/*.html`
Expected: sin coincidencias.

- [ ] **Step 5: Build y revisión visual rápida**

Run: `npm run build 2>&1 | tail -5` — confirmar que el build sigue sin errores (estas páginas no pasan por procesamiento Astro más allá del wrapper, así que el riesgo de romper algo es bajo).

- [ ] **Step 6: Commit**

```bash
git add src/html/proyectos/kaito.html src/html/proyectos/novo.html src/html/proyectos/verificacion-biometrica.html
git commit -m "content: reescribir texto de objetivo repetido en 3 fichas de proyecto (mismo molde en las 3)"
```

---

### Task 10: Cerrar la inyección de script en `generate-blog.yml`

**Files:**
- Modify: `.github/workflows/generate-blog.yml`

**Interfaces:**
- Produces: `topic`/`category` viajan como variables de entorno (`$TOPIC`/`$CATEGORY`), no interpolados directo en el bloque `run:`.

- [ ] **Step 1: Cambiar el step "Generate blog draft"**

Texto actual:
```yaml
      - name: Generate blog draft
        id: generate
        env:
          TOKENROUTER_API_KEY: ${{ secrets.TOKENROUTER_API_KEY }}
          NOTION_TOKEN: ${{ secrets.NOTION_TOKEN }}
          NOTION_DB_ID: ${{ secrets.NOTION_DB_ID }}
          UNSPLASH_ACCESS_KEY: ${{ secrets.UNSPLASH_ACCESS_KEY }}
          BLOG_MODEL: ${{ github.event.inputs.model || 'deepseek/deepseek-v4-pro-0813' }}
        run: |
          set +e
          node scripts/generate-blog-draft.js "${{ github.event.inputs.topic }}" "${{ github.event.inputs.category }}" > /tmp/script-out.txt 2>&1
```
Reemplazar por:
```yaml
      - name: Generate blog draft
        id: generate
        env:
          TOKENROUTER_API_KEY: ${{ secrets.TOKENROUTER_API_KEY }}
          NOTION_TOKEN: ${{ secrets.NOTION_TOKEN }}
          NOTION_DB_ID: ${{ secrets.NOTION_DB_ID }}
          UNSPLASH_ACCESS_KEY: ${{ secrets.UNSPLASH_ACCESS_KEY }}
          BLOG_MODEL: ${{ github.event.inputs.model || 'deepseek/deepseek-v4-pro-0813' }}
          BLOG_TOPIC: ${{ github.event.inputs.topic }}
          BLOG_CATEGORY: ${{ github.event.inputs.category }}
        run: |
          set +e
          node scripts/generate-blog-draft.js "$BLOG_TOPIC" "$BLOG_CATEGORY" > /tmp/script-out.txt 2>&1
```

- [ ] **Step 2: Verificar que no quedan interpolaciones directas de inputs en bloques `run:`**

Run: `grep -n 'github.event.inputs' .github/workflows/generate-blog.yml`
Expected: las únicas coincidencias están dentro de bloques `env:`, ninguna dentro de un `run:`.

- [ ] **Step 3: Commit**

```bash
git add .github/workflows/generate-blog.yml
git commit -m "security: pasar inputs de workflow_dispatch por env en vez de interpolar en run: (script injection)"
```

---

### Task 11: Paginar la query de Notion en el chequeo de duplicados

**Files:**
- Modify: `scripts/generate-blog-draft.js`

**Interfaces:**
- Produces: el chequeo de posts existentes/duplicados recorre TODA la base de Notion, no solo los primeros 100 resultados.

- [ ] **Step 1: Ubicar la query actual**

Run: `grep -n 'databases/\${DB_ID}/query' scripts/generate-blog-draft.js`

- [ ] **Step 2: Envolver la llamada en un loop de paginación**

Reemplazar (alrededor de la línea 364):
```js
const res = await notion(`/v1/databases/${DB_ID}/query`, "POST", {});
```
por:
```js
let allResults = [];
let cursor = undefined;
do {
  const body = cursor ? { start_cursor: cursor } : {};
  const page = await notion(`/v1/databases/${DB_ID}/query`, "POST", body);
  allResults = allResults.concat(page.results || []);
  cursor = page.has_more ? page.next_cursor : undefined;
} while (cursor);
const res = { results: allResults };
```

- [ ] **Step 3: Verificar que el resto del código que usa `res.results` sigue funcionando igual**

Run: `grep -n 'res\.results' scripts/generate-blog-draft.js`
Confirmar que ninguna línea posterior asume una forma distinta de `res` (debe seguir siendo `{ results: [...] }`).

- [ ] **Step 4: Commit**

```bash
git add scripts/generate-blog-draft.js
git commit -m "fix: paginar query de Notion en check de duplicados (antes solo leia los primeros 100 posts)"
```

---

### Task 12: Fix del mensaje de error de env vars

**Files:**
- Modify: `scripts/generate-blog-draft.js:25`

- [ ] **Step 1: Corregir el mensaje**

Texto actual:
```js
console.error("Missing env vars: OPENAI_API_KEY, NOTION_TOKEN, NOTION_DB_ID");
```
Reemplazar por:
```js
console.error("Missing env vars: TOKENROUTER_API_KEY (o OPENAI_API_KEY), NOTION_TOKEN, NOTION_DB_ID");
```

- [ ] **Step 2: Commit**

```bash
git add scripts/generate-blog-draft.js
git commit -m "fix: mensaje de error de env vars coincide con las vars reales que lee el script"
```

---

### Task 13: Extraer el saneo de HTML de Framer a un helper compartido

**Files:**
- Create: `src/lib/framer-html.ts`
- Modify: `src/pages/index.astro`
- Modify: `src/pages/servicios/index.astro`
- Modify: `src/pages/nosotros/index.astro`

**Interfaces:**
- Produces: `sanitizeFramerHtml(html: string): string` — aplica los reemplazos comunes de opacity/transform/filter/visibility que dejaba el player de Framer. Cada página sigue aplicando SUS reemplazos específicos por separado (el CTA dashboard de nosotros, las variantes de breakpoint de servicios, etc.) — el helper solo cubre lo que las 3 páginas repiten idéntico.

- [ ] **Step 1: Crear el helper con los reemplazos comunes a las 3 páginas**

Confirmar primero cuáles líneas son idénticas en las 3:
Run: `diff <(grep 'html = html.replace' src/pages/index.astro) <(grep 'html = html.replace' src/pages/nosotros/index.astro)`
Run: `diff <(grep 'html = html.replace' src/pages/index.astro) <(grep 'html = html.replace' src/pages/servicios/index.astro)`

Crear `src/lib/framer-html.ts`:
```ts
export function sanitizeFramerHtml(html: string): string {
  return html
    .replace(/opacity:\s*0\.001/gi, "opacity:1")
    .replace(/opacity:\s*0;/gi, "opacity:1;")
    .replace(/opacity:0(?!\d)/gi, "opacity:1")
    .replace(/transform:\s*perspective\([^)]*\)\s*translateY\([^)]*\)/gi, "transform:none")
    .replace(/filter:\s*blur\(10px\)/gi, "filter:none")
    .replace(/visibility:\s*hidden/gi, "visibility:visible");
}
```
(los reemplazos que salieron distintos en el `diff` del Step 1 — como los de `translateX` específicos de home, o las variantes de breakpoint de servicios — se quedan en cada `.astro`, aplicados DESPUÉS de llamar al helper.)

- [ ] **Step 2: Usar el helper en las 3 páginas**

En cada uno de `src/pages/index.astro`, `src/pages/servicios/index.astro`, `src/pages/nosotros/index.astro`:
```astro
import { sanitizeFramerHtml } from "../lib/framer-html";
// (ajustar la ruta relativa según la profundidad del archivo, ../../lib/ para las que están en subcarpeta)
```
Reemplazar las líneas repetidas de `html = html.replace(...)` que coincidan exactamente con las del helper por:
```js
html = sanitizeFramerHtml(html);
```
Dejar intactas las líneas que el `diff` del Step 1 marcó como distintas por archivo.

- [ ] **Step 3: Verificar que las 3 páginas siguen renderizando igual**

Run: `npm run build 2>&1 | tail -10`
Expected: build limpio, sin errores de import.
Run: `npm run dev` y revisar visualmente `/`, `/servicios`, `/nosotros` — deben verse exactamente igual que antes (mismo contenido visible, misma ausencia de elementos "congelados" en estado de animación de entrada).

- [ ] **Step 4: Commit**

```bash
git add src/lib/framer-html.ts src/pages/index.astro src/pages/servicios/index.astro src/pages/nosotros/index.astro
git commit -m "refactor: extraer saneo de HTML de Framer a helper compartido (estaba triplicado)"
```

---

## Fuera de alcance de este plan (decisión explícita, no olvido)

- **Footer "© 2025 Cyberg" duplicado + copy de QA pegado en Utransfer + 24 tarjetas "Servicio" placeholder + H1 duplicado en /nosotros y /proyectos** — confirmado con Mau que las 4 fichas de proyecto (kaito/novo/utransfer/verificacion-biometrica) siguen en Framer sin migrar; estos bugs se resuelven naturalmente cuando se haga la migración completa a Astro nativo (mismo trabajo que ya se hizo para home/servicios/nosotros/proyectos). Parchear ahora la plantilla Framer es esfuerzo duplicado.
- **`!important` + hex hardcodeado en servicios/nosotros (páginas ya migradas)** — es deuda real (señalada por code-reviewer) pero la corrección correcta es reescribir esas secciones con Grid/Flexbox nativo y tokens del DS, no un find-replace de colores. Es un trabajo de diseño+código con riesgo de regresión visual en páginas live, no una tarea mecánica de este pase. Queda como ticket separado.
- **Expandir los posts ya publicados que están por debajo de 1500 palabras** (245-650 palabras reales vs. el estándar) — el generador y `validate-blog-seo.mjs` YA gatean esto para posts nuevos (`min 1500` es CRÍTICO desde el rewrite del 16 ago). Los posts viejos publicados antes de ese gate necesitan una reescritura de contenido real, no un script — es trabajo de escritura, no de código. Queda como pase de contenido dedicado.
- **Nombrar competidores reales (Multiplica, IDA, Frog) en el ranking auto-servido** — es una decisión editorial/reputacional, no un bug técnico. Reportarlo a Mau/Ari para que decidan si lo dejan, lo suavizan, o lo quitan.

---

## Self-Review

**Spec coverage:** los 5 bloques que Mau confirmó explícitamente están cubiertos — Task 1 (`_template`), Task 5+6 (LCP servicios), Task 3+4 (LCP home/nosotros + fonts), Task 7+8+9 (calidad de blog: stat inventada, typo, molde repetido), Task 10+11+12+13 (deuda de código: script injection, paginación Notion, mensaje de error, helper compartido). Los 4 hallazgos que dependían de las páginas Framer no confirmadas para tocar quedan documentados como fuera de alcance con su razón.

**Placeholder scan:** cada task tiene el texto exacto a buscar/reemplazar, sin "TBD" ni "agregar validación apropiada". Los únicos puntos con verificación-antes-de-aplicar (Task 6 Step 1, Task 9 Step 1, Task 13 Step 1) son casos donde el string exacto depende de una estructura HTML que hay que confirmar en vivo antes de escribir el regex final — están marcados con el comando exacto para esa verificación, no son placeholders de "hazlo después".

**Type consistency:** N/A (no hay tipos compartidos entre tasks más allá de la firma de `sanitizeFramerHtml(html: string): string`, consistente entre Task 13 Steps 1 y 2).
