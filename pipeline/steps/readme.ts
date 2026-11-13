/** public/data/README.md describing the downloadable files. */
import type { BuildInfo } from "../../src/data/schema";

export function buildPublicReadme(info: BuildInfo): string {
  const sources = info.sources.map((s) => `- ${s.name}, ${s.version}: ${s.url} (${s.license})`).join("\n");
  const statuses = Object.entries(info.recordStatusCounts ?? {}).map(([k, v]) => `${k} ${v}`).join(", ");
  const euringMissing = info.sources.some((s) => s.name.startsWith("EURING") && s.version.includes("NOT RETRIEVED"));
  return `# MitoAge data downloads

Build ${info.build}, generated ${info.generatedAt.slice(0, 10)}, ${info.speciesCount} species (${statuses}).
Produced by \`bun run data\` (pipeline/ in the site repository). Parquet files can be read with
DuckDB, pandas/pyarrow, polars, R arrow or hyparquet.

**Licence of lifespan values.** Rows whose \`lifespan_source\` is \`FishBase\` or \`SeaLifeBase\` carry values
licensed CC BY-NC 4.0: they may be used for non-commercial purposes only, with attribution (Froese & Pauly,
FishBase; Palomares & Pauly, SeaLifeBase). Every species row carries its \`lifespan_license\`.
${euringMissing ? "\n**EURING: not retrieved.** The EURING longevity list (2023-09-01), which ranks above the USGS Bird Banding\nLaboratory for birds, could not be downloaded (euring.org was in maintenance). No EURING values are used; bird\nlifespans taken from USGS BBL are provisional (review flag `lifespan_provisional_euring_not_retrieved`).\n" : ""}
## Row metadata (every data table)
- \`added_in_build\` (1 or 2), \`added_at\` (ISO-8601 UTC; build 1 rows: 2015-07-01), \`last_modified_build\` and
  \`last_modified_at\` (null if the row never changed), \`record_status\` (\`original\`, \`updated\`, \`new\`, \`renamed\`,
  \`retired\`), \`source_version\` (upstream version used for the row, e.g. a RefSeq accession.version).
- Retired rows are never deleted: they keep their last values and are excluded from correlations.

## Files

### species.parquet / species.csv (one row per species)
- \`id\`: MitoAge species id. Build 1 species keep their build 1 id (the AnAge HAGRID of 2015); species added in
  build 2 have id 10,000,000 + NCBI species taxid. \`slug\`: URL slug (kept when a species is renamed).
- \`scientific_name\` (NCBI Taxonomy species name), \`previous_scientific_names\` (names in earlier builds, \`; \`-separated),
  \`common_name\`, \`refseq\` (versioned RefSeq accession), taxonomy \`kingdom\` .. \`genus\`. \`class\` uses the build 1
  scheme for every species (comparable with the 2016 paper).
- \`max_longevity_years\` and its provenance: \`lifespan_source\` (AnAge, FishBase, SeaLifeBase, USGS_BBL; MitoAge_build1 for
  a retired species with no current value), \`lifespan_source_version\`, \`lifespan_source_record_id\`, \`lifespan_quality\`
  (high, acceptable, questionable, low), \`lifespan_sample_size\` (AnAge), \`lifespan_record_type\` (captive, wild, observed,
  estimated, compiled), \`lifespan_license\`.
- \`mtdna_size_bp\`, \`non_coding_bp\` (bases not in any CDS, rRNA or tRNA, D-loop included), \`gc_percent\` (whole genome).
- \`legacy_id\`: id on the old site (https://www.mitoage.info/view/{legacy_id}/species/).
- AnAge traits: \`adult_weight_g\`, \`birth_weight_g\`, \`metabolic_rate_w\`, \`body_temperature_k\`, \`female_maturity_days\`,
  \`male_maturity_days\`, \`gestation_days\`, \`litter_size\`, \`litters_per_year\`, \`growth_rate_per_day\`, \`traits_source\`,
  \`anage_build15_hagrid\`, \`anage_match\`, \`anage_build15_max_longevity_years\`.
- \`ncbi_taxid\` (taxon of the RefSeq record, may be a subspecies), \`ncbi_species_taxid\` (species-rank join key),
  \`transl_table\` (NCBI genetic code used for amino acids).
- \`retired_reason\`, \`review_flags\` (open questions for curators, \`; \`-separated), \`change_kinds\` (what changed against
  build 1: genome, annotation, correction, lifespan, name, taxonomy, common_name, ncbi_taxid).

### region_stats.parquet (one row per species and region)
- \`species_id\`, \`slug\`, \`region\`: total_mtDNA, total_pc (all protein-coding genes, overlaps counted once), total_rRNA,
  total_tRNA, rRNA-12S, rRNA-16S, D_Loop, or one of the 13 protein genes.
- \`length_bp\`, \`a\`, \`c\`, \`g\`, \`t\`, \`other\` (ambiguity codes): base counts on the RefSeq strand as deposited.
  Segmented (join) features count their annotated segments only.
- \`gc_percent\` = 100 (G+C)/(A+C+G+T); \`gc_skew\` = (G-C)/(G+C); \`at_skew\` = (A-T)/(A+T).
- \`source\`: \`genbank\` (computed from the RefSeq record) or \`mitoage\` (build 1 value, label-fixed; retired rows).

### codon_usage.parquet (one row per species and protein-coding gene, plus \`total_pc\`)
- \`species_id\`, \`slug\`, \`region\`, \`transl_table\`, \`source\`; 64 codon count columns (\`AUU\`, \`CUA\`, ...), gene sense,
  complete codons only; \`aa_A\` .. \`aa_Y\`, \`aa_stop\`: amino-acid counts with the species' mitochondrial code.

### genome_features.parquet (one row per annotated feature)
- \`species_id\`, \`slug\`, \`feature_key\` (\`name#n\`, the n-th feature of that name in genome order; the changelog's row key),
  \`name\` (ND1..CYTB, rRNA-12S, rRNA-16S, D_Loop, tRNA-Phe, tRNA-Leu(UUR) ...), \`type\`, \`start\`, \`end\` (1-based inclusive;
  start > end wraps the origin), \`strand\`.

### lifespan_observations.parquet (one row per lifespan value per source)
- \`species_id\`, \`slug\`, \`ncbi_species_taxid\`, \`source\`, \`source_record_id\`, \`source_name\` (name as written in the source),
  \`value_years\`, \`record_type\`, \`quality\`, \`sample_size_text\`, \`sex\`, \`detail\`, \`reference\`, \`license\`, \`match_method\`
  (how the source record was matched to the NCBI species), \`is_chosen\` (this value is \`max_longevity_years\`).
- Ringing records (USGS BBL) are the oldest recaptured wild individual: they usually underestimate the maximum.

### changelog.parquet (one row per field change against build 1)
- \`build\`, \`changed_at\`, \`table\`, \`row_key\` (\`id\` or \`id:region\` / \`id:feature_key\`; \`*\` for a rule), \`field\` (\`(row)\` for a
  whole row added or removed), \`old_value\`, \`new_value\`, \`change_type\` (added, value_update, renamed, retired, correction),
  \`diff_class\` (what explains the change, e.g. rule_full_span, upstream_reannotation_same_version, refseq_successor),
  \`reason\`, \`upstream_source\`, \`upstream_version\`, \`scope\` (\`rule\`: a systematic correction, \`row\`: a single change).

### review_list.csv
Source records that could not be matched to one NCBI species without guessing, and other open curation questions.
They are excluded from the build until resolved.

### build1/ (frozen MitoAge build 1)
The 2015 build 1 CSV export, converted verbatim to parquet (one file per CSV, same rows, columns and values;
numbers only where the text round-trips exactly). It keeps the build 1 problems, among them the
complement-labelled base columns; build1/README.md lists them and the SHA-256 of every source CSV.

### Computed during the site build (not stored here)
\`correlations.parquet\` and \`explorer.json\` are derived from these files when the site is built and are served
next to them. Correlation datasets: ${(info.correlationDatasets ?? []).map((d) => `\`${d.dataset}\` (${d.species} species; lifespan sources ${d.lifespanSources.join(", ")}; ${d.filters})`).join("; ")}.

## Sources
${sources}

## Data notes
${info.notes.map((n) => `- ${n}`).join("\n")}
`;
}
