// post-to-linkedin.mjs
// Publica en la página de LinkedIn de UserDesigners cada post nuevo que el sync
// acaba de commitear (lee /tmp/new-posts.txt, el mismo registro que usa
// validate-blog-seo.mjs). Si faltan credenciales (LinkedIn o TokenRouter), el
// paso se salta solo — nunca rompe el sync.
//
// Flujo por post: un LLM escribe DOS textos con una sola llamada — un post
// nativo de LinkedIn (gancho + mini-historia, 2-4 líneas) y una línea corta
// separada para la card de Canva (que no crece con el texto). El post no
// copia el meta description, que está optimizado para SEO no para feed
// social + CTA fija "Lee más en nuestro blog: <url>". La imagen es una card
// generada con el Autofill API de Canva (Brand Template con campos title/
// description/image) usando el heroImage del post como foto de fondo — si
// Canva no está configurado o falla, cae al heroImage plano sin la card.
// La imagen final se sube como asset nativo de LinkedIn (shareMediaCategory
// IMAGE) en vez de depender del scraping de OG tags — control total del visual.
import fs from "fs";
import https from "https";
import { execSync } from "child_process";
import { GENERIC_PHRASES } from "./lib/seo-rules.mjs";

// Múltiples cuentas: LINKEDIN_ACCOUNTS (JSON, prioridad) o LINKEDIN_ACCESS_TOKEN/
// LINKEDIN_ORG_URN (una sola cuenta, retrocompatible). Cada cuenta necesita su
// propio login OAuth — no hay forma de "compartir" un token entre cuentas.
// Formato de LINKEDIN_ACCOUNTS: [{"label":"Mauricio","token":"...","urn":"urn:li:person:..."}]
function loadAccounts() {
  if (process.env.LINKEDIN_ACCOUNTS) {
    try {
      const parsed = JSON.parse(process.env.LINKEDIN_ACCOUNTS);
      if (Array.isArray(parsed) && parsed.length > 0) return parsed;
    } catch (e) {
      console.error(`LINKEDIN_ACCOUNTS mal formado (${e.message}) — cae a cuenta única`);
    }
  }
  if (process.env.LINKEDIN_ACCESS_TOKEN && process.env.LINKEDIN_ORG_URN) {
    return [{ label: "default", token: process.env.LINKEDIN_ACCESS_TOKEN, urn: process.env.LINKEDIN_ORG_URN }];
  }
  return [];
}
const ACCOUNTS = loadAccounts();
const TOKENROUTER_KEY = process.env.TOKENROUTER_API_KEY;
const CANVA_CLIENT_ID = process.env.CANVA_CLIENT_ID;
const CANVA_CLIENT_SECRET = process.env.CANVA_CLIENT_SECRET;
const CANVA_REFRESH_TOKEN = process.env.CANVA_REFRESH_TOKEN;
const SLACK_BOT_TOKEN = process.env.SLACK_BOT_TOKEN;
const SLACK_CHANNEL = process.env.SLACK_CHANNEL || "C0BN01LMC3F";

// Nunca dejar un fallo de Canva/LinkedIn en silencio — si Slack no está
// configurado, cae a console.error (nunca rompe el flujo por un aviso).
async function notifySlack(text) {
  if (!SLACK_BOT_TOKEN) { console.error(`(sin Slack configurado) ${text}`); return; }
  try {
    await httpJson({
      hostname: "slack.com",
      path: "/api/chat.postMessage",
      method: "POST",
      headers: {
        Authorization: `Bearer ${SLACK_BOT_TOKEN}`,
        "Content-Type": "application/json",
      },
    }, JSON.stringify({ channel: SLACK_CHANNEL, text }));
  } catch (e) {
    console.error(`No se pudo avisar a Slack (${e.message}): ${text}`);
  }
}
// Lista separada por comas — se elige uno al azar por post para variar el look
// (light, dark original, dark v2) en vez de repetir siempre el mismo template.
const CANVA_BRAND_TEMPLATE_IDS = (process.env.CANVA_BRAND_TEMPLATE_ID || "")
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean);
const SITE = "https://www.userdesigners.com";
const BLOG_DIR = "src/content/blog";
// Tope de seguridad: si un sync/regeneración masiva libera muchos posts de
// golpe, nunca spamear LinkedIn — solo los primeros N se postean, el resto
// se reporta como omitido (nunca silencioso).
const MAX_LINKEDIN_POSTS_PER_RUN = 3;

if (ACCOUNTS.length === 0) {
  console.log("Faltan LINKEDIN_ACCOUNTS o LINKEDIN_ACCESS_TOKEN/LINKEDIN_ORG_URN — nada que hacer");
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

// Genera dos textos distintos con UNA sola llamada al LLM:
// - postHook: el post nativo de LinkedIn (gancho + historia corta), va ANTES del CTA fijo
// - cardLine: una sola línea corta para la card de Canva (espacio limitado, no crece con el texto)
function stripGeneric(text, fallback) {
  const lower = text.toLowerCase();
  const hit = GENERIC_PHRASES.find((p) => lower.includes(p));
  if (hit) {
    console.log(`⚠ Texto LinkedIn con frase genérica ("${hit}") — usando fallback`);
    return fallback;
  }
  return text;
}

async function generateLinkedInCopy(title, body) {
  const fallbackHook = `Nuevo artículo en el blog.`;
  const fallbackCard = `Nuevo artículo: ${title}`.slice(0, 130);
  if (!TOKENROUTER_KEY) return { postHook: fallbackHook, cardLine: fallbackCard };

  const prompt = `Eres un copywriter senior de redes sociales especializado en SEO/social writing para agencias B2B de UX/UI Design. Escribe el copy para publicar este artículo de blog en LinkedIn.

REGLAS PARA "post_hook" (el cuerpo del post, va justo ANTES de un link fijo que ya viene aparte — no lo repitas ni escribas "lee más"):
- Abre con un gancho que describe una situación real y reconocible del lector (una frustración, un error común, una pregunta directa) — NUNCA "Descubre cómo...", NUNCA resume el título literal, NUNCA "En este artículo".
- 2-4 líneas cortas, cada una en su propio párrafo (así se lee un post nativo de LinkedIn, no un anuncio).
- Cuenta una mini-historia o tensión concreta ANTES de insinuar la solución — la propuesta de valor tiene que sentirse, no solo mencionarse.
- Tono profesional pero conversacional, primera persona plural ocasional ("en nuestra experiencia..."), sin jerga corporativa, sin emojis, sin hashtags, sin punto final en la última línea.
- Prohibido: "en la era digital", "revolucionario", "cabe destacar", "sin duda", "por supuesto", cualquier frase que suene a post genérico escrito por IA.

REGLAS PARA "card_line" (una sola oración, máximo 110 caracteres, para una card visual — el espacio NO crece, así que tiene que ser corta y con gancho):
- Enfócate en el problema o insight central, no en el título literal.
- Sin hashtags, sin punto final.

Título del artículo: ${title}
Extracto del artículo: ${body.slice(0, 1500)}

Responde SOLO con JSON: { "post_hook": "...", "card_line": "..." }`;

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
    max_tokens: 500,
    response_format: { type: "json_object" },
  }));
  const parsed = JSON.parse(res);
  let raw = { post_hook: fallbackHook, card_line: fallbackCard };
  try { raw = JSON.parse(parsed.choices?.[0]?.message?.content || "{}"); } catch { /* usar fallback */ }

  let postHook = stripGeneric((raw.post_hook || "").trim() || fallbackHook, fallbackHook);
  let cardLine = stripGeneric((raw.card_line || "").trim() || fallbackCard, fallbackCard);
  if (cardLine.length > 130) cardLine = cardLine.slice(0, 127).trim() + "...";
  return { postHook, cardLine };
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
      // Crítico: el refresh token de Canva es de un solo uso — si esto falla,
      // el token guardado en Doppler queda inválido y TODOS los runs
      // siguientes van a fallar al pedir uno nuevo, hasta rehacer el login
      // OAuth manualmente. Nunca dejarlo en un console.log que nadie ve.
      await notifySlack(`🚨 *Canva refresh token* — no se pudo guardar la rotación en Doppler (${e.message}). El próximo post de LinkedIn puede fallar sin card hasta rehacer el login OAuth de Canva.`);
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
  if (!CANVA_CLIENT_ID || !CANVA_CLIENT_SECRET || !CANVA_REFRESH_TOKEN || CANVA_BRAND_TEMPLATE_IDS.length === 0) return null;

  const brandTemplateId = CANVA_BRAND_TEMPLATE_IDS[Math.floor(Math.random() * CANVA_BRAND_TEMPLATE_IDS.length)];
  console.log(`Card Canva: usando template ${brandTemplateId}`);
  const accessToken = await getCanvaAccessToken();
  const assetId = await uploadCanvaAsset(accessToken, heroImageUrl);

  const autofillBody = JSON.stringify({
    brand_template_id: brandTemplateId,
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

async function uploadImage(imageUrl, token, orgUrn) {
  // 1. Registrar el upload
  const registerBody = JSON.stringify({
    registerUploadRequest: {
      recipes: ["urn:li:digitalmediaRecipe:feedshare-image"],
      owner: orgUrn,
      serviceRelationships: [{ relationshipType: "OWNER", identifier: "urn:li:userGeneratedContent" }],
    },
  });
  const registerRes = JSON.parse(await httpJson({
    hostname: "api.linkedin.com",
    path: "/v2/assets?action=registerUpload",
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
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
      Authorization: `Bearer ${token}`,
      "Content-Length": imageBuffer.length,
    },
  }, imageBuffer);

  return asset;
}

function linkedinPost(text, asset, token, orgUrn) {
  const body = JSON.stringify({
    author: orgUrn,
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
      Authorization: `Bearer ${token}`,
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
  const allSlugs = fs.readFileSync("/tmp/new-posts.txt", "utf-8").split("\n").map((s) => s.trim()).filter(Boolean);
  const slugs = allSlugs.slice(0, MAX_LINKEDIN_POSTS_PER_RUN);
  if (allSlugs.length > MAX_LINKEDIN_POSTS_PER_RUN) {
    console.log(`⚠ ${allSlugs.length} posts nuevos, tope de ${MAX_LINKEDIN_POSTS_PER_RUN}/run — omitidos sin postear: ${allSlugs.slice(MAX_LINKEDIN_POSTS_PER_RUN).join(", ")}`);
  }

  for (const slug of slugs) {
    const path = `${BLOG_DIR}/${slug}.md`;
    if (!fs.existsSync(path)) continue; // se pudo excluir por SEO crítico
    const content = fs.readFileSync(path, "utf-8");
    const meta = parseFrontmatter(content);
    const url = `${SITE}/blog/${slug}/`;

    // Copy + card se generan UNA vez por post (no por cuenta) — el mismo
    // contenido se publica en todas las cuentas configuradas.
    let postHook, cardLine, imageUrl;
    try {
      ({ postHook, cardLine } = await generateLinkedInCopy(meta.title, stripFrontmatter(content)));
      imageUrl = meta.heroImage ? (meta.heroImage.startsWith("http") ? meta.heroImage : `${SITE}${meta.heroImage}`) : null;
      if (imageUrl) {
        try {
          const cardUrl = await generateCanvaCard(meta.title, cardLine, imageUrl);
          if (cardUrl) imageUrl = cardUrl;
        } catch (e) {
          await notifySlack(`⚠️ *Canva card* falló para \`${slug}\` (${e.message}) — publicando con foto plana en vez de la card con marca.`);
        }
      }
    } catch (e) {
      await notifySlack(`❌ *LinkedIn* — error preparando copy/imagen para \`${slug}\`: ${e.message}`);
      continue;
    }
    const text = `${postHook}\n\nLee más en nuestro blog: ${url}`;

    for (const account of ACCOUNTS) {
      const { label, token, urn } = account;
      try {
        if (imageUrl) {
          const asset = await uploadImage(imageUrl, token, urn);
          await linkedinPost(text, asset, token, urn);
        } else {
          // sin imagen: cae a share tipo ARTICLE (LinkedIn scrapea el OG tag de la página)
          await httpJson({
            hostname: "api.linkedin.com",
            path: "/v2/ugcPosts",
            method: "POST",
            headers: {
              Authorization: `Bearer ${token}`,
              "Content-Type": "application/json",
              "X-Restli-Protocol-Version": "2.0.0",
            },
          }, JSON.stringify({
            author: urn,
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
        console.log(`✓ Publicado en LinkedIn (${label}): ${slug}`);
      } catch (e) {
        await notifySlack(`❌ *LinkedIn* (${label}) — error publicando \`${slug}\`: ${e.message}`);
      }
    }
  }
}

main().catch((e) => { console.error(e); process.exit(1); });
