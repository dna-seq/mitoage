# MitoAge data downloads

Build 2 (2026-11-13), generated 2026-11-13, 2344 species (updated 465, original 392, renamed 46, retired 19, new 1422).
Produced by `bun run data` (pipeline/ in the site repository). Parquet files can be read with
DuckDB, pandas/pyarrow, polars, R arrow or hyparquet.

**Licence of lifespan values.** Rows whose `lifespan_source` is `FishBase` or `SeaLifeBase` carry values
licensed CC BY-NC 4.0: they may be used for non-commercial purposes only, with attribution (Froese & Pauly,
FishBase; Palomares & Pauly, SeaLifeBase). Every species row carries its `lifespan_license`.
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
- `max_longevity_years` and its provenance: `lifespan_source` (AnAge, FishBase, SeaLifeBase, EURING, USGS_BBL; MitoAge_build1 for
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
  Every protein gene a live species lacks is named by a flag that gives the reason: `gene_absent_from_record:`,
  `gene_frameshifted_in_record:`, `gene_not_annotated:`, `gene_lost_in_lineage:`, or `gene_unexplained_absence:`
  when none is recorded yet. `gene_annotated_by_mitoage:` marks a gene intact in the record's sequence but not annotated
  there, which the build adds from a hand-checked list (`pipeline/sources/gene-annotation.ts`; the changelog row,
  `diff_class` annotation_patch, says how it was checked).

- `data_confidence`: how far the record can be relied on, one of high, caveat, low, unreliable; `data_confidence_reasons`
  (`; `-separated) says why. No row is removed for its level; a record of the level unreliable is in no correlation
  dataset. unreliable: the record is retired, or its sequence is not this species' genome as it stands. low: the
  lifespan value is weak (estimated, or rated low or questionable by its source); the mitochondrial data are not in
  question. caveat: usable, with the caveat named. The reasons:
  - `retired` (unreliable): the record is retired
  - `sequence_other_species` (unreliable): the record's protein genes are another species'
  - `sequence_chimera` (unreliable): the record joins genes of two unrelated species
  - `sequence_one_genome_names` (unreliable): distinct species carry this same genome, and which name is right is not settled
  - `sequence_truncated` (unreliable): the record is not a complete genome
  - `record_other_species` (unreliable): the cited record now belongs to another species at NCBI
  - `reverse_complement` (unreliable): the record is deposited as the reverse complement, so strand-dependent values (skews) have the opposite sign
  - `no_rrna` (unreliable): no rRNA gene is annotated in the record
  - `lifespan_estimated` (low): the lifespan is an estimate from a growth study, not an observed age
  - `lifespan_low_quality` (low): the source rates the lifespan record low
  - `lifespan_questionable` (low): the source rates the lifespan record questionable
  - `lifespan_ungraded` (low): the lifespan record has no source and no quality
  - `subspecies_record` (caveat): the genome is a subspecies' or a form's record standing for the species
  - `sequence_errors` (caveat): sequencing errors or nuclear copies are reported for the record, or genes do not translate as annotated
  - `specimen_doubt` (caveat): the record's qualifiers name another species' breed or form
  - `ringing_record` (caveat): the lifespan is a ringing recovery, a minimum age in the wild
  - `other_source_higher` (caveat): another source reports a lifespan at least 1.5 times higher
  - `tiny_sample` (caveat): the lifespan rests on a tiny sample
  - `ambiguous_bases` (caveat): the genome has 50 or more ambiguous bases
  - `possible_duplicate` (caveat): the species may be the same as another in the database
  - `source_match_in_review` (caveat): the match of the lifespan record to this species is under review
  - `gene_missing` (caveat): a protein gene is missing from the record's annotation
  Not checked by any rule, so "high" does not vouch for it: names against authorities other than NCBI; sequence identity to other species, beyond the records listed in pipeline/curation/sequence-audit.ts; internal stop codons and nuclear copies; the lifespan value against its primary reference.

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

### mtdna_structure.parquet (one row per species)
- `orientation`: `canonical` (a chordate record with all 13 protein genes, every ND6 on the - strand and every
  other protein gene on the + strand, so the RefSeq + strand is the light strand), `noncanonical`,
  `not_chordate` (heavy/light notation not defined), `unknown` (no RefSeq record).
- `major_arc_start`, `major_arc_end` (1-based inclusive; start > end wraps the origin), `major_arc_bp`: the arc
  between the replication origins, from the base after tRNA-Asn to the base before the first control region
  downstream of CYTB, measured along the circle. Null unless the orientation is canonical and the landmarks are
  single, do not span the origin and follow that circular order.
- `control_regions`: annotated control regions. A count of 1 is a lower bound: short-read assemblies can miss
  duplicated control regions.
- `direct_repeats_*`, `inverted_repeats_*`, `mirror_repeats_*`, `longest_direct_repeat_*`: perfect repeat pairs of
  at least `repeat_min_length` bases in the whole record (`_total`, read as linear) and in the major arc. Each pair
  is maximal and counted once and its copies do not overlap. An inverted repeat's second copy is the reverse
  complement of the first; a mirror repeat's is the first read backwards without complementing, which is a
  non-B DNA class in its own right and not a superset of the inverted repeats.
- `contact_zone1_*`, `contact_zone2_*`: the ATP8-COX3 and ND5-CYTB spans that flank most human mitochondrial
  deletions. Human work gives these as roughly 6-9 kb and 13-16 kb, but kilobase coordinates do not transfer
  between species, so the zones are anchored on the genes. Null unless all four are annotated once, none spans
  the origin and they appear in that order. `contact_zone_{direct,inverted,mirror}_pairs`: repeat pairs with one
  arm in each zone, the configuration a deletion between them would use.
- Non-B motifs and simple repeats, for the whole record (`_total`) and the major arc (`_major_arc`):
  `g4_forward`, `g4_reverse` (four runs of at least 3 G, loops of 1 to 7 bases, counted per strand),
  `purine_tracts`, `pyrimidine_tracts` (homopurine and homopyrimidine runs of at least 15 bases, triplex
  candidates), `homopolymer_runs`, `longest_homopolymer` (runs of one base, at least 5), and
  `str_dinucleotide`, `str_trinucleotide`, `str_tetranucleotide`, `str_bases` (perfect tandem repeats of at least
  3 whole units; a unit built from a shorter period is counted at that shorter unit length, so the three counts
  do not double-count the same bases). These are sequence patterns, not thermodynamic predictions, and they
  depend on how the genome was assembled.

### protein_gene_features.parquet (one row per species and region)
- `region`: one of the 13 protein genes, `total_pc` (all 13), or `major12` (the 12 genes on the + strand;
  canonical orientation only). `transl_table`; `strand` (null for the aggregates).
- `ff_sites`, `ff_a`, `ff_c`, `ff_g`, `ff_u`: third-position bases of codons in fourfold-degenerate families,
  gene sense. `ffh_a`, `ffh_c`, `ffh_g`, `ffh_t`: the same in heavy-strand notation (the complement for + strand
  genes, the gene sense for ND6); null unless the orientation is canonical, and always null for `total_pc`.
- `gravy`: mean Kyte-Doolittle hydropathy over the encoded amino acids.

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
next to them. Correlation datasets: `default` (2171 species; lifespan sources AnAge, FishBase, SeaLifeBase, EURING, USGS_BBL; record_status != retired; data_confidence != unreliable; lifespan_record_type != estimated; lifespan_quality not in (low, questionable)); `anage_only` (1678 species; lifespan sources AnAge; record_status != retired; data_confidence != unreliable; lifespan_record_type != estimated; lifespan_quality not in (low, questionable)).

## Sources
- MitoAge build 1, Build 1 (2015-07-01), full database CSV export (frozen in public/data/build1/): https://www.mitoage.info/ (Free for all purposes provided MitoAge is cited (Toren et al. 2016, Nucleic Acids Res 44:D1262-D1265))
- NCBI RefSeq mitochondrion release, release 237 (mitochondrion.1.genomic.gbff.gz, file date 2026-09-03); retrieved 2026-11-13: https://ftp.ncbi.nlm.nih.gov/refseq/release/mitochondrion/ (NCBI molecular data are free of use restrictions (NCBI website and data usage policies))
- NCBI Taxonomy (new_taxdump), new_taxdump of 2026-11-13 (Last-Modified 2026-11-13T00:42:20Z); retrieved 2026-11-13: https://ftp.ncbi.nlm.nih.gov/pub/taxonomy/new_taxdump/ (NCBI Taxonomy is free of use restrictions (NCBI website and data usage policies); cite Schoch et al. 2020, Database baaa062)
- AnAge, AnAge build 15 (2023-07-03); retrieved 2026-11-13: https://genomics.senescence.info/species/dataset.zip (Free to use, subject to the Human Ageing Genomic Resources conditions of use (https://genomics.senescence.info/legal.html); cite Tacutu et al. 2013, Nucleic Acids Res 41:D1027-D1033)
- FishBase, FishBase v26.06 (source.coop cboettig/fishbase, files 2026-09-04); retrieved 2026-11-13: https://source.coop/cboettig/fishbase (fb/v26.06/parquet) (CC BY-NC 4.0 (FishBase.org team; source.coop cboettig/fishbase dataset card): non-commercial use only; cite Froese & Pauly, FishBase)
- SeaLifeBase, SeaLifeBase v26.06 (source.coop cboettig/fishbase, files 2026-09-04); retrieved 2026-11-13: https://source.coop/cboettig/fishbase (slb/v26.06/parquet) (CC BY-NC 4.0 (SeaLifeBase/FishBase.org team; source.coop cboettig/fishbase dataset card): non-commercial use only; cite Palomares & Pauly, SeaLifeBase)
- EURING longevity list, list of 2023-09-01 (EURING_longevity_list_20230901.pdf, Internet Archive capture of 2026-10-11); retrieved 2026-11-15: https://web.archive.org/web/20261011111048id_/https://euring.org/files/documents/EURING_longevity_list_20230901.pdf (no licence stated on the list or its page (euring.org/data-and-codes/longevity-list-2023); cite Fransson, Kolehmainen, Moss & Robinson (2023) EURING list of longevity records for European birds)
- USGS Bird Banding Laboratory longevity records, NABBP Longevity Records v2025.1 (current through Dec 2025); retrieved 2026-11-13: https://www.pwrc.usgs.gov/BBL/Bander_Portal/login/Longevity.php (U.S. Government work (USGS), presumed public domain; cite Bird Banding Laboratory, NABBP Longevity Records v2025.1, USGS EESC, Laurel MD (usgs.gov terms page returned HTTP 403, not verified))
- NCBI RefSeq records cited by build 1 (E-utilities efetch, cached), 922 versioned records: https://www.ncbi.nlm.nih.gov/refseq/ (NCBI molecular data are free of use restrictions (NCBI website and data usage policies))
- Open Tree of Life synthetic tree, opentree16.1: https://tree.opentreeoflife.org/ (CC0 1.0 (Open Tree of Life data); cite Hinchliff et al. 2015, PNAS 112:12764)
- TimeTree 5, public API (api.timetree.org): https://timetree.org/ (Free public resource; cite Kumar et al. 2022, Mol Biol Evol 39:msac174)

## Data notes
- The build 1 CSV export has 923 species but the published release has 922: Loxioides bailleui (HAGRID 1598, NC_025626.1) is excluded: RefSeq NC_025626.1 is titled 'complete genome' but is only 9,243 bp (about 7 kb short of a complete avian mtDNA).
- 6 records used from release 237 (mitochondrion.1.genomic.gbff.gz, file date 2026-09-03) carry only a CONTIG line (no sequence) in the release file; their sequence and features were taken from the same accession.version retrieved with NCBI efetch (rettype gbwithparts), checked to have the release's length: NC_053523.1, NC_054728.1, NC_059324.1, NC_059325.1, NC_080739.1, NC_091244.1.
- Confidence level of the records (high 1896, caveat 275, low 111, unreliable 62): the level and its reasons are in species.data_confidence and data_confidence_reasons; a record of the level "unreliable" is in no correlation dataset.
- Dated tree: topology from the Open Tree of Life synthetic tree (opentree16.1, induced subtree of 2314 of 2344 species, polytomies kept); node ages from the TimeTree 5 API for 2054 of 2238 internal nodes; 184 undated nodes placed midway between parent and oldest child, 61 ages raised to keep parents older than children. 30 species are not in the tree: their PIC contribution is unknown (they are left out of PIC, not given values). PIC (Felsenstein 1985) correlations are computed during the site build on this tree.
- Build 2 (2026-11-13): 2344 species = 922 from build 1 + 1422 new. Record status: updated 465, original 392, renamed 46, retired 19, new 1422. Every value of a build 1 species that changed is in changelog.parquet with its old value and the reason; build 1 itself is frozen in build1/.
- Genome values (region statistics, codon usage, genome features) of every live species are computed from the RefSeq record in release 237 (mitochondrion.1.genomic.gbff.gz, file date 2026-09-03); for build 1 species that is the same accession.version they cited (or its newer version, or a live successor when the record was suppressed). Retired species keep their build 1 values.
- Base-label bug of build 1: in every MitoAge CSV file the base columns are complement-labelled ("G" holds C on the RefSeq strand, "C" holds G, "A" holds T, "T" holds A). All a/c/g/t here are on the RefSeq strand as deposited; GC% is unaffected, GC and AT skews change sign relative to the old site.
- Lifespan: AnAge build 15 always first; when AnAge has no value, fish take FishBase v26.06, aquatic invertebrates SeaLifeBase v26.06 and birds the EURING list of 2023-09-01 then USGS BBL v2025.1. Every value from every source is in lifespan_observations.parquet. Values from FishBase and SeaLifeBase are CC BY-NC 4.0 (non-commercial).
- Class labels follow the build 1 scheme (AnAge build 12-era: Actinopterygii, Reptilia, ...) for every species, so correlation scopes stay comparable with the 2016 paper; AnAge build 15's fish reclassification (Teleostei, ...) is not adopted.
- Orientation of the RefSeq records (canonical 2206, noncanonical 15, not_chordate 104, unknown 19). Heavy-strand (ffH) values are given only for canonical records; for the others the heavy strand is not identified from the record and the values are null.
- Major arc defined for 1916 of 2344 species; the two deletion contact zones (ATP8-COX3 and ND5-CYTB) for 2225. Null otherwise, never guessed.
- Repeat, motif and contact-zone counts are read from the deposited sequence as linear, and depend on how the genome was assembled: short-read records can miss repeats and duplicated control regions.
