// Figure 5 of the MitoAge 2 manuscript: the plot explorer, captured from the built site.
//
//   bun run build                                                     # if dist/ is not current
//   env SITE_URL=https://just-dna.life BASE_PATH=/mitoage bun run preview --port 4349
//   bun docs/manuscript/figures/capture-figure-5.ts http://localhost:4349
//
// The argument is the preview's origin as its log prints it (the port it actually took). Headless Google
// Chrome is driven over the DevTools protocol (cdp.ts, with its colour workaround), light theme, device scale 3.
//
// Panel A: the plot card (axis pickers, species and highlight fields, chips, scatter, class legend) beside the
// "Corrected statistics" card, without the hint line, the fit-line switch and buttons, and the "Live
// statistics" box under the plot. Viewport 1,280 px: the corrected statistics stand beside the plot from
// 66rem (1,056 px) up, but below about 1,200 px the axis pickers cut the feature names short.
// Panel B: the "Strongest correlations" card as it opens (maximum lifespan, all species): its title, then its
// summary line and the first five rows of the ranking, without the intro sentence beside the title and the
// trait, species and feature selectors. Viewport 1,150 px, so that the ranking is not mostly empty space.
// A above B, each across the page (178 mm). ImageMagick labels the panels and writes
// FIGURE_5_PLOT_EXPLORER.jpg (quality 90). The script prints the smallest text of each panel as printed.

import { openChrome, originArg, magick, size, printedPt, sleep, join, type Rect } from "./cdp.ts";

const origin = originArg("capture-figure-5.ts");
const PAGE =
  "/mitoage/compare/plot/?x=maxLongevityYears&y=gc:total_mtDNA&scope=class:Mammalia&fit=1" +
  "&highlight=homo-sapiens,balaena-mysticetus,heterocephalus-glaber,mus-musculus";
const outPath = join(import.meta.dir, "FIGURE_5_PLOT_EXPLORER.jpg");
const BG = "#f4fae6"; // --lime-50, the page background
const INK = "#17305c"; // --navy-900
const FONT = "DejaVu-Sans-Bold"; // panel letters; ImageMagick cannot read the site's woff2
const VW_A = 1280;
const VW_B = 1150;
const SCALE = 3;
const PAGE_MM = 178;
const OUT_W = 3600; // px across 178 mm: 514 dpi

const c = await openChrome("mitoage-figure-5-");
try {
  const w = c.work;
  // ------------------------------------------------------------------------------------------------ A
  await c.load(origin + PAGE, VW_A, 1400, SCALE);
  await c.show(".xp-plot");
  await c.waitFor(
    `document.querySelectorAll(".xp-plot svg circle").length > 100 && document.querySelector(".xp-pre") && /q-value/i.test(document.querySelector(".xp-pre").textContent)`,
    "the plot and the corrected statistics",
  );
  // The corrected statistics are sticky: measure with the page at the top, where they stand beside the plot.
  await c.evaluate(`window.scrollTo({ top: 0, behavior: "instant" })`);
  await sleep(1000);
  const plot = await c.rect(".xp-plot");
  const side = await c.rect(".xp-side .xp-pre");
  const legend = await c.rect(".xp-chart .chart__legend");
  if (side.x < plot.x + plot.width) throw new Error("the corrected statistics do not stand beside the plot at this width");
  const pad = 12;
  const top = Math.min(plot.y, side.y) - pad;
  const clipA: Rect = {
    x: plot.x - pad,
    y: top,
    width: side.x + side.width - plot.x + 2 * pad,
    height: Math.max(legend.y + legend.height + 6, side.y + side.height + pad) - top,
  };
  const textA = await c.evaluate<string>(`document.querySelector(".xp-pre").innerText.replace(/\\s+/g, " ")`);
  const smallA = await c.smallestText(clipA);
  await c.shot(clipA, join(w, "5a.png"));

  // ------------------------------------------------------------------------------------------------ B
  await c.load(origin + PAGE, VW_B, 1400, SCALE);
  await c.show(".xp-strong");
  await c.waitFor(
    `document.querySelectorAll(".xp-strong .xp-rows__list > li").length >= 5 && /features have q/.test(document.querySelector(".xp-strong__summary")?.textContent ?? "")`,
    "the Strongest correlations rows",
  );
  await c.unstick();
  const strong = await c.rect(".xp-strong");
  const head = await c.rect(".xp-strong .card__head > div");
  const lede = await c.rect(".xp-strong__lede");
  const summary = await c.rect(".xp-strong__summary");
  const row5 = await c.rect(`(document.querySelectorAll(".xp-strong .xp-rows__list > li")[4])`);
  if (!(lede.y < head.y + head.height && lede.x >= head.x + head.width)) {
    throw new Error("the intro sentence is not beside the title at this width; the cut would keep it");
  }
  // The title, cut short of the intro sentence beside it; then the summary line down to the fifth row.
  const clipB1: Rect = { x: strong.x, y: strong.y, width: lede.x - 16 - strong.x, height: head.y + head.height + 10 - strong.y };
  const clipB2: Rect = { x: strong.x, y: summary.y - 10, width: strong.width, height: row5.y + row5.height + 2 - (summary.y - 10) };
  const textB = await c.evaluate<Record<string, string>>(`(() => ({
    summary: document.querySelector(".xp-strong__summary").innerText.replace(/\\s+/g, " "),
    rows: [...document.querySelectorAll(".xp-strong .xp-rows__list > li")].slice(0, 5).map((li) => li.innerText.replace(/\\s+/g, " ")).join(" | "),
  }))()`);
  const smallB = [await c.smallestText(clipB1), await c.smallestText(clipB2)].sort((p, q) => (p.px ?? Infinity) - (q.px ?? Infinity))[0];
  await c.shot(clipB1, join(w, "5b1.png"));
  await c.shot(clipB2, join(w, "5b2.png"));
  await c.close();

  console.log(`A, corrected statistics: ${textA}`);
  for (const [k, v] of Object.entries(textB)) console.log(`B, ${k}: ${v}`);

  // ----------------------------------------------------------------------------------------- composing
  magick(["-background", "#ffffff", join(w, "5b1.png"), join(w, "5b2.png"), "-gravity", "northwest", "-append", join(w, "5b.png")]);
  const place = (src: string, letter: string, dst: string) =>
    magick(["-background", BG, "-fill", INK, "-font", FONT, "-pointsize", "110",
      "(", "-size", `${OUT_W}x170`, `xc:${BG}`, "-gravity", "west", "-annotate", "+10+0", letter, ")",
      "(", src, "-resize", `${OUT_W}x`, ")", "-gravity", "northwest", "-append", dst]);
  place(join(w, "5a.png"), "A", join(w, "5a-l.png"));
  place(join(w, "5b.png"), "B", join(w, "5b-l.png"));
  magick(["-background", BG, join(w, "5a-l.png"), "(", "-size", `${OUT_W}x60`, `xc:${BG}`, ")", join(w, "5b-l.png"),
    "-append", "-bordercolor", BG, "-border", "0x24", "-quality", "90", outPath]);

  const out = size(outPath);
  console.log(`wrote ${outPath}: ${out.w} x ${out.h} px; at ${PAGE_MM} mm wide ${((PAGE_MM * out.h) / out.w).toFixed(0)} mm tall, ${(out.w / (PAGE_MM / 25.4)).toFixed(0)} dpi`);
  const cssB = Math.max(clipB1.width, clipB2.width);
  console.log(`smallest text, panel A: ${smallA.px} CSS px ("${smallA.text}") in a cut ${Math.round(clipA.width)} px wide, ${printedPt(smallA.px, clipA.width, PAGE_MM).toFixed(1)} pt at ${PAGE_MM} mm`);
  console.log(`smallest text, panel B: ${smallB.px} CSS px ("${smallB.text}") in a cut ${Math.round(cssB)} px wide, ${printedPt(smallB.px, cssB, PAGE_MM).toFixed(1)} pt at ${PAGE_MM} mm`);
  console.log(`panels in ${w}`);
} catch (e) {
  await c.close().catch(() => {});
  throw e;
}
