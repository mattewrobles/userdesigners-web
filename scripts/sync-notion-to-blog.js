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
      default: md += `${text}\n\n`;
    }
  }
  return md.trim();
}

async function sync() {
  console.log("Fetching posts from Notion...");
  const db = await notion(`/v1/databases/${DB_ID}/query`, "POST", {
    filter: { property: "Status", select: { equals: "Published" } },
    sorts: [{ property: "Title", direction: "ascending" }],
  });

  let count = 0;
  for (const page of db.results) {
    const props = page.properties;
    const title = props.Title?.title?.[0]?.plain_text || "";
    const slug = props.Slug?.rich_text?.[0]?.plain_text || "";
    const desc = props.Description?.rich_text?.[0]?.plain_text || "";
    const cat = props.Category?.select?.name || "";
    const heroImg = props["Hero Image"]?.url || "";
    const date = page.created_time.slice(0, 10);

    if (!slug) { console.log(`SKIP ${title}: no slug`); continue; }

    console.log(`  ${slug}...`);
    // Content from page blocks + Content property fallback
    let content = "";
    try {
      const blocks = await getBlocks(page.id);
      content = blocksToMarkdown(blocks.results);
    } catch (e) {
      console.log(`  blocks error: ${e.message}`);
    }
    if (!content.trim()) {
      const contentProp = props.Content?.rich_text?.[0]?.plain_text || "";
      content = contentProp;
    }

    const imgPath = (heroImg && heroImg.startsWith("http")) ? `/assets/blog/${slug}.jpg` : heroImg;
    if (heroImg && heroImg.startsWith("http")) {
      try {
        const imgData = await fetch(heroImg);
        if (imgData.ok) {
          const buf = Buffer.from(await imgData.arrayBuffer());
          fs.writeFileSync(`public/assets/blog/${slug}.jpg`, buf);
        }
      } catch (e) { console.log(`  img download failed: ${e.message}`); }
    }

    const md = `---
title: "${title.replace(/"/g, '\\"')}"
description: "${desc.replace(/"/g, '\\"')}"
category: "${cat}"
heroImage: "${imgPath}"
date: "${date}"
readTime: "3 min"
---

${content}
`;
    fs.writeFileSync(`src/content/blog/${slug}.md`, md);
    count++;
  }
  console.log(`Synced ${count} posts`);
}

sync().catch((e) => { console.error(e); process.exit(1); });