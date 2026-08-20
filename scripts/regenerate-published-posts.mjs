// regenerate-published-posts.mjs
// Regenera el CONTENIDO de posts ya "Published" en Notion que quedaron cortos
// (de antes del pipeline nuevo), manteniendo el mismo slug/título/URL (no rompe SEO).
// Actualiza Notion (fuente de verdad) Y el .md local + hero image, para que
// el commit final refleje el contenido nuevo sin depender del gate "Ready" del sync.
//
// Uso: node scripts/regenerate-published-posts.mjs           (todos los Published)
//      node scripts/regenerate-published-posts.mjs slug1 slug2   (solo esos slugs)

import fs from "fs";

const NOTION_TOKEN = process.env.NOTION_TOKEN;
const DB_ID = process.env.NOTION_DB_ID;
const TOKENROUTER_KEY = process.env.TOKENROUTER_API_KEY;
const UNSPLASH_KEY = process.env.UNSPLASH_ACCESS_KEY;

for (const [name, val] of Object.entries({ NOTION_TOKEN, DB_ID, TOKENROUTER_KEY, UNSPLASH_KEY })) {
  if (!val) { console.error(`Missing env var: ${name}`); process.exit(1); }
}

const ONLY_SLUGS = process.argv.slice(2);

async function notionFetch(path, method = "GET", body = null) {
  const res = await fetch(`https://api.notion.com${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${NOTION_TOKEN}`,
      "Notion-Version": "2022-06-28",
      "Content-Type": "application/json",
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const json = await res.json();
  if (!res.ok) throw new Error(`Notion ${method} ${path} -> ${res.status}: ${JSON.stringify(json).slice(0, 300)}`);
  return json;
}

async function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

// La cuenta de TokenRouter tiene un límite global de 2 requests/minuto (no es por modelo).
// Espaciamos CADA llamada al LLM (no solo entre posts) para respetarlo.
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
    } catch (e) {
      lastErr = e;
      await sleep(LLM_MIN_GAP_MS);
    }
  }
  throw lastErr;
}

function safeParse(str) {
  let out = "", inStr = false, esc = false;
  for (let i = 0; i < str.length; i++) {
    const ch = str[i];
    if (esc) { out += ch; esc = false; continue; }
    if (ch === "\\") { out += ch; esc = true; continue; }
    if (ch === '"') { inStr = !inStr; out += ch; continue; }
    if (inStr && (ch === "\n" || ch === "\r" || ch === "\t" || ch.charCodeAt(0) < 32)) { out += "\\n"; continue; }
    out += ch;
  }
  return JSON.parse(out);
}

function extractJson(raw) {
  const m = raw.match(/\{[\s\S]*\}/);
  if (!m) throw new Error("No JSON in AI response: " + raw.slice(0, 200));
  try { return JSON.parse(m[0]); } catch { /* fall through */ }
  return safeParse(m[0]);
}

// --- markdown -> Notion blocks (misma lógica que el n8n workflow) ---
function parseInline(text) {
  const linkRegex = /\[([^\]]+)\]\(([^)]+)\)/g;
  const segments = [];
  let lastIndex = 0, match;
  while ((match = linkRegex.exec(text)) !== null) {
    if (match.index > lastIndex) segments.push({ text: text.slice(lastIndex, match.index) });
    segments.push({ text: match[1], link: match[2] });
    lastIndex = match.index + match[0].length;
  }
  if (lastIndex < text.length) segments.push({ text: text.slice(lastIndex) });
  const rich = [];
  for (const seg of segments) {
    const parts = seg.text.split(/(\*\*[^*]+\*\*)/g).filter(p => p);
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
function splitRow(line) {
  let t = line.trim();
  if (t.startsWith("|")) t = t.slice(1);
  if (t.endsWith("|")) t = t.slice(0, -1);
  return t.split("|").map(c => c.trim());
}
function isSeparatorRow(line) {
  const cells = splitRow(line);
  return cells.length > 0 && cells.every(c => /^:?-+:?$/.test(c));
}
function markdownToBlocks(md) {
  const lines = md.split("\n");
  const blocks = [];
  let i = 0;
  while (i < lines.length) {
    const raw = lines[i];
    const t = raw.trim();
    if (!t) { i++; continue; }
    if (t.startsWith("|") && t.endsWith("|") && i + 1 < lines.length && isSeparatorRow(lines[i + 1])) {
      const header = splitRow(t);
      const rows = [header];
      let j = i + 2;
      while (j < lines.length && lines[j].trim().startsWith("|") && lines[j].trim().endsWith("|")) { rows.push(splitRow(lines[j])); j++; }
      const width = header.length;
      const tableRows = rows.map(cells => ({ object: "block", type: "table_row", table_row: { cells: cells.slice(0, width).map(c => parseInline(c)) } }));
      blocks.push({ object: "block", type: "table", table: { table_width: width, has_column_header: true, has_row_header: false, children: tableRows } });
      i = j; continue;
    }
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

const SYSTEM_PROMPT = (linksBlock) => `Eres el editor de contenido de UserDesigners, una agencia de UX/UI Design en Cuenca, Ecuador.
Escribes blogs B2B para fundadores, product managers y CTOs de empresas en Latam.
Referente de estructura SEO: airpals.co/blog (long-form, ~8 H2 + subsecciones H3, FAQ al final, tabla SOLO cuando hay comparación real, ~2 links externos de autoridad).

REGLAS ESTRICTAS:
- Abre con un hook directo que identifica un problema real del lector (NUNCA "En este artículo", NUNCA "Hola,")
- Secciones cortas con H2 (## Título). Sin relleno, sin rodeos.
- Perspectiva de practicante con experiencia real, no de teórico
- NUNCA estadísticas inventadas. Si no tienes el dato exacto, no lo pongas.
- NUNCA frases prohibidas: "en la era digital", "mundo competitivo", "soluciones innovadoras", "potenciar", "impulsar", "sin duda", "por supuesto", "cabe mencionar", "vale la pena señalar"
- Longitud: 1500-2200 palabras
- Cada párrafo debe aportar valor concreto. Si no suma, elimínalo.

LINKS (obligatorio):
- Incluí 2-3 links internos de esta lista SOLO si calzan de verdad con el tema, integrados naturalmente:
${linksBlock || "(sin posts candidatos disponibles)"}
- Incluí 1-2 links externos a fuentes de autoridad reales en UX/producto (nngroup.com, interaction-design.org, w3.org/WAI, developer.mozilla.org) respaldando una afirmación específica — NUNCA inventes la URL

TABLA — condicional: solo si hay 2-4 opciones genuinamente comparables. Si no hay nada que comparar, NO la fuerces.

FAQ (obligatorio, GEO/AEO — formato EXACTO):
- Cerrá con "## Preguntas frecuentes" y 3-4 preguntas
- Formato EXACTO: pregunta en **negrita** sola en su línea, salto de línea, respuesta corta en texto plano (NUNCA como H3, NUNCA con ###)

- Cierra el cuerpo principal (antes de FAQ) con un paso de acción ejecutable
- GEO (crítico): la primera oración justo después de CADA H2 debe responder la
  pregunta implícita del heading de forma directa y autocontenida (máx 200
  caracteres) — es la frase que un LLM cita sin leer el resto del párrafo
- Mencioná el año actual o "actualizado en 2026" al menos una vez (señal de frescura)

OUTPUT — SOLO JSON:
{ "description": "...", "content": "markdown del artículo" }`;

const CRITIC_PROMPT = `Eres un editor senior de UX. Revisa este borrador de blog y mejóralo.

REGLAS — sé implacable:
- El hook engancha al lector en la primera línea? Si no, proponé uno mejor.
- Cada párrafo aporta valor concreto o es relleno? Eliminá el relleno.
- Hay frases genéricas o prohibidas? Señalalas y reemplazalas.
- La longitud es 1500-2200 palabras?
- Tiene 2-3 links internos reales y 1-2 externos de autoridad? Si faltan y hay dónde meterlos con naturalidad, agregalos.
- Si el tema tiene comparaciones reales, hay una tabla markdown? Si no hay nada que comparar, confirmá que NO se forzó una.
- Termina con "## Preguntas frecuentes" (preguntas en **negrita**, 3-4)? Si falta, agregala.

OUTPUT:
{ "critique": "lista de problemas específicos", "improved_content": "contenido mejorado completo en markdown", "score": 1-10 }`;

// Misma lista que validate-blog-seo.mjs (GENERIC_PHRASES + META_PHRASES) para que
// el post regenerado pase el mismo gate crítico sin necesitar otra llamada al LLM.
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
    const re = new RegExp(phrase.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "gi");
    out = out.replace(re, "");
  }
  return out.replace(/[ \t]{2,}/g, " ").replace(/\s+([.,;:])/g, "$1").replace(/\n{3,}/g, "\n\n");
}

function clampDescription(desc, title) {
  let d = (desc || "").trim();
  if (d.length > 160) d = d.slice(0, 157).replace(/\s+\S*$/, "") + "...";
  if (d.length < 120) d = `${d} ${title || ""}`.trim().slice(0, 160);
  return d;
}

async function generateDraft(topic, category, linksBlock) {
  const messages = [
    { role: "system", content: SYSTEM_PROMPT(linksBlock) },
    { role: "user", content: `Reescribe (expande) el blog post para UserDesigners sobre: "${topic}". Categoría: ${category}.` },
  ];
  for (let attempt = 0; attempt < 2; attempt++) {
    const res = await callLLM(messages, "google/gemini-3.5-flash-lite");
    try { return extractJson(res.choices?.[0]?.message?.content || ""); }
    catch (e) { if (attempt === 1) throw e; }
  }
}
async function critique(title, content) {
  const res = await callLLM([
    { role: "system", content: CRITIC_PROMPT },
    { role: "user", content: `Revisa este borrador:\n\nTítulo: ${title}\n\n${content}` },
  ], "google/gemini-3.5-flash-lite");
  try { return extractJson(res.choices?.[0]?.message?.content || ""); }
  catch { return { critique: "", improved_content: null, score: 5 }; }
}

async function searchUnsplash(query) {
  const res = await fetch(`https://api.unsplash.com/search/photos?query=${encodeURIComponent(query)}&per_page=10&orientation=landscape`, {
    headers: { Authorization: `Client-ID ${UNSPLASH_KEY}` },
  });
  const json = await res.json();
  return json.results || [];
}

function loadUsedImages() {
  try { return new Set(JSON.parse(fs.readFileSync("public/assets/blog/used-images.json", "utf-8")).unsplashIds || []); }
  catch { return new Set(); }
}

async function main() {
  console.log("Fetching Published posts from Notion...");
  const body = { filter: { property: "Status", select: { equals: "Published" } }, page_size: 100 };
  const data = await notionFetch(`/v1/databases/${DB_ID}/query`, "POST", body);
  let pages = data.results || [];
  if (ONLY_SLUGS.length > 0) {
    pages = pages.filter(p => ONLY_SLUGS.includes(p.properties.Slug?.rich_text?.[0]?.plain_text || ""));
  }
  console.log(`Processing ${pages.length} post(s)`);

  const usedImageIds = loadUsedImages();
  const today = new Date().toISOString().slice(0, 10);
  const results = [];

  for (const page of pages) {
    const props = page.properties;
    const title = props.Title?.title?.[0]?.plain_text || "";
    const slug = props.Slug?.rich_text?.[0]?.plain_text || "";
    const category = props.Category?.select?.name || "UX Design";
    if (!slug) { console.log(`SKIP (no slug): ${title}`); continue; }

    console.log(`\n=== ${slug} ===`);
    try {
      // internal link candidates: otros posts Published, excluyendo este
      const linksBlock = pages
        .filter(p => p.id !== page.id)
        .slice(0, 8)
        .map(p => {
          const pp = p.properties;
          const t = pp.Title?.title?.[0]?.plain_text || "";
          const s = pp.Slug?.rich_text?.[0]?.plain_text || "";
          return t && s ? `- [${t}](https://userdesigners.com/blog/${s})` : null;
        })
        .filter(Boolean)
        .join("\n");

      console.log("  generando...");
      let draft = await generateDraft(title, category, linksBlock);
      draft.title = title; // mantener título/slug/URL originales (SEO)
      draft.slug = slug;

      console.log("  autocrítica...");
      const crit = await critique(draft.title, draft.content);
      let finalContent = (crit.improved_content && crit.improved_content !== draft.content) ? crit.improved_content : draft.content;
      finalContent = stripBannedPhrases(finalContent);
      draft.description = clampDescription(stripBannedPhrases(draft.description || ""), draft.title);

      const lower = finalContent.toLowerCase();
      const issues = BANNED_PHRASES.filter(p => lower.includes(p));
      const wordCount = finalContent.split(/\s+/).filter(Boolean).length;
      if (wordCount < 1200) issues.push(`muy corto (${wordCount} palabras)`);
      if (issues.length) console.log("  ⚠ issues:", issues.join(", "));

      // imágenes: hero + 2 inline, evitando repetidas
      console.log("  buscando imágenes...");
      const photos = await searchUnsplash(category);
      const unused = photos.filter(p => !usedImageIds.has(p.id));
      const pool = unused.length > 0 ? unused : photos;
      const heroPhoto = pool[0];
      const inlinePhotos = pool.slice(1, 3);
      [heroPhoto, ...inlinePhotos].forEach(p => p && usedImageIds.add(p.id));

      const toUrl = (p) => `${p.urls.raw}&w=1600&h=900&fit=crop`;
      let contentWithImages = finalContent;
      if (inlinePhotos.length > 0) {
        const lines = contentWithImages.split("\n");
        const h2Idx = lines.map((l, idx) => l.trim().startsWith("## ") ? idx : -1).filter(idx => idx >= 0);
        if (h2Idx.length >= 2) {
          const positions = inlinePhotos.length === 2
            ? [h2Idx[Math.floor(h2Idx.length / 3)], h2Idx[Math.floor(h2Idx.length * 2 / 3)]]
            : [h2Idx[Math.floor(h2Idx.length / 2)]];
          [...new Set(positions)].sort((a, b) => b - a).forEach((pos, idx, arr) => {
            const img = inlinePhotos[arr.length - 1 - idx];
            if (img) lines.splice(pos, 0, `![${draft.title}](${toUrl(img)})`, "");
          });
          contentWithImages = lines.join("\n");
        }
      }
      const heroImageUrl = heroPhoto ? toUrl(heroPhoto) : (props["Hero Image"]?.url || "");

      // --- actualizar Notion: reemplazar bloques hijos ---
      console.log("  actualizando Notion...");
      const existing = await notionFetch(`/v1/blocks/${page.id}/children?page_size=100`);
      for (const b of existing.results || []) {
        await notionFetch(`/v1/blocks/${b.id}`, "DELETE").catch(() => {});
      }
      const newBlocks = markdownToBlocks(contentWithImages).slice(0, 100);
      for (let i = 0; i < newBlocks.length; i += 90) {
        await notionFetch(`/v1/blocks/${page.id}/children`, "PATCH", { children: newBlocks.slice(i, i + 90) });
      }
      const tags = CATEGORY_TAGS[category] || ["UX Design"];
      await notionFetch(`/v1/pages/${page.id}`, "PATCH", {
        properties: {
          Description: { rich_text: [{ text: { content: draft.description || "" } }] },
          "Hero Image": { url: heroImageUrl },
          Tags: { multi_select: tags.map(t => ({ name: t })) },
        },
      });

      // --- escribir .md local (mismo formato que sync-notion-to-blog.js) ---
      let imgExt = "jpg", imgPath = "";
      try {
        const imgRes = await fetch(heroImageUrl);
        if (imgRes.ok) {
          const ct = imgRes.headers.get("content-type") || "";
          if (ct.includes("png")) imgExt = "png"; else if (ct.includes("webp")) imgExt = "webp";
          const buf = Buffer.from(await imgRes.arrayBuffer());
          fs.mkdirSync("public/assets/blog", { recursive: true });
          fs.writeFileSync(`public/assets/blog/${slug}.${imgExt}`, buf);
          imgPath = `/assets/blog/${slug}.${imgExt}`;
        }
      } catch (e) { console.log("  img download failed:", e.message); }

      const wc2 = contentWithImages.split(/\s+/).filter(Boolean).length;
      const readTime = `${Math.max(1, Math.ceil(wc2 / 200))} min`;
      const md = `---
title: "${title.replace(/"/g, '\\"')}"
description: "${(draft.description || "").replace(/"/g, '\\"')}"
category: "${category}"
author: "UserDesigners"
tags: [${tags.map(t => `"${t}"`).join(", ")}]
heroImage: "${imgPath}"
heroImageSource: "${heroImageUrl}"
date: "${today}"
readTime: "${readTime}"
---

${contentWithImages}
`;
      fs.mkdirSync("src/content/blog", { recursive: true });
      fs.writeFileSync(`src/content/blog/${slug}.md`, md);

      console.log(`  OK — ${wc2} palabras`);
      results.push({ slug, wordCount: wc2, ok: true });
      await sleep(1200);
    } catch (e) {
      console.log(`  ERROR: ${e.message}`);
      results.push({ slug, ok: false, error: e.message });
    }
  }

  fs.writeFileSync("public/assets/blog/used-images.json", JSON.stringify({ unsplashIds: [...usedImageIds] }, null, 2));

  console.log("\n=== RESUMEN ===");
  for (const r of results) console.log(r.ok ? `✓ ${r.slug} (${r.wordCount}w)` : `✗ ${r.slug}: ${r.error}`);
}

main().catch(e => { console.error(e); process.exit(1); });
