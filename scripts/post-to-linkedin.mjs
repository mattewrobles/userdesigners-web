// post-to-linkedin.mjs
// Publica en la página de LinkedIn de UserDesigners cada post nuevo que el sync
// acaba de commitear (lee /tmp/new-posts.txt, el mismo registro que usa
// validate-blog-seo.mjs). Si faltan credenciales (LinkedIn o TokenRouter), el
// paso se salta solo — nunca rompe el sync.
//
// Flujo por post: LLM escribe una descripción corta a la medida del tema
// (no copia el meta description, que está optimizado para SEO no para feed
// social) + CTA fija "Lee más en nuestro blog: <url>". La imagen es una card
// generada con el Autofill API de Canva (Brand Template con campos title/
// description/image) usando el heroImage del post como foto de fondo — si
// Canva no está configurado o falla, cae al heroImage plano sin la card.
// La imagen final se sube como asset nativo de LinkedIn (shareMediaCategory
// IMAGE) en vez de depender del scraping de OG tags — control total del visual.
import fs from "fs";
import https from "https";
import { execSync } from "child_process";
import { GENERIC_PHRASES } from "./lib/seo-rules.mjs";

const TOKEN = process.env.LINKEDIN_ACCESS_TOKEN;
const ORG_URN = process.env.LINKEDIN_ORG_URN; // ej: "urn:li:organization:12345678"
const TOKENROUTER_KEY = process.env.TOKENROUTER_API_KEY;
const CANVA_CLIENT_ID = process.env.CANVA_CLIENT_ID;
const CANVA_CLIENT_SECRET = process.env.CANVA_CLIENT_SECRET;
const CANVA_REFRESH_TOKEN = process.env.CANVA_REFRESH_TOKEN;
const CANVA_BRAND_TEMPLATE_ID = process.env.CANVA_BRAND_TEMPLATE_ID;
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
  const prompt = `Escribe UNA sola oración corta (máximo 110 caracteres) para una card de LinkedIn, en español, tono profesional pero cercano, anunciando este artículo de blog de una agencia de diseño UX/UI. NO repitas el título literal. Enfócate en el problema o insight que resuelve. Sin hashtags, sin punto final.

Título: ${title}
Contenido (primeros párrafos): ${body.slice(0, 1500)}

Responde solo con esa oración, nada más.`;

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
  let description = parsed.choices?.[0]?.message?.content?.trim() || `Nuevo artículo en el blog: ${title}.`;
  if (description.length > 130) description = description.slice(0, 127).trim() + "...";
  const lower = description.toLowerCase();
  const genericHit = GENERIC_PHRASES.find((p) => lower.includes(p));
  if (genericHit) {
    console.log(`⚠ Descripción LinkedIn con frase genérica ("${genericHit}") — usando fallback`);
    return `Nuevo artículo en el blog: ${title}.`;
  }
  return description;
}

function downloadBuffer(url) {
  return new Promise((resolve, reject) => {
    https.get(url, (res) => {
      const chunks = [];
      res.on("data", (c) => chunks.push(c));
      res.on("end", () => resolve(Buffer.concat(chunks)));
      res.on("error", reject);
    }).on("error", reject);
  });
}

async function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function getCanvaAccessToken() {
  // El refresh_token de Canva ROTA en cada uso: la respuesta trae uno nuevo y
  // el anterior queda inválido. Hay que persistir el nuevo en Doppler en cada
  // llamada o el siguiente run se rompe con "Refresh token used twice".
  const basicAuth = Buffer.from(`${CANVA_CLIENT_ID}:${CANVA_CLIENT_SECRET}`).toString("base64");
  const body = new URLSearchParams({ grant_type: "refresh_token", refresh_token: CANVA_REFRESH_TOKEN }).toString();
  const res = await httpJson({
    hostname: "api.canva.com",
    path: "/rest/v1/oauth/token",
    method: "POST",
    headers: {
      Authorization: `Basic ${basicAuth}`,
      "Content-Type": "application/x-www-form-urlencoded",
      "Content-Length": Buffer.byteLength(body),
    },
  }, body);
  const parsed = JSON.parse(res);
  if (parsed.refresh_token && parsed.refresh_token !== CANVA_REFRESH_TOKEN) {
    try {
      execSync("doppler secrets set CANVA_REFRESH_TOKEN --no-interactive --project user-designers --config prd", {
        input: parsed.refresh_token,
        env: { ...process.env },
      });
    } catch (e) {
      console.log(`⚠ No se pudo persistir el nuevo CANVA_REFRESH_TOKEN en Doppler: ${e.message}`);
    }
  }
  return parsed.access_token;
}

async function uploadCanvaAsset(accessToken, imageUrl) {
  const imageBuffer = await downloadBuffer(imageUrl);
  const metadata = JSON.stringify({ name_base64: Buffer.from("hero.jpg").toString("base64") });
  const registerRes = JSON.parse(await httpJson({
    hostname: "api.canva.com",
    path: "/rest/v1/asset-uploads",
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/octet-stream",
      "Asset-Upload-Metadata": metadata,
      "Content-Length": imageBuffer.length,
    },
  }, imageBuffer));

  let job = registerRes.job;
  for (let i = 0; i < 15 && job.status === "in_progress"; i++) {
    await sleep(2000);
    const pollRes = JSON.parse(await httpJson({
      hostname: "api.canva.com",
      path: `/rest/v1/asset-uploads/${job.id}`,
      method: "GET",
      headers: { Authorization: `Bearer ${accessToken}` },
    }));
    job = pollRes.job;
  }
  if (job.status !== "success") throw new Error(`Canva asset upload no terminó: ${job.status}`);
  return job.asset.id;
}

async function generateCanvaCard(title, description, heroImageUrl) {
  if (!CANVA_CLIENT_ID || !CANVA_CLIENT_SECRET || !CANVA_REFRESH_TOKEN || !CANVA_BRAND_TEMPLATE_ID) return null;

  const accessToken = await getCanvaAccessToken();
  const assetId = await uploadCanvaAsset(accessToken, heroImageUrl);

  const autofillBody = JSON.stringify({
    brand_template_id: CANVA_BRAND_TEMPLATE_ID,
    data: {
      title: { type: "text", text: title },
      description: { type: "text", text: description },
      image: { type: "image", asset_id: assetId },
    },
  });
  const autofillRes = JSON.parse(await httpJson({
    hostname: "api.canva.com",
    path: "/rest/v1/autofills",
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
      "Content-Length": Buffer.byteLength(autofillBody),
    },
  }, autofillBody));

  let job = autofillRes.job;
  for (let i = 0; i < 15 && job.status === "in_progress"; i++) {
    await sleep(2000);
    const pollRes = JSON.parse(await httpJson({
      hostname: "api.canva.com",
      path: `/rest/v1/autofills/${job.id}`,
      method: "GET",
      headers: { Authorization: `Bearer ${accessToken}` },
    }));
    job = pollRes.job;
  }
  if (job.status !== "success") throw new Error(`Canva autofill no terminó: ${job.status}`);
  const designId = job.result.design.id;

  const exportBody = JSON.stringify({ design_id: designId, format: { type: "png" } });
  const exportRes = JSON.parse(await httpJson({
    hostname: "api.canva.com",
    path: "/rest/v1/exports",
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
      "Content-Length": Buffer.byteLength(exportBody),
    },
  }, exportBody));

  let exportJob = exportRes.job;
  for (let i = 0; i < 15 && exportJob.status === "in_progress"; i++) {
    await sleep(2000);
    const pollRes = JSON.parse(await httpJson({
      hostname: "api.canva.com",
      path: `/rest/v1/exports/${exportJob.id}`,
      method: "GET",
      headers: { Authorization: `Bearer ${accessToken}` },
    }));
    exportJob = pollRes.job;
  }
  if (exportJob.status !== "success") throw new Error(`Canva export no terminó: ${exportJob.status}`);
  return exportJob.urls[0];
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
        const heroUrl = meta.heroImage.startsWith("http") ? meta.heroImage : `${SITE}${meta.heroImage}`;
        let imageUrl = heroUrl;
        try {
          const cardUrl = await generateCanvaCard(meta.title, description, heroUrl);
          if (cardUrl) imageUrl = cardUrl;
        } catch (e) {
          console.log(`⚠ Canva card falló (${e.message}) — uso heroImage plano`);
        }
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
