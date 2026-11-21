# Cluster handoff: MitoAge analyses on haumea

A snapshot for an agent working on the cluster host `haumea` (user `uq2347`), written on 2026-11-17 at about
17:30 from the laptop sessions of 2026-11-12 to 17. It says what the sessions found, which jobs are still in the
queue, where every result lives on the cluster, and what is left to run. The ground truth stays in the two
repositories; where this file and they differ, they win, and this file is out of date.

Two repositories:

- **`dna-seq/mitoage`** (this one): the static site, the data pipeline (TypeScript, Bun), the manuscript. Its
  record of the analyses is `docs/ANALYSIS_FINDINGS.md`, a copy of the pipelines' entries.
- **`dna-seq/mitoage-pipelines`** (Python, uv): every analysis. Each hypothesis is an entry H0 to H26 in
  `docs/HYPOTHESES.md`, written and committed **before** its code runs; its Slurm files are in `slurm/`, its tables
  in `results/`. This is the file to read first on the cluster.

## Rules on the cluster

These come from the maintainer; each was said after something went wrong.

1. **The cluster runs only code that is on `main`.** Code is pushed from wherever it is written, then pulled on
   haumea and submitted. Results return to `main` as their own commit, whose message names the job ids and the
   commit they ran from (example: "H17 from haumea (jobs 6493605 and 6493606, run from 329d9a6)").
2. **Sync both ways before use.** In the checkout you use: `git status`, `git fetch`, then `git pull --ff-only` or a
   rebase onto `origin/main`. Never discard uncommitted work; report it. The laptop pulls what the cluster pushes.
   Never copy code between laptop and cluster with scp or rsync.
3. **Never pull into a clone a job is running from.** The jobs read their code from the clone at run time.
4. **mitoage work goes on the `compute` partition, with `--nice=10000`.** The GPU partitions belong to KronLSTM
   (`kron-*` jobs), which "must be highest in priority". All jobs share account `itmz`'s limit of 320 CPUs, so a
   mitoage job can delay a Kron job even on CPU nodes; `--nice=10000` keeps Kron first (or
   `scontrol update jobid=<id> nice=10000` after submitting). Before any GPU job: `sinfo -p gpu768,gpu192,gpu1024` and
   `nvidia-smi` on the node, and say what was found; keep the "a card with 20 GiB free, else wait" guard.
5. **Leave the maintainer's own checkouts alone** (`~/sources/mitoage`, `~/sources/mitoage-pipelines`), unless asked.
   Run from a fresh clone under `/data/uq2347/runs/mitoage/<name>/`.
6. **`build.sbatch` there hard-codes `cd /home/uq2347/sources/mitoage`**, the maintainer's checkout. To build a clone
   of your own use `sbatch --export=ALL,WT=<clone> build-wt.sbatch` (and `data-wt.sbatch` for `bun run data`).
   `grep -n cd` any job file before submitting it.
7. **Commits on haumea need an explicit author**: there is no `user.email` there. Pass `-c user.name=... -c
   user.email=...` with the author of the repositories' other commits (read it from `git log -1 --format='%an %ae'`).
   `git push` over https works from the login node.
8. **`sacct` and multi-path `scp -r` can hang** for minutes: wrap them in `timeout`.
9. **A result is not read before its controls pass**, and the reading fixed in the hypothesis entry is the one used.
   "Not assessed" (a check that could not run) is never written as "not detected" or as a pass.
10. **Pages say what the data shows, never which build or revision**; those go into READMEs, manifests and the paper.

## The queue at 17:30 on 2026-11-17

`squeue -u uq2347` showed these mitoage jobs (the four `kron-*` jobs on `gpu1024` are not ours; do not touch them):

| Job | What | State | Runs from | Log |
| --- | --- | --- | --- | --- |
| 6500884 (array 0-43, at most 12 at once, 16 CPUs each) | H18, interface energy of the 44 cybrid (host, donor, complex) tasks, OpenMM on CPU | task 0 running since 17:20, the rest pending on the CPU limit | `/data/uq2347/runs/mitoage/h17-cybrid` at 313f3e3 | `h17-cybrid/slurm/logs/6500884_<task>.log` |
| 6500885 | H18 check: collect, readout, tests, breaks of each guard | waits for all of 6500884 (`afterany`) | same | `h17-cybrid/slurm/logs/6500885.log` |
| 6490194, 6490198 | H3 Coevol, published chains 1 and 2 resumed, leg 1 (MPI, 8 ranks) | running since about 19:15 on 2026-11-15, 3-day limit | `/data/uq2347/runs/mitoage/coevol-resume` at d6581f1 | `coevol-resume/slurm/logs/coevol-<job>.log` |
| 6490202, 6490206 | H3 Coevol, new chains 1 and 2 with the dated ages fixed (`-fixtimes`), leg 1 | same | same | same |
| 6490195-97, 6490199-201, 6490203-05, 6490207-09 | legs 2 to 4 of the four chains | pending, each `afterany` the leg before | same | same |

Coevol progress at 17:30: resumed chain 1 at 3,151 points, chain 2 at 3,108; fixed-age chain 1 at 2,323, chain 2
at 2,097; each towards 15,000, checkpointed every 6 h under
`coevol-resume/data/output/longevity/coevol{,-fixed}/checkpoints/chain{1,2}/`. At the observed 72 to 81 s per
point the four 3-day legs end around 2026-11-27 short of 15,000, so a fifth leg will probably be needed
(`docs/COEVOL_SPEED.md` in the pipelines says how they are chained). **Nothing from these chains is read until
tracecomp gives effective sample sizes above 100 and small relative differences between chains** (the first run had
an ESS of 7 for dN/dS).

The `h17-cybrid` clone is 12 commits behind `origin/main`. Do not pull it until 6500885 has finished; then pull
`--ff-only`, add H18's tables under `results/h18/`, write H18's result into `docs/HYPOTHESES.md` (the reading fixed
there), commit naming jobs 6500884 and 6500885 and commit 313f3e3, and push.

## Held, waiting for CPU (the maintainer, 2026-11-16: "so far we are hitting cpu capp on the cluster")

Code and job files for all of these are on `main` of `mitoage-pipelines`; none has been submitted.

| Hypothesis | Job file(s) | Size | Clone ready on haumea |
| --- | --- | --- | --- |
| H26 R1 and R4: RELAX on long-lived-for-mass branches (2 classes x 21 draws) and aBSREL (draws 0 and 1) | `slurm/adapt-longevity-selection.sbatch`, then `adapt longevity-coupling` and `adapt longevity-readout` | array 0-45, 4 CPUs, 8 GB | `h26/clone` at f9a914a (R2 ran from it) |
| H21 to H25: diadromous and deep-sea fishes, hibernating and marine mammals, hibernation and longevity, inside bats | `slurm/adapt-main.sbatch`, then `slurm/adapt-selection.sbatch` (array 0-114, 4 CPUs, up to 3 days each), then `slurm/adapt-coupling.sbatch` | about 460 CPUs if all run at once: throttle the array | none: make one from `main` |
| H19: the coupling in birds and fishes, by distance from the mtDNA-encoded core | `slurm/h19-classes.sbatch` | 16 CPUs, 48 GB, 12 h | `h19-classes` at c63661b (inputs downloaded by `h19-download.sh`) |
| RM11: per-residue ESM embeddings at the contact positions | not written yet | GPU: check the cards first | none |
| RM16 step 4: blind scan of every reading frame of 20 codons or more, six frames, all species | not written yet | CPU | none |

H26's readout waits for R1: Holm over each class's primary readouts needs it. H26's C readout needs H23's
`readout.tsv` from the H21 to H25 run. Read the entry's "Fixed before any code was written" section before
submitting; nothing in it may change after a result is seen.

## What the sessions found

Numbers are from `docs/HYPOTHESES.md` of `mitoage-pipelines` at fbf36b1; read the entry before quoting one.
Build 2 has 2,344 species; the manuscript cites build 0f4e970.

| | Question | Answer |
| --- | --- | --- |
| H0 | Do the alignments depend on the aligner? | No for COX1-3, CYTB, ND1 (agreement 0.985 or more); ND6, ATP8, ND5 are soft, so a site there must hold on a second alignment. |
| H1 | Amino-acid content against lifespan (cysteine, methionine, threonine) | No amino acid passes with body mass and base composition in mammals (smallest q 0.11); published directions there at half size; nothing in birds, fishes, reptiles. |
| H2 | Single residues against lifespan | No residue robustly associated. COX1 419 sits at the threshold (q 0.049); ND5 200 is a marsupial clade change. |
| H3 | Selection differs between long- and short-lived lineages | RELAX: no gene holds across two species draws. Two-step HyPhy check: positive control failed, not read. Coevol: provisional, unconverged, being resumed (the queue above). |
| H4, H15 | Peptides encoded inside mtDNA (humanin, SHLP1-6, MOTS-c, MTALTND4 ...) kept across species | None kept beyond its host gene's conservation; only MENTSH in birds beyond the synonymous null (q 0.030). The window null with ORF windows could not run. |
| H5, H6 | Mito and nuclear subunits of one complex co-evolve | Yes: complex IV's nuclear subunits follow the COX genes (+0.58 against +0.03 for cytosolic controls), and embeddings too; not complex-specific. Positive control of the method. |
| H7 | Lifespan predicts the substitution rate (339 sister pairs) | No, under any of four normalisations, in any class. |
| H8 | mtDNA motifs, repeats, deletion contact zones against lifespan | None passes 5% FDR in 132 tests; the published inverted-repeat correlation (r -0.40 raw) is gone with mass, composition and the tree. Long-read control: only 25 long-read records, cannot run. |
| H9 | Mismatch at complex IV's mito-nuclear contacts against lifespan | Bounded null: -0.024 log10 years per SD, 95% [-0.050, +0.002], 1,373 species. Stop rule reached for the contact-residue branch. |
| H10 | Does aligning by structure change the columns? (806 ESMFold structures, 62 mammals x 13 genes) | No: median agreement 0.9997, core 1.000. |
| H11 | The composition signal that survives the controls | Follows the slow life history (maturity, gestation) in mammals, not lifespan alone; in birds only age at maturity, opposite direction. |
| H12 | The structural findings in every class | Hydropathy: mammals ND5 (-) and ND6 (+), q 0.013 and 0.024; birds nothing. Contact mismatch: no class (reptiles narrowly on the realigned build). Motifs: no class. |
| H13 | Audit of the build's records | 3 reversed deposits, 7 mixed; 84 near-identical pairs, 9 across genera (mislabel candidates, e.g. *Echis coloratus* / *Vipera berus*); no genetic-code mismatch. In the manuscript as Table S4. |
| H14 | Complexes I, III, V too: whole proteins or contact residues? | Whole proteins in all four complexes (p 7e-7 to 9e-4); contact residues and cross-interface pairs add nothing after Holm. |
| H16, H17 | Published cybrids: does contact mismatch, co-evolved pairs or ESM-2 predict which complex fails? | No score beats plain divergence by the rule fixed in advance. H18 (energy) is running. |
| H18 | Interface energy of the chimeric complexes | Read on 2026-11-21: adds nothing to divergence (`docs/ANALYSIS_FINDINGS.md`, H18). |
| H19, H21-H25 | | Written, not run (held). |
| H20 | Temperature, size, metabolic rate against the mtDNA clock | Not as metabolic theory predicts: in ray-finned fishes E = -0.22 eV [-0.49, +0.04], excluding 0.65 and 0.40 eV; mammalian tests unreadable (size control failed). Lehmann et al.'s GC term survives the tree (p 0.007), R2 0.49 not 0.77. |
| H26 | Long-lived-for-mass origins (R2, one pair per origin) | Birds: not detected (median delta-omega +0.009 [-0.014, +0.018], 41 pairs). Mammals: not assessed (6 unsaturated pairs); within orders nothing (26 pairs). R1, R4, C not run. |

On the site and data side (this repository): build 2 with the EURING birds and the patched parrot ND6 (0f4e970,
Hugging Face `longevity-genie/mitoage`); MAFFT alignments; the coevolution page (`/coevolution/`, D20) and the
complexes section (`/complexes/`, D21); the MCP server built but not yet on npm (RM20, the maintainer's tag);
`bun run inputs` so that `bun run data` runs on the cluster (job 6498687 rebuilt every committed file byte for
byte); `bun run duplicates` (12 near-identical congeneric pairs). The manuscript is at round v0.4, on the
co-authors' Drive folder since 2026-11-17, with PGLS in Table 3 and S1 (D18, D19).

The laptop sessions behind this, by theme (all in the Claude desktop app, folder `~/sources/mitoage` unless said):
the site's redesign, navigation, tree, page weights and charts (2026-11-12 and 13); the build 2 data pipeline,
FASTA downloads and the EURING list (13 to 15); integrating the cluster's mitoport and structure results (15);
the PIC and PGLS calibration (15); the manuscript rounds v0.2 to v0.4 and their dashboards (14 to 17); the
coevolution page and the non-longevity findings (16); the structural findings by class, gene retention, and
"adaptations that load mitochondria", which became H21 to H25 (16); Coevol speed-up, in `~/sources/mitoage-pipelines`
(15); the cybrid simulations H16 to H18 (15 to 17).

## Where the results are on haumea

Everything is under `/data/uq2347/runs/mitoage/` unless said. Most folders are full clones of
`mitoage-pipelines` made for one run; their `results/` were committed to `main` when the run ended, so `main`
holds the tables, and the clones keep the logs and intermediate files.

| Folder | What it holds | Committed as |
| --- | --- | --- |
| `cache/` | shared download cache: AnAge, build 2 sources, GenBank, the 2015 export, the snapshot, the tree | not committed |
| `rm12/` | the first-run RM12 scripts and logs (aligners, controls, PGLS, Coevol first chains in `out/coevol-repo/chain{1,2}.cov`) | H0-H3 tables were reproduced by the pipelines' commands |
| `mitoport/` | first-run RM11: NCBI ortholog sets (`ncbi/`), selection (`sel/`), rate covariation (`erc/`), ESM embeddings (`esm/`), the 5Z62 contact map (`structure/out/5Z62.contacts.tsv`), the interface run (`iface/out/`: sites, coupling, lifespan) | copied to `docs/analyses/cluster-2026-11-15/` here; H5, H6, H9 |
| `struct/` | RM13: 806 ESMFold structures `pdbs/<GENE>/<species>.pdb`, pLDDT, within-species and structural-MSA tables | HF `longevity-genie/mitoage-structures`; H10 |
| `coevol-resume/` | the four Coevol chains in progress, H3 two-step check (job 6490192) | `results/h3/two-step/` |
| `coevol-bench/` | Coevol MPI benchmarks (8, 16, 32 ranks) | `docs/COEVOL_SPEED.md` |
| `euring-rerun/`, `euring-data/` | the manuscript analyses before and after the EURING birds (jobs 6489876, 6489877) | `results/euring/` |
| `nd6-rerun/`, `nd6-pic/` | the same on the build with the parrot ND6 patched (job 6490079) | `results/nd6-patch/` |
| `pipelines-main/` | H11 clone (from 2026-11-15) | `docs/analyses/h11/` |
| `h12-structure/`, `h12-0f4e970/`, `hf-h12/` | H12 rounds 1 and 2 (jobs 6488097, 6488098, 6490380, 6490381) | `results/h12/` |
| `job1-contacts/`, `job1-contacts-base/` | H14 contact maps of complexes I, III, V (job 6490344) | `results/job1-contacts/` |
| `job3-audit/` | H13 record audit (jobs 6490112, 6490297) | `results/job3-audit/` |
| `job4-peptides/`, `job4-peptides-0f4e970/` | H15 peptides (jobs 6490085, 6490249) | `results/job4-peptides/` |
| `h17-cybrid/` | H16, H17 (jobs 6493605, 6493606) and **H18 running now** | `results/h16/`, `results/h17/`; H18 not yet |
| `h19-classes/` | H19 clone and inputs, not run | |
| `h20-thermal/` | H20 (job 6494078) | `results/h20-thermal/` |
| `h26/clone/`, `h26/data/` | H26 R2 (job 6497484) | `results/h26/` |
| `rm18/` | the sequencing-technology download (H8's control) | `results/h8/technology.tsv` |
| `gaps/`, `msa/`, `absrel-fixture/` | early motif and rate runs (2026-11-14), alignment runs (2026-11-13), an aBSREL test fixture | not checked for this file |
| `site-main/`, `site-d20/`, `shots/` | site builds and headless screenshots | not committed |
| `build-*.log`, `data-*.log`, `*.sbatch` at the top | site builds and `bun run data` runs (job 6498687 is the byte-for-byte rebuild) | |
| `pipelines-check/`, `pipelines-verify/` | copies without `.git`; do not run from them | |

Tools: Coevol's MPI build at `/data/uq2347/tools/coevol-mpi/data/coevol`; OpenMPI 5.0.8 at
`/cluster/mpi/openmpi/5.0.8/`; uv at `~/.local/bin/uv`.

On 2026-11-17 `~/sources/mitoage` was one commit behind `origin/main` and `~/sources/mitoage-pipelines` was even;
both clean.

## What to do next, in order

1. When 6500885 ends: read its log (tests passed, every break caught), then H18's readout against the rule fixed in
   its entry; commit and push as above. Then `docs/ANALYSIS_FINDINGS.md` and RM11 in this repository take the result.
2. Look at the Coevol logs once a day: that each leg handed over to the next, and the point counts. Run tracecomp on the
   chain pairs (resumed 1 against 2; fixed 1 against 2) after each leg; report ESS and the relative differences, and
   read nothing below the bar. Submit a fifth leg if the fourth ends short of 15,000 points.
3. When CPU frees (check `squeue` for the `itmz` total against 320): H26's selection array first (RM12 waits on it),
   then H19, then H21 to H25, each with `--nice=10000` and the array throttled.
4. Report each finished run in the maintainer's channel (`#mitoalignments` for RM12, `#mitoage>mitoport` for RM11,
   `#mitoage` otherwise), with what was not assessed said as such.
