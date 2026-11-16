/**
 * Possible duplicate species by sequence: two species of one genus whose mitochondrial protein genes are
 * nearly the same letters. Such a pair is one of three things, which the sequence alone does not tell apart:
 * one species under two names, a record filed under the wrong species, or two real species that share a
 * mitochondrial lineage (recent divergence, hybridisation). So this reports and never merges.
 */

/** Share of identical letters over the columns where both sequences have a base (no gap, no N). */
export function identity(a: string, b: string): { sites: number; identity: number | null } {
  if (a.length !== b.length) throw new Error(`aligned sequences differ in length: ${a.length} and ${b.length}`);
  let sites = 0;
  let same = 0;
  for (let i = 0; i < a.length; i++) {
    const x = a.charCodeAt(i) & ~32; // upper case
    const y = b.charCodeAt(i) & ~32;
    if (x !== 65 && x !== 67 && x !== 71 && x !== 84) continue; // A C G T only
    if (y !== 65 && y !== 67 && y !== 71 && y !== 84) continue;
    sites++;
    if (x === y) same++;
  }
  return { sites, identity: sites ? same / sites : null };
}

export interface DuplicateInput {
  slug: string;
  scientificName: string;
  genus: string;
  refseq: string;
  /** The species' aligned genes, concatenated in one fixed order; null when it has no alignment. */
  sequence: string | null;
}

export interface NearIdenticalPair {
  a: DuplicateInput;
  b: DuplicateInput;
  sites: number;
  identity: number;
}

export interface NearIdenticalResult {
  pairs: NearIdenticalPair[];
  /** Pairs of one genus compared. */
  compared: number;
  /** Pairs of one genus that could not be judged: a sequence missing, or fewer than `minSites` shared bases. */
  notJudged: number;
}

/**
 * Every pair of species of one genus at or above `minIdentity` over at least `minSites` shared bases.
 * Pairs are ordered by identity, highest first, then by name; within a pair `a` is the earlier name.
 */
export function nearIdenticalPairs(species: DuplicateInput[], minIdentity: number, minSites: number): NearIdenticalResult {
  const byGenus = new Map<string, DuplicateInput[]>();
  for (const s of species) {
    if (!s.genus) continue;
    byGenus.set(s.genus, [...(byGenus.get(s.genus) ?? []), s]);
  }
  const pairs: NearIdenticalPair[] = [];
  let compared = 0;
  let notJudged = 0;
  for (const genus of [...byGenus.keys()].sort()) {
    const list = [...byGenus.get(genus)!].sort((x, y) => x.scientificName.localeCompare(y.scientificName) || x.slug.localeCompare(y.slug));
    for (let i = 0; i < list.length; i++) {
      for (let j = i + 1; j < list.length; j++) {
        compared++;
        const a = list[i]!;
        const b = list[j]!;
        if (a.sequence === null || b.sequence === null) {
          notJudged++;
          continue;
        }
        const r = identity(a.sequence, b.sequence);
        if (r.identity === null || r.sites < minSites) {
          notJudged++;
          continue;
        }
        if (r.identity >= minIdentity) pairs.push({ a, b, sites: r.sites, identity: r.identity });
      }
    }
  }
  pairs.sort((x, y) => y.identity - x.identity || x.a.scientificName.localeCompare(y.a.scientificName) || x.b.scientificName.localeCompare(y.b.scientificName));
  return { pairs, compared, notJudged };
}
