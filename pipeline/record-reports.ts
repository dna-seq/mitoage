/**
 * `bun run record-reports`: drafts of the reports on RefSeq records the audit found wrong (RM25), one per record,
 * with the evidence in a form a curator can check. It writes docs/analyses/record-reports/{REPORTS.md,REPORTS.tsv}
 * from the list of audited records (pipeline/curation/sequence-audit.ts) and the screen against independent
 * sequences (docs/analyses/independent-screen/COMPARISONS.tsv). It sends nothing: sending is the maintainer's.
 *
 * A record gets a draft when its finding names a wrong or doubtful sequence and rests on independent sequences
 * of the named species or on a published list. A finding that rests only on another RefSeq record, or on the
 * record's own header, and a group of records whose right name is not settled, are listed as not drafted, each
 * with the reason.
 */
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { getAllSpecies } from "../src/data";
import { SEQUENCE_AUDIT, type SequenceFinding, type SequenceFindingKind } from "./curation/sequence-audit";
import { readComparisons, type Comparison } from "./screen";

const ROOT = join(import.meta.dir, "..");
const SCREEN = join(ROOT, "docs", "analyses", "independent-screen", "COMPARISONS.tsv");
const OUT_DIR = join(ROOT, "docs", "analyses", "record-reports");

export type Basis = "independent_sequences" | "published";

/** What a finding's evidence rests on, read from its own words; empty when on neither. */
export function basis(evidence: string): Basis[] {
  const out: Basis[] = [];
  if (/independent (\w+ )?sequences/.test(evidence)) out.push("independent_sequences");
  if (/on the list of|published/.test(evidence)) out.push("published");
  return out;
}

const SAYS: Record<SequenceFindingKind, string> = {
  other_species: "the record's protein genes are another species' than the one it is named for",
  chimera: "the record joins genes of two unrelated species",
  one_genome_names: "two or more species carry the same genome",
  truncated: "the record is not a complete genome although it stands as one",
  sequence_errors: "sequencing errors or nuclear copies are reported for the record, or genes do not translate as annotated",
  specimen_doubt: "the record's own qualifiers name another species' breed or form",
};

const ASKS: Partial<Record<SequenceFindingKind, string>> = {
  other_species: "that the organism of the record is reviewed against the sequences named here, and the record renamed or withdrawn as the species' reference",
  chimera: "that the record is reviewed gene by gene, and withdrawn as the species' reference if the mix is confirmed",
  sequence_errors: "that the record is reviewed against the report named here, and a note placed on it or another record chosen as the species' reference",
};

const OWN = "the finding is read from the record itself; not in the first group of reports";

/** null when the finding gets a draft; else why it does not. */
export function notDrafted(f: SequenceFinding): string | null {
  if (f.kind === "one_genome_names") return "which of the names is right is not settled";
  if (ASKS[f.kind] === undefined) return OWN;
  if (basis(f.evidence).length === 0) return "the evidence is the record itself or other RefSeq records: no independent sequence and no published list";
  return null;
}

export interface Report {
  finding: SequenceFinding;
  /** The species that carries the record in the build; null when no species does now. */
  species: { slug: string; name: string; cls: string; live: boolean } | null;
  basis: Basis[];
  reason: string | null;
  /** The screen's rows of the record, the named species first. */
  screen: Comparison[];
}

export function reports(): Report[] {
  const species = new Map(getAllSpecies().map((s) => [s.refseq, s]));
  const rows = readComparisons(readFileSync(SCREEN, "utf8"));
  const bySlug = new Map<string, Comparison[]>();
  for (const r of rows) bySlug.set(r.slug, [...(bySlug.get(r.slug) ?? []), r]);
  return SEQUENCE_AUDIT.map((finding) => {
    const s = species.get(finding.refseq);
    const screen = [...(s ? bySlug.get(s.slug) ?? [] : [])].sort((a, b) =>
      a.gene !== b.gene ? (a.gene < b.gene ? -1 : 1) : a.own !== b.own ? (a.own ? -1 : 1) : a.target < b.target ? -1 : a.target > b.target ? 1 : 0);
    return {
      finding,
      species: s ? { slug: s.slug, name: s.scientificName, cls: s.taxonomy.class, live: (s.retiredReason ?? null) === null } : null,
      basis: basis(finding.evidence),
      reason: notDrafted(finding),
      screen,
    };
  }).sort((a, b) => (a.finding.refseq < b.finding.refseq ? -1 : a.finding.refseq > b.finding.refseq ? 1 : 0));
}

const pct = (v: number) => (v * 100).toFixed(2);

export function draft(r: Report, names: Map<string, string>): string {
  const f = r.finding;
  const who = r.species ? `*${r.species.name}* (${r.species.cls})` : "no species of the database carries this record now";
  const lines = [`### ${f.refseq}, ${who}`, "", `- Finding: ${SAYS[f.kind]}.`, `- Evidence: ${f.evidence}.`, `- Asked: ${ASKS[f.kind]}.`,
    `- Rests on: ${r.basis.map((b) => (b === "published" ? "a published report" : "independent sequences of the named species")).join(", ")}.`];
  const read = r.screen.filter((c) => c.stat);
  if (read.length) {
    lines.push("", "COX1 and CYTB of the record against independent GenBank sequences (whole genomes and RefSeq left out):", "",
      "| gene | sequences of | read | median identity, % | highest, % | lowest, % | closest sequence |", "|---|---|---|---|---|---|---|");
    for (const c of read) lines.push(`| ${c.gene} | ${names.get(c.target) ?? c.target}${c.own ? " (the named species)" : ""} | ${c.comparable} of ${c.fetched} | ${pct(c.stat!.median)} | ${pct(c.stat!.max)} | ${pct(c.stat!.min)} | ${c.best} |`);
  } else if (r.species && !r.species.live) {
    lines.push("", "The record's species is retired from the database, so the screen did not compare it.");
  } else {
    lines.push("", "The screen has no comparable independent sequence for this record; the evidence above is all there is.");
  }
  return lines.join("\n");
}

const TSV_HEADER = ["refseq", "scientific_name", "class", "finding", "found", "rests_on", "drafted", "why_not", "evidence"];

function main(): void {
  const all = reports();
  const names = new Map(getAllSpecies().map((s) => [s.slug, s.scientificName]));
  const drafted = all.filter((r) => r.reason === null);
  const rest = all.filter((r) => r.reason !== null);
  const md = [
    "# Reports on RefSeq records the audit found wrong: drafts",
    "",
    "Written by `bun run record-reports` from the list of audited records and the screen against independent",
    "sequences; never edited by hand. **Nothing here was sent.** Sending a report is the maintainer's, under his",
    "name. RefSeq records are NCBI's: a report on one goes to NCBI, and the GenBank record it was made from is",
    "corrected on its submitter's request. Which GenBank record each one was made from was not looked up.",
    "",
    `${all.length} audited records: ${drafted.length} with a draft below, ${rest.length} without one (the list at the end, each with the reason).`,
    "Identities are over the bases a sequence shares with the record's gene; a sequence that could not be read",
    "against the gene is not counted.",
    "",
    "## Drafts",
    "",
    ...drafted.flatMap((r) => [draft(r, names), ""]),
    "## Not drafted",
    "",
    "| record | species | finding | why no draft |",
    "|---|---|---|---|",
    ...rest.map((r) => `| ${r.finding.refseq} | ${r.species?.name ?? ""} | ${r.finding.kind} | ${r.reason} |`),
    "",
  ];
  mkdirSync(OUT_DIR, { recursive: true });
  writeFileSync(join(OUT_DIR, "REPORTS.md"), md.join("\n"));
  writeFileSync(join(OUT_DIR, "REPORTS.tsv"), [TSV_HEADER.join("\t"), ...all.map((r) =>
    [r.finding.refseq, r.species?.name ?? "", r.species?.cls ?? "", r.finding.kind, r.finding.found, r.basis.join(","), r.reason === null ? "yes" : "no", r.reason ?? "", r.finding.evidence].join("\t"))].join("\n") + "\n");
  console.log(`${all.length} audited records: ${drafted.length} drafted, ${rest.length} not`);
}

if (import.meta.main) main();
