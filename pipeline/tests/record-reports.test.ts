import { describe, expect, test } from "bun:test";
import { SEQUENCE_AUDIT } from "../curation/sequence-audit";
import { basis, draft, notDrafted, reports } from "../record-reports";

describe("basis", () => {
  test("read from the evidence's own words", () => {
    expect(basis("COX1 99% to independent sequences of A b")).toEqual(["independent_sequences"]);
    expect(basis("COX1 99.8% to independent mallard sequences; on the list of X 2021 as mislabelled")).toEqual(["independent_sequences", "published"]);
    expect(basis("published as a misidentified A b")).toEqual(["published"]);
    expect(basis("99.7% over the 13 protein genes to NC_1.1 (A b), another genus")).toEqual([]);
  });
});

describe("notDrafted", () => {
  const f = (kind: Parameters<typeof notDrafted>[0]["kind"], evidence: string) => ({ refseq: "NC_1.1", kind, evidence, found: "2026-11-19" });
  test("an unsettled name, a finding from the record itself and one resting on another record get no draft", () => {
    expect(notDrafted(f("one_genome_names", "on the list of X"))).toContain("not settled");
    expect(notDrafted(f("truncated", "published"))).toContain("record itself");
    expect(notDrafted(f("specimen_doubt", "published"))).toContain("record itself");
    expect(notDrafted(f("other_species", "99.7% to NC_2.1"))).toContain("no independent sequence and no published list");
    expect(notDrafted(f("sequence_errors", "ND3 does not translate as annotated (6 internal stops)"))).toContain("no independent sequence");
  });
  test("a wrong sequence resting on independent sequences or a published list gets one", () => {
    expect(notDrafted(f("other_species", "COX1 99% to independent sequences of A b"))).toBeNull();
    expect(notDrafted(f("chimera", "on the list of X as a chimera"))).toBeNull();
    expect(notDrafted(f("sequence_errors", "on the list of X for sequencing errors"))).toBeNull();
  });
});

describe("reports, on the committed audit and screen", () => {
  const all = reports();
  test("every audited record once, in the order of the accessions", () => {
    expect(all.map((r) => r.finding.refseq)).toEqual(SEQUENCE_AUDIT.map((f) => f.refseq).sort());
  });
  test("a draft exists exactly where no reason against it does, and never for an unsettled name", () => {
    for (const r of all) {
      expect(r.reason === null).toBe(notDrafted(r.finding) === null);
      if (r.finding.kind === "one_genome_names") expect(r.reason).not.toBeNull();
      if (r.reason === null) expect(r.basis.length).toBeGreaterThan(0);
    }
    expect(all.some((r) => r.reason === null)).toBe(true);
    expect(all.some((r) => r.reason !== null)).toBe(true);
  });
  test("the screen's rows are the record's own species', the named species first within a gene", () => {
    for (const r of all) {
      for (const c of r.screen) expect(c.slug).toBe(r.species!.slug);
      for (const gene of new Set(r.screen.map((c) => c.gene))) {
        const rows = r.screen.filter((c) => c.gene === gene);
        expect(rows[0]!.own).toBe(true);
        expect(rows.filter((c) => c.own).length).toBe(1);
      }
    }
  });
  test("a draft carries the accession, the evidence word for word, and one table row per comparison that could be read", () => {
    const names = new Map<string, string>();
    for (const r of all.filter((x) => x.reason === null)) {
      const text = draft(r, names);
      expect(text).toContain(r.finding.refseq);
      expect(text).toContain(r.finding.evidence);
      const read = r.screen.filter((c) => c.stat);
      expect(text.split("\n").filter((l) => /^\| (COX1|CYTB) \|/.test(l)).length).toBe(read.length);
      for (const c of r.screen.filter((x) => !x.stat)) expect(text).not.toContain(`| ${c.gene} | ${c.target} `);
    }
  });
});
