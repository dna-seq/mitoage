// Figure 2 of the MitoAge 2 manuscript: codon usage against maximum lifespan, across species and on contrasts.
//
//   bun docs/manuscript/figures/figure-2-codons.ts              # needs dist/ from `bun run build`
//
// Reads dist/data/correlations.parquet (dataset `default`, trait `maxLongevityYears`, scope `all`), takes the
// 64 codons of `codon:total_pc:*` and places each by its Pearson r with log10 maximum lifespan across species
// (x) and its r on phylogenetically independent contrasts (y), one panel per third base. A codon "passes"
// with the definitions of Table 3 (docs/manuscript/NOTES.md, "Where the numbers come from"): q < 0.05,
// contrast p < 0.05 with the sign of the correlation across species, and partial p < 0.05 on body mass.
// The set of passing codons is checked against the twenty the manuscript names; any difference stops the
// script before anything is written. Only the passing codons are labelled; their labels are placed so that
// none overlaps another label or a coloured point, with a leader line where a label sits away from its point.
// Headless Chrome renders the SVG at three times its size and ImageMagick writes FIGURE_2_CODONS.jpg
// (quality 92).
//
// Sizes: the SVG is 1,000 CSS px wide and is meant to be printed across the page (178 mm), so 1 px is
// 0.505 pt; the smallest text is 14 px, 7.1 pt. At three times, 3,000 px over 178 mm is 428 dpi.

import { parquetReadObjects } from "hyparquet";
import { mkdtempSync, writeFileSync, readFileSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

const root = resolve(import.meta.dir, "../../..");
const parquetPath = join(root, "dist/data/correlations.parquet");
const outPath = join(import.meta.dir, "FIGURE_2_CODONS.jpg");
const fontPath = join(root, "node_modules/@fontsource-variable/nunito/files/nunito-latin-wght-normal.woff2");

if (!existsSync(parquetPath)) {
  console.error(`missing ${parquetPath}: run \`bun run build\` first`);
  process.exit(1);
}

// The twenty codons the manuscript says pass all three controls.
const EXPECTED = [
  "GCU", "UCU", "UUU", "AUU", "GAU", "UGU", "ACU", "UAU",
  "UGC", "GAC", "UAC", "UUC", "CGC", "UCC", "ACC", "AUC",
  "UUA", "CUA", "UGG", "GGG",
];

type Row = {
  dataset: string;
  trait: string;
  scope: string;
  feature_key: string;
  n: number;
  pearson_r: number | null;
  q_value: number | null;
  pic_r: number | null;
  pic_p_value: number | null;
  partial_r: number | null;
  partial_p_value: number | null;
};
const file = await Bun.file(parquetPath).arrayBuffer();
const rows = (await parquetReadObjects({
  file,
  columns: ["dataset", "trait", "scope", "feature_key", "n", "pearson_r", "q_value", "pic_r", "pic_p_value", "partial_r", "partial_p_value"],
})) as Row[];
const PREFIX = "codon:total_pc:";
const picked = rows
  .filter((r) => r.dataset === "default" && r.trait === "maxLongevityYears" && r.scope === "all" && r.feature_key.startsWith(PREFIX))
  .sort((a, b) => a.feature_key.localeCompare(b.feature_key));
if (picked.length !== 64) {
  console.error(`expected the 64 codons of ${PREFIX}* in scope all, found ${picked.length}; nothing written`);
  process.exit(1);
}
const lt = (x: number | null) => x !== null && Number.isFinite(x) && x < 0.05;
type Codon = { codon: string; base: string; x: number; y: number; pass: boolean; partial: number | null; n: number };
const codons: Codon[] = picked.map((r) => {
  if (r.pearson_r === null || r.pic_r === null) throw new Error(`${r.feature_key}: no Pearson r or contrast r`);
  const pass = lt(r.q_value) && lt(r.pic_p_value) && Math.sign(r.pearson_r) === Math.sign(r.pic_r) && lt(r.partial_p_value);
  const codon = r.feature_key.slice(PREFIX.length);
  return { codon, base: codon[2], x: r.pearson_r, y: r.pic_r, pass, partial: r.partial_r, n: r.n };
});
const passing = codons.filter((c) => c.pass).map((c) => c.codon);
const missing = EXPECTED.filter((c) => !passing.includes(c));
const extra = passing.filter((c) => !EXPECTED.includes(c));
if (missing.length || extra.length) {
  console.error(`the passing codons differ from the twenty the manuscript names; nothing written`);
  if (missing.length) console.error(`  named but not passing: ${missing.join(", ")}`);
  if (extra.length) console.error(`  passing but not named: ${extra.join(", ")}`);
  process.exit(1);
}
const species = new Set(codons.map((c) => c.n));
console.log(`64 codons, n = ${[...species].join(", ")}; exactly the twenty named codons pass all three controls`);
for (const c of codons.filter((c) => c.pass)) {
  console.log(`  ${c.codon}  r ${c.x.toFixed(3)}  contrast r ${c.y.toFixed(3)}  partial r ${c.partial?.toFixed(3)}`);
}

// ---------------------------------------------------------------------------------------------- drawing
const INK = "#17305c"; // --navy-900
const MUTED = "#4a5a78"; // --slate-600
const GRID = "#e4ead6";
const AXIS = "#8a98ad";
const OTHER = "#c4cad4";
const BASES = [
  { base: "U", name: "U", colour: "#e8503a" }, // --nt-t
  { base: "C", name: "C", colour: "#2f6fd0" }, // --nt-c
  { base: "A", name: "A", colour: "#2e9a3c" }, // --nt-a
  { base: "G", name: "G", colour: "#e09a10" }, // --nt-g one step darker, to show on white
];
const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
const minus = (s: string) => s.replace(/^-/, "−");

const W = 1000;
const FS = { tick: 14, label: 14, legend: 15, axis: 15, title: 17 };
const R = 5.5; // point radius
const XMIN = -0.4, XMAX = 0.4, YMIN = -0.15, YMAX = 0.15;
const left = 92; // room for the y ticks and the shared y title
const gapX = 46;
const pw = (W - left - 14 - gapX) / 2; // plot width
const ph = 300; // plot height
const top = 92; // below the legend
const headH = 30; // panel title above each plot
const rowGap = 74; // tick labels below a plot, then the next panel's title
const panelOrigin = (i: number) => ({
  x: left + (i % 2) * (pw + gapX),
  y: top + headH + Math.floor(i / 2) * (ph + headH + rowGap),
});

type Box = { x0: number; y0: number; x1: number; y1: number };
const overlap = (a: Box, b: Box) => Math.max(0, Math.min(a.x1, b.x1) - Math.max(a.x0, b.x0)) * Math.max(0, Math.min(a.y1, b.y1) - Math.max(a.y0, b.y0));
// Nunito at weight 800: capitals A, C, G, U are about 0.70 em wide; the estimate errs wide.
const labelW = (s: string) => s.length * FS.label * 0.72 + 2;
const labelH = FS.label * 0.78 + 2; // cap height plus a margin

const out: string[] = [];
const allPlaced: { box: Box }[] = [];

BASES.forEach((b, i) => {
  const o = panelOrigin(i);
  const sx = (v: number) => o.x + ((v - XMIN) / (XMAX - XMIN)) * pw;
  const sy = (v: number) => o.y + ((YMAX - v) / (YMAX - YMIN)) * ph;
  const own = codons.filter((c) => c.base === b.base);
  const nPass = own.filter((c) => c.pass).length;

  // Title and count.
  out.push(`<circle cx="${o.x + 7}" cy="${o.y - headH + 9}" r="7" fill="${b.colour}"/>`);
  out.push(`<text x="${o.x + 21}" y="${o.y - headH + 15}" font-size="${FS.title}" font-weight="800" fill="${INK}">Codons ending in ${b.name}</text>`);
  out.push(`<text x="${o.x + pw}" y="${o.y - headH + 15}" text-anchor="end" font-size="${FS.legend}" fill="${MUTED}">${nPass} of ${own.length} pass all three</text>`);

  // Grid, zero lines, frame, ticks.
  for (const t of [-0.4, -0.2, 0, 0.2, 0.4]) {
    out.push(`<line x1="${sx(t)}" y1="${o.y}" x2="${sx(t)}" y2="${o.y + ph}" stroke="${t === 0 ? AXIS : GRID}" stroke-width="${t === 0 ? 1.3 : 1}"/>`);
    out.push(`<text x="${sx(t)}" y="${o.y + ph + 20}" text-anchor="middle" font-size="${FS.tick}" fill="${MUTED}">${minus(t.toFixed(1))}</text>`);
  }
  for (const t of [-0.15, -0.1, -0.05, 0, 0.05, 0.1, 0.15]) {
    out.push(`<line x1="${o.x}" y1="${sy(t)}" x2="${o.x + pw}" y2="${sy(t)}" stroke="${t === 0 ? AXIS : GRID}" stroke-width="${t === 0 ? 1.3 : 1}"/>`);
    if (i % 2 === 0) out.push(`<text x="${o.x - 8}" y="${sy(t) + 5}" text-anchor="end" font-size="${FS.tick}" fill="${MUTED}">${minus(t.toFixed(2))}</text>`);
  }
  out.push(`<rect x="${o.x}" y="${o.y}" width="${pw}" height="${ph}" fill="none" stroke="${GRID}" stroke-width="1"/>`);

  // Points: the other 48 grey and underneath, then open, then filled.
  const pts = codons.map((c) => ({ c, px: sx(c.x), py: sy(c.y), own: c.base === b.base }));
  for (const p of pts.filter((p) => !p.own)) out.push(`<circle cx="${p.px.toFixed(1)}" cy="${p.py.toFixed(1)}" r="${R - 1}" fill="${OTHER}"/>`);
  for (const p of pts.filter((p) => p.own && !p.c.pass))
    out.push(`<circle cx="${p.px.toFixed(1)}" cy="${p.py.toFixed(1)}" r="${R}" fill="#fff" stroke="${b.colour}" stroke-width="2.2"/>`);
  for (const p of pts.filter((p) => p.own && p.c.pass))
    out.push(`<circle cx="${p.px.toFixed(1)}" cy="${p.py.toFixed(1)}" r="${R + 0.5}" fill="${b.colour}" stroke="#fff" stroke-width="1"/>`);

  // Labels of the passing codons. Candidates around each point; cost is overlap with other labels and with
  // points (coloured ones weigh more than grey), leaving the plot, and distance. Several rounds of
  // re-placing each label against the others settle it.
  const plotBox: Box = { x0: o.x + 2, y0: o.y + 2, x1: o.x + pw - 2, y1: o.y + ph - 2 };
  const ptBox = (p: (typeof pts)[number], r: number): Box => ({ x0: p.px - r, y0: p.py - r, x1: p.px + r, y1: p.py + r });
  const obstacles = pts.map((p) => ({ box: ptBox(p, p.own ? R + 2 : R), weight: p.own ? 6 : 1.5 }));
  const toLabel = pts.filter((p) => p.own && p.c.pass);
  // A passing point that touches another passing point cannot be told apart by a label beside it: its label
  // stands off and its leader runs to the point's centre, drawn over the points.
  const crowded = new Set(
    toLabel.filter((p) => toLabel.some((q) => q !== p && Math.hypot(q.px - p.px, q.py - p.py) < 2 * R + 3)).map((p) => p.c.codon),
  );
  const candidates = (p: (typeof pts)[number]) => {
    const w = labelW(p.c.codon), h = labelH;
    const list: { box: Box; dist: number; angle: number }[] = [];
    for (const d of crowded.has(p.c.codon) ? [12, 18, 26, 36, 48, 62] : [3, 7, 12, 18, 26, 36, 48, 62]) {
      for (let a = 0; a < 360; a += 15) {
        const rad = (a * Math.PI) / 180;
        const ux = Math.cos(rad), uy = -Math.sin(rad);
        // Step R + d along the ray, then shift the box by up to half its size in the ray's direction, so
        // that at 0 degrees its left edge, and at 90 degrees its bottom edge, faces the point.
        const reach = R + d;
        const clamp = (v: number) => Math.max(-1, Math.min(1, v));
        const cx = p.px + ux * reach + (w / 2) * clamp(ux * 2);
        const cy = p.py + uy * reach + (h / 2) * clamp(uy * 2);
        list.push({ box: { x0: cx - w / 2, y0: cy - h / 2, x1: cx + w / 2, y1: cy + h / 2 }, dist: d, angle: a });
      }
    }
    return list;
  };
  const cand = toLabel.map(candidates);
  const boxDist = (b: Box, x: number, y: number) =>
    Math.hypot(Math.max(b.x0 - x, 0, x - b.x1), Math.max(b.y0 - y, 0, y - b.y1));
  const leader = (p: (typeof pts)[number], b: Box) => {
    const nx = Math.min(Math.max(p.px, b.x0), b.x1);
    const ny = Math.min(Math.max(p.py, b.y0), b.y1);
    return [p.px, p.py, nx, ny] as const;
  };
  const crosses = (ax: number, ay: number, bx: number, by: number, cx: number, cy: number, dx: number, dy: number) => {
    const o = (px: number, py: number, qx: number, qy: number, rx: number, ry: number) => Math.sign((qx - px) * (ry - py) - (qy - py) * (rx - px));
    return o(ax, ay, bx, by, cx, cy) !== o(ax, ay, bx, by, dx, dy) && o(cx, cy, dx, dy, ax, ay) !== o(cx, cy, dx, dy, bx, by);
  };
  const segHitsBox = (ax: number, ay: number, bx: number, by: number, b: Box) => {
    for (let t = 0.05; t < 1; t += 0.05) {
      const x = ax + (bx - ax) * t, y = ay + (by - ay) * t;
      if (x > b.x0 && x < b.x1 && y > b.y0 && y < b.y1) return true;
    }
    return false;
  };
  const choice = toLabel.map(() => 0);
  const cost = (k: number, j: number) => {
    const { box, dist, angle } = cand[k][j];
    let c = dist * 0.6 + (angle === 0 ? 0 : 2) + (angle > 90 && angle < 270 ? 1 : 0);
    const inside = overlap(box, plotBox);
    c += ((box.x1 - box.x0) * (box.y1 - box.y0) - inside) * 50;
    for (const ob of obstacles) c += overlap(box, ob.box) * ob.weight;
    const own = toLabel[k];
    const dOwn = boxDist(box, own.px, own.py);
    const [ax, ay, bx, by] = leader(own, box);
    toLabel.forEach((q, m) => {
      if (m === k) return;
      const other = cand[m][choice[m]].box;
      c += overlap(box, other) * 100;
      // A label nearer another labelled point than its own would be read as that point's.
      const dq = boxDist(box, q.px, q.py);
      if (dq < dOwn + 5) c += (dOwn + 5 - dq) * 40;
      // Leaders that cross each other, or cross another label, are hard to follow.
      const [cx, cy, dx, dy] = leader(q, other);
      if (dOwn > 7 && boxDist(other, q.px, q.py) > 7 && crosses(ax, ay, bx, by, cx, cy, dx, dy)) c += 400;
      if (dOwn > 7 && segHitsBox(ax, ay, bx, by, other)) c += 400;
    });
    return c;
  };
  for (let round = 0; round < 12; round++) {
    for (let k = 0; k < toLabel.length; k++) {
      let best = choice[k], bestCost = cost(k, best);
      for (let j = 0; j < cand[k].length; j++) {
        const cj = cost(k, j);
        if (cj < bestCost - 1e-9) (best = j), (bestCost = cj);
      }
      choice[k] = best;
    }
  }
  const leaders: string[] = [];
  const texts: string[] = [];
  toLabel.forEach((p, k) => {
    const { box, dist } = cand[k][choice[k]];
    allPlaced.push({ box });
    for (let m = 0; m < k; m++) {
      if (overlap(box, cand[m][choice[m]].box) > 0) throw new Error(`labels ${p.c.codon} and ${toLabel[m].c.codon} overlap`);
    }
    for (const q of pts.filter((q) => q.own)) {
      if (overlap(box, ptBox(q, R)) > 0) throw new Error(`label ${p.c.codon} covers the point of ${q.c.codon}`);
    }
    if (overlap(box, plotBox) < (box.x1 - box.x0) * (box.y1 - box.y0) - 1e-6) throw new Error(`label ${p.c.codon} leaves the plot`);
    if (dist >= 7) {
      // Leader from the point (its centre when crowded, else its edge) to the nearest point of the label's box.
      const nx = Math.min(Math.max(p.px, box.x0), box.x1);
      const ny = Math.min(Math.max(p.py, box.y0), box.y1);
      const len = Math.hypot(nx - p.px, ny - p.py);
      const start = crowded.has(p.c.codon) ? 0 : R + 1.5;
      const ex = p.px + ((nx - p.px) / len) * start;
      const ey = p.py + ((ny - p.py) / len) * start;
      leaders.push(`<line x1="${ex.toFixed(1)}" y1="${ey.toFixed(1)}" x2="${nx.toFixed(1)}" y2="${ny.toFixed(1)}" stroke="${INK}" stroke-width="1.2"/>`);
      if (crowded.has(p.c.codon)) leaders.push(`<circle cx="${p.px.toFixed(1)}" cy="${p.py.toFixed(1)}" r="1.8" fill="${INK}"/>`);
    }
    const tx = (box.x0 + box.x1) / 2;
    const ty = box.y1 - 1.5;
    texts.push(`<text x="${tx.toFixed(1)}" y="${ty.toFixed(1)}" text-anchor="middle" font-size="${FS.label}" font-weight="800" fill="${INK}" paint-order="stroke" stroke="#fff" stroke-width="3" stroke-linejoin="round">${p.c.codon}</text>`);
  });
  out.push(...leaders, ...texts);
});

// Legend: the filled and open markers in all four panel colours, so they look like the points.
{
  const ly = 30;
  let lx = left;
  const pair = (filled: boolean) => {
    BASES.forEach((b, k) => {
      const cx = lx + 7 + k * 15;
      out.push(
        filled
          ? `<circle cx="${cx}" cy="${ly}" r="${R + 0.5}" fill="${b.colour}" stroke="#fff" stroke-width="1"/>`
          : `<circle cx="${cx}" cy="${ly}" r="${R}" fill="#fff" stroke="${b.colour}" stroke-width="2.2"/>`,
      );
    });
    lx += 4 * 15 + 6;
  };
  pair(true);
  out.push(`<text x="${lx}" y="${ly + 5}" font-size="${FS.legend}" fill="${INK}">passes all three controls</text>`);
  lx += 205;
  pair(false);
  out.push(`<text x="${lx}" y="${ly + 5}" font-size="${FS.legend}" fill="${INK}">does not</text>`);
  lx += 90;
  out.push(`<circle cx="${lx + 7}" cy="${ly}" r="${R - 1}" fill="${OTHER}"/>`);
  out.push(`<text x="${lx + 20}" y="${ly + 5}" font-size="${FS.legend}" fill="${INK}">codons with another third base</text>`);
  out.push(
    `<text x="${left}" y="${ly + 32}" font-size="${FS.legend}" fill="${MUTED}">All species, n = ${[...species][0].toLocaleString("en-US")}; total protein-coding sequence; the twenty codons that pass are labelled</text>`,
  );
}

// Axis titles.
const plotsBottom = panelOrigin(2).y + ph;
const H = plotsBottom + 64;
out.push(
  `<text x="${left + (W - 14 - left) / 2}" y="${plotsBottom + 50}" text-anchor="middle" font-size="${FS.axis}" fill="${INK}">${esc("Pearson r of codon usage with log10 maximum lifespan, across species")}</text>`,
);
const midY = (panelOrigin(0).y + plotsBottom) / 2;
out.push(
  `<text transform="translate(22 ${midY}) rotate(-90)" text-anchor="middle" font-size="${FS.axis}" fill="${INK}">r on phylogenetically independent contrasts</text>`,
);

const font = `data:font/woff2;base64,${readFileSync(fontPath).toString("base64")}`;
const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" font-family="Nunito">
<rect width="${W}" height="${H}" fill="#ffffff"/>
${out.join("\n")}
</svg>`;
const html = `<!doctype html><html><head><meta charset="utf-8"><style>
@font-face { font-family: Nunito; font-style: normal; font-weight: 200 1000; src: url(${font}) format("woff2"); }
html, body { margin: 0; padding: 0; background: #fff; } svg { display: block; }
</style></head><body>${svg}</body></html>`;

const work = mkdtempSync(join(tmpdir(), "mitoage-figure-2-"));
writeFileSync(join(work, "figure-2.svg"), svg);
writeFileSync(join(work, "figure-2.html"), html);
const png = join(work, "figure-2.png");
const run = (cmd: string[]) => {
  const r = Bun.spawnSync(cmd, { stdout: "pipe", stderr: "pipe" });
  if (r.exitCode !== 0) throw new Error(`${cmd[0]} failed (${r.exitCode}): ${r.stderr.toString()}`);
};
run([
  "google-chrome", "--headless=new", "--disable-gpu", "--hide-scrollbars", "--no-first-run", `--user-data-dir=${join(work, "chrome")}`,
  `--window-size=${W},${H}`, "--force-device-scale-factor=3", "--virtual-time-budget=3000",
  `--screenshot=${png}`, `file://${join(work, "figure-2.html")}`,
]);
run(["magick", png, "-background", "white", "-flatten", "-quality", "92", outPath]);
console.log(`wrote ${outPath} (${W * 3} x ${Math.round(H) * 3} px, ${W} x ${Math.round(H)} CSS px); SVG and PNG in ${work}`);
