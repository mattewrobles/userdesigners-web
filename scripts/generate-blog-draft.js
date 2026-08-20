/**
 * generate-blog-draft.js
 * Genera un borrador de blog en Notion usando Gemini Flash via TokenRouter.
 * Uso: node scripts/generate-blog-draft.js "tema del blog" [categoria]
 *
 * Env vars requeridas:
 *   TOKENROUTER_API_KEY  (o OPENAI_API_KEY como alias)
 *   NOTION_TOKEN
 *   NOTION_DB_ID
 */

import https from "https";
import fs from "fs";

const OPENAI_KEY = process.env.TOKENROUTER_API_KEY || process.env.OPENAI_API_KEY;
const NOTION_TOKEN = process.env.NOTION_TOKEN;
const DB_ID = process.env.NOTION_DB_ID;
const UNSPLASH_KEY = process.env.UNSPLASH_ACCESS_KEY || null;
// Modelo de generación (configurable). Default: deepseek-v4-pro-0813 (balance
// calidad/precio para blogs largos). Alternativas: qwen/qwen3.8-max-free (gratis),
// google/gemini-3.7-flash, anthropic/claude-sonnet-5 (máxima calidad).
const BLOG_MODEL = process.env.BLOG_MODEL || "deepseek/deepseek-v4-pro-0813";

if (!OPENAI_KEY || !NOTION_TOKEN || !DB_ID) {
  console.error("Missing env vars: TOKENROUTER_API_KEY (o OPENAI_API_KEY), NOTION_TOKEN, NOTION_DB_ID");
  process.exit(1);
}

const topic = process.argv[2];
const category = process.argv[3] || "UX Design";

if (!topic) {
  console.error("Usage: node generate-blog-draft.js 'tema del blog' [categoria]");
  process.exit(1);
}

// Lista de posts existentes para links internos (SEO)
function existingPostsBlock() {
  try {
    const files = fs.readdirSync("src/content/blog").filter((f) => f.endsWith(".md"));
    const lines = files.map((f) => {
      const content = fs.readFileSync(`src/content/blog/${f}`, "utf-8");
      const title = (content.match(/^title:\s*"([^"]+)"/m) || [])[1] || f;
      const cat = (content.match(/^category:\s*"([^"]+)"/m) || [])[1] || "";
      const slug = f.replace(/\.md$/, "");
      return `- [${title}] → /blog/${slug}/ (categoría: ${cat})`;
    });
    return lines.join("\n");
  } catch {
    return "- (sin posts aún)";
  }
}

// Tono y voz de UserDesigners extraído de posts reales
const SYSTEM_PROMPT = `Eres el editor senior de contenido de UserDesigners, una agencia de UX/UI Design en Cuenca, Ecuador.
Escribes blogs B2B de alto valor para fundadores, product managers y CTOs de empresas fintech en Latam.
Tu estándar de calidad es el blog de Airpals (airpals.co/blog): posts largos, estructurados, con tablas, checklist y FAQ.

ESTRUCTURA OBLIGATORIA — sigue este orden exacto:
1. Hook directo que identifica un problema real del lector (NUNCA "En este artículo", NUNCA "Hola,")
2. Párrafo introductorio con la keyword principal en negrita dentro de los primeros 100 caracteres
3. "Tabla de contenidos" con 6-9 secciones (usa anchors de los H2)
4. 6-9 secciones con H2 descriptivos (keyword natural en los headers)
5. Al menos 2 secciones con TABLAS markdown comparativas (| col | col |)
6. Un bloque "Checklist" con bullets accionables
7. Un bloque "Puntos clave" (key takeaways) con 4-5 bullets
8. Conclusión con un paso de acción concreto (puede mencionar a UserDesigners de forma natural, sin vender duro)
9. "Preguntas frecuentes" (FAQ) con 5-7 preguntas en formato: **Pregunta?** + respuesta directa en negrita

LONGITUD: 1800-2400 palabras. Objetivo: 2000+. NO menos de 1500.
Nada de "3 min de lectura" — esto es un post largo y completo.

IMÁGENES — inserta 3-4 imágenes a lo largo del post:
- 1 imagen después del primer párrafo
- 1 imagen a mitad del post
- 1 imagen antes de la conclusión
Formato: ![descripción con keyword alt text](URL_IMAGEN)
Usa URLs genéricas de Unsplash relevantes al tema (usa el formato https://images.unsplash.com/photo-XXXX si las conoces, o deja el placeholder claro).

TONO Y ESTILO:
- Oraciones cortas. Sin adornos. Sin relleno.
- Perspectiva de practicante, no de teórico
- NUNCA estadísticas inventadas con números redondos perfectos
- NUNCA frases genéricas: "en la era digital", "mundo competitivo", "soluciones innovadoras", "potenciar", "impulsar"
- NUNCA lorem ipsum ni ejemplos hipotéticos abstractos
- Usa ejemplos concretos de productos fintech (Utransfer, Kaito) cuando el tema lo permita

ANTI-GENÉRICO (crítico — revisa tu propio output):
- Cada sección debe aportar un dato, paso o marco específico que el lector pueda aplicar
- Si una sección podría escribirse sin conocer la industria, REESCRÍBELA con especificidad
- Evita listas de beneficios genéricos ("mejora la conversión", "optimiza la experiencia") sin el CÓMO concreto

ANTI-META-INSTRUCCIÓN (crítico):
- NUNCA escribas frases que hablen sobre la estructura del post (ej: "un buen post termina con FAQ", "aquí te explicaré", "en esta guía cubriremos", "a continuación"). El contenido es el artículo final, no una explicación de cómo escribirlo.
- La sección "Preguntas frecuentes" debe contener SOLO preguntas con sus respuestas directas. Sin párrafo introductorio antes de las preguntas.
- "Tabla de contenidos" debe listar las secciones, no describirlas.

GEO/AEO (crítico — para que ChatGPT, Perplexity y Google AI Overviews citen este post):
- Justo debajo de CADA H2, la primera oración (máx 200 caracteres) debe responder la pregunta implícita del heading de forma directa y autocontenida — sin depender de contexto previo. Esa es la frase que un LLM extrae y cita.
- Cada pregunta del FAQ debe ir en negrita como pregunta completa (**¿Qué es X?**) seguida de la respuesta en 1-2 frases directas antes de cualquier elaboración.
- Menciona el año actual o "actualizado en 2026" al menos una vez — los motores generativos priorizan señales de frescura.
- Usa números y datos concretos (con fuente) en vez de afirmaciones vagas — los LLM citan cifras, no adjetivos.

SERVICIOS DE USERDESIGNERS (contexto para hacer el contenido relevante):
- Auditorías UX de productos digitales
- Design Systems para empresas
- UX Research (entrevistas, tests de usabilidad)
- Diseño de productos mobile y web
- Proyectos: Utransfer (fintech), Kaito (pagos B2B), Airpals (B2B shipping)

CATEGORÍAS VÁLIDAS: UX Research, Design Systems, Product Design, UX Writing, Accesibilidad, Estrategia de Producto

LINKS INTERNOS — OBLIGATORIO para SEO:
- Incluye SIEMPRE entre 3 y 5 links internos a posts existentes del blog de UserDesigners, enlazados de forma natural dentro del texto (anchor text descriptivo, no "clic aquí")
- Elige posts que tengan relación real con el tema del artículo (misma categoría idealmente)
- Si el tema lo permite, menciona el post relacionado en contexto: ej: "como explicamos en [nuestro artículo sobre design systems](/blog/design-system-empresa/)..."
- NUNCA inventes URLs: usa EXACTAMENTE las URLs de la lista de posts existentes abajo
- Un link debe ir en los primeros 2 párrafos cuando haya un post relevante
- Incluye al menos 1 link externo a una fuente de autoridad (Nielsen Norman Group, Interaction Design Foundation, o similar) con datos que respalden un punto

POSTS EXISTENTES DEL BLOG (usa solo estos, con estas URLs exactas):
${existingPostsBlock()}

OUTPUT FORMAT — devuelve SOLO JSON sin markdown, sin explicaciones:
{
  "title": "...",
  "slug": "...",
  "description": "120-155 caracteres con keyword",
  "category": "...",
  "tags": ["...", "..."],
  "content": "markdown del artículo completo (1800-2400 palabras, con tablas, checklist, FAQ, imágenes)"
}`;

function openaiRequest(messages) {
  return new Promise((resolve, reject) => {
    const body = JSON.stringify({
      model: BLOG_MODEL,
      messages,
      temperature: 0.7,
      max_tokens: 8000,
      response_format: { type: "json_object" },
    });
    const opts = {
      hostname: "api.tokenrouter.com",
      path: "/v1/chat/completions",
      method: "POST",
      headers: {
        Authorization: `Bearer ${OPENAI_KEY}`,
        "Content-Type": "application/json",
        "Content-Length": Buffer.byteLength(body),
      },
    };
    const req = https.request(opts, (res) => {
      let d = "";
      res.on("data", (c) => (d += c));
      res.on("end", () => {
        try { resolve(JSON.parse(d)); }
        catch { reject(new Error(d.slice(0, 300))); }
      });
    });
    req.on("error", reject);
    req.write(body);
    req.end();
  });
}

function unsplashFetch(query, page = 1) {
  if (!UNSPLASH_KEY) return Promise.resolve(null);
  return new Promise((resolve) => {
    const path = `/search/photos?query=${encodeURIComponent(query)}&per_page=4&orientation=landscape&page=${page}`;
    const req = https.request({
      hostname: "api.unsplash.com",
      path,
      method: "GET",
      headers: { Authorization: `Client-ID ${UNSPLASH_KEY}` },
    }, (res) => {
      let d = "";
      res.on("data", (c) => (d += c));
      res.on("end", () => {
        try {
          const json = JSON.parse(d);
          resolve(json.results?.map((r) => ({ url: r.urls?.regular, id: r.id })) || []);
        } catch { resolve([]); }
      });
    });
    req.on("error", () => resolve([]));
    req.end();
  });
}

// Registro de imágenes ya usadas (id Unsplash + hash). Evita reutilizar fotos.
function loadImageRegistry() {
  try {
    return JSON.parse(fs.readFileSync("public/assets/blog/used-images.json", "utf-8"));
  } catch {
    return { byUnsplashId: {}, byHash: {} };
  }
}

function notion(path, method = "GET", body = null) {
  return new Promise((resolve, reject) => {
    const data = body ? JSON.stringify(body) : null;
    const opts = {
      hostname: "api.notion.com",
      path,
      method,
      headers: {
        Authorization: `Bearer ${NOTION_TOKEN}`,
        "Notion-Version": "2022-06-28",
        "Content-Type": "application/json",
        ...(data && { "Content-Length": Buffer.byteLength(data) }),
      },
    };
    const req = https.request(opts, (res) => {
      let d = "";
      res.on("data", (c) => (d += c));
      res.on("end", () => {
        try { resolve(JSON.parse(d)); }
        catch { reject(new Error(d.slice(0, 200))); }
      });
    });
    req.on("error", reject);
    if (data) req.write(data);
    req.end();
  });
}

// Convierte markdown inline (negrita, links) a rich_text de Notion con href real
function mdRichText(text) {
  const parts = [];
  const re = /\[([^\]]+)\]\(([^)]+)\)/g;
  let last = 0;
  let m;
  while ((m = re.exec(text)) !== null) {
    if (m.index > last) {
      parts.push({ type: "text", text: { content: text.slice(last, m.index) } });
    }
    let url = m[2];
    // Notion requiere URLs absolutas
    if (url.startsWith("/")) url = `https://www.userdesigners.com${url}`;
    parts.push({ type: "text", text: { content: m[1], link: { url } } });
    last = re.lastIndex;
  }
  if (last < text.length) {
    parts.push({ type: "text", text: { content: text.slice(last) } });
  }
  if (parts.length === 0) parts.push({ type: "text", text: { content: text } });
  return parts;
}

// Convierte markdown simple a bloques de Notion (con links reales en body)
function markdownToNotionBlocks(md) {
  const lines = md.split("\n");
  const blocks = [];
  let inTable = false;
  let tableHeader = [];
  let tableRows = [];
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) { continue; }
    // Detectar tabla markdown: fila con | y siguiente fila de separación
    if (trimmed.startsWith("|") && trimmed.includes("|")) {
      const cells = trimmed.split("|").filter(c => c.trim() !== "").map(c => c.trim());
      if (!inTable) {
        inTable = true;
        tableHeader = cells;
        tableRows = [];
        continue;
      }
      // fila de separación (|---|)
      if (/^[\s:|-]+$/.test(trimmed.replace(/\|/g, "").trim()) && tableRows.length === 0 && tableHeader.length > 0) {
        continue;
      }
      tableRows.push(cells);
      continue;
    }
    // Flush tabla pendiente
    if (inTable && tableHeader.length > 0) {
      blocks.push({
        object: "block", type: "table",
        table: {
          table_width: tableHeader.length,
          has_column_header: true,
          has_row_header: false,
          children: [
            {
              object: "block", type: "table_row",
              table_row: { cells: tableHeader.map(c => [{ type: "text", text: { content: c } }]) },
            },
            ...tableRows.map(row => ({
              object: "block", type: "table_row",
              table_row: { cells: row.map(c => [{ type: "text", text: { content: c } }]) },
            })),
          ],
        },
      });
    }
    inTable = false; tableHeader = []; tableRows = [];

    if (trimmed.startsWith("## ")) {
      blocks.push({ object: "block", type: "heading_2", heading_2: { rich_text: [{ type: "text", text: { content: trimmed.slice(3) } }] } });
    } else if (trimmed.startsWith("### ")) {
      blocks.push({ object: "block", type: "heading_3", heading_3: { rich_text: [{ type: "text", text: { content: trimmed.slice(4) } }] } });
    } else if (trimmed.startsWith("> ")) {
      blocks.push({ object: "block", type: "quote", quote: { rich_text: mdRichText(trimmed.slice(2)) } });
    } else if (trimmed.startsWith("- ")) {
      blocks.push({ object: "block", type: "bulleted_list_item", bulleted_list_item: { rich_text: mdRichText(trimmed.slice(2)) } });
    } else {
      // Imagen markdown ![alt](url) → bloque de imagen de Notion
      const imgMatch = trimmed.match(/^!\[([^\]]*)\]\(([^)]+)\)$/);
      if (imgMatch) {
        blocks.push({ object: "block", type: "image", image: { type: "external", external: { url: imgMatch[2] } } });
        continue;
      }
      blocks.push({ object: "block", type: "paragraph", paragraph: { rich_text: mdRichText(trimmed) } });
    }
  }
  // Flush tabla al final
  if (inTable && tableHeader.length > 0) {
    blocks.push({
      object: "block", type: "table",
      table: {
        table_width: tableHeader.length,
        has_column_header: true,
        has_row_header: false,
        children: [
          { object: "block", type: "table_row", table_row: { cells: tableHeader.map(c => [{ type: "text", text: { content: c } }]) } },
          ...tableRows.map(row => ({ object: "block", type: "table_row", table_row: { cells: row.map(c => [{ type: "text", text: { content: c } }]) } })),
        ],
      },
    });
  }
  return blocks;
}

async function generate() {
  console.log(`Generating draft: "${topic}" [${category}]`);

  const response = await openaiRequest([
    { role: "system", content: SYSTEM_PROMPT },
    { role: "user", content: `Escribe un blog post para UserDesigners sobre: "${topic}". Categoría: ${category}.` },
  ]);

  const raw = response.choices?.[0]?.message?.content || "";

  let draft;
  try {
    // Extract JSON object from response (handles reasoning text before/after)
    const jsonMatch = raw.match(/\{[\s\S]*\}/);
    if (!jsonMatch) throw new Error("No JSON found");
    draft = JSON.parse(jsonMatch[0]);
  } catch {
    console.error("Could not extract JSON from response:", raw.slice(0, 500));
    process.exit(1);
  }

  console.log(`  Title: ${draft.title}`);
  console.log(`  Slug: ${draft.slug}`);

  // Verificar que no duplique un post ya publicado o un draft existente
  const existingSlugs = new Set();
  try {
    const files = fs.readdirSync("src/content/blog").filter((f) => f.endsWith(".md"));
    files.forEach((f) => existingSlugs.add(f.replace(/\.md$/, "")));
  } catch {}

  // Consultar Notion para slugs existentes (Published y Draft)
  let notionSlugs = [];
  try {
    let allResults = [];
    let cursor;
    do {
      const body = cursor ? { start_cursor: cursor } : {};
      const page = await notion(`/v1/databases/${DB_ID}/query`, "POST", body);
      allResults = allResults.concat(page.results || []);
      cursor = page.has_more ? page.next_cursor : undefined;
    } while (cursor);
    const res = { results: allResults };
    notionSlugs = (res.results || []).map(
      (p) => p.properties?.Slug?.rich_text?.[0]?.plain_text || ""
    );
    notionSlugs.forEach((s) => s && existingSlugs.add(s));
  } catch (e) {
    console.log(`  (aviso: no se pudo consultar Notion para duplicados: ${e.message.slice(0,60)})`);
  }

  const slug = draft.slug || "";
  if (existingSlugs.has(slug)) {
    console.error(`✗ DUPLICADO: el slug "${slug}" ya existe (publicado o en draft en Notion).`);
    console.error(`  No se creó nada. Si quieres reescribirlo, borra el anterior o usa otro tema.`);
    process.exit(1);
  }

  // Búsqueda por similitud del título contra existentes (fuzzy, evita duplicados temáticos)
  function norm(s) {
    return s.toLowerCase().replace(/-/g, " ").replace(/[^a-z0-9áéíóúüñ ]/g, "").trim();
  }
  const draftTitleN = norm(draft.title || "");
  const draftSlugN = norm(slug);
  let similar = null;
  for (const s of existingSlugs) {
    const tokens = norm(s.replace(/-/g, " "));
    // Match si comparten al menos 2 tokens significativos del tema
    const dt = draftSlugN.split(" ").filter((t) => t.length > 3);
    const st = tokens.split(" ").filter((t) => t.length > 3);
    const shared = dt.filter((t) => st.includes(t)).length;
    if (shared >= 2) { similar = s; break; }
  }
  if (similar) {
    console.error(`✗ POSIBLE DUPLICADO: el tema se parece a "${similar}" (ya existe).`);
    console.error(`  Si es el mismo post, no lo dupliques. Si es distinto, usa un slug/tema diferente.`);
    process.exit(1);
  }
  console.log(`  ✓ sin duplicados (${existingSlugs.size} existentes revisados)`);

  // Fetch hero image from Unsplash, saltando imágenes ya usadas (por id de Unsplash)
  const registry = loadImageRegistry();
  let heroImage = null;
  if (UNSPLASH_KEY) {
    for (let page = 1; page <= 3 && !heroImage; page++) {
      const photos = await unsplashFetch(draft.title, page);
      for (const photo of photos) {
        if (registry.byUnsplashId && registry.byUnsplashId[photo.id]) continue;
        heroImage = photo.url;
        break;
      }
    }
  }
  if (heroImage) console.log(`  Image: ${heroImage}`);

  const today = new Date().toISOString().slice(0, 10);
  const blocks = markdownToNotionBlocks(draft.content);

  // Fetch DB schema to only send properties that exist
  const db = await notion(`/v1/databases/${DB_ID}`);
  if (db.object === "error") {
    console.error("Notion DB fetch error:", db.message);
    process.exit(1);
  }
  const dbProps = db.properties || {};

  const findProp = (...names) => names.find(n => dbProps[n]);

  const titleKey = findProp("Title", "Name", "title");
  const slugKey = findProp("Slug", "slug", "URL", "url");
  const descKey = findProp("Description", "Descripción", "description", "Excerpt");
  const catKey = findProp("Category", "Categoría", "category", "Tag");
  const statusKey = findProp("Status", "Estado", "status");
  const dateKey = findProp("Date", "Fecha", "Published", "date");
  const imageKey = findProp("Image", "Hero Image", "Imagen", "Cover", "HeroImage", "heroImage");
  const authorKey = findProp("Author", "author");
  const tagsKey = findProp("Tags", "tags");

  const properties = {};
  if (titleKey) properties[titleKey] = { title: [{ text: { content: draft.title } }] };
  if (slugKey) properties[slugKey] = { rich_text: [{ text: { content: draft.slug } }] };
  if (descKey) properties[descKey] = { rich_text: [{ text: { content: draft.description } }] };
  if (catKey) properties[catKey] = { select: { name: draft.category } };
  if (authorKey) properties[authorKey] = { select: { name: "UserDesigners" } };
  if (tagsKey) properties[tagsKey] = { multi_select: [] };
  if (statusKey) properties[statusKey] = { select: { name: "Draft" } };
  if (dateKey) properties[dateKey] = { date: { start: today } };
  if (imageKey && heroImage) properties[imageKey] = { url: heroImage };

  // Create page in Notion with Status=Draft
  const page = await notion(`/v1/pages`, "POST", {
    parent: { database_id: DB_ID },
    properties,
    children: blocks.slice(0, 100), // Notion max 100 blocks per request
  });

  if (page.object === "error") {
    console.error("Notion error:", page.message);
    process.exit(1);
  }

  console.log(`✓ Draft created in Notion: ${page.url}`);
  console.log(`  Review and change Status to "Ready" to publish`);

  // Output for n8n/Slack
  process.stdout.write(JSON.stringify({
    title: draft.title,
    slug: draft.slug,
    notion_url: page.url,
    notion_id: page.id,
    hero_image: heroImage || null,
  }));
}

generate().catch((e) => { console.error(e); process.exit(1); });
