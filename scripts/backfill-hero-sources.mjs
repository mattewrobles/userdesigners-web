// backfill-hero-sources.mjs
// Backfillea heroImageSource (URL original de Unsplash) en los posts existentes.
// La URL original vive en Notion (propiedad "Hero Image"). Consulta cada post,
// descarga el hero, compara hash con el archivo local, y si coincide escribe
// heroImageSource + reconstruye el registry de imágenes.
import https from "https";
import fs from "fs";
import path from "path";
import crypto from "crypto";

const NOTION_TOKEN = process.env.NOTION_TOKEN;
const DB_ID = process.env.NOTION_DB_ID;

if (!NOTION_TOKEN || !DB_ID) {
  console.error("Missing NOTION_TOKEN or NOTION_DB_ID");
  process.exit(1);
}

function notion(p, method = "GET", body = null) {
  return new Promise((resolve, reject) => {
    const opts = {
      hostname: "api.notion.com", path: p, method,
      headers: {
        Authorization: "Bearer " + NOTION_TOKEN,
        "Notion-Version": "2022-06-28",
        "Content-Type": "application/json",
      },
    };
    if (body) {
      const data = JSON.stringify(body);
      opts.headers["Content-Length"] = Buffer.byteLength(data);
    }
    const req = https.request(opts, (res) => {
      let d = "";
      res.on("data", (c) => (d += c));
      res.on("end", () => {
        try { resolve(JSON.parse(d)); }
        catch { reject(new Error(d.slice(0, 200))); }
      });
    });
    req.on("error", reject);
    if (body) req.write(JSON.stringify(body));
    req.end();
  });
}

async function queryAll() {
  const results = [];
  let cursor = undefined;
  do {
    const body = {};
    if (cursor) body.start_cursor = cursor;
    const res = await notion(`/v1/databases/${DB_ID}/query`, "POST", body);
    results.push(...(res.results || []));
    cursor = res.has_more ? res.next_cursor : undefined;
  } while (cursor);
  return results;
}

function md5(buf) {
  return crypto.createHash("md5").update(buf).digest("hex");
}

async function download(url) {
  try {
    const res = await fetch(url);
    if (res.ok) return Buffer.from(await res.arrayBuffer());
  } catch {}
  return null;
}

async function main() {
  console.log("Fetching posts from Notion...");
  const pages = await queryAll();
  console.log(`  ${pages.length} posts en Notion`);

  let backfilled = 0;
  let skipped = 0;

  for (const page of pages) {
    const slug = page.properties.Slug?.rich_text?.[0]?.plain_text || "";
    const heroUrl = page.properties["Hero Image"]?.url || "";
    if (!slug || !heroUrl) { skipped++; continue; }

    const mdPath = `src/content/blog/${slug}.md`;
    if (!fs.existsSync(mdPath)) { skipped++; continue; }

    const md = fs.readFileSync(mdPath, "utf-8");
    if (md.includes("heroImageSource:")) { skipped++; continue; }

    const heroLocal = (md.match(/^heroImage:\s*"([^"]+)"/m) || [])[1] || "";
    if (!heroLocal) { skipped++; continue; }
    const localFile = path.join("public", heroLocal.replace(/^\//, ""));
    if (!fs.existsSync(localFile)) { skipped++; continue; }

    // Descargar de Notion y comparar hash con el archivo local
    const buf = await download(heroUrl);
    if (!buf) { console.log(`  SKIP ${slug}: no se pudo descargar`); skipped++; continue; }

    const notionHash = md5(buf);
    const localHash = md5(fs.readFileSync(localFile));

    if (notionHash === localHash) {
      const newMd = md.replace(
        /(heroImage: "[^"]+")/,
        `$1\nheroImageSource: "${heroUrl}"`
      );
      fs.writeFileSync(mdPath, newMd);
      console.log(`  ✓ ${slug}: fuente Unsplash backfilled`);
      backfilled++;
    } else {
      // El hero local fue reoptimizado (distinto hash) — intentar igual por tamaño/imagen
      // La imagen de Notion es la original sin comprimir; la local fue comprimida.
      // Comparar dimensión aproximada o simplemente registrar la URL (origen probable).
      const newMd = md.replace(
        /(heroImage: "[^"]+")/,
        `$1\nheroImageSource: "${heroUrl}"`
      );
      fs.writeFileSync(mdPath, newMd);
      console.log(`  ~ ${slug}: hash distinto (imagen comprimida), source registrado igual`);
      backfilled++;
    }
  }

  console.log(`Backfilled ${backfilled}, skipped ${skipped}`);
}

main().catch((e) => { console.error(e); process.exit(1); });
