// regenerate-home-native.mjs
// Regenera src/html/home-native.html desde src/html/index.html (original Framer)
// con transformación mecánica 1:1 — NO recorta contenido, solo renombra.
// Uso: node scripts/regenerate-home-native.mjs
import fs from "fs";

const src = "src/html/index.html";
const out = "src/html/home-native.html";

let html = fs.readFileSync(src, "utf-8");

// A) Quitar <style> blocks (el CSS vive en public/home.css ya renombrado)
html = html.replace(/<style[^>]*>[\s\S]*?<\/style>/g, "");

// B) Quitar scripts por atributo específico (regex sobre el tag, no el contenido)
html = html.replace(/<script[^>]*src="[^"]*framerusercontent[^"]*"[^>]*>\s*<\/script>/g, "");
html = html.replace(/<script[^>]*src="[^"]*framer\.js[^"]*"[^>]*>\s*<\/script>/g, "");
html = html.replace(/<script[^>]*__framer__[^>]*>[\s\S]*?<\/script>/g, "");
html = html.replace(/<script[^>]*data-ud-appear-animation[^>]*>[\s\S]*?<\/script>/g, "");

// C) Quitar links/metas de Framer (por el tag completo)
html = html.replace(/<link[^>]*framer[^>]*>/g, "");
html = html.replace(/<meta[^>]*framer[^>]*>/g, "");

// D) Renombrar clases framer-* → ud-*  dentro de class="..."
html = html.replace(/class="([^"]*)"/g, (m, cls) => {
  const renamed = cls
    .split(/\s+/)
    .map((c) => (c.startsWith("framer-") ? "ud-" + c.slice(7) : c))
    .join(" ");
  return `class="${renamed}"`;
});

// E) data-framer-* → data-ud-*
html = html.replace(/data-framer-/g, "data-ud-");

// F) Variables CSS --framer-* → --ud-*  (en styles inline)
html = html.replace(/--framer-/g, "--ud-");

// G) URLs framerusercontent → local
html = html.replace(/https:\/\/framerusercontent\.com\/images\//g, "/assets/local/home/");

// H) Eliminar el header del navbar de Framer (el componente Navbar.astro lo reemplaza)
function removeNavbar(html) {
  // el nav ya fue renombrado a data-ud-name en E
  const i = html.indexOf('data-ud-name="Nav section"');
  if (i === -1) return html;
  const start = html.lastIndexOf("<section", i);
  if (start === -1) return html;
  let depth = 0;
  let pos = start;
  while (pos < html.length) {
    const openIdx = html.indexOf("<section", pos);
    const closeIdx = html.indexOf("</section>", pos);
    if (openIdx === -1 || (closeIdx !== -1 && closeIdx < openIdx)) {
      depth -= 1;
      pos = closeIdx + "</section>".length;
      if (depth === 0) return html.slice(0, start) + html.slice(pos);
    } else {
      depth += 1;
      pos = openIdx + "<section".length;
    }
  }
  return html;
}
html = removeNavbar(html);

// H2) Eliminar el footer de Framer (el componente Footer.astro lo reemplaza)
function removeFooter(html) {
  const i = html.indexOf("<footer");
  if (i === -1) return html;
  const end = html.indexOf("</footer>", i);
  if (end === -1) return html;
  return html.slice(0, i) + html.slice(end + "</footer>".length);
}
html = removeFooter(html);

// I) Eliminar el script inline del player que quedó suelto (contiene _framer/animator),
//    buscando por el cierre correcto: es el ÚLTIMO <script> del body y contiene "Appear".
//    Lo removemos con un parse manual por pares <script>...</script>.
function removePlayerScript(html) {
  const out = [];
  let idx = 0;
  const re = /<script\b[^>]*>/g;
  let m;
  while ((m = re.exec(html)) !== null) {
    const openStart = m.index;
    const openEnd = re.lastIndex;
    const close = html.indexOf("</script>", openEnd);
    if (close === -1) break;
    const content = html.slice(openEnd, close);
    const isPlayer =
      content.includes("__framer_disable_appear") ||
      content.includes("__Appear_Animation") ||
      content.includes('"__Appear_Animation_Transform__"') ||
      content.includes("framer-appear");
    if (isPlayer) {
      out.push(html.slice(idx, openStart));
      idx = close + "</script>".length;
    }
  }
  out.push(html.slice(idx));
  return out.join("");
}
html = removePlayerScript(html);

// J) Eliminar los scripts inline del player de Framer que quedaron en el body:
//    animator, framer_variant, estados de aparecer, svg defs inline, y cualquier
//    script del player. Se conservan: analytics (GA4, Clarity, Sentry, SA) y schema.
function removeAllPlayerScripts(html) {
  const out = [];
  let idx = 0;
  const re = /<script\b[^>]*>/g;
  let m;
  while ((m = re.exec(html)) !== null) {
    const openStart = m.index;
    const openEnd = re.lastIndex;
    const openTag = html.slice(openStart, openEnd);
    const close = html.indexOf("</script>", openEnd);
    if (close === -1) break;
    const content = html.slice(openEnd, close);
    const src = /src=/.test(openTag);
    const isPlayer =
      !src && (
        content.includes("animator") ||
        content.includes("framer_variant") ||
        content.includes("framer-appear") ||
        content.includes("__framer") ||
        content.includes("svgContainer") ||
        content.includes("Appear_Animation") ||
        content.includes("window.process") ||
        content.includes("history.pushState") ||
        content.includes('document.body.appendChild(r),r.click') ||
        content.includes("Date.prototype.toLocaleString") ||
        content.includes("data-fid")
      );
    if (isPlayer) {
      out.push(html.slice(idx, openStart));
      idx = close + "</script>".length;
    }
  }
  out.push(html.slice(idx));
  return out.join("");
}
html = removeAllPlayerScripts(html);

fs.writeFileSync(out, html);
console.log(`Regenerado: ${out}`);
console.log(`  tamaño: ${(fs.statSync(out).size / 1024).toFixed(0)}KB`);
