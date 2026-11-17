/**
 * Possible duplicate species by names (RM8): two species of the build whose names one taxonomy treats as
 * one species. It reports and merges nothing; the pairs go to the review list.
 *
 *   NCBI                     the scientific name of one species is listed by NCBI as a synonym of the other
 *   FishBase, SeaLifeBase    one species record of the source (a SpecCode) carries both names, each as its
 *                            accepted name or a synonym
 *
 * A "misapplied name" and an "ambiguous synonym" are not counted: the source itself says the name does not,
 * or may not, mean that species. The rule sees names only: a pair it lists may be two good species whose
 * names one taxonomy has not yet split, and a pair it does not list may still be one species.
 */
import { nameKey } from "../sources/ncbi-taxonomy";

export interface NamedSpecies {
  id: number;
  scientificName: string;
  taxid: number | null;
  refseq: string | null;
}

export interface SynonymPair {
  a: NamedSpecies;
  b: NamedSpecies;
  /** The taxonomy that treats the two names as one species. */
  by: string;
  detail: string;
}

/** Statuses of a source's synonym table that say "this name means this species". */
export const SAME_SPECIES_STATUS = new Set(["accepted name", "provisionally accepted name", "synonym"]);

export type SourceSynonyms = Map<string, Map<number, { name: string; status: string }[]>>;

const byName = (x: NamedSpecies, y: NamedSpecies) => (x.scientificName < y.scientificName ? -1 : x.scientificName > y.scientificName ? 1 : x.id - y.id);

/**
 * The pairs, each once (a before b by name), sorted by taxonomy, then by the two names.
 * `ncbiSynonyms` gives the names NCBI lists as synonyms of a species taxid.
 */
export function synonymPairs(species: NamedSpecies[], ncbiSynonyms: Map<number, string[]>, sources: SourceSynonyms): SynonymPair[] {
  const byKey = new Map<string, NamedSpecies[]>();
  for (const s of species) {
    const k = nameKey(s.scientificName);
    (byKey.get(k) ?? byKey.set(k, []).get(k)!).push(s);
  }
  const out = new Map<string, SynonymPair>();
  const add = (x: NamedSpecies, y: NamedSpecies, by: string, detail: string) => {
    if (x.id === y.id) return;
    const [a, b] = byName(x, y) <= 0 ? [x, y] : [y, x];
    const key = `${by}\u0000${a.id}\u0000${b.id}`;
    if (!out.has(key)) out.set(key, { a: a!, b: b!, by, detail });
  };

  for (const s of species) {
    if (s.taxid === null) continue;
    for (const syn of [...(ncbiSynonyms.get(s.taxid) ?? [])].sort()) {
      for (const other of byKey.get(nameKey(syn)) ?? []) {
        add(other, s, "NCBI", `NCBI lists ${other.scientificName} as a synonym of ${s.scientificName} (taxid ${s.taxid})`);
      }
    }
  }

  for (const source of sources.keys()) {
    const table = sources.get(source)!;
    for (const code of [...table.keys()].sort((x, y) => x - y)) {
      const hits = new Map<number, { species: NamedSpecies; status: string }>();
      for (const n of table.get(code)!) {
        if (!SAME_SPECIES_STATUS.has(n.status)) continue;
        for (const s of byKey.get(nameKey(n.name)) ?? []) {
          // an accepted name says more than a synonym: keep it when one name is listed twice
          const had = hits.get(s.id);
          if (!had || (had.status === "synonym" && n.status !== "synonym")) hits.set(s.id, { species: s, status: n.status });
        }
      }
      const list = [...hits.values()].sort((x, y) => byName(x.species, y.species));
      for (let i = 0; i < list.length; i++) {
        for (let j = i + 1; j < list.length; j++) {
          const [x, y] = [list[i]!, list[j]!];
          add(x.species, y.species, source, `${source} keeps both names under one species (SpecCode ${code}): ${x.species.scientificName} as ${x.status}, ${y.species.scientificName} as ${y.status}`);
        }
      }
    }
  }
  const cmp = (x: string, y: string) => (x < y ? -1 : x > y ? 1 : 0);
  return [...out.values()].sort((x, y) => cmp(x.by, y.by) || byName(x.a, y.a) || byName(x.b, y.b));
}
