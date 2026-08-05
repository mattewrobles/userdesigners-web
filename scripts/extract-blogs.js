import fs from "fs";

const blogs = fs.readdirSync("public/blog")
  .filter(f => f.endsWith(".html") && f !== "index.html")
  .map(f => f.replace(".html", ""));

for (const slug of blogs) {
  const html = fs.readFileSync("public/blog/" + slug + ".html", "utf-8");

  let title = slug;
  const tm = html.match(/<title>([^<]*?)(?:\||UserDesigners)/);
  if (tm) title = tm[1].trim();

  let desc = "";
  const dm = html.match(/name="description"[^>]*content="([^"]*)"/);
  if (dm) desc = dm[1];

  let ogImg = "";
  const im = html.match(/property="og:image"[^>]*content="([^"]*)"/);
  if (im) ogImg = im[1].replace(/&amp;/g, "&");

  let heroImg = "";
  const him = html.match(/data-framer-name="Banner"[^>]*>[\s\S]*?src="([^"]*)"/);
  if (him) heroImg = him[1];
  if (!heroImg) {
    const him2 = html.match(/data-framer-name="Image Container"[^>]*>[\s\S]*?src="([^"]*)"/);
    if (him2) heroImg = him2[1];
  }

  const contentMatch = html.match(/data-framer-name="Content \+ Newsletter"[\s\S]*?data-framer-name="Featured Articles"/);
  if (!contentMatch) { console.log("SKIP:", slug); continue; }

  const lines = contentMatch[0]
    .replace(/<style[^>]*>[\s\S]*?<\/style>/g, "")
    .replace(/<script[\s\S]*?<\/script>/g, "")
    .replace(/<br[^>]*?>/g, "\n")
    .replace(/<li[^>]*>/g, "\n- ")
    .replace(/<\/li>/g, "")
    .replace(/<[^>]*>/g, "\n")
    .split("\n")
    .map(l => l.trim())
    .filter(l => l.length > 0 && !l.startsWith("data-framer") && !l.startsWith("<!--") && !l.startsWith("Related") && l !== "Featured Articles");

  const content = lines.join("\n\n").replace(/\n{3,}/g, "\n\n").trim();

  let category = "UX Design";
  if (slug.includes("writing")) category = "UX Writing";
  if (slug.includes("prototipado")) category = "Product Design";
  if (slug.includes("design-system")) category = "Design Systems";
  if (slug.includes("auditoria")) category = "UX Research";
  if (slug.includes("mobile")) category = "Product Design";

  const md = `---
title: "${title}"
description: "${desc}"
category: "${category}"
heroImage: "${heroImg}"
ogImage: "${ogImg}"
date: "2026-07-22"
readTime: "3 min"
---

${content}
`;

  fs.writeFileSync("src/content/blog/" + slug + ".md", md);
  console.log("Created:", slug + ".md", "(" + content.length + " chars)");
}