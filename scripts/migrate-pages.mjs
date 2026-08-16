// migrate-pages.mjs — transforma cada página HTML de Framer a versión nativa:
//   - renombra clases framer-* → ud-*, data-framer-* → data-ud-*, --framer-* → --ud-*
//   - URLs framerusercontent → /assets/local/
//   - elimina scripts del player de Framer (appear, breakpoints, preserve-internal)
//   - conserva analytics (GA4, Clarity, Sentry, SA) y schema
// Uso: node scripts/migrate-pages.mjs
import fs from "fs";

const PAGES = ["servicios", "nosotros", "proyectos"];

function stripPlayerScripts(html) {
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
        openTag.includes("data-preserve-internal-params") ||
        openTag.includes('id="__framer__') ||
        openTag.includes('data-framer-appear-animation')
      );
    if (isPlayer) {
      out.push(html.slice(idx, openStart));
      idx = close + "</script>".length;
    }
  }
  out.push(html.slice(idx));
  return out.join("");
}

for (const p of PAGES) {
  const src = `src/html/${p}.html`;
  const out = `src/html/${p}-native.html`;
  if (!fs.existsSync(src)) { console.log(`SKIP ${p} (no existe)`); continue; }

  let html = fs.readFileSync(src, "utf-8");

  // 1) NO quitar <style> — el CSS de la página va renombrado inline (igual que
  //    el original). Solo se renombran las clases dentro de los styles.
  // 2) quitar scripts del player
  html = stripPlayerScripts(html);

  // 3) renombrar clases (HTML y CSS)
  html = html.replace(/class="([^"]*)"/g, (m, cls) => {
    const renamed = cls
      .split(/\s+/)
      .map((c) => (c.startsWith("framer-") ? "ud-" + c.slice(7) : c))
      .join(" ");
    return `class="${renamed}"`;
  });
  // renombrar en CSS: selectores .framer-* → .ud-*
  html = html.replace(/\.framer-/g, ".ud-");

  // 4) data-framer-* → data-ud-*
  html = html.replace(/data-framer-/g, "data-ud-");

  // 5) --framer-* → --ud-*
  html = html.replace(/--framer-/g, "--ud-");

  // 6) URLs framerusercontent → local (sin query params de redimensionado)
  html = html.replace(/https:\/\/framerusercontent\.com\/images\//g, "/assets/local/");
  // 6b) quitar query params (?scale-down-to=...&width=...) de las rutas de assets
  html = html.replace(/(\/assets\/local\/[^"?]+)\?[^"'\s)]*/g, "$1");

  // 7) quitar links/metas de Framer y search index
  html = html.replace(/<link[^>]*framer[^>]*>/g, "");
  html = html.replace(/<meta[^>]*framer[^>]*>/g, "");
  html = html.replace(/<link[^>]*framer-search[^>]*>/g, "");

  // 8) eliminar el navbar de Framer (Navbar.astro lo reemplaza)
  function removeNavbar(h) {
    const i = h.indexOf('data-ud-name="Nav section"');
    if (i === -1) return h;
    const start = h.lastIndexOf("<section", i);
    if (start === -1) return h;
    let depth = 0, pos = start;
    while (pos < h.length) {
      const o = h.indexOf("<section", pos);
      const c = h.indexOf("</section>", pos);
      if (o === -1 || (c !== -1 && c < o)) {
        depth -= 1; pos = c + 10;
        if (depth === 0) return h.slice(0, start) + h.slice(pos);
      } else { depth += 1; pos = o + 8; }
    }
    return h;
  }
  html = removeNavbar(html);

  fs.writeFileSync(out, html);
  console.log(`${p}: ${(fs.statSync(src).size/1024).toFixed(0)}KB -> ${(fs.statSync(out).size/1024).toFixed(0)}KB`);
}
