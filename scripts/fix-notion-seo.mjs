// fix-notion-seo.mjs
// 1) Pone en "Published" los posts que ya están publicados en la web.
// 2) Mejora title (30-65 chars) y description (120-160 chars) de los drafts.
import https from "https";

const NOTION_TOKEN = process.env.NOTION_TOKEN;
const DB_ID = process.env.NOTION_DB_ID;

if (!NOTION_TOKEN || !DB_ID) {
  console.error("Missing NOTION_TOKEN or NOTION_DB_ID");
  process.exit(1);
}

function notion(p, method = "GET", body = null) {
  return new Promise((resolve, reject) => {
    const opts = {
      hostname: "api.notion.com", path: p, method,
      headers: {
        Authorization: "Bearer " + NOTION_TOKEN,
        "Notion-Version": "2022-06-28",
        "Content-Type": "application/json",
      },
    };
    if (body) {
      const data = JSON.stringify(body);
      opts.headers["Content-Length"] = Buffer.byteLength(data);
    }
    const req = https.request(opts, (res) => {
      let d = "";
      res.on("data", (c) => (d += c));
      res.on("end", () => {
        try { resolve(JSON.parse(d)); }
        catch { reject(new Error(d.slice(0, 200))); }
      });
    });
    req.on("error", reject);
    if (body) req.write(JSON.stringify(body));
    req.end();
  });
}

async function queryAll() {
  const results = [];
  let cursor = undefined;
  do {
    const body = {};
    if (cursor) body.start_cursor = cursor;
    const res = await notion(`/v1/databases/${DB_ID}/query`, "POST", body);
    results.push(...(res.results || []));
    cursor = res.has_more ? res.next_cursor : undefined;
  } while (cursor);
  return results;
}

// slug → { title?, description? }
const SEO_FIXES = {
  "usuarios-no-leen-mensajes-error-como-arreglarlo": {
    title: "Por qué los usuarios no leen los mensajes de error",
  },
  "microcopy-convierte-texto-boton": {
    title: "Microcopy que convierte: el texto del botón importa",
  },
  "mercado-laboral-ux-2026-como-destacar": {
    title: "Mercado laboral UX 2026: qué está pasando con los empleos",
    description: "El mercado de diseño está saturado y las ofertas escasean. Analizamos los datos reales y qué habilidades separan a los candidatos que consiguen trabajo.",
  },
  "usuarios-sinteticos-ux-research-50-porciento": {
    title: "Usuarios sintéticos en UX research: por qué aciertan el 50%",
    description: "Nuevos estudios muestran que los usuarios simulados por IA aciertan patrones parcialmente. Esto es lo que puedes delegar y lo que no en tu research.",
  },
  "ai-generated-ui-revision-proceso": {
    title: "AI-generated UI: cómo revisarla antes de producción",
    description: "Cada vez más equipos envían UI generada por IA a producción sin revisión. Construye un proceso de review para que el contenido generado no dañe tu producto.",
  },
  "como-hacer-un-redesign-sin-morir-en-el-intento": {
    title: "Rediseño de producto digital sin perder usuarios en el intento",
  },
  "geo-optimizar-contenido-chatgpt-ai-overviews": {
    description: "Guía práctica de Generative Engine Optimization (GEO): 5 reglas para que ChatGPT, Perplexity y Google AI Overviews citen tu contenido en sus respuestas.",
  },
  "usar-ai-diseno-sin-perder-toque-humano": {
    description: "Guía para usar herramientas de IA en diseño UX/UI sin que tu trabajo se sienta genérico ni pierda el toque humano en cada entrega.",
  },
  "cuanto-cobrar-disenador-freelance-precio-consultor": {
    title: "Cuánto cobrar como freelance: de $5 por pantalla a consultor",
    description: "Guía de pricing para diseñadores freelance: cómo pasar de cobrar $5 por pantalla a cobrar por valor y convertirse en consultor de producto.",
  },
  "analizar-transcripts-entrevistas-ux-research-3-pasos": {
    title: "Analiza transcripts de entrevistas UX en 3 pasos",
    description: "Método práctico de 3 pasos para analizar transcripts de entrevistas de usuarios y extraer insights accionables sin perder horas en la codificación.",
  },
  "branding-en-tiempos-de-ia": {
    title: "Branding en tiempos de IA: protege tu identidad",
    description: "Descubre cómo proteger la identidad de tu marca en un mercado saturado de contenido generado por IA y diferenciarte con una estrategia clara.",
  },
  "tests-con-usuarios-reales-dejar-de-adivinar": {
    title: "Tests con usuarios reales: deja de adivinar",
    description: "Descubre por qué las opiniones de tu equipo interno arruinan tu producto y cómo probar con usuarios reales para tomar decisiones basadas en datos.",
  },
  "pruebas-de-usabilidad-reales-observa-que-hacen": {
    title: "Pruebas de usabilidad: observa, no preguntes",
    description: "Las opiniones de los usuarios en las pruebas mienten. Aprende a observar el comportamiento real para encontrar los problemas de verdad en tu producto.",
  },
  "tus-usuarios-no-leen-pruebas-de-concepto": {
    title: "Tus usuarios no leen tus pruebas de concepto",
    description: "Descubre por qué tus testeos de usuario fallan y cómo estructurar pruebas que observen comportamiento real en lugar de pedir opiniones que nunca llegan.",
  },
  "mejorar-conversion-landing-page": {
    description: "5 principios de UX que aumentan las conversiones de tu landing page sin necesidad de rediseñar todo: jerarquía, copy, prueba social y menos fricción.",
  },
  "por-que-necesitas-barra-comandos-producto-b2b": {
    description: "Descubre cómo el command + K mejora la retención y la eficiencia de los usuarios de tu producto B2B, y cuándo vale la pena implementarlo.",
  },
  "ux-writing-palabras-diseno": {
    description: "Cada palabra en un producto digital define la experiencia. Aprende qué hace un buen UX Writer y por qué el texto es parte del diseño.",
  },
};

const TO_PUBLISH = [
  "como-hacer-un-redesign-sin-morir-en-el-intento",
  "geo-optimizar-contenido-chatgpt-ai-overviews",
  "usar-ai-diseno-sin-perder-toque-humano",
];

async function main() {
  const pages = await queryAll();
  console.log(`${pages.length} posts en Notion`);

  let published = 0;
  let seoFixed = 0;

  for (const page of pages) {
    const props = page.properties;
    const slug = props.Slug?.rich_text?.[0]?.plain_text || "";
    if (!slug) continue;
    const id = page.id;

    const patch = { properties: {} };

    if (TO_PUBLISH.includes(slug)) {
      patch.properties.Status = { select: { name: "Published" } };
    }

    const fix = SEO_FIXES[slug];
    if (fix) {
      if (fix.title) {
        patch.properties.Title = { title: [{ text: { content: fix.title } }] };
      }
      if (fix.description) {
        patch.properties.Description = {
          rich_text: [{ text: { content: fix.description } }],
        };
      }
    }

    if (Object.keys(patch.properties).length > 0) {
      await notion(`/v1/pages/${id}`, "PATCH", patch);
      if (patch.properties.Status) published++;
      if (patch.properties.Title || patch.properties.Description) seoFixed++;
      console.log(`  ✓ ${slug}${patch.properties.Status ? " → Published" : ""}${fix ? " + SEO" : ""}`);
    }
  }

  console.log(`\nPublicados: ${published}, SEO mejorado: ${seoFixed}`);
}

main().catch((e) => { console.error(e); process.exit(1); });
