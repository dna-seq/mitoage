/**
 * The complexes section's data: `bun run complexes` reads the per-residue table of complex IV and the
 * chains of the solved structures (docs/analyses/cluster-2026-11-15/, made by `mitoage mitoport burial`
 * of dna-seq/mitoage-pipelines and copied here byte for byte, see that folder's README) and writes
 * src/data/generated/complexes.json, which the pages under /complexes/ read at build time.
 *
 * Only complex IV has a per-residue table. Nothing is filled in for the others: a complex without a
 * table has its chains listed and `sites: null`.
 */
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const ROOT = join(import.meta.dir, "..");
export const SOURCE_DIR = join(ROOT, "docs", "analyses", "cluster-2026-11-15");
const OUT = join(ROOT, "src", "data", "generated", "complexes.json");

/** contact: touches a nuclear subunit; control: as buried, touching none (matched one to one); other: the rest. */
export type SiteGroup = "contact" | "control" | "other";

export interface ComplexSite {
  /** Position in the human protein, 1-based; equal to the residue number in the structure. */
  pos: number;
  /** One-letter residue in human. */
  aa: string;
  /** Column of the gene's protein alignment, 1-based. */
  column: number;
  group: SiteGroup;
  /** Nuclear subunits within 4.5 angstrom, by gene symbol; empty unless group is contact. */
  partners: string[];
  /** Relative solvent accessibility inside the assembled complex, 0 to 1 and above. */
  accessibility: number;
  /** Share of the species with a residue in this column that carry the human one. */
  identity: number;
  /** Share of species with a residue in this column. */
  occupancy: number;
}

export interface ComplexChain {
  gene: string;
  pdb: string;
  chain: string;
  residues: number;
  mitochondrial: boolean;
  description: string;
}

export interface ComplexGeneSites {
  gene: string;
  sites: ComplexSite[];
}

export interface Complex {
  id: string;
  name: string;
  /** PDB entry the chains and the sites are read from. */
  pdb: string;
  chains: ComplexChain[];
  /** Per-residue rows of the mitochondrial subunits, or null where no table exists. */
  sites: ComplexGeneSites[] | null;
}

export interface ComplexesFile {
  source: string;
  contactCutoffAngstrom: number;
  complexes: Complex[];
}

export function parseTsv(text: string): Record<string, string>[] {
  const lines = text.split("\n").filter((l) => l.length > 0);
  const header = (lines[0] ?? "").split("\t");
  return lines.slice(1).map((line, i) => {
    const cells = line.split("\t");
    if (cells.length !== header.length) throw new Error(`row ${i + 2}: ${cells.length} cells, the header has ${header.length}`);
    return Object.fromEntries(header.map((h, j) => [h, cells[j] ?? ""]));
  });
}

function str(row: Record<string, string>, key: string, where: string): string {
  const v = row[key];
  if (v === undefined) throw new Error(`${where}: no column ${key}`);
  return v;
}

function num(row: Record<string, string>, key: string, where: string): number {
  const raw = str(row, key, where);
  const v = Number(raw);
  if (raw === "" || !Number.isFinite(v)) throw new Error(`${where}: ${key} is not a number (${JSON.stringify(raw)})`);
  return v;
}

const GROUPS: readonly string[] = ["contact", "control", "other"];

export function sitesOf(rows: Record<string, string>[]): ComplexGeneSites[] {
  const byGene = new Map<string, ComplexSite[]>();
  for (const [i, r] of rows.entries()) {
    const where = `SITES row ${i + 2}`;
    const group = str(r, "group", where);
    const gene = str(r, "gene", where);
    const named = str(r, "partners", where);
    if (!GROUPS.includes(group)) throw new Error(`${where}: unknown group ${JSON.stringify(group)}`);
    const partners = named === "" ? [] : named.split(",").map((p) => p.trim());
    if ((group === "contact") !== partners.length > 0) throw new Error(`${where}: group ${group} with partners ${JSON.stringify(named)}`);
    const site: ComplexSite = {
      pos: num(r, "human_pos", where),
      aa: str(r, "human_aa", where),
      column: num(r, "aln_col", where),
      group: group as SiteGroup,
      partners,
      accessibility: num(r, "rasa_complex", where),
      identity: num(r, "identity_to_human", where),
      occupancy: num(r, "occupancy", where),
    };
    if (!byGene.has(gene)) byGene.set(gene, []);
    byGene.get(gene)!.push(site);
  }
  // order is load-bearing for the page: genes by name, residues along the chain
  return [...byGene.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([gene, sites]) => ({ gene, sites: sites.sort((a, b) => a.pos - b.pos) }));
}

/** Which complex a solved entry is, and what it is called. Entries of the chains table not listed here are refused. */
const ENTRIES: Record<string, { id: string; name: string }> = {
  "5XTD": { id: "i", name: "Complex I (NADH:ubiquinone oxidoreductase)" },
  "5XTE": { id: "iii", name: "Complex III (cytochrome bc1)" },
  "5Z62": { id: "iv", name: "Complex IV (cytochrome c oxidase)" },
  "8H9S": { id: "v", name: "Complex V (ATP synthase)" },
};
const ORDER = ["i", "iii", "iv", "v"];

export function complexesOf(chainRows: Record<string, string>[], siteRows: Record<string, string>[]): Complex[] {
  const byPdb = new Map<string, ComplexChain[]>();
  for (const [i, r] of chainRows.entries()) {
    const where = `CHAINS row ${i + 2}`;
    const pdb = str(r, "pdb", where);
    if (!(pdb in ENTRIES)) throw new Error(`${where}: no complex is known for PDB entry ${pdb}`);
    if (!byPdb.has(pdb)) byPdb.set(pdb, []);
    byPdb.get(pdb)!.push({
      gene: str(r, "gene", where), pdb, chain: str(r, "chain", where), residues: num(r, "residues", where),
      mitochondrial: str(r, "mt", where) === "1", description: str(r, "description", where),
    });
  }
  const sites = sitesOf(siteRows);
  const complexes = [...byPdb.entries()].map(([pdb, chains]) => {
    const mt = new Set(chains.filter((c) => c.mitochondrial).map((c) => c.gene));
    const own = sites.filter((s) => mt.has(s.gene));
    for (const s of own) {
      const chain = chains.find((c) => c.gene === s.gene)!;
      if (s.sites.length !== chain.residues) throw new Error(`${s.gene}: ${s.sites.length} sites, its chain has ${chain.residues} residues`);
    }
    // mitochondrial subunits first, then nuclear, each by gene symbol
    chains.sort((a, b) => Number(b.mitochondrial) - Number(a.mitochondrial) || a.gene.localeCompare(b.gene, "en", { numeric: true }));
    return { ...ENTRIES[pdb]!, pdb, chains, sites: own.length > 0 ? own : null };
  });
  const placed = new Set(complexes.flatMap((c) => c.sites?.map((s) => s.gene) ?? []));
  for (const s of sites) if (!placed.has(s.gene)) throw new Error(`sites of ${s.gene} belong to no chain of the chains table`);
  return complexes.sort((a, b) => ORDER.indexOf(a.id) - ORDER.indexOf(b.id));
}

if (import.meta.main) {
  const chains = parseTsv(readFileSync(join(SOURCE_DIR, "CHAINS.tsv"), "utf8"));
  const sites = parseTsv(readFileSync(join(SOURCE_DIR, "SITES.tsv"), "utf8"));
  const file: ComplexesFile = {
    source: "docs/analyses/cluster-2026-11-15 (SITES.tsv, CHAINS.tsv)",
    contactCutoffAngstrom: 4.5,
    complexes: complexesOf(chains, sites),
  };
  writeFileSync(OUT, `${JSON.stringify(file)}\n`);
  for (const c of file.complexes) {
    const n = c.sites?.reduce((a, g) => a + g.sites.length, 0);
    console.log(`${c.name} (${c.pdb}): ${c.chains.length} chains${n === undefined ? ", no per-residue table" : `, ${n} residues with sites`}`);
  }
}
