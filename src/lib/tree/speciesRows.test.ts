import { describe, expect, test } from "bun:test";
import { getAllSpecies, getSpeciesInTaxon, getTaxa } from "~/data";
import type { Rank } from "~/data/schema";
import { buildTreePayload } from "./build";
import { cladeFastaName, leafRow, REFSEQ_KEY, speciesRow } from "./speciesRows";
import { decodeTree, type TreePayload } from "./types";

const payload = buildTreePayload();
const model = decodeTree(payload);
const SPECIES = getAllSpecies();
/** The extra column of a taxon page (src/pages/taxa/[rank]/[slug].astro). */
const groupRankOf = (rank: Rank): Rank | undefined =>
  rank === "kingdom" || rank === "phylum" ? "class" : rank === "class" ? "order" : rank === "order" ? "family" : undefined;

describe("tree payload", () => {
  test("every species leaf carries the RefSeq accession of its species", () => {
    const bySlug = new Map(SPECIES.map((s) => [s.slug, s.refseq]));
    expect(payload.leaf.refseq.length).toBe(payload.leaf.node.length);
    expect(model.leaves.length).toBe(SPECIES.length);
    for (const l of model.leaves) expect(l.data.sp?.refseq).toBe(bySlug.get(l.data.slug) ?? "no such species");
    expect(new Set(model.leaves.map((l) => l.data.sp?.refseq))).toEqual(new Set(SPECIES.map((s) => s.refseq)));
    for (const s of SPECIES) expect(s.refseq).toMatch(/^[A-Z]{2}_\d+\.\d+$/);
  });

  test("a payload cached from before the accession was sent decodes with none, not with a wrong one", () => {
    const { refseq: _dropped, ...leaf } = payload.leaf;
    const old = decodeTree({ ...payload, leaf } as unknown as TreePayload);
    expect(old.leaves.length).toBe(model.leaves.length);
    old.leaves.forEach((l, k) => {
      expect(l.data.sp?.refseq).toBe("");
      expect(l.data.sp?.size).toBe(model.leaves[k]?.data.sp?.size ?? Number.NaN);
      expect(leafRow(l)[REFSEQ_KEY]).toBe("");
    });
  });
});

describe("clade species rows", () => {
  test("in every clade the rows loaded from the tree are the rows the page carries inline", () => {
    let clades = 0;
    /** Species the data gives no taxon at the group rank: the one place the two sources differ. */
    const ungrouped = new Set<string>();
    for (const t of getTaxa()) {
      const node = model.byKey.get(`${t.rank}:${t.slug}`);
      expect(node).toBeDefined();
      if (!node) continue;
      const groupRank = groupRankOf(t.rank);
      const inline = new Map(getSpeciesInTaxon(t.rank, t.slug).map((s) => [s.slug, speciesRow(s, groupRank)]));
      const leaves = node.leaves();
      expect(leaves.length).toBe(t.speciesCount);
      expect(new Set(leaves.map((l) => l.data.slug))).toEqual(new Set(inline.keys()));
      for (const l of leaves) {
        const fromTree = leafRow(l, groupRank);
        const fromSpecies = inline.get(l.data.slug) ?? {};
        for (const key of ["name", "href", "size", REFSEQ_KEY]) expect([key, fromTree[key]]).toEqual([key, fromSpecies[key]]);
        // A species without an order or a family has an empty group inline, and in the tree the
        // name of the placeholder taxon it hangs under ("Unknown order").
        if (groupRank && fromSpecies["group"] === "") {
          expect(fromTree["group"]).toBe(`Unknown ${groupRank}`);
          ungrouped.add(l.data.slug);
        } else expect(["group", fromTree["group"]]).toEqual(["group", fromSpecies["group"]]);
        expect(fromTree["common"]).toBe(String(fromSpecies["common"]).trim());
        // The payload rounds lifespan and GC to two decimals.
        for (const key of ["life", "gc"]) expect(Math.abs(Number(fromTree[key]) - Number(fromSpecies[key]))).toBeLessThanOrEqual(0.005 + 1e-9);
      }
      clades++;
    }
    expect(clades).toBe(getTaxa().length);
    expect(clades).toBeGreaterThan(100);
    // Exactly the species whose order or family the data leaves empty, and no other.
    expect([...ungrouped].sort()).toEqual(
      SPECIES.filter((s) => !s.taxonomy.order || !s.taxonomy.family)
        .map((s) => s.slug)
        .sort(),
    );
  });

  test("the accessions of a clade's rows are those of its species, each once", () => {
    for (const [rank, slug] of [["class", "mammalia"], ["order", "primates"], ["genus", "homo"]] as const) {
      const species = getSpeciesInTaxon(rank, slug);
      expect(species.length).toBeGreaterThan(0);
      const fromTree = (model.byKey.get(`${rank}:${slug}`)?.leaves() ?? []).map((l) => leafRow(l)[REFSEQ_KEY]);
      const inline = species.map((s) => speciesRow(s)[REFSEQ_KEY]);
      expect(new Set(inline).size).toBe(species.length);
      expect([...fromTree].sort()).toEqual([...inline].sort());
      expect([...inline].sort()).toEqual(species.map((s) => s.refseq).sort());
    }
  });

  test("a row without a group rank has no group, one with a rank names the taxon of that rank", () => {
    const human = SPECIES.find((s) => s.slug === "homo-sapiens");
    expect(human).toBeDefined();
    if (!human) return;
    expect("group" in speciesRow(human)).toBe(false);
    expect(speciesRow(human, "order")["group"]).toBe(human.taxonomy.order);
    expect(speciesRow(human, "family")["group"]).toBe(human.taxonomy.family);
  });

  test("the file is named after the clade", () => {
    expect(cladeFastaName("class:mammalia")).toBe("mitoage-class-mammalia-mitochondrial-genomes.fasta");
    for (const t of getTaxa()) expect(cladeFastaName(`${t.rank}:${t.slug}`)).toBe(`mitoage-${t.rank}-${t.slug}-mitochondrial-genomes.fasta`);
    expect(cladeFastaName(" Order:Primates ")).toBe("mitoage-order-primates-mitochondrial-genomes.fasta");
  });
});
