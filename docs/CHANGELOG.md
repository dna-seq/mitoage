# Changelog

Newest first.

## Unreleased

- **Links and chips on the green band read clearly** (2026-11-16, RM15). A link inside a hero's opening paragraph
  took the body's dark green and vanished on the band (seen on the new link to the complexes section from the genes
  page): it now takes the band's text colour, underlined. The band's decorative stars crossed the text of the
  translucent chips and of the gene list's counts: both now blur what is behind them (`backdrop-filter`).
- **The plot's sentence says which statistic it follows** (2026-11-16, RM15). The sentence above the live
  statistics on `/compare/plot/` followed Spearman's rho without saying so, and read "No clear relationship" beside
  a Pearson r of -0.20 with p = 8e-23. It now opens "By rank (Spearman)", and where rho shows nothing while
  Pearson's r does, the title is "No clear relationship by rank" and the text gives r and says a straight line finds
  a trend the species' order does not. The wording is `relationshipHeadline()` in `src/lib/explore/stats.ts`, with
  tests; each of three deliberate breaks fails one.
- **Both workflows check out with `actions/checkout@v7`** (2026-11-16, RM21, done), from v4. Read in its release
  notes: v5 moves to Node 24 (GitHub's hosted runners have it), v6 keeps the credentials in a separate file, v7
  refuses fork pull requests under `pull_request_target` and `workflow_run`; neither workflow uses those triggers.
  `deploy.yml` is tested by the push that carries this; `mcp-release.yml` runs only on a `mcp-v*` tag and has not
  run with it.
- **The sequencing technology of every record, counted** (2026-11-16, RM18, done). `dna-seq/mitoage-pipelines` at
  a4ab414 (`mitoage download technology`, `mitoage longevity technology`; `results/h8/technology.tsv`) reads it
  from each record's INSDC source at NCBI: 893 of 2,344 state one, 25 long-read, 642 short-read, 226 Sanger. No
  class has the 25 long-read species H8's control needs, so the control still cannot run; `docs/ANALYSIS_FINDINGS.md`
  says so with the counts. Ensembl was not used: the field is the submitter's, in the INSDC record, and Ensembl's
  mitochondrial sequences are copies of those records.
- **A Complexes section** (RM17, D21): `/complexes/` lists the four respiratory complexes with their mitochondrial subunits, and the page of complex IV shows which residues of COX1, COX2 and COX3 touch which of its eleven nuclear subunits in the solved human structure (298 of 1,000), a bar per residue along each subunit (where it sits, and how widely the human residue is kept across species), and the residues of every pair. Complexes I, III and V list their subunits and say that no contact map has been read. The data is `bun run complexes`, from the per-residue table made in `dna-seq/mitoage-pipelines`. No 3D viewer and no nuclear sequences on the site yet.
  The section is reached from the genes page, the coevolution page and the footer, not from the top menu: an eighth
  menu item squeezes the search box to three letters at 1,280 px. Checked at 375, 768, 1,024, 1,152, 1,280 and 1,440 px
  with no horizontal scroll.
- **Manuscript round v0.4 opened, with the H14 coevolution text and H20 on temperature** (2026-11-16). Round v0.3 had
  gone to the co-authors from 5b2ac14 before the H14 text was pushed (58b2d97), so the maintainer chose "Open v0.4
  with it": v0.4 is a copy of the repository's v0.3 with H14, and v0.3's two masters are back as released. v0.4 adds
  mitoage-pipelines H20 (`results/h20-thermal/`, 76c2c1f): in ray-finned fishes the mitochondrial substitution rate does not
  rise with water temperature, against metabolic theory (E -0.22 eV [-0.49, +0.04], 74 pairs); the mammalian tests
  cannot be read because their size control did not pass; Lehmann et al.'s GC-and-metabolic-rate model of mammalian
  lifespan keeps its GC term on the tree (p = 0.007) at R^2 0.49 rather than 0.77, its metabolic rate adding nothing
  beyond body mass. New subsection, S12.10, a Table S3 row and references 64-65. `docs/manuscript/NOTES.md`, "Round
  v0.4", has the sources of the numbers.
- **The coevolution page no longer labels its analyses H5, H6, H9 and H12** (2026-11-16, D20 amended). The maintainer,
  asked whether the hypothesis labels linking to mitoage-pipelines' record should go the way of the build note: "Yes,
  remove them". The lifespan and protein sections name each analysis by what it measures, the lifespan table's rows
  say "Contact mismatch" and "Pair discordance", and the downloads on `/coevolution/` and `/data/` drop the label
  before each file's description. `mitoport.json` keeps each file's hypothesis. The licence line under the
  downloads says "CC BY 4.0", linked, without the dataset card's quote, which stays in `mitoport.json`.
- **The cybrids scored by co-evolved pairs and by ESM-2** (2026-11-16, RM11, H17): `docs/ANALYSIS_FINDINGS.md` gains
  H17, the same text as `dna-seq/mitoage-pipelines` at ffdb2d6 (`mitoport cybrid-coev`, `cybrid-esm`,
  `cybrid-readout`; `results/h17/`). Neither score beats divergence; RM11 says so and keeps the interface energy open.

- **The coevolution page and the species sections no longer name builds or revisions** (2026-11-16, D20 amended).
  The maintainer, on the note "Computed on an earlier build": "visitors should not know such technicalities". The
  note at the top of `/coevolution/`, the line under each species section's title, and the revisions in the
  downloads' wording are gone; `public/data/mitoport/README.md` and `mitoport.json` still say which build the tables
  come from. A species with a discordance value that has no page, or a retired one, is now a warning of the site
  build instead of a sentence on the page.
- **Mito-nuclear coevolution on the site** (2026-11-16, D20). A new page, `/coevolution/` (in the menu), shows the
  coevolution tables of mitoage-pipelines (Hugging Face `longevity-genie/mitoage-pipelines` at 126d237, computed on
  build c525adb): 61 nuclear proteins against the mitochondrial subunits of the respiratory complexes (rate over
  branches, ESM-2 embeddings, residue coupling at complex IV's contacts), per protein and as group medians; each
  class's discordance at complex IV's mito-nuclear contact pairs; and the lifespan tests, stated as nulls (H9, H12).
  The 316 species with a discordance value show it in a section of their page, with their class's mean and the
  build it was computed on. The downloads page gains a group for the tables.
  - **The data:** `bun run mitoport` (`pipeline/mitoport.ts`) fetches the 11 files at the pinned revision, refuses
    any whose SHA-256 is not pinned (the pins were taken from files whose git blob ids matched Hugging Face's tree
    listing), and writes them as parquet to `public/data/mitoport/` without changing a value: empty cells are null,
    one header with spaces gets underscores, and every file is read back cell for cell. `mitoport.json` and a README
    say where each came from. `bun run hf` leaves the folder out.
  - **The claim checked:** the page, the species sections and the README say "none of these follows lifespan" only
    after `lifespanNull()` finds every H12 fit at q ≥ 0.05 and every H9 interval through zero; otherwise the build
    stops. All 316 species are in this build and none is retired.
  - **Tests** (`pipeline/tests/mitoport.test.ts`, `src/lib/mitoport.test.ts`): the parquet against the pinned
    sources cell for cell, the pins, the converter's refusals, the lifespan check's failures, the join by gene, and
    the group medians and class means against the numbers H5 and H12 publish (complex IV's subunits +0.58 against
    +0.03 for the controls; mammals 0.135 and 0.135). Each of 16 deliberate breaks of the code makes a test fail.
  - **The header:** with a seventh menu item the one-row header overflowed the window by 38 px from 1,152 to 1,280 px
    wide; the menu row may now shrink below its content's width and the search box gives way first
    (`src/components/ui/Header.astro`). Checked at 1,152, 1,280 and 1,440 px, and the new pages at 375 px, with no
    horizontal scroll.
- **Round v0.3 reports what the build shows beyond longevity: mtDNA and nuclear subunits co-evolve as whole proteins
  in all four complexes** (2026-11-16). A Results subsection and Supplementary Methods S12.9 read mitoage-pipelines
  H14 (haumea job 6490344, build 0f4e970, tables at 8eeaf6f): in complexes I, III, IV and V the nuclear subunits
  co-vary with the mtDNA-encoded ones as whole proteins (p = 7e-7 to 9e-4 against cytosolic controls), and neither
  side's contact residues nor the pairs across the interface add anything after Holm (smallest adjusted p 0.11,
  complex I's pairs). A Discussion paragraph, "Beyond lifespan", gathers H13, H14 and H15 and the released data.
  References 61-63 (Osada & Akashi 2012; Weaver et al. 2022; Piccinini et al. 2021) checked by title and against
  Crossref; S12.5 no longer lists the residue-level co-evolution as unreported; Table S3 gains the H14 tables.
  Documents only.
- **Round v0.3 is on the co-authors' Drive folder** (2026-11-16, the maintainer: "we have to release it"): the paper and
  the Supplementary Methods as Google Docs, the six figures and Supplementary Table S1, built from 5b2ac14
  (`rounds.py push 0.3`). Tables in the Docs are set at 9 pt by `docs/manuscript/build-docx.ts`, so Table 3's eleven
  columns fit the page without breaking a number or a word; every table was checked in a PDF export of the Docs.

- **Round v0.3 says which RefSeq records are probably wrong** (2026-11-15). Database content gains a paragraph
  on the record audit (mitoage-pipelines H13, rerun on build 0f4e970 as haumea job 6490297, tables at b6af4ed):
  nine near-identical pairs across genera (*Echis coloratus* and *Vipera berus* identical over 11,265 bases; the
  shelduck record a mallard's), a butterfish record nearest a characin, three reverse-complemented vertebrate
  deposits whose GC/AT balance is of the other strand, genes left unannotated; every stated genetic code matches
  its taxon. New Supplementary Methods S16 and Table S4 give the method and every candidate, the Discussion's
  strand paragraph says the vertebrate deposits were checked record by record, reference 60 (Hebert et al. 2003,
  checked against PubMed) supports the 1% threshold, and RM23 holds the follow-ups (flags in the build, the three
  reversed deposits, the annotation gaps, whether to report to NCBI). Documents only.

- **Round v0.3's peptides section reports H15 on the cited build** (2026-11-15). The Results subsection and
  Supplementary Methods S12.8 now cover nine published peptides (humanin, SHLP1-6, MOTS-c, MTALTND4, MTALTCO1,
  MENTSH; references 58 and 59 checked against PubMed by title) on build 0f4e970 (mitoage-pipelines H15, haumea job
  6490249, tables at 72b3eb2): SHLP6, humanin and MOTS-c are kept widely, but no frame is kept beyond open windows
  of its gene, only MENTSH in birds beyond its host's synonymous codons, and the decisive null could not run (under
  20 reading-frame windows per gene). Supplementary Table S3 follows: build 0f4e970, the refreshed Hugging Face
  datasets (mitoage-pipelines 126d237 with the complex IV contact map, mitoage-nuclear-partners 7deb2e0), and rows
  for the record audit (H13) and the peptide tables. Documents only.
- **The reproduction matches the build the manuscript cites** (2026-11-15). mitoage-pipelines aee05c7 applies
  D17's hand-checked gene annotations (the lists copied as data, the patch and gap rules written in Python) and,
  from a fresh data folder, matches Hugging Face revision 0f4e970 in all 5,328,887 values, the 28 alignments and the
  dated tree. Round v0.3 drops its caveat that the reproduction stopped short of the patch.

- **Table 3 and Supplementary Table S1 carry a PGLS column** (2026-11-15, D19): FDR, and p < 0.05 with the same sign for
  the lifespan slope of the phylogenetic regression of D18. Totals: 893 of 4,296; all species 232, mammals 260,
  ray-finned fishes 148, birds 69.
  - **The text:** round v0.3 (working and proposed copies) gains a Results paragraph (the total, 430 with body mass,
    576 with both controls, rejection rates near 5% where nothing passes the FDR except in skates and herrings), one
    sentence in Statistics, two in the Discussion, and Supplementary Methods S10.8.
  - **The numbers:** `docs/manuscript/numbers.ts` counts the column from `docs/analyses/pgls/` and refuses if those
    tables do not match the build. It regenerated S1, whose other twelve columns are unchanged.
  - **Corrections:** "Of those 4,295" now reads 4,296. The PGLS README and S10.8 no longer give an unexamined cause for
    the 30 singular fits with mass, and name the one refused fit without mass.

- **The PIC calibration covers the patched build** (2026-11-15): all species, Aves and Psittaciformes calibrated again
  on revision 0f4e970 (array job 6490100 from f360eea, committed from haumea as 0335977); the other 29 scopes are
  unchanged by the patch. Brownian-motion rates stay in 4.77–5.24% and the shuffled rate in all species at 29.0%, so
  round v0.3's S10.6 keeps its numbers; `docs/PIC_CALIBRATION.md` gives the three rows and the run.

- **The reproduction, the audit and the sources snapshot cover the EURING birds** (2026-11-15). mitoage-pipelines
  (bb5d70d) reads the EURING PDF with its own parser and, from a fresh data folder, matches the build with the
  EURING birds (Hugging Face f75bdc9) in all 5,328,755 values, the 28 alignments and the dated tree; it does not
  apply D17's gene patch yet, which round v0.3 now says. The Python audit reads the list through `pdftotext` and
  its cross-check agrees on all 1,422 new species (`docs/BUILD2_CROSSCHECK.md` regenerated); its scripts stay
  unpublished. The sources snapshot `longevity-genie/mitoage-build2-sources` is at revision a762151 with the 2,250
  tree answers (the 20 for the new birds byte-identical to the pipeline's cache); it does not copy the EURING PDF,
  which the Internet Archive keeps and which states no licence.

- **Round v0.3 cites the patched build** (2026-11-15, the maintainer: "Move v0.3 now"): Hugging Face revision 0f4e970,
  `dna-seq/mitoage` 03c0949, in the opening note, Data availability and reference 40. Materials and methods say how a
  missing protein gene is handled (flagged with its reason; the parrot's ND6 added). The numbers that move: the funnel
  5,441 / 4,296 / 3,025 (900, 550, 393, 535 unchanged), Table 3's all-species PIC 566 and Aves p < 0.05 687, the
  AnAge-only and sign-flip counts, S3's orientation and major-arc counts, the changelog's 14,429 rows, Figure 5B's 495;
  Supplementary Table S1 rewritten (`numbers.ts --s1`), Figures 1 and 2 redrawn and Figure 5 recaptured. The
  mitoage-pipelines analyses ran again on the patched build (haumea job 6490079, code of 2ee27a1; `results/nd6-patch/`
  at fbb3798 there): birds 382, 340 cherries from 1,372 species, the bird contact result −0.016 (q = 0.17); the same tests
  pass and H11 is byte-identical. `docs/manuscript/NOTES.md` lists every change.

- **PGLS over every lifespan test, from haumea** (2026-11-15, D18, RM22): array job 6490080 from f360eea, tables in
  `docs/analyses/pgls/`. At λ = 1 it reproduces the table's contrast p value on all 15,906 tests.
  - **Totals:** 893 of the 4,296 FDR-passing correlations pass PGLS with the same sign (the contrast t test's
    "Both": 900); 430 pass with body mass in the model (PIC + mass: 393).
  - **Different tests behind the totals:** mammals 260 against 164, all species 232 against 292, ray-finned
    fishes 148 against 221.
  - **Null scopes:** where nothing passes the FDR across species, PGLS rejects about 5% (Chondrichthyes 75 of
    1,368, against 585 for the contrast t test), except Rajiformes (12.6%) and Clupeiformes (22%).

  How it enters Table 3 is the maintainer's to decide; the manuscript is unchanged.

- **The published cybrids against our contact scores** (2026-11-15, RM11, H16): `docs/ANALYSIS_FINDINGS.md` gains
  H16. Its code, measurement table and result tables are in `dna-seq/mitoage-pipelines` at 0b1c5e8 (`mitoport
  cybrid`, `results/h16/`). The ROADMAP's RM11 no longer lists the calibration as open and names the interface
  energy as the next step.

- **PGLS with Pagel's lambda for every lifespan test** (2026-11-15, D18, RM22). Three new files:
  - `pipeline/lib/pgls.ts` fits it as contrasts on the λ-scaled tree, pruned to the species fitted.
  - `pipeline/pgls-table.ts` fits each test of the table as feature ~ log10 lifespan, and once more with log10
    body mass added.
  - `pipeline/pgls-table.sbatch` runs it on haumea, one array task per scope.

  `pipeline/tests/pgls.test.ts` checks it against a dense GLS written in the test, against the table's contrast
  tests at λ = 1, and for the likelihood maximum. Each check was confirmed by breaking the code it guards. On
  Primates the run reproduces the table's contrast p value at λ = 1 on all 204 tests.

- **mitoage-pipelines' hypotheses record matches round v0.3** (2026-11-15): its `docs/HYPOTHESES.md` gives the numbers
  of the build with the EURING birds (H11 at 500e1d2, H1, H2, H7 and H12 at 35ae7ae), and `docs/manuscript/NOTES.md`
  no longer lists it among what describes the build before.

- **The MCP server is pinned to the patched build** (2026-11-15): `mcp/src/dataset.ts` names Hugging Face revision
  0f4e970 and the SHA-256 of its `mitoage.sqlite`; the server's own download code fetched the file at that revision
  and accepted its hash, and the parrot's ND6 is in it. npm still serves 0.1.0 until an `mcp-v*` tag releases this.

- **The provenance of Hugging Face revision f75bdc9 is recorded** (2026-11-15, under D9): the build with the EURING
  birds, packaged on haumea from fb54cec (Slurm job 6489879) and uploaded from a session on the maintainer's
  instruction, 78 files checked against the hub. Round v0.3 cites it; the MCP server is still pinned to c525adb.

- **The Hugging Face mirror carries the patched build** (2026-11-15, D17): revision 0f4e970 of
  `longevity-genie/mitoage`, uploaded from the session on the maintainer's instruction, every file checked against
  the local copy. Round v0.3 still cites f75bdc9 and the MCP server c525adb.

- **Round v0.3's cluster numbers come from the build with the EURING birds too** (2026-11-15). The PIC calibration
  ran again for all 32 scopes (array job 6489844 from fb54cec, committed from haumea as b6c6ec6): the 28 scopes the
  birds do not enter keep every observed value, the shuffled-lifespan rate in all species is 29.0% (was 29.1%), the
  Brownian-motion rates 4.77–5.24%. The mitoage-pipelines analyses ran in one job on the build before and after the
  birds (`slurm/manuscript-rerun.sbatch`; `results/euring/` at e1b862b there); the run before reproduces the published
  tables. Birds go from 379 to 381, bird maturity follows seven or eight features (was six or seven), the column screen
  has 5,262 mammal tests (the realignment moved its columns; the same two pass), and the reptile contact divergence of
  H12 passes at q = 0.046 (was 0.052) with no reptile added, which the text reports and does not claim. Two corrections:
  292 live birds have a maturity age (296 counted retired records), and S10.6's "3,958" rows were 2,132 the cluster
  fills alone plus 1,826 neither side computes. Both runs read `public/data/` of fb54cec, byte-identical to
  Hugging Face revision f75bdc9, which the round pins. `docs/manuscript/NOTES.md` lists what still describes the build
  before EURING: the reproduction, the audit, the Hugging Face sources mirror and mitoage-pipelines' `docs/HYPOTHESES.md`.

- **Every protein gene a species lacks now says why, and the African grey parrot gains its ND6** (2026-11-15, the
  maintainer: "Yes, fix the gaps"). 26 live species lacked one of the 13 protein genes, silently. The records were
  read one by one:
  - *Psittacus erithacus* (NC_027847.1) has an intact ND6 its record does not annotate, complement(17376..17891)
    between tRNA-Pro and tRNA-Glu, where birds carry it, reading like the Amazon parrot's ND6. The build adds it from
    `pipeline/sources/gene-annotation.ts`, logs it in the changelog (`diff_class` annotation_patch) and flags the
    species `gene_annotated_by_mitoage:ND6`. A patch is refused if the record ever annotates the gene itself, or if
    its location is not one open reading frame ending in a stop (`pipeline/lib/gene-patch.ts`). The genome tables,
    the extended features and the alignments all read it.
  - The other five are not annotation gaps and stay out, each with a flag giving the reason: the tuatara's ND5
    and the icefish *Chionodraco myersi*'s ND6 are not in their records' sequences (both records say so); the
    *Homarus gammarus* record is incomplete and has no ND2; the Pacific golden plover's CYTB and the great crested
    grebe's ND1 are marked by their records as frameshifted (`gene_absent_from_record`,
    `gene_frameshifted_in_record`).
  - ATP8 in 18 bivalves (`gene_not_annotated`, not searched) and in both nematodes (`gene_lost_in_lineage`,
    Okimoto et al. 1992).
  - A missing gene with no recorded reason is flagged `gene_unexplained_absence` and listed for review, and
    `validate.ts` fails when a live species lacks a gene that no flag names. The site shows each flag as a sentence.
  - Tested on the real records from the pinned RefSeq release, and each test checked by breaking the code it
    guards.
  - The rebuilt data differ from the committed build only in the parrot's rows (one ND6 feature, its region stats,
    codon tables and protein features, one changelog row) and in the 26 flags. `bun run align` with MAFFT v7.526
    changes the ND6 alignment alone (2,324 sequences); the other 26 files are byte-identical. A few correlation
    counts move by one to five (`docs/manuscript/NOTES.md` lists them; round v0.3 pins Hugging Face revision f75bdc9, which predates the patch). The
    Hugging Face mirror is not re-uploaded (D6: by hand).

- **Round v0.3 pins the build with the EURING birds** (2026-11-15): Data availability and reference 40 name Hugging Face
  revision f75bdc9 (its data files match `public/data/` at 725da08 byte for byte) and the build commit 725da08, in
  place of c525adb and 84ba6f7, which describe the build before EURING.

- **Round v0.3 reports the peptides encoded inside mtDNA and lists every download** (2026-11-15). A Results
  subsection, "Peptides encoded inside mtDNA", gives H4's pilot (humanin, SHLP6, MOTS-c, MTALTND4: frames open in
  21% to 89% of mammals, none kept more widely than random open windows of its gene), with references 54 to 57
  checked against PubMed by title; Supplementary Methods S12.8 gives the test and the mammalian table, and S12.5
  no longer lists the peptides as unreported. New S15 and Supplementary Table S3 list each download (site `/data/`,
  the seven Hugging Face datasets and two tables still only in the repositories) with its revision, and Data
  availability names the data reusable beyond lifespan (embeddings, structures, the complex IV contact map, the
  peptide frames). The pilot's numbers are from `longevity-genie/mitoage-pipelines` b9be61a; H4's "start codon in
  every vertebrate" for SHLP6 is 2,189 of 2,191. Documents only.
- **The PIC calibration's per-scope table is made by code** (2026-11-15). `bun run pipeline/pic-calibration.ts summary
  <dir>` writes `docs/analyses/pic-calibration/summary.tsv` from the scope TSVs of a cluster run; on the first run it
  reproduces the committed table except one rounding (Bivalvia's Brownian-motion share, 5.21 against 5.20, from a test
  without replicates that the first summary counted as 0). Tested on rows of the real run
  (`pipeline/tests/pic-summary.test.ts`), each test checked to fail when the code it guards is broken.

- **A plan for the analyses the v0.3 skeptic asked for** (2026-11-15, `docs/REVIEW_ANALYSES_PLAN.md`, RM22).
  The analyses are calibrated counts (chance bounds from the PIC calibration, a phylogenetic permutation, PGLS
  over the table), power (simulation on the tree per scope, bounded against inconclusive losses, the retests'
  detectable effects against the published ones) and a waterfall from release 1 to Table 3 on the 903 shared
  species. Each comes with the place it runs and how its outcomes will be read; nothing has run yet.

- **Round v0.3's numbers come from the build with the EURING birds** (2026-11-15). `docs/manuscript/numbers.ts`
  recomputes every number the manuscript takes from a build (counts, Table 1, the funnel, Table 3, the S10.7 counts,
  the tree, the strand and feature coverage) and writes Supplementary Table S1 (`--s1`); on the build before EURING
  it reproduces what the text printed, and the diff against the new build gave every change: 2,344 species, the
  funnel 15,906 / 5,436 / 4,295 / 3,023 / 900 / 550, and 19 codons instead of 20 passing all three controls in all
  species (UGC drops out, so six synonymous pairs, not seven). EURING is cited as reference 53. Figures 1 and 2 are
  redrawn, Figures 3 to 5 recaptured (the species list needs a 1,390 px viewport since the GC/AT-balance headers).
  The cluster analyses, the PIC calibration of the four bird-affected scopes, the reproduction and the audit still
  describe the build before EURING; the text says so for the last two, and `docs/manuscript/NOTES.md` lists all four.

- **The EURING bird longevity list is read, from the Internet Archive's copy** (2026-11-15, D15). euring.org
  shows a maintenance page, so the pinned input is the archive's capture of `EURING_longevity_list_20230901.pdf`
  (same digest from 2023-12-16 to 2026-10-11, md5 pinned). `pipeline/lib/pdf-text.ts` reads the spreadsheet-exported
  PDF with `node:zlib` and refuses what it cannot decode; `pipeline/sources/euring.ts` parses 776 records of 399
  species, tested on the real file and checked by breaking the code each test guards. 9 European birds join build 2
  (2,344 species, `default` 2,211), all placed in the dated tree; the alignments are rerun with MAFFT v7.526 for
  2,325 live species. The 26 USGS birds keep their values and lose the `lifespan_provisional_euring_not_retrieved`
  flag, which no longer exists. RM5 is closed. The manuscript's v0.3 numbers still describe the build without
  EURING (`docs/manuscript/NOTES.md`).

- **The v0.3 manuscript says what the new website adds over the 2016 one** (2026-11-15, the maintainer: "in the
  manuscript you should somewhere also praise our UI features"). A paragraph closing "The website and interface"
  compares the two sites, from both visited the same day: the 2016 site's fixed tables, no charts, tree or alignments
  and a 1,024-pixel layout, against tables that sort, filter and download what they show, charts that follow their
  table, the plot explorer, the tree, the alignments, linkable views and a layout that fits a phone. One sentence in the
  Discussion's first paragraph says the same; `mitoage2.proposed.md` carries both, and NOTES.md where each claim comes from.

- **The site says GC/AT balance, not skew** (2026-11-15, D14): labels, table columns, chart axes, feature names
  ("GC balance of ND6"), page text, the README and the MCP server's tool descriptions call (G−C)/(G+C) and
  (A−T)/(A+T) the GC balance and the AT balance; the About page notes the usual name, skew. The data files, the CSV
  exports and the plot URLs keep `gc_skew`, `at_skew` and `gcSkew:` as identifiers, and the plot explorer's search
  still finds "skew". The supplement names the columns instead of saying the site calls it skew.

- **The manuscript says GC/AT balance, not skews** (2026-11-15, the maintainer): round v0.3 and its supplement
  call (G−C)/(G+C) and (A−T)/(A+T) the GC balance and the AT balance, defined once as "often called the GC and AT
  skews"; the supplement notes that the data files, the site and release 1 keep the name skew. The site and the
  data files are unchanged.

- **The v0.3 manuscript no longer talks about EURING** (2026-11-15). Its Materials and methods said birds take
  EURING then USGS values and that EURING could not be retrieved, and an author note repeated it; no EURING value
  is used, so the text now says the 26 birds take USGS ringing records, and the note is gone from `mitoage2.md`
  and `mitoage2.proposed.md`. The supplement (S1, S4) still records the source as not retrieved; RM5 stays open.

- **A new abstract for round v0.3** (2026-11-15, the maintainer): it opens with the question, names what the
  rebuild found (half of the original species changed, one in five correlations survives contrasts, published
  relationships not detected, the mammalian GC signal of the slow life history) and no longer mentions strand
  skews or the sign-flip count, which stay in the Results, Table 3 and the Discussion. 199 words.

- **The manuscript names www.mitoage.info as the site, with where it is now** (2026-11-15, the v0.3 run's decision
  D14): the Results and Data availability give [www.mitoage.info](https://www.mitoage.info) and, until that address
  moves from the 2016 site, https://just-dna.life/mitoage/, so co-authors reading round v0.3 can open the site.

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
