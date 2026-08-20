// validate-blog-seo.mjs
// Verifica los posts del blog con reglas SEO críticas ANTES de publicar.
// Nunca bloquea el workflow completo: los posts que fallan reglas críticas
// se excluyen del commit (revertidos o eliminados), el resto sigue publicándose.
// Reglas compartidas con qa-check-ready-posts.mjs en lib/seo-rules.mjs.
//
// Esta es la ÚNICA fuente de verdad para el Status final en Notion:
// Published si pasa, de vuelta a Ready (con motivo) si no pasa. Nunca queda
// en Notion como Published algo que no llegó realmente al sitio.
import fs from "fs";
import path from "path";
import https from "https";
import { execSync } from "child_process";
import { checkPost, parseFrontmatter } from "./lib/seo-rules.mjs";

const BLOG_DIR = "src/content/blog";
const NOTION_TOKEN = process.env.NOTION_TOKEN;

function notion(notionPath, method, body) {
  return new Promise((resolve, reject) => {
    const data = body ? JSON.stringify(body) : null;
    const req = https.request({
      hostname: "api.notion.com",
      path: notionPath,
      method,
      headers: {
        Authorization: `Bearer ${NOTION_TOKEN}`,
        "Notion-Version": "2022-06-28",
        "Content-Type": "application/json",
        ...(data ? { "Content-Length": Buffer.byteLength(data) } : {}),
      },
    }, (res) => {
      let d = "";
      res.on("data", (c) => (d += c));
      res.on("end", () => resolve({ status: res.statusCode, body: d }));
    });
    req.on("error", reject);
    if (data) req.write(data);
    req.end();
  });
}

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
const skipped = []; // { slug, reasons }
const published = []; // slugs

for (const f of files) {
  const slug = path.basename(f, ".md");
  const content = fs.readFileSync(f, "utf-8");
  const { critical, warnings, geoWarnings } = checkPost(slug, content);
  const { meta } = parseFrontmatter(content) || { meta: {} };

  critical.forEach((m) => console.log(`✗ CRÍTICO ${m}`));
  warnings.forEach((m) => console.log(`  ⚠ ${m}`));
  geoWarnings.forEach((m) => console.log(`  🔎 GEO ${m}`));
  criticalCount += critical.length;
  warningCount += warnings.length;

  if (critical.length > 0) {
    skipped.push({ slug, reasons: critical });
    try {
      execSync(`git checkout HEAD -- "${f}"`, { stdio: "ignore" });
    } catch {
      try { fs.unlinkSync(f); } catch { /* ya no existe, nada que limpiar */ }
    }
    if (NOTION_TOKEN && meta.notionId) {
      try {
        await notion(`/v1/pages/${meta.notionId}`, "PATCH", {
          properties: { Status: { select: { name: "Ready" } } },
        });
        await notion(`/v1/comments`, "POST", {
          parent: { page_id: meta.notionId },
          rich_text: [{ text: { content: `❌ Excluido del sync automático — no cumple SEO crítico: ${critical.join("; ")}` } }],
        });
      } catch (e) {
        console.log(`  ⚠ No se pudo revertir Status en Notion para ${slug}: ${e.message}`);
      }
    }
  } else {
    published.push(slug);
    if (NOTION_TOKEN && meta.notionId) {
      try {
        await notion(`/v1/pages/${meta.notionId}`, "PATCH", {
          properties: { Status: { select: { name: "Published" } } },
        });
      } catch (e) {
        console.log(`  ⚠ No se pudo marcar Published en Notion para ${slug}: ${e.message}`);
      }
    }
  }
}

if (skipped.length > 0) {
  fs.writeFileSync("/tmp/skipped-posts.txt", skipped.map((s) => `${s.slug}: ${s.reasons.join("; ")}`).join("\n"));
}
fs.writeFileSync("/tmp/published-posts.txt", published.join("\n"));
console.log(`\nValidados ${files.length} post(s) — ${published.length} publicado(s) real, ${skipped.length} excluido(s), ${warningCount} warning(s)`);
process.exit(0);
