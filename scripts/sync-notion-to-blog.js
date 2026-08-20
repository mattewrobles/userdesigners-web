import https from "https";
import fs from "fs";

const NOTION_TOKEN = process.env.NOTION_TOKEN;
const DB_ID = process.env.NOTION_DB_ID;

if (!NOTION_TOKEN || !DB_ID) {
  console.error("Missing NOTION_TOKEN or NOTION_DB_ID env vars");
  process.exit(1);
}

function notion(path, method = "GET", body = null) {
  return new Promise((resolve, reject) => {
    const opts = {
      hostname: "api.notion.com", path, method,
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

function getBlocks(blockId) {
  return notion(`/v1/blocks/${blockId}/children?page_size=100`);
}

function blocksToMarkdown(blocks) {
  let md = "";
  const results = blocks.results || blocks;
  for (const b of results) {
    const t = b.type;
    const text = (b[t]?.rich_text || []).map((rt) => rt.plain_text).join("");
    if (!text.trim()) { md += "\n"; continue; }
    switch (t) {
      case "heading_1": md += `# ${text}\n\n`; break;
      case "heading_2": md += `## ${text}\n\n`; break;
      case "heading_3": md += `### ${text}\n\n`; break;
      case "bulleted_list_item": md += `- ${text}\n`; break;
      case "numbered_list_item": md += `1. ${text}\n`; break;
      case "paragraph": md += `${text}\n\n`; break;
      case "quote": md += `> ${text}\n\n`; break;
      case "divider": md += `---\n\n`; break;
      case "image": {
        const url = b.image?.file?.url || b.image?.external?.url || "";
        md += `![${b.image?.caption?.[0]?.plain_text || ""}](${url})\n\n`;
        break;
      }
      default: md += `${text}\n\n`;
    }
  }
  return md.trim();
}

async function queryAll(filter, sorts) {
  const results = [];
  let cursor = undefined;
  do {
    const body = { filter, sorts };
    if (cursor) body.start_cursor = cursor;
    const res = await notion(`/v1/databases/${DB_ID}/query`, "POST", body);
    results.push(...(res.results || []));
    cursor = res.has_more ? res.next_cursor : undefined;
  } while (cursor);
  return results;
}

async function sync() {
  console.log("Fetching posts from Notion...");

  // 1 post por run: el siguiente run procesa el siguiente "Ready" (control y revisión)
  const MAX_POSTS = 1;
  const filter = { property: "Status", select: { equals: "Ready" } };

  const pages = await queryAll(filter, [{ timestamp: "created_time", direction: "descending" }]);

  const today = new Date().toISOString().slice(0, 10);
  let count = 0;

  // Limpiar lista de posts nuevos del run anterior
  try { fs.unlinkSync("/tmp/new-posts.txt"); } catch {}

  for (const page of pages) {
    if (count >= MAX_POSTS) {
      console.log(`  Limit ${MAX_POSTS} reached, process remaining in next run`);
      break;
    }
    const props = page.properties;
    const title = props.Title?.title?.[0]?.plain_text || "";
    const slug = props.Slug?.rich_text?.[0]?.plain_text || "";
    const desc = props.Description?.rich_text?.[0]?.plain_text || "";
    const cat = props.Category?.select?.name || "";
    const author = props.Author?.select?.name || "UserDesigners";
    const tags = props.Tags?.multi_select?.map(t => t.name) || [];
    const heroImg = props["Hero Image"]?.url || "";
    const date = props.Date?.date?.start || page.created_time.slice(0, 10);

    if (!slug) { console.log(`SKIP ${title}: no slug`); continue; }

    console.log(`  Syncing: ${slug}...`);

    let content = "";
    try {
      const blocks = await getBlocks(page.id);
      content = blocksToMarkdown(blocks.results);
    } catch (e) {
      console.log(`  blocks error: ${e.message}, using Content property`);
    }
    if (!content.trim()) {
      content = props.Content?.rich_text?.[0]?.plain_text || "";
    }

    let description = desc;
    if (!description.trim()) {
      const clean = content.replace(/[#>*`-]/g, "").replace(/\s+/g, " ").trim();
      description = clean.slice(0, 155) + (clean.length > 155 ? "…" : "");
    }

    let imgExt = "jpg";
    let imgPath = heroImg && !heroImg.startsWith("http") ? heroImg : "";
    let imgSource = "";
    if (heroImg && heroImg.startsWith("http")) {
      imgSource = heroImg;
      try {
        const imgData = await fetch(heroImg);
        if (imgData.ok) {
          const ct = imgData.headers.get("content-type") || "";
          if (ct.includes("png")) imgExt = "png";
          else if (ct.includes("webp")) imgExt = "webp";
          const buf = Buffer.from(await imgData.arrayBuffer());
          fs.writeFileSync(`public/assets/blog/${slug}.${imgExt}`, buf);
          imgPath = `/assets/blog/${slug}.${imgExt}`;
          console.log(`  img downloaded (${imgExt})`);
        }
      } catch (e) { console.log(`  img download failed: ${e.message}`); }
    }

    const wordCount = content.split(/\s+/).filter(Boolean).length;
    const readTime = `${Math.max(1, Math.ceil(wordCount / 200))} min`;

    const md = `---
title: "${title.replace(/"/g, '\\"')}"
description: "${description.replace(/"/g, '\\"')}"
category: "${cat}"
author: "${author}"
tags: [${tags.map(t => `"${t.replace(/"/g, '\\"')}"`).join(", ")}]
heroImage: "${imgPath || ""}"
heroImageSource: "${imgSource.replace(/"/g, '\\"')}"
date: "${date}"
readTime: "${readTime}"
notionId: "${page.id}"
---

${content}
`;
  fs.mkdirSync("src/content/blog", { recursive: true });
  fs.mkdirSync("public/assets/blog", { recursive: true });
  fs.writeFileSync(`src/content/blog/${slug}.md`, md);

  // Registrar slugs nuevos para que la validación SEO corra solo sobre estos
  fs.appendFileSync("/tmp/new-posts.txt", `${slug}\n`);
  count++;

    // NO marcar Published acá — el archivo local todavía puede ser excluido
    // por validate-blog-seo.mjs más adelante en el pipeline. Ese script es
    // quien decide el Status final (Published si pasa, Ready si no).
    await notion(`/v1/pages/${page.id}`, "PATCH", {
      properties: {
        "Last Synced": { date: { start: today } },
      },
    });
  }

  console.log(`Synced ${count} posts`);

  // Delete archived posts
  const archivedPages = await queryAll(
    { property: "Status", select: { equals: "Archived" } },
    []
  );

  let deleted = 0;
  for (const page of archivedPages) {
    const slug = page.properties.Slug?.rich_text?.[0]?.plain_text || "";
    if (!slug) continue;
    const mdPath = `src/content/blog/${slug}.md`;
    const imgPath = `public/assets/blog/${slug}.jpg`;
    if (fs.existsSync(mdPath)) { fs.unlinkSync(mdPath); console.log(`  Deleted: ${slug}`); }
    if (fs.existsSync(imgPath)) { fs.unlinkSync(imgPath); }
    deleted++;
  }
  console.log(`Synced ${count} posts, deleted ${deleted}`);
}

sync().catch((e) => { console.error(e); process.exit(1); });