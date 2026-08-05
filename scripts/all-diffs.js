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

// Compare all differences
const maxLen = Math.max(idxFooter.length, blgFooter.length);
const diffs = [];
let i = 0, j = 0;
while (i < idxFooter.length || j < blgFooter.length) {
  if (idxFooter[i] !== blgFooter[j]) {
    const start = Math.max(0, i - 30);
    const idxEnd = Math.min(idxFooter.length, i + 80);
    const blgEnd = Math.min(blgFooter.length, j + 80);
    diffs.push({
      pos: i,
      idx: JSON.stringify(idxFooter.substring(start, idxEnd)),
      blg: JSON.stringify(blgFooter.substring(start, blgEnd))
    });
    if (diffs.length > 5) break;
    i++; j++;
  } else {
    i++; j++;
  }
}

console.log(`Total diffs (truncated to 6):`);
diffs.forEach((d, n) => {
  console.log(`\nDiff ${n+1} at pos ${d.pos}:`);
  console.log(`  IDX: ${d.idx}`);
  console.log(`  BLG: ${d.blg}`);
});

// Also analyze breakpoints used
const bpIdx = idxMain.match(/data-framer-breakpoint="[^"]+"/g) || [];
const bpBlg = blgMain.match(/data-framer-breakpoint="[^"]+"/g) || [];
console.log("\nBreakpoints INDEX:", [...new Set(bpIdx)].join(", "));
console.log("Breakpoints BLOG:", [...new Set(bpBlg)].join(", "));
