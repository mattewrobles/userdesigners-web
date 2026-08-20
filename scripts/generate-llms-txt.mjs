// generate-llms-txt.mjs
// Regenera public/llms.txt con TODOS los posts publicados (no una lista manual
// que se queda vieja). GEO/AEO: llms.txt es lo que los crawlers de LLMs (GPTBot,
// ClaudeBot, PerplexityBot) leen primero para entender el sitio.
// Corre después del sync semanal, así el archivo nunca queda desactualizado.
import fs from "fs";

const BLOG_DIR = "src/content/blog";
const SITE = "https://www.userdesigners.com";

const HEADER = `# UserDesigners

> Agencia de UX/UI Design especializada en Fintechs, Bancos y neobancos de Latinoamérica. Desde Cuenca, Ecuador, diseñamos productos digitales que convierten: investigación de usuarios, UX, UI y design systems.

UserDesigners (userdesigners.com) es una agencia de experiencia de usuario (UX) y diseño de interfaz (UI) con más de 12 años de experiencia en fintech, banca digital y neobancos de Latinoamérica. Nuestro proceso combina investigación de usuarios, arquitectura de la información, diseño de interfaz y design systems para productos digitales que convierten.

Contacto: latam@userdesigners.com | WhatsApp: +593 0961026799 | Cuenca, Ecuador

## Key pages

- [Home](${SITE}/): Agencia UX/UI para fintechs y bancos latinoamericanos
- [Servicios](${SITE}/servicios/): Investigación de usuarios, UX design, UI design, design systems y prototipado
- [Nosotros](${SITE}/nosotros/): Equipo de diseño UX/UI y metodología
- [Proyectos](${SITE}/proyectos/): Casos de éxito — Utransfer, Kaito, Novo y más
- [Contacto](${SITE}/contacto/): Hablemos de tu proyecto

## Servicios

- Investigación de usuarios y UX Research
- Diseño de experiencia de usuario (UX)
- Diseño de interfaz (UI)
- Design systems para empresas
- Prototipado rápido y validación de ideas
- Auditoría UX de productos digitales
- SEO médico y posicionamiento local (userdesigners.com/seo-doctores)

## Proyectos destacados

- [Utransfer](${SITE}/proyectos/utransfer/): UX Research para aplicación de transferencias
- [Kaito](${SITE}/proyectos/kaito/): Diseño de fintech app
- [Novo](${SITE}/proyectos/novo/): Banca digital
- [Verificación biométrica](${SITE}/proyectos/verificacion-biometrica/): Biometría UX
`;

const FOOTER = `
## Optional

- [Robots](${SITE}/robots.txt)
- [Sitemap](${SITE}/sitemap_index.xml)
`;

function parseFrontmatter(content) {
  const fm = content.match(/^---\n([\s\S]*?)\n---/);
  if (!fm) return null;
  const meta = {};
  for (const line of fm[1].split("\n")) {
    const m = line.match(/^([a-zA-Z]+):\s*"?([^"]*)"?$/);
    if (m) meta[m[1]] = m[2];
  }
  return meta;
}

function generate() {
  if (!fs.existsSync(BLOG_DIR)) {
    console.log("No blog dir — skipping llms.txt generation");
    return;
  }
  const files = fs.readdirSync(BLOG_DIR).filter((f) => f.endsWith(".md") && f !== "_TEMPLATE.md");
  const posts = files
    .map((f) => {
      const content = fs.readFileSync(`${BLOG_DIR}/${f}`, "utf-8");
      const meta = parseFrontmatter(content);
      if (!meta) return null;
      return {
        slug: f.replace(/\.md$/, ""),
        title: meta.title || "",
        description: meta.description || "",
        date: meta.date || "",
      };
    })
    .filter(Boolean)
    .sort((a, b) => (b.date || "").localeCompare(a.date || ""));

  const blogLines = posts
    .map((p) => `- [${p.title}](${SITE}/blog/${p.slug}/): ${p.description}`)
    .join("\n");

  const output = `${HEADER}\n## Blog\n\n${blogLines}\n${FOOTER}`;
  fs.writeFileSync("public/llms.txt", output);
  console.log(`✓ public/llms.txt regenerado con ${posts.length} posts`);
}

generate();
