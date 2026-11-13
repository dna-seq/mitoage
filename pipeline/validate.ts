/**
 * Invariant checks on the generated data, read back through src/data/index.ts (so the loader is
 * exercised too) and from the parquet downloads. Runs at the end of `bun run data`, or alone:
 *   bun run pipeline/validate.ts
 */
import { existsSync, readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { AGGREGATE_REGIONS, PROTEIN_GENES, RECORD_STATUSES, type Species, type TaxonNode } from "../src/data/schema";
import { ROOT } from "./lib/cache";
import { type Row, readParquet } from "./lib/parquet";
import { NEW_ID_OFFSET } from "./steps/build2";
import { buildExplorer } from "./steps/explorer";
import { PRECEDENCE, type TaxonGroup } from "./steps/lifespan";
import { GENERATED_DIR, PUBLIC_DATA_DIR } from "./steps/output";

/** Committed output files must stay below this size (CLAUDE.md: no large data in git). */
export const MAX_COMMITTED_BYTES = 5_000_000;
const EXPLORER_TARGET_BYTES = 1_500_000;
const BUILD1_SPECIES = 922;

const FISH = new Set(["Actinopterygii", "Chondrichthyes", "Hyperoartia", "Myxini", "Dipnoi", "Coelacanthi"]);
/** Chordate classes outside Vertebrata (lancelets, tunicates): invertebrates for the lifespan priority. */
const INVERTEBRATE_CHORDATES = new Set(["Leptocardii", "Ascidiacea", "Thaliacea", "Appendicularia"]);
/** Taxon group of a species from its (build 1 scheme) class and phylum, for the priority check. */
export function groupOf(s: Species): TaxonGroup {
  if (s.taxonomy.class === "Aves") return "bird";
  if (FISH.has(s.taxonomy.class)) return "fish";
  if (s.taxonomy.phylum !== "Chordata" || INVERTEBRATE_CHORDATES.has(s.taxonomy.class)) return "invertebrate";
  return "other_vertebrate";
}

export interface ChangelogRow {
  table: string;
  rowKey: string;
  field: string;
  oldValue: string | null;
  newValue: string | null;
  changeType: string;
  scope: string;
}

/**
 * Row metadata against the changelog: a row is new exactly when the changelog adds it, retired when
 * its species (or the row) was retired, updated when the changelog has a change for it, original
 * otherwise. Returns the problems.
 */
export function checkProvenance(
  species: Species[],
  children: { table: string; key: string; speciesId: number; status: string; addedInBuild: number; lastModifiedBuild: number | null }[],
  changelog: ChangelogRow[],
): string[] {
  const problems: string[] = [];
  const keyed = new Map<string, ChangelogRow[]>();
  for (const c of changelog) {
    if (c.rowKey === "*" || c.rowKey.startsWith("HAGRID")) continue;
    const k = `${c.table}:${c.rowKey}`;
    if (c.rowKey.endsWith(":*")) {
      (keyed.get(k) ?? keyed.set(k, []).get(k)!).push(c);
      continue;
    }
    (keyed.get(k) ?? keyed.set(k, []).get(k)!).push(c);
  }
  const bySpecies = new Map<number, ChangelogRow[]>();
  for (const c of changelog) {
    const id = Number(c.rowKey.split(":")[0]);
    if (!Number.isFinite(id)) continue;
    (bySpecies.get(id) ?? bySpecies.set(id, []).get(id)!).push(c);
  }
  const status = new Map<number, string>();
  for (const s of species) {
    const p = s.provenance;
    if (!p) {
      problems.push(`${s.slug}: no provenance`);
      continue;
    }
    status.set(s.id, p.recordStatus);
    const own = keyed.get(`species:${s.id}`) ?? [];
    const any = bySpecies.get(s.id) ?? [];
    const added = own.some((c) => c.changeType === "added" && c.field === "(row)");
    const retired = own.some((c) => c.changeType === "retired" && c.field === "record_status" && c.newValue === "retired");
    const renamed = own.some((c) => c.changeType === "renamed" && c.field === "scientific_name");
    if (!RECORD_STATUSES.includes(p.recordStatus)) problems.push(`${s.slug}: unknown record_status ${p.recordStatus}`);
    if ((p.recordStatus === "new") !== added) problems.push(`${s.slug}: record_status ${p.recordStatus} but changelog ${added ? "adds" : "does not add"} it`);
    if ((p.recordStatus === "new") !== (p.addedInBuild === 2)) problems.push(`${s.slug}: record_status ${p.recordStatus} with added_in_build ${p.addedInBuild}`);
    if ((p.recordStatus === "retired") !== retired) problems.push(`${s.slug}: record_status ${p.recordStatus} but changelog ${retired ? "retires" : "does not retire"} it`);
    if (p.recordStatus === "retired" && !s.retiredReason) problems.push(`${s.slug}: retired without retired_reason`);
    if (p.recordStatus !== "retired" && s.retiredReason) problems.push(`${s.slug}: retired_reason on a ${p.recordStatus} row`);
    if (p.recordStatus === "renamed" && !(renamed && (s.previousScientificNames?.length ?? 0) > 0)) problems.push(`${s.slug}: renamed without a changelog rename and a previous name`);
    if (p.recordStatus === "original" && any.length) problems.push(`${s.slug}: original but ${any.length} changelog rows`);
    if (p.recordStatus === "updated" && !any.length) problems.push(`${s.slug}: updated without changelog rows`);
    if (p.addedInBuild === 1 && (p.lastModifiedBuild !== null) !== any.length > 0) problems.push(`${s.slug}: last_modified_build ${p.lastModifiedBuild} vs ${any.length} changelog rows`);
  }
  for (const r of children) {
    const sst = status.get(r.speciesId);
    if (sst === undefined) {
      problems.push(`${r.table} ${r.key}: species ${r.speciesId} does not exist`);
      continue;
    }
    const own = keyed.get(`${r.table}:${r.key}`) ?? [];
    const addedRow = own.some((c) => c.field === "(row)" && c.oldValue === null);
    const removedRow = own.some((c) => c.field === "(row)" && c.newValue === null);
    const coveredBySpecies = (keyed.get(`${r.table}:${r.speciesId}:*`) ?? []).some((c) => c.changeType === "added");
    let expected: string;
    if (sst === "new") expected = "new";
    else if (sst === "retired" || removedRow) expected = "retired";
    else if (addedRow) expected = "new";
    else expected = own.length ? "updated" : "original";
    if (r.status !== expected) problems.push(`${r.table} ${r.key}: record_status ${r.status}, changelog implies ${expected}`);
    if (sst === "new" && !coveredBySpecies) problems.push(`${r.table} ${r.key}: row of a new species without a changelog '(rows)' entry`);
    if ((r.status === "new") !== (r.addedInBuild === 2)) problems.push(`${r.table} ${r.key}: record_status ${r.status} with added_in_build ${r.addedInBuild}`);
  }
  const rows = new Set(children.map((r) => `${r.table}:${r.key}`));
  for (const s of species) rows.add(`species:${s.id}`);
  for (const k of keyed.keys()) if (!k.endsWith(":*") && !rows.has(k)) problems.push(`changelog row ${k} does not refer to an existing row`);
  for (const c of changelog) {
    if (c.rowKey.endsWith(":*") && !status.has(Number(c.rowKey.split(":")[0]))) problems.push(`changelog row ${c.table}:${c.rowKey} names no species`);
  }
  return problems;
}

/** Lifespan rules: one chosen value per species, equal to max_longevity_years; AnAge first; source allowed for the taxon; licence present. */
export function checkLifespans(species: Species[], obs: Row[]): string[] {
  const problems: string[] = [];
  const by = new Map<number, Row[]>();
  for (const o of obs) {
    const id = Number(o["species_id"]);
    (by.get(id) ?? by.set(id, []).get(id)!).push(o);
    if (!o["license"]) problems.push(`observation ${id} ${o["source"]} ${o["source_record_id"]}: no licence`);
  }
  for (const s of species) {
    const l = s.lifespan;
    if (!l) {
      problems.push(`${s.slug}: no lifespan metadata`);
      continue;
    }
    if (!l.license) problems.push(`${s.slug}: no lifespan licence`);
    const mine = by.get(s.id) ?? [];
    const chosen = mine.filter((o) => o["is_chosen"] === true);
    if (chosen.length !== 1) {
      problems.push(`${s.slug}: ${chosen.length} chosen lifespan observations`);
      continue;
    }
    const c = chosen[0]!;
    if (c["source"] !== l.source || Number(c["value_years"]) !== s.maxLongevityYears) {
      problems.push(`${s.slug}: chosen observation ${c["source"]} ${c["value_years"]} != species ${l.source} ${s.maxLongevityYears}`);
    }
    if (s.provenance?.recordStatus === "retired") continue;
    const hasAnAge = mine.some((o) => o["source"] === "AnAge" && o["value_years"] !== null);
    if (hasAnAge && l.source !== "AnAge") problems.push(`${s.slug}: AnAge has a value but ${l.source} was chosen`);
    if (!PRECEDENCE[groupOf(s)].includes(l.source)) problems.push(`${s.slug}: ${l.source} is not a lifespan source for ${groupOf(s)} (${s.taxonomy.class})`);
  }
  return problems;
}

function walkFiles(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? walkFiles(join(dir, e.name)) : [join(dir, e.name)]));
}

export async function validateGenerated(): Promise<string[]> {
  const data = await import("../src/data/index");
  const problems: string[] = [];
  const check = (ok: boolean, msg: string) => {
    if (!ok) problems.push(msg);
  };
  const info = data.getBuildInfo();
  const species = data.getAllSpecies();

  // Species
  check(species.length === info.speciesCount, `speciesCount ${info.speciesCount} != ${species.length}`);
  const fromBuild1 = species.filter((s) => s.provenance?.addedInBuild === 1).length;
  check(fromBuild1 === BUILD1_SPECIES, `expected ${BUILD1_SPECIES} build 1 species (published MitoAge release), got ${fromBuild1}`);
  check(new Set(species.map((s) => s.slug)).size === species.length, "species slugs are not unique");
  check(new Set(species.map((s) => s.id)).size === species.length, "species ids are not unique");
  for (const s of species) {
    const names = [s.scientificName, ...(s.previousScientificNames ?? [])].map((n) => n.toLowerCase().split(" ")[0]!);
    check(/^[a-z0-9]+(-[a-z0-9]+)*$/.test(s.slug), `bad slug ${s.slug}`);
    check(names.some((g) => s.slug.startsWith(g)), `slug ${s.slug} does not follow ${s.scientificName} or a previous name`);
    if (s.provenance?.addedInBuild === 2) check(s.id === NEW_ID_OFFSET + (s.ncbiSpeciesTaxid ?? -1), `${s.slug}: id ${s.id} is not ${NEW_ID_OFFSET} + NCBI species taxid`);
    else check(s.id > 0 && s.id < 100_000, `${s.slug}: build 1 id ${s.id} out of range`);
    check(s.maxLongevityYears > 0, `${s.slug}: non-positive longevity`);
    check(s.gcPercent > 0 && s.gcPercent < 100, `${s.slug}: gcPercent ${s.gcPercent}`);
    check(s.mtdnaSizeBp > 12_000 && s.mtdnaSizeBp < 60_000, `${s.slug}: mtDNA size ${s.mtdnaSizeBp}`);
    check(s.nonCodingBp === null || (s.nonCodingBp >= 0 && s.nonCodingBp < s.mtdnaSizeBp), `${s.slug}: nonCodingBp ${s.nonCodingBp}`);
    check(data.getSpeciesBySlug(s.slug) === s && data.getSpeciesById(s.id) === s, `${s.slug}: lookup mismatch`);
    for (const [k, v] of Object.entries(s.traits)) {
      if (k !== "source" && v !== null) check(typeof v === "number" && Number.isFinite(v) && v >= 0, `${s.slug}: trait ${k}=${v}`);
    }
  }
  check(species.filter((s) => s.legacyId !== null).length >= 900, "fewer than 900 species have a legacy id");

  // Region stats
  const regionsAll = [...AGGREGATE_REGIONS, ...PROTEIN_GENES] as string[];
  let nStats = 0;
  for (const s of species) {
    const rs = data.getRegionStats(s.id);
    nStats += rs.length;
    const seen = new Set<string>();
    for (const r of rs) {
      check(regionsAll.includes(r.region), `${s.slug}: unknown region ${r.region}`);
      check(!seen.has(r.region), `${s.slug}: duplicate region ${r.region}`);
      seen.add(r.region);
      check(r.a + r.c + r.g + r.t + r.other === r.lengthBp, `${s.slug} ${r.region}: a+c+g+t+other != lengthBp`);
      check(r.gcPercent >= 0 && r.gcPercent <= 100, `${s.slug} ${r.region}: gc ${r.gcPercent}`);
      check(r.gcSkew === null || Math.abs(r.gcSkew) <= 1, `${s.slug} ${r.region}: gcSkew ${r.gcSkew}`);
      check(r.atSkew === null || Math.abs(r.atSkew) <= 1, `${s.slug} ${r.region}: atSkew ${r.atSkew}`);
      // A retired row of a live species belongs to the record cited earlier, not to the current genome.
      const oldRow = r.provenance?.recordStatus === "retired" && s.provenance?.recordStatus !== "retired";
      if (!oldRow) check(r.lengthBp <= s.mtdnaSizeBp, `${s.slug} ${r.region}: longer than the genome`);
    }
    const total = rs.find((r) => r.region === "total_mtDNA");
    check(!!total, `${s.slug}: no total_mtDNA stats`);
    if (total) {
      check(total.lengthBp === s.mtdnaSizeBp, `${s.slug}: total_mtDNA length != mtdnaSizeBp`);
      check(Math.abs(total.gcPercent - s.gcPercent) < 0.01, `${s.slug}: gc mismatch`);
    }
  }
  const human = data.getSpeciesBySlug("homo-sapiens");
  check(!!human, "homo-sapiens missing");
  if (human) {
    const t = data.getRegionStats(human.id).find((r) => r.region === "total_mtDNA");
    // rCRS (NC_012920.1) composition on the deposited strand.
    check(t?.a === 5124 && t?.c === 5181 && t?.g === 2169 && t?.t === 4094, `human rCRS composition wrong: ${JSON.stringify(t)}`);
    check((t?.gcSkew ?? 0) < 0, "human L-strand GC skew should be negative (C-rich RefSeq strand)");
  }

  // Codon usage
  let nCodon = 0;
  for (const s of species) {
    for (const u of data.getCodonUsage(s.id)) {
      nCodon++;
      const codons = Object.keys(u.counts);
      check(codons.length === 64 && codons.every((c) => /^[ACGU]{3}$/.test(c)), `${s.slug} ${u.region}: not 64 RNA codons`);
      const cTotal = Object.values(u.counts).reduce((a, b) => a + b, 0);
      const aTotal = Object.values(u.aminoAcids).reduce((a, b) => a + b, 0);
      check(cTotal === aTotal, `${s.slug} ${u.region}: amino-acid total ${aTotal} != codon total ${cTotal}`);
      check(cTotal > 0, `${s.slug} ${u.region}: empty codon table`);
    }
  }
  check(nCodon >= species.length * 13, `only ${nCodon} codon tables`);

  // Genome features
  let withFeatures = 0;
  for (const s of species) {
    const fs = data.getGenomeFeatures(s.id);
    if (fs.length) withFeatures++;
    for (const f of fs) {
      check(f.start >= 1 && f.end >= 1 && f.start <= s.mtdnaSizeBp && f.end <= s.mtdnaSizeBp, `${s.slug} ${f.name}: outside genome`);
      check(f.strand === 1 || f.strand === -1, `${s.slug} ${f.name}: bad strand`);
      check(["CDS", "rRNA", "tRNA", "D-loop"].includes(f.type), `${s.slug} ${f.name}: bad type`);
    }
    const cds = new Set(fs.filter((f) => f.type === "CDS").map((f) => f.name));
    if (fs.length) check(cds.size >= 12, `${s.slug}: only ${cds.size} distinct CDS names`);
  }
  check(withFeatures >= species.length - 5, `only ${withFeatures} species have genome features`);

  // Taxonomy
  const tree = data.getTaxonomyTree();
  check(tree.speciesCount === species.length, "taxonomy root speciesCount mismatch");
  const leafIds: number[] = [];
  const slugByRank = new Map<string, Set<string>>();
  const walk = (n: TaxonNode) => {
    if (n.speciesId !== undefined) leafIds.push(n.speciesId);
    const set = slugByRank.get(n.rank) ?? new Set<string>();
    slugByRank.set(n.rank, set);
    check(!set.has(n.slug), `duplicate ${n.rank} slug ${n.slug}`);
    set.add(n.slug);
    const sum = n.children.reduce((a, c) => a + c.speciesCount, 0);
    if (n.rank !== "species") check(sum === n.speciesCount, `${n.rank} ${n.name}: speciesCount mismatch`);
    if (n.branchLengthMya !== undefined && n.branchLengthMya !== null) check(n.branchLengthMya >= 0, `${n.name}: negative branch`);
    n.children.forEach(walk);
  };
  walk(tree);
  check(leafIds.length === species.length && new Set(leafIds).size === species.length, "taxonomy leaves != species");
  for (const t of data.getTaxa()) {
    check(data.getTaxon(t.rank, t.slug) === t, `getTaxon(${t.rank}, ${t.slug}) failed`);
    check(data.getSpeciesInTaxon(t.rank, t.slug).length === t.speciesCount, `getSpeciesInTaxon(${t.rank}, ${t.slug}) count`);
  }

  // Changelog, provenance, lifespans (from the parquet downloads)
  const changelog = (await readParquet(join(PUBLIC_DATA_DIR, "changelog.parquet"))).map((r) => ({
    table: String(r["table"]), rowKey: String(r["row_key"]), field: String(r["field"]),
    oldValue: r["old_value"] === null ? null : String(r["old_value"]), newValue: r["new_value"] === null ? null : String(r["new_value"]),
    changeType: String(r["change_type"]), scope: String(r["scope"]),
  }));
  const children: Parameters<typeof checkProvenance>[1] = [];
  for (const [table, keyOf] of [
    ["region_stats", (r: Row) => `${r["species_id"]}:${r["region"]}`],
    ["codon_usage", (r: Row) => `${r["species_id"]}:${r["region"]}`],
    ["genome_features", (r: Row) => `${r["species_id"]}:${r["feature_key"]}`],
  ] as const) {
    for (const r of await readParquet(join(PUBLIC_DATA_DIR, `${table}.parquet`), ["species_id", table === "genome_features" ? "feature_key" : "region", "record_status", "added_in_build", "last_modified_build"])) {
      children.push({
        table, key: keyOf(r), speciesId: Number(r["species_id"]), status: String(r["record_status"]),
        addedInBuild: Number(r["added_in_build"]), lastModifiedBuild: r["last_modified_build"] === null ? null : Number(r["last_modified_build"]),
      });
    }
  }
  const keys = new Set<string>();
  for (const c of children) {
    const k = `${c.table}:${c.key}`;
    check(!keys.has(k), `duplicate row key ${k}`);
    keys.add(k);
  }
  problems.push(...checkProvenance(species, children, changelog).slice(0, 50));
  const obs = await readParquet(join(PUBLIC_DATA_DIR, "lifespan_observations.parquet"));
  for (const o of obs) check(o["record_status"] === "new" && Number(o["added_in_build"]) === 2, `observation ${o["species_id"]} ${o["source_record_id"]}: provenance ${o["record_status"]}`);
  check(changelog.some((c) => c.table === "lifespan_observations" && c.changeType === "added"), "changelog does not record the new lifespan_observations table");
  problems.push(...checkLifespans(species, obs).slice(0, 50));
  for (const rule of ["region_stats:a", "region_stats:c", "region_stats:g", "region_stats:t", "region_stats:length_bp"]) {
    check(changelog.some((c) => `${c.table}:${c.field}` === rule && c.rowKey === "*" && c.scope === "rule" && c.changeType === "correction"), `rule-scoped correction ${rule} missing from the changelog`);
  }

  // Features and correlations (derived during the build from the parquet)
  const defs = data.getFeatureDefs();
  check(new Set(defs.map((d) => d.key)).size === defs.length, "feature keys not unique");
  for (const r of regionsAll) {
    for (const k of ["gc", "gcSkew", "atSkew", "size"]) check(defs.some((d) => d.key === `${k}:${r}`), `missing feature ${k}:${r}`);
  }
  const gc = data.getFeatureValues("gc:total_mtDNA");
  check(Object.values(gc).filter((v) => v !== null).length === species.length, "gc:total_mtDNA not complete");
  for (const d of ["default", "anage_only"] as const) {
    const corr = data.getCorrelations({ trait: "maxLongevityYears", scope: "all", dataset: d });
    check(corr.length > 100, `too few lifespan correlations in scope all (${d})`);
    const expectedN = info.correlationDatasets?.find((x) => x.dataset === d)?.species;
    const gcRow = corr.find((c) => c.featureKey === "gc:total_mtDNA");
    check(gcRow !== undefined && gcRow.n === expectedN, `${d}: gc:total_mtDNA n ${gcRow?.n} != dataset size ${expectedN}`);
  }
  for (const c of data.getAllCorrelationRows()) {
    if (!(Math.abs(c.pearsonR) <= 1 && Math.abs(c.spearmanRho) <= 1)) {
      problems.push(`correlation out of range ${c.featureKey} ${c.trait} ${c.scope}`);
      break;
    }
    if (!(c.pValue >= 0 && c.pValue <= 1 && c.qValue >= c.pValue - 1e-12 && c.qValue <= 1)) {
      problems.push(`bad p/q ${c.featureKey} ${c.trait} ${c.scope}: ${c.pValue} ${c.qValue}`);
      break;
    }
    if (c.n < 10) {
      problems.push(`correlation with n < 10: ${c.featureKey}`);
      break;
    }
  }
  const explorerBytes = Buffer.byteLength(JSON.stringify(buildExplorer(species, defs, data.getFeatureValueArrays().values, info)));
  check(explorerBytes < MAX_COMMITTED_BYTES, `explorer.json would be ${explorerBytes} bytes`);
  if (explorerBytes >= EXPLORER_TARGET_BYTES) {
    console.warn(`  WARNING: explorer.json is ${explorerBytes} bytes, above the ${EXPLORER_TARGET_BYTES}-byte page-weight target (served, not committed)`);
  }

  // Files: present, and every committed file under the size limit
  for (const f of ["species.parquet", "region_stats.parquet", "codon_usage.parquet", "genome_features.parquet", "lifespan_observations.parquet", "changelog.parquet", "species.csv", "review_list.csv", "README.md", "build1/README.md"]) {
    check(existsSync(join(PUBLIC_DATA_DIR, f)), `public/data/${f} missing`);
  }
  for (const f of ["build-info.json", "taxonomy.json", "phylogeny.json"]) check(existsSync(join(GENERATED_DIR, f)), `src/data/generated/${f} missing`);
  for (const dir of [PUBLIC_DATA_DIR, GENERATED_DIR]) {
    for (const f of walkFiles(dir)) {
      const size = statSync(f).size;
      check(size < MAX_COMMITTED_BYTES, `${relative(ROOT, f)} is ${size} bytes (limit ${MAX_COMMITTED_BYTES})`);
    }
  }
  const b1 = await readParquet(join(PUBLIC_DATA_DIR, "build1", "total_mtDNA_base_composition.parquet"), ["HAGRID"]);
  check(b1.length === BUILD1_SPECIES + 1, `build1 total_mtDNA has ${b1.length} rows, the 2015 export has ${BUILD1_SPECIES + 1}`);

  console.log(
    `  ${species.length} species, ${nStats} region stats, ${nCodon} codon tables, ${withFeatures} species with features, ${defs.length} features, ${data.getTaxa().length} taxa, ${changelog.length} changelog rows, ${obs.length} lifespan observations: ${problems.length ? `${problems.length} problems` : "all checks passed"}`,
  );
  return problems;
}

if (import.meta.main) {
  const problems = await validateGenerated();
  if (problems.length) {
    console.error(problems.join("\n"));
    process.exit(1);
  }
}
