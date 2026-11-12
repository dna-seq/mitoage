/** public/data/README.md describing the downloadable files. */
import type { BuildInfo } from "../../src/data/schema";

export function buildPublicReadme(info: BuildInfo): string {
  const sources = info.sources.map((s) => `- ${s.name}, ${s.version}: ${s.url} (${s.license})`).join("\n");
  return `# MitoAge data downloads

Build ${info.build}, generated ${info.generatedAt.slice(0, 10)}, ${info.speciesCount} species.
Produced by \`bun run data\` (pipeline/ in the site repository). Parquet files can be read with
DuckDB, pandas/pyarrow, polars, R arrow or hyparquet.

## Files

### species.parquet / species.csv (one row per species)
- \`id\`: MitoAge species id (AnAge HAGRID at the time of MitoAge build 1); \`slug\`: URL slug.
- \`scientific_name\`, \`common_name\`, \`refseq\` (versioned RefSeq accession), taxonomy \`kingdom\` .. \`genus\` (MitoAge build 1).
- \`max_longevity_years\`: maximum recorded lifespan used by MitoAge build 1.
- \`mtdna_size_bp\`, \`non_coding_bp\` (bases not in any CDS, rRNA or tRNA, D-loop included), \`gc_percent\` (whole genome).
- \`legacy_id\`: id on the old site (https://www.mitoage.info/view/{legacy_id}/species/).
- AnAge traits: \`adult_weight_g\`, \`birth_weight_g\`, \`metabolic_rate_w\`, \`body_temperature_k\`, \`female_maturity_days\`,
  \`male_maturity_days\`, \`gestation_days\` (gestation or incubation), \`litter_size\` (litter or clutch), \`litters_per_year\`,
  \`growth_rate_per_day\`; \`traits_source\`; \`anage_build15_hagrid\`; \`anage_match\` (how the AnAge entry was matched);
  \`anage_build15_max_longevity_years\` (current AnAge value, may differ from \`max_longevity_years\`).
- \`ncbi_taxid\`, \`transl_table\` (NCBI genetic code used for amino acids).

### region_stats.parquet (one row per species and region)
- \`species_id\`, \`slug\`, \`region\`: total_mtDNA, total_pc (all protein-coding genes, overlaps counted once), total_rRNA,
  total_tRNA, rRNA-12S, rRNA-16S, D_Loop, or one of the 13 protein genes.
- \`length_bp\`, \`a\`, \`c\`, \`g\`, \`t\`, \`other\` (ambiguity codes): base counts on the RefSeq strand as deposited
  (for minus-strand genes such as ND6 this is the complement of the gene sense).
- \`gc_percent\` = 100 (G+C)/(A+C+G+T); \`gc_skew\` = (G-C)/(G+C); \`at_skew\` = (A-T)/(A+T).
- \`source\`: \`mitoage\` (MitoAge build 1 values with the base-label fix) or \`genbank\` (recomputed from RefSeq where the CSV had none).

### codon_usage.parquet (one row per species and protein-coding gene, plus \`total_pc\`)
- \`species_id\`, \`slug\`, \`region\`, \`transl_table\`, \`source\`.
- 64 codon count columns named by RNA codon (\`AUU\`, \`CUA\`, ...), gene sense, complete codons only.
- \`aa_A\` .. \`aa_Y\`, \`aa_stop\`: amino-acid counts derived with the species' mitochondrial genetic code.

### genome_features.parquet (one row per annotated feature)
- \`species_id\`, \`slug\`, \`name\` (normalised: ND1..CYTB, rRNA-12S, rRNA-16S, D_Loop, tRNA-Phe, tRNA-Leu(UUR) ...),
  \`type\` (CDS, rRNA, tRNA, D-loop), \`start\`, \`end\` (1-based inclusive; start > end wraps the origin), \`strand\` (1 or -1).

### correlations.parquet (one row per feature, trait and scope)
- \`feature_key\` (e.g. \`gc:total_mtDNA\`, \`gcSkew:ND6\`, \`size:D_Loop\`, \`codon:total_pc:CUA\`, \`aa:ND5:L\`), \`trait\`, \`scope\`
  (\`all\`, \`class:Mammalia\`, \`order:Primates\`, ...), \`n\`.
- \`pearson_r\`, \`spearman_rho\`: feature vs log10(trait); \`p_value\` (two-tailed); \`q_value\` (Benjamini-Hochberg within trait and scope).
- \`partial_r\`, \`partial_p_value\`, \`partial_n\`: for max longevity only, controlling for log10 adult weight.
- \`pic_r\`, \`pic_p_value\`: phylogenetically independent contrasts on the dated tree (null when unavailable).

Feature keys: \`size:\` length in bp, \`gc:\` GC%, \`gcSkew:\`/\`atSkew:\` skews, \`noncoding:total_mtDNA\`,
\`codon:REGION:XYZ\` percent of all codons in the region, \`aa:REGION:X\` percent of sense codons.

### explorer.json
Compact columnar copy of species names, taxonomy (class/order/family as indices into the listed names), traits and
every feature value except per-gene codon and amino-acid features, for the in-browser scatter explorer.

## Sources
${sources}

## Data notes
${info.notes.map((n) => `- ${n}`).join("\n")}
`;
}
