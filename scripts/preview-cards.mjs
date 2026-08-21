// preview-cards.mjs
// Genera previews de TODOS los templates del Figma y las guarda en ~/Downloads
// organizadas POR CARPETA POR TEMPLATE, con las páginas de cada carrusel por
// separado (no todo en una sola imagen).
//
// Uso: node scripts/preview-cards.mjs [--dir ~/Downloads/cards]
//
// Estructura de salida:
//   <dir>/
//     template-01-carrusel-rojo/     cover.png, pagina-1.png..5.png, cierre.png
//     template-02-carrusel-claro/    cover.png, pagina-1..4.png, cierre.png
//     template-04-carrusel-violeta/  cover.png, pagina-1..5.png, cierre.png
//     template-05-carrusel-azul/     cover.png, pagina-1..3.png, cierre.png
//     post-portrait/                 post.png
//     post-saas/                     post.png
import fs from "fs";
import path from "path";
import os from "os";
import { generateCardImage, generateCarouselPages } from "./lib/social-card.mjs";

const outDir = process.argv[2] || path.join(os.homedir(), "Downloads", "cards-preview");
fs.mkdirSync(outDir, { recursive: true });

const HERO = "https://www.userdesigners.com/assets/local/THPlYhmIylZZQK7C2oB2vUpYec.png";
const TITLE = "La guía definitiva de UX para 2026";
const DESC =
  "Estudio de caso real sobre cómo rediseñamos el flujo de onboarding de un SaaS B2B y subimos la activación un 34% en 8 semanas.";

const POINTS = [
  {
    title: "El onboarding tenía 9 pasos",
    description: "Un 61% de los usuarios abandonaba justo en el paso 3, antes de llegar a activar la cuenta.",
  },
  {
    title: "Lo redujimos a 4 pasos",
    description: "Con progreso visible y microcopy claro en cada campo, sin perder ningún dato que necesitábamos.",
  },
  {
    title: "El resultado: +34% de activación",
    description: "Churn bajó 18% y el NPS subió de 21 a 47 en las primeras 8 semanas post-lanzamiento.",
  },
];

// Configuración de los carruseles por template
const CAROUSELS = [
  { template: "t01-red", dir: "template-01-carrusel-rojo", points: POINTS },
  { template: "t02-light", dir: "template-02-carrusel-claro", points: POINTS.slice(0, 2) },
  { template: "t04-violet-coral", dir: "template-04-carrusel-violeta", points: POINTS },
  { template: "t05-blue", dir: "template-05-carrusel-azul", points: POINTS },
];

const SINGLE_POSTS = [
  { template: "portrait-navy", dir: "post-portrait", format: "vertical" },
  { template: "saas-purple", dir: "post-saas", format: "square" },
];

function save(dir, name, buf) {
  fs.mkdirSync(dir, { recursive: true });
  const file = path.join(dir, name);
  fs.writeFileSync(file, buf);
  return file;
}

async function main() {
  // 1) Carruseles por template — cada carpeta tiene sus páginas separadas
  for (const c of CAROUSELS) {
    const dir = path.join(outDir, c.dir);
    try {
      const pages = await generateCarouselPages({
        title: TITLE,
        description: DESC,
        points: c.points,
        heroImageUrl: HERO,
        template: c.template,
      });
      const names = ["cover.png", ...pages.slice(1, -1).map((_, i) => `pagina-${i + 1}.png`), "cierre.png"];
      pages.forEach((png, i) => save(dir, names[i], png));
      console.log("✔ carrusel", c.template, "→", c.dir, `(${pages.length} páginas)`);
    } catch (e) {
      console.error("✘ carrusel", c.template, e.message);
    }
  }

  // 2) Posts sueltos (imagen única)
  for (const p of SINGLE_POSTS) {
    const dir = path.join(outDir, p.dir);
    try {
      const png = await generateCardImage({
        title: TITLE,
        description: DESC,
        heroImageUrl: HERO,
        format: p.format,
        template: p.template,
      });
      save(dir, "post.png", png);
      console.log("✔ post", p.template, "→", p.dir);
    } catch (e) {
      console.error("✘ post", p.template, e.message);
    }
  }

  console.log("\nListo. Previews organizadas en:", outDir);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
