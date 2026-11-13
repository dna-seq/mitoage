/**
 * Lifespan sources -> NCBI species: name matching and the per-taxon precedence rule
 * (plans/DATA_BUILD2_DECISIONS.md, section 2).
 *
 * Matching order: NCBI scientific name -> NCBI synonym / equivalent name -> the source's own
 * synonym table (FishBase, SeaLifeBase) -> binomial of a trinomial. A name that maps to several
 * species, or several source records that map to one species with equal evidence, is never
 * resolved by guessing: it is excluded and listed for review.
 */
import type { LifespanSource } from "../../src/data/schema";
import type { NcbiTaxonomy } from "../sources/ncbi-taxonomy";
import { nameKey } from "../sources/ncbi-taxonomy";
import type { SourceObservation } from "../sources/observation";

export type TaxonGroup = "bird" | "fish" | "invertebrate" | "other_vertebrate";

/** Per-taxon priority. AnAge is always first; a secondary source only fills a missing AnAge value. */
export const PRECEDENCE: Record<TaxonGroup, LifespanSource[]> = {
  fish: ["AnAge", "FishBase"],
  invertebrate: ["AnAge", "SeaLifeBase"],
  bird: ["AnAge", "EURING", "USGS_BBL"],
  other_vertebrate: ["AnAge"],
};

const lineageParts = (lineage: string) => lineage.split(/;\s*/);

/** Taxon group from a RefSeq lineage ("Eukaryota; Metazoa; Chordata; ..."). */
export function taxonGroup(lineage: string): TaxonGroup {
  const p = lineageParts(lineage);
  if (p.includes("Aves")) return "bird";
  if (/\b(Actinopterygii|Chondrichthyes|Cyclostomata|Dipnomorpha|Actinistia)\b/.test(lineage)) return "fish";
  if (!p.includes("Vertebrata")) return "invertebrate";
  return "other_vertebrate";
}

/**
 * Class in the MitoAge build 1 scheme (AnAge build 12-era labels), so correlation scopes stay
 * comparable with the 2016 paper: reptiles stay "Reptilia", ray-finned fish "Actinopterygii".
 */
export function harmonisedClass(lineage: string, ncbiClass: string): string | null {
  const p = lineageParts(lineage);
  if (p.includes("Actinopterygii")) return "Actinopterygii";
  if (["Lepidosauria", "Testudines", "Crocodylia"].some((x) => p.includes(x))) return "Reptilia";
  if (p.includes("Aves")) return "Aves";
  if (p.includes("Mammalia")) return "Mammalia";
  if (p.includes("Amphibia")) return "Amphibia";
  if (p.includes("Chondrichthyes")) return "Chondrichthyes";
  // Build 1 labels lungfish and coelacanths "Sarcopterygii", lampreys "Cephalaspidomorphi".
  if (p.includes("Dipnomorpha") || p.includes("Actinistia")) return "Sarcopterygii";
  if (p.includes("Hyperoartia")) return "Cephalaspidomorphi";
  if (p.includes("Myxini")) return "Myxini";
  return ncbiClass || null;
}

export type MatchStatus = "ok" | "ok_conflict_primary" | "conflict_secondary" | "ambiguous" | "ambiguous_many_to_one" | "unmatched";

export interface NameMatch {
  source: LifespanSource;
  sourceName: string;
  speccode: number | null;
  method: string;
  speciesTaxid: number | null;
  candidates: number[];
  status: MatchStatus;
}

const METHOD_RANK: Record<string, number> = {
  ncbi_scientific_name: 0,
  ncbi_synonym: 1,
  fishbase_synonym: 2,
  sealifebase_synonym: 2,
  binomial_of_trinomial: 3,
};

export const recKey = (source: string, name: string, speccode: number | null) => `${source}\u0000${name}\u0000${speccode ?? ""}`;

/** Name keys the matcher may look up in NCBI names (to load only those from names.dmp). */
export function wantedNameKeys(obs: SourceObservation[], synonyms: Map<string, Map<number, { name: string }[]>>): Set<string> {
  const keys = new Set<string>();
  const add = (k: string) => {
    keys.add(k);
    const w = k.split(" ");
    if (w.length >= 3) keys.add(`${w[0]} ${w[1]}`);
  };
  for (const o of obs) add(nameKey(o.sourceName));
  for (const m of synonyms.values()) for (const list of m.values()) for (const s of list) add(nameKey(s.name));
  return keys;
}

export function matchSourceNames(
  obs: SourceObservation[],
  tax: Pick<NcbiTaxonomy, "sci" | "syn">,
  synonyms: Map<string, Map<number, { name: string; status: string }[]>>,
): Map<string, NameMatch> {
  const recs = new Map<string, { source: LifespanSource; sourceName: string; speccode: number | null }>();
  for (const o of obs) {
    const k = recKey(o.source, o.sourceName, o.speccode);
    if (!recs.has(k)) recs.set(k, { source: o.source, sourceName: o.sourceName, speccode: o.speccode });
  }
  const out = new Map<string, NameMatch>();
  for (const [key, r] of recs) {
    const k = nameKey(r.sourceName);
    let res: { method: string; cands: number[] } | null = null;
    if (tax.sci.has(k)) res = { method: "ncbi_scientific_name", cands: tax.sci.get(k)! };
    else if (tax.syn.has(k)) res = { method: "ncbi_synonym", cands: tax.syn.get(k)! };
    const table = synonyms.get(r.source);
    if (!res && table && r.speccode !== null) {
      const hits = new Map<string, Set<number>>();
      for (const s of table.get(r.speccode) ?? []) {
        const sk = nameKey(s.name);
        if (s.status === "misapplied name" || sk === k) continue;
        const c = tax.sci.get(sk);
        if (!c) continue;
        const set = hits.get(s.status) ?? new Set<number>();
        for (const t of c) set.add(t);
        hits.set(s.status, set);
      }
      const good = new Set<number>();
      for (const st of ["synonym", "accepted name", "provisionally accepted name"]) for (const t of hits.get(st) ?? []) good.add(t);
      const src = r.source.toLowerCase();
      if (good.size) res = { method: `${src}_synonym`, cands: [...good].sort((a, b) => a - b) };
      else if (hits.get("ambiguous synonym")?.size) {
        res = { method: `${src}_ambiguous_synonym`, cands: [...hits.get("ambiguous synonym")!].sort((a, b) => a - b) };
      }
    }
    if (!res) {
      const w = k.split(" ");
      const bin = `${w[0]} ${w[1]}`;
      if (w.length >= 3 && tax.sci.has(bin)) res = { method: "binomial_of_trinomial", cands: tax.sci.get(bin)! };
    }
    if (!res) {
      out.set(key, { ...r, method: "unmatched", speciesTaxid: null, candidates: [], status: "unmatched" });
      continue;
    }
    const ok = res.cands.length === 1 && !res.method.includes("ambiguous");
    out.set(key, { ...r, method: res.method, speciesTaxid: ok ? res.cands[0]! : null, candidates: res.cands, status: ok ? "ok" : "ambiguous" });
  }
  // Several records of one source on one species: the strictly best method wins, the rest are
  // secondary; a tie is ambiguous for all of them.
  const groups = new Map<string, NameMatch[]>();
  for (const m of out.values()) {
    if (m.status !== "ok") continue;
    const g = `${m.source}\u0000${m.speciesTaxid}`;
    (groups.get(g) ?? groups.set(g, []).get(g)!).push(m);
  }
  for (const g of groups.values()) {
    if (g.length <= 1) continue;
    const best = Math.min(...g.map((m) => METHOD_RANK[m.method] ?? 9));
    const top = g.filter((m) => (METHOD_RANK[m.method] ?? 9) === best);
    if (top.length === 1) {
      for (const m of g) m.status = m === top[0] ? "ok_conflict_primary" : "conflict_secondary";
    } else {
      for (const m of g) m.status = "ambiguous_many_to_one";
    }
  }
  return out;
}

export const usable = (m: NameMatch | undefined) => !!m && (m.status === "ok" || m.status === "ok_conflict_primary");

export interface MatchedObservation extends SourceObservation {
  speciesTaxid: number;
  matchMethod: string;
}

/**
 * The chosen maximum lifespan for one species from its matched observations (any order; the
 * order of `obs` breaks ties). AnAge first; otherwise the taxon's secondary sources in priority
 * order, each preferring reported values of acceptable quality, then reported questionable values,
 * then estimates; within a tier the maximum. SeaLifeBase only counts for aquatic species. Equal
 * maxima: a value with a stated specimen origin (wild, captive) is preferred over one without
 * (observed), then the first in `obs` order.
 */
export function chooseLifespan(obs: MatchedObservation[], group: TaxonGroup): MatchedObservation | null {
  const withValue = obs.filter((o) => o.valueYears !== null);
  const anage = withValue.find((o) => o.source === "AnAge");
  if (anage) return anage;
  for (const src of PRECEDENCE[group]) {
    if (src === "AnAge") continue;
    let h = withValue.filter((o) => o.source === src);
    if (src === "SeaLifeBase") h = h.filter((o) => o.aquatic === true);
    if (h.length === 0) continue;
    for (const sel of [
      (o: MatchedObservation) => o.recordType !== "estimated" && o.quality !== "questionable",
      (o: MatchedObservation) => o.recordType !== "estimated",
      (o: MatchedObservation) => o.recordType === "estimated",
    ]) {
      const hh = h.filter(sel);
      if (hh.length === 0) continue;
      let best = hh[0]!;
      for (const o of hh) {
        const tieWithOrigin = o.valueYears === best.valueYears && best.recordType === "observed" && o.recordType !== "observed";
        if (o.valueYears! > best.valueYears! || tieWithOrigin) best = o;
      }
      return best;
    }
  }
  return null;
}
