// validate-blog-seo.mjs
// Verifica los posts del blog con reglas SEO críticas ANTES de publicar.
// Exit 1 (falla el workflow) si un post nuevo no pasa las reglas críticas.
// Uso: node scripts/validate-blog-seo.mjs [slug1] [slug2] ... (si no, valida todos los posts nuevos)
import fs from "fs";
import path from "path";

const BLOG_DIR = "src/content/blog";
const CRITICAL = 1; // exit 1 = bloquear
const WARNING = 0; // solo reportar

if (!fs.existsSync(BLOG_DIR)) {
  console.log("No blog dir — skipping validation");
  process.exit(0);
}

// Solo validar posts nuevos (de /tmp/new-posts.txt del sync) o los pasados como args
let targets = process.argv.slice(2);
if (targets.length === 0 && fs.existsSync("/tmp/new-posts.txt")) {
  targets = fs
    .readFileSync("/tmp/new-posts.txt", "utf-8")
    .split("\n")
    .map((s) => s.trim())
    .filter(Boolean);
}
if (targets.length === 0) {
  console.log("No hay posts nuevos para validar — OK");
  process.exit(0);
}
const files = targets
  .map((t) => `${BLOG_DIR}/${t}.md`)
  .filter((p) => fs.existsSync(p));

let criticalFails = 0;
let warnings = 0;

for (const f of files) {
  const content = fs.readFileSync(f, "utf-8");
  const fm = content.match(/^---\n([\s\S]*?)\n---/);
  if (!fm) { console.log(`✗ ${f}: no frontmatter`); criticalFails++; continue; }

  const slug = path.basename(f, ".md");
  const body = content.replace(/^---\n[\s\S]*?\n---\n/, "");
  const meta = {};
  for (const line of fm[1].split("\n")) {
    const m = line.match(/^([a-zA-Z]+):\s*"?([^"]*)"?$/);
    if (m) meta[m[1]] = m[2];
  }

  const title = meta.title || "";
  const desc = meta.description || "";
  const cat = meta.category || "";
  const hero = meta.heroImage || "";
  const tags = meta.tags || "";
  const words = body.split(/\s+/).filter(Boolean).length;

  // --- RULES CRÍTICAS (bloquean) ---
  if (!title || title.trim().length < 30) {
    console.log(`✗ CRÍTICO ${slug}: title muy corto o ausente (${title.trim().length} chars, min 30)`);
    criticalFails++;
  }
  if (title.length > 65) {
    console.log(`✗ CRÍTICO ${slug}: title muy largo (${title.length}, max 65)`);
    criticalFails++;
  }
  if (!desc || desc.trim().length < 120) {
    console.log(`✗ CRÍTICO ${slug}: meta description ausente o muy corta (${desc.trim().length}, min 120)`);
    criticalFails++;
  }
  if (desc.length > 160) {
    console.log(`✗ CRÍTICO ${slug}: meta description muy larga (${desc.length}, max 160)`);
    criticalFails++;
  }
  if (!cat) {
    console.log(`✗ CRÍTICO ${slug}: falta categoría`);
    criticalFails++;
  }
  if (!hero) {
    console.log(`✗ CRÍTICO ${slug}: falta heroImage`);
    criticalFails++;
  }
  // Longitud: posts competitivos 1500-2500 palabras (estándar Airpals/Backlinko)
  if (words < 1500) {
    console.log(`✗ CRÍTICO ${slug}: contenido demasiado corto (${words} palabras, min 1500). Un post competitivo requiere 1500-2500.`);
    criticalFails++;
  }
  // Estructura de post largo (estándar Airpals)
  if (!body.includes("## ")) {
    console.log(`✗ CRÍTICO ${slug}: sin headings H2 — estructura para SEO`);
    criticalFails++;
  }
  const h2Count = (body.match(/^## /gm) || []).length;
  if (h2Count < 4) {
    console.log(`✗ CRÍTICO ${slug}: solo ${h2Count} secciones H2 (mínimo 4-6 para post largo)`);
    criticalFails++;
  }
  // Capa de verificación de calidad (anti-genérico)
  const GENERIC_PHRASES = [
    "en la era digital", "mundo competitivo", "soluciones innovadoras",
    "potenciar", "impulsar", "en el mundo actual", "cada vez más",
    "en este artículo", "exploraremos", "sumérgete", "revolucionar",
    "sin duda", "es fundamental", "juego de palabras", "clave del éxito",
  ];
  const genericHits = GENERIC_PHRASES.filter(p => body.toLowerCase().includes(p));
  if (genericHits.length > 0) {
    console.log(`✗ CRÍTICO ${slug}: contenido genérico detectado — ${genericHits.join(", ")}`);
    criticalFails++;
  }
  // Frases meta-instrucción que se cuelan del prompt (hablan de la estructura, no del tema)
  const META_PHRASES = [
    "un buen post", "en esta guía cubriremos", "aquí te explicaré", "a continuación te",
    "el siguiente post", "este artículo te", "termina con faq", "te mostraré cómo",
  ];
  const metaHits = META_PHRASES.filter(p => body.toLowerCase().includes(p));
  if (metaHits.length > 0) {
    console.log(`✗ CRÍTICO ${slug}: frases meta-instrucción coladas del prompt — ${metaHits.join(", ")}`);
    criticalFails++;
  }
  // placeholders reales: "lorem ipsum" o TODO/FIXME en mayúsculas (siglas de código)
  if (/lorem ipsum/i.test(body) || /(?:^|[^a-záéíóúüñ])TODO(?:[^a-záéíóúüñ]|$)/.test(body) || /XXX:/.test(body)) {
    console.log(`✗ CRÍTICO ${slug}: contiene lorem ipsum o placeholders`);
    criticalFails++;
  }

  // --- REGLAS SEO (warning, no bloquean) ---
  if (!tags.includes(",")) {
    console.log(`  ⚠ ${slug}: usa 2+ tags (SEO)`);
    warnings++;
  }
  const imgCount = (body.match(/!\[/g) || []).length;
  if (imgCount < 2) {
    console.log(`  ⚠ ${slug}: solo ${imgCount} imagen(es). Un post largo necesita 2-4 imágenes con alt text`);
    warnings++;
  }
  if (!/^!\[[^\]]{5,}\]/.test(body)) {
    console.log(`  ⚠ ${slug}: imágenes sin alt text descriptivo`);
    warnings++;
  }
  // keywords de la categoría en el title/body
  const kwMap = {
    "Design Systems": "design system",
    "UX Research": "usuario|research|entrevista",
    "Product Design": "producto|app",
    "UX Writing": "texto|copy",
    "Accesibilidad": "accesib",
    "Estrategia de Producto": "estrategia|roadmap",
  };
  const kw = (kwMap[cat] || "").toLowerCase();
  if (kw && !new RegExp(kw).test((title + " " + body).toLowerCase())) {
    console.log(`  ⚠ ${slug}: categoría "${cat}" pero sin keywords ("${kw}")`);
    warnings++;
  }
  // links internos
  const internalLinks = (body.match(/\/blog\//g) || []).length;
  if (internalLinks < 2) {
    console.log(`  ⚠ ${slug}: solo ${internalLinks} links internos (mínimo 2-3 para SEO)`);
    warnings++;
  }
  // link externo a fuente de autoridad (E-E-A-T)
  if (!/https:\/\/(www\.)?(nngroup\.com|interaction-design\.org|usability\.gov|baymard\.com|smashingmagazine\.com|alistapart\.com)/.test(body)) {
    console.log(`  ⚠ ${slug}: sin link externo a fuente de autoridad (nngroup, IxDF, etc.) — refuerza E-E-A-T`);
    warnings++;
  }
  // FAQ para featured snippets
  if (!/preguntas frecuentes|faq/i.test(body) && !/^##/m.test(body)) {
    console.log(`  ⚠ ${slug}: sin sección de preguntas frecuentes (FAQ) — ayuda al featured snippet`);
    warnings++;
  }
  // tablas para datos comparativos (estructura Airpals)
  const tableCount = (body.match(/\|/g) || []).length;
  if (tableCount < 10) {
    console.log(`  ⚠ ${slug}: sin tablas markdown (estructura Airpals usa tablas comparativas)`);
    warnings++;
  }
  // checklist accionable
  if (!/checklist|puntos clave|lista de verificaci/i.test(body)) {
    console.log(`  ⚠ ${slug}: sin bloque checklist/puntos clave accionable`);
    warnings++;
  }
}

console.log(`\nValidados ${files.length} post(s) — ${criticalFails} crítico(s), ${warnings} warning(s)`);
process.exit(criticalFails > 0 ? 1 : 0);
