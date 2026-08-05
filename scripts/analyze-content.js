import fs from "fs";

const index = fs.readFileSync("public/index-content.html", "utf-8");
const blog = fs.readFileSync("public/blog-content.html", "utf-8");

// Extract the main Framer div line (largest line)
function getMainLine(html) {
  const lines = html.split("\n");
  let max = "";
  for (const l of lines) {
    if (l.length > max.length) max = l;
  }
  return max;
}

const idxMain = getMainLine(index);
const blgMain = getMainLine(blog);

// Find key markers
function analyze(name, content) {
  const navStart = content.indexOf('<section class="framer-1a324ws"');
  const footerStart = content.indexOf('<footer class="framer-WOlJs');
  const footerEnd = content.lastIndexOf('</footer>');
  const rootStart = content.indexOf('<div class="framer-tqfFO');
  
  console.log(`\n${name}:`);
  console.log(`  Total length: ${content.length}`);
  console.log(`  rootStart (framer-tqfFO): ${rootStart}`);
  console.log(`  navStart: ${navStart}`);
  console.log(`  footerStart: ${footerStart}`);
  console.log(`  footerEnd: ${footerEnd}`);
  console.log(`  Content area (nav end to footer): ${footerStart - navStart}`);

  if (rootStart >= 0 && navStart >= 0 && footerStart >= 0) {
    // Extract nav: from root to end of first </section> after navStart
    const afterNav = content.indexOf('</section>', navStart);
    console.log(`  Nav section end: ${afterNav}`);
    
    // Extract footer
    console.log(`  Footer chunk length: ${footerEnd + 8 - footerStart}`);
    
    // Content between nav end and footer
    const contentBetween = content.substring(afterNav + 10, footerStart);
    console.log(`  Content between nav & footer: ${contentBetween.length} chars`);
    console.log(`  Content starts with: ${contentBetween.substring(0, 80)}`);
  }
  
  // Show unique section names
  const sections = content.match(/data-framer-name="([^"]+)"/g) || [];
  const names = [...new Set(sections.map(s => s.match(/"([^"]+)"/)[1]))];
  console.log(`  Sections (${names.length}): ${names.join(", ")}`);
}

analyze("INDEX", idxMain);
analyze("BLOG", blgMain);

// Check: does index nav differ from blog nav?
const idxNavStart = idxMain.indexOf('<section class="framer-1a324ws"');
const blgNavStart = blgMain.indexOf('<section class="framer-1a324ws"');
const idxNavEnd = idxMain.indexOf('</section>', idxNavStart);
const blgNavEnd = blgMain.indexOf('</section>', blgNavStart);
const idxNav = idxMain.substring(idxNavStart, idxNavEnd + 10);
const blgNav = blgMain.substring(blgNavStart, blgNavEnd + 10);
console.log(`\nNav diff: index=${idxNav.length} blog=${blgNav.length}, same? ${idxNav === blgNav}`);
