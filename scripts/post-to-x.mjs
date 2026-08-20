// post-to-x.mjs
// Publica en X (Twitter) cada post nuevo que el sync acaba de commitear (lee
// /tmp/new-posts.txt, el mismo registro que usa validate-blog-seo.mjs). Si
// faltan credenciales, el paso se salta solo — nunca rompe el sync.
//
// El access token de X dura solo 2 horas, así que cada run refresca primero
// (grant_type=refresh_token) — X rota el refresh token en cada uso, igual que
// Canva, y el nuevo queda persistido en Doppler antes de publicar nada.
//
// Múltiples cuentas: X_ACCOUNTS (JSON, prioridad) o X_ACCESS_TOKEN/
// X_REFRESH_TOKEN (una sola cuenta, retrocompatible). Cada cuenta necesita su
// propio login OAuth — no hay forma de "compartir" un token entre cuentas.
import fs from "fs";
import https from "https";
import { execSync } from "child_process";
import { GENERIC_PHRASES } from "./lib/seo-rules.mjs";

const X_CLIENT_ID = process.env.X_CLIENT_ID;
const X_CLIENT_SECRET = process.env.X_CLIENT_SECRET;
const TOKENROUTER_KEY = process.env.TOKENROUTER_API_KEY;
const SLACK_BOT_TOKEN = process.env.SLACK_BOT_TOKEN;
const SLACK_CHANNEL = process.env.SLACK_CHANNEL || "C0BN01LMC3F";
const SITE = "https://www.userdesigners.com";
const BLOG_DIR = "src/content/blog";
const MAX_X_POSTS_PER_RUN = 3;

function loadAccounts() {
  if (process.env.X_ACCOUNTS) {
    try {
      const parsed = JSON.parse(process.env.X_ACCOUNTS);
      if (Array.isArray(parsed) && parsed.length > 0) return parsed;
    } catch (e) {
      console.error(`X_ACCOUNTS mal formado (${e.message}) — cae a cuenta única`);
    }
  }
  if (process.env.X_REFRESH_TOKEN) {
    return [{ label: "default", refreshToken: process.env.X_REFRESH_TOKEN, dopplerKey: "X_REFRESH_TOKEN" }];
  }
  return [];
}
const ACCOUNTS = loadAccounts();

if (!X_CLIENT_ID || !X_CLIENT_SECRET || ACCOUNTS.length === 0) {
  console.log("Faltan X_CLIENT_ID/X_CLIENT_SECRET o X_ACCOUNTS/X_REFRESH_TOKEN — nada que hacer");
  process.exit(0);
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

async function notifySlack(text) {
  if (!SLACK_BOT_TOKEN) { console.error(`(sin Slack configurado) ${text}`); return; }
  try {
    await httpJson({
      hostname: "slack.com",
      path: "/api/chat.postMessage",
      method: "POST",
      headers: { Authorization: `Bearer ${SLACK_BOT_TOKEN}`, "Content-Type": "application/json" },
    }, JSON.stringify({ channel: SLACK_CHANNEL, text }));
  } catch (e) {
    console.error(`No se pudo avisar a Slack (${e.message}): ${text}`);
  }
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

// El refresh_token de X ROTA en cada uso, igual que Canva: hay que persistir
// el nuevo en Doppler en cada llamada o el siguiente run se rompe.
async function refreshXToken(account) {
  const basicAuth = Buffer.from(`${X_CLIENT_ID}:${X_CLIENT_SECRET}`).toString("base64");
  const body = new URLSearchParams({ grant_type: "refresh_token", refresh_token: account.refreshToken }).toString();
  const res = await httpJson({
    hostname: "api.x.com",
    path: "/2/oauth2/token",
    method: "POST",
    headers: {
      Authorization: `Basic ${basicAuth}`,
      "Content-Type": "application/x-www-form-urlencoded",
      "Content-Length": Buffer.byteLength(body),
    },
  }, body);
  const parsed = JSON.parse(res);
  if (parsed.refresh_token && parsed.refresh_token !== account.refreshToken && account.dopplerKey) {
    try {
      execSync(`doppler secrets set ${account.dopplerKey} --no-interactive --project user-designers --config prd`, {
        input: parsed.refresh_token,
        env: { ...process.env },
      });
    } catch (e) {
      await notifySlack(`🚨 *X refresh token* (${account.label}) — no se pudo guardar la rotación en Doppler (${e.message}). El próximo run de X puede fallar hasta rehacer el login OAuth.`);
    }
  }
  return parsed.access_token;
}

const SOCIAL_BANNED_PHRASES = [...GENERIC_PHRASES, "descubre cómo", "no te pierdas", "aquí te contamos", "te contamos cómo"];

function stripGeneric(text, fallback) {
  const lower = text.toLowerCase();
  const hit = SOCIAL_BANNED_PHRASES.find((p) => lower.includes(p));
  if (hit) {
    console.log(`⚠ Texto X con frase genérica ("${hit}") — usando fallback`);
    return fallback;
  }
  return text;
}

// Mismos estilos de apertura que LinkedIn (post-to-linkedin.mjs) — se elige
// uno al azar por post para que la FORMA de contar varíe, no solo las palabras.
const HOOK_STYLES = [
  "Pregunta directa que interpela al lector sobre su propia situación (nunca retórica genérica tipo '¿sabías que...?').",
  "Estadística o dato concreto del artículo como primera línea, sin introducción — directo al número.",
  "Mini-anécdota o situación específica de un caso real, contada en 1-2 líneas antes de conectar con el tema.",
  "Afirmación contraintuitiva que desafía una creencia común del lector sobre el tema.",
  "El error más común que la mayoría comete en este tema, nombrado sin rodeos en la primera línea.",
  "Contraste antes/después: cómo se ve el problema sin resolver vs. qué cambia cuando se resuelve bien.",
];
function pickHookStyle() { return HOOK_STYLES[Math.floor(Math.random() * HOOK_STYLES.length)]; }

// Un solo tweet corto (máximo real ~250 caracteres de texto, el resto lo
// ocupa el link que X acorta con t.co) — tono más directo/casual que LinkedIn.
async function generateXCopy(title, body) {
  const fallback = `Nuevo en el blog: ${title}`.slice(0, 200);
  if (!TOKENROUTER_KEY) return fallback;

  const hookStyle = pickHookStyle();
  const prompt = `Eres un copywriter de redes sociales para una agencia B2B de UX/UI Design. Escribe UN tweet corto (máximo 220 caracteres, deja espacio para un link al final) anunciando este artículo.

REGLAS:
- Estilo de apertura para ESTE tweet específicamente: ${hookStyle}
- NUNCA "Descubre cómo...", NUNCA el título literal.
- Tono directo y conversacional, sin hashtags, sin emojis, sin punto final.
- Prohibido: "en la era digital", "revolucionario", "cabe destacar", frases genéricas de post de LinkedIn/redes escrito por IA.

Título: ${title}
Extracto: ${body.slice(0, 1200)}

Responde SOLO con el texto del tweet (sin el link, eso se agrega aparte).`;

  const res = await httpJson({
    hostname: "api.tokenrouter.com",
    path: "/v1/chat/completions",
    method: "POST",
    headers: { Authorization: `Bearer ${TOKENROUTER_KEY}`, "Content-Type": "application/json" },
  }, JSON.stringify({ model: "openai/gpt-4o-mini", messages: [{ role: "user", content: prompt }], max_tokens: 300 }));
  const parsed = JSON.parse(res);
  let text = parsed.choices?.[0]?.message?.content?.trim() || fallback;
  if (text.length > 220) text = text.slice(0, 217).trim() + "...";
  return stripGeneric(text, fallback);
}

function postTweet(text, accessToken) {
  const body = JSON.stringify({ text });
  return httpJson({
    hostname: "api.x.com",
    path: "/2/tweets",
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
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
  const slugs = allSlugs.slice(0, MAX_X_POSTS_PER_RUN);
  if (allSlugs.length > MAX_X_POSTS_PER_RUN) {
    console.log(`⚠ ${allSlugs.length} posts nuevos, tope de ${MAX_X_POSTS_PER_RUN}/run — omitidos sin postear: ${allSlugs.slice(MAX_X_POSTS_PER_RUN).join(", ")}`);
  }

  for (const slug of slugs) {
    const path = `${BLOG_DIR}/${slug}.md`;
    if (!fs.existsSync(path)) continue; // se pudo excluir por SEO crítico
    const content = fs.readFileSync(path, "utf-8");
    const meta = parseFrontmatter(content);
    const url = `${SITE}/blog/${slug}/`;

    let copy;
    try {
      copy = await generateXCopy(meta.title, stripFrontmatter(content));
    } catch (e) {
      await notifySlack(`❌ *X* — error preparando copy para \`${slug}\`: ${e.message}`);
      continue;
    }
    const text = `${copy}\n\n${url}`;

    for (const account of ACCOUNTS) {
      try {
        const accessToken = await refreshXToken(account);
        await postTweet(text, accessToken);
        console.log(`✓ Publicado en X (${account.label}): ${slug}`);
      } catch (e) {
        await notifySlack(`❌ *X* (${account.label}) — error publicando \`${slug}\`: ${e.message}`);
      }
    }
  }
}

main().catch((e) => { console.error(e); process.exit(1); });
