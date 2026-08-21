// social-card.mjs
// Genera las cards visuales para LinkedIn/X en código — reemplaza el Autofill API
// de Canva (cuota de plan estudiantil agotada). Renderiza con satori (HTML/CSS
// -> SVG) y rasteriza a PNG con @resvg/resvg-js. Gratis, sin cuota, corre
// entero en el mismo proceso de Node, sin depender de ninguna cuenta externa.
//
// Replica EXACTAMENTE los 6 templates de carousel de LinkedIn del Figma ("artes"),
// usando los colores y gradientes reales del archivo y los assets descargados
// (noise, iconos, logos). Tipografía unificada en el DS de UserDesigners:
//   - Display: Familjen Grotesk
//   - Body:    DM Sans
//
// Cada template tiene SU estructura de carrusel con páginas distintas:
//   - portada (cover), páginas de contenido (con número), y cierre.
//
// Formatos de salida soportados:
//   - "wide"     -> 1200x627  (1.91:1) imagen única, default
//   - "square"   -> 1200x1200 (1:1)
//   - "vertical" -> 1080x1350 (4:5)  (tamaño real del carrusel LinkedIn)
import fs from "fs";
import path from "path";
import https from "https";
import { fileURLToPath } from "url";
import satori from "satori";
import { Resvg } from "@resvg/resvg-js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const FONTS_DIR = path.join(__dirname, "fonts");
const LOGOS_DIR = path.join(__dirname, "logos");
const ASSETS_DIR = path.join(__dirname, "assets");

// Logos del DS de Users (completos, "U DSGNRS")
const LOGO_LIGHT = path.join(LOGOS_DIR, "logo-light.png");
const LOGO_DARK = path.join(LOGOS_DIR, "logo-dark.png");
const LOGO_ASPECT = 245 / 1581;

// Assets reales del Figma
const NOISE_PNG = path.join(ASSETS_DIR, "noise.png");
const ICON_EAST_PNG = path.join(ASSETS_DIR, "icon-east.png");
const SWIPER_PNG = path.join(ASSETS_DIR, "swiper.png");

const FORMATS = {
  wide: { w: 1200, h: 627 },
  square: { w: 1200, h: 1200 },
  vertical: { w: 1080, h: 1350 },
};

// ---------------------------------------------------------------------------
// Templates del Figma. Datos EXACTOS extraídos del archivo.
// "deco" describe las formas decorativas de fondo de cada uno.
// ---------------------------------------------------------------------------
const TEMPLATES = {
  // Carrusel template 05 — gris oscuro + gradientes azules + noise
  "t05-blue": {
    id: "t05-blue",
    label: "Carrusel 05 (azul)",
    bg: "#343434",
    text: "#ffffff",
    subtext: "rgba(255,255,255,0.78)",
    logo: LOGO_LIGHT,
    noise: true,
    accentLine: "#0041da",
    deco: [
      { kind: "ellipse", color: "#2f50ff", gradient: ["#2f50ff", "#8390ff"], right: "-12%", top: "5%", w: "55%", h: "55%" },
      { kind: "polygon", color: "#173cff", gradient: ["#173cff", "#d9d9d9"], left: "-10%", bottom: "-10%", w: "60%", h: "60%" },
    ],
  },

  // Carousel template 04 — negro + elipses violeta + coral
  "t04-violet-coral": {
    id: "t04-violet-coral",
    label: "Carousel 04 (violeta/coral)",
    bg: "#000000",
    text: "#ffffff",
    subtext: "rgba(255,255,255,0.75)",
    logo: LOGO_LIGHT,
    noise: true,
    accentLine: "#7c84fa",
    deco: [
      { kind: "ellipse", color: "#7c84fa", right: "-8%", top: "3%", w: "50%", h: "50%" },
      { kind: "ellipse", color: "#e66955", left: "-6%", bottom: "-10%", w: "58%", h: "58%" },
    ],
  },

  // Carousel template 01 — gradiente rojo sobre negro + noise
  "t01-red": {
    id: "t01-red",
    label: "Carousel 01 (gradiente rojo)",
    bg: "#030303",
    bgGradient: "linear-gradient(180deg, #030303 0%, #030303 55%, #ec505d 100%)",
    text: "#ffffff",
    subtext: "rgba(255,255,255,0.8)",
    logo: LOGO_LIGHT,
    noise: true,
    accentLine: "#ec505d",
    deco: [],
  },

  // Carousel template 02 — fondo claro + ellipse azul + botón rojo
  "t02-light": {
    id: "t02-light",
    label: "Carousel 02 (claro)",
    bg: "#ffffff",
    text: "#000000",
    subtext: "#565763",
    logo: LOGO_DARK,
    noise: false,
    accentLine: "#7ca2fa",
    cta: { bg: "#ec505d", text: "#ffffff" },
    deco: [
      { kind: "ellipse", color: "#7ca2fa", right: "-10%", top: "10%", w: "38%", h: "38%", opacity: 0.5 },
    ],
  },

  // Portrait — fondo azul noche + footer www
  "portrait-navy": {
    id: "portrait-navy",
    label: "Portrait (azul noche)",
    bg: "#0e141d",
    text: "#ffffff",
    subtext: "rgba(255,255,255,0.7)",
    logo: LOGO_LIGHT,
    noise: true,
    accentLine: "#2f50ff",
    deco: [
      { kind: "ellipse", color: "#2f50ff", gradient: ["#2f50ff", "#8390ff"], right: "-12%", top: "5%", w: "55%", h: "55%" },
      { kind: "polygon", color: "#173cff", gradient: ["#173cff", "#d9d9d9"], left: "-10%", bottom: "-10%", w: "60%", h: "60%" },
    ],
  },

  // SaaS testimonial — fondo negro + gradiente púrpura→coral + glass box
  "saas-purple": {
    id: "saas-purple",
    label: "SaaS testimonial (púrpura/coral)",
    bg: "#000000",
    text: "#ffffff",
    subtext: "rgba(255,255,255,0.8)",
    logo: LOGO_LIGHT,
    noise: false,
    accentLine: "#340073",
    deco: [
      { kind: "ellipse", color: "#360c9f", gradient: ["#340073", "#ffa28d"], right: "-15%", top: "-8%", w: "60%", h: "60%" },
    ],
  },
};

function downloadBuffer(url) {
  return new Promise((resolve, reject) => {
    https.get(url, (res) => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        downloadBuffer(res.headers.location).then(resolve, reject);
        return;
      }
      const chunks = [];
      res.on("data", (c) => chunks.push(c));
      res.on("end", () => resolve(Buffer.concat(chunks)));
      res.on("error", reject);
    }).on("error", reject);
  });
}

function truncate(text, max) {
  if (!text || text.length <= max) return text || "";
  return text.slice(0, max - 1).trim() + "…";
}

function dataUriFromBuffer(buf) {
  if (buf.length > 8 && buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4e && buf[3] === 0x47) {
    return `data:image/png;base64,${buf.toString("base64")}`;
  }
  return `data:image/jpeg;base64,${buf.toString("base64")}`;
}

// ---------------------------------------------------------------------------
// Construye las formas decorativas de fondo según el "deco" del template.
// ---------------------------------------------------------------------------
// Convierte un color hex/rgb en formato rgba con opacidad dada (para gradientes).
function hexToRgba(hex, alpha) {
  if (hex.startsWith("#") && hex.length === 7) {
    const r = parseInt(hex.slice(1, 3), 16);
    const g = parseInt(hex.slice(3, 5), 16);
    const b = parseInt(hex.slice(5, 7), 16);
    return `rgba(${r},${g},${b},${alpha})`;
  }
  return hex;
}

// Las formas del template Figma usan LAYER_BLUR (elipses/polygons con blur de
// 87-116px) para producir glows suaves, NO formas sólidas. satori no soporta
// filter:blur en elementos, así que simulamos el blur con un gradiente radial
// que degrada del color a transparente (se ve idéntico a un glow difuminado).
function buildDecoration(deco, w, h) {
  return deco.map((d) => {
    const base = {
      position: "absolute",
      ...(d.right !== undefined ? { right: d.right } : {}),
      ...(d.left !== undefined ? { left: d.left } : {}),
      ...(d.top !== undefined ? { top: d.top } : {}),
      ...(d.bottom !== undefined ? { bottom: d.bottom } : {}),
      width: d.w,
      height: d.h,
      ...(d.opacity !== undefined ? { opacity: d.opacity } : {}),
    };
    if (d.kind === "ellipse") {
      // Glow radial MUY difuminado: degrada del color al fondo desde el 30%,
      // para que se vea como blur ambiental suave (no círculo sólido). El
      // LAYER_BLUR del Figma (87-116px) produce exactamente esto.
      const c = d.color;
      const g0 = d.gradient ? hexToRgba(d.gradient[0], 0.55) : hexToRgba(c, 0.55);
      const g1 = d.gradient ? hexToRgba(d.gradient[1], 0.22) : hexToRgba(c, 0.22);
      const glow = `radial-gradient(circle, ${g0} 0%, ${g1} 35%, rgba(0,0,0,0) 65%)`;
      return { type: "div", props: { style: { ...base, borderRadius: "50%", background: glow, filter: "blur(40px)" } } };
    }
    if (d.kind === "polygon") {
      // Polígono con blur: gradiente lineal difuminado (de color fuerte a suave)
      const c1 = d.gradient ? d.gradient[0] : d.color;
      const c2 = d.gradient ? d.gradient[1] : hexToRgba(d.color, 0.4);
      return {
        type: "div",
        props: {
          style: {
            ...base,
            transform: "rotate(30deg)",
            background: `linear-gradient(135deg, ${hexToRgba(c1, 0.8)} 0%, ${hexToRgba(c2, 0.15)} 70%, transparent 100%)`,
            clipPath: "polygon(0% 0%, 100% 0%, 100% 100%)",
          },
        },
      };
    }
    if (d.kind === "gradient-vertical") {
      return {
        type: "div",
        props: {
          style: {
            position: "absolute",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: `linear-gradient(180deg, ${d.from} 0%, ${d.from} ${Math.round((1 - d.stopAt) * 100)}%, ${d.to} 100%)`,
          },
        },
      };
    }
    return null;
  }).filter(Boolean);
}

function buildNoise(noiseDataUri) {
  return {
    type: "div",
    props: {
      style: {
        position: "absolute",
        inset: 0,
        opacity: 0.14,
        backgroundImage: `url(${noiseDataUri})`,
        backgroundSize: "cover",
        backgroundRepeat: "no-repeat",
      },
    },
  };
}

// ---------------------------------------------------------------------------
// Renderiza una página del carrusel. `pageType` controla la estructura:
//   - "cover":   portada con título grande (sin número)
//   - "content": página de contenido con número gigante + título + body
//   - "close":   cierre con CTA "Lee más"
// ---------------------------------------------------------------------------
async function renderPage({ template, pageType, title, description, bigNumber, heroDataUri, logoDataUri, noiseDataUri, swiperDataUri, eastDataUri, fonts, pageNumber, totalPages, format = "vertical" }) {
  const { w, h } = FORMATS[format] || FORMATS.vertical;
  const isSquare = format === "square";
  const isWide = format === "wide";
  const pad = isSquare ? 72 : isWide ? 56 : 76;

  const decoration = buildDecoration(template.deco || [], w, h);

  const children = [
    ...decoration,
    ...(template.noise && noiseDataUri ? [buildNoise(noiseDataUri)] : []),
  ];

  // Contenido central según tipo de página
  const contentNode =
    pageType === "cover" ? (
      {
        type: "div",
        props: {
          style: {
            display: "flex",
            flexDirection: "column",
            gap: isWide ? "20px" : "28px",
            maxWidth: "100%",
          },
          children: [
            { type: "div", props: { style: { width: isWide ? "56px" : "76px", height: "6px", borderRadius: "3px", background: template.accentLine } } },
            {
              type: "div",
              props: {
                style: { fontFamily: "Familjen Grotesk", fontWeight: 700, fontSize: isWide ? "46px" : isSquare ? "60px" : "84px", lineHeight: 1.08, letterSpacing: "-0.02em", color: template.text },
                children: title,
              },
            },
            ...(description
              ? [
                  {
                    type: "div",
                    props: {
                      style: { fontFamily: "DM Sans", fontWeight: 400, fontSize: isWide ? "22px" : isSquare ? "30px" : "34px", lineHeight: 1.4, color: template.subtext, maxWidth: "86%" },
                      children: description,
                    },
                  },
                ]
              : []),
          ],
        },
      }
    ) : pageType === "content" ? (
      {
        type: "div",
        props: {
          style: { display: "flex", flexDirection: "column", gap: isWide ? "24px" : "32px", maxWidth: "100%", position: "relative" },
          children: [
            // Número gigante de fondo (si aplica)
            ...(bigNumber
              ? [
                  {
                    type: "div",
                    props: {
                      style: {
                        position: "absolute",
                        top: isWide ? "-20px" : "-90px",
                        right: isWide ? "-10px" : "0px",
                        fontFamily: "Familjen Grotesk",
                        fontWeight: 700,
                        fontSize: isWide ? "180px" : "300px",
                        lineHeight: 1,
                        color: template.text,
                        opacity: 0.08,
                      },
                      children: bigNumber,
                    },
                  },
                ]
              : []),
            { type: "div", props: { style: { width: isWide ? "56px" : "76px", height: "6px", borderRadius: "3px", background: template.accentLine } } },
            {
              type: "div",
              props: {
                style: { fontFamily: "Familjen Grotesk", fontWeight: 700, fontSize: isWide ? "42px" : isSquare ? "54px" : "70px", lineHeight: 1.12, letterSpacing: "-0.02em", color: template.text, maxWidth: "85%" },
                children: title,
              },
            },
            ...(description
              ? [
                  {
                    type: "div",
                    props: {
                      style: { fontFamily: "DM Sans", fontWeight: 400, fontSize: isWide ? "22px" : isSquare ? "28px" : "32px", lineHeight: 1.45, color: template.subtext, maxWidth: "88%" },
                      children: description,
                    },
                  },
                ]
              : []),
          ],
        },
      }
    ) : (
      // close — CTA "Lee más en nuestro blog"
      {
        type: "div",
        props: {
          style: { display: "flex", flexDirection: "column", gap: "24px", maxWidth: "100%", alignItems: "flex-start" },
          children: [
            {
              type: "div",
              props: {
                style: { fontFamily: "Familjen Grotesk", fontWeight: 700, fontSize: isWide ? "40px" : isSquare ? "54px" : "72px", lineHeight: 1.1, letterSpacing: "-0.02em", color: template.text },
                children: "Lee más en nuestro blog",
              },
            },
            {
              type: "div",
              props: {
                style: {
                  display: "flex",
                  flexDirection: "row",
                  alignItems: "center",
                  gap: "16px",
                  padding: isWide ? "16px 28px" : "24px 40px",
                  backgroundColor: template.cta ? template.cta.bg : template.accentLine,
                  borderRadius: "100px",
                  fontFamily: "DM Sans",
                  fontWeight: 600,
                  fontSize: isWide ? "20px" : "30px",
                  color: template.cta ? template.cta.text : "#ffffff",
                },
                children: "userdesigners.com/blog",
              },
            },
          ],
        },
      }
    );

  // Header: logo + contador de página
  const header = {
    type: "div",
    props: {
      style: { display: "flex", flexDirection: "row", alignItems: "center", justifyContent: "space-between", width: "100%" },
      children: [
        {
          type: "img",
          props: {
            src: logoDataUri,
            style: { width: isWide ? "150px" : isSquare ? "170px" : "180px", height: `${Math.round((isWide ? 150 : isSquare ? 170 : 180) * LOGO_ASPECT)}px` },
          },
        },
        ...(totalPages > 1
          ? [
              {
                type: "div",
                props: {
                  style: { fontFamily: "DM Sans", fontWeight: 500, fontSize: isWide ? "20px" : "28px", color: template.subtext },
                  children: `${pageNumber}/${totalPages}`,
                },
              },
            ]
          : []),
      ],
    },
  };

  // Footer: swiper (desliza) o flecha east según template
  let footer;
  if (pageType === "cover" && swiperDataUri) {
    footer = {
      type: "img",
      props: { src: swiperDataUri, style: { width: isWide ? "150px" : "210px", height: "auto" } },
    };
  } else if (pageType !== "close" && eastDataUri) {
    footer = {
      type: "img",
      props: { src: eastDataUri, style: { width: isWide ? "56px" : "88px", height: "auto" } },
    };
  } else {
    footer = {
      type: "div",
      props: { style: { fontFamily: "DM Sans", fontWeight: 500, fontSize: isWide ? "18px" : "26px", color: template.subtext }, children: "userdesigners.com/blog" },
    };
  }

  const rootStyle = {
    width: `${w}px`,
    height: `${h}px`,
    position: "relative",
    display: "flex",
    overflow: "hidden",
    fontFamily: "Familjen Grotesk",
  };
  if (template.bgGradient) {
    rootStyle.background = template.bgGradient;
  } else {
    rootStyle.backgroundColor = template.bg;
  }

  const tree = {
    type: "div",
    props: {
      style: rootStyle,
      children: [
        ...children,
        {
          type: "div",
          props: {
            style: {
              position: "relative",
              zIndex: 0,
              width: "100%",
              height: "100%",
              display: "flex",
              flexDirection: "column",
              justifyContent: "space-between",
              padding: `${pad}px`,
            },
            children: [header, contentNode, footer],
          },
        },
      ],
    },
  };

  const svg = await satori(tree, { width: w, height: h, fonts });
  const resvg = new Resvg(svg, { fitTo: { mode: "width", value: w * 2 } });
  return resvg.render().asPng();
}

// ---------------------------------------------------------------------------
// Carga los assets y fuentes necesarios para un render.
// ---------------------------------------------------------------------------
async function loadRenderDeps({ heroImageUrl }) {
  const [familjenBold, familjenSemi, dmSansReg, dmSansMed, logoLight, logoDark, noise, swiper, east, heroBuffer] = await Promise.all([
    fs.promises.readFile(path.join(FONTS_DIR, "FamiljenGrotesk-Bold.woff")),
    fs.promises.readFile(path.join(FONTS_DIR, "FamiljenGrotesk-SemiBold.woff")),
    fs.promises.readFile(path.join(FONTS_DIR, "DMSans-Regular.woff")),
    fs.promises.readFile(path.join(FONTS_DIR, "DMSans-Medium.woff")),
    fs.promises.readFile(LOGO_LIGHT),
    fs.promises.readFile(LOGO_DARK),
    fs.promises.readFile(NOISE_PNG),
    fs.promises.readFile(SWIPER_PNG),
    fs.promises.readFile(ICON_EAST_PNG),
    heroImageUrl ? downloadBuffer(heroImageUrl) : Promise.resolve(Buffer.alloc(0)),
  ]);
  return {
    fonts: [
      { name: "Familjen Grotesk", data: familjenBold, weight: 700, style: "normal" },
      { name: "Familjen Grotesk", data: familjenSemi, weight: 600, style: "normal" },
      { name: "DM Sans", data: dmSansReg, weight: 400, style: "normal" },
      { name: "DM Sans", data: dmSansMed, weight: 500, style: "normal" },
    ],
    logoLightDataUri: `data:image/png;base64,${logoLight.toString("base64")}`,
    logoDarkDataUri: `data:image/png;base64,${logoDark.toString("base64")}`,
    noiseDataUri: `data:image/png;base64,${noise.toString("base64")}`,
    swiperDataUri: `data:image/png;base64,${swiper.toString("base64")}`,
    eastDataUri: `data:image/png;base64,${east.toString("base64")}`,
    heroDataUri: heroBuffer.length ? dataUriFromBuffer(heroBuffer) : null,
  };
}

// ---------------------------------------------------------------------------
// API principal — genera una imagen única (cover) con un template.
//   generateCardImage({ title, description, heroImageUrl, format, template })
//   - format:   "wide" | "square" | "vertical"
//   - template: id del template (t05-blue, t04-violet-coral, ...) o undefined (rota)
// Devuelve un Buffer PNG.
// ---------------------------------------------------------------------------
export async function generateCardImage({ title, description, heroImageUrl, format = "wide", template: templateId } = {}) {
  if (!FORMATS[format]) format = "wide";
  const ids = Object.keys(TEMPLATES);
  const template = templateId ? TEMPLATES[templateId] || TEMPLATES[ids[0]] : TEMPLATES[ids[Math.floor(Math.random() * ids.length)]];
  const deps = await loadRenderDeps({ heroImageUrl });
  return renderPage({
    template,
    pageType: "cover",
    title: truncate(title, format === "vertical" ? 90 : 70),
    description: truncate(description, 220),
    logoDataUri: template.logo === LOGO_DARK ? deps.logoDarkDataUri : deps.logoLightDataUri,
    noiseDataUri: deps.noiseDataUri,
    swiperDataUri: deps.swiperDataUri,
    eastDataUri: deps.eastDataUri,
    heroDataUri: deps.heroDataUri,
    fonts: deps.fonts,
    pageNumber: 1,
    totalPages: 1,
    format,
  });
}

// ---------------------------------------------------------------------------
// API para carrusel — genera las páginas de un carrusel como PNGs.
//   generateCarouselPages({ title, description, points, heroImageUrl, template })
//   - points:   array de strings (cada uno es el "punto" de una página de contenido)
//   - template: id del template (o undefined para rotar)
// Devuelve un array de Buffers PNG (1080x1350 c/u): [cover, content1..n, close]
// ---------------------------------------------------------------------------
export async function generateCarouselPages({ title, description, points = [], heroImageUrl, template: templateId } = {}) {
  const ids = Object.keys(TEMPLATES);
  const template = templateId ? TEMPLATES[templateId] || TEMPLATES[ids[0]] : TEMPLATES[ids[Math.floor(Math.random() * ids.length)]];
  const deps = await loadRenderDeps({ heroImageUrl });
  const total = points.length + 2;
  const logoDataUri = template.logo === LOGO_DARK ? deps.logoDarkDataUri : deps.logoLightDataUri;

  const pages = [];

  // Portada
  pages.push(
    await renderPage({
      template,
      pageType: "cover",
      title: truncate(title, 90),
      description: truncate(description, 260),
      logoDataUri,
      noiseDataUri: deps.noiseDataUri,
      swiperDataUri: deps.swiperDataUri,
      eastDataUri: deps.eastDataUri,
      heroDataUri: deps.heroDataUri,
      fonts: deps.fonts,
      pageNumber: 1,
      totalPages: total,
      format: "vertical",
    })
  );

  // Páginas de contenido. Cada punto puede ser:
  //   - { title, description }  (recomendado — título corto + cuerpo real)
  //   - "Título\nDescripción"   (string con salto de línea separando ambos)
  //   - "Solo una frase"        (fallback: la frase completa es el título, sin
  //                              descripción — nunca se repite el mismo texto
  //                              dos veces como pasaba antes)
  for (let i = 0; i < points.length; i++) {
    const p = points[i];
    let pointTitle, pointDescription;
    if (typeof p === "object" && p !== null) {
      pointTitle = p.title || "";
      pointDescription = p.description || "";
    } else {
      const parts = String(p).split("\n");
      if (parts.length > 1) {
        pointTitle = parts[0];
        pointDescription = parts.slice(1).join(" ").trim();
      } else {
        pointTitle = String(p);
        pointDescription = "";
      }
    }
    pages.push(
      await renderPage({
        template,
        pageType: "content",
        title: truncate(pointTitle || "Punto clave", 80),
        description: truncate(pointDescription, 300),
        bigNumber: String(i + 1),
        logoDataUri,
        noiseDataUri: deps.noiseDataUri,
        swiperDataUri: deps.swiperDataUri,
        eastDataUri: deps.eastDataUri,
        heroDataUri: deps.heroDataUri,
        fonts: deps.fonts,
        pageNumber: i + 2,
        totalPages: total,
        format: "vertical",
      })
    );
  }

  // Cierre
  pages.push(
    await renderPage({
      template,
      pageType: "close",
      title: "Lee más en nuestro blog",
      logoDataUri,
      noiseDataUri: deps.noiseDataUri,
      swiperDataUri: deps.swiperDataUri,
      eastDataUri: deps.eastDataUri,
      heroDataUri: deps.heroDataUri,
      fonts: deps.fonts,
      pageNumber: total,
      totalPages: total,
      format: "vertical",
    })
  );

  return pages;
}
