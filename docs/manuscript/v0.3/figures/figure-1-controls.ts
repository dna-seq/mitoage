// Figure 1 of the MitoAge 2 manuscript: what the three controls leave of the lifespan correlations, by scope.
//
//   bun docs/manuscript/v0.2/figures/figure-1-controls.ts            # needs dist/ from `bun run build`
//
// Reads dist/data/correlations.parquet (dataset `default`, trait `maxLongevityYears`), counts each scope
// with the definitions of Table 3 (docs/manuscript/NOTES.md, "Where the numbers come from"), checks every
// count against Table 3 as the manuscript prints it (copied below), draws the chart as SVG, has headless
// Chrome render it at three times its size and has ImageMagick write FIGURE_1_CONTROLS.jpg (quality 92).
// A count that differs from Table 3 stops the script before anything is written; `--accept` writes anyway
// (after a rebuild that changes the numbers, Table 3 and the copy below are then updated by hand).
//
// Sizes: the SVG is 1,000 CSS px wide and is printed at NAR's double-column width (174 mm), so 1 px is
// about 0.49 pt; the smallest text is 15 px, about 7.4 pt.

import { parquetReadObjects } from "hyparquet";
import { mkdtempSync, writeFileSync, readFileSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

const root = resolve(import.meta.dir, "../../../..");
const parquetPath = join(root, "dist/data/correlations.parquet");
const outPath = join(import.meta.dir, "FIGURE_1_CONTROLS.jpg");
const fontPath = join(root, "node_modules/@fontsource-variable/nunito/files/nunito-latin-wght-normal.woff2");
const fontItalicPath = join(root, "node_modules/@fontsource-variable/nunito/files/nunito-latin-wght-italic.woff2");
const accept = process.argv.includes("--accept");

if (!existsSync(parquetPath)) {
  console.error(`missing ${parquetPath}: run \`bun run build\` first`);
  process.exit(1);
}

// Table 3 as the manuscript prints it: species, tests, p < 0.05, FDR, PIC, Both, All three.
const TABLE_3: Record<string, number[]> = {
  all: [2211, 1414, 1175, 1166, 566, 292, 238],
  "class:Mammalia": [615, 1398, 954, 918, 224, 164, 139],
  "class:Actinopterygii": [827, 1402, 832, 769, 546, 221, 86],
  "class:Aves": [414, 1390, 687, 601, 184, 55, 24],
  "class:Reptilia": [126, 1403, 405, 231, 94, 21, 12],
  "order:Primates": [112, 204, 128, 118, 12, 8, 4],
  "order:Carnivora": [123, 205, 88, 72, 53, 35, 25],
  "order:Artiodactyla": [134, 204, 92, 76, 27, 9, 4],
  "order:Rodentia": [87, 204, 77, 50, 23, 9, 7],
  "order:Passeriformes": [146, 204, 74, 28, 25, 5, 0],
};
const TABLE_3_TOTAL = { scopes: 32, tests: 15906, p05: 5441, fdr: 4296, pic: 3025, both: 900, all3: 550 };

type Row = {
  dataset: string;
  trait: string;
  scope: string;
  feature_key: string;
  n: number;
  pearson_r: number | null;
  p_value: number | null;
  q_value: number | null;
  pic_r: number | null;
  pic_p_value: number | null;
  partial_p_value: number | null;
};

const file = await Bun.file(parquetPath).arrayBuffer();
const rows = (await parquetReadObjects({
  file,
  columns: ["dataset", "trait", "scope", "feature_key", "n", "pearson_r", "p_value", "q_value", "pic_r", "pic_p_value", "partial_p_value"],
})) as Row[];
const picked = rows.filter((r) => r.dataset === "default" && r.trait === "maxLongevityYears");
if (picked.length === 0) {
  console.error("no rows of dataset `default` and trait `maxLongevityYears` in correlations.parquet");
  process.exit(1);
}

type Counts = { species: number; tests: number; p05: number; fdr: number; pic: number; both: number; all3: number };
const lt = (x: number | null) => x !== null && Number.isFinite(x) && x < 0.05;
const counts = new Map<string, Counts>();
const features = new Map<string, Set<string>>();
for (const r of picked) {
  let c = counts.get(r.scope);
  if (!c) counts.set(r.scope, (c = { species: 0, tests: 0, p05: 0, fdr: 0, pic: 0, both: 0, all3: 0 }));
  if (!features.has(r.scope)) features.set(r.scope, new Set());
  features.get(r.scope)!.add(r.feature_key);
  c.species = Math.max(c.species, r.n);
  c.tests++;
  const p05 = lt(r.p_value);
  const fdr = lt(r.q_value);
  const pic = lt(r.pic_p_value);
  const both = fdr && pic && Math.sign(r.pearson_r ?? NaN) === Math.sign(r.pic_r ?? NaN);
  const all3 = both && lt(r.partial_p_value);
  if (fdr && !p05) throw new Error(`${r.scope} ${r.feature_key}: q < 0.05 with p >= 0.05; the stages would not nest`);
  c.p05 += +p05;
  c.fdr += +fdr;
  c.pic += +pic;
  c.both += +both;
  c.all3 += +all3;
}

// Check every count against Table 3.
const mismatches: string[] = [];
const cols = ["species", "tests", "p05", "fdr", "pic", "both", "all3"] as const;
for (const [scope, expected] of Object.entries(TABLE_3)) {
  const c = counts.get(scope);
  if (!c) {
    mismatches.push(`${scope}: not in the file`);
    continue;
  }
  cols.forEach((k, i) => {
    if (c[k] !== expected[i]) mismatches.push(`${scope} ${k}: file ${c[k]}, Table 3 ${expected[i]}`);
  });
}
const total = { scopes: counts.size, tests: 0, p05: 0, fdr: 0, pic: 0, both: 0, all3: 0 };
for (const c of counts.values()) for (const k of ["tests", "p05", "fdr", "pic", "both", "all3"] as const) total[k] += c[k];
for (const k of Object.keys(TABLE_3_TOTAL) as (keyof typeof TABLE_3_TOTAL)[]) {
  if (total[k] !== TABLE_3_TOTAL[k]) mismatches.push(`all scopes ${k}: file ${total[k]}, Table 3 ${TABLE_3_TOTAL[k]}`);
}
console.log(`distinct features in scope all: ${features.get("all")?.size ?? 0}`);
console.log(`all scopes: ${total.scopes} scopes, ${total.all3} of ${total.fdr} that pass the FDR pass all three`);
if (mismatches.length) {
  console.error(`${mismatches.length} counts differ from Table 3:\n  ${mismatches.join("\n  ")}`);
  if (!accept) {
    console.error("nothing written; rerun with --accept to draw the file's numbers");
    process.exit(1);
  }
} else {
  console.log(`every count of the ten scopes and the total row matches Table 3`);
}

// ---------------------------------------------------------------------------------------------- drawing
const INK = "#17305c"; // --navy-900
const MUTED = "#4a5a78"; // --slate-600
const GRID = "#e4ead6";
const AXIS = "#8a98ad";
const GREENS = ["#0b3a1c", "#1f8a3b", "#4fa65a", "#86c27c"]; // all three, FDR + contrasts, FDR only, p < 0.05 only

const fmt = (x: number) => x.toLocaleString("en-US");
const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

const W = 1000;
const labelRight = 236;
const x0 = 252;
const x1 = 762;
const colX = 790;
const pitch = 56;
const barH = 28;

type Item = { kind: "row"; scope: string; name: string; italic: boolean } | { kind: "head"; text: string };
const items: Item[] = [
  { kind: "row", scope: "all", name: "All species", italic: false },
  { kind: "head", text: "CLASSES" },
  ...["Mammalia", "Actinopterygii", "Aves", "Reptilia"].map((n) => ({ kind: "row" as const, scope: `class:${n}`, name: n, italic: true })),
  { kind: "head", text: "ORDERS" },
  ...["Primates", "Carnivora", "Artiodactyla", "Rodentia", "Passeriformes"].map((n) => ({ kind: "row" as const, scope: `order:${n}`, name: n, italic: true })),
];

const out: string[] = [];
// Legend: two rows of two, darkest first.
const legend = ["All three controls", "FDR and contrasts, not body mass", "FDR, not contrasts", "p < 0.05, not FDR"];
out.push(`<text x="${labelRight}" y="44" text-anchor="end" font-size="17" font-weight="800" fill="${INK}">Passes</text>`);
legend.forEach((label, i) => {
  const lx = x0 + (i % 2) * 300;
  const ly = 30 + Math.floor(i / 2) * 30;
  out.push(`<rect x="${lx}" y="${ly + 1}" width="20" height="20" rx="4" fill="${GREENS[i]}"/>`);
  out.push(`<text x="${lx + 28}" y="${ly + 17}" font-size="17" fill="${INK}">${esc(label)}</text>`);
});

let y = 100;
out.push(`<text x="${colX}" y="${y + 10}" font-size="16" font-weight="800" fill="${MUTED}">All three</text>`);
out.push(`<text x="${colX}" y="${y + 30}" font-size="16" font-weight="800" fill="${MUTED}">of FDR</text>`);
y += 48;
const plotTop = y;

const bars: string[] = [];
for (const it of items) {
  if (it.kind === "head") {
    y += 10;
    bars.push(`<text x="16" y="${y + 18}" font-size="15" font-weight="800" letter-spacing="2" fill="${MUTED}">${it.text}</text>`);
    y += 24;
    continue;
  }
  const c = counts.get(it.scope)!;
  const cy = y + pitch / 2;
  bars.push(
    `<text x="${labelRight}" y="${cy - 3}" text-anchor="end" font-size="20" font-weight="800"${it.italic ? ' font-style="italic"' : ""} fill="${INK}">${it.name}</text>`,
    `<text x="${labelRight}" y="${cy + 17}" text-anchor="end" font-size="15" fill="${MUTED}">${fmt(c.species)} species · ${fmt(c.tests)} tests</text>`,
  );
  const segs = [c.all3, c.both - c.all3, c.fdr - c.both, c.p05 - c.fdr];
  let sx = x0;
  segs.forEach((v, i) => {
    const w = ((x1 - x0) * v) / c.tests;
    if (w > 0) {
      const gap = w > 3 ? 2 : 0;
      bars.push(`<rect x="${sx.toFixed(2)}" y="${cy - barH / 2}" width="${(w - gap).toFixed(2)}" height="${barH}" fill="${GREENS[i]}"/>`);
    }
    sx += w;
  });
  const pct = Math.round((100 * c.all3) / c.fdr);
  bars.push(
    `<text x="${colX}" y="${cy + 6}" font-size="18" fill="${INK}"><tspan font-weight="800">${fmt(c.all3)}</tspan> of ${fmt(c.fdr)} · ${pct}%</text>`,
  );
  y += pitch;
}
const plotBottom = y + 4;

// Grid and axis under the bars.
for (const t of [0, 25, 50, 75, 100]) {
  const gx = x0 + ((x1 - x0) * t) / 100;
  out.push(`<line x1="${gx}" y1="${plotTop - 8}" x2="${gx}" y2="${plotBottom}" stroke="${t === 0 ? AXIS : GRID}" stroke-width="${t === 0 ? 1.5 : 1}"/>`);
  out.push(`<text x="${gx}" y="${plotBottom + 24}" text-anchor="middle" font-size="16" fill="${MUTED}">${t}%</text>`);
}
out.push(...bars);
out.push(
  `<text x="${(x0 + x1) / 2}" y="${plotBottom + 54}" text-anchor="middle" font-size="17" fill="${INK}">Share of the scope’s lifespan correlations (tests of every mtDNA feature)</text>`,
);
const H = plotBottom + 76;

const font = (p: string) => `data:font/woff2;base64,${readFileSync(p).toString("base64")}`;
const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" font-family="Nunito">
<rect width="${W}" height="${H}" fill="#ffffff"/>
${out.join("\n")}
</svg>`;
const html = `<!doctype html><html><head><meta charset="utf-8"><style>
@font-face { font-family: Nunito; font-style: normal; font-weight: 200 1000; src: url(${font(fontPath)}) format("woff2"); }
@font-face { font-family: Nunito; font-style: italic; font-weight: 200 1000; src: url(${font(fontItalicPath)}) format("woff2"); }
html, body { margin: 0; padding: 0; background: #fff; } svg { display: block; }
</style></head><body>${svg}</body></html>`;

const work = mkdtempSync(join(tmpdir(), "mitoage-figure-1-"));
writeFileSync(join(work, "figure-1.svg"), svg);
writeFileSync(join(work, "figure-1.html"), html);
const png = join(work, "figure-1.png");
const run = (cmd: string[]) => {
  const r = Bun.spawnSync(cmd, { stdout: "pipe", stderr: "pipe" });
  if (r.exitCode !== 0) throw new Error(`${cmd[0]} failed (${r.exitCode}): ${r.stderr.toString()}`);
};
run([
  "google-chrome", "--headless=new", "--disable-gpu", "--hide-scrollbars", "--no-first-run", `--user-data-dir=${join(work, "chrome")}`,
  `--window-size=${W},${H}`, "--force-device-scale-factor=3", "--virtual-time-budget=3000",
  `--screenshot=${png}`, `file://${join(work, "figure-1.html")}`,
]);
run(["magick", png, "-background", "white", "-flatten", "-quality", "92", outPath]);
console.log(`wrote ${outPath} (${W * 3} x ${H * 3} px); SVG and PNG in ${work}`);
