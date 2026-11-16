/**
 * The coevolution tables of mitoage-pipelines as the site shows them (D20): the three per-protein tables
 * joined by gene, medians per group of proteins, and each species' contact-pair discordance with its class's
 * mean. Pure functions over the rows of public/data/mitoport/ (src/data/mitoport.ts reads them).
 */

type Rec = Record<string, unknown>;

const num = (v: unknown): number | null => (typeof v === "number" && Number.isFinite(v) ? v : null);
const str = (v: unknown, what: string): string => {
  if (typeof v !== "string" || !v) throw new Error(`mitoport: ${what} is missing`);
  return v;
};

/** The groups of proteins, in the order the page lists them. coupling.tsv names complex IV's nuclear subunits "complex IV partner". */
export const PROTEIN_GROUPS = [
  { key: "complex IV nuclear", label: "Complex IV nuclear" },
  { key: "complex III nuclear", label: "Complex III nuclear" },
  { key: "cytochrome c", label: "Cytochrome c" },
  { key: "complex II (no mt subunit)", label: "Complex II" },
  { key: "matrix, not respiratory", label: "Matrix enzymes" },
  { key: "cytosolic control", label: "Cytosolic controls" },
] as const;

const GROUP_ALIASES: Record<string, string> = { "complex IV partner": "complex IV nuclear" };
export const groupKey = (g: string): string => GROUP_ALIASES[g] ?? g;
export const groupLabel = (g: string): string => PROTEIN_GROUPS.find((x) => x.key === g)?.label ?? g;
const groupRank = (g: string): number => {
  const i = PROTEIN_GROUPS.findIndex((x) => x.key === g);
  return i < 0 ? PROTEIN_GROUPS.length : i;
};

export interface ProteinRow {
  gene: string;
  group: string;
  /** erc.tsv: correlation over branches of the protein's relative rate with complex IV's and III's mitochondrial subunits. */
  ercIV: number | null;
  ercIII: number | null;
  /** coembed.tsv: species, and the partial correlation of embedding distances with each complex's mitochondrial subunits. */
  coembedSpecies: number | null;
  coembedIV: number | null;
  coembedIII: number | null;
  coembedI: number | null;
  coembedV: number | null;
  /** iface/coupling.tsv: species, and the coupling of the protein's interface with COX1-3 contacts, and its excess over the controls. */
  couplingSpecies: number | null;
  seqContact: number | null;
  seqExcessMt: number | null;
  esmContact: number | null;
  esmExcessMt: number | null;
  /** Which of the three tables have the protein. */
  inErc: boolean;
  inCoembed: boolean;
  inCoupling: boolean;
}

/**
 * One row per protein of any of the three tables, joined by gene. Refuses a gene listed twice in one table or
 * placed in different groups by two tables (after the coupling table's alias), so a join never mixes proteins.
 */
export function joinProteins(erc: Rec[], coembed: Rec[], coupling: Rec[]): ProteinRow[] {
  const index = (rows: Rec[], name: string) => {
    const m = new Map<string, Rec>();
    for (const r of rows) {
      const g = str(r["gene"], `${name}: gene`);
      if (m.has(g)) throw new Error(`mitoport: ${name} lists ${g} twice`);
      m.set(g, r);
    }
    return m;
  };
  const e = index(erc, "erc");
  const c = index(coembed, "coembed");
  const k = index(coupling, "coupling");
  const genes = [...new Set([...e.keys(), ...c.keys(), ...k.keys()])];
  const rows = genes.map((gene): ProteinRow => {
    const er = e.get(gene);
    const cr = c.get(gene);
    const kr = k.get(gene);
    const groups = new Set([er, cr, kr].filter((r): r is Rec => !!r).map((r) => groupKey(str(r["group"], `${gene}: group`))));
    if (groups.size !== 1) throw new Error(`mitoport: ${gene} is in different groups in different tables (${[...groups].join(", ")})`);
    return {
      gene,
      group: [...groups][0]!,
      ercIV: num(er?.["B_complex_IV"]),
      ercIII: num(er?.["B_complex_III"]),
      coembedSpecies: num(cr?.["species"]),
      coembedIV: num(cr?.["IV"]),
      coembedIII: num(cr?.["III"]),
      coembedI: num(cr?.["I"]),
      coembedV: num(cr?.["V"]),
      couplingSpecies: num(kr?.["species"]),
      seqContact: num(kr?.["seq_contact_iface"]),
      seqExcessMt: num(kr?.["seq_excess_mt"]),
      esmContact: num(kr?.["esm_contact_iface"]),
      esmExcessMt: num(kr?.["esm_excess_mt"]),
      inErc: !!er,
      inCoembed: !!cr,
      inCoupling: !!kr,
    };
  });
  return rows.sort((a, b) => groupRank(a.group) - groupRank(b.group) || a.group.localeCompare(b.group) || a.gene.localeCompare(b.gene));
}

/** Median of the non-null values, with how many there were; null when there are none. */
export function median(values: readonly (number | null)[]): { n: number; median: number | null } {
  const v = values.filter((x): x is number => x !== null).sort((a, b) => a - b);
  if (!v.length) return { n: 0, median: null };
  const m = v.length >> 1;
  return { n: v.length, median: v.length % 2 ? v[m]! : (v[m - 1]! + v[m]!) / 2 };
}

export type GroupedKey = "ercIV" | "coembedIV" | "seqContact" | "seqExcessMt";

export interface GroupSummary {
  group: string;
  proteins: number;
  medians: Record<GroupedKey, { n: number; median: number | null }>;
}

/** Per group of proteins, in page order: how many proteins, and the median of the columns the page summarises. */
export function groupSummaries(rows: readonly ProteinRow[]): GroupSummary[] {
  const groups = [...new Set(rows.map((r) => r.group))];
  return groups.map((group) => {
    const g = rows.filter((r) => r.group === group);
    const pick = (k: GroupedKey) => median(g.map((r) => r[k]));
    return { group, proteins: g.length, medians: { ercIV: pick("ercIV"), coembedIV: pick("coembedIV"), seqContact: pick("seqContact"), seqExcessMt: pick("seqExcessMt") } };
  });
}

export interface SpeciesDiscordance {
  slug: string;
  class: string;
  /** Share of contact (and control) pairs where exactly one side differs from the class consensus; null when not scored. */
  contact: number | null;
  contactPairs: number;
  control: number | null;
  controlPairs: number;
  contactMinusControl: number | null;
}

/** partners_species rows, typed. Refuses a species listed twice. */
export function readDiscordance(rows: Rec[]): SpeciesDiscordance[] {
  const seen = new Set<string>();
  return rows.map((r) => {
    const slug = str(r["slug"], "partners_species: slug");
    if (seen.has(slug)) throw new Error(`mitoport: partners_species lists ${slug} twice`);
    seen.add(slug);
    const pairs = (k: string) => {
      const v = num(r[k]);
      if (v === null) throw new Error(`mitoport: ${slug} has no ${k}`);
      return v;
    };
    return {
      slug,
      class: str(r["class"], `${slug}: class`),
      contact: num(r["contact"]),
      contactPairs: pairs("contact_pairs"),
      control: num(r["control"]),
      controlPairs: pairs("control_pairs"),
      contactMinusControl: num(r["contact_minus_control"]),
    };
  });
}

export interface ClassDiscordance {
  class: string;
  species: number;
  scored: number;
  meanContact: number | null;
  meanControl: number | null;
}

const mean = (v: number[]): number | null => (v.length ? v.reduce((a, b) => a + b, 0) / v.length : null);

/** Per class: species listed, species scored, and the mean discordance at contact and control pairs over the scored ones. */
export function classDiscordance(rows: readonly SpeciesDiscordance[]): ClassDiscordance[] {
  const classes = [...new Set(rows.map((r) => r.class))];
  return classes.map((cls) => {
    const c = rows.filter((r) => r.class === cls);
    const scored = c.filter((r) => r.contact !== null && r.control !== null);
    return {
      class: cls,
      species: c.length,
      scored: scored.length,
      meanContact: mean(scored.map((r) => r.contact!)),
      meanControl: mean(scored.map((r) => r.control!)),
    };
  });
}
