// validate-blog-seo.mjs
// Verifica los posts del blog con reglas SEO críticas ANTES de publicar.
// Nunca bloquea el workflow completo: los posts que fallan reglas críticas
// se excluyen del commit (revertidos o eliminados), el resto sigue publicándose.
// Reglas compartidas con qa-check-ready-posts.mjs en lib/seo-rules.mjs.
import fs from "fs";
import path from "path";
import { execSync } from "child_process";
import { checkPost } from "./lib/seo-rules.mjs";

const BLOG_DIR = "src/content/blog";

if (!fs.existsSync(BLOG_DIR)) {
  console.log("No blog dir — skipping validation");
  process.exit(0);
}

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

let criticalCount = 0;
let warningCount = 0;
const skipped = [];

for (const f of files) {
  const slug = path.basename(f, ".md");
  const content = fs.readFileSync(f, "utf-8");
  const { critical, warnings, geoWarnings } = checkPost(slug, content);

  critical.forEach((m) => console.log(`✗ CRÍTICO ${m}`));
  warnings.forEach((m) => console.log(`  ⚠ ${m}`));
  geoWarnings.forEach((m) => console.log(`  🔎 GEO ${m}`));
  criticalCount += critical.length;
  warningCount += warnings.length;

  if (critical.length > 0) {
    skipped.push(slug);
    try {
      execSync(`git checkout HEAD -- "${f}"`, { stdio: "ignore" });
    } catch {
      try { fs.unlinkSync(f); } catch { /* ya no existe, nada que limpiar */ }
    }
  }
}

if (skipped.length > 0) {
  fs.writeFileSync("/tmp/skipped-posts.txt", skipped.join("\n"));
}
console.log(`\nValidados ${files.length} post(s) — ${criticalCount} crítico(s) (excluidos del sync: ${skipped.join(", ") || "ninguno"}), ${warningCount} warning(s)`);
process.exit(0);
