// build-image-registry.mjs
// Escanea public/assets/blog y guarda un registro de imágenes usadas.
// Formato:
//   { "byUnsplashId": { "<unsplash-id>": "<archivo>" }, "byHash": { "<md5>": "<archivo>" } }
// El generador consulta byUnsplashId para saltar imágenes ya usadas.
import fs from "fs";
import path from "path";
import crypto from "crypto";

const BLOG_DIR = "public/assets/blog";
const CONTENT_DIR = "src/content/blog";
const OUT = path.join(BLOG_DIR, "used-images.json");

if (!fs.existsSync(BLOG_DIR)) {
  console.log("No blog assets dir");
  process.exit(0);
}

const byUnsplashId = {};
const byHash = {};

// Mapa: archivo de imagen → URL original de Unsplash (desde frontmatter heroImageSource)
const sourceMap = {};
if (fs.existsSync(CONTENT_DIR)) {
  for (const md of fs.readdirSync(CONTENT_DIR).filter((f) => f.endsWith(".md"))) {
    const content = fs.readFileSync(path.join(CONTENT_DIR, md), "utf-8");
    const hero = (content.match(/^heroImage:\s*"([^"]+)"/m) || [])[1] || "";
    const src = (content.match(/^heroImageSource:\s*"([^"]+)"/m) || [])[1] || "";
    if (hero && src) sourceMap[path.basename(hero)] = src;
  }
}

const files = fs
  .readdirSync(BLOG_DIR)
  .filter((f) => /\.(jpe?g|png|webp)$/i.test(f));

for (const f of files) {
  const buf = fs.readFileSync(path.join(BLOG_DIR, f));
  const hash = crypto.createHash("md5").update(buf).digest("hex");
  byHash[hash] = f;
  const src = sourceMap[f];
  const idMatch = src && src.match(/photo-([0-9a-f-]+)/);
  if (idMatch) byUnsplashId[idMatch[1]] = f;
}

const registry = { byUnsplashId, byHash };
fs.writeFileSync(OUT, JSON.stringify(registry, null, 2));
console.log(`Registry: ${Object.keys(byHash).length} hashes, ${Object.keys(byUnsplashId).length} Unsplash ids → ${OUT}`);
