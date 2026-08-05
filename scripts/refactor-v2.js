import fs from "fs";

const PUBLIC = "public";
const SRC = "src/components";
const LAYOUTS = "src/layouts";

// ============================================================
// 1. Extract navbar from index, footer from blog
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

// Nav section: from its start to its </section> close
const navStartMarker = '<section class="framer-1a324ws"';
const navStart = idxLine.indexOf(navStartMarker);
const navEnd = idxLine.indexOf("</section>", navStart) + "</section>".length;
const navbarHTML = idxLine.substring(navStart, navEnd);
console.log(`Navbar: ${navbarHTML.length} chars`);

// Footer: from <footer> to </footer>
const footerStartMarker = '<footer class="framer-WOlJs';
const footerStart = blgLine.indexOf(footerStartMarker);
const footerEnd = blgLine.lastIndexOf("</footer>") + "</footer>".length;
const footerHTML = blgLine.substring(footerStart, footerEnd);
console.log(`Footer: ${footerHTML.length} chars`);

// ============================================================
// 2. Extract Framer global CSS from head (fonts + base styles)
// ============================================================

const headMatch = idxHtml.match(/<style data-framer-css-merge[^>]*>([\s\S]*?)<\/style>/);
let framerCSS = "";
if (headMatch) {
  framerCSS = headMatch[0];
  console.log(`Framer CSS merge: ${framerCSS.length} chars`);
}

// Also grab the framer-font-css style blocks
const fontCSSMatches = idxHtml.match(/<style data-framer-font-css="">[\s\S]*?<\/style>/g) || [];
console.log(`Font CSS blocks: ${fontCSSMatches.length}`);

// And the framer-html-style
const htmlStyleMatch = idxMainLine?.match(/<style data-framer-html-style="">[^<]*<\/style>/);
let htmlStyle = "";
if (htmlStyleMatch) htmlStyle = htmlStyleMatch[0];

// ============================================================
// 3. Write Navbar.astro and Footer.astro
// ============================================================

if (!fs.existsSync(SRC)) fs.mkdirSync(SRC, { recursive: true });

fs.writeFileSync(`${SRC}/Navbar.astro`, `---
// Navbar — UserDesigners
---
<section class="framer-1a324ws" data-framer-name="Nav section" id="navbar">
  ${navbarHTML.replace(navStartMarker, "").replace(/^>/, "").replace(/<\/section>$/, "")}
</section>
`);

fs.writeFileSync(`${SRC}/Footer.astro`, `---
// Footer — UserDesigners
---
${footerHTML}
`);

console.log("Components written");

// ============================================================
// 4. Write global Framer CSS
// ============================================================

// Gather all unique font-face blocks
const allFontCSS = fontCSSMatches.join("\n");

fs.writeFileSync("src/styles/framer.css", `/* Framer global CSS — shared across all pages */
${allFontCSS}
${framerCSS}
`);
console.log("Global CSS written");

// ============================================================
// 5. Update BaseLayout.astro
// ============================================================

const baseLayout = `---
import Navbar from "../components/Navbar.astro";
import Footer from "../components/Footer.astro";

const { title = "UserDesigners / Agencia de UX UI", description = "Agencia de Experiencia de Usuario y diseño de Interfaz UX UI especializada en Bancos y Fintechs. 12 años de experiencia", ogImage = "/assets/local/bUYh6jy5kjctf6KEV3vRnONhegI.png", canonical = "" } = Astro.props;
import fs from "fs";
---

<!doctype html>
<html lang="es-EC">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta name="generator" content="Astro + Framer export">
  <title>{title}</title>
  <meta name="description" content={description}>
  <meta name="framer-search-index" content="/assets/local/searchIndex-LqXxUI8iFOYO.json">
  <meta name="framer-search-index-fallback" content="/assets/local/searchIndex-arPwJvNVXdwl.json">
  <link rel="icon" type="image/png" href="/assets/local/o5LtTMyVT0hoY6m1F1q3smw3kq4.png">
  <link rel="canonical" href={canonical || Astro.url.href}>
  <meta property="og:type" content="website">
  <meta property="og:title" content={title}>
  <meta property="og:description" content={description}>
  <meta property="og:image" content={ogImage}>
  <meta property="og:url" content={canonical || Astro.url.href}>
  <meta name="twitter:card" content="summary_large_image">
  <meta name="twitter:title" content={title}>
  <meta name="twitter:description" content={description}>
  <meta name="twitter:image" content={ogImage}>
  <link rel="alternate" type="application/rss+xml" title="UserDesigners Blog" href="/rss.xml">
  <style is:global>
    ${await fs.promises.readFile("src/styles/framer.css", "utf-8").then(c => c).catch(() => "")}
  </style>
</head>
<body style="margin:0">
  <Navbar />
  <slot />
  <Footer />
</body>
</html>
`;

fs.writeFileSync(`${LAYOUTS}/BaseLayout.astro`, baseLayout);
console.log("BaseLayout updated");

// ============================================================
// 6. Process all content HTMLs
// ============================================================

const contentFiles = fs.readdirSync(PUBLIC).filter(f => f.endsWith("-content.html"));

for (const file of contentFiles) {
  const html = fs.readFileSync(`${PUBLIC}/${file}`, "utf-8");
  const mainLine = getMainLine(html);

  // Extract only page-specific content: everything between nav section end and footer start
  const pageNavStart = mainLine.indexOf(navStartMarker);
  const pageNavEnd = mainLine.indexOf("</section>", pageNavStart) + "</section>".length;
  const pageFooterStart = mainLine.indexOf(footerStartMarker);

  if (pageNavStart === -1 || pageFooterStart === -1) {
    console.log(`SKIP ${file}: nav or footer not found`);
    continue;
  }

  // Content is: nav end to footer start, wrapped in root div
  const content = mainLine.substring(pageNavEnd, pageFooterStart);
  
  // Find the opening structure: from start of mainLine to navStart
  const beforeNav = mainLine.substring(0, pageNavStart);
  
  // Extract the root div opening + framer style
  const rootDivMatch = beforeNav.match(/(<div class="framer-tqfFO[^"]*"[^>]*>)/);
  const rootStyle = beforeNav.match(/<style data-framer-html-style="">[^<]*<\/style>/);
  
  // Find closing tags after footer
  const pageFooterEnd = mainLine.lastIndexOf("</footer>") + "</footer>".length;
  const afterFooter = mainLine.substring(pageFooterEnd);

  // Rebuild: just the content region with its wrapper
  const wrappedContent = (rootDivMatch ? rootDivMatch[1] : "") + content + "</div>";
  
  // Write stripped content to a new file
  const outFile = file.replace("-content", "-body");
  fs.writeFileSync(`${PUBLIC}/${outFile}`, wrappedContent);
  console.log(`Created: ${outFile} (${wrappedContent.length} chars)`);
}

console.log("\nDone! Content body files created.");
console.log("Now update each page .astro to use BaseLayout + body file.");
