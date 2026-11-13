import { describe, expect, test } from "bun:test";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { CACHE_DIR } from "../lib/cache";
import { countBases } from "../lib/stats";
import { INPUT_DIR, type RawComposition, loadMitoAgeCsv } from "../sources/mitoage";
import { fallbackTable, genomeRows, nameChange, primaryAccession, primaryText } from "../steps/build2";
import { diffGenome, featureKeys, windowStarts } from "../steps/diff";
import { annotateGenome } from "../steps/genome";
import type { Region } from "../../src/data/schema";

describe("name changes", () => {
  test.each([
    ["Lama pacos", "Vicugna pacos", "genus_transfer"],
    ["Rucervus eldi", "Rucervus eldii", "epithet_spelling_or_gender"],
    ["Rana nigromaculata", "Pelophylax nigromaculatus", "genus_transfer_with_epithet_agreement"],
    ["Carassius auratus", "Carassius langsdorfii", "different_species_name"],
    ["Canis lupus familiaris", "Canis lupus", null],
    ["Homo sapiens", "Homo sapiens", null],
    ["Homo sapiens", null, null],
  ])("%s -> %s", (a, b, kind) => {
    expect(nameChange(a, b)).toBe(kind);
  });
});

describe("window search", () => {
  test("circular windows with given counts", () => {
    // ACGTAACC: windows of length 3 with a=2,c=1 start at 4 (TAA? no) ... computed by brute force.
    const seq = "ACGTAACCGA";
    const L = 3;
    const target = { a: 2, c: 1, g: 0, t: 0 };
    const brute: number[] = [];
    const s = seq + seq.slice(0, L);
    for (let i = 0; i < seq.length; i++) {
      const b = countBases(s.slice(i, i + L));
      if (b.a === 2 && b.c === 1 && b.g === 0 && b.t === 0) brute.push(i + 1);
    }
    expect(windowStarts(seq, L, target)).toEqual(brute);
    expect(brute.length).toBeGreaterThan(0);
    expect(windowStarts(seq, 0, target)).toEqual([]);
  });
});

describe("feature keys", () => {
  test("n-th copy of a name in genome order", () => {
    const f = (name: string) => ({ name, type: "tRNA" as const, start: 1, end: 2, strand: 1 as const });
    expect(featureKeys([f("tRNA-Leu(UUR)"), f("tRNA-Phe"), f("tRNA-Leu(UUR)")])).toEqual(["tRNA-Leu(UUR)#1", "tRNA-Phe#1", "tRNA-Leu(UUR)#2"]);
  });
});

/** Diff one build 1 species against its cited record, the way build 2 does for a live species. */
async function diffSpecies(id: number) {
  const raw = await loadMitoAgeCsv();
  const s = raw.species.get(id)!;
  const text = readFileSync(join(CACHE_DIR, "genbank", `${s.refseq}.gb`), "utf8");
  const g = annotateGenome(text, fallbackTable(s.phylum), s.phylum === "Chordata");
  const rows = genomeRows(id, g);
  const csvComposition = new Map<Region, RawComposition[]>();
  for (const [region, m] of raw.composition) if (m.get(id)) csvComposition.set(region, m.get(id)!);
  const csvCodons = new Map<string, Record<string, number>>();
  for (const [region, m] of raw.codons) if (m.get(id)) csvCodons.set(region, m.get(id)!.counts);
  const pa = primaryAccession(text);
  const pt = pa ? primaryText(pa) : null;
  const primary = pt ? { accession: pt.accession, genome: annotateGenome(pt.text, fallbackTable(s.phylum), s.phylum === "Chordata") } : null;
  const d = diffGenome({
    id, csvComposition, csvCodons, emittedStats: rows.stats, emittedCodons: rows.usage, evidence: g, evidenceText: text, primary,
    accessionChange: null, baselineFeatures: rows.features, emittedFeatures: rows.features,
  });
  return { raw, g, rows, d, primary };
}

const hasInputs = existsSync(INPUT_DIR) && existsSync(join(CACHE_DIR, "genbank")) && existsSync(join(CACHE_DIR, "build2", "genbank_primary"));

describe.skipIf(!hasInputs)("classification of build 1 differences on real records", () => {
  test("ND3 with a frameshift join(): build 1 counted the full span (Accipiter nisus)", async () => {
    const { g, d, raw } = await diffSpecies(1015);
    const nd3 = g.features.find((f) => f.name === "ND3")!;
    expect(nd3.segments.length).toBeGreaterThan(1);
    const span = g.record.sequence.slice(nd3.start - 1, nd3.end);
    const csv = raw.composition.get("ND3")!.get(1015)![0]!;
    // Build 1's ND3 length is the full start..end span; build 2 counts the segments.
    expect(csv.lengthBp).toBe(span.length);
    const rows = d.changes.filter((c) => c.table === "region_stats" && c.rowKey === "1015:ND3");
    expect(rows.length).toBeGreaterThan(0);
    for (const r of rows) expect(r).toMatchObject({ diffClass: "rule_full_span", changeType: "correction", scope: "rule" });
    const len = rows.find((r) => r.field === "length_bp")!;
    expect(Number(len.oldValue)).toBe(span.length);
    expect(Number(len.newValue)).toBe(nd3.segments.reduce((s, x) => s + x.end - x.start + 1, 0));
    // total_pc inherits the class of its member.
    const tp = d.changes.filter((c) => c.rowKey === "1015:total_pc");
    for (const r of tp) expect(r.diffClass).toBe("derived_from_rule_full_span");
  }, 60_000);

  test("re-annotation after 2015: build 1 equals the source INSDC record (Apis mellifera COX1)", async () => {
    const { d, primary } = await diffSpecies(5);
    expect(primary?.accession).toBe("L06178.1");
    const rows = d.changes.filter((c) => c.table === "region_stats" && c.rowKey === "5:COX1");
    expect(rows.length).toBeGreaterThan(0);
    for (const r of rows) expect(r.diffClass).toBe("upstream_reannotation_same_version");
  }, 60_000);

  test("a species whose build 1 values equal its record has no differences (Homo sapiens)", async () => {
    const { d } = await diffSpecies(3221);
    expect(d.changes.filter((c) => c.table !== "genome_features")).toEqual([]);
  }, 60_000);
});
