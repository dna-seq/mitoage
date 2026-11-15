# MitoAge 2 manuscript: notes for the authors

Companion to `mitoage2.md` (draft 0.1, 2026-11-14). It says where every number in the draft comes from
and lists the questions only the authors can answer.

**Rounds.** From 2026-11-15 the manuscript is kept in rounds, one folder per version released to the
co-authors' Google Drive folder by the manuscript-skills plugin (`rounds.py`): `v0.2/` holds the manuscript,
its figures with their scripts, and the Supplementary Methods and tables. The next round is a copy of it
(`rounds.py open 0.3`), so each released version stays as it was sent. This file stays above the rounds. Paths
below written as `figures/` or `supplementary/` are inside the current round's folder.

**Releasing a round.** `rounds.py push 0.2 --go` (run from the plugin's manuscript-coauthors folder with
`--project docs/manuscript/v0.2`) builds each Doc with `bun ../build-docx.ts FILE` from the round folder:
pandoc (on PATH, or `$PANDOC`; `uv run --with pypandoc-binary` provides one), then every table's columns widened
to a Google Doc's 6.5-inch text width, because pandoc lays tables out for 5.5 inches and Google Docs keeps that.

## How the draft is built

- **Model.** The 2016 paper (Toren et al., NAR 44:D1262) is a short Database-issue article: Introduction,
  Database content and interface, Data sources and curation, Data calculation, Availability, Conclusion.
  The draft keeps its voice and its opening references (numbered as in 2016 so the two lists can be
  compared), and adds a Materials and methods section, because what is new in build 2 is mostly method:
  pinned sources, re-verification, a dated tree, three controls, two reproductions. Restructured on
  2026-11-15 for the reprioritized venues: Introduction, Results, Discussion, Materials and methods (see
  "Restructure" below).
- **The story.** One argument runs through it: the sources drift, the 2016 correlations were counted
  without controls for shared ancestry, and most do not survive one; what survives is concentrated in the
  strand asymmetry and the codon usage it shapes. The abstract, the Results and the Discussion all carry
  that argument; the website is described after it, as the last two subsections of the Results.
- **Claim ceiling.** The draft does not claim that any mtDNA feature causes or predicts lifespan. The
  codon finding is phrased as "the direction expected from" the heavy-strand A>G signature, not as
  evidence for it.

## Where the numbers come from

Since 2026-11-15 (D15) the numbers taken from the build are from the build with the EURING list, `dna-seq/mitoage`
at 725da08: 2,344 species, 9 of them European birds with a EURING lifespan. `bun docs/manuscript/numbers.ts [ROOT]`
recomputes every one of them from a checkout's `public/data/` and `dist/` (after `bun run build`), one `key<TAB>value`
per line, so two builds can be compared with `diff`; on the build before EURING (4b5e433) it gives every number the
text then printed. `--s1` writes Supplementary Table S1. Figures 1 and 2 were redrawn and Figures 3 to 5 recaptured
from that build.

Until the gene-annotation patch, Data availability and reference 40 pinned the build with the EURING list as Hugging Face revision
f75bdc9b812d7845d2ccb24a49643d88d00d57b5 (2026-11-15): its eight data files have the same SHA-256 as `public/data/` at
725da08, and a site build of main after it reproduces Table 3 (15,906 / 5,436 / 4,295 / 3,023 / 900 / 550 / 393, and 535
by the sign-flip test). The correlation code is unchanged between 725da08 and that build.

**Since the gene-annotation patch (2026-11-15), the round cites the patched build:** `dna-seq/mitoage` at 03c0949,
Hugging Face revision 0f4e970554b2fe0265e718321f422347293dde17 (D17; its files checked one by one against the local
copies). The patch adds the African grey parrot's ND6, which its record leaves unannotated, and flags every other missing
gene with its reason; the maintainer: "Move v0.3 now". `numbers.ts` on the patched build, against fb54cec, changes these
and nothing else, and the text, Table 3, Supplementary Table S1 and Figure 1 now print the new values:
- funnel, default dataset: p < 0.05 5,436 → 5,441, FDR 4,295 → 4,296, PIC 3,023 → 3,025. Both (900), All three (550),
  PIC + mass (393) and the sign-flip "Both" (535) are unchanged;
- funnel, AnAge-only dataset: FDR 4,068 → 4,069, Both 659 → 658, sign-flip 1,017 → 1,016 tests and 502 → 501 "Both";
  sign-flip in the default dataset 1,269 → 1,267;
- Table 3 rows: all species PIC 565 → 566; Aves p < 0.05 684 → 687; S1's Psittaciformes 56 / 35 / 19 → 58 / 36 / 20;
- all-species FDR correlations significant on contrasts with the opposite sign: 202 → 203 under the t test and
  49 → 48 under the sign-flip test (S10.6);
- canonical orientation 2,205 → 2,206 (non-canonical 16 → 15), major arc defined 1,915 → 1,916 (S3);
  changelog rows 14,428 → 14,429 (corrections 1,639 → 1,640).
Figure 2 was redrawn and shows the same nineteen codons. Figure 5 was recaptured from the site build of 03c0949: its panel B
counts 495 features with q < 0.05 and contrast p < 0.05 of either sign (was 494; the text and S10.7 follow), and the
GRAVY row's q is 6.6 × 10⁻⁵⁸ (was 5.5 × 10⁻⁵⁸). Figures 3 and 4 (the species list and tree, COX1 in mammals) are not
touched by the patch and were not recaptured. The cluster runs below were repeated on
revision 0f4e970 (see "Rerun on the patched build").

**The PGLS column (2026-11-15, D18, D19).** Table 3 and Supplementary Table S1 end with a column "PGLS": FDR, and p < 0.05
with the same sign for the lifespan slope of a phylogenetic regression with Pagel's λ. It is not computed by the site
build. The source is `docs/analyses/pgls/` (Slurm array job 6490080 from f360eea, on the patched build, whose data are
byte-identical to 03c0949's).
- `numbers.ts` reads those tables, joins them to the build's correlation table by scope and feature, and refuses if any
  row's correlation or q value differs, so a column from another build cannot be printed.
- Its keys: `table3.<scope>.pgls`, `pgls.default.fdrSameSign` (893), `pgls.default.fdrSameSign.mass` (430),
  `pgls.default.andBoth` (576), and `pgls.<scope>.p05` and `.fitted` for the rejection rates in the Results and S10.8.
- The text it adds: a paragraph after PIC + mass in "What the controls change", one sentence in Statistics, two in the
  Discussion, S10.8 and S1's caption.
- The same edit corrected "Of those 4,295" to 4,296, which the patched build had left behind.

**Rerun on the build with EURING (2026-11-15):** the worked analyses of mitoage-pipelines (Table 4 and the
generation-time models, the amino-acid example, the site screen, repeats and motifs, the rate test, H11 and H12) ran
again in one Slurm job on the build before and after the nine birds (`slurm/manuscript-rerun.sbatch` at 2ee27a1, jobs
6489876 and 6489877; tables, logs and the comparison in `results/euring/` at e1b862b). Both read `public/data/` and the dated tree of
fb54cec, whose data are byte-identical to 725da08's and so to Hugging Face revision f75bdc9; the gene-annotation patch
above does not enter them. The run before reproduces the
published tables, so every change is the build's. Mammal results are unchanged except the column screen, whose columns
moved with the realignment (5,262 tests, the same two pass); birds go from 379 to 381 in the composition and structure
models and 281 to 282 in the maturity models; bird maturity now follows seven or eight features (was six or seven);
the rate test has the same 339 cherries from 1,371 species (was 1,369). **The reptile contact divergence of H12 now
passes (q = 0.046, was 0.052) with no reptile added**: the alignment moved under it. The text reports it and does not
claim it; whether to keep that sentence or drop the result is the authors' call. The PIC calibration was rerun for all
32 scopes (array job 6489844 from fb54cec; `docs/PIC_CALIBRATION.md`): only the four scopes with the birds change their
observed values; the shuffled-lifespan rate in all species is 29.0% (was 29.1%), still "29%" in the text.

Two corrections came out of the rerun: the bird maturity ages are 292 live species (the "296" counted retired
records), and the S10.6 note on rows the cluster computes alone gave 3,958, which counted rows neither side computes
(2,132 are the cluster's alone). mitoage-pipelines' `docs/HYPOTHESES.md`, the record the text cites, gives the
same numbers: H11 at 500e1d2, H1, H2, H7 and H12 at 35ae7ae (earlier values in parentheses; H12's second round and
H2's power calculation were not rerun).

**Rerun on the patched build (2026-11-15):** the same job on revision 0f4e970 (`slurm/manuscript-rerun.sbatch`,
code of 2ee27a1, Slurm job 6490079; tables, log and the comparison with `results/euring/` in `results/nd6-patch/` of
mitoage-pipelines at fbb3798). Its inputs equal `public/data/` at 03c0949 byte for byte. With all 13 proteins the parrot
enters every bird set: birds 381 → 382 (H1, H12), the rate test 1,371 → 1,372 species and 339 → 340 cherries (24.1%
saturated, was 24.2%), the bird column screen 2,738 → 2,742 tests. The same tests pass everywhere; H12's bird contact
result is −0.016 (−0.039 to +0.007, q = 0.17), was −0.015 (q = 0.20). Byte-identical: H11's tables, H1 in mammals, fishes
and reptiles, and every mammal, fish and reptile row of H8 and H12, so the reptile contact result (q = 0.046) stands as
above. The mammal column screen differs only in its ND6 rows, whose column indices the realignment renumbered (344 rows,
results identical). Bird COX2 hydropathy passes under the gene's own composition (q = 0.045, was 0.056) and with mass
only, not under the primary model (q = 0.085); the text, which reports the primary model, is unchanged there.
The PIC calibration of the three scopes the parrot enters (all species, Aves, Psittaciformes) ran again on revision
0f4e970 (array job 6490100 from f360eea, committed from haumea as 0335977; `docs/PIC_CALIBRATION.md`): the Brownian-motion
rates stay within 4.77–5.24% (Psittaciformes 5.15%, was 5.22%) and the shuffled-lifespan rate in all species at 29.0%, so
S10.6's text is unchanged; its source note names the job.

**Nothing is still from the build before EURING (2,335 species).** The reproduction in mitoage-pipelines reads the EURING list (since bb5d70d) and applies D17's gene annotations
(since aee05c7), and matches the build the text cites (0f4e970) in all 5,328,887 values, the 28 alignments and the
tree. The audit's cross-check covers all 1,422 new species
(the audit scripts in `data/cache/build2/scripts/`, not in any repository, read the list through `pdftotext`). The
sources snapshot is at revision a762151 with the 2,250 tree answers; it does not copy the EURING PDF, which the
Internet Archive keeps and which states no licence.

| Numbers | Source |
|---|---|
| 2,344 species, 1,422 new, record statuses (392 / 465 / 46 / 19), retired reasons, 18 successors, 2 new versions, 884 unchanged accessions | `docs/BUILD2_REPORT.md`, Summary and "Species by record status"; `public/data/species.parquet` |
| Live species per taxon (Table 1), 23 classes, 9 phyla, 35 bivalves / 30 malacostracans / 11 cephalopods | computed from `public/data/species.parquet` (`record_status != retired`), grouped as in 2016 Table 1 |
| Lifespan sources of new species (838 / 475 / 74 / 9 EURING / 26) | `docs/BUILD2_REPORT.md`, "New species: class x lifespan source" |
| Changelog 14,428 rows by type | `docs/BUILD2_REPORT.md`, "Changelog rows: table x change_type" |
| 59 revised AnAge lifespans + *Andrias davidianus* | build-2 verification audit (`data/cache/build2/verification/verification_summary.md`) and the report's retired list |
| 320 regions missing from release 1, 263 D-loops | build-1 processing notes (`public/data/README.md` of build 1) and the audit ("gap fill: 320 rows") |
| Human rCRS base counts, release 1 vs deposited | `public/data/README.md`, data notes |
| 16,008 complete metazoan mitogenomes from 15,876 species, 14,970 species not in release 1 | `data/cache/build2/candidates/build2_candidates_summary.md` |
| Tree: 2,314 of 2,344 placed, 2,054 of 2,238 nodes dated, 184 interpolated, 61 raised | `public/data/README.md`, data notes |
| Datasets 2,211 / 1,710; agreement r = 0.977 | `docs/BUILD2_REPORT.md`, "Correlation datasets" and "Agreement between the datasets" |
| 192 tests, cross-check (1,422 = 1,422; 99.0% of 3,325 keys) | `docs/BUILD2_REPORT.md`, "Commands", "Cross-check with the audit" and its amendment of 2026-11-15; `docs/BUILD2_CROSSCHECK.md` |
| Table 3, the funnel (15,906 / 5,436 / 4,295 / 3,023 / 900 / 550), AnAge-only (4,068 / 659), every r and p in "What the controls change" | `dist/data/correlations.parquet` rebuilt 2026-11-15 after the empty-order scope was dropped from `buildScopes` (IC-8), trait `maxLongevityYears`, dataset `default`; the counts were made in an analysis session, not by the pipeline (IC-15 asks the build report to emit them). The earlier funnel (13,947 / 4,851 / 3,854 / 2,577 / 770 / 472) was computed before the repeat, motif, fourfold and hydropathy features joined the feature catalogue at e3d99b2 and so shared the Benjamini-Hochberg pool; it is reproducible from the rebuilt table by restricting to the classic feature families. |
| Codon third-position pattern (8 U-ending down, 7 C-ending up; UGC no longer passes with the EURING birds) | same file: scope `all`, features `codon:total_pc:*` with q < 0.05, PIC p < 0.05 with the same sign, and partial p < 0.05 |
| Example (threonine, cysteine, methionine, the site screen) | `dna-seq/mitoage-pipelines` `results/nd6-patch/` at fbb3798 (run of 2ee27a1 on 0f4e970; `results/euring/` at e1b862b for fb54cec; mammals as first run at da0c112): `aa_pgls.<Class>.tsv` from `mitoage longevity aa-pgls` (H1, method `pgls`, model `mass+composition`; the mixed-model count from method `mixed`), H2 from `pgls.Mammalia.tsv`; `docs/HYPOTHESES.md` |
| Reproduction: all 5,328,887 values of the seven tables, the 28 alignment files and the dated tree come out identical (against 0f4e970) | `dna-seq/mitoage-pipelines`, `docs/BUILD2_REPRODUCTION.md` at aee05c7 (origin/main), "How far it reproduces" |
| 485 of the 550 "All three" keep the sign of the correlation across species in the partial correlation (65 reverse); the partial is positive for UGG and GGG | `dist/data/correlations.parquet` as above: `sign(partial_r) == sign(pearson_r)` among the "All three" rows |
| Partial-correlation sample 1,386 of 2,211 (235 of 827 ray-finned fishes); whole-genome GC within classes, r and partial r (Mammalia 0.47 / 0.40, Actinopterygii 0.034 / −0.14 with p = 0.04, Aves 0.027 / 0.05, Reptilia 0.006 / −0.01) | same file: `partial_n`, feature `gc:total_mtDNA`, scope `all` and the class scopes |
| Survivors by feature: codons are 54% of the tests and 55% of the 550; in all species 27 of 40 skew, 11 of 16 GC-content and 139 of 741 codon correlations that pass the false discovery rate pass all three controls | same file, the funnel grouped by feature family |
| Exclusions behind 2,211: 49 estimated and 65 questionable lifespans | computed from `public/data/species.parquet` (live species, lifespan quality and method) |
| 106 invertebrates: 104 non-chordates, a lancelet and an ascidian | computed from `public/data/species.parquet` (live species by phylum and subphylum) |
| Cross-check: 8,733 changelog rows compared for the original species, 3,325 in both, 5,394 of the other 5,408 `refseq_successor` | `docs/BUILD2_CROSSCHECK.md`, the comparison table and the successor counts |
| The MCP server's paragraph (Data access and versioning) and its sentence in Data availability | `mcp/` and `mcp/README.md`; D8 in `docs/DECISIONS.md`. Its verdict uses the Table 3 definitions below, so the server and the paper count the same rows |
| The 2016 site against MitoAge 2 (The website and interface, its last paragraph; the Discussion's sentence on exploring) | www.mitoage.info visited 2026-11-15: fixed tables only, no `svg` or `canvas` on its pages, no sorting or filtering script (jQuery 1.10 and Bootstrap), `<meta name=viewport content="width=1024">`, no tree or alignments in its menu or user guide; MitoAge 2's views from `README.md` (routes, `DataTable`) and `src/components/charts/Scatter.tsx` (tap, click or keyboard opens a point's page), checked on https://just-dna.life/mitoage/ the same day at 375 px and desktop width |

Definitions used for Table 3: "FDR" is `q_value < 0.05`; "PIC" is `pic_p_value < 0.05`; "Both" adds
`sign(pearson_r) == sign(pic_r)` to both; "All three" adds `partial_p_value < 0.05`; "PIC + mass" (D11) is
`q_value < 0.05`, `pic_mass_p_value < 0.05` and `sign(pic_mass_r) == sign(pearson_r)`, beside the funnel. The repository rule
"a number shown on the site is one the pipeline computed" does not cover these counts. If the paper
keeps Table 3, the pipeline's report should emit it, so the manuscript can cite the report instead.


### Repeats, motifs and the rate of evolution (added 2026-11-14)

Every number in this subsection was first computed from mitoage-pipelines main at 22cb140, run on build 2's species
table, the dated tree and the quality filter, with the motif features from this repository's pipeline, merged into
main at e3d99b2. Each is unchanged on the build with the EURING birds (`results/euring/` at e1b862b, where the bird
rows of the motif table move and none passes; the rate test's cherries come from 1,371 species instead of 1,369) and on
the patched build (`results/nd6-patch/` at fbb3798: 340 cherries from 1,372 species, the same four tests pass).

| Number in the draft | Where it comes from |
| --- | --- |
| Inverted repeats, mammals, r = -0.40 (p = 2 x 10^-24), n = 604 | `motif_pgls.tsv`, class Mammalia, feature `inverted_repeats_total`, `spearman_rho`/`spearman_p` |
| the same over the major arc, r = -0.33, n = 530 (p = 3 x 10^-15) | same table, `inverted_repeats_major_arc` |
| p = 0.67 and p = 0.45 after the controls | same rows, column `p` (phylogenetic GLS with body mass and fourfold composition, Pagel's lambda) |
| 132 tests in four classes, none passes; smallest q = 0.16 | `motif_pgls.tsv` row count, `q` column |
| contact-zone inverted pairs, mammals, r = -0.18 (p = 8 x 10^-6, n = 602), p = 0.03 after controls | same table, `contact_zone_inverted_pairs` |
| 340 sister pairs (339 before the parrot's ND6) | `rate_contrasts.tsv`, rows with `gene == CONCAT` |
| mammals p = 0.02, q = 0.15 | `rates.tsv`, class Mammalia, gene CONCAT, normalisation `dS_mass_adj`, `includes_saturated` false |
| four of 655 single-gene tests pass and disagree in sign | `rates.tsv`: 655 rows, 4 with q < 0.05 (ND6 all species -0.219; Mammalia ND5 +0.220; Aves CYTB -0.021; Mammalia ND2 dN -0.017) |
| one record states a sequencing technology; 1,773 name a source INSDC accession | `assembly_provenance.tsv` from the haumea run of 2026-11-14 (`/data/uq2347/runs/mitoage/gaps/motifs/`) |

**Two results that were withdrawn, not one.** An exploratory Python run over 2,311 species, with tandem-repeat
counts that did not reject units built from a shorter period, gave mammalian G-quadruplexes at q = 0.048 over
601 species. Rerun on the database's own features while those still covered 922 species, that was gone
(q = 0.66) and a reptile G-quadruplex test passed instead (q = 0.027). On the full 2,335-species build the
reptile one is gone too (q = 0.38) and nothing passes at all. Three runs, three different survivors, none
reproducing: the draft reports the third and says the screen is null, and the trail is kept here.

**Coverage.** The motif features now cover all 2,335 species: the work was ported onto build 2 (decision D7,
merged into main at e3d99b2) and the features are ordinary members of the feature catalogue, so the false discovery
rate runs over the combined set. Classes are tested at 97 (reptiles) to 604 (mammals) species. The plot
explorer does not offer the new features yet (RM19), which does not affect any number here.

## Questions for the authors

**Q1. Strand convention: a bug or a convention?** The repository's documents call it the "base-label bug"
of build 1. The 2016 paper says (Data calculation) that the heavy strand was analysed. The release-1 counts
are the complement of the deposited strand everywhere, which for most vertebrates is the heavy strand. The
draft therefore presents the change as a convention made explicit, which is the reading kinder to the 2016
authors and, as far as the paper says, the accurate one. Options: (a) keep the draft's wording
(recommended); (b) call it an error, if the 2015 pipeline was meant to count the deposited strand. Either
way, users of the old site's skews need the sign warning.

**Q2. Comparing with the 2016 count of "more than 3,780".** The 2016 count was made over other scopes
(families included) and, as far as the paper says, without a multiple-testing correction. The draft cites
the 2016 number in the Introduction and does not set the build-2 counts against it as a decline. Should
the paper reproduce the 2016 count on release 1 under the 2016 rules, to make the comparison exact?

**Q3. Data licence.** Release 1 was under a Creative Commons licence; build 2 mixes CC BY-NC values from
FishBase and SeaLifeBase (549 new species). Which licence does MitoAge state for its own tables?

**Q4. Taxonomy counts.** Order and family are not harmonised between the original species (AnAge taxonomy)
and the new ones (NCBI); 41 new species have no order. The 2016 paper gave 304 families, 106 orders and
13 classes; the release-1 export as processed has 103 orders. The draft leaves order and family counts out
until open question (e) of `docs/BUILD2_OPEN_QUESTIONS.md` is decided.

**Q5. Contrasts: the clades that over-reject, and why it is not the tree.** Updated 2026-11-15 against
the rebuilt correlation table (32 scopes) and `src/data/generated/phylogeny.json`.

- The anomaly is real. Chondrichthyes rejects 42.8% of its 1,368 lifespan tests at contrast p < 0.05
  while 0.1% pass the FDR; Rajiformes 38.7% of 191 and Clupeiformes 35.0% of 200, with none passing the
  FDR; Acipenseriformes 39.6% of 197. Under the null about 5% would be expected.
- **The explanation this note previously gave is wrong.** Measured on the dated tree: of 2,229 internal
  nodes only 54 are polytomies, and resolving them costs 75 degrees of freedom in total; 556 of 4,534
  branches have length exactly 0, but after the contrast variance recursion only 12 of the 2,229
  contrasts are standardised by a daughter-variance sum below 1 Myr, and none below 0.01. Contrasts are
  not being divided by near-zero numbers, so near-zero branch lengths cannot explain a tenfold excess of
  rejections.
- Nor is it a positivisation error: the rejecting contrasts are 54% positive in Chondrichthyes and 49%
  in Clupeiformes.
- Inverting the t test from the published `pic_r` and `pic_p_value` gives an implied df of about n − 3 in
  every scope (2,172 for the 2,202 species of the all-species scope, 79 for the 82 Chondrichthyes), so
  the test spends essentially the full n − 1 contrasts. The Purvis & Garland (1993) polytomy correction
  is missing but is worth about 1% of df here, not a tenfold inflation.
- What the numbers do show is heavy tails: among the rejecting tests |contrast r| averages 0.43 in
  Chondrichthyes and 0.61 in Rajiformes (21 species), where |r| across species averages 0.09 and 0.19.
  A through-origin correlation of a few dozen outlier-dominated contrasts is not described by a
  Student-t p value.
- What to run: (a) a permutation null — shuffle log10 lifespan across the tips within each scope,
  recompute the contrasts and correlate against the fixed feature contrast matrix, which gives both a
  calibrated p value and the empirical chance rejection rate PR-3 asks for (the analytic "about 96 of
  770" assumes independent tests, which these are not); (b) the Garland, Harvey & Ives (1992)
  branch-length diagnostic per scope; (c) record `pic_n` and `pic_df` in the correlation table — they
  are absent today, which is why this could not be diagnosed from the published table at all; (d) a
  second ancestry control, PGLS with Pagel's lambda, over the same tests.
- The empty `order:` scope is fixed: `buildScopes` in `pipeline/steps/correlations.ts` no longer groups
  species that have no name at a rank, so the table has 32 scopes and 15,904 lifespan tests (IC-8).
- Across all scopes, 18.9% of the lifespan tests have PIC p < 0.05; the PIC column total (3,008) is
  reported in Table 3 but not in the text for the reasons above.

**Q6. The example from mitoage-pipelines.** Its own README says "Nothing here is peer reviewed". A database
update paper can carry a short worked example; whether to carry these results, or only point to the
repository, is the authors' choice. The example now reports the rerun on the dated tree (2026-11-14), in which
no amino acid passes a 5% false discovery rate in mammals; the threonine claim is cited to Kitazoe et al. 2008
(ref. 33, higher primates) and set against Aledo, Valverde & de Magalhães 2012 (ref. 34, 173 mammals).

**Q7. The reproduction document.** `docs/BUILD2_REPRODUCTION.md` of mitoage-pipelines was not on its
origin/main at the time of writing (head b113c0b). Once it lands, the Methods sentence on the independent
rebuild should say what it reports (how many values match), and both repositories should be cited by a
tagged release with a Zenodo DOI.


**Q11. Does the paper carry the repeats, motifs and rate subsection?** It reports three negative results and
one withdrawn positive. It argues the paper's own case - that correlations of this kind do not outlast a
control for ancestry - on features the 2016 release did not have, and it answers reference 18 directly. It
also lengthens the Results and rests on a feature set that currently covers 922 of 2,335 species. Keeping
it, cutting it to a paragraph in "What the controls change", or leaving it to the analysis repository are
all defensible. Related to Q6, which asks the same of the amino-acid example.

## Figures

Figures are numbered in order of first citation (draft 0.1's planned Figures 1 to 4 are now 3, 5, 1
and 2; the alignment is 4).

The paper's figures are in `figures/`; the supplementary material (the Supplementary Methods, Table S1 and
Figure 3—figure supplement 1) is in `supplementary/`, its figures in `supplementary/figures/`. Every figure is
made by a script in `figures/` from the current build (`bun run build` first), and the
JPEGs are overwritten in place. Redrawn and recaptured on 2026-11-15 for print sizes: one column 86 mm,
the page 178 mm, text at least 6 pt and images at least 300 dpi as printed.

```
bun docs/manuscript/v0.2/figures/figure-1-controls.ts        # Figure 1
bun docs/manuscript/v0.2/figures/figure-2-codons.ts          # Figure 2
env SITE_URL=https://just-dna.life BASE_PATH=/mitoage bun run preview --port 4349   # read the port it took from its log
bun docs/manuscript/v0.2/figures/capture-figures-3-4.ts http://localhost:4349            # Figure 3, its supplement 1, Figure 4
bun docs/manuscript/v0.2/figures/capture-figure-5.ts http://localhost:4349               # Figure 5
```

| Figure | Script | Printed width | Image | Smallest text as printed |
|---|---|---|---|---|
| 1 | `figure-1-controls.ts` | 178 mm | 3,000 × 2,568 px, 428 dpi | 7.6 pt |
| 2 | `figure-2-codons.ts` | 178 mm (158 mm tall) | 3,000 × 2,670 px, 428 dpi | 7.1 pt |
| 3 | `capture-figures-3-4.ts` | 178 mm: A across the page, B centred under it, 73 mm wide (218 mm tall) | 3,154 × 3,861 px, 450 dpi | A 5.0 pt, B 3.7 pt |
| 3—figure supplement 1 | `capture-figures-3-4.ts` | 178 mm: A (Regions) beside B (genome map), 86 mm each (160 mm tall) | 3,154 × 2,837 px, 450 dpi | A 6.0 pt, B 3.4 pt |
| 4 | `capture-figures-3-4.ts` | 86 mm (95 mm tall) | 1,524 × 1,678 px, 450 dpi | 4.3 pt |
| 5 | `capture-figure-5.ts` | 178 mm, A above B (207 mm tall) | 3,600 × 4,181 px, 514 dpi | A 5.3 pt, B 6.0 pt |

The screenshots cannot reach 6 pt by cropping alone: the site's smallest text is 8.4 to 13 CSS px, and the
narrowest layout that keeps a panel whole is 520 to 1,300 px wide. 3A needs 1,360 px before the table
stops scrolling sideways, so it is set across the page (decision D7: Figure 3 keeps A and B, and the Regions
chart and the genome map moved to Figure 3—figure supplement 1); the genome map draws its scale at 8.4 px; the alignment viewer cuts species
names when its grid is under 560 px. Each script prints the smallest text of each panel and its printed size.

- `figure-1-controls.ts` and `figure-2-codons.ts` read `dist/data/correlations.parquet` with hyparquet
  (dataset `default`, trait `maxLongevityYears`, the definitions of Table 3 above), draw SVG, have headless
  Chrome render it at three times its size, and have ImageMagick write the JPEG (quality 92). Figure 1 holds
  a copy of Table 3 and refuses to write when any count differs; Figure 2 refuses unless exactly the twenty
  codons the legend names pass all three controls.
- `capture-figures-3-4.ts` and `capture-figure-5.ts` drive headless Google Chrome 157 over the DevTools
  protocol through `cdp.ts` (light theme, device scale 3), each panel at the narrowest viewport that keeps
  it whole, and have ImageMagick label and join the panels (quality 90). `cdp.ts` also holds the colour
  workaround below and turns sticky bars to relative so they are not painted over a capture.

| Panel | Page | Viewport | State and cut |
|---|---|---|---|
| 3A | `/species/` | 1,360 px | sorted by maximum lifespan, longest first; toolbar with the two download buttons, the count and the first eight rows |
| 3B | `/tree/` | 600 px | as it opens (by rank, lifespan ring); the tree and its legend, without the taxon card and the controls |
| 3—S1 A (was 3C) | `/compare/class/mammalia/?chart=r` | 560 px | the Regions card's title, chart, key and note, without the selectors |
| 3—S1 B (was 3D) | `/species/balaena-mysticetus/` | 640 px | the Genome map card's title, map, legend and keys, without the help card |
| 4 | `/genes/cox1/` | 660 px | Alignment card, class Mammalia, longest-lived first; title, count line, the first 20 rows (24 columns) and the colour key |
| 5A | `/compare/plot/?x=maxLongevityYears&y=gc:total_mtDNA&scope=class:Mammalia&fit=1&highlight=homo-sapiens,balaena-mysticetus,heterocephalus-glaber,mus-musculus` | 1,280 px | the plot card down to its class legend, beside the corrected statistics; without the hint, the switch, the buttons and the live statistics |
| 5B | the same page | 1,150 px | Strongest correlations as it opens (maximum lifespan, all species): the title, the summary line and the first five rows |

Panel 5B, as first retaken, showed two faults of the site: the intro line said "Rank all 1,257 mtDNA
features", and two of its top rows showed raw keys (`gravy:total_pc`, `ff:ND2:U`). Roadmap item RM19 fixed
both (the count comes from the data, and every extended feature has a name and a family), and Figure 5 was
recaptured in this layout from a build of `main` after RM19; every number in its legend was checked against it.

Every number in the figure legends was read off the images. Two differ from the text on purpose: the
scatter of Figure 5A shows all 627 mammals the site lists, where the text's r = 0.47 uses the 615 of the
default dataset; and the explorer's count of features that "hold up" on contrasts (496 for all species)
does not require the same sign, where Table 3's "Both" (291) does.

Headless Chrome 157 returned a stale computed colour when an element's inline style changed within one
task, so the tree (3B) and the alignment (4) drew every mark in one colour. The capture reads each colour
from a fresh element instead, which matches what the app's own Chromium 156 draws on the same pages. A
headed Chrome 157 resolves the same colours correctly on the live site (checked on 2026-11-14), so this is
a quirk of headless capture, not of the site.

- **Figure 1** stacks, for each scope of Table 3, the tests with p < 0.05 by the furthest control they pass
  in turn (FDR, then contrasts with the same sign, then body mass), as a share of the scope's tests. Each
  stage is a subset of the one before, so the segments are exact differences of Table 3's columns. The
  four greens are one ordinal ramp (#86c27c, #4fa65a, #1f8a3b, #0b3a1c), checked for monotone lightness,
  step gaps and contrast with the white page.
- **Figure 2** places the 64 codons of `codon:total_pc:*` in scope `all` by Pearson r and contrast r, one
  panel per third base, filled where the codon passes all three controls. Only the twenty that pass are
  labelled, placed so no label overlaps another or a coloured point, with leader lines in the crowded
  clusters; the legend's markers are drawn in all four colours. The bases wear the site's nucleotide
  colours (`--nt-t`, `--nt-c`, `--nt-a`; G one step darker than `--nt-g`, #e09a10, to show on white). As
  four colours in one scatter they fail a colour-blindness check (A against U), so each panel shows one
  base and greys the rest.

Recomputing Table 3 from the same file for Figure 1 reproduced every count in it. The total row's count of
scopes was wrong in draft 0.1: the table held 33 scopes (32 named and the empty `order:`), not 34; since the
IC-8 fix the empty scope is gone and the table holds 32.

## Supplementary Methods

`supplementary/mitoage2.supplementary.md` (added 2026-11-15) is the long form of the Methods: sections S1 to S14, each the
flow of decisions behind one step (what was done, why, the alternative not taken, what it assumes, what is not
known), for a reader who will not open the code. The main text points to them ("Supplementary Methods S4") from
each Methods subsection, the two worked-analysis subsections and the MCP paragraph; it is otherwise unchanged.
Table 4 (the pinned versions) moved there as Supplementary Table S2 (D7), so the main text's tables are 1 to 3,
cited in order.

- **Where its facts come from.** Each rule cites its file, and where it matters the line, in a hidden
  `<!-- src: -->` comment: the pipeline code (`pipeline/`, `src/data/index.ts`), `docs/BUILD2_REPORT.md`,
  `BUILD2_CROSSCHECK.md`, `BUILD2_OPEN_QUESTIONS.md`, `ANALYSIS_FINDINGS.md`, `DECISIONS.md`,
  `plans/DATA_BUILD2_DECISIONS.md`, and in mitoage-pipelines (f2006a9) `docs/BUILD2_REPRODUCTION.md`, the README and
  the analysis code. Where no document records a reason for a choice, the text says so instead of supplying one.
- **Checked while writing.** The seven tables and 28 alignment files have the same SHA-256 in Hugging Face
  revisions 653afe2a (the reproduction's), 6efa0959 (the analyses') and c525adbf (the paper's); the two
  extended-feature tables exist only in c525adbf and equal `public/data/`. The strand diagnosis (0 of 18,030
  region rows match with release 1's labels, 17,677 after swapping) is from the first pipeline run's build
  notes (`plans/handoffs/HANDOFF_mitoage-next-site_2026-11-12.md`).
- **Found while writing, and asked in the supplement** (S14 lists them): the record-choice rule orders by date
  before length, against the default's wording (S2); the repeat and motif thresholds have no recorded source
  (S7.3); the versions and commands of the aligner comparison are not recorded (S8); the audit behind the
  cross-check is unpublished (S11); `aa-pgls`, `motif-pgls` and `rates`, which give every number of the two
  worked-analysis subsections, are not recorded as rerun (S11); the reproduction covers neither the
  extended-feature tables nor the correlations (S11). S10.6 now carries the `ape::pic` comparison and
  the cluster calibration (`docs/PIC_CALIBRATION.md`), the dominating sister pairs that explain the fish
  scopes, and the sign-flip p value published beside the t test (D10); whether to report the contrast result
  with body mass partialled out is reported beside the uncorrected one (D11): Table 3's "PIC + mass" column,
  393 of 4,299.
- **Edited** with manuscript-prose-edit and manuscript-deslop in run `20261115T064112Z-52913208` (not in git):
  claim guard clean against each pre-edit copy; three sentences of the first draft that stated something no
  document records were removed; 7 of 15 "X, not Y" contrasts rewritten, the rest kept as real distinctions.

## Restructure for the reprioritized venues (2026-11-15)

The maintainer asked whether the reprioritized journals need a Discussion and allow more text, that "skews"
be explained where it first appears, and that the text read "as a thinking flow ... hypothesis driven" rather
than as statements one after another.

- **What the venues ask.** The third journal selection (run `20261115T001950Z-ea39ab48`, `stage-report.3.md`)
  ranks eLife Tools and Resources, Frontiers in Aging and Life Science Alliance first, then Molecular Biology
  and Evolution (Resources). eLife: "Introduction; Results; Discussion; Materials and Methods", no maximum,
  but it suggests at most 5,000 words of main text "excluding the Materials and methods, References, and Figure
  legends", abstract 150 to 200 words; it allows Methods after the Introduction. MBE: the same order, abstract
  250, no limit, the order may change. Life Science Alliance: no body limit, abstract at most 175. Frontiers:
  Introduction, Materials and Methods, Results, Discussion, at most 12,000 words. Database (Oxford): the
  Frontiers order plus a Conclusion. A Discussion is expected everywhere; the Conclusion is Database's alone, so
  none was added. Materials and methods follows the Discussion, the order the top three of the ladder bar
  Frontiers share (decided with the coordinating session); Frontiers would move it back.
- **What changed.** The Conclusion became a Discussion that carries the interpretation, the caveats taken
  out of the Results paragraphs (contrast power and calibration, the uncorrected and one-at-a-time tests, the
  interpolated node ages, strand orientation, sequencing technology, the invertebrates), the published claims
  retested (refs 16, 18, 30, 31, 33, 34) and what comes next; the thesis line is kept word for word. The
  Introduction ends in the two questions and how each was tested; each Results subsection now runs from the
  question to the test, the finding and what it means for the next step, with "we" where the authors acted.
  The skews are defined in the Abstract and the Introduction; contrasts, scopes, q, the default dataset,
  retired species, the major arc and dN/dS where the Results first use them; the four survivor counts get a
  reading guide (896 and 547 are summed over overlapping scopes and read as shares, about one in five and one
  in eight of the 4,299; 291 is all species alone; 496 is the explorer's count without the sign rule). The
  website and data access became the last Results subsections. Methods moved whole, unchanged but for one
  "below" made "in Results".
- **New in the text, from documents already in the repository:** "66 of them" (547 − 481, the partial
  correlation's sign reversals, from the table above); the contrast code's agreement with `ape::pic` and the
  excess where one sister pair dominates (`docs/PIC_CALIBRATION.md`, D10); the Chondrichthyes rejection rate
  (42.8% of 1,368), moved from the `> AUTHOR:` note into the Discussion.
- **Checked** in run `20261115T065503Z-3539a7e9` (not in git; 17 change records, `runs.py apply`). Every
  number and citation of the base is still in the text. Claim guard (`--revision`): exit 0; it lists the new
  sentences, all reviewed, and "for the first time" was removed. Smell check (`--check`, em dashes kept as
  eLife's figure-supplement names): passes; declarative chains (C16) 9 → 3, all three in the affiliations.
  Reader metrics: "we" 0.02 → 0.36 per 100 words, acronyms 1.82 → 1.51; sentences over 35 words 12% → 16%,
  mostly the statistics sentences of the Results.
- **Length.** Prose of the main text without Methods, tables, legends and notes: 3,107 → about 4,350 words
  (eLife suggests at most 5,000); the Discussion is about 870 words against the Conclusion's 229; Methods
  unchanged at about 2,070. The whole file: 9,283 → about 10,650 words. Abstract about 230 words: within
  MBE's 250, above eLife's usual 200 and Life Science Alliance's 175.

## D14 answered: two limits stated, no new analysis (2026-11-15)

Decision D14 of run `20261115T054110Z-dac824e9` (optional sensitivity analyses; findings PR-9 and PR-13). The
authors chose to state both limits rather than rerun:
- **The rate test (PR-9).** The Discussion now says the relative-rate test's dN and dS are Nei–Gojobori counts
  not corrected for multiple hits, which saturate over the distance from a sister pair to its outgroup, so the
  test may be biased towards the null.
- **Estimated AnAge ages (PR-13).** Materials and methods, "Inclusion and lifespan precedence", now says the two
  sources are treated asymmetrically: AnAge ages of wild animals that were estimated stay in the default dataset,
  among them the Greenland shark (392 years) and the tubeworms *Seepiophila jonesi* (300) and *Lamellibrachia
  luymesi* (250), all AnAge, wild, quality acceptable in `public/data/species.csv`, while FishBase growth-study
  ages leave.
Not run, and still open if a referee asks: rate contrasts on corrected distances or unsaturated triplets, the
all-species counts without the estimated AnAge ages, age at maturity as a covariate, and third-position
C/(C+T) tested once in place of sixteen codons.

`mitoage2.proposed.md` was set equal to `mitoage2.md` again; it had missed the D11 commit (58e145f).

## Regular NAR article, and what the assessment changed (2026-11-15)

**The venue.** The authors set aside eLife (no journal impact factor, and a Reviewed Preprint is not an acceptance;
an accepted paper with an impact factor is needed for a PhD defence). The fourth journal selection (run
`20261115T001950Z-ea39ab48`, `stage-report.4.md`; the dashboard's Journals tab) recommends a presubmission inquiry to
Nucleic Acids Research for a regular article, then MBE (Resources), then Life Science Alliance; the venue decision is
still the co-authors' to confirm. The eLife-only edits (impact statement, Table 4 against release 1, eLife's
supplementary-file wording) are kept on the local branch `elife-pass-wip` of the session's worktree, not on main.

**NAR's rules applied** (from the journal selection's reading of NAR's author guide on 2026-11-15; the page was
behind a bot check when re-read): Materials and methods before the Results; an abstract of one paragraph of at most 200
words, without references, figure citations or URLs (allowed only in the Database and Web Server issues). Not yet
checked for regular articles: a graphical abstract, a length limit, key points.

**What the research findings assessment changed** (mitoage-pipelines 3f09aa7, 50cad7f, 858974b, c1fae4c;
`docs/HYPOTHESES.md` there, H11 and H12; each number below re-read from the files named):

| Number in the text | Source |
| --- | --- |
| All species: of the 27 skew correlations passing all three controls, 4 keep sign-flip p < 0.05, 1 holds with mass partialled out of the contrasts; GC content 9 and 6 of 11; U/C codons 13 and 6 of 16 | `docs/analyses/pic-calibration/scopes/all.tsv` (`signflip_p`, `mass_r`, `mass_p`), joined with the all-three set from `dist/data/correlations.parquet` (dataset `default`, scope `all`) |
| Whole-genome AT skew with mass partialled out of the contrasts r = 0.04, p = 0.10 (sign-flip p = 0.011) | same file, `atSkew:total_mtDNA`. The assessment's "sign-flip p = 0.06, r = 0.02, p = 0.54" is the protein-coding AT skew (`atSkew:total_pc`), not the whole-genome one the paper quotes |
| Shuffled-lifespan rejection 29% in all species, 9% in mammals | same folder, mean `perm_reject` of `all.tsv` (0.291) and `class_Mammalia.tsv` (0.091) |
| Mammals: whole-genome GC sign-flip p = 0.0001, with mass in the contrasts r = 0.15, p = 2.3 x 10^-4; U at fourfold sites holds both | `class_Mammalia.tsv`, `gc:total_mtDNA`, `ff:total_pc:U` (C at fourfold sites does not hold with mass, p = 0.067, so it is not claimed) |
| GC vs gestation on contrasts r = 0.18, p = 1.8 x 10^-5, n = 564; lifespan 0.17 | `dist/data/correlations.parquet`, `gc:total_mtDNA`, scope `class:Mammalia`, traits `gestationDays`, `maxLongevityYears` |
| 573 / 544 / 484 of 625 live mammals with gestation, female maturity, birth weight | `public/data/species.csv` |
| H11: 32 / 27 / 24 / 3 of 43 on 439 mammals; Table 4; GC +0.28 SD per SD, q = 8 x 10^-5; birds 107-175 species; 72% of 296 bird maturity ages whole years | mitoage-pipelines `docs/analyses/h11/generation_time.female.tsv` (tree `pagel`) and H11 |
| H12: contact mismatch mammals -0.007 [-0.029, +0.015] q = 0.83, birds -0.014 [-0.037, +0.009] q = 0.24; GRAVY ND5 q = 0.013, ND6 q = 0.024 | `results/h12/structure_pgls.tsv` and H12 |
| Ref. 45, Kulaga et al. 2021: in 41 mammals, mtDNA GC (from MitoAge 1) and gestation the most impactful traits for maximum lifespan | the paper's full text (PMC7865694), checked 2026-11-15 |
| Ref. 46, Revell 2009, phylogenetic PCA | PubMed 19663993 |

**Waiting on the authors.** Whether Table 3 shows the sign-flip count (533 "Both" against 896; D10 keeps the t test);
whether to add H11 and H12 to the Supplementary Methods (S12 has no entry for them; the Methods point to
mitoage-pipelines instead); the general statement that lifespan, maturity, gestation and birth weight evolve together
carries no citation.

**Checked** in run `20261115T125217Z-6d955b96` (14 change records): every number and citation of the base text is
still there (the Abstract's "106 invertebrates" stays in the Results); claim guard exit 0; smell check passes (em
dashes of the figure-supplement names and the "you" of notes to the authors kept on purpose); reader metrics:
sentences over 35 words 17.7% -> 20.8%, mostly in the new Methods subsection. Length: prose outside Materials and
methods 5,587 words (4,357 before the assessment's results and before D11 and D14), Methods 2,647; abstract 200 words.

## Round v0.3: the improve run of 2026-11-15

Round v0.2 went to the co-authors as Google Docs on 2026-11-15, so this run worked on a new round, v0.3, opened
from v0.2 with `rounds.py open` (base 6f196ed). Run `20261115T132217Z-c1672440` under `data/cache/manuscript-reviews/`
(not in git); its summary is `manuscript-improve/run-summary.md` there, and the dashboard, the Word review and the
changes workbook sit beside `v0.3/mitoage2.md` (git-excluded). `v0.3/mitoage2.proposed.md` is the run's corrected
version: the working copy plus one proposal (DS-C1, the Introduction's "orders of magnitude" for composition).

- **Applied** (186 recorded edits, edits: apply): the review stages' corrections (79 applied, 10 merged, 3 held),
  then prose edit, deslop, story and journal adaptation for NAR, then the coordinator's fixes after the checks.
  Corrected on the evidence: the rate test does correct dN and dS for multiple hits (Jukes–Cantor, `rates.py`
  137–154; the D14 sentence above was wrong, and so was "each species' own code": the code shared by the three
  species, or code 2); 6 of the 16 U/C codons do hold with ancestry and body mass together; 5 (not 4) of the 27
  skews keep a sign-flip p < 0.05 in the published table (4 was the cluster calibration run's count); three
  supplement citations named the wrong authors ("Toren et al. 2021" is Pabis 2021).
- **Numbers re-read from the fresh build** (`bun run build` of 6f196ed, `dist/data/correlations.parquet` with
  `pic_signflip_p`, `pic_mass_r`, `pic_mass_p_value`): 15,904 / 4,299 / 3,008 / 896 / 547 / 393 (281 also passing
  the partial) and 533 by the sign-flip test. The main checkout's `dist/` is an older build without those columns.
- **Panel** (six referees, six readers, Claude and Codex; the Claude seats ran as subagents because the Claude CLI
  hit its weekly limit, so they carried the authors' setup): for NAR, the Claude referees give major revision,
  reject (skeptic) and major revision; the Codex referees minor, major and minor. For MBE: major, major, minor;
  minor, major, minor. Readers: skimmer bookmark / bookmark, potential user try it / try it, informed outsider
  bookmark / bookmark. The comparison with run dac824e9 is in the run summary.
- **Checks** on the corrected version: claim guard, smell check and section roles pass (`requested-claims.yaml`
  lists what each widened claim answers); two independent re-checks on Codex (74 of 126 problems fixed at the
  first; the last five fixes after the second were not re-read). Running text 10,674 → 11,402 words; Abstract 196.
- **Waiting on the authors:** the To-do tab's 81 items, chief among them TimeTree's terms on redistribution, a
  calibrated contrast test beyond D10, NAR's graphical abstract, Figure 4, Figure 1 with the 393, the plot
  explorer's count of reversed contrasts, funding, conflicts, five-year availability, the data licence, Zenodo DOIs
  and a deposit of the current correlation table, reference renumbering.
- **Decided after the run:** dashboard decision D1 (TimeTree's terms on redistribution): "Leave the text as it is"
  (docs/DECISIONS.md, D12); nothing changed.
- **Decided after the run:** dashboard decision D2 (the contrast test beyond D10): "Add a sign-flip column to Table
  3" (D13). Table 3 and Supplementary Table S1 carry "Both (sign-flip)", read from `dist/data/correlations.parquet`
  of main's build (`pic_signflip_p` < 0.05 and FDR, same sign): 533 in all, 106 all species, 153 mammals.
- **The v0.2 Docs:** no comments yet (`v0.2/comments.yaml`, empty). The sync found two "edits" that are a
  conversion loss in the Docs ("`> AUTHOR:`" shown as "AUTHOR:`"), not carried.

## Peptides and downloads in round v0.3 (2026-11-15)

The maintainer: the peptides encoded inside mtDNA "must be mentioned", and the downloads, contact maps among them,
should be named. The numbers of the new Results subsection and of Supplementary Methods S12.8 are read from
`output/peptides/summary.txt` of the Hugging Face dataset `longevity-genie/mitoage-pipelines` at b9be61a (`mitoage
peptides pilot`): humanin open 558 of 624 mammals, ATG 464; SHLP6 open 548 of 621, ATG 621, and ATG in 2,189 of 2,191
vertebrates with the region (Actinopterygii 890/891, Aves 417/418); MOTS-c open 333 of 622, null median 0.564;
MTALTND4 open 131 of 625, share of 68 null windows at least as kept 1.000; null shares for humanin and SHLP6 0.097
and 0.143. References 54 to 57 were checked by title in PubMed (PMIDs 11371646, 27070352, 25738459, 37198654).
Supplementary Table S3's revisions are each Hugging Face dataset's `sha` on 2026-11-15 and the last commits of
`docs/analyses/cluster-2026-11-15/` (094aa57) and `results/h12/` of mitoage-pipelines (7692a55). A whole-build
peptide run with the synonymous-codon null, the contact maps of complexes I, III and V and an audit of the RefSeq
records were running on haumea when this was written; their numbers, and a refreshed `mitoage-pipelines` dataset,
replace the pilot's and the two GitHub rows.

Replaced the same day: the peptides section and S12.8 now read H15 of mitoage-pipelines on build 0f4e970 (job
6490249, `results/job4-peptides/0f4e970/` at 72b3eb2): `kept.tsv` (open, start, kept per class), `nulls.tsv`
(window and shuffle p and q at family level), `tree.tsv` (group `all`, published reading: SHLP6 2,285 tips, 2,052
kept, 67 losses, 15 gains, permuted mean 224.9; MTALTCO1 own code, 18 kept), `pgls.tsv` (26 tested fits, 18 not
assessed; humanin in reptiles q = 0.0386). References 58 (Robitaille 2026, PMID 41923604) and 59 (Yen 2026, PMID
42559346) were checked by title in PubMed. Table S3's revisions are the Hugging Face `sha` values read after the
refresh by another session (mitoage-pipelines 126d237, mitoage-nuclear-partners 7deb2e0, mitoage 0f4e970).

The record audit in Database content and S16 (the maintainer: "if RefSeq provided wrong data we should mention it,
maybe very short in the paper and in details in supplements") reads mitoage-pipelines H13 on build 0f4e970 (job
6490297, `results/job3-audit/0f4e970/` at b6af4ed): `pairs.tsv` (84 pairs at >= 0.99, 9 across genera, 3 at >= 0.999),
`nearest.tsv` (Seriolella porosa 0.97527 to Piaractus against 0.869142 in order; Neogobius 0.917873 against 0.844433;
136 out of order, 4 out of class), `strand.tsv` and `strand_summary.tsv` (2,210 conventional, GC skew negative in 2,209;
3 reversed, +0.27087 to +0.27971; 7 mixed; 124 unknown), `order_flags.tsv` (72 flags: strand only 34, gene content 22,
tRNAs only 6, reversed deposit 5, order 5), `code.tsv` (no mismatch; Pelomedusa subrufa 6 + 8 stops). Reference 60
(Hebert 2003, PMID 12614582) was checked by title in PubMed.

## Not yet done
- Decided by the authors on 2026-11-15: D2, MitoAge 2's address is https://just-dna.life/mitoage/, with
  www.mitoage.info to follow once it is redirected; maintenance is by the authors as needed, errors through
  GitHub issues. D11, Author contributions in CRediT roles (A.K. most of the work, N.U. infrastructure, D.T.
  human validation of the AI-assisted work and editing before submission, R.T. supervision). D13, post on
  bioRxiv now; before posting, the AI-use statement (D9), the competing-interests and funding statements,
  and a copy without the draft header and the `> AUTHOR:` notes are needed. D1, the venue, is being
  re-evaluated for a December 2026 submission, publication by spring 2027, all analyses kept and no venue
  harsh on AI use.
- The decisions of the 2026-11-15 runs are in `mitoage2.dashboard.html` (To-do tab, 18 decisions; the run that
  revised the paper has its own dashboard, `mitoage2.revision-run.dashboard.html`; both files stay out of git).
  The venue comes first: a second journal selection that keeps the results and allows rolling submission
  recommends a bioRxiv preprint now, then eLife (Tools and Resources), Molecular Biology and Evolution
  (Resources) or Database (Oxford); NAR's Database issue (January 2028, results cut) is the slow option. The
  draft now follows eLife's order (see "Restructure" above).
- A second, independent panel read the revised paper for eLife: three major and three minor revisions, against
  five and one this morning (for NAR, so not like for like). What persists needs the authors: the contrast
  test's calibration (it rejects about 40% of tests in fish scopes, more than the uncontrolled test, which
  suggests checking the contrast code against an established implementation), strand orientation per record,
  a second ancestry model, and the Abstract's "independent reproduction", which does not cover the correlations.
- Figure 3 is split (D7): A and B stay, the Regions chart and the genome map are Figure 3—figure supplement 1. Its
  smallest text still prints under 6 pt (3B 3.7 pt, the genome map 3.4 pt; "Figures" above).
