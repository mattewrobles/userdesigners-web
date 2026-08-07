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

const OPENAI_KEY = process.env.TOKENROUTER_API_KEY || process.env.OPENAI_API_KEY;
const NOTION_TOKEN = process.env.NOTION_TOKEN;
const DB_ID = process.env.NOTION_DB_ID;

if (!OPENAI_KEY || !NOTION_TOKEN || !DB_ID) {
  console.error("Missing env vars: OPENAI_API_KEY, NOTION_TOKEN, NOTION_DB_ID");
  process.exit(1);
}

const topic = process.argv[2];
const category = process.argv[3] || "UX Design";

if (!topic) {
  console.error("Usage: node generate-blog-draft.js 'tema del blog' [categoria]");
  process.exit(1);
}

// Tono y voz de UserDesigners extraído de posts reales
const SYSTEM_PROMPT = `Eres el editor de contenido de UserDesigners, una agencia de UX/UI Design en Cuenca, Ecuador.
Escribes blogs B2B para fundadores, product managers y CTOs de empresas en Latam.

TONO Y ESTILO — sigue esto exactamente:
- Abre con un hook directo que identifica un problema real del lector (NUNCA "En este artículo", NUNCA "Hola,")
- Secciones cortas con H2 (## Título)
- Bullet points con **negrita** en el label cuando aplique
- Oraciones cortas. Sin adornos. Sin relleno.
- Perspectiva de practicante, no de teórico
- NUNCA estadísticas inventadas con números redondos perfectos
- NUNCA frases genéricas: "en la era digital", "mundo competitivo", "soluciones innovadoras", "potenciar", "impulsar"
- NUNCA lorem ipsum ni ejemplos hipotéticos abstractos
- Longitud: 300-450 palabras. "3 min" de lectura.
- Cierra con un paso de acción concreto, no con un call to action de agencia

EJEMPLOS DE HOOKS QUE SÍ FUNCIONAN:
- "Tu producto ya existe. Los usuarios llegan pero no convierten."
- "Si tu equipo rediseña el mismo botón cada semana, tienes un problema de sistema — no de diseño."
- "Más del 60% del tráfico web global viene de dispositivos móviles. Si tu producto se diseñó pensando en desktop, estás ignorando a la mayoría de tus usuarios."

SERVICIOS DE USERDESIGNERS (contexto para hacer el contenido relevante):
- Auditorías UX de productos digitales
- Design Systems para empresas
- UX Research (entrevistas, tests de usabilidad)
- Diseño de productos mobile y web
- Proyectos: Utransfer (fintech), Kaito (pagos B2B), Airpals (B2B shipping)

CATEGORÍAS VÁLIDAS: UX Research, Design Systems, Product Design, UX Writing, Accesibilidad, Estrategia de Producto

OUTPUT FORMAT — devuelve SOLO JSON sin markdown, sin explicaciones:
{
  "title": "...",
  "slug": "...",
  "description": "...",
  "category": "...",
  "content": "markdown del artículo completo"
}`;

function openaiRequest(messages) {
  return new Promise((resolve, reject) => {
    const body = JSON.stringify({
      model: "google/gemini-3.5-flash-lite",
      messages,
      temperature: 0.7,
      max_tokens: 1500,
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

// Convierte markdown simple a bloques de Notion
function markdownToNotionBlocks(md) {
  const lines = md.split("\n");
  const blocks = [];
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    if (trimmed.startsWith("## ")) {
      blocks.push({ object: "block", type: "heading_2", heading_2: { rich_text: [{ type: "text", text: { content: trimmed.slice(3) } }] } });
    } else if (trimmed.startsWith("### ")) {
      blocks.push({ object: "block", type: "heading_3", heading_3: { rich_text: [{ type: "text", text: { content: trimmed.slice(4) } }] } });
    } else if (trimmed.startsWith("- ")) {
      blocks.push({ object: "block", type: "bulleted_list_item", bulleted_list_item: { rich_text: [{ type: "text", text: { content: trimmed.slice(2) } }] } });
    } else {
      blocks.push({ object: "block", type: "paragraph", paragraph: { rich_text: [{ type: "text", text: { content: trimmed } }] } });
    }
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

  const today = new Date().toISOString().slice(0, 10);
  const blocks = markdownToNotionBlocks(draft.content);

  // Create page in Notion with Status=Draft
  const page = await notion(`/v1/pages`, "POST", {
    parent: { database_id: DB_ID },
    properties: {
      Title: { title: [{ text: { content: draft.title } }] },
      Slug: { rich_text: [{ text: { content: draft.slug } }] },
      Description: { rich_text: [{ text: { content: draft.description } }] },
      Category: { select: { name: draft.category } },
      Status: { select: { name: "Draft" } },
      Date: { date: { start: today } },
    },
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
  }));
}

generate().catch((e) => { console.error(e); process.exit(1); });
