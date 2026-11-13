/**
 * NCBI Taxonomy new_taxdump (pinned, 2026-11-13): node ranks and parents, merged taxids,
 * ranked lineages and names (scientific names, synonyms, common names), restricted to Metazoa.
 */
import { forEachLine } from "../lib/parquet";
import { NCBI_TAXONOMY, requirePinned } from "./pinned";

export const METAZOA = 33208;
const SCI_CLASSES = new Set(["scientific name"]);
const SYN_CLASSES = new Set(["synonym", "equivalent name", "genbank synonym"]);

export interface Lineage {
  name: string;
  species: string;
  genus: string;
  family: string;
  order: string;
  class: string;
  phylum: string;
  kingdom: string;
}

export interface TaxonNames {
  scientific: string | null;
  synonyms: string[];
  genbankCommon: string | null;
}

/** Name key used for matching: no parenthesised parts or quotes, single spaces, lower case. */
export function nameKey(s: string): string {
  return s
    .replace(/\([^)]*\)/g, " ")
    .replace(/[\u2018\u2019'"]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

const fields = (line: string) => line.replace(/\t\|$/, "").split("\t|\t");

export class NcbiTaxonomy {
  readonly version = NCBI_TAXONOMY.version;
  private parent: Int32Array;
  private isSpeciesRank: Uint8Array;
  private rankOf = new Map<number, string>();
  private spAnc: Int32Array; // -1 unknown, 0 none
  private meta: Int8Array; // 0 unknown, 1 metazoa, 2 not
  readonly merged = new Map<number, number>();
  private lineages = new Map<number, Lineage>();
  /** name key -> sorted species taxids, for scientific names and for synonyms. */
  readonly sci = new Map<string, number[]>();
  readonly syn = new Map<string, number[]>();
  private names = new Map<number, TaxonNames>();

  private constructor(size: number) {
    this.parent = new Int32Array(size);
    this.isSpeciesRank = new Uint8Array(size);
    this.spAnc = new Int32Array(size).fill(-1);
    this.meta = new Int8Array(size);
  }

  static async load(): Promise<NcbiTaxonomy> {
    const dir = requirePinned(NCBI_TAXONOMY);
    const nodes: [number, number, string][] = [];
    let max = 0;
    await forEachLine(`${dir}/nodes.dmp`, (line) => {
      if (!line) return;
      const f = fields(line);
      const t = Number(f[0]);
      nodes.push([t, Number(f[1]), f[2]!]);
      if (t > max) max = t;
    });
    const tx = new NcbiTaxonomy(max + 1);
    for (const [t, p, r] of nodes) {
      tx.parent[t] = p;
      if (r === "species") tx.isSpeciesRank[t] = 1;
      if (r !== "species" && r !== "no rank") tx.rankOf.set(t, r);
    }
    await forEachLine(`${dir}/merged.dmp`, (line) => {
      if (!line) return;
      const f = fields(line);
      tx.merged.set(Number(f[0]), Number(f[1]));
    });
    return tx;
  }

  exists(t: number): boolean {
    return t > 0 && t < this.parent.length && this.parent[t] !== 0;
  }

  /** The current taxid (follows merged.dmp). */
  current(t: number): number {
    return this.merged.get(t) ?? t;
  }

  rank(t: number): string {
    if (!this.exists(t)) return "unknown";
    return this.isSpeciesRank[t] ? "species" : (this.rankOf.get(t) ?? "no rank");
  }

  isMetazoa(t: number): boolean {
    if (!this.exists(t)) return false;
    if (this.meta[t]) return this.meta[t] === 1;
    const path: number[] = [];
    let x = t;
    let result = 2;
    while (true) {
      if (this.meta[x]) {
        result = this.meta[x]!;
        break;
      }
      path.push(x);
      if (x === METAZOA) {
        result = 1;
        break;
      }
      const p = this.parent[x]!;
      if (p === x || p === 0) {
        result = 2;
        break;
      }
      x = p;
    }
    for (const y of path) this.meta[y] = result;
    return result === 1;
  }

  /** Nearest species-rank ancestor (or self) of a Metazoa taxon; null above species rank or outside Metazoa. */
  speciesOf(t0: number): number | null {
    const t = this.current(t0);
    if (!this.isMetazoa(t)) return null;
    const path: number[] = [];
    let x = t;
    let found = 0;
    while (true) {
      const memo = this.spAnc[x]!;
      if (memo >= 0) {
        found = memo;
        break;
      }
      path.push(x);
      if (this.isSpeciesRank[x]) {
        found = x;
        break;
      }
      const p = this.parent[x]!;
      if (x === METAZOA || p === x || p === 0) {
        found = 0;
        break;
      }
      x = p;
    }
    // The walk stops at the first species-rank node, so every node on the path shares the answer.
    for (const y of path) this.spAnc[y] = found;
    return found || null;
  }

  /** Read rankedlineage.dmp for the given taxids. */
  async loadLineages(taxids: Set<number>): Promise<void> {
    const dir = requirePinned(NCBI_TAXONOMY);
    await forEachLine(`${dir}/rankedlineage.dmp`, (line) => {
      const tab = line.indexOf("\t");
      if (tab < 0) return;
      const t = Number(line.slice(0, tab));
      if (!taxids.has(t)) return;
      const f = fields(line);
      this.lineages.set(t, {
        name: f[1]!, species: f[2]!, genus: f[3]!, family: f[4]!, order: f[5]!, class: f[6]!, phylum: f[7]!, kingdom: f[8]!,
      });
    });
  }

  lineage(t: number): Lineage | undefined {
    return this.lineages.get(t);
  }

  /**
   * Read names.dmp: the matching indexes (restricted to the given name keys, Metazoa taxa at or
   * below species rank, mapped to their species taxid) and the full name lists of some taxids.
   */
  async loadNames(keys: Set<string>, taxids: Set<number>): Promise<void> {
    const dir = requirePinned(NCBI_TAXONOMY);
    const sci = new Map<string, Set<number>>();
    const syn = new Map<string, Set<number>>();
    await forEachLine(`${dir}/names.dmp`, (line) => {
      if (!line) return;
      const f = fields(line);
      const t = Number(f[0]);
      const name = f[1]!;
      const cls = f[3]!;
      if (taxids.has(t)) {
        const n = this.names.get(t) ?? { scientific: null, synonyms: [], genbankCommon: null };
        if (cls === "scientific name") n.scientific = name;
        else if (SYN_CLASSES.has(cls)) n.synonyms.push(name);
        else if (cls === "genbank common name" && n.genbankCommon === null) n.genbankCommon = name;
        this.names.set(t, n);
      }
      const isSci = SCI_CLASSES.has(cls);
      if (!isSci && !SYN_CLASSES.has(cls)) return;
      const k = nameKey(name);
      if (!keys.has(k)) return;
      const sp = this.speciesOf(t);
      if (sp === null) return;
      const m = isSci ? sci : syn;
      (m.get(k) ?? m.set(k, new Set()).get(k)!).add(sp);
    });
    for (const [src, dst] of [[sci, this.sci], [syn, this.syn]] as const) {
      for (const [k, v] of src) dst.set(k, [...v].sort((a, b) => a - b));
    }
  }

  taxonNames(t: number): TaxonNames | undefined {
    return this.names.get(t);
  }
}
