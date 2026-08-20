// resync-local-from-notion.mjs — reconstruye el .md local desde el contenido actual
// de Notion (fuente de verdad), sin llamar al LLM. Uso para recuperar posts que
// quedaron revertidos por error al correr validate-blog-seo.mjs antes de tiempo.
import fs from "fs";

const NOTION_TOKEN = process.env.NOTION_TOKEN;
const DB_ID = process.env.NOTION_DB_ID;
const SLUGS = process.argv.slice(2);

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

function blocksToMarkdown(blocks) {
  let md = "";
  for (const b of blocks) {
    const t = b.type;
    if (t === "table") {
      const rows = b.table.children || [];
      rows.forEach((row, idx) => {
        const cells = row.table_row.cells.map(c => c.map(r => r.plain_text || r.text?.content || "").join("")).join(" | ");
        md += `| ${cells} |\n`;
        if (idx === 0) md += `|${row.table_row.cells.map(() => "---").join("|")}|\n`;
      });
      md += "\n";
      continue;
    }
    const rt = b[t]?.rich_text || [];
    const text = rt.map(r => {
      const c = r.plain_text || r.text?.content || "";
      return r.annotations?.bold ? `**${c}**` : c;
    }).join("");
    if (t === "image") {
      const url = b.image?.external?.url || b.image?.file?.url || "";
      md += `![](${url})\n\n`;
      continue;
    }
    if (t === "divider") { md += "---\n\n"; continue; }
    if (!text.trim()) { continue; }
    switch (t) {
      case "heading_1": md += `# ${text}\n\n`; break;
      case "heading_2": md += `## ${text}\n\n`; break;
      case "heading_3": md += `### ${text}\n\n`; break;
      case "bulleted_list_item": md += `- ${text}\n`; break;
      case "numbered_list_item": md += `1. ${text}\n`; break;
      case "paragraph": md += `${text}\n\n`; break;
      default: md += `${text}\n\n`;
    }
  }
  return md.trim();
}

async function main() {
  const data = await notionFetch(`/v1/databases/${DB_ID}/query`, "POST", { filter: { property: "Status", select: { equals: "Published" } }, page_size: 100 });
  const pages = data.results || [];

  for (const slug of SLUGS) {
    const page = pages.find(p => (p.properties.Slug?.rich_text?.[0]?.plain_text || "") === slug);
    if (!page) { console.log(`SKIP (not found): ${slug}`); continue; }
    const props = page.properties;
    const title = props.Title?.title?.[0]?.plain_text || "";
    const description = props.Description?.rich_text?.[0]?.plain_text || "";
    const category = props.Category?.select?.name || "UX Design";
    const tags = props.Tags?.multi_select?.map(t => t.name) || [];
    const heroImageUrl = props["Hero Image"]?.url || "";

    const blocksData = await notionFetch(`/v1/blocks/${page.id}/children?page_size=100`);
    const content = blocksToMarkdown(blocksData.results || []);
    const wordCount = content.split(/\s+/).filter(Boolean).length;
    const readTime = `${Math.max(1, Math.ceil(wordCount / 200))} min`;

    const existingMd = fs.existsSync(`src/content/blog/${slug}.md`) ? fs.readFileSync(`src/content/blog/${slug}.md`, "utf-8") : "";
    const imgPathMatch = existingMd.match(/^heroImage: "([^"]*)"/m);
    const imgPath = imgPathMatch ? imgPathMatch[1] : "";
    const dateMatch = existingMd.match(/^date: "([^"]*)"/m);
    const date = dateMatch ? dateMatch[1] : new Date().toISOString().slice(0, 10);

    const md = `---
title: "${title.replace(/"/g, '\\"')}"
description: "${description.replace(/"/g, '\\"')}"
category: "${category}"
author: "UserDesigners"
tags: [${tags.map(t => `"${t}"`).join(", ")}]
heroImage: "${imgPath}"
heroImageSource: "${heroImageUrl}"
date: "${date}"
readTime: "${readTime}"
---

${content}
`;
    fs.writeFileSync(`src/content/blog/${slug}.md`, md);
    console.log(`OK ${slug}: ${wordCount} palabras`);
  }
}

main().catch(e => { console.error(e); process.exit(1); });
