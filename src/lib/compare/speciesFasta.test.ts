import { describe, expect, test } from "bun:test";
import { getAllSpecies } from "~/data";
import { MAX_COMPARE } from "~/lib/explore/compareTypes";
import { compareFastaName, FASTA_NAME_MAX, fastaChoice, leftOutSentence } from "./speciesFasta";

const SPECIES = getAllSpecies();
type Chosen = { slug: string; refseq: string };
/** `count` species spread over the data, as the view holds them once their records have loaded. */
const spread = (count: number) =>
  Array.from({ length: count }, (_, i) => SPECIES[Math.floor((i * SPECIES.length) / count)]).flatMap((s) =>
    s ? [{ slug: s.slug, refseq: s.refseq }] : [],
  );
const refseqOf = new Map(SPECIES.map((s) => [s.slug, s.refseq]));
const longestFirst = [...SPECIES].sort((a, b) => b.slug.length - a.slug.length).map((s) => s.slug);
const shortestFirst = [...longestFirst].reverse();

describe("fastaChoice", () => {
  test("asks for the accession of every chosen species, in the order chosen", () => {
    for (let count = 1; count <= MAX_COMPARE; count++) {
      const chosen = spread(count);
      expect(chosen.length).toBe(count);
      for (const order of [chosen, [...chosen].reverse()]) {
        const choice = fastaChoice(order);
        expect(choice.slugs).toEqual(order.map((c) => c.slug));
        expect(choice.accessions).toEqual(order.map((c) => refseqOf.get(c.slug) ?? "unknown species"));
        expect(choice.leftOut).toEqual([]);
      }
    }
  });

  test("a species that has not loaded, or has no accession, is left out and named", () => {
    const [a, b, c, d, e] = spread(5) as [Chosen, Chosen, Chosen, Chosen, Chosen];
    const chosen = [a, { slug: b.slug, refseq: null }, c, { slug: d.slug, refseq: "" }, { slug: "no-such-species", refseq: null }, { slug: e.slug, refseq: "  " }];
    const choice = fastaChoice(chosen);
    expect(choice.accessions).toEqual([a.refseq, c.refseq]);
    expect(choice.slugs).toEqual([a.slug, c.slug]);
    expect(choice.leftOut).toEqual([b.slug, d.slug, "no-such-species", e.slug]);
    // Every chosen species is either asked for or named as left out, never both and never neither.
    expect([...choice.slugs, ...choice.leftOut].sort()).toEqual(chosen.map((x) => x.slug).sort());
  });

  test("nothing chosen, nothing asked for", () => {
    expect(fastaChoice([])).toEqual({ accessions: [], slugs: [], leftOut: [] });
    expect(fastaChoice([{ slug: "x", refseq: null }]).accessions).toEqual([]);
  });
});

describe("compareFastaName", () => {
  const full = (slugs: readonly string[]) => `mitoage-${slugs.join("-")}.fasta`;
  const pad = (len: number) => "x".repeat(len);

  test("lists every species while the name stays short, else the first and how many follow", () => {
    let listed = 0;
    let shortened = 0;
    for (const pool of [shortestFirst, longestFirst, SPECIES.map((s) => s.slug)]) {
      for (let count = 2; count <= MAX_COMPARE; count++) {
        const slugs = pool.slice(0, count);
        const name = compareFastaName(slugs);
        if (full(slugs).length <= FASTA_NAME_MAX) {
          expect(name).toBe(full(slugs));
          listed++;
        } else {
          expect(name).toBe(`mitoage-${slugs[0]}-and-${count - 1}-more.fasta`);
          expect(name.length).toBeLessThan(full(slugs).length);
          shortened++;
        }
        expect(name).toMatch(/^mitoage-[a-z0-9-]+\.fasta$/);
      }
    }
    // The data has selections on both sides of the limit, so both branches ran.
    expect(listed).toBeGreaterThan(0);
    expect(shortened).toBeGreaterThan(0);
  });

  test("the limit itself still lists every species, one character more does not", () => {
    const [a, b] = shortestFirst as [string, string];
    const room = FASTA_NAME_MAX - full([a, b, ""]).length;
    expect(room).toBeGreaterThan(0);
    expect(compareFastaName([a, b, pad(room)])).toBe(full([a, b, pad(room)]));
    expect(full([a, b, pad(room)]).length).toBe(FASTA_NAME_MAX);
    expect(compareFastaName([a, b, pad(room + 1)])).toBe(`mitoage-${a}-and-2-more.fasta`);
  });

  test("one species is named whatever its length, and no species still gives a file name", () => {
    const longest = longestFirst[0] ?? "";
    expect(compareFastaName([longest])).toBe(full([longest]));
    expect(compareFastaName([pad(FASTA_NAME_MAX + 1)])).toBe(full([pad(FASTA_NAME_MAX + 1)]));
    expect(compareFastaName([])).toBe("mitoage-species.fasta");
  });
});

describe("leftOutSentence", () => {
  test("names what was left out, and says nothing when nothing was", () => {
    expect(leftOutSentence([])).toBeUndefined();
    expect(leftOutSentence(["homo-sapienz"])).toBe("homo-sapienz has no accession here and was left out.");
    expect(leftOutSentence(["a", "b"])).toBe("a, b have no accession here and were left out.");
  });
});
