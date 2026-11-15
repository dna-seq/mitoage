# Changelog

Newest first.

## Unreleased

- **The title page names the corresponding author's email and HEALES's city** (2026-11-15, the v0.3 run's decision
  JA-8): round v0.3 now reads "\* Corresponding author: robi.tacutu@gmail.com.", as the maintainer gave it, and
  affiliation 4 reads "HEALES (Healthy Life Extension Society), Brussels, Belgium", from heales.org's contact page
  ("Heales vzw – asbl, 18 rue Jules Delhaizestraat, 1080 Brussels"; the page names no country).

- **Table 3 shows the sign-flip count beside the t test** (2026-11-15, D13): a "Both (sign-flip)" column in Table 3
  and Supplementary Table S1 of round v0.3 (533 of 4,299 over 32 scopes), from the published correlation table;
  the t-test counts stay the headline, as D10 decided.

- **TimeTree's redistribution terms: left as they are, by the maintainer's choice** (2026-11-15, D12). The
  conflict the v0.3 run found (PF-1) is recorded with the alternatives set aside; nothing changed in the manuscript
  or the published files.

- **Round v0.3 of the manuscript, revised by a full improve run** (2026-11-15, run `20261115T132217Z-c1672440`,
  not in git). `docs/manuscript/v0.3/` is opened from v0.2 (which is with the co-authors) and carries 186 recorded
  edits: the review stages' corrections, prose edit, deslop, story and adaptation to NAR. Two errors of the earlier
  text are corrected on the code (the rate test does correct for multiple hits; its genetic code is the one the
  three species share), the all-species survivors are stated exactly (5 and 1 of 27 skews, 6 of 16 codons), three
  supplement citations get their right authors, and H11 and H12 get Supplementary Methods S12.6 and S12.7.
  `mitoage2.proposed.md` is the run's corrected version; the authors' decisions are in its dashboard
  (`docs/manuscript/NOTES.md`, "Round v0.3").

- **The MitoAge 2 manuscript is kept in rounds** (2026-11-15): the manuscript, its figures with their scripts and
  the Supplementary Methods move into `docs/manuscript/v0.2/`, the folder the manuscript-skills plugin releases to
  the co-authors' Google Drive folder (`rounds.py`); the next round is a copy of it. `docs/manuscript/NOTES.md`
  stays above the rounds. The figure scripts find the build one level deeper and redraw Figures 1 and 2 byte for
  byte; the README's manuscript section describes the current round.

- **The manuscript is set for a regular Nucleic Acids Research article, and reports what survives the stricter
  tests** (2026-11-15). Materials and methods moves back before the Results and the abstract is one paragraph of 200
  words without the URL, as NAR asks. The all-species skews and codon usage, which pass the three controls one at a
  time, do not survive ancestry and body mass together or the sign-flip test; mammalian base composition does, and a
  new Results subsection and Table 4 show it following the slow life history as a whole (H11), not in birds. The
  structural tests of H12 (complex IV contacts, hydropathy) join the retested relationships; Kulaga et al. 2021 and
  Revell 2009 are cited. `docs/manuscript/NOTES.md` gives the source of each new number.

- **The manuscript states two limits the review raised (D14)** (2026-11-15): the relative-rate test's
  uncorrected Nei–Gojobori counts may bias it towards the null (Discussion), and estimated AnAge ages of wild
  animals stay in the default dataset while FishBase growth-study ages leave (Materials and methods). No
  analysis was rerun. `mitoage2.proposed.md` again equals `mitoage2.md`.

- **The manuscript's supplementary material has its own folder** (2026-11-15): `docs/manuscript/supplementary/`
  holds the Supplementary Methods (`mitoage2.supplementary.md`), Supplementary Table S1
  (`supplementary_table_S1_scopes.csv`) and the supplementary figures (`supplementary/figures/`, now Figure
  3—figure supplement 1), so `docs/manuscript/figures/` holds only the paper's own figures and the scripts that
  draw all of them. `capture-figures-3-4.ts` writes the figure supplement there; the image link in
  `mitoage2.md` and the paths in NOTES.md follow.

- **Lifespan with and without body mass, side by side** (D11, 2026-11-15): `correlations.parquet` carries
  `pic_mass_r` and `pic_mass_p_value` on every lifespan row of both datasets, the contrast correlation with
  log10 adult weight partialled out (`partialContrastCorrelation`; `picContrasts` now carries an optional third
  trait through the same recursion). It reproduces the cluster run's `mass_r` to 5 × 10⁻⁹ in all 11,946 rows both
  compute. Table 3 and Supplementary Table S1 gain a "PIC + mass" column (393 of the 4,299 FDR-passing
  correlations in `default`, 374 of 4,068 in `anage_only`); the Results, Methods and Discussion say so, and
  Methods now also names the sign-flip p value. The funnel (896, 547) is unchanged. Four new tests, each checked
  by breaking the code it guards (mass not carried through the weighted mean, a missing mass ignored, the
  partial formula, df m − 1). Supplementary Methods S10.6, S10.7 and S14 follow.

- **Supplementary Methods S10.6 reports the contrast test's checks** (2026-11-15): the match with `ape::pic`,
  the calibration (exact under Brownian motion in all 32 scopes, 22–33% rejections with lifespan shuffled in
  the fish scopes), the single sister pairs that dominate those scopes, the Garland diagnostic, the
  `pic_signflip_p` column beside the t test (1,253 and 533 "Both" against 3,008 and 896; D10 keeps the t test
  for every count), and the contrast result with body mass partialled out from the cluster run. S10.7 lists
  the sign-flip counts, S11 and S14 follow. The manuscript's counts are unchanged.

- **`correlations.parquet` carries a sign-flip p value for the contrast test** (2026-11-15). New column
  `pic_signflip_p`, beside `pic_p_value`, on every lifespan row of both datasets (null for other traits, as
  `partial_r` is): the p value of the same contrast correlation from up to 9,999 random sign flips of the
  contrast products, with a sequential stop (Besag & Clifford 1991). It does not assume normal contrasts of
  equal variance, which the fish scopes violate (`docs/PIC_CALIBRATION.md`). `default`: 1,253 of 15,904
  lifespan tests below 0.05 against 3,008 for the t test, and 533 "Both" against 896; the t test remains the
  published test (D10). The site build takes about 40 s longer. Existing
  columns are unchanged; the SQLite copy picks the column up at the next `bun run sqlite`. Code:
  `picContrasts`, `contrastCorrelation` and `signFlipPValue` in `pipeline/lib/stats.ts` (`picFast` now
  calls the first two), tested against exact enumeration of every sign pattern.
- **The manuscript has a Discussion and reads as a line of reasoning** (2026-11-15). For the reprioritized
  venues (eLife, Life Science Alliance and MBE share Introduction, Results, Discussion, Materials and methods),
  the Conclusion became a Discussion that carries the caveats taken out of the Results, the published claims
  retested and what comes next; Materials and methods moved after it, unchanged; the Introduction and each
  Results subsection run from the question to the test, the finding and what it means. The skews, contrasts,
  scopes and the four survivor counts are explained where first met. No number or citation was dropped
  (`docs/manuscript/mitoage2.md`, `mitoage2.proposed.md`; `docs/manuscript/NOTES.md`, "Restructure").

- **The contrast t test stays the published PIC test** (2026-11-15, D10): the maintainer keeps
  `pic_p_value` and the counts 3,008 / 896 / 547 rather than the sign-flip test's 1,255 / 531 / 336, with
  the fish scopes' known excess recorded as the accepted cost.

- **The contrast (PIC) test is checked: the code is right, its p values are not calibrated on these data**
  (2026-11-15, `docs/PIC_CALIBRATION.md`). `pipeline/pic-calibration.ts`, run on haumea from commit 0d67d1e
  (Slurm jobs 6486136 and 6486181), reproduces R `ape::pic` (same contrasts, same r and p) and every
  `pic_r` of the table, and rejects 4.75–5.30% in all 32 scopes when lifespan is Brownian motion on the
  dated tree. The excess in the fish scopes comes from one sister pair per scope carrying most of the
  lifespan contrasts' variance (*Dipturus trachyderma* / *Zearaja nasuta*, *Alosa sapidissima* /
  *A. alabamae*); shuffled lifespans are rejected 22–33% there. A sign-flip test gives 1,255 PIC-significant
  tests instead of 3,008, and 531 of 4,299 "Both" instead of 896. No pipeline change: the choice of test is
  the maintainer's. Per-test results in `docs/analyses/pic-calibration/`.
- **Supplementary Methods for the manuscript** (2026-11-15): `docs/manuscript/mitoage2.supplementary.md`,
  sections S1 to S14, the build and the worked analyses as a flow of decisions with their reasons, rejected
  alternatives, assumptions and unknowns, each rule sourced to its file in a hidden comment. It defines every
  feature family precisely enough to recompute, gives the contrast computation step by step, says what each
  count of the Results requires (15,904 / 4,299 / 896 / 547 against 496 and 291), and sets out what the build's
  three checks cover: the independent reproduction covers neither the extended-feature tables nor the
  correlations. The manuscript points to its sections from Methods, the worked analyses and the MCP paragraph,
  and Table 4 moves there as Supplementary Table S2 (decision D7). Prose-edited and deslopped; S14 lists what
  the authors must still supply. `docs/manuscript/NOTES.md` has a section on it.

- **The manuscript's Data availability names the Hugging Face collection** (2026-11-15), after the two GitHub
  repositories, as reference 44 (`docs/manuscript/mitoage2.md`).

- **A MitoAge collection on Hugging Face** (2026-11-15): [longevity-genie/mitoage](https://huggingface.co/collections/longevity-genie/mitoage-6af952ac7256661d479577a5)
  gathers the build and the six datasets of the analyses, each with a one-line note; the README links it.

- **The per-residue embeddings and the predicted structures are on Hugging Face** (2026-11-15), so the ESM
  side of H5's interface test and H10's structural check rerun from public data: the per-residue ESM-2 650M
  embeddings of both partners (7.7 GB) in `longevity-genie/mitoage-embeddings` at fc70053, the 806 ESMFold2
  structures (150 MB) in the new `longevity-genie/mitoage-structures` at 8e5cfdc, both the files the published
  runs read (the residues' SHA-256 on the hub equal the cluster's; the structures download byte-identical).
  `dna-seq/mitoage-pipelines` (aa2e3ed) fetches them with `download prepared --topic residues` and `--topic
  structures`. `docs/ANALYSIS_FINDINGS.md` says so in H5 and H10.

- **A second journal selection and a second, independent panel on the revised manuscript** (2026-11-15,
  runs `20261115T001950Z-ea39ab48` and `20261115T054110Z-dac824e9`, not in git). The selection drops NAR's
  annual Database issue as the first choice (next open issue January 2028, results cut) for a bioRxiv preprint
  and eLife Tools and Resources, then MBE Resources or Database (Oxford). The panel, three referees and three
  readers each on Claude and Codex, judged the paper for eLife: three major and three minor revisions against
  five and one before the revision; the stale figures, the quality-label rule and the out-of-scope objection
  are gone, and the contrast test's calibration, strand orientation and the reach of the reproduction remain.
  Its 29 text fixes are proposals only; `docs/manuscript/NOTES.md` lists what waits on the authors.

- **The cluster analyses are reproducible from `dna-seq/mitoage-pipelines`** (2026-11-15, its commit
  f2006a9). The one-off cluster scripts behind H3's Coevol run, H5's residue-level test, H9 and H10 are now
  commands there (`download pdb`, `mitoport contacts|burial|iface-align|iface`, `structure within|fold|msa`,
  `longevity coevol|coevol-read`), with tests, and its `docs/HYPOTHESES.md` carries the same entries as
  `docs/ANALYSIS_FINDINGS.md` again. Rerun on the cluster against the first run's files: byte-identical
  contact map, sites, selections, dated tree and Coevol inputs, and the same coupling, lifespan,
  within-species and structural-alignment tables; on freshly made nuclear alignments MAFFT's two-thread runs
  differ in 2 of 62 and move one protein's coupling (UQCRQ, +0.565 to +0.572), which changes no group median.
  Not rerun: the folding and the Coevol chains. Two numbers of the hand-off corrected while checking: the build
  has 2,290 species with all 13 proteins, not 2,309, and folding them all is about 120 GPU-hours, not 150.
  The ESS figures of the Coevol entry are now read from the run's own `tracecomp.contdiff`.

- **The cluster analyses of mitoport's interface and of structural alignments, brought in; RM13 closes**
  (2026-11-15). Another agent (Claude Science) ran them on `haumea` on 2026-11-14 and 15 and nothing had
  reached this repository. Their result tables are now in `docs/analyses/cluster-2026-11-15/` (seven TSVs,
  byte-identical to the cluster's, with a README giving each one's cluster path, the scripts and logs, and
  the SHA-256s). They were not rerun here; their numbers were recomputed from the tables, and five of the
  hand-off's statements were corrected against the files: column occupancy at the contacts has median 1.000
  but is not full everywhere (290 of 298 at 0.99 or above); the coupling covers 87 to 182 mammals per
  protein, not 166 to 183; the exposure contrast is contact against the non-contact non-control residues;
  the ESM distance does give a small nuclear-side interface excess (+0.051, p = 0.0096, uncorrected) where
  the sequence distance does not; the lifespan mismatch is against the consensus residue, not human.
  `docs/ANALYSIS_FINDINGS.md`: H5 gains the residue-level test on complex IV (the group contrast
  reproduces, the interface prediction fails: a whole-protein coupling, not compensation at contacts); H9,
  lifespan on the contact mismatch, a bounded null (1,373 species, 95% interval [−0.050, +0.002] log10
  years per SD); H10, the structural-alignment check, agreement with MAFFT at median 0.9997 in 62 mammals
  and about 120 GPU-hours to fold every species; H3 gains Coevol's numbers, marked provisional because its
  chains had not converged. Roadmap: RM13 is done, with the limit that it covered mammals only; RM11
  records the interface result and that its stop rule is reached for the contact-residue branch; RM17
  names `SITES.tsv` as its per-residue table, for complex IV only; RM12 records Coevol as unconverged.

- **The plot explorer offers the 157 extended mtDNA features** (RM19, 2026-11-15). Each has a label, a
  short axis name, a unit and a family in the hand-built catalogue (`src/lib/explore/variables.ts`):
  fourfold sites (gene sense and heavy strand, % of fourfold sites), protein hydropathy (GRAVY, no unit),
  and repeats and structure (pairs, counts or bp); none defaults to a log scale, as no composition feature
  does, since the counts include zeros. `major12` is labelled "All but ND6" and sits after "All
  protein-coding" in the fourfold regions; `major_arc` sits after "Whole genome" in the repeat regions. The
  picker gains two tabs, "Fourfold sites" and "Repeats", and GRAVY joins the amino-acid grid it is computed
  from; the Strongest correlations panel gains the same two filters. Its intro and its "How to read" note
  now take the feature count and the number of tests from the data (1,414 for maximum lifespan in all
  species) instead of the literal 1,257, and no row shows a raw key. `explorer.json` is unchanged at
  2,675,901 bytes (RM2): the extended features load from 17 per-region chunks,
  `/compare/plot/values/{region}-ext.json` (130–150 kB each, 2.4 MB in all), fetched only when plotted.
  The build now fails if the catalogue and the pipeline's feature list differ at all (the RM19 exclusion
  is gone), or if `explorer.json` and the chunks disagree on where a feature's values are. The live
  statistics' sentence no longer lowers a label's first letter when it is a base or a symbol ("U at
  fourfold-degenerate sites", "G-quadruplex motifs"). Manuscript
  Figure 5 recaptured with `capture-figure-5.ts`; its legend's numbers checked against it.

- **The manuscript, reviewed and corrected in a full manuscript-improve run** (2026-11-15, run
  `20261115T001950Z-ea39ab48` under `data/cache/manuscript-reviews/`, not in git). Seven review stages,
  six simulated referees and six readers (each once on Claude and once on Codex) and an independent
  re-check; every correction that needed no decision of the authors is applied to
  `docs/manuscript/mitoage2.md`, recorded edit by edit, and the decisions that remain are in
  `docs/manuscript/mitoage2.dashboard.html`. The author list and affiliations are in. Figures 1 and 5
  showed the build before the extended features (1,257 features, not 1,414) and are redrawn from the current
  build by scripts now kept beside them (`docs/manuscript/figures/figure-1-controls.ts`, which refuses to draw
  when a count differs from Table 3, and `capture-figure-5.ts`). Panel 5B still shows the explorer's stale
  feature count and two raw feature keys until RM19 lands. Every number in Tables 1–3 and S1 recomputed from
  the build; the text fixes include the inverted-repeat result against its source (18), the methionine result
  narrowed to mammals (31), the unpublished npm package, the AnAge licence (CC BY 3.0), the extended
  features described in Methods, and an Abstract of 198 words with the references in NAR style and their DOIs.

- **Build 2 uploaded to Hugging Face with `mitoage.sqlite`, and the MCP server pinned to it** (D9):
  dataset revision `c525adbff8c12b19981fdada7f1615c2559b7140`,
  the file 113,618,944 bytes, SHA-256 `b4f7dd75f5b11321ef8131c669d179ba928023ae4a71fd880dabd842ad11363f`,
  checked against the hub's own LFS digest. `mcp/src/dataset.ts` names all three, so `npx mitoage-mcp`
  now downloads and runs with nothing set; verified from an empty cache, which fetched the file,
  matched the digest and answered. `cacheDir` follows `XDG_CACHE_HOME` only when it is absolute: a
  relative value would put 114 MB under whatever directory the client started the server in, and
  whether a copy was cached would depend on the working directory rather than on the pin.

- **An experimental MCP server, `mcp/`, published as `mitoage-mcp`** (D8): the build as tools for a
  language-model agent, over stdio. `bun run sqlite` writes `out/hf/mitoage.sqlite` (114 MB, one table
  per download plus the correlations, each table checked against the parquet it came from by row count
  and by per-column sums); the server opens one such file, downloaded once from a pinned revision of
  the Hugging Face dataset and cached, or named by `MITOAGE_DB`. Seven tools: `build_info`,
  `search_species`, `species_profile`, `correlation`, `rank_features`, `region_summary` and a read-only
  `query`. No tool returns a correlation coefficient on its own: each carries its q-value, the partial
  correlation on body mass, the correlation on independent contrasts, the filters of its dataset and a
  verdict that uses the manuscript's Table 3 definitions, and that says "not assessed" for a control
  that was never computed. The package is released by a `mcp-v*` tag
  (`.github/workflows/mcp-release.yml`), never by a push to `main`, and the workflow refuses to publish
  while the dataset revision is unset. The manuscript describes it, as experimental, in "Data access
  and versioning".

- **Species with no name at a rank form no scope** (IC-8). `buildScopes` grouped species on a blank rank
  key, so the 41 species whose order is unknown were tested together as if they were an order: a scope of
  204 lifespan tests that is not a taxon. They now join no scope at that rank, which leaves 32 scopes and
  15,904 lifespan tests in the default dataset. `docs/BUILD2_REPORT.md` is regenerated on the new table.
- **The manuscript's numbers are rebuilt on the committed feature catalogue.** Its funnel was computed
  before the repeat, motif, fourfold and hydropathy features joined the catalogue at `e3d99b2` and so
  shared the Benjamini-Hochberg pool, and no longer matched the build it cites. Table 3, the Abstract, the
  Results text and the legends of Figures 1, 2 and 5 now read 15,904 / 5,439 / 4,299 / 3,008 / 896 / 547,
  with 481 of the 547 keeping the sign of the correlation across species. Every per-feature result is
  unchanged.
- **The Table 3 note no longer blames near-zero branch lengths** for the clades that over-reject on
  contrasts. Measured on the dated tree: 54 polytomies costing 75 degrees of freedom in all, and only 12 of
  2,229 contrasts standardised by a daughter-variance sum below 1 Myr. The rejecting contrasts are not
  sign-biased; they are heavy-tailed (|contrast r| averaging 0.43 in Chondrichthyes against 0.09 across
  species). The fix to run is a permutation null and PGLS with Pagel's lambda, not a change of tree
  (IC-9, PR-3). `docs/manuscript/NOTES.md` Q5 is rewritten with the measurements.
- **A result for the invertebrates** (ST-3): the bivalves are the only non-chordate scope large enough to
  test, none of their 1,331 correlations passes the false discovery rate (smallest q = 0.13), and no
  non-chordate has a recorded adult weight. **Supplementary Table S1** lists all 32 scopes (PR-12).
  AnAge build 15 cites de Magalhaes 2024 beside the 2018 paper (RF-5), and the data and software sources
  have citations 38-42, their DOIs to be minted at revision (RF-4).

- **Extended mtDNA features, in the site's feature catalogue** (D7): fourfold-degenerate site composition in
  gene sense and heavy-strand notation, Kyte-Doolittle hydropathy, the major arc between the replication
  origins, annotated control regions, perfect direct, inverted and mirror repeats, non-B DNA motifs
  (G-quadruplexes, homopurine and homopyrimidine tracts, homopolymers, di/tri/tetranucleotide tandem repeats)
  and the repeat pairs bridging the ATP8-COX3 and ND5-CYTB spans that flank most human mitochondrial deletions.
  `pipeline/lib/motifs.ts`, `pipeline/lib/repeats.ts` and `pipeline/steps/extended.ts` compute them from the
  cached RefSeq records; the build commits `mtdna_structure.parquet` (2,335 rows) and
  `protein_gene_features.parquet` (34,860 rows), and the site derives 157 features from those tables, taking
  the catalogue from 1,257 to 1,414. They are correlated like any other feature, so the false discovery rate
  now runs over the combined set. The plot explorer does not offer them yet (RM19): `isExtendedFeature` excludes
  them from its payload and from the build-time catalogue check, in one place both read, so `explorer.json` is
  unchanged at 2,675,901 bytes. Every previously committed output - species, region stats, codon usage, genome
  features, lifespan observations, changelog and `src/data/generated/` - is byte-identical.
  Checked against an independent Python implementation on the 884 species whose RefSeq record is byte-identical
  in both runs: the quadruplex, tract and homopolymer counts agree exactly, and the tandem-repeat counts differ
  only as the shorter-period rule predicts.

- **H7 and H8 in `docs/ANALYSIS_FINDINGS.md`**, following `docs/HYPOTHESES.md` of mitoage-pipelines at
  6149fa1. H7: substitution rates against lifespan by the relative-rate test on 339 sister pairs of the
  dated tree, with dN and dS as Nei-Gojobori counts in each species' own mitochondrial code; nothing
  survives on the concatenated genes under any of four normalisations, and the four single-gene tests that
  pass q < 0.05 of 655 disagree in sign. H8: the mtDNA motif, repeat and contact-zone features the pipeline
  now writes, against lifespan in H1's model; one test of 131 passes (reptile G-quadruplexes, q = 0.027),
  and the mammalian G-quadruplex result an exploratory run had reported does not reproduce on the
  database's own features and the default dataset (q = 0.66). H8's control could not be run at all, which
  opens RM18: no record in the build states its sequencing technology, so the long-read-only replication
  the mitoVGP and MitoHiFi reports call for is "not assessed" rather than negative. Documents only.- The manuscript draft's worked example reports the H1 rerun on the dated tree (mitoage-pipelines da0c112): in 604 mammals of the default dataset no amino acid passes a 5% false discovery rate once base composition is in the model (threonine q = 0.12, cysteine q = 0.15), against seven with order and family as random intercepts; references 33 (Kitazoe et al. 2008) and 34 (Aledo, Valverde & de Magalhães 2012) added; NOTES.md gives the tables. Documents only.
- **Manuscript draft reviewed and corrected against the build and the code.** Body-mass control is claimed only for lifespan, where the pipeline computes it; "All three" is said to admit a reversed sign (418 of the 472 keep it); the GC result is stated within classes; the survivors are said to include, not to lie mostly in, the skews and codons; there are 106 invertebrates, not 104; the record choice, the alignment command, the codon-usage measure, the quality scale, zero-length contrasts, the tree's location and the cross-check counts are described as the code does them; and the reproduction sentence reports what `docs/BUILD2_REPRODUCTION.md` (mitoage-pipelines 3550281) found. `NOTES.md` gains a source for each new number. Ten decisions stay with the authors (strand rerun, the definition of "All three", contrast diagnostics and chance correction, length and supplement, the worked example, licence, maintenance and AI-use statements, timing, invertebrates in the Abstract). Documents only.
- `docs/ANALYSIS_FINDINGS.md` follows `docs/HYPOTHESES.md` of mitoage-pipelines at da0c112: H1 (amino-acid content against lifespan) rerun as a phylogenetic regression on the dated tree with the manuscript's default dataset and all 20 amino acids with q; with base composition in the model no amino acid passes q < 0.05 in mammals (threonine q = 0.12, cysteine q = 0.15), and the earlier family/order mixed model's hits are set against the published record both ways (Kitazoe et al. 2008; Aledo et al. 2012). H2's two columns hold on three other aligners; its detectable effect sizes are stated. Documents only.
- **`docs/ANALYSIS_FINDINGS.md`: what the analyses on build 2 found**, in the repository itself: amino-acid content against lifespan (threonine and cysteine hold in mammals), the single-residue screen (nothing robust; one result withdrawn after it was rerun on the dated tree), selection strength (nothing that repeats), the peptides encoded inside mtDNA (only SHLP6 looks kept, none beyond the null), and nuclear partners following the mitochondrial genome in rates and in embeddings. The code is in `dna-seq/mitoage-pipelines`, the tables on Hugging Face. Documents only.
- README and the build 2 report point to `dna-seq/mitoage-pipelines`, where build 2 is rebuilt from build 1 independently, with a downloader for every source (`docs/BUILD2_REPRODUCTION.md` there), and to the Hugging Face dataset. Documents only.
- The manuscript draft's figures are numbered in order of first citation: the controls chart is now
  Figure 1, the codons Figure 2, the interface Figure 3, the alignment Figure 4 and the plot explorer
  Figure 5 (the entries below use the old numbers). The image files are renamed to match, and `NOTES.md`
  and the README follow.
- The manuscript draft's figures sit at the end of the section that first cites them, as its tables do,
  instead of in a Figures section at the end: Figures 3 and 4 after Table 3, Figures 1, 2 and 5 at the end
  of "Website and interface". An author note says they move after the references for submission, as NAR
  asks.
- **Figures 3 and 4 of the manuscript draft.** Figure 3 shows, scope by scope, what the false discovery
  rate, the contrasts and the body-mass control leave of the lifespan correlations; Figure 4 places the 64
  codons of the total protein-coding sequence by their r across species and on contrasts, one panel per
  third base. Both are drawn from the correlation table the site build writes, cited in the Results and
  described in `NOTES.md`; the README no longer says they are missing. Recomputing Table 3 for Figure 3
  reproduced every count; its total row now says 33 scopes, not 34.
- **Figures for the manuscript draft, and screenshots in the README.** `docs/manuscript/figures/` holds
  Figure 1 (species list, tree, a Compare chart, a genome map), Figure 2 (the plot explorer and its
  ranking of every feature) and a new Figure 5 (the COX1 alignment of the mammals), all screenshots of the
  build 2 site; the draft shows them with legends whose numbers were read off the screenshots. Figures 3
  and 4 (charts of the correlation table) are still to be drawn. `docs/screenshots/` holds six screenshots
  the README now shows, and the README points to the draft. `NOTES.md` says how the screenshots were
  taken. Found on the way: headless Chrome 157 returns a stale computed colour when an element's inline
  style changes, so the tree and the alignment viewer, which resolve their colours through one probe
  element, drew in one colour there; the capture worked around it. A headed Chrome 157 draws both
  correctly on the live site, so the site is unchanged.
- `docs/manuscript/`: draft 0.1 of the MitoAge 2 paper (NAR Database issue update), modelled on the 2016 paper, with every number traced to build 2 in `NOTES.md` and the questions for the authors (strand convention, contrasts in poorly resolved clades, licence, taxonomy counts).
- **A FASTA download names the retired records it holds.** Build 2 retired 19 species (18 because
  RefSeq removed their record, one without a curated lifespan), and the site still lists them. NCBI
  still serves the removed records, so the species list, a taxon page and the side-by-side view
  handed them out under a plain "Downloaded": on the Squamata page, 4 of the 65 genomes. The record
  stays in the file, since it is one of the rows asked for; the note now names it, says it is left
  out of the build's correlations and alignments, and turns amber. The list is the new
  `/species/retired.json` (record status "retired", by accession, 1.6 KB), fetched once per page when
  a download starts; when it cannot be read the note says the check could not be made, never that
  there is none. `src/lib/retired.ts`, tested on the build's species and on two removed records as
  NCBI serves them (`src/lib/testdata/retired.fasta`), and checked by breaking the code 14 ways.
- **FASTA of a hand-picked set of species and of a taxon's species**, the two places the species
  list's download did not reach (see its entry below):
  - `/compare/species/?species=a,b`: "FASTA of these species" downloads the genomes of exactly the
    chosen species, in the order of their cards. A chosen entry that did not load is named as left
    out.
  - `/taxa/{rank}/{slug}/`: the species table has the same button, for the rows the table shows
    after its filter and in its order. On a clade of more than 30 species the button appears once
    the rest of the rows has loaded, not while the table holds its first page only.

  Both show what the species list shows for a complete, an incomplete and a failed download: the
  flow moved out of `DataTable` into `src/lib/fastaDownload.ts`, and `src/lib/fasta.ts` is
  unchanged. `/tree/tree.json` gains `leaf.refseq`, the versioned accession of every species. On
  the build 2 data (2,335 species) the file grows from 306,425 to 339,126 bytes (+32,701, 10.7%),
  with `gzip -9` from 96,650 to 104,765 (+8,115, 8.4%). Two integers per species instead of the
  string would have made it 324,697 bytes (103,415 gzipped), 1.35 KB less on the wire, and tied the
  format to `NC_` plus six digits; the string was kept. `/compare/species-index.json` is unchanged,
  since the side-by-side view already loads each species' record with its accession. Each inline
  row of a taxon page's table carries the accession too.

  Found on the way and left as it is: the 50 species of build 2 without an order or a family have
  an empty group in a taxon page's inline rows and "Unknown order" or "Unknown family" in the rows
  loaded from the tree (`src/lib/tree/speciesRows.test.ts` states the difference).
- Roadmap: RM16, the peptides encoded inside mtDNA (humanin, MOTS-c, the alternative frames of ND4 and COX1 and the rest), asked by the maintainer; the aligner check, RM12's first step, is done and reported in `#mitoalignments`. Documents only.
- **Gene pages no longer scroll sideways on a phone.** The button under the class chart ("Compare ND6 across
  taxa: every parameter, every species") was wider than a phone's screen and widened the whole page by 135
  pixels; its label is now "Compare ND6 across taxa". Found by reading the live build 2 site (RM3): 20 pages
  at a desktop's and a phone's width, none with a script error, this one with a page wider than its screen.
  What else was seen is RM14 (D-loops annotated as a point) and RM15.
- Roadmap: RM12 is now the whole longevity analysis on the alignments as planned with the maintainer (aligner check, positive controls, site by site, selection pressure, convergence, structures); RM4, RM7 and RM11 wait on the desk. Documents only.

- **The build on Hugging Face** (D6). `bun run hf` packages the committed build into `out/hf/` (not in
  git): `public/data/` as it is, `alignments/alignments.parquet` (every row of every aligned FASTA as one
  table: gene, kind, slug, scientific name, accession, aligned sequence; 64,789 rows, 22 MB, read back and
  compared after writing) and a dataset card made of the data README and the alignments README under a
  header that says the licence is mixed, part non-commercial, and names the tables the dataset viewer
  shows. Uploaded by hand to https://huggingface.co/datasets/longevity-genie/mitoage (public, 46 MB) on
  2026-11-13. The site still builds from the files in git; nothing on the site reads Hugging Face.
- **The alignment on each gene page** (RM10). The pages of the 13 proteins and the two rRNAs have a section
  "Alignment": one row per species in the order of the site's tree, the residues coloured by side chain (the
  bases by letter), a bar above each column for how conserved it is among the rows on show, and the maximum
  lifespan beside each row. Filter by class and order, sort by lifespan, switch to an overview of small cells,
  hide the columns where more than half of the rows have a gap (on at the start), find a species; a cell
  tells its species, column and residue, with a link to the species page. The viewer fetches that gene's
  protein (or rRNA) file and one list of species (`/genes/alignment-species.json`) when it scrolls into view;
  the protein, codon and rRNA files are linked under it. The codon alignment is a download, not drawn. The
  Data page lists the alignment files in a card of their own, each described as what it is (before, the
  codon alignments carried the description of the codon-usage table). `src/lib/alignment.ts` is tested on
  the committed files (its column counts equal the manifest's, which the pipeline counts another way) and
  by breaking the gap rule and the conservation share.
- **Alignments of the mitochondrial genes** (D5, RM10's first part). `bun run align` aligns each of the 13
  proteins (amino acids), derives the codon alignment each implies, and aligns the 12S and 16S rRNA genes,
  for the 2,316 live species of build 2, from the pinned RefSeq release, with MAFFT v7.526 (FFT-NS-2;
  another version stops the run). Output: `public/data/alignments/`, 28 gzipped FASTA files (11 MB), a
  manifest (`alignments.json`: counts, columns, checksums, the 31 gene absences, the 48 genes annotated
  twice, 2 codon rows left out for a frameshift in the record) and a README. Checked: every alignment is
  its input with gaps; every codon row translates to its protein under the species' genetic code (no
  mismatch in any of the 13 genes); two runs with 2 and 8 threads give identical files. Tests on the
  committed files and on the library, one of them confirmed by breaking the codon threading. Not on the
  site's pages yet: the files are served under `/data/alignments/`.
- Roadmap: RM10 gains the prior-art check on alignments and site-level lifespan screens; RM11 records the mitoport idea and the bounded test proposed for it. Documents only.
- **A species page says where its record comes from** (RM1). The lifespan card and the life-history card
  link to the source that holds the value (AnAge, FishBase, SeaLifeBase or the USGS longevity records);
  before, every species linked to AnAge, also the 575 whose value comes from another source. A new card,
  "About this record", gives the source and its version, what the value is based on (captivity, the wild,
  an estimate), its quality, its licence with a line where the value is non-commercial, the record's
  status against build 1 with its dates, an earlier name, and the review flags as sentences. A retired
  species carries a notice with its reason at the top of the page. Words and links are in
  `src/lib/provenance.ts`, tested on every species of the build and by breaking the link rule. Viewed
  as screenshots of the built page at a desktop's and a phone's width, light and dark, for a FishBase
  species, a renamed one, a retired one and human.
- Roadmap: RM10, multiple sequence alignments of the 13 proteins and two rRNAs, with the numbers of a hand run (MAFFT, all 2,316 live species, under a minute in total) and a proposed design waiting for the maintainer; RM3 is no longer blocked, since built pages can be viewed by headless screenshots where the seat runs. Documents only.
- The roadmap is written (RM1 to RM9) from the build 2 report's "Not done", its open questions and the code as it is; the lead's notes record its first seating. Documents only. Checked on the pulled tree: type check, the site build as the workflow runs it (7,783 pages, link check passed); tests pass except `pipeline/tests/lifespan.test.ts`, which needs the pinned inputs this clone lacks (RM7). No page was viewed.
- The build 2 report states the final test count (192, not 144).
- Decision numbers after rebasing onto main (which recorded its own D2): the parquet data layer is D3 and the dropped size rule D4 in code comments and the build 2 report.
- The FASTA download test formats its expected counts with the thousands separator the message uses (it failed once the species list passed 1,000 rows with build 2).
- Regenerated build 2 data (`bun run data`, 2026-11-13): 2,335 species; `public/data/` holds species, region_stats, codon_usage, genome_features, lifespan_observations and changelog parquet, species.csv, review_list.csv, README and the frozen build1/; `src/data/generated/` holds build-info, taxonomy and phylogeny JSON. The JSON copies of the large tables (species, region stats, codon usage, genome features, feature defs and values, correlations) and the committed explorer.json/correlations.parquet are removed (D2).
- Build 2 documents: `docs/BUILD2_REPORT.md` (counts, change tables, lifespan source x class, AnAge-only vs extended correlations, pinned versions, cross-check agreement, file sizes, what was not done; tables from `bun run pipeline/report.ts`), `docs/BUILD2_CROSSCHECK.md` (from `bun run pipeline/crosscheck.ts`) and `docs/BUILD2_OPEN_QUESTIONS.md` (each default with its alternative and cost).
- Decision D4: the 5 MB per-file rule is dropped from CLAUDE.md (the maintainer: "so drop this rule"); `validate.ts` now checks committed outputs against GitHub's own limits (fails at 100 MB, warns at 50 MB). D3 is unchanged: correlations and explorer.json are still computed at site build.
- New lampreys are labelled `Cephalaspidomorphi` and new lungfish/coelacanths `Sarcopterygii`, as in build 1, so class scopes stay comparable with the 2016 paper (they had been given NCBI-style `Hyperoartia`/`Dipnoi`/`Coelacanthi`).
- Decision D3: the site reads the committed parquet (`public/data/`) at build time through `src/data/index.ts` (hyparquet, top-level await, DataApi unchanged; `getCorrelations` takes an optional `dataset`); feature values, correlations (default and AnAge-only datasets, PIC on the committed `phylogeny.json`) and `explorer.json` are computed during `bun run build` and served as `/data/explorer.json` and `/data/correlations.parquet`; the large JSON copies are no longer committed. The dated-tree test now checks that exactly the species missing from the committed tree lack a branch length, instead of a build 1 count.
- Build 2 assembly (`pipeline/steps/build2.ts`, `bun run data`): the 922 build 1 species are re-verified against RefSeq release 237 (884 same accession.version, 2 new versions, 18 switched to a live species-level successor, 17 retired without one; Andrias davidianus retired, no curated lifespan), renamed to the NCBI name where NCBI transferred them (old name kept in `previous_scientific_names`, slug kept), and get AnAge build 15 lifespans; 1,413 new species (complete RefSeq mitogenome + curated lifespan) get id 10,000,000 + NCBI taxid. Genome values of live species are computed from the release record (annotated segments only for join() features); retired species keep their build 1 values. Every difference against build 1 is in `public/data/changelog.parquet` with its class (`steps/diff.ts`: rule_full_span, upstream re-annotation against the source INSDC record, gap fill, successor, ...) and rule-scoped corrections for the complement-labelled base columns and the full-span rule; every lifespan value of every source is in `lifespan_observations.parquet`; unresolved matches go to `review_list.csv`. `validate.ts` checks row metadata against the changelog, unique and correctly minted ids and slugs, one licensed chosen lifespan per species, the priority rule and the 5 MB limit of committed files. `bun run pipeline/crosscheck.ts` compares the output with the audit tables.
- Pinned build 2 sources in TypeScript (`pipeline/sources/`): RefSeq mitochondrion release 237 (md5-checked, streamed), NCBI Taxonomy new_taxdump (names with synonyms), AnAge build 15 (md5-pinned), FishBase and SeaLifeBase v26.06, USGS BBL v2025.1, and EURING, whose absence is reported ("EURING: not retrieved") and never substituted. A missing pinned input stops the build. Matching (`steps/lifespan.ts`): NCBI taxid first, then scientific name, NCBI synonym, the source's synonym table, binomial of a trinomial; ambiguous matches are excluded, never guessed. Per-taxon precedence: AnAge > FishBase (fish) / SeaLifeBase (aquatic invertebrates) / EURING > USGS BBL (birds). One complete RefSeq mitogenome per species (`steps/refseq.ts`). Tests on real source rows, each checked by breaking the code it guards.
- Data contract for build 2 (`src/data/schema.ts`): row provenance (`RowProvenance`: added/last-modified build and date, `record_status`, `source_version`) on species, region stats, codon usage and genome features; species lifespan metadata (`LifespanInfo`: source, version, record id, quality, sample size, record type, licence), NCBI taxids, previous names, retired reason, review flags, change kinds; `LifespanObservation`, `ChangelogEntry`, correlation datasets (`default`, `anage_only`). All new fields are optional, so build 1 consumers keep working.
- Frozen build 1 snapshot: `bun run data` converts every 2015 CSV verbatim to `public/data/build1/*.parquet` (lossless typing, SHA-256 of each source CSV in `build1/README.md`); tested by a cell-by-cell round trip.
- **Charts in the Compare section.** Every comparative table now has a chart of its rows above it,
  with a switch for what the chart shows (`?chart=`):
  - *Distribution*: range, mean ± SD, median and mean of the parameter, one row per region or taxon
    (lengths of the regions on a log scale).
  - *Variation*: the coefficient of variation, or the SD for the skews.
  - *Lifespan r*: Pearson r with log10 maximum lifespan and its 95% confidence interval (Fisher z).
  - *Lifespan map* (regions only): r of every parameter in every region of the group, with the cells
    whose Benjamini–Hochberg q-value over the map is below 0.05 in bold. AT % is left out of the
    map, as the mirror of GC %.

  The chart follows the table's sorting and page. Region pages gain a scatter of the listed species
  with selectable axes (any two of the region's parameters, or one against lifespan; `?x=&y=`), which
  narrows with the table's search and class filter and reports Pearson and Spearman for the plotted
  species. Codon usage is drawn by amino acid, each codon a segment coloured by its third base, as a
  share of all codons or within the amino acid (`?bars=share`). None of the charts' statistics is
  corrected for shared ancestry; the plot explorer remains the place for phylogenetic contrasts.
- `CLAUDE.md` §2: a session without a seat pushes `main` as a fast-forward where the maintainer's
  global instructions give a standing permission to push (D2 in `docs/DECISIONS.md`).
- The species list (`/species/`, `/species/life-history/`) has a "FASTA of these rows" button: the
  mitochondrial genomes of the filtered species as one file, in the table's order. The site still
  hosts no sequences: the browser fetches the RefSeq records from NCBI E-utilities, 100 accessions a
  request (`src/lib/fasta.ts`, `DataTable`'s `fasta` prop). NCBI answers 200 and leaves out a record
  it does not have, so every answer is checked against the accessions asked for and the page names
  any that are missing; a request that fails saves nothing and says why. `/species/table.json` gains
  a `refseq` field. Not on the taxon pages' species tables, nor on the species side-by-side view.

- The genome map on the genes index and on every gene page switches species: a search box and
  quick picks (human, house mouse, naked mole-rat, bowhead whale, chicken, zebrafish, fruit fly)
  load `/species/{slug}.json` and redraw the map, keeping the gene of the page highlighted. The
  species is kept in `?species=`. Before, both maps were fixed to the human genome.
- The site is mtDNA-first (1bcf523, landed before this changelog existed). Menu: Species, Tree,
  Genes, Compare, Data, About. Compare holds the comparative statistics of the original site's
  stats pages (every region by parameter with n, mean, SD, CV, min, median, max and r with log10
  lifespan; child taxa; codon usage; per-region pages with every species' values, CSV
  everywhere), the species side-by-side view and the plot explorer (moved from `/explore/`).
  Life-history traits live under Species (`/species/life-history/`). Old `/stats-for/`,
  `/export-section/`, `/browse/`, `/statistics/` and `/explore/` URLs redirect.
