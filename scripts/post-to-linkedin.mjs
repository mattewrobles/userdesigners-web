// post-to-linkedin.mjs
// Publica en la página de LinkedIn de UserDesigners cada post nuevo que el sync
// acaba de commitear (lee /tmp/new-posts.txt, el mismo registro que usa
// validate-blog-seo.mjs). Si no hay token/URN configurados, sync-blog.yml
// salta este paso entero — nunca rompe el sync.
import fs from "fs";
import https from "https";

const TOKEN = process.env.LINKEDIN_ACCESS_TOKEN;
const ORG_URN = process.env.LINKEDIN_ORG_URN; // ej: "urn:li:organization:12345678"
const SITE = "https://www.userdesigners.com";
const BLOG_DIR = "src/content/blog";

if (!TOKEN || !ORG_URN) {
  console.log("Faltan LINKEDIN_ACCESS_TOKEN o LINKEDIN_ORG_URN — nada que hacer");
  process.exit(0);
}

function parseFrontmatter(content) {
  const fm = content.match(/^---\n([\s\S]*?)\n---/);
  if (!fm) return {};
  const meta = {};
  for (const line of fm[1].split("\n")) {
    const m = line.match(/^([a-zA-Z]+):\s*"?([^"]*)"?$/);
    if (m) meta[m[1]] = m[2];
  }
  return meta;
}

function linkedinPost(text, url) {
  return new Promise((resolve, reject) => {
    const body = JSON.stringify({
      author: ORG_URN,
      lifecycleState: "PUBLISHED",
      specificContent: {
        "com.linkedin.ugc.ShareContent": {
          shareCommentary: { text },
          shareMediaCategory: "ARTICLE",
          media: [{ status: "READY", originalUrl: url }],
        },
      },
      visibility: { "com.linkedin.ugc.MemberNetworkVisibility": "PUBLIC" },
    });
    const req = https.request({
      hostname: "api.linkedin.com",
      path: "/v2/ugcPosts",
      method: "POST",
      headers: {
        Authorization: `Bearer ${TOKEN}`,
        "Content-Type": "application/json",
        "X-Restli-Protocol-Version": "2.0.0",
        "Content-Length": Buffer.byteLength(body),
      },
    }, (res) => {
      let d = "";
      res.on("data", (c) => (d += c));
      res.on("end", () => {
        if (res.statusCode >= 200 && res.statusCode < 300) resolve(d);
        else reject(new Error(`LinkedIn ${res.statusCode}: ${d.slice(0, 300)}`));
      });
    });
    req.on("error", reject);
    req.write(body);
    req.end();
  });
}

async function main() {
  if (!fs.existsSync("/tmp/new-posts.txt")) {
    console.log("No hay /tmp/new-posts.txt — nada nuevo que anunciar");
    return;
  }
  const slugs = fs.readFileSync("/tmp/new-posts.txt", "utf-8").split("\n").map((s) => s.trim()).filter(Boolean);

  for (const slug of slugs) {
    const path = `${BLOG_DIR}/${slug}.md`;
    if (!fs.existsSync(path)) continue; // se pudo excluir por SEO crítico
    const meta = parseFrontmatter(fs.readFileSync(path, "utf-8"));
    const url = `${SITE}/blog/${slug}/`;
    const text = `${meta.title}\n\n${meta.description || ""}\n\nLeer el artículo completo 👇`;
    try {
      await linkedinPost(text, url);
      console.log(`✓ Publicado en LinkedIn: ${slug}`);
    } catch (e) {
      console.log(`✗ Error publicando ${slug} en LinkedIn: ${e.message}`);
    }
  }
}

main().catch((e) => { console.error(e); process.exit(1); });
