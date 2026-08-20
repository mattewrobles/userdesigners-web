// seo-rules.mjs
// Reglas SEO/GEO/AEO compartidas entre validate-blog-seo.mjs (gate de sync)
// y qa-check-ready-posts.mjs (aviso temprano sobre posts en Notion).
// Una sola fuente de verdad: si cambia una regla, cambia en los dos flujos.

export const GENERIC_PHRASES = [
  "en la era digital", "mundo competitivo", "soluciones innovadoras",
  "potenciar", "impulsar", "en el mundo actual", "cada vez más",
  "en este artículo", "exploraremos", "sumérgete", "revolucionar",
  "sin duda", "es fundamental", "juego de palabras", "clave del éxito",
];

const META_PHRASES = [
  "un buen post", "en esta guía cubriremos", "aquí te explicaré", "a continuación te",
  "el siguiente post", "este artículo te", "termina con faq", "te mostraré cómo",
];

const AUTHORITY_SOURCES = /https:\/\/(www\.)?(nngroup\.com|interaction-design\.org|usability\.gov|baymard\.com|smashingmagazine\.com|alistapart\.com)/;

const CATEGORY_KEYWORDS = {
  "Design Systems": "design system",
  "UX Research": "usuario|research|entrevista",
  "Product Design": "producto|app",
  "UX Writing": "texto|copy",
  "Accesibilidad": "accesib",
  "Estrategia de Producto": "estrategia|roadmap",
};

/**
 * Parsea el frontmatter simple (clave: "valor") de un post .md
 * @param {string} content
 * @returns {{meta: Record<string,string>, body: string} | null}
 */
export function parseFrontmatter(content) {
  const fm = content.match(/^---\n([\s\S]*?)\n---/);
  if (!fm) return null;
  const body = content.replace(/^---\n[\s\S]*?\n---\n/, "");
  const meta = {};
  for (const line of fm[1].split("\n")) {
    const m = line.match(/^([a-zA-Z]+):\s*"?([^"]*)"?$/);
    if (m) meta[m[1]] = m[2];
  }
  return { meta, body };
}

/**
 * Evalúa un post contra las reglas críticas (bloquean) y de warning (solo avisan).
 * @param {string} slug
 * @param {string} content - archivo .md completo con frontmatter
 * @returns {{critical: string[], warnings: string[], geoWarnings: string[]}}
 */
export function checkPost(slug, content) {
  const critical = [];
  const warnings = [];
  const geoWarnings = [];

  const parsed = parseFrontmatter(content);
  if (!parsed) {
    critical.push(`${slug}: no frontmatter`);
    return { critical, warnings, geoWarnings };
  }
  const { meta, body } = parsed;

  const title = meta.title || "";
  const desc = meta.description || "";
  const cat = meta.category || "";
  const hero = meta.heroImage || "";
  const tags = meta.tags || "";
  const words = body.split(/\s+/).filter(Boolean).length;

  // --- CRÍTICAS ---
  if (!title || title.trim().length < 30) critical.push(`${slug}: title muy corto o ausente (${title.trim().length} chars, min 30)`);
  if (title.length > 75) critical.push(`${slug}: title muy largo (${title.length}, max 75)`);
  else if (title.length > 65) warnings.push(`${slug}: title pasa los 65 chars recomendados para SERP (${title.length}) — no bloquea, pero Google puede truncarlo`);
  if (!desc || desc.trim().length < 120) critical.push(`${slug}: meta description ausente o muy corta (${desc.trim().length}, min 120)`);
  if (desc.length > 160) critical.push(`${slug}: meta description muy larga (${desc.length}, max 160)`);
  if (!cat) critical.push(`${slug}: falta categoría`);
  if (!hero) critical.push(`${slug}: falta heroImage`);
  if (words < 1000) critical.push(`${slug}: contenido demasiado corto (${words} palabras, min 1000)`);
  if (!body.includes("## ")) critical.push(`${slug}: sin headings H2 — estructura para SEO`);
  const h2Count = (body.match(/^## /gm) || []).length;
  if (h2Count < 4) critical.push(`${slug}: solo ${h2Count} secciones H2 (mínimo 4-6)`);

  // Una sola frase genérica en un post largo puede ser natural (ej. "es fundamental"
  // una vez en 1700 palabras no es lo mismo que un patrón repetido de IA) — solo
  // bloquea si aparecen 2+ frases distintas, señal real de escritura genérica.
  const genericHits = GENERIC_PHRASES.filter((p) => body.toLowerCase().includes(p));
  if (genericHits.length >= 2) critical.push(`${slug}: contenido genérico detectado — ${genericHits.join(", ")}`);
  else if (genericHits.length === 1) warnings.push(`${slug}: 1 frase genérica ("${genericHits[0]}") — no bloquea sola, revisar si se repite en el resto del post`);

  const metaHits = META_PHRASES.filter((p) => body.toLowerCase().includes(p));
  if (metaHits.length > 0) critical.push(`${slug}: frases meta-instrucción coladas del prompt — ${metaHits.join(", ")}`);

  if (/lorem ipsum/i.test(body) || /(?:^|[^a-záéíóúüñ])TODO(?:[^a-záéíóúüñ]|$)/.test(body) || /XXX:/.test(body)) {
    critical.push(`${slug}: contiene lorem ipsum o placeholders`);
  }

  // --- WARNINGS SEO clásico ---
  if (!tags.includes(",")) warnings.push(`${slug}: usa 2+ tags (SEO)`);
  const imgCount = (body.match(/!\[/g) || []).length;
  if (imgCount < 2) warnings.push(`${slug}: solo ${imgCount} imagen(es), un post largo necesita 2-4`);
  if (!/^!\[[^\]]{5,}\]/.test(body)) warnings.push(`${slug}: imágenes sin alt text descriptivo`);
  const kw = (CATEGORY_KEYWORDS[cat] || "").toLowerCase();
  if (kw && !new RegExp(kw).test((title + " " + body).toLowerCase())) {
    warnings.push(`${slug}: categoría "${cat}" pero sin keywords ("${kw}")`);
  }
  const internalLinks = (body.match(/\/blog\//g) || []).length;
  if (internalLinks < 2) warnings.push(`${slug}: solo ${internalLinks} links internos (mínimo 2-3)`);
  if (!AUTHORITY_SOURCES.test(body)) warnings.push(`${slug}: sin link externo a fuente de autoridad (E-E-A-T)`);
  if (!/preguntas frecuentes|faq/i.test(body)) warnings.push(`${slug}: sin sección FAQ — ayuda al featured snippet`);
  const tableCount = (body.match(/\|/g) || []).length;
  if (tableCount < 10) warnings.push(`${slug}: sin tablas markdown comparativas`);
  if (!/checklist|puntos clave|lista de verificaci/i.test(body)) warnings.push(`${slug}: sin bloque checklist/puntos clave`);

  // --- WARNINGS GEO/AEO (Generative/Answer Engine Optimization) ---
  // Los motores generativos (ChatGPT, Perplexity, AI Overviews) citan párrafos que
  // responden la pregunta en 1-3 frases directas justo después del H2, no prosa larga.
  const h2Blocks = body.split(/^## /m).slice(1);
  const directAnswerRe = /^[^\n]{0,220}[.?!]/; // primera frase corta tras el heading
  const withoutDirectAnswer = h2Blocks.filter((block) => {
    const firstPara = block.split("\n").find((l) => l.trim() && !l.trim().startsWith("#"));
    return !firstPara || firstPara.trim().length > 260;
  });
  if (h2Blocks.length > 0 && withoutDirectAnswer.length > h2Blocks.length / 2) {
    geoWarnings.push(`${slug}: mayoría de secciones sin respuesta directa corta al inicio (GEO: los LLM citan párrafos de 1-3 frases justo después del H2)`);
  }
  if (!/\d{4}|actualizado|última actualización/i.test(body) && !meta.date) {
    geoWarnings.push(`${slug}: sin señal de frescura (año o "actualizado el") — GEO premia contenido con fecha explícita`);
  }
  if (!/^\*\*.+\?\*\*/m.test(body)) {
    geoWarnings.push(`${slug}: preguntas del FAQ no están en negrita — dificulta que los motores generativos extraigan el par pregunta/respuesta`);
  }

  return { critical, warnings, geoWarnings };
}
