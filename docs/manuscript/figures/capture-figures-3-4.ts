// Figures 3 and 4 of the MitoAge 2 manuscript and Figure 3—figure supplement 1: the interface and the COX1
// alignment, captured from the built site.
//
//   bun run build                                                     # if dist/ is not current
//   env SITE_URL=https://just-dna.life BASE_PATH=/mitoage bun run preview --port 4349
//   bun docs/manuscript/figures/capture-figures-3-4.ts http://localhost:4349
//
// The argument is the preview's origin as its log prints it (the port it actually took). Headless Google
// Chrome is driven over the DevTools protocol (cdp.ts, with its colour workaround), light theme, device scale
// 3. Each panel is captured at the narrowest viewport that keeps its content whole, because the site's text
// keeps its CSS size while the layout narrows, so a narrower capture prints its text larger:
//
//   3A /species/, sorted by maximum lifespan, longest first; the toolbar with the two download buttons, the
//      species count and the first eight rows. Viewport 1,360 px: below it the sorted table scrolls sideways and
//      the lifespan column leaves the card.
//   3B /tree/ as it opens (by rank, lifespan ring): the tree and its legend, without the card of the selected
//      taxon, which at this width stands between the two, and without the search, layout and ring controls
//      above the tree, which at this width take three rows. Viewport 600 px.
//   3C /compare/class/mammalia/?chart=r, the Regions card: its title, then the chart with its key and note,
//      without the parameter and chart selectors. Viewport 560 px.
//   3D /species/balaena-mysticetus/, the Genome map card: its title, the map, the legend and the keys,
//      without the help card. Viewport 640 px.
//   4  /genes/cox1/, the Alignment card, class Mammalia, longest-lived first: its title, the count line, the
//      grid (conservation bar, species, lifespan, residues) cut after its twentieth row, and the colour key,
//      without the selectors, the search and the download cards. Viewport 660 px, so that the grid is at
//      least 560 px wide and the viewer keeps its full species names.
//
// Figure 3 (decision D7) is panel A across the page (178 mm) with panel B centred under it, as wide as a
// total height of 218 mm allows. Figure 3—figure supplement 1 is C beside D, relabelled A and B, each in a
// column of 86 mm across the page. Figure 4 is one column (86 mm). ImageMagick labels the panels and writes
// FIGURE_3_INTERFACE.jpg, FIGURE_3_SUPPLEMENT_1.jpg and FIGURE_4_ALIGNMENT.jpg (quality 90). The script
// prints, for each panel, the smallest text in it and the size that text prints at.

import { openChrome, originArg, magick, size, printedPt, sleep, join, type Rect } from "./cdp.ts";

const origin = originArg("capture-figures-3-4.ts");
const BASE = origin + "/mitoage";
const BG = "#f4fae6"; // --lime-50, the page background
const INK = "#17305c"; // --navy-900
const FONT = "DejaVu-Sans-Bold"; // panel letters; ImageMagick cannot read the site's woff2
const SCALE = 3;
const COLUMN_MM = 86;
const PAGE_MM = 178;
const DPI = 450; // the composed figures, as printed
const colPx = Math.round((COLUMN_MM / 25.4) * DPI);
const gutterPx = Math.round(((PAGE_MM - 2 * COLUMN_MM) / 25.4) * DPI);
const MAX_HEIGHT_MM = 218; // Figure 3, as printed
const out3 = join(import.meta.dir, "FIGURE_3_INTERFACE.jpg");
const out3s = join(import.meta.dir, "FIGURE_3_SUPPLEMENT_1.jpg");
const out4 = join(import.meta.dir, "FIGURE_4_ALIGNMENT.jpg");

type Panel = { letter: string; file: string; cssWidth: number; smallest: { px: number; text: string }; note?: string };
const panels: Record<string, Panel> = {};
const union = (rs: Rect[], pad = 0): Rect => {
  const x0 = Math.min(...rs.map((r) => r.x)) - pad, y0 = Math.min(...rs.map((r) => r.y)) - pad;
  const x1 = Math.max(...rs.map((r) => r.x + r.width)) + pad, y1 = Math.max(...rs.map((r) => r.y + r.height)) + pad;
  return { x: x0, y: y0, width: x1 - x0, height: y1 - y0 };
};
// A cut with no HTML or SVG text in it comes back with no size (JSON has no Infinity); it does not count.
const smaller = (a: { px: number | null; text: string }, b: { px: number | null; text: string }) =>
  (b.px ?? Infinity) < (a.px ?? Infinity) ? (b as { px: number; text: string }) : (a as { px: number; text: string });

const c = await openChrome("mitoage-figures-3-4-");
const w = c.work;
// Several cuts of one card, stacked on the card's white into one panel.
const cuts = async (name: string, clips: Rect[], skip = "") => {
  const files: string[] = [];
  let smallest = { px: Infinity, text: "" };
  for (let i = 0; i < clips.length; i++) {
    const f = join(w, `${name}-${i}.png`);
    await c.shot(clips[i], f);
    files.push(f);
    smallest = smaller(smallest, await c.smallestText(clips[i], skip));
  }
  const file = join(w, `${name}.png`);
  magick(["-background", "#ffffff", ...files, "-gravity", "northwest", "-append", file]);
  return { file, cssWidth: Math.max(...clips.map((r) => r.width)), smallest };
};

try {
  // ------------------------------------------------------------------------------------------- 3A species
  await c.load(`${BASE}/species/`, 1360, 1400, SCALE);
  await c.show(".sp-index .card");
  await c.waitFor(`document.querySelectorAll(".sp-index table tbody tr").length >= 8`, "the species table");
  for (let i = 0; i < 3; i++) {
    const first = await c.evaluate<string>(`document.querySelector(".sp-index table tbody tr").innerText`);
    if (/Arctica islandica/.test(first)) break;
    await c.evaluate(`[...document.querySelectorAll(".sp-index .dtable__sort")].find((b) => /Max lifespan/.test(b.textContent)).click()`);
    await sleep(800);
  }
  const rowsA = await c.evaluate<string[]>(`[...document.querySelectorAll(".sp-index table tbody tr")].slice(0, 8).map((r) => r.innerText.replace(/\\s+/g, " "))`);
  if (!/Arctica islandica/.test(rowsA[0])) throw new Error("the species list did not sort by maximum lifespan, longest first");
  const tableA = await c.evaluate<{ scroll: number; client: number }>(`(() => { const t = document.querySelector(".sp-index table"); return { scroll: t.scrollWidth, client: t.parentElement.clientWidth }; })()`);
  if (tableA.scroll > tableA.client + 1) throw new Error(`the species table scrolls sideways at this width (${tableA.scroll} > ${tableA.client})`);
  await c.unstick();
  {
    const card = await c.rect(".sp-index .card");
    const row8 = await c.rect(`(document.querySelectorAll(".sp-index table tbody tr")[7])`);
    const p = await cuts("3a", [{ x: card.x, y: card.y, width: card.width, height: row8.y + row8.height + 1 - card.y }]);
    panels.A = { letter: "A", ...p };
    console.log(`3A rows: ${rowsA.slice(0, 2).join(" | ")}`);
    console.log(`3A count: ${await c.evaluate<string>(`[...document.querySelectorAll(".sp-index .card *")].find((e) => /^[\\d,]+ species$/.test(e.textContent.trim()) && !e.children.length)?.textContent.trim() ?? ""`)}`);
  }

  // ---------------------------------------------------------------------------------------------- 3B tree
  await c.load(`${BASE}/tree/`, 600, 1400, SCALE);
  await c.show(".tree-card", 4000);
  await c.waitFor(`document.querySelector(".rtree__frame canvas, .rtree__frame svg")`, "the tree");
  await sleep(1500);
  await c.unstick();
  {
    const card = await c.rect(".tree-card");
    const toolbar = await c.rect(".rtree__toolbar");
    const frame = await c.rect(".rtree__frame");
    const panel = await c.rect(".rtree__panel");
    const legend = await c.rect(".rtree__legend");
    if (!(panel.y >= frame.y + frame.height && legend.y >= panel.y + panel.height)) throw new Error("the taxon card does not stand between the tree and the legend at this width");
    const inset = toolbar.x - card.x;
    const p = await cuts("3b", [
      { x: card.x, y: frame.y - inset, width: card.width, height: frame.height + inset + 8 },
      { x: card.x, y: legend.y - 8, width: card.width, height: card.y + card.height - (legend.y - 8) },
    ]);
    // The tree is drawn on a canvas; its smallest labels (the ranks inside the rings) are 0.8 of its label
    // size, 12.5 px, or 11.5 px when the drawing is under 520 px (src/lib/tree/camera.ts, treeDraw.ts).
    const fs = Math.min(frame.width, frame.height) < 520 ? 11.5 : 12.5;
    const canvasPx = 0.8 * fs;
    panels.B = { letter: "B", ...p, smallest: smaller(p.smallest, { px: canvasPx, text: "rank labels on the tree canvas" }) };
  }

  // ------------------------------------------------------------------------------------------- 3C regions
  await c.load(`${BASE}/compare/class/mammalia/?chart=r`, 560, 1400, SCALE);
  await c.show(".cs-card");
  await c.waitFor(`document.querySelector(".cs-card figure.chart svg") && document.querySelectorAll(".cs-card figure.chart svg circle, .cs-card figure.chart svg line").length > 20`, "the Regions chart");
  await sleep(1000);
  await c.unstick();
  {
    const card = await c.rect(".cs-card");
    const head = await c.rect(".cs-card .card__head");
    const fig = await c.rect(".cs-card figure.chart");
    const inset = head.x - card.x;
    const p = await cuts("3c", [
      { x: card.x, y: card.y, width: card.width, height: head.y + head.height + 12 - card.y },
      { x: card.x, y: fig.y - 4, width: card.width, height: fig.height + 16 },
    ]);
    panels.C = { letter: "C", ...p };
    console.log(`3C title: ${await c.evaluate<string>(`document.querySelector(".cs-card .card__head").innerText.replace(/\\s+/g, " ")`)}`);
  }

  // ---------------------------------------------------------------------------------------- 3D genome map
  await c.load(`${BASE}/species/balaena-mysticetus/`, 640, 1400, SCALE);
  await c.show(".gmapfig");
  await c.waitFor(`document.querySelectorAll(".gmap__frame svg path").length > 30`, "the genome map");
  await sleep(1500);
  await c.unstick();
  {
    const card = await c.rect(`(document.querySelector(".gmapfig").closest(".card"))`);
    const head = await c.rect(`(document.querySelector(".gmapfig").closest(".card").querySelector(".card__head"))`);
    const frame = await c.rect(".gmap__frame svg");
    const keys = union([await c.rect(".gmap__legend"), await c.rect(".gmap__keys")]);
    const inset = head.x - card.x;
    const p = await cuts("3d", [
      { x: card.x, y: card.y, width: card.width, height: head.y + head.height + 8 - card.y },
      { x: card.x, y: frame.y - 4, width: card.width, height: frame.height + 16 },
      { x: card.x, y: keys.y - 8, width: card.width, height: keys.height + inset },
    ]);
    panels.D = { letter: "D", ...p };
    console.log(`3D: ${await c.evaluate<string>(`document.querySelector(".gmapfig").closest(".card").querySelector(".card__head").innerText.replace(/\\s+/g, " ")`)}; ${await c.evaluate<string>(`[...document.querySelectorAll(".gmap__frame svg text")].map((t) => t.textContent).filter((t) => /bp|GC/.test(t)).join(" / ")`)}`);
  }

  // -------------------------------------------------------------------------------------------- 4 alignment
  await c.load(`${BASE}/genes/cox1/`, 660, 1400, SCALE);
  await c.show(".aln__controls, .aln__hold", 3000);
  await c.waitFor(`document.querySelector(".aln__controls select")`, "the alignment viewer");
  await c.evaluate(`(() => { const s = document.querySelector(".aln__controls select"); s.value = "Mammalia"; s.dispatchEvent(new Event("change", { bubbles: true })); })()`);
  await sleep(500);
  await c.evaluate(`[...document.querySelectorAll(".aln__controls .seg__btn")].find((b) => /Longest-lived/.test(b.textContent)).click()`);
  await sleep(1500);
  await c.show(".aln__count", 2000);
  await c.unstick();
  {
    const card = await c.rect(`(document.querySelector(".aln__frame").closest(".card"))`);
    const head = await c.rect(`(document.querySelector(".aln__frame").closest(".card").querySelector(".card__head"))`);
    const count = await c.rect(".aln__count");
    const frame = await c.rect(".aln__frame");
    const legend = await c.rect(".aln__legend");
    if (frame.width < 560) throw new Error(`the alignment grid is ${frame.width} px wide; under 560 px the viewer cuts the species names`);
    const ROWS = 20;
    const HEAD_H = 46; // src/components/genome/AlignmentViewer.tsx
    const CELL = { w: 13, h: 18 };
    const inset = head.x - card.x;
    const p = await cuts("4", [
      { x: card.x, y: card.y, width: card.width, height: head.y + head.height + 12 - card.y },
      { x: card.x, y: count.y - 6, width: card.width, height: frame.y + HEAD_H + ROWS * CELL.h + 2 - (count.y - 6) },
      { x: card.x, y: legend.y - 14, width: card.width, height: legend.height + inset },
    ], ".aln__told");
    // Letters and species names are drawn at 12 px, the column numbers and lifespans at 11 px, on a canvas.
    panels.F4 = { letter: "", ...p, smallest: smaller(p.smallest, { px: 11, text: "column numbers and lifespans on the alignment canvas" }) };
    const info = await c.evaluate<{ count: string; head: string; first: number; last: number; cols: number }>(`(() => {
      return { count: document.querySelector(".aln__count").innerText.trim(), head: document.querySelector(".aln__frame").closest(".card").querySelector(".card__head").innerText.replace(/\\s+/g, " "), first: 0, last: 0, cols: 0 };
    })()`);
    const gutter = 248;
    console.log(`4: ${info.head}`);
    console.log(`4: ${info.count}; ${ROWS} rows and ${Math.floor((frame.width - gutter) / CELL.w)} residue columns on show`);
  }
  await c.close();

  // ------------------------------------------------------------------------------------------- composing
  // A panel scaled to a width, its letter above it, on the page background; returns the file and the width
  // in mm the panel's own image prints at.
  const pagePx = Math.round((PAGE_MM / 25.4) * DPI);
  const MARGIN = 18;
  const placed = (p: Panel, name: string, widthPx: number, letter = p.letter) => {
    const scaled = join(w, `${name}-w.png`);
    magick([p.file, "-resize", `${widthPx - 2 * MARGIN}x`, "-bordercolor", BG, "-border", `${MARGIN}x0`, scaled]);
    const mm = ((widthPx - 2 * MARGIN) / DPI) * 25.4;
    if (!letter) return { file: scaled, mm };
    const labelled = join(w, `${name}-lab.png`);
    magick(["-background", BG, "-fill", INK, "-font", FONT, "-pointsize", "96", "(", "-size", `${widthPx}x150`, "xc:" + BG, "-gravity", "west",
      "-annotate", `+${MARGIN}+0`, letter, ")", scaled, "-append", labelled]);
    return { file: labelled, mm };
  };
  const printed: Record<string, number> = {}; // mm each panel prints at

  // Figure 3: A across the page; B under it, centred, as wide as the height budget allows.
  const a3 = placed(panels.A, "a", pagePx);
  printed.A = a3.mm;
  const budgetPx = Math.round((MAX_HEIGHT_MM / 25.4) * DPI);
  const bImg = size(panels.B.file);
  const room = budgetPx - size(a3.file).h - 40 - 150 - 48; // spacer, B's letter strip, top and bottom border
  const bWidth = Math.min(pagePx, Math.floor((room * bImg.w) / bImg.h) + 2 * MARGIN);
  const b3 = placed(panels.B, "b", bWidth);
  printed.B = b3.mm;
  magick(["-background", BG, a3.file, "(", "-size", `${pagePx}x40`, `xc:${BG}`, ")",
    "(", b3.file, "-gravity", "center", "-extent", `${pagePx}x${size(b3.file).h}`, ")", "-gravity", "northwest", "-append",
    "-bordercolor", BG, "-border", "0x24", "-quality", "90", out3]);

  // Figure 3—figure supplement 1: C beside D, each in a column of 86 mm, relabelled A and B.
  const c3 = placed(panels.C, "c", colPx, "A");
  const d3 = placed(panels.D, "d", colPx, "B");
  printed.C = c3.mm;
  printed.D = d3.mm;
  magick(["-background", BG, c3.file, "(", "-size", `${gutterPx}x1`, `xc:${BG}`, ")", d3.file, "-gravity", "north", "+append",
    "-bordercolor", BG, "-border", "0x24", "-quality", "90", out3s]);

  // Figure 4: one column.
  const f4 = placed(panels.F4, "f4", colPx);
  printed.F4 = f4.mm;
  magick([f4.file, "-background", BG, "-bordercolor", BG, "-border", "0x24", "-quality", "90", out4]);

  const report = (file: string, mm: number) => {
    const s = size(file);
    return `${s.w} x ${s.h} px; at ${mm} mm wide ${((mm * s.h) / s.w).toFixed(0)} mm tall, ${(s.w / (mm / 25.4)).toFixed(0)} dpi`;
  };
  console.log(`wrote ${out3}: ${report(out3, PAGE_MM)}`);
  console.log(`wrote ${out3s}: ${report(out3s, PAGE_MM)}`);
  console.log(`wrote ${out4}: ${report(out4, COLUMN_MM)}`);
  const names: Record<string, string> = { A: "Figure 3A", B: "Figure 3B", C: "supplement A (Regions)", D: "supplement B (genome map)", F4: "Figure 4" };
  for (const [k, p] of Object.entries(panels)) {
    const pt = printedPt(p.smallest.px, p.cssWidth, printed[k]);
    console.log(`smallest text, ${names[k]}: ${p.smallest.px.toFixed(1)} CSS px ("${p.smallest.text}") in a cut ${Math.round(p.cssWidth)} px wide, printed ${printed[k].toFixed(0)} mm wide: ${pt.toFixed(1)} pt`);
  }
  console.log(`panels in ${w}`);
} catch (e) {
  await c.close().catch(() => {});
  throw e;
}
