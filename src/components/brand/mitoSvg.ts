/**
 * SVG markup for the mitochondrion and the MitoAge marks, as strings, so the same art is
 * used by Astro components (via set:html), the favicon generator and anywhere else.
 * Ids are prefixed per instance so several marks can share a page.
 */
import { mitoGeometry } from "./mitoGeometry";

export interface MitoPalette {
  outerMembrane: string;
  ims0: string;
  ims1: string;
  innerMembrane: string;
  matrix0: string;
  matrix1: string;
  dna: string;
  dnaHighlight: string;
  ribosome: string;
  granule: string;
}

export const MITO_PALETTE: MitoPalette = {
  outerMembrane: "#8a3b0e",
  ims0: "#ffc65a",
  ims1: "#f0792b",
  innerMembrane: "#c4551b",
  matrix0: "#fff6dc",
  matrix1: "#ffdc9c",
  dna: "#1f3a6e",
  dnaHighlight: "#8fb3ff",
  ribosome: "#7a3510",
  granule: "#f3a24a",
};

export interface MitoMarkupOptions {
  id: string;
  detail?: "full" | "simple";
  palette?: Partial<MitoPalette>;
  /** Outer membrane stroke width in mitochondrion units (the body is 200 x 92). */
  outline?: number;
  /** Extra outline colour drawn behind the membrane (e.g. white for stickers). */
  halo?: string;
  shadow?: boolean;
}

/** Mitochondrion centred on (0,0), 200 units long, horizontal. Wrap it in a transform. */
export const mitoMarkup = (o: MitoMarkupOptions): string => {
  const p = { ...MITO_PALETTE, ...o.palette };
  const detail = o.detail ?? "full";
  const innerStroke = detail === "full" ? 3 : 5;
  const g = mitoGeometry({ detail, innerStroke });
  const outline = o.outline ?? (detail === "full" ? 4 : 6.5);
  const id = o.id;
  const parts: string[] = [];

  parts.push(`<defs>
<linearGradient id="${id}-ims" x1="0" y1="0" x2="0.35" y2="1"><stop offset="0" stop-color="${p.ims0}"/><stop offset="1" stop-color="${p.ims1}"/></linearGradient>
<radialGradient id="${id}-mx" cx="0.42" cy="0.32" r="0.8"><stop offset="0" stop-color="${p.matrix0}"/><stop offset="1" stop-color="${p.matrix1}"/></radialGradient>
<clipPath id="${id}-clip"><path d="${g.innerClip}"/></clipPath>
<clipPath id="${id}-oclip"><path d="${g.outer}"/></clipPath>
</defs>`);

  if (o.shadow) {
    parts.push(`<ellipse cx="4" cy="${g.radius + 10}" rx="${g.halfLength * 0.82}" ry="9" fill="#0b4a1e" opacity="0.22"/>`);
  }
  if (o.halo) {
    parts.push(`<path d="${g.outer}" fill="none" stroke="${o.halo}" stroke-width="${outline + 7}" stroke-linejoin="round"/>`);
  }
  // Outer membrane enclosing the intermembrane space.
  parts.push(`<path d="${g.outer}" fill="url(#${id}-ims)" stroke="${p.outerMembrane}" stroke-width="${outline}" stroke-linejoin="round"/>`);
  // Inner membrane + matrix.
  parts.push(`<path d="${g.inner}" fill="url(#${id}-mx)" stroke="${p.innerMembrane}" stroke-width="${innerStroke}" stroke-linejoin="round"/>`);
  // Cristae: folds of the inner membrane, open to the intermembrane space.
  parts.push(
    `<g clip-path="url(#${id}-clip)" fill="url(#${id}-ims)" stroke="${p.innerMembrane}" stroke-width="${innerStroke}" stroke-linejoin="round">${g.cristae
      .map((d) => `<path d="${d}"/>`)
      .join("")}</g>`,
  );
  // Granules and ribosomes in the matrix.
  if (g.granules.length) {
    parts.push(
      `<g fill="${p.granule}" opacity="0.8">${g.granules.map((c) => `<circle cx="${c.cx}" cy="${c.cy}" r="${c.r}"/>`).join("")}</g>`,
    );
  }
  if (g.ribosomes.length) {
    parts.push(
      `<g fill="${p.ribosome}">${g.ribosomes.map((c) => `<circle cx="${c.cx}" cy="${c.cy}" r="${c.r}"/>`).join("")}</g>`,
    );
  }
  // Circular mtDNA: a navy double strand with a light dashed highlight to read as a twisted ring.
  const dnaW = detail === "full" ? 2.6 : 4.2;
  parts.push(
    `<g fill="none" stroke-linecap="round">${g.nucleoids
      .map(
        (n) =>
          `<g transform="translate(${n.cx} ${n.cy}) rotate(${n.rot})"><ellipse rx="${n.r}" ry="${(n.r * 0.82).toFixed(2)}" stroke="${p.dna}" stroke-width="${dnaW}"/><ellipse rx="${n.r}" ry="${(n.r * 0.82).toFixed(2)}" stroke="${p.dnaHighlight}" stroke-width="${(dnaW * 0.42).toFixed(2)}" stroke-dasharray="${detail === "full" ? "1.6 2.4" : "2.6 3.4"}"/></g>`,
      )
      .join("")}</g>`,
  );
  // Specular highlight.
  if (detail === "full") {
    parts.push(
      `<g clip-path="url(#${id}-oclip)"><path d="M-52 -40Q0 -48.5 50 -40" stroke="#fff" stroke-opacity="0.6" stroke-width="2.6" fill="none" stroke-linecap="round"/><path d="M-84 -16Q-86 -28 -72 -36" stroke="#fff" stroke-opacity="0.45" stroke-width="2.6" fill="none" stroke-linecap="round"/></g>`,
    );
  } else {
    parts.push(
      `<g clip-path="url(#${id}-oclip)"><path d="M-50 -36Q0 -46 46 -36" stroke="#fff" stroke-opacity="0.5" stroke-width="6" fill="none" stroke-linecap="round"/></g>`,
    );
  }
  return parts.join("");
};

export interface BadgeTextOptions {
  top?: string;
  bottom?: string;
}

/**
 * Full round badge: white rim, faceted green ring with arc lettering, pale disc with a
 * faint constellation, the mitochondrion in the middle. viewBox 0 0 300 300.
 */
export const badgeMarkup = (id: string, text: BadgeTextOptions = {}): string => {
  const top = text.top ?? "MitoAge";
  const bottom = text.bottom ?? "mtDNA · LONGEVITY";
  const font = `'Nunito Variable', Nunito, ui-rounded, system-ui, sans-serif`;
  // Facets on the ring: triangles between two radii, alternating light and dark.
  const facets: string[] = [];
  const n = 22;
  for (let i = 0; i < n; i++) {
    const a0 = (i / n) * Math.PI * 2;
    const a1 = ((i + 1) / n) * Math.PI * 2;
    const am = (a0 + a1) / 2;
    const pt = (r: number, a: number) => `${(150 + r * Math.cos(a)).toFixed(1)},${(150 + r * Math.sin(a)).toFixed(1)}`;
    const light = i % 3 !== 1;
    const op = light ? (0.05 + ((i * 37) % 7) * 0.012).toFixed(3) : "0.07";
    facets.push(
      `<polygon points="${pt(150, a0)} ${pt(150, a1)} ${pt(94, am)}" fill="${light ? "#fff" : "#0b4a1e"}" opacity="${op}"/>`,
    );
  }
  // Faint constellation in the disc.
  const stars: [number, number][] = [
    [96, 112], [122, 84], [160, 74], [198, 96], [214, 136], [204, 182], [168, 214], [124, 210], [92, 178], [86, 140],
  ];
  const starLines = stars
    .map(([x, y], i) => {
      const [nx, ny] = stars[(i + 1) % stars.length] ?? [x, y];
      return `M${x} ${y}L${nx} ${ny}`;
    })
    .join("");
  const helix = `<g transform="translate(29 150)" stroke="#fff" fill="none" stroke-width="2.6" stroke-linecap="round">
<path d="M-6 -16C-6 -8 6 -8 6 0S-6 8 -6 16"/><path d="M6 -16C6 -8 -6 -8 -6 0S6 8 6 16"/>
<path d="M-4.6 -12.5H4.6M-4.6 12.5H4.6M-2.2 -4.5H2.2M-2.2 4.5H2.2" stroke-width="1.8"/></g>`;
  const hourglass = `<g transform="translate(271 150)" fill="none" stroke="#fff" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round">
<path d="M-8 -15H8M-8 15H8"/><path d="M-5.5 -15C-5.5 -5 5.5 -5 5.5 0S-5.5 5 -5.5 15M5.5 -15C5.5 -5 -5.5 -5 -5.5 0S5.5 5 5.5 15"/>
<path d="M-3 11.5H3L0 6.5Z" fill="#fff" stroke-width="1.4"/></g>`;
  return `<defs>
<radialGradient id="${id}-ring" cx="0.35" cy="0.25" r="0.9"><stop offset="0" stop-color="#6dbe3a"/><stop offset="0.55" stop-color="#2e9a3c"/><stop offset="1" stop-color="#1a7d35"/></radialGradient>
<radialGradient id="${id}-disc" cx="0.4" cy="0.32" r="0.75"><stop offset="0" stop-color="#fbfef3"/><stop offset="1" stop-color="#dff0c0"/></radialGradient>
<clipPath id="${id}-ringclip"><circle cx="150" cy="150" r="142"/></clipPath>
<path id="${id}-arcTop" d="M42,150 A108,108 0 0 1 258,150"/>
<path id="${id}-arcBot" d="M16,150 A134,134 0 0 0 284,150"/>
</defs>
<circle cx="150" cy="150" r="149" fill="#fff"/>
<circle cx="150" cy="150" r="142" fill="url(#${id}-ring)"/>
<g clip-path="url(#${id}-ringclip)">${facets.join("")}</g>
<circle cx="150" cy="150" r="141" fill="none" stroke="#0b4a1e" stroke-opacity="0.18" stroke-width="2"/>
<circle cx="150" cy="150" r="97" fill="#fff"/>
<circle cx="150" cy="150" r="91.5" fill="url(#${id}-disc)"/>
<g stroke="#9ccf6a" stroke-width="1" opacity="0.55" fill="none"><path d="${starLines}M122 84L124 210M214 136L92 178"/></g>
<g fill="#8cc63f" opacity="0.7">${stars.map(([x, y], i) => `<circle cx="${x}" cy="${y}" r="${i % 3 === 0 ? 2.6 : 1.8}"/>`).join("")}</g>
<text font-family="${font}" font-weight="900" font-size="42" letter-spacing="0.5" fill="#fff" text-anchor="middle"><textPath href="#${id}-arcTop" startOffset="50%">${top}</textPath></text>
<text font-family="${font}" font-weight="900" font-size="20.5" letter-spacing="2.4" fill="#fff" text-anchor="middle"><textPath href="#${id}-arcBot" startOffset="50%">${bottom}</textPath></text>
${helix}${hourglass}
<ellipse cx="152" cy="206" rx="58" ry="7" fill="#2e7d32" opacity="0.16"/>
<g transform="translate(150 148) rotate(-24) scale(0.76)">${mitoMarkup({ id: `${id}-m`, detail: "full" })}</g>`;
};

/** Compact round icon (header logo, favicon): green disc, white rim, mitochondrion. viewBox 0 0 64 64. */
export const iconMarkup = (id: string): string => `<defs>
<radialGradient id="${id}-disc" cx="0.35" cy="0.25" r="0.9"><stop offset="0" stop-color="#6dbe3a"/><stop offset="0.6" stop-color="#2e9a3c"/><stop offset="1" stop-color="#1f8a3b"/></radialGradient>
</defs>
<circle cx="32" cy="32" r="31" fill="#fff"/>
<circle cx="32" cy="32" r="28.5" fill="url(#${id}-disc)"/>
<g transform="translate(32 32.5) rotate(-32) scale(0.262)">${mitoMarkup({ id: `${id}-m`, detail: "simple", halo: "#ffffff" })}</g>`;
