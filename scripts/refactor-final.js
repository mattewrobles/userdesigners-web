import fs from "fs";

const PUBLIC = "public";
const SRC = "src/components";
const LAYOUTS = "src/layouts";
const STYLES = "src/styles";

// ============================================================
// Helpers
// ============================================================

function getMainLine(html) {
  const lines = html.split("\n");
  let max = "";
  for (const l of lines) if (l.length > max.length) max = l;
  return max;
}

function extractFramerBody(html) {
  // Extract everything from <body...> to </body>, excluding the nav section and footer
  const bodyStart = html.indexOf("<body");
  const bodyEnd = html.lastIndexOf("</body>");
  if (bodyStart === -1 || bodyEnd === -1) return null;
  
  const bodyContentStart = html.indexOf(">", bodyStart) + 1;
  let bodyContent = html.substring(bodyContentStart, bodyEnd);
  
  return bodyContent;
}

// ============================================================
// 1. Read source files
// ============================================================

const idxHtml = fs.readFileSync(`${PUBLIC}/index-content.html`, "utf-8");
const blgHtml = fs.readFileSync(`${PUBLIC}/blog-content.html`, "utf-8");

const idxMain = getMainLine(idxHtml);
const blgMain = getMainLine(blgHtml);

// ============================================================
// 2. Extract Navbar
// ============================================================

const navStartMarker = '<section class="framer-1a324ws"';
const navStart = idxMain.indexOf(navStartMarker);
const navEnd = idxMain.indexOf("</section>", navStart) + "</section>".length;
const navbarHTML = idxMain.substring(navStart, navEnd);
console.log(`Navbar: ${navbarHTML.length} chars`);

// ============================================================
// 3. Extract Footer
// ============================================================

const footerStartMarker = '<footer class="framer-WOlJs';
const footerStart = blgMain.indexOf(footerStartMarker);
const footerEnd = blgMain.lastIndexOf("</footer>") + "</footer>".length;
const footerHTML = blgMain.substring(footerStart, footerEnd);
console.log(`Footer: ${footerHTML.length} chars`);

// ============================================================
// 4. Write Navbar.astro
// ============================================================

if (!fs.existsSync(SRC)) fs.mkdirSync(SRC, { recursive: true });

fs.writeFileSync(`${SRC}/Navbar.astro`, navbarHTML);
console.log("Navbar.astro written");

// ============================================================
// 5. Write Footer.astro  
// ============================================================

fs.writeFileSync(`${SRC}/Footer.astro`, footerHTML);
console.log("Footer.astro written");

// ============================================================
// 6. Extract global CSS from index head
// ============================================================

const headStart = idxHtml.indexOf("<head>");
const headEnd = idxHtml.indexOf("</head>") + "</head>".length;
const headHTML = idxHtml.substring(headStart, headEnd);

// Extract all font CSS
const fontBlocks = headHTML.match(/<style data-framer-font-css="">[\s\S]*?<\/style>/g) || [];

// Extract the big merged CSS
const mergeCSS = headHTML.match(/<style data-framer-css-merge[^>]*>[\s\S]*?<\/style>/);
const mergeBlock = mergeCSS ? mergeCSS[0] : "";

if (!fs.existsSync(STYLES)) fs.mkdirSync(STYLES, { recursive: true });

const globalCSS = fontBlocks.join("\n") + "\n" + mergeBlock;
fs.writeFileSync(`${STYLES}/framer.css`, globalCSS);
console.log(`Global CSS: ${globalCSS.length} chars`);

// ============================================================
// 7. Update BaseLayout.astro
// ============================================================

const baseLayoutContent = `---
import Navbar from "../components/Navbar.astro";
import Footer from "../components/Footer.astro";

const { 
  title = "UserDesigners / Agencia de UX UI", 
  description = "Agencia de Experiencia de Usuario y diseño de Interfaz UX UI especializada en Bancos y Fintechs. 12 años de experiencia"
} = Astro.props;
---

<!doctype html>
<html lang="es-EC">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta name="generator" content="Astro + Framer">
  <title>{title}</title>
  <meta name="description" content={description}>
  <meta name="framer-search-index" content="/assets/local/searchIndex-LqXxUI8iFOYO.json">
  <meta name="framer-search-index-fallback" content="/assets/local/searchIndex-arPwJvNVXdwl.json">
  <link rel="icon" type="image/png" href="/assets/local/o5LtTMyVT0hoY6m1F1q3smw3kq4.png">
  <link rel="canonical" href={Astro.url.href}>
  <meta property="og:type" content="website">
  <meta property="og:title" content={title}>
  <meta property="og:description" content={description}>
  <meta property="og:image" content="/assets/local/bUYh6jy5kjctf6KEV3vRnONhegI.png">
  <meta property="og:url" content={Astro.url.href}>
  <meta name="twitter:card" content="summary_large_image">
  <meta name="twitter:title" content={title}>
  <meta name="twitter:description" content={description}>
  <meta name="twitter:image" content="/assets/local/bUYh6jy5kjctf6KEV3vRnONhegI.png">
  <link rel="alternate" type="application/rss+xml" title="UserDesigners Blog" href="/rss.xml">
</head>
<body style="margin:0">
  <Navbar />
  <slot />
  <Footer />
</body>
</html>
`;

fs.writeFileSync(`${LAYOUTS}/BaseLayout.astro`, baseLayoutContent);
console.log("BaseLayout.astro updated");

// ============================================================
// 8. Process content HTMLs: extract just the body content
//    (strip nav section, footer, doctype, head, body tags)
// ============================================================

const contentFiles = fs.readdirSync(PUBLIC).filter(f => f.endsWith("-content.html"));

for (const file of contentFiles) {
  const html = fs.readFileSync(`${PUBLIC}/${file}`, "utf-8");
  const mainLine = getMainLine(html);

  const nsIdx = mainLine.indexOf(navStartMarker);
  const neIdx = mainLine.indexOf("</section>", nsIdx) + "</section>".length;
  const ftIdx = mainLine.indexOf(footerStartMarker);
  const feIdx = mainLine.lastIndexOf("</footer>") + "</footer>".length;

  if (nsIdx === -1 || ftIdx === -1) {
    console.log(`SKIP ${file}: markers not found`);
    continue;
  }

  // Content is between nav end and footer start
  const content = mainLine.substring(neIdx, ftIdx);
  
  // Wrapper: from data-framer-root div to close
  const rootOpen = mainLine.substring(0, nsIdx).match(/<div class="framer-tqfFO[^"]*"[^>]*>/);
  const rootStyle = mainLine.match(/<style data-framer-html-style="">[^<]*<\/style>/);
  
  // Build the fragment: root div + style + content + close root div
  const wrapper = rootOpen ? rootOpen[0] : '';
  const style = rootStyle ? rootStyle[0] : '';
  const bodyContent = wrapper + style + content + "</div>";

  const outFile = file.replace("-content", "-body");
  fs.writeFileSync(`${PUBLIC}/${outFile}`, bodyContent);
  console.log(`${file} → ${outFile} (${bodyContent.length} chars)`);
}

console.log("\n=== NEXT STEPS ===");
console.log("1. Update each page.astro to use BaseLayout:");
console.log("2. Run: npm run build && npm run dev");
