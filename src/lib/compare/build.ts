/**
 * Build-time data for the comparative tables: the groups that get stats pages, their summaries,
 * codon usage summaries and the per-region value files. Reads the data API: do not import from
 * islands (use ./wire, ./rows and ./params there).
 */
import { getAllSpecies, getFeatureDefs, getFeatureValues, getRegionStatsForRegion, getTaxa } from "~/data";
import type { Rank, Region, Species, TaxonNode } from "~/data/schema";
import {
  CODON_REGIONS,
  GROUP_RANKS,
  type GroupRank,
  groupKey,
  MIN_GROUP_SPECIES,
  PARAMS,
  paramValue,
  STATS_REGIONS,
} from "./params";
import { lifespanCorrelation, roundOrNull, roundP, summarize } from "./summary";
import type { FreqTuple, GroupCodonsFile, GroupStatsFile, RegionValuesFile, StatTuple, TaxonomyFile } from "./wire";

const memo = <T>(fn: () => T): (() => T) => {
  let v: { value: T } | null = null;
  return () => (v ??= { value: fn() }).value;
};

// ---------------------------------------------------------------- species index

/** Species in a fixed order; their position is the index used in every compare data file. */
const speciesList = memo(() => getAllSpecies());
const speciesIndex = memo(() => new Map(speciesList().map((s, i) => [s.id, i])));

// ---------------------------------------------------------------- groups

export interface StatsGroup {
  key: string;
  rank: GroupRank | "all";
  /** Taxon slug; "" for all species. */
  slug: string;
  name: string;
  /** Indices into the species list. */
  members: number[];
  node: TaxonNode | null;
}

export const statsGroups = memo((): StatsGroup[] => {
  const species = speciesList();
  const out: StatsGroup[] = [
    { key: "all", rank: "all", slug: "", name: "All species", members: species.map((_, i) => i), node: null },
  ];
  for (const rank of GROUP_RANKS) {
    const byName = new Map<string, number[]>();
    species.forEach((s, i) => {
      const name = s.taxonomy[rank];
      if (name) (byName.get(name) ?? byName.set(name, []).get(name)!).push(i);
    });
    const taxa = getTaxa()
      .filter((t) => t.rank === rank)
      .sort((a, b) => a.name.localeCompare(b.name));
    for (const t of taxa) {
      const members = byName.get(t.name) ?? [];
      if (members.length < MIN_GROUP_SPECIES) continue;
      out.push({ key: groupKey(rank, t.slug), rank, slug: t.slug, name: t.name, members, node: t });
    }
  }
  return out;
});

const groupByKey = memo(() => new Map(statsGroups().map((g) => [g.key, g])));
export const getStatsGroup = (key: string): StatsGroup | undefined => groupByKey().get(key);

/** "rank:name" -> group, for links from taxon names. */
const groupByTaxon = memo(() => new Map(statsGroups().map((g) => [`${g.rank}:${g.name}`, g])));
export const statsGroupForTaxon = (rank: Rank, name: string): StatsGroup | undefined =>
  groupByTaxon().get(`${rank}:${name}`);

// ---------------------------------------------------------------- per-region values

interface RegionColumns {
  length: Float64Array;
  a: Float64Array;
  c: Float64Array;
  g: Float64Array;
  t: Float64Array;
  gcSkew: Float64Array;
  atSkew: Float64Array;
  has: Uint8Array;
}

const regionColumns = new Map<Region, RegionColumns>();
function columnsFor(region: Region): RegionColumns {
  const hit = regionColumns.get(region);
  if (hit) return hit;
  const n = speciesList().length;
  const cols: RegionColumns = {
    length: new Float64Array(n).fill(Number.NaN),
    a: new Float64Array(n).fill(Number.NaN),
    c: new Float64Array(n).fill(Number.NaN),
    g: new Float64Array(n).fill(Number.NaN),
    t: new Float64Array(n).fill(Number.NaN),
    gcSkew: new Float64Array(n).fill(Number.NaN),
    atSkew: new Float64Array(n).fill(Number.NaN),
    has: new Uint8Array(n),
  };
  const ix = speciesIndex();
  for (const r of getRegionStatsForRegion(region)) {
    const i = ix.get(r.speciesId);
    if (i === undefined || r.lengthBp <= 0 || r.a + r.c + r.g + r.t <= 0) continue;
    cols.length[i] = r.lengthBp;
    cols.a[i] = r.a;
    cols.c[i] = r.c;
    cols.g[i] = r.g;
    cols.t[i] = r.t;
    cols.gcSkew[i] = r.gcSkew ?? Number.NaN;
    cols.atSkew[i] = r.atSkew ?? Number.NaN;
    cols.has[i] = 1;
  }
  regionColumns.set(region, cols);
  return cols;
}

const nanToNull = (v: number): number | null => (Number.isFinite(v) ? v : null);

/** Every species' counts for one region (species without the region are left out). */
export function regionValues(region: Region): RegionValuesFile {
  const cols = columnsFor(region);
  const out: RegionValuesFile = { region, species: [], length: [], a: [], c: [], g: [], t: [], gcSkew: [], atSkew: [] };
  for (let i = 0; i < cols.has.length; i++) {
    if (!cols.has[i]) continue;
    out.species.push(i);
    out.length.push(cols.length[i]!);
    out.a.push(cols.a[i]!);
    out.c.push(cols.c[i]!);
    out.g.push(cols.g[i]!);
    out.t.push(cols.t[i]!);
    out.gcSkew.push(roundOrNull(cols.gcSkew[i]!, 5));
    out.atSkew.push(roundOrNull(cols.atSkew[i]!, 5));
  }
  return out;
}

// ---------------------------------------------------------------- taxonomy file

export const taxonomyFile = memo((): TaxonomyFile => {
  const species = speciesList();
  const slugOf = new Map<string, string>();
  for (const t of getTaxa()) slugOf.set(`${t.rank}:${t.name}`, t.slug);
  const lists = {} as Record<"class" | "order" | "family" | "genus", { names: string[]; slugs: string[]; index: Map<string, number> }>;
  for (const rank of ["class", "order", "family", "genus"] as const) {
    const names = [...new Set(species.map((s) => s.taxonomy[rank]).filter(Boolean))].sort((a, b) => a.localeCompare(b));
    lists[rank] = { names, slugs: names.map((n) => slugOf.get(`${rank}:${n}`) ?? ""), index: new Map(names.map((n, i) => [n, i])) };
  }
  const idx = (rank: keyof typeof lists, s: Species) => lists[rank].index.get(s.taxonomy[rank]) ?? -1;
  const pick = (rank: keyof typeof lists) => ({ names: lists[rank].names, slugs: lists[rank].slugs });
  return {
    class: pick("class"),
    order: pick("order"),
    family: pick("family"),
    genus: pick("genus"),
    species: species.map((s) => [
      s.slug,
      s.scientificName,
      s.commonName.trim(),
      idx("class", s),
      idx("order", s),
      idx("family", s),
      idx("genus", s),
      s.maxLongevityYears,
    ]),
    groups: statsGroups()
      .filter((g) => g.rank !== "all")
      .map((g) => `${g.rank}:${g.slug}`),
  };
});

// ---------------------------------------------------------------- group summaries

const DIGITS: Record<string, number> = { length: 1, gcSkew: 5, atSkew: 5 };

const statsCache = new Map<string, GroupStatsFile>();
export function groupStats(group: StatsGroup): GroupStatsFile {
  const hit = statsCache.get(group.key);
  if (hit) return hit;
  const species = speciesList();
  const lifespans = group.members.map((i) => species[i]!.maxLongevityYears);
  const named: number[] = [];
  const local = new Map<number, number>();
  const ref = (memberPos: number): number => {
    if (memberPos < 0) return -1;
    const i = group.members[memberPos]!;
    let l = local.get(i);
    if (l === undefined) {
      l = named.length;
      named.push(i);
      local.set(i, l);
    }
    return l;
  };
  const stats: GroupStatsFile["stats"] = {};
  for (const region of STATS_REGIONS) {
    const cols = columnsFor(region);
    const perParam: Partial<Record<(typeof PARAMS)[number]["key"], StatTuple>> = {};
    let any = false;
    for (const p of PARAMS) {
      const values = group.members.map((i) =>
        cols.has[i]
          ? paramValue(
              {
                lengthBp: cols.length[i]!,
                a: cols.a[i]!,
                c: cols.c[i]!,
                g: cols.g[i]!,
                t: cols.t[i]!,
                gcSkew: nanToNull(cols.gcSkew[i]!),
                atSkew: nanToNull(cols.atSkew[i]!),
              },
              p.key,
            )
          : null,
      );
      const s = summarize(values);
      if (s.n === 0) continue;
      any = true;
      const d = DIGITS[p.key] ?? 4;
      const corr = lifespanCorrelation(values, lifespans);
      perParam[p.key] = [
        s.n,
        roundOrNull(s.mean, d),
        roundOrNull(s.sd, d),
        roundOrNull(s.min, d),
        ref(s.minAt),
        roundOrNull(s.median, d),
        roundOrNull(s.max, d),
        ref(s.maxAt),
        roundOrNull(corr.r, 4),
        roundP(corr.p),
      ];
    }
    if (any) stats[region] = perParam;
  }
  const file: GroupStatsFile = {
    key: group.key,
    name: group.name,
    rank: group.rank,
    speciesCount: group.members.length,
    species: named.map((i) => {
      const s = species[i]!;
      return [s.slug, s.scientificName, s.commonName.trim()];
    }),
    stats,
  };
  statsCache.set(group.key, file);
  return file;
}

// ---------------------------------------------------------------- codon usage

interface CodonCatalog {
  codons: string[];
  aminoAcids: string[];
  /** values[kind][regionIndex][subIndex] = per-species array aligned with the species list */
  codon: Float64Array[][];
  aa: Float64Array[][];
}

const codonCatalog = memo((): CodonCatalog => {
  const defs = getFeatureDefs();
  const subs = (prefix: string) =>
    defs
      .filter((d) => d.key.startsWith(`${prefix}:total_pc:`))
      .map((d) => d.key.slice(`${prefix}:total_pc:`.length));
  const codons = subs("codon");
  const aminoAcids = subs("aa");
  const species = speciesList();
  const column = (key: string): Float64Array => {
    const byId = getFeatureValues(key);
    const out = new Float64Array(species.length).fill(Number.NaN);
    species.forEach((s, i) => {
      const v = byId[s.id];
      if (v !== null && v !== undefined && Number.isFinite(v)) out[i] = v;
    });
    return out;
  };
  return {
    codons,
    aminoAcids,
    codon: CODON_REGIONS.map((r) => codons.map((c) => column(`codon:${r}:${c}`))),
    aa: CODON_REGIONS.map((r) => aminoAcids.map((a) => column(`aa:${r}:${a}`))),
  };
});

const freq = (col: Float64Array, members: number[]): FreqTuple => {
  const s = summarize(members.map((i) => col[i]!));
  return [s.n, roundOrNull(s.mean, 4), roundOrNull(s.sd, 4), roundOrNull(s.min, 4), roundOrNull(s.median, 4), roundOrNull(s.max, 4)];
};

export function groupCodons(group: StatsGroup): GroupCodonsFile {
  const cat = codonCatalog();
  return {
    key: group.key,
    regions: [...CODON_REGIONS],
    codons: cat.codons,
    aminoAcids: cat.aminoAcids,
    codon: cat.codon.map((perCodon) => perCodon.map((col) => freq(col, group.members))),
    aa: cat.aa.map((perAa) => perAa.map((col) => freq(col, group.members))),
  };
}
