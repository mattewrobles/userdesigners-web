import fs from "fs";
import path from "path";

const PUBLIC = "public";
const SRC = "src/components";
const LAYOUTS = "src/layouts";
const PAGES = "src/pages";

// ============================================================
// 1. Extract navbar from index and footer from blog
// ============================================================

function getMainLine(html) {
  const lines = html.split("\n");
  let max = "";
  for (const l of lines) if (l.length > max.length) max = l;
  return max;
}

const idxHtml = fs.readFileSync(`${PUBLIC}/index-content.html`, "utf-8");
const blgHtml = fs.readFileSync(`${PUBLIC}/blog-content.html`, "utf-8");

const idxLine = getMainLine(idxHtml);
const blgLine = getMainLine(blgHtml);

// Find nav: from <section class="framer-1a324ws"... to first </section>
const navStartMarker = '<section class="framer-1a324ws"';
const navStart = idxLine.indexOf(navStartMarker);
const navEnd = idxLine.indexOf("</section>", navStart) + "</section>".length;
const navbarHTML = idxLine.substring(navStart, navEnd);

console.log(`Navbar extracted: ${navbarHTML.length} chars`);

// Find footer in blog
const footerStartMarker = '<footer class="framer-WOlJs';
const footerStart = blgLine.indexOf(footerStartMarker);
const footerEnd = blgLine.lastIndexOf("</footer>") + "</footer>".length;
const footerHTML = blgLine.substring(footerStart, footerEnd);

console.log(`Footer extracted: ${footerHTML.length} chars`);

// ============================================================
// 2. Write Navbar.astro and Footer.astro
// ============================================================

if (!fs.existsSync(SRC)) fs.mkdirSync(SRC, { recursive: true });

const navbarComponent = `---
// Navbar — UserDesigners (extracted from Framer export)
---
${navbarHTML}
`;

const footerComponent = `---
// Footer — UserDesigners (extracted from Framer export)
---
${footerHTML}
`;

fs.writeFileSync(`${SRC}/Navbar.astro`, navbarComponent);
fs.writeFileSync(`${SRC}/Footer.astro`, footerComponent);
console.log("Components written: Navbar.astro, Footer.astro");

// ============================================================
// 3. Update BaseLayout.astro
// ============================================================

import Navbar from "../components/Navbar.astro";
import Footer from "../components/Footer.astro";
const baseLayout = `${"---"}
import fs from "fs";

const baseLayoutContent = `---
import Navbar from "../components/Navbar.astro";
import Footer from "../components/Footer.astro";
---

<!doctype html>
<html lang="es">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <link rel="icon" type="image/png" href="/assets/local/o5LtTMyVT0hoY6m1F1q3smw3kq4.png">
  <link rel="alternate" type="application/rss+xml" title="UserDesigners Blog" href="/rss.xml">
</head>
<body style="margin:0">
  <Navbar />
  <slot />
  <Footer />
</body>
</html>
`;

fs.writeFileSync("src/layouts/BaseLayout.astro", baseLayoutContent);
console.log("BaseLayout updated");

// ============================================================
// 4. For each content HTML, strip nav and footer, save content-only
// ============================================================

const contentFiles = fs.readdirSync(PUBLIC).filter(f => f.endsWith("-content.html"));

for (const file of contentFiles) {
  const html = fs.readFileSync(`${PUBLIC}/${file}`, "utf-8");
  const mainLine = getMainLine(html);

  // Find nav section and remove it
  const nsStart = mainLine.indexOf(navStartMarker);
  const nsEnd = mainLine.indexOf("</section>", nsStart) + "</section>".length;
  
  // Find footer and keep everything before it
  const ftStart = mainLine.indexOf(footerStartMarker);
  
  if (nsStart === -1 || ftStart === -1) {
    console.log(`SKIP ${file}: nav or footer not found`);
    continue;
  }

  // Content: everything before nav + after nav-end but before footer + everything after footer
  const beforeNav = mainLine.substring(0, nsStart);
  const afterNavBeforeFooter = mainLine.substring(nsEnd, ftStart);
  const afterFooter = mainLine.substring(footerEnd);
  
  // For the footer HTML we extracted from blog, replace it
  const newMainLine = beforeNav + afterNavBeforeFooter + footerHTML + afterFooter;

  // Reconstruct the full HTML: non-main lines + new main line
  const lines = html.split("\n");
  const newLines = lines.map(l => {
    if (l.length > 100000) return newMainLine;
    return l;
  });
  
  const newHtml = newLines.join("\n");
  
  // Write back to same file
  fs.writeFileSync(`${PUBLIC}/${file}`, newHtml);
  console.log(`Updated: ${file} (${afterNavBeforeFooter.length} chars content)`);
}

console.log("\nDone! All content HTMLs unified with shared navbar + footer.");
