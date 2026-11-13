/**
 * Turn the compare data files into DataTable rows and columns. Used at build time for the first
 * view of each table and in the browser when the reader switches parameter, region or rank, so
 * both always agree. Safe for islands.
 */
import type { Column, ColumnFormat, Row } from "~/components/ui/DataTable";
import type { Rank, Region } from "~/data/schema";
import { classLabel } from "~/lib/classes";
import { codonAminoAcid } from "~/lib/explore/variables";
import { REGION_INFO } from "~/lib/genes";
import { AMINO_ACIDS } from "~/lib/geneticCode";
import { speciesUrl, taxonUrl } from "~/lib/urls";
import {
  compareGroupUrl,
  compareRegionUrl,
  getParam,
  type GroupRank,
  type Param,
  type ParamKey,
  PARAMS,
  paramValue,
  STATS_REGIONS,
  statsRegionLabel,
} from "./params";
import { coefVar, lifespanCorrelation, summarize } from "./summary";
import type { GroupCodonsFile, GroupStatsFile, RegionValuesFile, TaxonomyFile } from "./wire";

const nn = (v: number | null | undefined): number | null => (v === null || v === undefined || !Number.isFinite(v) ? null : v);

export const valueFormat = (p: Param): ColumnFormat => (p.unit === "%" ? "pct2" : p.unit === "bp" ? "int" : "signed3");
const sdFormat = (p: Param): ColumnFormat => (p.unit === "%" ? "dec2" : p.unit === "bp" ? "dec1" : "dec3");

/** Header suffix with the unit: " (%)", " (bp)" or "". */
const unitOf = (p: Param) => (p.unit === "%" ? " (%)" : p.unit === "bp" ? " (bp)" : "");

/** Mean, SD, CV, min, median, max columns (min and max name their species when known). */
function summaryColumns(p: Param, withSpecies: boolean, withCorr: boolean): Column[] {
  const v = valueFormat(p);
  const extreme = (key: "min" | "max", label: string): Column =>
    withSpecies
      ? {
          key,
          label,
          format: v,
          subKey: `${key}Name`,
          subHrefKey: `${key}Href`,
          subSci: true,
          csvSub: `${label} species`,
        }
      : { key, label, format: v };
  const cols: Column[] = [
    { key: "n", label: "Species", format: "int", title: "Number of species with a value" },
    { key: "mean", label: `Mean${unitOf(p)}`, format: v },
    { key: "sd", label: "SD", format: sdFormat(p), title: "Standard deviation (n − 1)" },
  ];
  if (p.cv) cols.push({ key: "cv", label: "CV", format: "dec3", title: "Coefficient of variation: SD / mean", hideOnMobile: true });
  cols.push(extreme("min", "Min"), { key: "median", label: "Median", format: v }, extreme("max", "Max"));
  if (withCorr) {
    cols.push(
      { key: "r", label: "r", format: "r", title: "Pearson r with log10 maximum lifespan (5 or more species)" },
      { key: "p", label: "p", format: "p", title: "Two-tailed p-value of r, not corrected for multiple testing" },
    );
  }
  return cols;
}

// ---------------------------------------------------------------- regions of one group

export function regionColumns(key: ParamKey): Column[] {
  const p = getParam(key);
  return [
    { key: "label", label: "Region", hrefKey: "href", primary: true, sortable: false },
    ...summaryColumns(p, true, true),
  ];
}

export function regionRows(file: GroupStatsFile, key: ParamKey): Row[] {
  const sp = (i: number) => file.species[i];
  return STATS_REGIONS.flatMap((region, order) => {
    const t = file.stats[region]?.[key];
    if (!t) return [];
    const [n, mean, sd, min, minSp, median, max, maxSp, r, p] = t;
    const lo = sp(minSp);
    const hi = sp(maxSp);
    return [
      {
        order,
        region,
        label: statsRegionLabel(region),
        kind: REGION_INFO[region].kind,
        href: compareRegionUrl(region),
        n,
        mean,
        sd,
        cv: nn(coefVar({ mean: mean ?? Number.NaN, sd: sd ?? Number.NaN })),
        min,
        minName: lo?.[1] ?? null,
        minHref: lo ? speciesUrl(lo[0]) : null,
        median,
        max,
        maxName: hi?.[1] ?? null,
        maxHref: hi ? speciesUrl(hi[0]) : null,
        r,
        p,
      },
    ];
  });
}

// ---------------------------------------------------------------- child taxa

export type TaxonRank = "class" | "order" | "family" | "genus";

export interface Scope {
  rank: GroupRank | "all";
  /** Taxon name; ignored for "all". */
  name: string;
}

const RANK_POS: Record<TaxonRank, 3 | 4 | 5 | 6> = { class: 3, order: 4, family: 5, genus: 6 };

export function taxaColumns(key: ParamKey, rank: TaxonRank): Column[] {
  const p = getParam(key);
  const label = rank === "class" ? "Class" : rank === "order" ? "Order" : rank === "family" ? "Family" : "Genus";
  return [
    { key: "name", label, hrefKey: "href", subKey: "sub", primary: true, kind: rank === "genus" ? "sci" : "text" },
    ...summaryColumns(p, true, true),
  ];
}

/**
 * One row per taxon of `rank` inside `scope`: summaries of one parameter of one region.
 * Taxa with their own stats page link there; the others link to their taxon page.
 */
export function taxaRows(tax: TaxonomyFile, values: RegionValuesFile, scope: Scope, rank: TaxonRank, key: ParamKey): Row[] {
  const scopePos = scope.rank === "all" ? null : RANK_POS[scope.rank];
  const scopeIdx = scope.rank === "all" ? -1 : tax[scope.rank].names.indexOf(scope.name);
  const pos = RANK_POS[rank];
  const groups = new Map<number, { values: (number | null)[]; life: number[]; species: number[] }>();
  values.species.forEach((si, row) => {
    const s = tax.species[si];
    if (!s) return;
    if (scopePos !== null && s[scopePos] !== scopeIdx) return;
    const ti = s[pos];
    if (ti < 0) return;
    const g = groups.get(ti) ?? { values: [], life: [], species: [] };
    g.values.push(
      paramValue(
        {
          lengthBp: values.length[row]!,
          a: values.a[row]!,
          c: values.c[row]!,
          g: values.g[row]!,
          t: values.t[row]!,
          gcSkew: values.gcSkew[row] ?? null,
          atSkew: values.atSkew[row] ?? null,
        },
        key,
      ),
    );
    g.life.push(s[7]);
    g.species.push(si);
    groups.set(ti, g);
  });
  const pages = new Set(tax.groups);
  const list = tax[rank];
  return [...groups.entries()].map(([ti, g]) => {
    const name = list.names[ti] ?? "";
    const slug = list.slugs[ti] ?? "";
    const s = summarize(g.values);
    const corr = lifespanCorrelation(g.values, g.life);
    const lo = s.minAt >= 0 ? tax.species[g.species[s.minAt]!] : undefined;
    const hi = s.maxAt >= 0 ? tax.species[g.species[s.maxAt]!] : undefined;
    const hasPage = rank !== "genus" && pages.has(`${rank}:${slug}`);
    const first = tax.species[g.species[0] ?? -1];
    return {
      name,
      // Class of the taxon, for the chart's colours.
      cls: rank === "class" ? name : first ? (tax.class.names[first[3]] ?? "") : "",
      sub: rank === "class" ? classLabel(name) : null,
      href: hasPage ? compareGroupUrl(rank as GroupRank, slug) : slug ? taxonUrl(rank as Rank, slug) : null,
      n: s.n,
      mean: nn(s.mean),
      sd: nn(s.sd),
      cv: nn(coefVar(s)),
      min: nn(s.min),
      minName: lo?.[1] ?? null,
      minHref: lo ? speciesUrl(lo[0]) : null,
      median: nn(s.median),
      max: nn(s.max),
      maxName: hi?.[1] ?? null,
      maxHref: hi ? speciesUrl(hi[0]) : null,
      r: nn(corr.r),
      p: nn(corr.p),
    };
  });
}

// ---------------------------------------------------------------- every species of a region

export function speciesColumns(): Column[] {
  return [
    { key: "name", label: "Species", kind: "sci", hrefKey: "href", subKey: "common", primary: true, csvSub: "Common name" },
    { key: "cls", label: "Class", subKey: "taxa" },
    { key: "order", label: "Order", csvOnly: true },
    { key: "family", label: "Family", csvOnly: true },
    { key: "length", label: "Length (bp)", format: "int" },
    { key: "comp", label: "Composition", kind: "composition" },
    { key: "a", label: "A", format: "int", title: "Adenine (bases)", hideOnMobile: true },
    { key: "t", label: "T", format: "int", title: "Thymine (bases)", hideOnMobile: true },
    { key: "g", label: "G", format: "int", title: "Guanine (bases)", hideOnMobile: true },
    { key: "c", label: "C", format: "int", title: "Cytosine (bases)", hideOnMobile: true },
    { key: "gc", label: "GC %", format: "pct2" },
    { key: "gcSkew", label: "GC skew", format: "signed3", title: "(G − C) / (G + C) on the L strand" },
    { key: "atSkew", label: "AT skew", format: "signed3", title: "(A − T) / (A + T) on the L strand" },
    { key: "lifespan", label: "Max lifespan", format: "lifespan", title: "Maximum recorded lifespan (AnAge)" },
  ];
}

export function speciesRows(tax: TaxonomyFile, values: RegionValuesFile): Row[] {
  return values.species.flatMap((si, row) => {
    const s = tax.species[si];
    if (!s) return [];
    const a = values.a[row]!;
    const c = values.c[row]!;
    const g = values.g[row]!;
    const t = values.t[row]!;
    const cls = tax.class.names[s[3]] ?? "";
    return [
      {
        name: s[1],
        common: s[2],
        href: speciesUrl(s[0]),
        cls: classLabel(cls),
        className: cls,
        order: tax.order.names[s[4]] ?? "",
        family: tax.family.names[s[5]] ?? "",
        taxa: [tax.order.names[s[4]], tax.family.names[s[5]]].filter(Boolean).join(" · "),
        length: values.length[row]!,
        comp: [a, c, g, t],
        a,
        t,
        g,
        c,
        gc: paramValue({ lengthBp: 0, a, c, g, t, gcSkew: null, atSkew: null }, "gc"),
        gcSkew: values.gcSkew[row] ?? null,
        atSkew: values.atSkew[row] ?? null,
        lifespan: s[7],
      },
    ];
  });
}

// ---------------------------------------------------------------- codon usage

export type CodonMode = "codon" | "aa";

export function codonColumns(mode: CodonMode): Column[] {
  const v: ColumnFormat = "dec2";
  return [
    mode === "codon"
      ? { key: "label", label: "Codon", subKey: "sub", primary: true }
      : { key: "label", label: "Amino acid", subKey: "sub", primary: true },
    ...(mode === "codon" ? [{ key: "aa", label: "Amino acid" } satisfies Column] : []),
    { key: "n", label: "Species", format: "int" },
    { key: "mean", label: mode === "codon" ? "Mean (% of codons)" : "Mean (% of sense codons)", format: v },
    { key: "sd", label: "SD", format: v },
    { key: "min", label: "Min", format: v },
    { key: "median", label: "Median", format: v },
    { key: "max", label: "Max", format: v },
  ];
}

export function codonRows(file: GroupCodonsFile, region: Region, mode: CodonMode): Row[] {
  const ri = file.regions.indexOf(region);
  if (ri < 0) return [];
  const subs = mode === "codon" ? file.codons : file.aminoAcids;
  const tuples = (mode === "codon" ? file.codon : file.aa)[ri] ?? [];
  return subs.flatMap((sub, i) => {
    const t = tuples[i];
    if (!t || t[0] === 0) return [];
    const [n, mean, sd, min, median, max] = t;
    const aa = mode === "codon" ? codonAminoAcid(sub) : (AMINO_ACIDS[sub]?.three ?? sub);
    return [
      {
        label: mode === "codon" ? sub : aa,
        sub: mode === "codon" ? sub.replace(/U/g, "T") : (AMINO_ACIDS[sub]?.name ?? ""),
        aa,
        n,
        mean,
        sd,
        min,
        median,
        max,
      },
    ];
  });
}

// ---------------------------------------------------------------- every parameter of one region

/** Columns of the one-region summary: one row per parameter, so formats come from each row. */
export function paramSummaryColumns(): Column[] {
  const extreme = (key: "min" | "max", label: string): Column => ({
    key,
    label,
    formatKey: "fmt",
    subKey: `${key}Name`,
    subHrefKey: `${key}Href`,
    subSci: true,
    csvSub: `${label} species`,
    sortable: false,
  });
  return [
    { key: "label", label: "Parameter", subKey: "formula", primary: true, sortable: false },
    { key: "n", label: "Species", format: "int", sortable: false },
    { key: "mean", label: "Mean", formatKey: "fmt", sortable: false },
    { key: "sd", label: "SD", formatKey: "sdFmt", sortable: false, title: "Standard deviation (n − 1)" },
    { key: "cv", label: "CV", format: "dec3", sortable: false, title: "Coefficient of variation: SD / mean", hideOnMobile: true },
    extreme("min", "Min"),
    { key: "median", label: "Median", formatKey: "fmt", sortable: false },
    extreme("max", "Max"),
    { key: "r", label: "r", format: "r", sortable: false, title: "Pearson r with log10 maximum lifespan" },
    { key: "p", label: "p", format: "p", sortable: false, title: "Two-tailed p-value of r, not corrected for multiple testing" },
  ];
}

export function paramSummaryRows(file: GroupStatsFile, region: Region): Row[] {
  const per = file.stats[region];
  if (!per) return [];
  return PARAMS.flatMap((p) => {
    const t = per[p.key];
    if (!t) return [];
    const [n, mean, sd, min, minSp, median, max, maxSp, r, pv] = t;
    const lo = file.species[minSp];
    const hi = file.species[maxSp];
    return [
      {
        label: p.unit === "bp" ? "Length (bp)" : p.label,
        formula: p.title,
        fmt: valueFormat(p),
        sdFmt: sdFormat(p),
        n,
        mean,
        sd,
        cv: p.cv ? nn(coefVar({ mean: mean ?? Number.NaN, sd: sd ?? Number.NaN })) : null,
        min,
        minName: lo?.[1] ?? null,
        minHref: lo ? speciesUrl(lo[0]) : null,
        median,
        max,
        maxName: hi?.[1] ?? null,
        maxHref: hi ? speciesUrl(hi[0]) : null,
        r,
        p: pv,
      },
    ];
  });
}

// ---------------------------------------------------------------- compact island props

/**
 * Rows as one key list plus value arrays, with floats cut to 6 significant digits: much smaller
 * than row objects once Astro serialises island props into the page.
 */
export interface PackedRows {
  keys: string[];
  rows: Row[keyof Row][][];
}

const trim = (v: Row[keyof Row]): Row[keyof Row] =>
  typeof v === "number" && !Number.isInteger(v) ? Number(v.toPrecision(6)) : v;

export function packRows(rows: Row[]): PackedRows {
  const keys = [...new Set(rows.flatMap((r) => Object.keys(r)))];
  return { keys, rows: rows.map((r) => keys.map((k) => trim(r[k] ?? null))) };
}

export const unpackRows = (p: PackedRows): Row[] =>
  p.rows.map((r) => Object.fromEntries(p.keys.map((k, i) => [k, r[i] ?? null])) as Row);
