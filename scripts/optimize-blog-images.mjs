// Optimiza las imágenes del blog después del sync desde Notion.
// Convierte a WebP (si el original es mayor), redimensiona a 1280px y
// comprime a calidad 75. Solo toca archivos que bajen de peso real.
import fs from "fs";
import path from "path";
import sharp from "sharp";

const BLOG_DIR = "public/assets/blog";

if (!fs.existsSync(BLOG_DIR)) {
  console.log("No blog assets dir");
  process.exit(0);
}

const files = fs.readdirSync(BLOG_DIR).filter((f) =>
  /\.(jpe?g|png|webp)$/i.test(f)
);

const MAX_WIDTH = 1280;
const QUALITY = 75;
let optimized = 0;
let saved = 0;

for (const f of files) {
  const src = path.join(BLOG_DIR, f);
  const stat = fs.statSync(src);
  if (stat.size < 1024) continue; // no tocar miniatas/íconos

  const pipeline = sharp(src).rotate().resize({
    width: MAX_WIDTH,
    withoutEnlargement: true,
  });

  const outName = f.replace(/\.(jpe?g|png|webp)$/i, ".jpg");
  const out = path.join(BLOG_DIR, outName);

  try {
    const buf = await pipeline.jpeg({ quality: QUALITY, mozjpeg: true }).toBuffer();
    if (buf.length < stat.size) {
      fs.writeFileSync(out, buf);
      if (out !== src) fs.unlinkSync(src);
      saved += stat.size - buf.length;
      optimized++;
      console.log(`  ✓ ${f} → ${outName} (${(stat.size / 1024).toFixed(0)}KB → ${(buf.length / 1024).toFixed(0)}KB)`);
    }
  } catch (e) {
    console.log(`  ✗ ${f}: ${e.message}`);
  }
}

console.log(`Optimized ${optimized} image(s), saved ${(saved / 1024).toFixed(0)}KB`);
