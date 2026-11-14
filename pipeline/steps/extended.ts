/**
 * Extended mtDNA features: base composition at fourfold-degenerate sites (gene sense, and in
 * heavy-strand notation where the record has the canonical vertebrate orientation), protein
 * hydropathy (GRAVY) of the mtDNA-encoded proteins, the major arc between the light-strand origin
 * region and the control region, perfect direct and inverted repeats, and control-region copies.
 *
 * Published as separate downloads (mtdna_structure.parquet, protein_gene_features.parquet,
 * correlations_extended.parquet) so the site's feature catalogue and correlations.parquet are
 * unchanged.
 */
import { type CodonUsage, type FeatureDef, PROTEIN_GENES, type ProteinGene } from "../../src/data/schema";
import { geneticCode } from "../lib/genetic-code";
import { HOMOPOLYMER_MIN, STR_MIN_UNITS, TRACT_MIN, countMotifs, type MotifCounts } from "../lib/motifs";
import { findRepeats, type RepeatPair, summarisePairs } from "../lib/repeats";
import { round } from "../lib/stats";
import type { SpeciesGenome } from "./genome";

/** Minimum length of a perfect repeat counted in the repeat features. */
export const REPEAT_MIN_LENGTH = 10;

/** Kyte & Doolittle (1982) hydropathy index. */
export const KYTE_DOOLITTLE: Record<string, number> = {
  A: 1.8, R: -4.5, N: -3.5, D: -3.5, C: 2.5, Q: -3.5, E: -3.5, G: -0.4, H: -3.2, I: 4.5,
  L: 3.8, K: -3.9, M: 1.9, F: 2.8, P: -1.6, S: -0.8, T: -0.7, W: -0.9, Y: -1.3, V: 4.2,
};

const RNA = "UCAG";

/** First two codon positions (RNA) of every fourfold-degenerate family in a genetic code. */
export function fourfoldPrefixes(table: number): string[] {
  const code = geneticCode(table);
  const out: string[] = [];
  for (const a of RNA) {
    for (const b of RNA) {
      const aas = new Set([...RNA].map((c) => code[a + b + c]));
      if (aas.size === 1 && !aas.has("*")) out.push(a + b);
    }
  }
  return out;
}

/** Third-position bases at fourfold-degenerate sites, gene sense (RNA alphabet). */
export interface FourfoldTally {
  a: number;
  c: number;
  g: number;
  u: number;
}

export function fourfoldCounts(counts: Record<string, number>, table: number): FourfoldTally {
  const t: FourfoldTally = { a: 0, c: 0, g: 0, u: 0 };
  for (const p of fourfoldPrefixes(table)) {
    t.a += counts[`${p}A`] ?? 0;
    t.c += counts[`${p}C`] ?? 0;
    t.g += counts[`${p}G`] ?? 0;
    t.u += counts[`${p}U`] ?? 0;
  }
  return t;
}

/** Heavy-strand bases at fourfold sites of a gene on the given RefSeq strand. */
export interface HeavyTally {
  a: number;
  c: number;
  g: number;
  t: number;
}

/**
 * In the canonical vertebrate orientation the RefSeq (+) strand is the light strand, so a gene on
 * the + strand reads the light strand in its sense and the heavy-strand base is the complement;
 * a gene on the - strand (ND6) reads the heavy strand itself.
 */
export function toHeavyStrand(t: FourfoldTally, strand: 1 | -1): HeavyTally {
  return strand === 1 ? { a: t.u, c: t.g, g: t.c, t: t.a } : { a: t.a, c: t.c, g: t.g, t: t.u };
}

/** Grand average of hydropathy over amino-acid counts (stops excluded); null when there are none. */
export function gravy(aminoAcids: Record<string, number>): number | null {
  let sum = 0;
  let n = 0;
  for (const [aa, v] of Object.entries(KYTE_DOOLITTLE)) {
    const c = aminoAcids[aa] ?? 0;
    sum += c * v;
    n += c;
  }
  return n === 0 ? null : sum / n;
}

/**
 * canonical: a chordate record with all 13 protein genes, every ND6 copy on the - strand and every
 * other protein gene on the + strand (the RefSeq + strand is then the light strand).
 * noncanonical: a chordate record without that pattern. not_chordate: heavy/light strand notation is
 * not defined here. unknown: no RefSeq record was available.
 */
export type Orientation = "canonical" | "noncanonical" | "not_chordate" | "unknown";

export function orientationOf(g: SpeciesGenome | undefined, phylum: string): Orientation {
  if (!g) return "unknown";
  if (phylum !== "Chordata") return "not_chordate";
  const cds = g.features.filter((f) => f.type === "CDS");
  const names = new Set(cds.map((f) => f.name));
  if (!PROTEIN_GENES.every((p) => names.has(p))) return "noncanonical";
  const ok = cds.every((f) => (f.name === "ND6" ? f.strand === -1 : f.strand === 1));
  return ok ? "canonical" : "noncanonical";
}

/** RefSeq strand of a protein gene, null when absent or when copies disagree. */
function geneStrand(g: SpeciesGenome | undefined, gene: ProteinGene): 1 | -1 | null {
  if (!g) return null;
  const strands = new Set(g.features.filter((f) => f.type === "CDS" && f.name === gene).map((f) => f.strand));
  return strands.size === 1 ? [...strands][0]! : null;
}

export interface MajorArc {
  /** 1-based inclusive, on the RefSeq strand; start > end when the arc spans the origin. */
  start: number;
  end: number;
  length: number;
}

/**
 * The major arc between the two replication origins, delimited by annotation: from the base after
 * tRNA-Asn (the light-strand origin lies between tRNA-Asn and tRNA-Cys) forward to the base before
 * the first control region downstream of CYTB; the control region itself is excluded. Positions are
 * compared along the circle, so records numbered from any origin qualify. Defined only for the
 * canonical orientation, single copies of tRNA-Asn, COX1 and CYTB that do not span the origin, and
 * the circular order tRNA-Asn, COX1, CYTB, control region. Null otherwise, including when no control
 * region is annotated.
 */
export function majorArc(g: SpeciesGenome | undefined, orientation: Orientation): MajorArc | null {
  if (!g || orientation !== "canonical") return null;
  const len = g.record.sequence.length;
  const one = (name: string) => {
    const fs = g.features.filter((f) => f.name === name);
    return fs.length === 1 && fs[0]!.start <= fs[0]!.end ? fs[0]! : null;
  };
  const asn = one("tRNA-Asn");
  const cox1 = one("COX1");
  const cytb = one("CYTB");
  if (!asn || !cox1 || !cytb) return null;
  // Forward distance along the circle from the last base of tRNA-Asn.
  const from = (pos: number) => (((pos - asn.end) % len) + len) % len;
  if (!(from(cox1.start) > 0 && from(cox1.start) < from(cytb.end))) return null;
  const cr = g.features
    .filter((f) => f.type === "D-loop" && from(f.start) > from(cytb.end))
    .sort((a, b) => from(a.start) - from(b.start))[0];
  if (!cr) return null;
  const length = from(cr.start) - 1;
  if (length <= 0) return null;
  const start = (asn.end % len) + 1;
  const end = cr.start === 1 ? len : cr.start - 1;
  return { start, end, length };
}

export interface ContactZones {
  /** 1-based inclusive, on the RefSeq strand; neither span wraps the origin. */
  zone1: { start: number; end: number };
  zone2: { start: number; end: number };
}

/**
 * The two spans that flank most mitochondrial deletions in human: the 5' region from ATP8 to COX3
 * and the 3' region from ND5 to CYTB. Human studies give these as roughly 6-9 kb and 13-16 kb
 * (Persson et al. 2023, BMC Biol), but kilobase coordinates do not transfer between species, so the
 * zones are anchored on the genes themselves and are defined only when all four are annotated once,
 * do not span the origin, and appear in that order along the record.
 */
export function contactZones(g: SpeciesGenome | undefined): ContactZones | null {
  if (!g) return null;
  const one = (name: string) => {
    const fs = g.features.filter((f) => f.name === name && f.start <= f.end);
    return fs.length === 1 ? fs[0]! : null;
  };
  const atp8 = one("ATP8");
  const cox3 = one("COX3");
  const nd5 = one("ND5");
  const cytb = one("CYTB");
  if (!atp8 || !cox3 || !nd5 || !cytb) return null;
  if (!(atp8.start <= cox3.end && cox3.end < nd5.start && nd5.start <= cytb.end)) return null;
  return { zone1: { start: atp8.start, end: cox3.end }, zone2: { start: nd5.start, end: cytb.end } };
}

/**
 * Repeat pairs with one arm in each contact zone. The arms are the 0-based starts the repeat finder
 * reports; a pair counts once, whichever arm falls in which zone.
 */
export function bridgingPairs(pairs: RepeatPair[], zones: ContactZones): number {
  const inZone = (pos0: number, z: { start: number; end: number }) => pos0 + 1 >= z.start && pos0 + 1 <= z.end;
  let n = 0;
  for (const p of pairs) {
    const a1 = inZone(p.first, zones.zone1);
    const a2 = inZone(p.first, zones.zone2);
    const b1 = inZone(p.second, zones.zone1);
    const b2 = inZone(p.second, zones.zone2);
    if ((a1 && b2) || (a2 && b1)) n++;
  }
  return n;
}

/** Sequence of a region given 1-based inclusive coordinates; start > end wraps the origin. */
export function regionSequence(seq: string, start: number, end: number): string {
  return start <= end ? seq.slice(start - 1, end) : seq.slice(start - 1) + seq.slice(0, end);
}

export const GENE_ROW_REGIONS = [...PROTEIN_GENES, "total_pc", "major12"] as const;
export type GeneRowRegion = (typeof GENE_ROW_REGIONS)[number];

export interface GeneFeatureRow {
  speciesId: number;
  /** A protein gene, "total_pc" (all 13), or "major12" (the 12 genes on the + strand, canonical only). */
  region: GeneRowRegion;
  translTable: number;
  /** RefSeq strand of a single gene; null for the aggregates or when copies disagree. */
  strand: 1 | -1 | null;
  fourfold: FourfoldTally;
  /** Heavy-strand notation; null unless the orientation is canonical (and never for total_pc). */
  heavy: HeavyTally | null;
  gravy: number | null;
}

export interface StructureRow {
  speciesId: number;
  orientation: Orientation;
  majorArc: MajorArc | null;
  /** Number of annotated control regions (D-loop, or misc_feature control region when no D-loop). */
  controlRegions: number | null;
  total: { direct: number; inverted: number; mirror: number; longestDirect: number | null } | null;
  major: { direct: number; inverted: number; mirror: number; longestDirect: number | null } | null;
  /** Non-B DNA motifs and simple repeats of the whole record; null when no record was available. */
  motifsTotal: MotifCounts | null;
  /** The same over the major arc; null when the arc is undefined. */
  motifsMajorArc: MotifCounts | null;
  contactZones: ContactZones | null;
  /** Repeat pairs bridging the two contact zones; null when the zones are undefined. */
  bridging: { direct: number; inverted: number; mirror: number } | null;
}

type Usage = CodonUsage & { translTable: number };

const sumCounts = (rows: Usage[], pick: (u: Usage) => Record<string, number>): Record<string, number> => {
  const out: Record<string, number> = {};
  for (const u of rows) for (const [k, v] of Object.entries(pick(u))) out[k] = (out[k] ?? 0) + v;
  return out;
};

export function buildExtended(
  species: { id: number; phylum: string }[],
  genomes: Map<number, SpeciesGenome>,
  usage: Usage[],
): { structure: StructureRow[]; genes: GeneFeatureRow[] } {
  const usageBySpecies = new Map<number, Usage[]>();
  for (const u of usage) usageBySpecies.set(u.speciesId, [...(usageBySpecies.get(u.speciesId) ?? []), u]);
  const structure: StructureRow[] = [];
  const genes: GeneFeatureRow[] = [];
  for (const s of species) {
    const g = genomes.get(s.id);
    const orientation = orientationOf(g, s.phylum);
    const arc = majorArc(g, orientation);
    const seq = g?.record.sequence ?? null;
    const arcSeq = seq && arc ? regionSequence(seq, arc.start, arc.end) : null;
    const totalPairs = seq ? findRepeats(seq, REPEAT_MIN_LENGTH) : null;
    const arcPairs = arcSeq ? findRepeats(arcSeq, REPEAT_MIN_LENGTH) : null;
    const zones = contactZones(g);
    structure.push({
      speciesId: s.id,
      orientation,
      majorArc: arc,
      controlRegions: g ? g.features.filter((f) => f.type === "D-loop").length : null,
      total: totalPairs ? summarisePairs(totalPairs) : null,
      major: arcPairs ? summarisePairs(arcPairs) : null,
      motifsTotal: seq ? countMotifs(seq) : null,
      motifsMajorArc: arcSeq ? countMotifs(arcSeq) : null,
      contactZones: zones,
      bridging:
        totalPairs && zones
          ? {
              direct: bridgingPairs(totalPairs.direct, zones),
              inverted: bridgingPairs(totalPairs.inverted, zones),
              mirror: bridgingPairs(totalPairs.mirror, zones),
            }
          : null,
    });

    const rows = usageBySpecies.get(s.id) ?? [];
    const byRegion = new Map(rows.map((u) => [u.region, u]));
    for (const region of GENE_ROW_REGIONS) {
      let counts: Record<string, number>;
      let aminoAcids: Record<string, number>;
      let translTable: number;
      let strand: 1 | -1 | null = null;
      if (region === "major12") {
        if (orientation !== "canonical") continue;
        const parts = PROTEIN_GENES.filter((p) => p !== "ND6").map((p) => byRegion.get(p));
        if (parts.some((p) => !p)) continue;
        const ok = parts as Usage[];
        counts = sumCounts(ok, (u) => u.counts);
        aminoAcids = sumCounts(ok, (u) => u.aminoAcids);
        translTable = ok[0]!.translTable;
        strand = 1;
      } else {
        const u = byRegion.get(region);
        if (!u) continue;
        counts = u.counts;
        aminoAcids = u.aminoAcids;
        translTable = u.translTable;
        if (region !== "total_pc") strand = geneStrand(g, region);
      }
      const fourfold = fourfoldCounts(counts, translTable);
      const heavy = orientation === "canonical" && region !== "total_pc" && strand !== null ? toHeavyStrand(fourfold, strand) : null;
      genes.push({
        speciesId: s.id,
        region,
        translTable,
        strand: region === "major12" ? null : strand,
        fourfold,
        heavy,
        gravy: gravy(aminoAcids),
      });
    }
  }
  return { structure, genes };
}

// ---------------------------------------------------------------- features for correlations

const FF_REGIONS = ["total_pc", ...PROTEIN_GENES] as const;
const FFH_REGIONS = ["major12", ...PROTEIN_GENES] as const;
const regionLabel = (r: string) =>
  r === "total_pc" ? "all protein-coding genes" : r === "major12" ? "the 12 + strand protein genes" : r;

export function buildExtendedDefs(): FeatureDef[] {
  const defs: FeatureDef[] = [];
  for (const r of FF_REGIONS) {
    for (const b of ["A", "C", "G", "U"]) {
      defs.push({ key: `ff:${r}:${b}`, label: `${b} at fourfold-degenerate sites of ${regionLabel(r)} (gene sense, %)`, region: r, group: "fourfold" });
    }
  }
  for (const r of FFH_REGIONS) {
    for (const b of ["A", "C", "G", "T"]) {
      defs.push({ key: `ffH:${r}:${b}`, label: `${b}(H) at fourfold-degenerate sites of ${regionLabel(r)} (heavy strand, %)`, region: r, group: "fourfoldHeavy" });
    }
  }
  for (const r of FF_REGIONS) {
    defs.push({ key: `gravy:${r}`, label: `Hydropathy (GRAVY, Kyte-Doolittle) of ${regionLabel(r)}`, region: r, group: "hydropathy" });
  }
  for (const r of ["total_mtDNA", "major_arc"] as const) {
    const l = r === "major_arc" ? "the major arc" : "the whole mtDNA";
    defs.push({ key: `repeats:direct:${r}`, label: `Perfect direct repeats >= ${REPEAT_MIN_LENGTH} bp in ${l} (pairs)`, region: r, group: "repeats" });
    defs.push({ key: `repeats:inverted:${r}`, label: `Perfect inverted repeats >= ${REPEAT_MIN_LENGTH} bp in ${l} (pairs)`, region: r, group: "repeats" });
    defs.push({ key: `repeats:longestDirect:${r}`, label: `Longest perfect direct repeat in ${l} (bp)`, region: r, group: "repeats" });
  }
  for (const r of ["total_mtDNA", "major_arc"] as const) {
    const l = r === "major_arc" ? "the major arc" : "the whole mtDNA";
    defs.push({ key: `repeats:mirror:${r}`, label: `Perfect mirror repeats >= ${REPEAT_MIN_LENGTH} bp in ${l} (pairs)`, region: r, group: "repeats" });
    defs.push({ key: `motifs:g4:${r}`, label: `G-quadruplex motifs in ${l}, both strands (count)`, region: r, group: "motifs" });
    defs.push({ key: `motifs:purineTracts:${r}`, label: `Homopurine tracts >= ${TRACT_MIN} bp in ${l} (count)`, region: r, group: "motifs" });
    defs.push({ key: `motifs:pyrimidineTracts:${r}`, label: `Homopyrimidine tracts >= ${TRACT_MIN} bp in ${l} (count)`, region: r, group: "motifs" });
    defs.push({ key: `motifs:homopolymerRuns:${r}`, label: `Homopolymer runs >= ${HOMOPOLYMER_MIN} bp in ${l} (count)`, region: r, group: "motifs" });
    defs.push({ key: `motifs:longestHomopolymer:${r}`, label: `Longest homopolymer run in ${l} (bp)`, region: r, group: "motifs" });
    defs.push({ key: `motifs:strDi:${r}`, label: `Dinucleotide tandem repeats >= ${STR_MIN_UNITS} units in ${l} (count)`, region: r, group: "motifs" });
    defs.push({ key: `motifs:strTri:${r}`, label: `Trinucleotide tandem repeats >= ${STR_MIN_UNITS} units in ${l} (count)`, region: r, group: "motifs" });
    defs.push({ key: `motifs:strTetra:${r}`, label: `Tetranucleotide tandem repeats >= ${STR_MIN_UNITS} units in ${l} (count)`, region: r, group: "motifs" });
    defs.push({ key: `motifs:strBases:${r}`, label: `Bases in counted tandem repeats of ${l} (bp)`, region: r, group: "motifs" });
  }
  for (const k of ["direct", "inverted", "mirror"]) {
    defs.push({ key: `contactZone:${k}:total_mtDNA`, label: `Perfect ${k} repeat pairs bridging the ATP8-COX3 and ND5-CYTB spans (pairs)`, region: "total_mtDNA", group: "contactZone" });
  }
  defs.push({ key: "size:major_arc", label: "Length of the major arc (bp)", region: "major_arc", group: "structure" });
  defs.push({ key: "controlRegions:total_mtDNA", label: "Annotated control regions (count)", region: "total_mtDNA", group: "structure" });
  return defs;
}

/**
 * True for the extended mtDNA features. They are in the data, the correlations and the downloads,
 * but the plot explorer has no picker entries for them yet (RM19), so they are left out of its
 * payload rather than shipped as values nothing can plot.
 */
export const isExtendedFeature = (key: string): boolean =>
  /^(ff|ffH|gravy|repeats|motifs|contactZone):/.test(key) || key === "size:major_arc" || key === "controlRegions:total_mtDNA";

/** Per-gene extended features are correlated in the "all" and class scopes only, like per-gene codons. */
export const isPerGeneExtended = (key: string): boolean =>
  /^(ff|ffH|gravy):/.test(key) && !key.includes(":total_pc") && !key.includes(":major12");

export function buildExtendedValues(
  defs: FeatureDef[],
  speciesIds: number[],
  ext: { structure: StructureRow[]; genes: GeneFeatureRow[] },
): Map<string, (number | null)[]> {
  const idx = new Map(speciesIds.map((id, i) => [id, i]));
  const values = new Map<string, (number | null)[]>();
  for (const d of defs) values.set(d.key, new Array<number | null>(speciesIds.length).fill(null));
  const set = (key: string, id: number, v: number | null) => {
    const arr = values.get(key);
    const i = idx.get(id);
    if (!arr) throw new Error(`No extended feature ${key}`);
    if (i !== undefined) arr[i] = v;
  };
  for (const r of ext.genes) {
    const n = r.fourfold.a + r.fourfold.c + r.fourfold.g + r.fourfold.u;
    if (r.region !== "major12" && n > 0) {
      set(`ff:${r.region}:A`, r.speciesId, round((100 * r.fourfold.a) / n, 3));
      set(`ff:${r.region}:C`, r.speciesId, round((100 * r.fourfold.c) / n, 3));
      set(`ff:${r.region}:G`, r.speciesId, round((100 * r.fourfold.g) / n, 3));
      set(`ff:${r.region}:U`, r.speciesId, round((100 * r.fourfold.u) / n, 3));
    }
    if (r.heavy && n > 0) {
      set(`ffH:${r.region}:A`, r.speciesId, round((100 * r.heavy.a) / n, 3));
      set(`ffH:${r.region}:C`, r.speciesId, round((100 * r.heavy.c) / n, 3));
      set(`ffH:${r.region}:G`, r.speciesId, round((100 * r.heavy.g) / n, 3));
      set(`ffH:${r.region}:T`, r.speciesId, round((100 * r.heavy.t) / n, 3));
    }
    if (r.region !== "major12") set(`gravy:${r.region}`, r.speciesId, r.gravy === null ? null : round(r.gravy, 4));
  }
  for (const s of ext.structure) {
    for (const [r, rep] of [["total_mtDNA", s.total], ["major_arc", s.major]] as const) {
      set(`repeats:direct:${r}`, s.speciesId, rep?.direct ?? null);
      set(`repeats:inverted:${r}`, s.speciesId, rep?.inverted ?? null);
      set(`repeats:longestDirect:${r}`, s.speciesId, rep?.longestDirect ?? null);
    }
    for (const [r, rep] of [["total_mtDNA", s.total], ["major_arc", s.major]] as const) {
      set(`repeats:mirror:${r}`, s.speciesId, rep?.mirror ?? null);
    }
    for (const [r, m] of [["total_mtDNA", s.motifsTotal], ["major_arc", s.motifsMajorArc]] as const) {
      set(`motifs:g4:${r}`, s.speciesId, m ? m.g4Forward + m.g4Reverse : null);
      set(`motifs:purineTracts:${r}`, s.speciesId, m?.purineTracts ?? null);
      set(`motifs:pyrimidineTracts:${r}`, s.speciesId, m?.pyrimidineTracts ?? null);
      set(`motifs:homopolymerRuns:${r}`, s.speciesId, m?.homopolymerRuns ?? null);
      set(`motifs:longestHomopolymer:${r}`, s.speciesId, m?.longestHomopolymer ?? null);
      set(`motifs:strDi:${r}`, s.speciesId, m?.strDinucleotide ?? null);
      set(`motifs:strTri:${r}`, s.speciesId, m?.strTrinucleotide ?? null);
      set(`motifs:strTetra:${r}`, s.speciesId, m?.strTetranucleotide ?? null);
      set(`motifs:strBases:${r}`, s.speciesId, m?.strBases ?? null);
    }
    set("contactZone:direct:total_mtDNA", s.speciesId, s.bridging?.direct ?? null);
    set("contactZone:inverted:total_mtDNA", s.speciesId, s.bridging?.inverted ?? null);
    set("contactZone:mirror:total_mtDNA", s.speciesId, s.bridging?.mirror ?? null);
    set("size:major_arc", s.speciesId, s.majorArc?.length ?? null);
    set("controlRegions:total_mtDNA", s.speciesId, s.controlRegions);
  }
  return values;
}
