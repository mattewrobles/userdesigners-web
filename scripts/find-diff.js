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

const idxFooter = idxMain.substring(idxFooterStart);
const blgFooter = blgMain.substring(blgFooterStart);

// Find the first difference
const minLen = Math.min(idxFooter.length, blgFooter.length);
let firstDiff = -1;
for (let i = 0; i < minLen; i++) {
  if (idxFooter[i] !== blgFooter[i]) { firstDiff = i; break; }
}

console.log("First difference at index:", firstDiff);
if (firstDiff >= 0) {
  console.log("INDEX context (from diff-50):", JSON.stringify(idxFooter.substring(firstDiff - 50, firstDiff + 150)));
  console.log("BLOG context (from diff-50):", JSON.stringify(blgFooter.substring(firstDiff - 50, firstDiff + 150)));
}
