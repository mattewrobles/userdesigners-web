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
  if (words < 250) {
    console.log(`✗ CRÍTICO ${slug}: contenido muy corto (${words} palabras, min 250)`);
    criticalFails++;
  }

  // --- REGLAS SEO (warning, no bloquean) ---
  if (!tags.includes(",")) {
    console.log(`  ⚠ ${slug}: usa 2+ tags (SEO)`);
    warnings++;
  }
  if (!body.includes("## ")) {
    console.log(`  ⚠ ${slug}: sin headings H2 — estructura para SEO`);
    warnings++;
  }
  if (!/!\s*\[/.test(body)) {
    console.log(`  ⚠ ${slug}: sin imágenes en el contenido`);
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
  if (!body.includes("/blog/")) {
    console.log(`  ⚠ ${slug}: sin links internos a otros posts`);
    warnings++;
  }
  // lorem ipsum / placeholders reales
  if (/lorem ipsum|TODO|FIXME|XXX:/i.test(body)) {
    console.log(`  ⚠ ${slug}: contiene lorem ipsum o placeholders`);
    warnings++;
  }
}

console.log(`\nValidados ${files.length} post(s) — ${criticalFails} crítico(s), ${warnings} warning(s)`);
process.exit(criticalFails > 0 ? 1 : 0);
