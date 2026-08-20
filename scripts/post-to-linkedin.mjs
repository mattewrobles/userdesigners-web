// post-to-linkedin.mjs
// Publica en la página de LinkedIn de UserDesigners cada post nuevo que el sync
// acaba de commitear (lee /tmp/new-posts.txt, el mismo registro que usa
// validate-blog-seo.mjs). Si faltan credenciales (LinkedIn o TokenRouter), el
// paso se salta solo — nunca rompe el sync.
//
// Flujo por post: LLM escribe una descripción corta a la medida del tema
// (no copia el meta description, que está optimizado para SEO no para feed
// social) + CTA fija "Lee más en nuestro blog: <url>". La imagen (heroImage
// del post) se sube como asset nativo de LinkedIn (shareMediaCategory IMAGE)
// en vez de depender del scraping de OG tags — control total del visual.
//
// Para reemplazar el heroImage por una card diseñada en Canva: generar la
// imagen vía Canva Autofill API (requiere Canva Connect App + OAuth, ver
// docs/LINKEDIN-DISTRIBUTION.md) y pasar esa URL a uploadImage() en vez de
// meta.heroImage — el resto del flujo no cambia.
import fs from "fs";
import https from "https";
import { GENERIC_PHRASES } from "./lib/seo-rules.mjs";

const TOKEN = process.env.LINKEDIN_ACCESS_TOKEN;
const ORG_URN = process.env.LINKEDIN_ORG_URN; // ej: "urn:li:organization:12345678"
const TOKENROUTER_KEY = process.env.TOKENROUTER_API_KEY;
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

function stripFrontmatter(content) {
  return content.replace(/^---\n[\s\S]*?\n---\n/, "").slice(0, 3000);
}

function httpJson(options, body) {
  return new Promise((resolve, reject) => {
    const req = https.request(options, (res) => {
      let d = "";
      res.on("data", (c) => (d += c));
      res.on("end", () => {
        if (res.statusCode >= 200 && res.statusCode < 300) resolve(d);
        else reject(new Error(`${options.hostname}${options.path} ${res.statusCode}: ${d.slice(0, 300)}`));
      });
    });
    req.on("error", reject);
    if (body) req.write(body);
    req.end();
  });
}

async function generateDescription(title, body) {
  if (!TOKENROUTER_KEY) {
    return `Nuevo artículo en el blog: ${title}.`;
  }
  const prompt = `Escribe un post corto para LinkedIn (máximo 3 líneas, sin hashtags, tono profesional pero cercano, en español) anunciando este artículo de blog de una agencia de diseño UX/UI. NO repitas el título literal. Enfócate en el problema o insight que resuelve.

Título: ${title}
Contenido (primeros párrafos): ${body.slice(0, 1500)}

Responde solo con el texto del post, nada más.`;

  const res = await httpJson({
    hostname: "api.tokenrouter.com",
    path: "/v1/chat/completions",
    method: "POST",
    headers: {
      Authorization: `Bearer ${TOKENROUTER_KEY}`,
      "Content-Type": "application/json",
    },
  }, JSON.stringify({
    model: "openai/gpt-4o-mini",
    messages: [{ role: "user", content: prompt }],
    max_tokens: 300,
  }));
  const parsed = JSON.parse(res);
  const description = parsed.choices?.[0]?.message?.content?.trim() || `Nuevo artículo en el blog: ${title}.`;
  const lower = description.toLowerCase();
  const genericHit = GENERIC_PHRASES.find((p) => lower.includes(p));
  if (genericHit) {
    console.log(`⚠ Descripción LinkedIn con frase genérica ("${genericHit}") — usando fallback`);
    return `Nuevo artículo en el blog: ${title}.`;
  }
  return description;
}

async function uploadImage(imageUrl) {
  // 1. Registrar el upload
  const registerBody = JSON.stringify({
    registerUploadRequest: {
      recipes: ["urn:li:digitalmediaRecipe:feedshare-image"],
      owner: ORG_URN,
      serviceRelationships: [{ relationshipType: "OWNER", identifier: "urn:li:userGeneratedContent" }],
    },
  });
  const registerRes = JSON.parse(await httpJson({
    hostname: "api.linkedin.com",
    path: "/v2/assets?action=registerUpload",
    method: "POST",
    headers: {
      Authorization: `Bearer ${TOKEN}`,
      "Content-Type": "application/json",
      "X-Restli-Protocol-Version": "2.0.0",
      "Content-Length": Buffer.byteLength(registerBody),
    },
  }, registerBody));

  const uploadUrl = registerRes.value.uploadMechanism["com.linkedin.digitalmedia.uploading.MediaUploadHttpRequest"].uploadUrl;
  const asset = registerRes.value.asset;

  // 2. Descargar la imagen origen
  const imageBuffer = await new Promise((resolve, reject) => {
    https.get(imageUrl, (res) => {
      const chunks = [];
      res.on("data", (c) => chunks.push(c));
      res.on("end", () => resolve(Buffer.concat(chunks)));
      res.on("error", reject);
    }).on("error", reject);
  });

  // 3. Subir el binario al uploadUrl que dio LinkedIn
  const uploadHost = new URL(uploadUrl);
  await httpJson({
    hostname: uploadHost.hostname,
    path: uploadHost.pathname + uploadHost.search,
    method: "PUT",
    headers: {
      Authorization: `Bearer ${TOKEN}`,
      "Content-Length": imageBuffer.length,
    },
  }, imageBuffer);

  return asset;
}

function linkedinPost(text, asset) {
  const body = JSON.stringify({
    author: ORG_URN,
    lifecycleState: "PUBLISHED",
    specificContent: {
      "com.linkedin.ugc.ShareContent": {
        shareCommentary: { text },
        shareMediaCategory: "IMAGE",
        media: [{ status: "READY", media: asset }],
      },
    },
    visibility: { "com.linkedin.ugc.MemberNetworkVisibility": "PUBLIC" },
  });
  return httpJson({
    hostname: "api.linkedin.com",
    path: "/v2/ugcPosts",
    method: "POST",
    headers: {
      Authorization: `Bearer ${TOKEN}`,
      "Content-Type": "application/json",
      "X-Restli-Protocol-Version": "2.0.0",
      "Content-Length": Buffer.byteLength(body),
    },
  }, body);
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
    const content = fs.readFileSync(path, "utf-8");
    const meta = parseFrontmatter(content);
    const url = `${SITE}/blog/${slug}/`;
    try {
      const description = await generateDescription(meta.title, stripFrontmatter(content));
      const text = `${description}\n\nLee más en nuestro blog: ${url}`;
      if (meta.heroImage) {
        const imageUrl = meta.heroImage.startsWith("http") ? meta.heroImage : `${SITE}${meta.heroImage}`;
        const asset = await uploadImage(imageUrl);
        await linkedinPost(text, asset);
      } else {
        // sin imagen: cae a share tipo ARTICLE (LinkedIn scrapea el OG tag de la página)
        await httpJson({
          hostname: "api.linkedin.com",
          path: "/v2/ugcPosts",
          method: "POST",
          headers: {
            Authorization: `Bearer ${TOKEN}`,
            "Content-Type": "application/json",
            "X-Restli-Protocol-Version": "2.0.0",
          },
        }, JSON.stringify({
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
        }));
      }
      console.log(`✓ Publicado en LinkedIn: ${slug}`);
    } catch (e) {
      console.log(`✗ Error publicando ${slug} en LinkedIn: ${e.message}`);
    }
  }
}

main().catch((e) => { console.error(e); process.exit(1); });
