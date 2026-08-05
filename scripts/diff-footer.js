import fs from "fs";

const index = fs.readFileSync("public/index-content.html", "utf-8");
const blog = fs.readFileSync("public/blog-content.html", "utf-8");

function getMainLine(html) {
  const lines = html.split("\n");
  let max = "";
  for (const l of lines) if (l.length > max.length) max = l;
  return max;
}

const idxMain = getMainLine(index);
const blgMain = getMainLine(blog);

const idxFooterStart = idxMain.indexOf('<footer class="framer-WOlJs');
const blgFooterStart = blgMain.indexOf('<footer class="framer-WOlJs');
const idxFooterEnd = idxMain.lastIndexOf('</footer>');
const blgFooterEnd = blgMain.lastIndexOf('</footer>');

const idxFooter = idxMain.substring(idxFooterStart, idxFooterEnd + 9);
const blgFooter = blgMain.substring(blgFooterStart, blgFooterEnd + 9);

console.log("INDEX footer:", idxFooter.length, "chars");
console.log("BLOG footer:", blgFooter.length, "chars");
console.log("Difference:", idxFooter.length - blgFooter.length, "chars\n");

// Find the diff: first 1000 chars
console.log("=== INDEX footer first 800 ===");
console.log(idxFooter.substring(0, 800));
console.log("\n=== BLOG footer first 800 ===");
console.log(blgFooter.substring(0, 800));

// Check differences near the SocialProof area (around where Company Info column is)
const companyIdx = idxFooter.indexOf("Company Info");
const companyBlg = blgFooter.indexOf("Company Info");
console.log("\n=== INDEX around Company Info ===");
console.log(idxFooter.substring(companyIdx - 50, companyIdx + 300));
console.log("\n=== BLOG around Company Info ===");
console.log(blgFooter.substring(companyBlg - 50, companyBlg + 300));
