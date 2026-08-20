// qa-check-ready-posts.mjs
// QA temprano: revisa TODOS los posts en Notion con Status=Ready y avisa a Slack
// de inmediato si alguno falla reglas críticas — sin esperar al sync semanal
// (que además solo procesa 1 post por corrida). Solo lee Notion, nunca escribe
// nada ahí ni en el repo.
import https from "https";
import { checkPost } from "./lib/seo-rules.mjs";

const NOTION_TOKEN = process.env.NOTION_TOKEN;
const DB_ID = process.env.NOTION_DB_ID;
const SLACK_TOKEN = process.env.SLACK_BOT_TOKEN;
const SLACK_CHANNEL = process.env.SLACK_CHANNEL || "C0BN01LMC3F";

if (!NOTION_TOKEN || !DB_ID) {
  console.error("Missing NOTION_TOKEN or NOTION_DB_ID env vars");
  process.exit(1);
}

function notion(path, method = "GET", body = null) {
  return new Promise((resolve, reject) => {
    const data = body ? JSON.stringify(body) : null;
    const opts = {
      hostname: "api.notion.com", path, method,
      headers: {
        Authorization: "Bearer " + NOTION_TOKEN,
        "Notion-Version": "2022-06-28",
        "Content-Type": "application/json",
        ...(data && { "Content-Length": Buffer.byteLength(data) }),
      },
    };
    const req = https.request(opts, (res) => {
      let d = "";
      res.on("data", (c) => (d += c));
      res.on("end", () => {
        try { resolve(JSON.parse(d)); } catch { reject(new Error(d.slice(0, 200))); }
      });
    });
    req.on("error", reject);
    if (data) req.write(data);
    req.end();
  });
}

function blocksToMarkdown(results) {
  let md = "";
  for (const b of results || []) {
    const t = b.type;
    const text = (b[t]?.rich_text || []).map((rt) => rt.plain_text).join("");
    if (!text.trim()) { md += "\n"; continue; }
    if (t === "heading_2") md += `## ${text}\n\n`;
    else if (t === "heading_3") md += `### ${text}\n\n`;
    else md += `${text}\n\n`;
  }
  return md.trim();
}

async function queryReady() {
  const results = [];
  let cursor;
  do {
    const body = { filter: { property: "Status", select: { equals: "Ready" } } };
    if (cursor) body.start_cursor = cursor;
    const res = await notion(`/v1/databases/${DB_ID}/query`, "POST", body);
    results.push(...(res.results || []));
    cursor = res.has_more ? res.next_cursor : undefined;
  } while (cursor);
  return results;
}

async function slackNotify(text) {
  if (!SLACK_TOKEN) { console.log("(SLACK_BOT_TOKEN no configurado, solo log)\n" + text); return; }
  await new Promise((resolve) => {
    const data = JSON.stringify({ channel: SLACK_CHANNEL, text });
    const req = https.request({
      hostname: "slack.com", path: "/api/chat.postMessage", method: "POST",
      headers: { Authorization: `Bearer ${SLACK_TOKEN}`, "Content-Type": "application/json", "Content-Length": Buffer.byteLength(data) },
    }, (res) => { res.on("data", () => {}); res.on("end", resolve); });
    req.on("error", () => resolve());
    req.write(data); req.end();
  });
}

async function main() {
  const pages = await queryReady();
  if (pages.length === 0) {
    console.log("No hay posts en Ready — nada que revisar");
    return;
  }

  const reportLines = [];
  let anyCritical = false;

  for (const page of pages) {
    const props = page.properties;
    const title = props.Title?.title?.[0]?.plain_text || "(sin título)";
    const slug = props.Slug?.rich_text?.[0]?.plain_text || page.id.slice(0, 8);
    const desc = props.Description?.rich_text?.[0]?.plain_text || "";
    const cat = props.Category?.select?.name || "";
    const hero = props["Hero Image"]?.url || "x";
    const tags = (props.Tags?.multi_select || []).map((t) => t.name).join(", ");

    let content = props.Content?.rich_text?.[0]?.plain_text || "";
    try {
      const blocks = await notion(`/v1/blocks/${page.id}/children?page_size=100`);
      const md = blocksToMarkdown(blocks.results);
      if (md.trim()) content = md;
    } catch { /* usa el fallback de la property Content */ }

    const fakeMd = `---\ntitle: "${title}"\ndescription: "${desc}"\ncategory: "${cat}"\ntags: "${tags}"\nheroImage: "${hero}"\n---\n\n${content}`;
    const { critical, warnings, geoWarnings } = checkPost(slug, fakeMd);

    if (critical.length > 0) {
      anyCritical = true;
      reportLines.push(`❌ *${title}* (${slug}) — ${critical.length} crítico(s):\n  ${critical.join("\n  ")}`);
    } else if (warnings.length + geoWarnings.length > 0) {
      reportLines.push(`⚠️ *${title}* (${slug}) — OK pero ${warnings.length} warning(s), ${geoWarnings.length} GEO: ${[...warnings, ...geoWarnings].slice(0, 3).join("; ")}`);
    } else {
      reportLines.push(`✅ *${title}* (${slug}) — sin observaciones`);
    }
  }

  const header = anyCritical
    ? `🚨 *QA Blog — posts en Ready con problemas críticos* (revisa antes del sync del lunes):`
    : `📋 *QA Blog — ${pages.length} post(s) en Ready, revisión temprana:`;
  const msg = `${header}\n\n${reportLines.join("\n\n")}`;
  console.log(msg);
  await slackNotify(msg);
}

main().catch((e) => { console.error(e); process.exit(1); });
