/**
 * Invariant checks on the generated data, read back through src/data/index.ts (so the
 * loader is exercised too). Runs at the end of `bun run data`, or alone:
 *   bun run pipeline/validate.ts
 */
import { existsSync } from "node:fs";
import { join } from "node:path";
import { parquetMetadata } from "hyparquet";
import * as data from "../src/data/index";
import { AGGREGATE_REGIONS, PROTEIN_GENES, type TaxonNode } from "../src/data/schema";
import { PUBLIC_DATA_DIR } from "./steps/output";

export async function validateGenerated(): Promise<string[]> {
  const problems: string[] = [];
  const check = (ok: boolean, msg: string) => {
    if (!ok) problems.push(msg);
  };
  const info = data.getBuildInfo();
  const species = data.getAllSpecies();

  // Species
  check(species.length === info.speciesCount, `speciesCount ${info.speciesCount} != ${species.length}`);
  check(species.length === 922, `expected 922 species (published MitoAge release), got ${species.length}`);
  const slugs = new Set(species.map((s) => s.slug));
  check(slugs.size === species.length, "species slugs are not unique");
  check(new Set(species.map((s) => s.id)).size === species.length, "species ids are not unique");
  for (const s of species) {
    check(/^[a-z0-9]+(-[a-z0-9]+)*$/.test(s.slug), `bad slug ${s.slug}`);
    check(s.slug.startsWith(s.scientificName.toLowerCase().split(" ")[0]!), `slug ${s.slug} does not follow ${s.scientificName}`);
    check(s.maxLongevityYears > 0, `${s.slug}: non-positive longevity`);
    check(s.gcPercent > 0 && s.gcPercent < 100, `${s.slug}: gcPercent ${s.gcPercent}`);
    check(s.mtdnaSizeBp > 12_000 && s.mtdnaSizeBp < 40_000, `${s.slug}: mtDNA size ${s.mtdnaSizeBp}`);
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
      check(r.lengthBp <= s.mtdnaSizeBp, `${s.slug} ${r.region}: longer than the genome`);
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

  // Features and correlations
  const defs = data.getFeatureDefs();
  check(new Set(defs.map((d) => d.key)).size === defs.length, "feature keys not unique");
  for (const r of regionsAll) {
    for (const k of ["gc", "gcSkew", "atSkew", "size"]) check(defs.some((d) => d.key === `${k}:${r}`), `missing feature ${k}:${r}`);
  }
  const gc = data.getFeatureValues("gc:total_mtDNA");
  check(Object.values(gc).filter((v) => v !== null).length === species.length, "gc:total_mtDNA not complete");
  const corr = data.getCorrelations({ trait: "maxLongevityYears", scope: "all" });
  check(corr.length > 100, "too few lifespan correlations in scope all");
  for (const c of data.getCorrelations()) {
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

  // Public files
  for (const f of ["species.parquet", "region_stats.parquet", "codon_usage.parquet", "genome_features.parquet", "correlations.parquet", "species.csv", "explorer.json", "README.md"]) {
    const p = join(PUBLIC_DATA_DIR, f);
    check(existsSync(p), `public/data/${f} missing`);
  }
  const sp = parquetMetadata(await Bun.file(join(PUBLIC_DATA_DIR, "species.parquet")).arrayBuffer());
  check(Number(sp.num_rows) === species.length, `species.parquet has ${sp.num_rows} rows`);
  const rp = parquetMetadata(await Bun.file(join(PUBLIC_DATA_DIR, "region_stats.parquet")).arrayBuffer());
  check(Number(rp.num_rows) === nStats, `region_stats.parquet has ${rp.num_rows} rows, expected ${nStats}`);
  const ex = Bun.file(join(PUBLIC_DATA_DIR, "explorer.json")).size;
  check(ex < 1_500_000, `explorer.json is ${ex} bytes (target < 1.5 MB)`);

  console.log(
    `  ${species.length} species, ${nStats} region stats, ${nCodon} codon tables, ${withFeatures} species with features, ${defs.length} features, ${data.getTaxa().length} taxa: ${problems.length ? `${problems.length} problems` : "all checks passed"}`,
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
