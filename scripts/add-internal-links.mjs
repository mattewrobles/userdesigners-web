// Inyecta links internos ("Artículos relacionados") en los posts del blog.
// Mejora el SEO interno y la retención: enlaza 2-3 posts de la misma categoría.
// Idempotente: solo agrega si el post no tiene ya el bloque.
import fs from "fs";
import path from "path";

const BLOG_DIR = "src/content/blog";
const MARKER = "<!-- related-posts -->";

if (!fs.existsSync(BLOG_DIR)) {
  console.log("No blog dir");
  process.exit(0);
}

const files = fs.readdirSync(BLOG_DIR).filter((f) => f.endsWith(".md"));
const posts = [];

for (const f of files) {
  const content = fs.readFileSync(path.join(BLOG_DIR, f), "utf-8");
  const fm = content.match(/^---\n([\s\S]*?)\n---/);
  if (!fm) continue;
  const slug = f.replace(/\.md$/, "");
  const title = (fm[1].match(/^title: "?(.+?)"?$/m) || [])[1] || slug;
  const cat = (fm[1].match(/^category: "?(.+?)"?$/m) || [])[1] || "";
  posts.push({ slug, title, cat, content });
}

let added = 0;

for (const post of posts) {
  if (post.content.includes(MARKER)) continue;

  const related = posts
    .filter((p) => p.slug !== post.slug && p.cat && p.cat === post.cat)
    .slice(0, 3);
  if (related.length === 0) continue;

  const block = `\n\n${MARKER}\n## Artículos relacionados\n\n` +
    related.map((r) => `- [${r.title}](/blog/${r.slug}/)`).join("\n") +
    "\n";

  fs.writeFileSync(path.join(BLOG_DIR, `${post.slug}.md`), post.content + block);
  added++;
  console.log(`  ✓ ${post.slug} + ${related.length} links`);
}

console.log(`Added related-posts links to ${added} post(s)`);
