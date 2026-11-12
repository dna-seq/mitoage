# MitoAge data downloads

Build 2.0 (2026-11-12), generated 2026-11-12, 922 species.
Produced by `bun run data` (pipeline/ in the site repository). Parquet files can be read with
DuckDB, pandas/pyarrow, polars, R arrow or hyparquet.

## Files

### species.parquet / species.csv (one row per species)
- `id`: MitoAge species id (AnAge HAGRID at the time of MitoAge build 1); `slug`: URL slug.
- `scientific_name`, `common_name`, `refseq` (versioned RefSeq accession), taxonomy `kingdom` .. `genus` (MitoAge build 1).
- `max_longevity_years`: maximum recorded lifespan used by MitoAge build 1.
- `mtdna_size_bp`, `non_coding_bp` (bases not in any CDS, rRNA or tRNA, D-loop included), `gc_percent` (whole genome).
- `legacy_id`: id on the old site (https://www.mitoage.info/view/{legacy_id}/species/).
- AnAge traits: `adult_weight_g`, `birth_weight_g`, `metabolic_rate_w`, `body_temperature_k`, `female_maturity_days`,
  `male_maturity_days`, `gestation_days` (gestation or incubation), `litter_size` (litter or clutch), `litters_per_year`,
  `growth_rate_per_day`; `traits_source`; `anage_build15_hagrid`; `anage_match` (how the AnAge entry was matched);
  `anage_build15_max_longevity_years` (current AnAge value, may differ from `max_longevity_years`).
- `ncbi_taxid`, `transl_table` (NCBI genetic code used for amino acids).

### region_stats.parquet (one row per species and region)
- `species_id`, `slug`, `region`: total_mtDNA, total_pc (all protein-coding genes, overlaps counted once), total_rRNA,
  total_tRNA, rRNA-12S, rRNA-16S, D_Loop, or one of the 13 protein genes.
- `length_bp`, `a`, `c`, `g`, `t`, `other` (ambiguity codes): base counts on the RefSeq strand as deposited
  (for minus-strand genes such as ND6 this is the complement of the gene sense).
- `gc_percent` = 100 (G+C)/(A+C+G+T); `gc_skew` = (G-C)/(G+C); `at_skew` = (A-T)/(A+T).
- `source`: `mitoage` (MitoAge build 1 values with the base-label fix) or `genbank` (recomputed from RefSeq where the CSV had none).

### codon_usage.parquet (one row per species and protein-coding gene, plus `total_pc`)
- `species_id`, `slug`, `region`, `transl_table`, `source`.
- 64 codon count columns named by RNA codon (`AUU`, `CUA`, ...), gene sense, complete codons only.
- `aa_A` .. `aa_Y`, `aa_stop`: amino-acid counts derived with the species' mitochondrial genetic code.

### genome_features.parquet (one row per annotated feature)
- `species_id`, `slug`, `name` (normalised: ND1..CYTB, rRNA-12S, rRNA-16S, D_Loop, tRNA-Phe, tRNA-Leu(UUR) ...),
  `type` (CDS, rRNA, tRNA, D-loop), `start`, `end` (1-based inclusive; start > end wraps the origin), `strand` (1 or -1).

### correlations.parquet (one row per feature, trait and scope)
- `feature_key` (e.g. `gc:total_mtDNA`, `gcSkew:ND6`, `size:D_Loop`, `codon:total_pc:CUA`, `aa:ND5:L`), `trait`, `scope`
  (`all`, `class:Mammalia`, `order:Primates`, ...), `n`.
- `pearson_r`, `spearman_rho`: feature vs log10(trait); `p_value` (two-tailed); `q_value` (Benjamini-Hochberg within trait and scope).
- `partial_r`, `partial_p_value`, `partial_n`: for max longevity only, controlling for log10 adult weight.
- `pic_r`, `pic_p_value`: phylogenetically independent contrasts on the dated tree (null when unavailable).

Feature keys: `size:` length in bp, `gc:` GC%, `gcSkew:`/`atSkew:` skews, `noncoding:total_mtDNA`,
`codon:REGION:XYZ` percent of all codons in the region, `aa:REGION:X` percent of sense codons.

### explorer.json
Compact columnar copy of species names, taxonomy (class/order/family as indices into the listed names), traits and
every feature value except per-gene codon and amino-acid features, for the in-browser scatter explorer.

## Sources
- MitoAge build 1, Build 1 (July 1, 2015), full database CSV export: https://www.mitoage.info/ (Free for all purposes provided MitoAge is cited (Toren et al. 2016, Nucleic Acids Res 44:D1262-D1265))
- AnAge, Build 15 (released July 3, 2023): https://genomics.senescence.info/species/dataset.zip (Free to use, subject to the Human Ageing Genomic Resources conditions of use (https://genomics.senescence.info/legal.html); cite Tacutu et al. 2013, Nucleic Acids Res 41:D1027-D1033)
- NCBI RefSeq (E-utilities efetch), 922 versioned mitochondrial RefSeq records, retrieved 2026-11-12 or earlier (cached): https://www.ncbi.nlm.nih.gov/refseq/ (NCBI molecular data are free of use restrictions (NCBI website and data usage policies))
- Open Tree of Life synthetic tree, opentree16.1: https://tree.opentreeoflife.org/ (CC0 1.0 (Open Tree of Life data); cite Hinchliff et al. 2015, PNAS 112:12764)
- TimeTree 5, public API (api.timetree.org): https://timetree.org/ (Free public resource; cite Kumar et al. 2022, Mol Biol Evol 39:msac174)

## Data notes
- The CSV export has 923 species but the published MitoAge release has 922. The extra record is Loxioides bailleui (HAGRID 1598, NC_025626.1): RefSeq NC_025626.1 is titled 'complete genome' but is only 9,243 bp (about 7 kb short of a complete avian mtDNA). It is not a duplicate and it is not listed on the legacy site, whose total_mtDNA export lists 922 species. It is excluded from this build.
- AnAge Build 15 renumbered HAGRIDs, so traits are joined on scientific name, not HAGRID: 896 species match by scientific name and 26 by a unique common-name match after taxonomic renaming (Phoxinus eos -> Chrosomus eos; Maccullochella peeli -> Maccullochella peelii; Psetta maxima -> Scophthalmus maximus; Rana nigromaculata -> Pelophylax nigromaculatus; Batrachuperus mustersi -> Paradactylodon mustersi; Carduelis pinus -> Spinus pinus; Carduelis psaltria -> Spinus psaltria; Carduelis spinus -> Spinus spinus; Hemignathus munroi -> Hemignathus wilsoni; Hemignathus parvus -> Magumma parva; Lama pacos -> Vicugna pacos; Rucervus eldi -> Rucervus eldii; Callithrix pygmaea -> Cebuella pygmaea; Aotus azarai -> Aotus azarae; Cebus apella -> Sapajus apella; Lagothrix lagotricha -> Lagothrix lagothricha; Cercopithecus lhoesti -> Allochrocebus lhoesti; Trachypithecus johnii -> Semnopithecus johnii; Trachypithecus vetulus -> Semnopithecus vetulus; Callicebus cupreus -> Plecturocebus cupreus; Callicebus donacophilus -> Plecturocebus donacophilus; Tarsius bancanus -> Cephalopachus bancanus; Tarsius syrichta -> Carlito syrichta; Nannospalax ehrenbergi -> Spalax ehrenbergi; Daboia russellii -> Daboia russelii; Chelus fimbriata -> Chelus fimbriatus); 0 unmatched. Species ids remain the MitoAge (AnAge build 12-era) HAGRIDs; the current AnAge HAGRID is given in traits.source.
- maxLongevityYears is the MitoAge build 1 value (as in the 2016 paper). For 59 species AnAge Build 15 now gives a different maximum longevity; the current value is in the downloads (anage_build15_max_longevity_years).
- Base-label bug: in every MitoAge CSV file the base columns are complement-labelled. The column "G" holds the number of C on the RefSeq strand, "C" holds G, "A" holds T and "T" holds A. Example: Homo sapiens NC_012920.1 has G=5181, C=2169, A=4094, T=5124 in the CSV, while the deposited sequence (rCRS) has A=5124, C=5181, G=2169, T=4094. The same complement relation holds for total_mtDNA in all 922 of 922 species and for every gene and aggregate file on the RefSeq (+) strand, including minus-strand genes such as ND6 (it is not a gene-sense or strand effect: the original pipeline counted the complementary strand). All RegionStats a/c/g/t here are corrected to the RefSeq strand as deposited; GC% is unaffected, GC and AT skews change sign relative to the old site. Codon counts were verified separately and are correctly labelled (gene sense).
- Recomputing every region from the RefSeq sequence and current annotation reproduces the label-fixed CSV counts exactly for 17677/18030 species-region pairs (98.0%); with the original labels only 0 match. Per region: total_mtDNA 922/922, total_pc 769/919, total_rRNA 920/922, total_tRNA 919/922, rRNA-12S 915/915, rRNA-16S 914/916, ND1 907/919, ND2 902/919, COX1 914/919, COX2 916/919, ATP8 916/917, ATP6 917/919, COX3 908/919, ND3 797/919, ND4L 917/919, ND4 915/919, ND5 911/918, ND6 916/918, CYTB 910/917, D_Loop 572/573. Mismatches are annotation updates in RefSeq since 2015 (typically CDS ends moved by 1-3 bp around incomplete stop codons, or frameshifted ND3 split into joined segments). CSV values are kept where present.
- Regions missing from the CSV export but annotated in the current RefSeq record were computed from the sequence (RegionStats.source = "genbank"): D_Loop 263, rRNA-12S 7, rRNA-16S 6, CYTB 5, total_pc 3, ND1 3, ND2 3, COX1 3, COX2 3, ATP8 3, ATP6 3, COX3 3, ND3 3, ND4L 3, ND4 3, ND5 3, ND6 3. D-loop values include misc_feature "control region" annotations when a record has no D-loop feature.
- Duplicate CSV rows resolved: rRNA-16S of HAGRID 2497: 2 CSV rows (lengths 956, 1574), kept 1574 bp (matches RefSeq annotation); rRNA-16S of HAGRID 3897: 2 CSV rows (lengths 1552, 1552), kept 1552 bp (matches RefSeq annotation); rRNA-16S of HAGRID 4026: 2 CSV rows (lengths 915, 1487), kept 1487 bp (matches RefSeq annotation).
- 3 species had no gene-level rows in the CSV export because their RefSeq records were unannotated in 2015 (Carcharhinus longimanus, Isurus oxyrinchus, Carettochelys insculpta); their gene statistics, codon usage and non-coding length come from the current RefSeq annotation.
- Codon counts in the CSV are correctly labelled (gene sense, RNA alphabet): recounting codons from the RefSeq CDS features reproduces 11894/11941 gene rows exactly (99.6%); the rest differ only where CDS coordinates were re-annotated. total_pc equals the sum of the 13 genes in 914/919 species. Amino-acid counts use the NCBI genetic code given in each record (/transl_table: 2 vertebrate, 5 invertebrate, 9 echinoderm mitochondrial); AGA/AGG count as stops under table 2.
- Genome features come from the RefSeq feature tables (922 species; 912 with at least 13 CDS, 2 rRNA and 22 tRNA). Names are normalised across synonyms (COI/COX1/CO1, ATPase6, cob/CYTB, s-rRNA/rrnS/12S, trnF/tRNA-Phe ...). The two leucine and two serine tRNAs are named by codon family (tRNA-Leu(UUR), tRNA-Leu(CUN), tRNA-Ser(UCN), tRNA-Ser(AGY)) from the /anticodon qualifier (361), "codons recognized" notes (2524), product text (23), HGNC-style numbering TRNL1/TRNL2 (3) or conserved gene order (Leu(UUR) after 16S, Ser(UCN) after COX1: 773); 8 remain plain tRNA-Leu/tRNA-Ser. Coordinates are 1-based inclusive; start > end marks a feature spanning the origin.
- Dated tree: topology from the Open Tree of Life synthetic tree (opentree16.1, induced subtree of 921 of 922 species, polytomies kept); node ages from the TimeTree 5 API (MRCA age of representative descendants by NCBI taxon id) for 862 of 903 internal nodes; 41 undated nodes were placed midway between parent and oldest child and 21 ages were raised to keep parents older than children. Root age 692 Mya. Taxonomy branchLengthMya is the difference between the crown ages (MRCA in this tree) of a taxon and its parent within this species set. PIC (Felsenstein 1985) correlations use this tree; polytomies are resolved with zero-length branches.
- Correlations: Pearson r and Spearman rho between each feature and the log10-transformed trait, two-tailed p from the t distribution, Benjamini-Hochberg q within each (trait, scope). Scopes: all species, classes and orders with at least 20 species (18 scopes); per-gene codon and amino-acid features are tested in "all" and class scopes only. Rows need at least 10 species with both values. For maxLongevityYears, partialR is the partial correlation with log10 lifespan controlling for log10 adult weight (AnAge).
