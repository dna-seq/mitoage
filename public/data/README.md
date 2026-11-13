# MitoAge data downloads

Build 2 (2026-11-13), generated 2026-11-13, 2335 species (updated 465, original 392, renamed 46, retired 19, new 1413).
Produced by `bun run data` (pipeline/ in the site repository). Parquet files can be read with
DuckDB, pandas/pyarrow, polars, R arrow or hyparquet.

**Licence of lifespan values.** Rows whose `lifespan_source` is `FishBase` or `SeaLifeBase` carry values
licensed CC BY-NC 4.0: they may be used for non-commercial purposes only, with attribution (Froese & Pauly,
FishBase; Palomares & Pauly, SeaLifeBase). Every species row carries its `lifespan_license`.

**EURING: not retrieved.** The EURING longevity list (2023-09-01), which ranks above the USGS Bird Banding
Laboratory for birds, could not be downloaded (euring.org was in maintenance). No EURING values are used; bird
lifespans taken from USGS BBL are provisional (review flag `lifespan_provisional_euring_not_retrieved`).

## Row metadata (every data table)
- `added_in_build` (1 or 2), `added_at` (ISO-8601 UTC; build 1 rows: 2015-07-01), `last_modified_build` and
  `last_modified_at` (null if the row never changed), `record_status` (`original`, `updated`, `new`, `renamed`,
  `retired`), `source_version` (upstream version used for the row, e.g. a RefSeq accession.version).
- Retired rows are never deleted: they keep their last values and are excluded from correlations.

## Files

### species.parquet / species.csv (one row per species)
- `id`: MitoAge species id. Build 1 species keep their build 1 id (the AnAge HAGRID of 2015); species added in
  build 2 have id 10,000,000 + NCBI species taxid. `slug`: URL slug (kept when a species is renamed).
- `scientific_name` (NCBI Taxonomy species name), `previous_scientific_names` (names in earlier builds, `; `-separated),
  `common_name`, `refseq` (versioned RefSeq accession), taxonomy `kingdom` .. `genus`. `class` uses the build 1
  scheme for every species (comparable with the 2016 paper).
- `max_longevity_years` and its provenance: `lifespan_source` (AnAge, FishBase, SeaLifeBase, USGS_BBL; MitoAge_build1 for
  a retired species with no current value), `lifespan_source_version`, `lifespan_source_record_id`, `lifespan_quality`
  (high, acceptable, questionable, low), `lifespan_sample_size` (AnAge), `lifespan_record_type` (captive, wild, observed,
  estimated, compiled), `lifespan_license`.
- `mtdna_size_bp`, `non_coding_bp` (bases not in any CDS, rRNA or tRNA, D-loop included), `gc_percent` (whole genome).
- `legacy_id`: id on the old site (https://www.mitoage.info/view/{legacy_id}/species/).
- AnAge traits: `adult_weight_g`, `birth_weight_g`, `metabolic_rate_w`, `body_temperature_k`, `female_maturity_days`,
  `male_maturity_days`, `gestation_days`, `litter_size`, `litters_per_year`, `growth_rate_per_day`, `traits_source`,
  `anage_build15_hagrid`, `anage_match`, `anage_build15_max_longevity_years`.
- `ncbi_taxid` (taxon of the RefSeq record, may be a subspecies), `ncbi_species_taxid` (species-rank join key),
  `transl_table` (NCBI genetic code used for amino acids).
- `retired_reason`, `review_flags` (open questions for curators, `; `-separated), `change_kinds` (what changed against
  build 1: genome, annotation, correction, lifespan, name, taxonomy, common_name, ncbi_taxid).

### region_stats.parquet (one row per species and region)
- `species_id`, `slug`, `region`: total_mtDNA, total_pc (all protein-coding genes, overlaps counted once), total_rRNA,
  total_tRNA, rRNA-12S, rRNA-16S, D_Loop, or one of the 13 protein genes.
- `length_bp`, `a`, `c`, `g`, `t`, `other` (ambiguity codes): base counts on the RefSeq strand as deposited.
  Segmented (join) features count their annotated segments only.
- `gc_percent` = 100 (G+C)/(A+C+G+T); `gc_skew` = (G-C)/(G+C); `at_skew` = (A-T)/(A+T).
- `source`: `genbank` (computed from the RefSeq record) or `mitoage` (build 1 value, label-fixed; retired rows).

### codon_usage.parquet (one row per species and protein-coding gene, plus `total_pc`)
- `species_id`, `slug`, `region`, `transl_table`, `source`; 64 codon count columns (`AUU`, `CUA`, ...), gene sense,
  complete codons only; `aa_A` .. `aa_Y`, `aa_stop`: amino-acid counts with the species' mitochondrial code.

### genome_features.parquet (one row per annotated feature)
- `species_id`, `slug`, `feature_key` (`name#n`, the n-th feature of that name in genome order; the changelog's row key),
  `name` (ND1..CYTB, rRNA-12S, rRNA-16S, D_Loop, tRNA-Phe, tRNA-Leu(UUR) ...), `type`, `start`, `end` (1-based inclusive;
  start > end wraps the origin), `strand`.

### lifespan_observations.parquet (one row per lifespan value per source)
- `species_id`, `slug`, `ncbi_species_taxid`, `source`, `source_record_id`, `source_name` (name as written in the source),
  `value_years`, `record_type`, `quality`, `sample_size_text`, `sex`, `detail`, `reference`, `license`, `match_method`
  (how the source record was matched to the NCBI species), `is_chosen` (this value is `max_longevity_years`).
- Ringing records (USGS BBL) are the oldest recaptured wild individual: they usually underestimate the maximum.

### changelog.parquet (one row per field change against build 1)
- `build`, `changed_at`, `table`, `row_key` (`id` or `id:region` / `id:feature_key`; `*` for a rule), `field` (`(row)` for a
  whole row added or removed), `old_value`, `new_value`, `change_type` (added, value_update, renamed, retired, correction),
  `diff_class` (what explains the change, e.g. rule_full_span, upstream_reannotation_same_version, refseq_successor),
  `reason`, `upstream_source`, `upstream_version`, `scope` (`rule`: a systematic correction, `row`: a single change).

### review_list.csv
Source records that could not be matched to one NCBI species without guessing, and other open curation questions.
They are excluded from the build until resolved.

### build1/ (frozen MitoAge build 1)
The 2015 build 1 CSV export, converted verbatim to parquet (one file per CSV, same rows, columns and values;
numbers only where the text round-trips exactly). It keeps the build 1 problems, among them the
complement-labelled base columns; build1/README.md lists them and the SHA-256 of every source CSV.

### Computed during the site build (not stored here)
`correlations.parquet` and `explorer.json` are derived from these files when the site is built and are served
next to them. Correlation datasets: `default` (2202 species; lifespan sources AnAge, FishBase, SeaLifeBase, USGS_BBL; record_status != retired; lifespan_record_type != estimated; lifespan_quality not in (low, questionable)); `anage_only` (1710 species; lifespan sources AnAge; record_status != retired; lifespan_record_type != estimated; lifespan_quality not in (low, questionable)).

## Sources
- MitoAge build 1, Build 1 (2015-07-01), full database CSV export (frozen in public/data/build1/): https://www.mitoage.info/ (Free for all purposes provided MitoAge is cited (Toren et al. 2016, Nucleic Acids Res 44:D1262-D1265))
- NCBI RefSeq mitochondrion release, release 237 (mitochondrion.1.genomic.gbff.gz, file date 2026-09-03); retrieved 2026-11-13: https://ftp.ncbi.nlm.nih.gov/refseq/release/mitochondrion/ (NCBI molecular data are free of use restrictions (NCBI website and data usage policies))
- NCBI Taxonomy (new_taxdump), new_taxdump of 2026-11-13 (Last-Modified 2026-11-13T00:42:20Z); retrieved 2026-11-13: https://ftp.ncbi.nlm.nih.gov/pub/taxonomy/new_taxdump/ (NCBI Taxonomy is free of use restrictions (NCBI website and data usage policies); cite Schoch et al. 2020, Database baaa062)
- AnAge, AnAge build 15 (2023-07-03); retrieved 2026-11-13: https://genomics.senescence.info/species/dataset.zip (Free to use, subject to the Human Ageing Genomic Resources conditions of use (https://genomics.senescence.info/legal.html); cite Tacutu et al. 2013, Nucleic Acids Res 41:D1027-D1033)
- FishBase, FishBase v26.06 (source.coop cboettig/fishbase, files 2026-09-04); retrieved 2026-11-13: https://source.coop/cboettig/fishbase (fb/v26.06/parquet) (CC BY-NC 4.0 (FishBase.org team; source.coop cboettig/fishbase dataset card): non-commercial use only; cite Froese & Pauly, FishBase)
- SeaLifeBase, SeaLifeBase v26.06 (source.coop cboettig/fishbase, files 2026-09-04); retrieved 2026-11-13: https://source.coop/cboettig/fishbase (slb/v26.06/parquet) (CC BY-NC 4.0 (SeaLifeBase/FishBase.org team; source.coop cboettig/fishbase dataset card): non-commercial use only; cite Palomares & Pauly, SeaLifeBase)
- USGS Bird Banding Laboratory longevity records, NABBP Longevity Records v2025.1 (current through Dec 2025); retrieved 2026-11-13: https://www.pwrc.usgs.gov/BBL/Bander_Portal/login/Longevity.php (U.S. Government work (USGS), presumed public domain; cite Bird Banding Laboratory, NABBP Longevity Records v2025.1, USGS EESC, Laurel MD (usgs.gov terms page returned HTTP 403, not verified))
- EURING longevity list, list of 2023-09-01: NOT RETRIEVED (euring.org in maintenance on 2026-11-13); no EURING values used: https://euring.org/data-and-codes/longevity-list (not checked (site unavailable when build 2 was assembled))
- NCBI RefSeq records cited by build 1 (E-utilities efetch, cached), 922 versioned records: https://www.ncbi.nlm.nih.gov/refseq/ (NCBI molecular data are free of use restrictions (NCBI website and data usage policies))
- Open Tree of Life synthetic tree, opentree16.1: https://tree.opentreeoflife.org/ (CC0 1.0 (Open Tree of Life data); cite Hinchliff et al. 2015, PNAS 112:12764)
- TimeTree 5, public API (api.timetree.org): https://timetree.org/ (Free public resource; cite Kumar et al. 2022, Mol Biol Evol 39:msac174)

## Data notes
- The build 1 CSV export has 923 species but the published release has 922: Loxioides bailleui (HAGRID 1598, NC_025626.1) is excluded: RefSeq NC_025626.1 is titled 'complete genome' but is only 9,243 bp (about 7 kb short of a complete avian mtDNA).
- EURING: not retrieved. The EURING longevity list (list of 2023-09-01) is not in the cache (data/cache/build2/sources/euring/2023-09-01/euring_longevity_2023-09-01.csv); euring.org was in maintenance on 2026-11-13. No EURING values are used; bird lifespans from USGS BBL are provisional because EURING outranks them.
- 6 records used from release 237 (mitochondrion.1.genomic.gbff.gz, file date 2026-09-03) carry only a CONTIG line (no sequence) in the release file; their sequence and features were taken from the same accession.version retrieved with NCBI efetch (rettype gbwithparts), checked to have the release's length: NC_053523.1, NC_054728.1, NC_059324.1, NC_059325.1, NC_080739.1, NC_091244.1.
- Dated tree: topology from the Open Tree of Life synthetic tree (opentree16.1, induced subtree of 2305 of 2335 species, polytomies kept); node ages from the TimeTree 5 API for 2045 of 2229 internal nodes; 184 undated nodes placed midway between parent and oldest child, 61 ages raised to keep parents older than children. 30 species are not in the tree: their PIC contribution is unknown (they are left out of PIC, not given values). PIC (Felsenstein 1985) correlations are computed during the site build on this tree.
- Build 2 (2026-11-13): 2335 species = 922 from build 1 + 1413 new. Record status: updated 465, original 392, renamed 46, retired 19, new 1413. Every value of a build 1 species that changed is in changelog.parquet with its old value and the reason; build 1 itself is frozen in build1/.
- Genome values (region statistics, codon usage, genome features) of every live species are computed from the RefSeq record in release 237 (mitochondrion.1.genomic.gbff.gz, file date 2026-09-03); for build 1 species that is the same accession.version they cited (or its newer version, or a live successor when the record was suppressed). Retired species keep their build 1 values.
- Base-label bug of build 1: in every MitoAge CSV file the base columns are complement-labelled ("G" holds C on the RefSeq strand, "C" holds G, "A" holds T, "T" holds A). All a/c/g/t here are on the RefSeq strand as deposited; GC% is unaffected, GC and AT skews change sign relative to the old site.
- Lifespan: AnAge build 15 always first; when AnAge has no value, fish take FishBase v26.06, aquatic invertebrates SeaLifeBase v26.06 and birds EURING (not retrieved) then USGS BBL v2025.1. Every value from every source is in lifespan_observations.parquet. Values from FishBase and SeaLifeBase are CC BY-NC 4.0 (non-commercial).
- Class labels follow the build 1 scheme (AnAge build 12-era: Actinopterygii, Reptilia, ...) for every species, so correlation scopes stay comparable with the 2016 paper; AnAge build 15's fish reclassification (Teleostei, ...) is not adopted.
