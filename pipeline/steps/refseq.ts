/**
 * RefSeq release -> one complete mitogenome per NCBI species (build 2 rule): NC_ records whose
 * definition says complete genome / complete mitochondrial genome, single-molecule complete
 * sequence, or a circular organelle assembly. Several records of one species: newest LOCUS date,
 * then full length (not shorter than 75% of the class median), then the higher accession.version.
 */
import type { NcbiTaxonomy } from "../sources/ncbi-taxonomy";
import { type Completeness, type RefSeqHeader, type RefSeqRelease, completeness, isComplete } from "../sources/refseq-release";

export interface ReleaseRecord {
  header: RefSeqHeader;
  completeness: Completeness;
  taxidCurrent: number | null;
  speciesTaxid: number | null;
  speciesClass: string | null;
  lengthQc: "ok" | "short_for_class";
}

export const isMetazoaLineage = (l: string) => /\bMetazoa\b/.test(l);

export function classifyRelease(release: RefSeqRelease, tax: NcbiTaxonomy): ReleaseRecord[] {
  const recs: ReleaseRecord[] = [];
  for (const h of release.headers) {
    if (!isMetazoaLineage(h.lineage)) continue;
    const cur = h.taxid === null ? null : tax.current(h.taxid);
    const sp = cur === null ? null : tax.speciesOf(cur);
    recs.push({
      header: h,
      completeness: completeness(h),
      taxidCurrent: cur,
      speciesTaxid: sp,
      speciesClass: sp === null ? null : (tax.lineage(sp)?.class ?? ""),
      lengthQc: "ok",
    });
  }
  const lengths = new Map<string, number[]>();
  for (const r of recs) {
    if (r.speciesClass === null || !isComplete(r.completeness)) continue;
    (lengths.get(r.speciesClass) ?? lengths.set(r.speciesClass, []).get(r.speciesClass)!).push(r.header.length);
  }
  const median = new Map<string, number>();
  for (const [c, l] of lengths) {
    const s = [...l].sort((a, b) => a - b);
    const m = s.length % 2 ? s[(s.length - 1) / 2]! : (s[s.length / 2 - 1]! + s[s.length / 2]!) / 2;
    median.set(c, m);
  }
  for (const r of recs) {
    const m = r.speciesClass === null ? undefined : median.get(r.speciesClass);
    if (m !== undefined && r.header.length < 0.75 * m) r.lengthQc = "short_for_class";
  }
  return recs;
}

/** Ordering of records of one species: newest, then full length, then higher version. */
export function compareRecords(a: ReleaseRecord, b: ReleaseRecord): number {
  if (a.header.updateDate !== b.header.updateDate) return a.header.updateDate < b.header.updateDate ? 1 : -1;
  if (a.lengthQc !== b.lengthQc) return a.lengthQc === "ok" ? -1 : 1;
  if (a.header.version !== b.header.version) return a.header.version < b.header.version ? 1 : -1;
  return 0;
}

export interface SpeciesChoice {
  chosen: ReleaseRecord;
  all: ReleaseRecord[];
}

export function onePerSpecies(recs: ReleaseRecord[]): Map<number, SpeciesChoice> {
  const by = new Map<number, ReleaseRecord[]>();
  for (const r of recs) {
    if (!isComplete(r.completeness) || r.speciesTaxid === null) continue;
    (by.get(r.speciesTaxid) ?? by.set(r.speciesTaxid, []).get(r.speciesTaxid)!).push(r);
  }
  const out = new Map<number, SpeciesChoice>();
  for (const t of [...by.keys()].sort((a, b) => a - b)) {
    const all = by.get(t)!.sort(compareRecords);
    out.set(t, { chosen: all[0]!, all });
  }
  return out;
}

/**
 * Live successor for a build 1 species whose record left RefSeq: a complete record of the same
 * species, preferring one annotated at species rank over a subspecies, then the usual ordering.
 * Records already cited by another species are never taken.
 */
export function successorFor(choice: SpeciesChoice | undefined, taken: Set<string>): ReleaseRecord | null {
  if (!choice) return null;
  const free = choice.all.filter((r) => !taken.has(r.header.version));
  const speciesLevel = free.filter((r) => r.taxidCurrent === r.speciesTaxid);
  return [...(speciesLevel.length ? speciesLevel : free)].sort(compareRecords)[0] ?? null;
}
