/**
 * Build-time data for the gene pages: summaries across species, GC% by class, scatter points,
 * correlations and codon usage. Reads the data API: do not import from islands.
 */
import {
  getAllSpecies,
  getCodonUsage,
  getCorrelations,
  getFeatureValues,
  getGenomeFeatures,
  getRegionStatsForRegion,
  PROTEIN_GENES,
} from "~/data";
import type { Correlation, ProteinGene, Region, Species } from "~/data/schema";
import { CLASS_GROUPS, classGroup, COLOURED_CLASSES } from "~/lib/classes";
import { AA_ORDER, AMINO_ACIDS, CODONS, VERTEBRATE_MITO } from "~/lib/geneticCode";
import type { ScatterPoint } from "~/lib/scatterTypes";
import { speciesUrl } from "~/lib/urls";
import { summarize, type Summary } from "./stats";

const isProtein = (r: Region): r is ProteinGene => (PROTEIN_GENES as readonly string[]).includes(r);
export { isProtein };

// ---------------------------------------------------------------- summary across species

export interface GeneSummary {
  region: Region;
  /** Species with composition data for the region. */
  n: number;
  length: Summary;
  gc: Summary;
  /** Species whose record annotates the region, by strand of its first copy. */
  strand: { plus: number; minus: number };
  /** Species with more than one annotated copy. */
  multiCopy: number;
}

const summaryCache = new Map<Region, GeneSummary>();

export const geneSummary = (region: Region): GeneSummary => {
  const hit = summaryCache.get(region);
  if (hit) return hit;
  const stats = getRegionStatsForRegion(region).filter((r) => r.lengthBp > 0);
  let plus = 0;
  let minus = 0;
  let multiCopy = 0;
  for (const s of getAllSpecies()) {
    const mine = getGenomeFeatures(s.id).filter((f) => f.name === region);
    const first = mine[0];
    if (!first) continue;
    if (first.strand === 1) plus++;
    else minus++;
    if (mine.length > 1) multiCopy++;
  }
  const out: GeneSummary = {
    region,
    n: stats.length,
    length: summarize(stats.map((r) => r.lengthBp)),
    gc: summarize(stats.map((r) => r.gcPercent)),
    strand: { plus, minus },
    multiCopy,
  };
  summaryCache.set(region, out);
  return out;
};

// ---------------------------------------------------------------- GC% by class

export interface ClassRow extends Summary {
  key: string;
  label: string;
  color: string;
  /** Values in species order (rounded to 0.01). */
  values: number[];
}

/** Per-species values of a feature, grouped like the scatter plots (six classes + "Other"). */
export const valuesByClass = (featureKey: string): ClassRow[] => {
  const vals = getFeatureValues(featureKey);
  const by = new Map<string, number[]>();
  for (const s of getAllSpecies()) {
    const v = vals[s.id];
    if (v === null || v === undefined || !Number.isFinite(v)) continue;
    const g = classGroup(s.taxonomy.class);
    (by.get(g) ?? by.set(g, []).get(g)!).push(Math.round(v * 100) / 100);
  }
  return CLASS_GROUPS.filter((g) => (by.get(g.key)?.length ?? 0) > 0).map((g) => {
    const values = by.get(g.key)!;
    return { key: g.key, label: g.label, color: g.color, values, ...summarize(values) };
  });
};

// ---------------------------------------------------------------- scatter

const shortName = (s: Species): string => {
  const c = s.commonName.trim();
  if (!c) return s.scientificName;
  return c.length > 18 ? c.split(/\s+/).slice(-2).join(" ") || c : c;
};

/** A feature of this gene (y) against maximum lifespan (x), one point per species. */
export const featureLifespanPoints = (featureKey: string): ScatterPoint[] => {
  const vals = getFeatureValues(featureKey);
  return getAllSpecies().flatMap((s) => {
    const v = vals[s.id];
    if (v === null || v === undefined || !Number.isFinite(v) || !(s.maxLongevityYears > 0)) return [];
    const p: ScatterPoint = {
      id: s.slug,
      x: s.maxLongevityYears,
      y: Math.round(v * 100) / 100,
      group: classGroup(s.taxonomy.class),
      label: s.scientificName,
      short: shortName(s),
      href: speciesUrl(s.slug),
    };
    if (s.commonName) p.sub = s.commonName;
    return [p];
  });
};

// ---------------------------------------------------------------- correlations

export const MEASURES = [
  { prefix: "gc", label: "GC%", long: "GC content" },
  { prefix: "size", label: "Length", long: "Length" },
  { prefix: "gcSkew", label: "GC skew", long: "GC skew" },
  { prefix: "atSkew", label: "AT skew", long: "AT skew" },
] as const;

export interface MeasureCorrelations {
  prefix: (typeof MEASURES)[number]["prefix"];
  label: string;
  long: string;
  featureKey: string;
  rows: Correlation[];
}

const scopeRank = (scope: string): number => (scope === "all" ? 0 : scope.startsWith("class:") ? 1 : 2);

export const geneCorrelations = (region: Region): MeasureCorrelations[] =>
  MEASURES.map((m) => {
    const featureKey = `${m.prefix}:${region}`;
    const rows = getCorrelations({ featureKey, trait: "maxLongevityYears" }).sort(
      (a, b) => scopeRank(a.scope) - scopeRank(b.scope) || b.n - a.n,
    );
    return { prefix: m.prefix, label: m.label, long: m.long, featureKey, rows };
  }).filter((m) => m.rows.length > 0);

// ---------------------------------------------------------------- codon usage

export interface CodonColumn {
  key: string;
  label: string;
  /** Species pooled into the column. */
  n: number;
}

export interface CodonCell {
  codon: string;
  /** Relative synonymous codon usage of the preferred codon. */
  rscu: number;
  /** Number of synonymous codons for the amino acid. */
  synonyms: number;
}

export interface CodonAaRow {
  aa: string;
  three: string;
  name: string;
  codons: string[];
  cells: (CodonCell | null)[];
}

export interface CodonSummary {
  columns: CodonColumn[];
  rows: CodonAaRow[];
  /** Most used sense codons over all vertebrates: share of all sense codons, in %. */
  top: { codon: string; aa: string; pct: number }[];
  totalCodons: number;
}

const codonCount = (counts: Record<string, number>, c: string): number =>
  counts[c] ?? counts[c.replace(/U/g, "T")] ?? 0;

/**
 * Codon usage of one protein-coding gene, pooled over vertebrate species (phylum Chordata,
 * all on the vertebrate mitochondrial code, NCBI table 2): RSCU of the preferred codon for each
 * amino acid, overall and per class.
 */
export const codonSummary = (gene: ProteinGene): CodonSummary => {
  const ALL = "all";
  const cols: { key: string; label: string }[] = [
    { key: ALL, label: "All vertebrates" },
    ...COLOURED_CLASSES.map((c) => ({ key: c as string, label: CLASS_GROUPS.find((g) => g.key === c)?.label ?? c })),
  ];
  const sums = new Map<string, number[]>(cols.map((c) => [c.key, CODONS.map(() => 0)]));
  const ns = new Map<string, number>(cols.map((c) => [c.key, 0]));
  for (const s of getAllSpecies()) {
    if (s.taxonomy.phylum !== "Chordata") continue;
    const u = getCodonUsage(s.id).find((x) => x.region === gene);
    if (!u) continue;
    const keys = [ALL];
    if ((COLOURED_CLASSES as readonly string[]).includes(s.taxonomy.class)) keys.push(s.taxonomy.class);
    for (const k of keys) {
      const arr = sums.get(k)!;
      CODONS.forEach((c, j) => (arr[j]! += codonCount(u.counts, c)));
      ns.set(k, (ns.get(k) ?? 0) + 1);
    }
  }
  const columns = cols.filter((c) => (ns.get(c.key) ?? 0) > 0).map((c) => ({ ...c, n: ns.get(c.key) ?? 0 }));
  const idx = new Map(CODONS.map((c, j) => [c, j] as const));
  const rows: CodonAaRow[] = AA_ORDER.filter((aa) => aa !== "*").map((aa) => {
    const codons = CODONS.filter((c) => VERTEBRATE_MITO.table[c] === aa);
    const cells = columns.map((col) => {
      const arr = sums.get(col.key)!;
      const counts = codons.map((c) => arr[idx.get(c)!]!);
      const total = counts.reduce((a, b) => a + b, 0);
      if (total <= 0) return null;
      let best = 0;
      counts.forEach((v, k) => (v > counts[best]! ? (best = k) : 0));
      return { codon: codons[best]!, rscu: (counts[best]! * codons.length) / total, synonyms: codons.length };
    });
    const info = AMINO_ACIDS[aa];
    return { aa, three: info?.three ?? aa, name: info?.name ?? aa, codons, cells };
  });
  const all = sums.get(ALL)!;
  const sense = CODONS.map((c, j) => ({ c, j })).filter(({ c }) => VERTEBRATE_MITO.table[c] !== "*");
  const totalCodons = sense.reduce((a, { j }) => a + all[j]!, 0);
  const top = sense
    .map(({ c, j }) => ({ codon: c, aa: VERTEBRATE_MITO.table[c] ?? "?", pct: totalCodons ? (all[j]! / totalCodons) * 100 : 0 }))
    .sort((a, b) => b.pct - a.pct)
    .slice(0, 8);
  return { columns, rows, top, totalCodons };
};
