// fix-ready-drafts.mjs
// Regenera posts en Status=Ready que quedaron excluidos del sync por SEO/anti-slop
// (título muy largo, contenido corto, frases genéricas). A diferencia de
// regenerate-published-posts.mjs (que preserva título/slug por SEO ya indexado),
// estos posts nunca se publicaron: el título SÍ se puede regenerar más corto.
//
// Uso: node scripts/fix-ready-drafts.mjs slug1 slug2

import fs from "fs";

const NOTION_TOKEN = process.env.NOTION_TOKEN;
const DB_ID = process.env.NOTION_DB_ID;
const TOKENROUTER_KEY = process.env.TOKENROUTER_API_KEY;
const UNSPLASH_KEY = process.env.UNSPLASH_ACCESS_KEY;
for (const [n, v] of Object.entries({ NOTION_TOKEN, DB_ID, TOKENROUTER_KEY, UNSPLASH_KEY })) {
  if (!v) { console.error(`Missing env var: ${n}`); process.exit(1); }
}
const TARGET_SLUGS = process.argv.slice(2);
if (TARGET_SLUGS.length === 0) { console.error("Usage: node scripts/fix-ready-drafts.mjs slug1 slug2"); process.exit(1); }

async function notionFetch(path, method = "GET", body = null) {
  const res = await fetch(`https://api.notion.com${path}`, {
    method,
    headers: { Authorization: `Bearer ${NOTION_TOKEN}`, "Notion-Version": "2022-06-28", "Content-Type": "application/json" },
    body: body ? JSON.stringify(body) : undefined,
  });
  const json = await res.json();
  if (!res.ok) throw new Error(`Notion ${method} ${path} -> ${res.status}: ${JSON.stringify(json).slice(0, 300)}`);
  return json;
}
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const LLM_MIN_GAP_MS = 32000;
let lastLLMCallAt = 0;
async function callLLM(messages, model, maxTokens = 6000) {
  const wait = LLM_MIN_GAP_MS - (Date.now() - lastLLMCallAt);
  if (wait > 0) await sleep(wait);
  let lastErr;
  for (let attempt = 0; attempt < 4; attempt++) {
    lastLLMCallAt = Date.now();
    try {
      const res = await fetch("https://api.tokenrouter.com/v1/chat/completions", {
        method: "POST",
        headers: { Authorization: `Bearer ${TOKENROUTER_KEY}`, "Content-Type": "application/json" },
        body: JSON.stringify({ model, messages, temperature: 0.7, max_tokens: maxTokens, response_format: { type: "json_object" } }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(`TokenRouter ${res.status}: ${JSON.stringify(json).slice(0, 300)}`);
      return json;
    } catch (e) { lastErr = e; await sleep(LLM_MIN_GAP_MS); }
  }
  throw lastErr;
}
function extractJson(raw) {
  const m = raw.match(/\{[\s\S]*\}/);
  if (!m) throw new Error("No JSON in AI response: " + raw.slice(0, 200));
  return JSON.parse(m[0]);
}

const BANNED_PHRASES = [
  "en la era digital", "mundo competitivo", "soluciones innovadoras", "potenciar", "impulsar",
  "en el mundo actual", "cada vez más", "en este artículo", "exploraremos", "sumérgete", "revolucionar",
  "sin duda", "es fundamental", "juego de palabras", "clave del éxito",
  "un buen post", "en esta guía cubriremos", "aquí te explicaré", "a continuación te",
  "el siguiente post", "este artículo te", "termina con faq", "te mostraré cómo",
  "además,", "es importante destacar", "cabe mencionar", "vale la pena señalar", "en el mundo de hoy", "por supuesto",
];
function stripBannedPhrases(text) {
  let out = text;
  for (const phrase of BANNED_PHRASES) {
    out = out.replace(new RegExp(phrase.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "gi"), "");
  }
  return out.replace(/[ \t]{2,}/g, " ").replace(/\s+([.,;:])/g, "$1").replace(/\n{3,}/g, "\n\n");
}
function clampDescription(desc, title) {
  let d = (desc || "").trim();
  if (d.length > 160) d = d.slice(0, 157).replace(/\s+\S*$/, "") + "...";
  if (d.length < 120) d = `${d} ${title || ""}`.trim().slice(0, 160);
  return d;
}

const SYSTEM_PROMPT = `Eres el editor de contenido de UserDesigners, agencia de UX/UI Design en Cuenca, Ecuador.
Escribes blogs B2B para fundadores, product managers y CTOs en Latam.

REGLAS ESTRICTAS:
- Título: máximo 65 caracteres, directo, sin clickbait genérico.
- Abre con un hook directo que identifica un problema real del lector (NUNCA "En este artículo", NUNCA "Hola,")
- Secciones cortas con H2 (## Título), mínimo 4-6 secciones.
- NUNCA estadísticas inventadas.
- NUNCA frases prohibidas: "en la era digital", "mundo competitivo", "soluciones innovadoras", "potenciar", "impulsar", "sin duda", "es fundamental", "por supuesto", "cabe mencionar", "vale la pena señalar", "en este artículo"
- Longitud: 1500-2200 palabras.
- Cierra el cuerpo con "## Preguntas frecuentes" (3-4 preguntas en **negrita**, respuesta en texto plano).

OUTPUT — SOLO JSON: { "title": "...", "description": "...", "content": "markdown del artículo" }`;

const CRITIC_PROMPT = `Eres un editor senior de UX. Revisa este borrador y mejóralo: elimina relleno y frases prohibidas,
verifica 1500-2200 palabras, asegura FAQ con preguntas en negrita.
OUTPUT: { "critique": "...", "improved_content": "contenido mejorado completo en markdown", "score": 1-10 }`;

async function generateDraft(topic, category) {
  const messages = [
    { role: "system", content: SYSTEM_PROMPT },
    { role: "user", content: `Reescribe (expande, corrigiendo problemas de SEO) el blog post para UserDesigners sobre: "${topic}". Categoría: ${category}.` },
  ];
  for (let attempt = 0; attempt < 2; attempt++) {
    const res = await callLLM(messages, "google/gemini-3.5-flash-lite");
    try { return extractJson(res.choices?.[0]?.message?.content || ""); } catch (e) { if (attempt === 1) throw e; }
  }
}
async function critique(title, content) {
  const res = await callLLM([
    { role: "system", content: CRITIC_PROMPT },
    { role: "user", content: `Título: ${title}\n\n${content}` },
  ], "google/gemini-3.5-flash-lite");
  try { return extractJson(res.choices?.[0]?.message?.content || ""); } catch { return { improved_content: null }; }
}
async function searchUnsplash(query) {
  const res = await fetch(`https://api.unsplash.com/search/photos?query=${encodeURIComponent(query)}&per_page=10&orientation=landscape`, {
    headers: { Authorization: `Client-ID ${UNSPLASH_KEY}` },
  });
  return (await res.json()).results || [];
}
function loadUsedImages() {
  try { return new Set(JSON.parse(fs.readFileSync("public/assets/blog/used-images.json", "utf-8")).unsplashIds || []); }
  catch { return new Set(); }
}

function markdownToBlocks(md) {
  // idéntico a regenerate-published-posts.mjs
  function parseInline(text) {
    const linkRegex = /\[([^\]]+)\]\(([^)]+)\)/g;
    const segments = []; let lastIndex = 0, match;
    while ((match = linkRegex.exec(text)) !== null) {
      if (match.index > lastIndex) segments.push({ text: text.slice(lastIndex, match.index) });
      segments.push({ text: match[1], link: match[2] });
      lastIndex = match.index + match[0].length;
    }
    if (lastIndex < text.length) segments.push({ text: text.slice(lastIndex) });
    const rich = [];
    for (const seg of segments) {
      const parts = seg.text.split(/(\*\*[^*]+\*\*)/g).filter(Boolean);
      for (const part of parts) {
        const boldMatch = part.match(/^\*\*([^*]+)\*\*$/);
        const content = boldMatch ? boldMatch[1] : part;
        if (!content) continue;
        const validLink = seg.link && /^https?:\/\/[^\s]+$/.test(seg.link) ? seg.link : null;
        rich.push({ type: "text", text: { content, link: validLink ? { url: validLink } : null },
          annotations: { bold: !!boldMatch, italic: false, strikethrough: false, underline: false, code: false, color: "default" } });
      }
    }
    return rich.length ? rich : [{ type: "text", text: { content: text || "" },
      annotations: { bold: false, italic: false, strikethrough: false, underline: false, code: false, color: "default" } }];
  }
  const lines = md.split("\n"); const blocks = []; let i = 0;
  while (i < lines.length) {
    const t = lines[i].trim();
    if (!t) { i++; continue; }
    const imgMatch = t.match(/^!\[([^\]]*)\]\(([^)]+)\)$/);
    if (/^(-{3,}|\*{3,}|_{3,})$/.test(t)) { blocks.push({ object: "block", type: "divider", divider: {} }); i++; continue; }
    if (imgMatch) { blocks.push({ object: "block", type: "image", image: { type: "external", external: { url: imgMatch[2] } } }); i++; continue; }
    if (t.startsWith("## ")) { blocks.push({ object: "block", type: "heading_2", heading_2: { rich_text: parseInline(t.slice(3)) } }); i++; continue; }
    if (t.startsWith("### ")) { blocks.push({ object: "block", type: "heading_3", heading_3: { rich_text: parseInline(t.slice(4)) } }); i++; continue; }
    if (t.startsWith("- ") || t.startsWith("* ")) { blocks.push({ object: "block", type: "bulleted_list_item", bulleted_list_item: { rich_text: parseInline(t.slice(2)) } }); i++; continue; }
    const numMatch = t.match(/^\d+\.\s+(.*)$/);
    if (numMatch) { blocks.push({ object: "block", type: "numbered_list_item", numbered_list_item: { rich_text: parseInline(numMatch[1]) } }); i++; continue; }
    blocks.push({ object: "block", type: "paragraph", paragraph: { rich_text: parseInline(t) } });
    i++;
  }
  return blocks;
}

const CATEGORY_TAGS = {
  "UX Design": ["UX Design", "UX"], "UX Research": ["UX Research", "Research"],
  "UX Writing": ["UX Writing", "Content"], "UI Design": ["UI Design"],
  "Design Systems": ["Design Systems", "UI Design"], "Product Design": ["Product Design", "UX Design"],
  "Branding": ["Branding"], "SEO": ["SEO", "IA"],
};

async function main() {
  console.log("Fetching Ready posts from Notion...");
  const data = await notionFetch(`/v1/databases/${DB_ID}/query`, "POST", {
    filter: { property: "Status", select: { equals: "Ready" } }, page_size: 100,
  });
  const pages = (data.results || []).filter((p) => TARGET_SLUGS.includes(p.properties.Slug?.rich_text?.[0]?.plain_text || ""));
  console.log(`Found ${pages.length}/${TARGET_SLUGS.length} target slug(s)`);

  const usedImageIds = loadUsedImages();
  const today = new Date().toISOString().slice(0, 10);

  for (const page of pages) {
    const props = page.properties;
    const origTitle = props.Title?.title?.[0]?.plain_text || "";
    const slug = props.Slug?.rich_text?.[0]?.plain_text || "";
    const category = props.Category?.select?.name || "UX Design";
    console.log(`\n=== ${slug} (orig title: "${origTitle}") ===`);
    try {
      console.log("  generando...");
      let draft = await generateDraft(origTitle, category);
      console.log("  autocrítica...");
      const crit = await critique(draft.title, draft.content);
      let finalContent = (crit.improved_content && crit.improved_content !== draft.content) ? crit.improved_content : draft.content;
      finalContent = stripBannedPhrases(finalContent);
      let finalTitle = (draft.title || origTitle).trim();
      if (finalTitle.length > 65) finalTitle = finalTitle.slice(0, 62).replace(/\s+\S*$/, "") + "...";
      const description = clampDescription(stripBannedPhrases(draft.description || ""), finalTitle);

      const wordCount = finalContent.split(/\s+/).filter(Boolean).length;
      console.log(`  título final: "${finalTitle}" (${finalTitle.length} chars), ${wordCount} palabras`);

      console.log("  buscando imágenes...");
      const photos = await searchUnsplash(category);
      const unused = photos.filter((p) => !usedImageIds.has(p.id));
      const pool = unused.length > 0 ? unused : photos;
      const heroPhoto = pool[0]; const inlinePhotos = pool.slice(1, 3);
      [heroPhoto, ...inlinePhotos].forEach((p) => p && usedImageIds.add(p.id));
      const toUrl = (p) => `${p.urls.raw}&w=1600&h=900&fit=crop`;
      let contentWithImages = finalContent;
      if (inlinePhotos.length > 0) {
        const lines = contentWithImages.split("\n");
        const h2Idx = lines.map((l, idx) => (l.trim().startsWith("## ") ? idx : -1)).filter((idx) => idx >= 0);
        if (h2Idx.length >= 2) {
          const positions = inlinePhotos.length === 2
            ? [h2Idx[Math.floor(h2Idx.length / 3)], h2Idx[Math.floor((h2Idx.length * 2) / 3)]]
            : [h2Idx[Math.floor(h2Idx.length / 2)]];
          [...new Set(positions)].sort((a, b) => b - a).forEach((pos, idx, arr) => {
            const img = inlinePhotos[arr.length - 1 - idx];
            if (img) lines.splice(pos, 0, `![${finalTitle}](${toUrl(img)})`, "");
          });
          contentWithImages = lines.join("\n");
        }
      }
      const heroImageUrl = heroPhoto ? toUrl(heroPhoto) : (props["Hero Image"]?.url || "");

      console.log("  actualizando Notion...");
      const existing = await notionFetch(`/v1/blocks/${page.id}/children?page_size=100`);
      for (const b of existing.results || []) await notionFetch(`/v1/blocks/${b.id}`, "DELETE").catch(() => {});
      const newBlocks = markdownToBlocks(contentWithImages).slice(0, 100);
      for (let i = 0; i < newBlocks.length; i += 90) {
        await notionFetch(`/v1/blocks/${page.id}/children`, "PATCH", { children: newBlocks.slice(i, i + 90) });
      }
      const tags = CATEGORY_TAGS[category] || ["UX Design"];
      await notionFetch(`/v1/pages/${page.id}`, "PATCH", {
        properties: {
          Title: { title: [{ text: { content: finalTitle } }] },
          Description: { rich_text: [{ text: { content: description } }] },
          "Hero Image": { url: heroImageUrl },
          Tags: { multi_select: tags.map((t) => ({ name: t })) },
        },
      });

      let imgExt = "jpg", imgPath = "";
      try {
        const imgRes = await fetch(heroImageUrl);
        if (imgRes.ok) {
          const ct = imgRes.headers.get("content-type") || "";
          if (ct.includes("png")) imgExt = "png"; else if (ct.includes("webp")) imgExt = "webp";
          fs.mkdirSync("public/assets/blog", { recursive: true });
          fs.writeFileSync(`public/assets/blog/${slug}.${imgExt}`, Buffer.from(await imgRes.arrayBuffer()));
          imgPath = `/assets/blog/${slug}.${imgExt}`;
        }
      } catch (e) { console.log("  img download failed:", e.message); }

      const wc2 = contentWithImages.split(/\s+/).filter(Boolean).length;
      const readTime = `${Math.max(1, Math.ceil(wc2 / 200))} min`;
      const md = `---
title: "${finalTitle.replace(/"/g, '\\"')}"
description: "${description.replace(/"/g, '\\"')}"
category: "${category}"
author: "UserDesigners"
tags: [${tags.map((t) => `"${t}"`).join(", ")}]
heroImage: "${imgPath}"
heroImageSource: "${heroImageUrl}"
date: "${today}"
readTime: "${readTime}"
---

${contentWithImages}
`;
      fs.mkdirSync("src/content/blog", { recursive: true });
      fs.writeFileSync(`src/content/blog/${slug}.md`, md);
      fs.writeFileSync("public/assets/blog/used-images.json", JSON.stringify({ unsplashIds: [...usedImageIds] }, null, 2));
      console.log(`  OK: ${slug}`);
    } catch (e) {
      console.error(`  ERROR en ${slug}:`, e.message);
    }
  }
}

main();
