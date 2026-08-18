/**
 * Reemplazos comunes a las 3 páginas migradas 1:1 desde HTML de Framer
 * (index, servicios, nosotros) para forzar visibilidad de los estados de
 * entrada que el player de Framer animaba (opacity/transform/filter).
 * Cada página aplica ADEMÁS sus propios reemplazos específicos (variantes de
 * breakpoint, transforms de translateX de layout, visibility:hidden, etc.)
 * después de llamar a este helper.
 */
export function sanitizeFramerHtml(html: string): string {
  return html
    .replace(/opacity:\s*0\.001/gi, "opacity:1")
    .replace(/opacity:\s*0;/gi, "opacity:1;")
    .replace(/opacity:0(?!\d)/gi, "opacity:1")
    .replace(/transform:\s*perspective\([^)]*\)\s*translateY\([^)]*\)/gi, "transform:none")
    .replace(/filter:\s*blur\(10px\)/gi, "filter:none");
}
