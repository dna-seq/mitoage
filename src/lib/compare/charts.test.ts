import { describe, expect, test } from "bun:test";
import type { Row } from "~/components/ui/DataTable";
import { describePairs } from "~/lib/explore/stats";
import { benjaminiHochberg as pipelineBH } from "../../../pipeline/lib/stats";
import { groupCodons, groupStats, regionValues, statsGroups, taxonomyFile } from "./build";
import {
  codonBarRows,
  corrMap,
  corrShade,
  fmtRShort,
  getScatterAxis,
  isPlotKey,
  MAP_PARAMS,
  MAP_R_LIMIT,
  rangeAxis,
  rangeMarks,
  rangePlotOf,
  regionColor,
  REGION_SWATCHES,
  SCATTER_AXES,
  speciesAxisValue,
  speciesScatter,
} from "./charts";
import { getParam, PARAM_KEYS, STATS_REGIONS } from "./params";
import { regionRows, speciesRows, taxaRows } from "./rows";
import { MIN_CORR_N } from "./summary";

const all = statsGroups()[0]!;
const file = groupStats(all);
const tax = taxonomyFile();
const grey = () => "grey";
const n = (v: unknown): number => v as number;

describe("range chart", () => {
  test("every species has a lifespan, so the n of a row is the n of its correlation", () => {
    expect(tax.species.length).toBeGreaterThan(0);
    expect(tax.species.every((s) => s[7] > 0)).toBe(true);
  });

  test("distribution marks are the table's numbers", () => {
    for (const key of PARAM_KEYS) {
      const rows = regionRows(file, key);
      const marks = rangeMarks(rows, "dist", getParam(key), grey);
      expect(marks.length).toBe(rows.length);
      marks.forEach((m, i) => {
        const row = rows[i]!;
        expect(m.label).toBe(row["label"] as string);
        expect(m.n).toBe(n(row["n"]));
        expect(m.dot).toBe(n(row["mean"]));
        expect(m.tick).toBe(n(row["median"]));
        expect([m.lo, m.hi]).toEqual([n(row["min"]), n(row["max"])]);
        expect(m.boxHi! - m.boxLo!).toBeCloseTo(2 * n(row["sd"]), 9);
        expect((m.boxHi! + m.boxLo!) / 2).toBeCloseTo(m.dot!, 9);
        expect(m.lo!).toBeLessThanOrEqual(m.tick!);
        expect(m.tick!).toBeLessThanOrEqual(m.hi!);
        expect(m.empty).toBeNull();
      });
    }
  });

  test("the axis holds every mark; percentages stay within 0 to 100", () => {
    for (const key of PARAM_KEYS) {
      const p = getParam(key);
      const marks = rangeMarks(regionRows(file, key), "dist", p, grey);
      const axis = rangeAxis(marks, "dist", p);
      expect(axis.log).toBe(false);
      for (const m of marks) {
        for (const v of [m.lo, m.hi, m.dot, m.tick]) {
          expect(v!).toBeGreaterThanOrEqual(axis.domain[0]);
          expect(v!).toBeLessThanOrEqual(axis.domain[1]);
        }
      }
      if (p.unit === "%") {
        expect(axis.domain[0]).toBeGreaterThanOrEqual(0);
        expect(axis.domain[1]).toBeLessThanOrEqual(100);
      }
    }
  });

  test("lengths of the regions get a log axis when asked, lengths of one region do not", () => {
    const p = getParam("length");
    const regions = rangeMarks(regionRows(file, "length"), "dist", p, grey);
    const log = rangeAxis(regions, "dist", p, true);
    expect(log.log).toBe(true);
    expect(log.domain[0]).toBeGreaterThan(0);
    for (const m of regions) {
      expect(m.lo!).toBeGreaterThanOrEqual(log.domain[0]);
      expect(m.hi!).toBeLessThanOrEqual(log.domain[1]);
    }
    expect(rangeAxis(regions, "dist", p).log).toBe(false);
    const classes = taxaRows(tax, regionValues("COX1"), { rank: "all", name: "" }, "class", "length");
    expect(rangeAxis(rangeMarks(classes, "dist", p, grey), "dist", p, true).log).toBe(false);
    expect(rangeAxis(rangeMarks(regionRows(file, "gc"), "dist", getParam("gc"), grey), "dist", getParam("gc"), true).log).toBe(false);
  });

  test("lifespan r: the dot is the table's r, inside its interval, on a symmetric axis", () => {
    const rows = taxaRows(tax, regionValues("total_mtDNA"), { rank: "all", name: "" }, "order", "gc");
    const p = getParam("gc");
    const marks = rangeMarks(rows, "r", p, grey);
    const drawn = marks.filter((m) => m.dot !== null);
    expect(drawn.length).toBeGreaterThan(10);
    expect(drawn.length).toBeLessThan(marks.length);
    marks.forEach((m, i) => {
      const row = rows[i]!;
      if (row["r"] === null) {
        expect(m.dot).toBeNull();
        expect(m.empty).toBe(m.n < MIN_CORR_N ? `fewer than ${MIN_CORR_N} species` : "not defined");
        return;
      }
      expect(m.dot).toBe(n(row["r"]));
      expect(m.lo!).toBeLessThan(m.dot!);
      expect(m.hi!).toBeGreaterThan(m.dot!);
      expect(m.lo!).toBeGreaterThanOrEqual(-1);
      expect(m.hi!).toBeLessThanOrEqual(1);
    });
    const axis = rangeAxis(marks, "r", p);
    expect(axis.domain[0]).toBe(-axis.domain[1]);
    expect(axis.domain[1]).toBeLessThanOrEqual(1);
    expect(axis.zero).toBe(true);
    for (const m of drawn) {
      expect(m.lo!).toBeGreaterThanOrEqual(axis.domain[0]);
      expect(m.hi!).toBeLessThanOrEqual(axis.domain[1]);
    }
    // More species, narrower interval at a similar r.
    const wide = rangeMarks([{ label: "a", n: 8, r: 0.3, p: 0.4 }], "r", p, grey)[0]!;
    const narrow = rangeMarks([{ label: "b", n: 800, r: 0.3, p: 1e-9 }], "r", p, grey)[0]!;
    expect(narrow.hi! - narrow.lo!).toBeLessThan(wide.hi! - wide.lo!);
  });

  test("variation: CV for ratio-scale parameters, SD for the skews, from zero", () => {
    for (const key of ["gc", "length", "gcSkew"] as const) {
      const p = getParam(key);
      const rows = regionRows(file, key);
      const marks = rangeMarks(rows, "var", p, grey);
      marks.forEach((m, i) => {
        expect(m.boxLo).toBe(0);
        expect(m.boxHi).toBe(n(rows[i]![p.cv ? "cv" : "sd"]));
        expect(m.dot).toBeNull();
      });
      const axis = rangeAxis(marks, "var", p);
      expect(axis.domain[0]).toBe(0);
      expect(axis.domain[1]).toBeGreaterThanOrEqual(Math.max(...marks.map((m) => m.boxHi!)));
      expect(axis.label.startsWith(p.cv ? "CV of " : "SD of ")).toBe(true);
    }
  });

  test("rows with nothing to draw say why; an empty table still gets an axis", () => {
    const p = getParam("gc");
    const one: Row = { name: "Solo", n: 1, mean: 40, sd: null, cv: null, min: 40, median: 40, max: 40, r: null, p: null };
    const none: Row = { name: "None", n: 0, mean: null, sd: null, cv: null, min: null, median: null, max: null, r: null, p: null };
    const dist = rangeMarks([one, none], "dist", p, grey);
    expect(dist[0]).toMatchObject({ label: "Solo", dot: 40, boxLo: null, boxHi: null, empty: null });
    expect(dist[1]?.empty).toBe("no values");
    expect(rangeMarks([one], "var", p, grey)[0]?.empty).toBe("one species");
    expect(rangeMarks([one], "r", p, grey)[0]?.empty).toBe(`fewer than ${MIN_CORR_N} species`);
    expect(rangeMarks([{ ...one, n: 9 }], "r", p, grey)[0]?.empty).toBe("not defined");
    for (const plot of ["dist", "var", "r"] as const) {
      const axis = rangeAxis(rangeMarks([none], plot, p, grey), plot, p, true);
      expect(axis.domain[1]).toBeGreaterThan(axis.domain[0]);
      expect(Number.isFinite(axis.domain[0]) && Number.isFinite(axis.domain[1])).toBe(true);
    }
    expect(rangeMarks([], "dist", p, grey)).toEqual([]);
  });

  test("plot keys and region colours", () => {
    expect(isPlotKey("map")).toBe(true);
    expect(isPlotKey("bars")).toBe(false);
    expect(rangePlotOf("map")).toBe("r");
    expect(rangePlotOf("var")).toBe("var");
    const swatches = new Set(REGION_SWATCHES.map((s) => s.color));
    for (const r of STATS_REGIONS) expect(swatches.has(regionColor(r))).toBe(true);
    expect(regionColor("ND6")).toBe(regionColor("total_pc"));
    expect(regionColor("rRNA-12S")).toBe(regionColor("total_rRNA"));
    expect(new Set(STATS_REGIONS.map(regionColor)).size).toBe(REGION_SWATCHES.length);
  });
});

describe("lifespan-correlation map", () => {
  const map = corrMap(file);

  test("cells are the table's r and p, for every region and every parameter but AT %", () => {
    expect(map.regions).toEqual(STATS_REGIONS.filter((r) => file.stats[r]));
    expect(map.params).toEqual(PARAM_KEYS.filter((k) => k !== "at"));
    expect(map.params).toEqual([...MAP_PARAMS]);
    map.regions.forEach((region, ri) => {
      map.params.forEach((param, pi) => {
        const t = file.stats[region]![param]!;
        expect(map.cells[ri]![pi]).toMatchObject({ n: t[0], r: t[8], p: t[9] });
      });
    });
  });

  test("AT % is left out because it mirrors GC %", () => {
    for (const region of map.regions) {
      const gc = file.stats[region]!.gc!;
      const at = file.stats[region]!.at!;
      expect(at[8]!).toBeCloseTo(-gc[8]!, 3);
    }
  });

  test("q-values are Benjamini-Hochberg over the whole map", () => {
    const flat = map.cells.flat();
    const ref = pipelineBH(flat.map((c) => (c.r === null || c.p === null ? Number.NaN : c.p)));
    flat.forEach((c, i) => {
      if (c.r === null) expect(c.q).toBeNull();
      else {
        expect(c.q!).toBeCloseTo(ref[i]!, 12);
        expect(c.q!).toBeGreaterThanOrEqual(c.p!);
      }
    });
    expect(map.tests).toBe(flat.filter((c) => c.r !== null).length);
    expect(map.tests).toBe(map.regions.length * map.params.length);
  });

  test("a small group leaves the cells it cannot compute empty and out of the correction", () => {
    const small = statsGroups().find((g) => g.rank !== "all" && g.members.length < MIN_CORR_N)!;
    const m = corrMap(groupStats(small));
    expect(m.cells.flat().every((c) => c.r === null && c.q === null)).toBe(true);
    expect(m.tests).toBe(0);
  });

  test("shade and short labels", () => {
    expect(corrShade(null)).toBe(0);
    expect(corrShade(0)).toBe(0);
    expect(corrShade(-MAP_R_LIMIT / 2)).toBeCloseTo(0.5, 12);
    expect(corrShade(0.95)).toBe(1);
    expect(fmtRShort(-0.214)).toBe("−.21");
    expect(fmtRShort(0.05)).toBe(".05");
    expect(fmtRShort(-0.001)).toBe(".00");
    expect(fmtRShort(1)).toBe("1.00");
    expect(fmtRShort(null)).toBe("–");
  });
});

describe("codon rows", () => {
  const codons = groupCodons(all);

  test("every codon appears once, under its amino acid, and the rows add up", () => {
    for (const region of ["total_pc", "ND6", "ATP8"] as const) {
      const ri = codons.regions.indexOf(region);
      const rows = codonBarRows(codons, region);
      const used = codons.codons.filter((_, i) => (codons.codon[ri]![i]![0] ?? 0) > 0);
      const drawn = rows.flatMap((r) => r.segs.map((s) => s.codon));
      expect(new Set(drawn)).toEqual(new Set(used));
      expect(drawn.length).toBe(used.length);
      const sumOfMeans = codons.codon[ri]!.reduce((s, t) => s + (t[0] > 0 ? (t[1] ?? 0) : 0), 0);
      expect(rows.reduce((s, r) => s + r.total, 0)).toBeCloseTo(sumOfMeans, 6);
      for (const r of rows) {
        expect(r.segs.reduce((s, x) => s + x.mean, 0)).toBeCloseTo(r.total, 9);
        expect(r.segs.reduce((s, x) => s + x.share, 0)).toBeCloseTo(1, 9);
        const thirds = r.segs.map((s) => "atgc".indexOf(s.third));
        expect(thirds).toEqual([...thirds].sort((a, b) => a - b));
        for (const s of r.segs) expect(s.dna).toBe(s.codon.replace(/U/g, "T"));
      }
    }
  });

  test("vertebrate mitochondrial code: six leucine codons, AUA is methionine, stops last, by usage", () => {
    const rows = codonBarRows(codons, "total_pc");
    const of = (aa: string) => rows.find((r) => r.aa === aa)!;
    expect(of("Leu").segs.length).toBe(6);
    expect(of("Met").segs.map((s) => s.codon).sort()).toEqual(["AUA", "AUG"]);
    expect(of("Trp").segs.map((s) => s.codon).sort()).toEqual(["UGA", "UGG"]);
    expect(of("Leu").name).toBe("Leucine");
    // ATP8 is short enough that its stop codons outnumber some amino acids: they still go last.
    for (const region of ["total_pc", "ATP8"] as const) {
      const r = codonBarRows(codons, region);
      expect(r[r.length - 1]?.aa).toBe("Stop");
      const sense = r.slice(0, -1).map((x) => x.total);
      expect(sense).toEqual([...sense].sort((a, b) => b - a));
    }
    const atp8 = codonBarRows(codons, "ATP8");
    expect(atp8.some((r) => r.aa !== "Stop" && r.total < atp8[atp8.length - 1]!.total)).toBe(true);
  });

  test("a region without codon usage gives no rows", () => {
    expect(codonBarRows(codons, "D_Loop")).toEqual([]);
  });
});

describe("species scatter", () => {
  const rows = speciesRows(tax, regionValues("ND6"));
  const axis = (k: string) => getScatterAxis(k);

  test("the plotted correlation with lifespan is the table's r", () => {
    for (const key of PARAM_KEYS) {
      const s = speciesScatter(rows, axis("lifespan"), axis(key));
      const t = file.stats.ND6![key]!;
      expect(s.points.length).toBe(t[0]);
      expect(s.tx.length).toBe(s.points.length);
      expect(describePairs(s.tx, s.ty).pearsonR).toBeCloseTo(t[8]!, 4);
      s.points.forEach((p, i) => {
        expect(s.tx[i]).toBeCloseTo(Math.log10(p.x), 12);
        expect(s.ty[i]).toBe(p.y);
      });
    }
  });

  test("swapping the axes swaps the points; ids are unique and link to the species", () => {
    const a = speciesScatter(rows, axis("gc"), axis("gcSkew"));
    const b = speciesScatter(rows, axis("gcSkew"), axis("gc"));
    expect(b.points.map((p) => [p.y, p.x])).toEqual(a.points.map((p) => [p.x, p.y]));
    expect(new Set(a.points.map((p) => p.id)).size).toBe(a.points.length);
    expect(a.points.every((p) => p.href?.includes("/species/"))).toBe(true);
    const human = a.points.find((p) => p.label === "Homo sapiens");
    expect(human?.group).toBe("Mammalia");
  });

  test("axis values: percentages add up, and every axis has a value for a complete row", () => {
    const row = rows[0]!;
    expect(speciesAxisValue(row, "gc")! + speciesAxisValue(row, "at")!).toBeCloseTo(100, 9);
    const bases = (["a", "t", "g", "c"] as const).reduce((s, k) => s + speciesAxisValue(row, k)!, 0);
    expect(bases).toBeCloseTo(100, 9);
    expect(speciesAxisValue(row, "length")).toBe(row["length"] as number);
    expect(speciesAxisValue(row, "lifespan")).toBe(row["lifespan"] as number);
    expect(SCATTER_AXES.map((a) => a.key)).toEqual(["lifespan", ...PARAM_KEYS]);
    for (const a of SCATTER_AXES) expect(speciesAxisValue(row, a.key)).not.toBeNull();
  });

  test("rows without both values are left out, as are non-positive values on a log axis", () => {
    const ok = rows[0]!;
    const noCounts: Row = { ...ok, href: "/x/", a: null };
    const noLife: Row = { ...ok, href: "/y/", lifespan: 0 };
    const noSkew: Row = { ...ok, href: "/z/", gcSkew: null };
    const life = speciesScatter([ok, noCounts, noLife, noSkew], axis("lifespan"), axis("gc"));
    expect(life.points.map((p) => p.id)).toEqual([ok["href"] as string, "/z/"]);
    const skew = speciesScatter([ok, noCounts, noLife, noSkew], axis("gcSkew"), axis("gc"));
    expect(skew.points.map((p) => p.id)).toEqual([ok["href"] as string, "/y/"]);
    expect(speciesScatter([], axis("gc"), axis("at")).points).toEqual([]);
  });
});
