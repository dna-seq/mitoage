import { describe, expect, test } from "bun:test";
import { PROTEIN_GENES, type GenomeFeature, type LifespanInfo, type LifespanObservation, type Species } from "../../src/data/schema";
import { SEQUENCE_AUDIT, type SequenceFinding } from "../curation/sequence-audit";
import { AMBIGUOUS_BASES_MIN, CONFIDENCE_LEVELS, CONFIDENCE_REASONS, OTHER_SOURCE_RATIO, confidenceOf, confidenceOfAll, isReverseComplement } from "../steps/confidence";
import { inDataset } from "../steps/correlations";

const lifespan = (over: Partial<LifespanInfo> = {}): LifespanInfo => ({
  source: "AnAge", sourceVersion: "build 15", sourceRecordId: "1", quality: "acceptable", sampleSize: "medium", recordType: "captive", license: "", ...over,
});

const species = (over: Partial<Species> = {}): Species => ({
  id: 1, slug: "a-b", refseq: "NC_000001.1", scientificName: "A b", commonName: "", maxLongevityYears: 10, mtdnaSizeBp: 16500, nonCodingBp: 900, gcPercent: 40,
  taxonomy: { kingdom: "Animalia", phylum: "Chordata", class: "Mammalia", order: "O", family: "F", genus: "A" },
  traits: {} as Species["traits"], legacyId: null, ncbiTaxid: 5, ncbiSpeciesTaxid: 5, reviewFlags: [],
  provenance: { addedInBuild: 2, addedAt: "", lastModifiedBuild: null, lastModifiedAt: null, recordStatus: "new", sourceVersion: "" },
  lifespan: lifespan(), ...over,
} as Species);

/** A complete record on the usual strand: 13 protein genes (ND6 reverse), two rRNAs. */
const genome = (flip = false): GenomeFeature[] => [
  ...PROTEIN_GENES.map((name, i): GenomeFeature => ({ name, type: "CDS", start: 1 + i * 1000, end: 900 + i * 1000, strand: ((name === "ND6") !== flip ? -1 : 1) })),
  { name: "rRNA-12S", type: "rRNA", start: 14000, end: 14900, strand: flip ? -1 : 1 },
  { name: "rRNA-16S", type: "rRNA", start: 15000, end: 16000, strand: flip ? -1 : 1 },
];

const obs = (over: Partial<LifespanObservation>): LifespanObservation => ({
  speciesId: 1, ncbiTaxid: 5, source: "FishBase", sourceVersion: "", sourceRecordId: "x", sourceName: "A b", valueYears: 10, recordType: "wild", quality: null,
  sampleSizeText: null, sex: null, detail: null, reference: null, license: "", matchMethod: "", isChosen: false, provenance: species().provenance!, ...over,
});

const of = (s: Species, extra: { features?: GenomeFeature[] | undefined; ambiguousBases?: number | null; observations?: LifespanObservation[]; findings?: SequenceFinding[] } = {}) =>
  confidenceOf({ species: s, features: "features" in extra ? extra.features : genome(), ambiguousBases: extra.ambiguousBases ?? 0, observations: extra.observations ?? [], findings: extra.findings ?? [] });

describe("confidence level of a record", () => {
  test("a complete record with a graded lifespan and no reason is high, with no reasons", () => {
    expect(of(species())).toEqual({ level: "high", reasons: [] });
  });

  test("every reason has a level below high, and the level of a record is the worst of its reasons'", () => {
    for (const r of Object.values(CONFIDENCE_REASONS)) expect(CONFIDENCE_LEVELS.indexOf(r.level)).toBeGreaterThan(0);
    const c = of(species({ ncbiTaxid: 6, lifespan: lifespan({ quality: "low", sampleSize: "tiny" }) }));
    expect(c).toEqual({ level: "low", reasons: ["lifespan_low_quality", "subspecies_record", "tiny_sample"] });
    const u = of(species({ ncbiTaxid: 6, lifespan: lifespan({ quality: "low" }) }), { findings: [{ refseq: "NC_000001.1", kind: "chimera", evidence: "", found: "" }] });
    expect(u.level).toBe("unreliable");
    expect(u.reasons).toEqual(["lifespan_low_quality", "sequence_chimera", "subspecies_record"]);
  });

  test("a retired record is unreliable, and its missing genome adds no reason of its own", () => {
    const s = species({ provenance: { ...species().provenance!, recordStatus: "retired" } });
    expect(of(s, { features: undefined, ambiguousBases: null })).toEqual({ level: "unreliable", reasons: ["retired"] });
  });

  test("each kind of audit finding gives its reason and level", () => {
    const kinds = { other_species: "sequence_other_species", chimera: "sequence_chimera", one_genome_names: "sequence_one_genome_names", truncated: "sequence_truncated" } as const;
    for (const [kind, reason] of Object.entries(kinds)) {
      expect(of(species(), { findings: [{ refseq: "NC_000001.1", kind: kind as SequenceFinding["kind"], evidence: "", found: "" }] })).toEqual({ level: "unreliable", reasons: [reason] });
    }
    expect(of(species(), { findings: [{ refseq: "NC_000001.1", kind: "specimen_doubt", evidence: "", found: "" }] })).toEqual({ level: "caveat", reasons: ["specimen_doubt"] });
    expect(of(species(), { findings: [{ refseq: "NC_000001.1", kind: "sequence_errors", evidence: "", found: "" }] })).toEqual({ level: "caveat", reasons: ["sequence_errors"] });
  });

  test("an audit finding holds for its accession.version only", () => {
    const finding: SequenceFinding = { refseq: "NC_000001.1", kind: "other_species", evidence: "", found: "" };
    const all = (refseq: string) => confidenceOfAll([species({ refseq })], new Map([[1, genome()]]), [], [], [finding]).get(1)!;
    expect(all("NC_000001.1").level).toBe("unreliable");
    expect(all("NC_000001.2")).toEqual({ level: "high", reasons: [] });
  });

  test("a record on the other strand is told from the usual one and from a rearranged one", () => {
    expect(isReverseComplement(genome(), "Chordata")).toBe(false);
    expect(isReverseComplement(genome(true), "Chordata")).toBe(true);
    expect(isReverseComplement(genome(true), "Mollusca")).toBe(false);
    // one gene moved to the other strand is a rearrangement, not a reverse complement
    const moved = genome().map((f) => (f.name === "ND1" ? { ...f, strand: -1 as const } : f));
    expect(isReverseComplement(moved, "Chordata")).toBe(false);
    const movedBack = genome(true).map((f) => (f.name === "ND1" ? { ...f, strand: 1 as const } : f));
    expect(isReverseComplement(movedBack, "Chordata")).toBe(false);
    // a record without all 13 genes is not judged
    expect(isReverseComplement(genome(true).filter((f) => f.name !== "ATP8"), "Chordata")).toBe(false);
    expect(of(species(), { features: genome(true) })).toEqual({ level: "unreliable", reasons: ["reverse_complement"] });
  });

  test("a record with no rRNA gene is unreliable", () => {
    expect(of(species(), { features: genome().filter((f) => f.type !== "rRNA") })).toEqual({ level: "unreliable", reasons: ["no_rrna"] });
    expect(of(species(), { features: genome().filter((f) => f.name !== "rRNA-12S") }).level).toBe("high");
  });

  test("the lifespan's kind, grade, source and sample each give their reason", () => {
    expect(of(species({ lifespan: lifespan({ recordType: "estimated" }) }))).toEqual({ level: "low", reasons: ["lifespan_estimated"] });
    expect(of(species({ lifespan: lifespan({ quality: "questionable" }) }))).toEqual({ level: "low", reasons: ["lifespan_questionable"] });
    expect(of(species({ lifespan: lifespan({ quality: "low" }) }))).toEqual({ level: "low", reasons: ["lifespan_low_quality"] });
    const ungraded = species();
    delete ungraded.lifespan;
    expect(of(ungraded)).toEqual({ level: "low", reasons: ["lifespan_ungraded"] });
    for (const source of ["EURING", "USGS_BBL"] as const) expect(of(species({ lifespan: lifespan({ source }) }))).toEqual({ level: "caveat", reasons: ["ringing_record"] });
    expect(of(species({ lifespan: lifespan({ sampleSize: "tiny" }) }))).toEqual({ level: "caveat", reasons: ["tiny_sample"] });
    expect(of(species({ lifespan: lifespan({ sampleSize: "small" }) })).level).toBe("high");
  });

  test("another source's higher value counts from the ratio on, and only when it is an observed, ungraded-down value of another source", () => {
    const s = species({ maxLongevityYears: 10 });
    const at = (o: Partial<LifespanObservation>) => of(s, { observations: [obs({ valueYears: 10, source: "AnAge", isChosen: true }), obs(o)] }).reasons;
    expect(at({ valueYears: 10 * OTHER_SOURCE_RATIO })).toEqual(["other_source_higher"]);
    expect(at({ valueYears: 10 * OTHER_SOURCE_RATIO - 0.01 })).toEqual([]);
    expect(at({ valueYears: 40, recordType: "estimated" })).toEqual([]);
    expect(at({ valueYears: 40, quality: "questionable" })).toEqual([]);
    expect(at({ valueYears: 40, quality: "low" })).toEqual([]);
    expect(at({ valueYears: 40, source: "AnAge" })).toEqual([]);
    expect(at({ valueYears: 40, isChosen: true })).toEqual([]);
  });

  test("ambiguous bases count from the threshold; an unknown count gives no reason", () => {
    expect(of(species(), { ambiguousBases: AMBIGUOUS_BASES_MIN }).reasons).toEqual(["ambiguous_bases"]);
    expect(of(species(), { ambiguousBases: AMBIGUOUS_BASES_MIN - 1 }).reasons).toEqual([]);
    expect(confidenceOf({ species: species(), features: genome(), ambiguousBases: null, observations: [], findings: [] }).reasons).toEqual([]);
  });

  test("a subspecies' record is a caveat; a missing taxid is not read as one", () => {
    expect(of(species({ ncbiTaxid: 6 })).reasons).toEqual(["subspecies_record"]);
    expect(of(species({ ncbiTaxid: null })).reasons).toEqual([]);
    expect(of(species({ ncbiSpeciesTaxid: null })).reasons).toEqual([]);
  });

  test("the review flags that bear on reliability are taken up, the others are not", () => {
    const r = (flags: string[]) => of(species({ reviewFlags: flags }));
    expect(r(["cited_record_resolves_to_other_species:X y"])).toEqual({ level: "unreliable", reasons: ["record_other_species"] });
    expect(r(["possible_duplicate_species:X y"])).toEqual({ level: "caveat", reasons: ["possible_duplicate"] });
    expect(r(["source_match_in_review"])).toEqual({ level: "caveat", reasons: ["source_match_in_review"] });
    expect(r(["gene_not_annotated:ATP8"])).toEqual({ level: "caveat", reasons: ["gene_missing"] });
    expect(r(["gene_annotated_by_mitoage:ND6", "anage_name_differs", "lifespan_from_build1_only"])).toEqual({ level: "high", reasons: [] });
  });

  test("the whole build: totals and ambiguous counts are taken per species from the genome row only", () => {
    const a = species({ id: 1 }), b = species({ id: 2, slug: "c-d", refseq: "NC_000002.1" });
    const row = (speciesId: number, region: string, other: number) => ({ speciesId, region, other, lengthBp: 1, a: 0, c: 0, g: 0, t: 0, gcPercent: 0, gcSkew: null, atSkew: null }) as never;
    const levels = confidenceOfAll([a, b], new Map([[1, genome()], [2, genome()]]), [row(1, "total_mtDNA", 0), row(1, "total_pc", 500), row(2, "total_mtDNA", 60)], [obs({ speciesId: 2, valueYears: 99 })], []);
    expect(levels.get(1)).toEqual({ level: "high", reasons: [] });
    expect(levels.get(2)).toEqual({ level: "caveat", reasons: ["ambiguous_bases", "other_source_higher"] });
  });

  test("an unreliable record is in no correlation dataset; the other levels do not decide membership", () => {
    for (const level of CONFIDENCE_LEVELS) {
      const s = species({ confidence: { level, reasons: [] } });
      expect(inDataset(s, "default")).toBe(level !== "unreliable");
      expect(inDataset(s, "anage_only")).toBe(level !== "unreliable");
    }
  });

  test("the audit list names each record once per kind, with evidence and a date", () => {
    const keys = SEQUENCE_AUDIT.map((f) => `${f.refseq} ${f.kind}`);
    expect(new Set(keys).size).toBe(keys.length);
    for (const f of SEQUENCE_AUDIT) {
      expect(f.refseq).toMatch(/^NC_\d{6}\.\d+$/);
      expect(f.evidence.length).toBeGreaterThan(20);
      expect(f.found).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    }
  });
});
