/** Loader for the MitoAge build 1 CSV export in data/input/mitoage_build1_full_database. */
import { readdirSync } from "node:fs";
import { join } from "node:path";
import { ROOT } from "../lib/cache";
import { parseRecords } from "../lib/csv";
import { AGGREGATE_REGIONS, PROTEIN_GENES, type Region } from "../../src/data/schema";

export const INPUT_DIR = join(ROOT, "data", "input", "mitoage_build1_full_database");

export const ALL_REGIONS: Region[] = [...AGGREGATE_REGIONS, ...PROTEIN_GENES];
export const CODON_REGIONS = [...PROTEIN_GENES, "total_pc"] as const;

export interface RawSpecies {
  hagrid: number;
  gi: string;
  refseq: string;
  kingdom: string;
  phylum: string;
  class: string;
  order: string;
  family: string;
  genus: string;
  species: string;
  commonName: string;
  maxLongevityYears: number;
}

/** Base counts exactly as labelled in the CSV columns (labels possibly wrong, see build notes). */
export interface RawComposition {
  hagrid: number;
  labelG: number;
  labelC: number;
  labelA: number;
  labelT: number;
  other: number;
  lengthBp: number;
  gcPercent: number;
  nonCodingBp: number | null;
  nonCodingNoDloopBp: number | null;
}

export interface RawCodons {
  hagrid: number;
  lengthBp: number;
  protein: string;
  counts: Record<string, number>;
}

export interface RawData {
  species: Map<number, RawSpecies>;
  composition: Map<Region, Map<number, RawComposition[]>>;
  codons: Map<string, Map<number, RawCodons>>;
  files: string[];
}

const num = (s: string | undefined): number => {
  const v = Number(s);
  if (s === undefined || s === "" || !Number.isFinite(v)) throw new Error(`not a number: ${s}`);
  return v;
};
const optNum = (s: string | undefined): number | null => (s === undefined || s === "" ? null : num(s));

const CODON_RE = /^[ACGU]{3}$/;

export async function loadMitoAgeCsv(): Promise<RawData> {
  const files = readdirSync(INPUT_DIR).filter((f) => f.endsWith(".csv")).sort();
  const species = new Map<number, RawSpecies>();
  const composition = new Map<Region, Map<number, RawComposition[]>>();
  const codons = new Map<string, Map<number, RawCodons>>();

  for (const file of files) {
    const text = await Bun.file(join(INPUT_DIR, file)).text();
    const { header, records } = parseRecords(text);
    const comp = /^(.+)_base_composition\.csv$/.exec(file);
    const cod = /^(.+)_codon_usage\.csv$/.exec(file);
    const region = (comp?.[1] ?? cod?.[1]) as Region | undefined;
    if (!region || !ALL_REGIONS.includes(region)) throw new Error(`Unexpected input file ${file}`);

    for (const r of records) {
      const hagrid = num(r["HAGRID"]);
      if (!species.has(hagrid)) {
        species.set(hagrid, {
          hagrid,
          gi: r["GI"]!,
          refseq: r["Ref"]!,
          kingdom: r["Kingdom"]!,
          phylum: r["Phylum"]!,
          class: r["Class"]!,
          order: r["Order"]!,
          family: r["Family"]!,
          genus: r["Genus"]!,
          species: r["Species"]!,
          commonName: r["Common name"]!,
          maxLongevityYears: num(r["Maximum longevity (yrs)"]),
        });
      }
      if (comp) {
        const m = composition.get(region) ?? new Map<number, RawComposition[]>();
        composition.set(region, m);
        // A few species have two rows for one region (e.g. two features labelled 16S); keep all.
        const list = m.get(hagrid) ?? [];
        m.set(hagrid, list);
        list.push({
          hagrid,
          labelG: num(r["G"]),
          labelC: num(r["C"]),
          labelA: num(r["A"]),
          labelT: num(r["T"]),
          other: num(r["Other (W\\M\\Y\\R\\S...)"]),
          lengthBp: num(r["mtDNA size (bp)"]),
          gcPercent: num(r["GC%"]),
          nonCodingBp: optNum(r["length non-coding (bp)"]),
          nonCodingNoDloopBp: optNum(r["length non-coding without D-Loop (bp)"]),
        });
      } else {
        const m = codons.get(region) ?? new Map<number, RawCodons>();
        codons.set(region, m);
        if (m.has(hagrid)) throw new Error(`Duplicate HAGRID ${hagrid} in ${file}`);
        const counts: Record<string, number> = {};
        for (const h of header) if (CODON_RE.test(h)) counts[h] = num(r[h]);
        if (Object.keys(counts).length !== 64) throw new Error(`${file}: expected 64 codon columns`);
        m.set(hagrid, {
          hagrid,
          lengthBp: num(r["mtDNA size (bp)"]),
          protein: r["Amino Acids"] ?? "",
          counts,
        });
      }
    }
  }
  return { species, composition, codons, files };
}
