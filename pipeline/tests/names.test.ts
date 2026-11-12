import { describe, expect, test } from "bun:test";
import { isoacceptorFromAnticodon, normaliseFeature, normaliseProteinGene, normaliseRrna } from "../lib/names";

const feat = (key: string, q: Record<string, string>) => ({
  key,
  qualifiers: Object.fromEntries(Object.entries(q).map(([k, v]) => [k, [v]])),
});

describe("protein gene synonyms", () => {
  test.each([
    ["COI", "COX1"], ["CO1", "COX1"], ["cox1", "COX1"], ["COXI", "COX1"],
    ["cytochrome c oxidase subunit I", "COX1"], ["cytochrome c oxidase subunit 2", "COX2"],
    ["COIII", "COX3"], ["ATPase6", "ATP6"], ["ATP synthase F0 subunit 6", "ATP6"],
    ["ATPase subunit 8", "ATP8"], ["atp8", "ATP8"], ["cob", "CYTB"], ["Cyt b", "CYTB"],
    ["cytochrome b", "CYTB"], ["ND4L", "ND4L"], ["nad4L", "ND4L"],
    ["NADH dehydrogenase subunit 4L", "ND4L"], ["NADH dehydrogenase subunit 4", "ND4"],
    ["NADH dehydrogenase subunit VI", "ND6"], ["NAD5", "ND5"], ["MT-ND1", "ND1"], ["nd2", "ND2"],
  ])("%s -> %s", (input, expected) => {
    expect(normaliseProteinGene(input)).toBe(expected as never);
  });

  test("unknown names are rejected", () => {
    expect(normaliseProteinGene("hypothetical protein")).toBeNull();
    expect(normaliseProteinGene("")).toBeNull();
  });
});

describe("rRNA synonyms", () => {
  test.each([
    ["12S ribosomal RNA", "rRNA-12S"], ["s-rRNA", "rRNA-12S"], ["rrnS", "rRNA-12S"],
    ["small subunit ribosomal RNA", "rRNA-12S"], ["16S ribosomal RNA", "rRNA-16S"],
    ["l-rRNA", "rRNA-16S"], ["rrnL", "rRNA-16S"], ["large subunit ribosomal RNA", "rRNA-16S"],
  ])("%s -> %s", (input, expected) => {
    expect(normaliseRrna(input)).toBe(expected as never);
  });
});

describe("feature normalisation", () => {
  test("CDS uses gene, then product", () => {
    expect(normaliseFeature(feat("CDS", { gene: "COI", product: "cytochrome c oxidase subunit I" }))?.name).toBe("COX1");
    expect(normaliseFeature(feat("CDS", { product: "ATP synthase F0 subunit 8" }))?.name).toBe("ATP8");
  });

  test("tRNA names from product, gene and one-letter codes", () => {
    expect(normaliseFeature(feat("tRNA", { product: "tRNA-Phe" }))?.name).toBe("tRNA-Phe");
    expect(normaliseFeature(feat("tRNA", { gene: "trnF" }))?.name).toBe("tRNA-Phe");
    expect(normaliseFeature(feat("tRNA", { product: "transfer RNA-Trp" }))?.name).toBe("tRNA-Trp");
    expect(normaliseFeature(feat("tRNA", { gene: "trnW(tca)" }))?.name).toBe("tRNA-Trp");
  });

  test("Leu/Ser isoacceptors", () => {
    expect(normaliseFeature(feat("tRNA", { product: "tRNA-Leu", anticodon: "(pos:3260..3262,aa:Leu,seq:taa)" }))?.name).toBe("tRNA-Leu(UUR)");
    expect(normaliseFeature(feat("tRNA", { product: "tRNA-Leu", note: "codons recognized: CUN" }))?.name).toBe("tRNA-Leu(CUN)");
    expect(normaliseFeature(feat("tRNA", { product: "tRNA-Ser", gene: "trnS1(gct)" }))?.name).toBe("tRNA-Ser(AGY)");
    expect(normaliseFeature(feat("tRNA", { product: "tRNA-Ser (UCN)" }))?.name).toBe("tRNA-Ser(UCN)");
    // MITOS numbering trnL2(taa) is resolved by its anticodon, not by the number.
    expect(normaliseFeature(feat("tRNA", { gene: "trnL2(taa)", product: "tRNA-Leu" }))?.name).toBe("tRNA-Leu(UUR)");
    // Bare HGNC numbering is a last resort.
    const n = normaliseFeature(feat("tRNA", { gene: "TRNL1", product: "tRNA-Leu" }));
    expect(n?.name).toBe("tRNA-Leu(UUR)");
    expect(n?.via).toBe("numbering");
    expect(normaliseFeature(feat("tRNA", { product: "tRNA-Leu" }))?.via).toBe("unresolved");
  });

  test("anticodon helper", () => {
    expect(isoacceptorFromAnticodon("Leu", "uag")).toBe("CUN");
    expect(isoacceptorFromAnticodon("Ser", "TGA")).toBe("UCN");
    expect(isoacceptorFromAnticodon("Ser", "GCT")).toBe("AGY");
    expect(isoacceptorFromAnticodon("Phe", "GAA")).toBeNull();
  });

  test("D-loop and control regions", () => {
    expect(normaliseFeature(feat("D-loop", {}))?.name).toBe("D_Loop");
    expect(normaliseFeature(feat("misc_feature", { note: "control region" }))?.type).toBe("D-loop");
    expect(normaliseFeature(feat("misc_feature", { note: "tandem repeat" }))).toBeNull();
  });
});
