/**
 * Reading the complexes file for the pages under /complexes/: counts per subunit and per pair of
 * subunits. Pure functions over the data, so they are tested without a build.
 */
import type { Complex, ComplexGeneSites, SiteGroup } from "../../pipeline/complexes";

export interface GeneSummary {
  gene: string;
  residues: number;
  /** Residues that touch a nuclear subunit. */
  contact: number;
  /** Mean share of species carrying the human residue, per group; null for an empty group. */
  identity: Record<SiteGroup, number | null>;
}

const mean = (xs: number[]): number | null => (xs.length === 0 ? null : xs.reduce((a, b) => a + b, 0) / xs.length);

export function summariseGene(g: ComplexGeneSites): GeneSummary {
  const of = (group: SiteGroup) => g.sites.filter((s) => s.group === group);
  return {
    gene: g.gene,
    residues: g.sites.length,
    contact: of("contact").length,
    identity: {
      contact: mean(of("contact").map((s) => s.identity)),
      control: mean(of("control").map((s) => s.identity)),
      other: mean(of("other").map((s) => s.identity)),
    },
  };
}

/** How many residues of each mitochondrial subunit touch each nuclear subunit. A residue touching two is counted for both. */
export function contactMatrix(complex: Complex): { genes: string[]; partners: string[]; count: (gene: string, partner: string) => number } {
  const counts = new Map<string, number>();
  for (const g of complex.sites ?? []) {
    for (const s of g.sites) for (const p of s.partners) counts.set(`${g.gene}|${p}`, (counts.get(`${g.gene}|${p}`) ?? 0) + 1);
  }
  const genes = (complex.sites ?? []).map((g) => g.gene);
  // nuclear subunits in the order of the chains table, those without any contact included
  const partners = complex.chains.filter((c) => !c.mitochondrial).map((c) => c.gene);
  return { genes, partners, count: (gene, partner) => counts.get(`${gene}|${partner}`) ?? 0 };
}

/** The residues of one mitochondrial subunit that touch one nuclear subunit, along the chain. */
export function contactsWith(g: ComplexGeneSites, partner: string) {
  return g.sites.filter((s) => s.partners.includes(partner));
}
