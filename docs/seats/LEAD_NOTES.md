# Lead notes

The state the lead's last holder left. State, not rules: the rules are the priming, `LEAD.md` beside
this file, and the kit's role `classes/lead/LEAD.md`.

## 2026-11-13 — first seating, on the cluster

- The seat has one chat account per machine: one for the cluster, one waiting on the desk for the laptop.
- **Before this seating** sessions without the seat built build 2 and the Compare charts and pushed them
  (D2 to D4). Nothing was in the plan; `docs/ROADMAP.md` was written from `docs/BUILD2_REPORT.md` ("Not
  done"), `docs/BUILD2_OPEN_QUESTIONS.md` and the code as it is. The handoff's item on the 5 MB rule was
  already settled by D4.
- **On the cluster:** Bun 1.4.2 is installed outside the home directory and must be put on the PATH by
  hand. The type check passes; the tests pass except `pipeline/tests/lifespan.test.ts`, which stops on the
  missing pinned inputs (RM7). The site build runs as a small batch job on a CPU node, never on the login
  node. Pages are viewed here by headless screenshots (RM3); the script and the browser sit outside
  the repository, with the seat's other run files.
- **Kept from before the kit:** `plans/handoffs/` (a record; no new file goes there) and
  `.claude/launch.json` (the preview launcher). Nothing retired, nothing moved under the watchdog.
- **Acting duties:** milestones (the channel's `state` and `milestones` topics, as the priming's
  "Reporting" already says). upstream-index does not apply as written: its watcher reads the Python
  package index and this repository has no Python; the upstream data sources are RM6.

### The alignment probe, 2026-11-13

RM10 holds its numbers. The run's files (the extraction script, the batch job, the alignments) are outside
the repository and are a probe, not pipeline code: the pipeline step is written fresh once the design is agreed.
The pinned RefSeq release file is on the cluster now (checksum equal to the pin), outside the clone's cache.

### Upstream check, 2026-11-13

| Source | Pinned | Found |
|---|---|---|
| RefSeq release | 237 | 237, current |
| AnAge | build 15 | build 15, current |
| FishBase / SeaLifeBase | v26.06 | not checked |
| USGS BBL | v2025.1 | not checked |
| EURING | not retrieved | the site answers again (a redirect); the list itself not fetched (RM5; read from the Internet Archive's copy on 2026-11-15, D15) |

### Later on 2026-11-13

- RM1 landed (3e791c6): species pages name the real lifespan source; milestone posted with screenshots.
- The maintainer: visual work is done on the cluster and proved by screenshots in the channel (`CLAUDE.md` §8).
- Waiting in the chat, each to go to the desk if unanswered on 2026-11-14: the go on RM10's design (after
  the prior-art report), the go on RM11's test and where its code lives, the pipeline inputs (RM7), whether
  the screenshot library may be a development dependency, and the build 2 defaults (RM4).
- Next unattended items, in order: RM3 (read every section's screenshots), RM2, RM8.

### Evening of 2026-11-13

- The alignments landed (5bdbbfc, D5): `bun run align`, live under `/data/alignments/`. MAFFT sits in an
  environment outside the repository and is put on the PATH by the batch job that runs the command.
- The site build of a branch runs as a batch job that names the worktree: check the folder it names before
  trusting its result (one branch build ran in the wrong folder; the build of main was rerun and passed).
- The seat table's `wake_people` gained `mitoalignments`, the secretary's channel for the arm; the
  maintainer writes in the topic of that name in the repository's channel, where the posts go.
- Open with the maintainer, in the chat: the go on mitoport's calibration and where its code lives (RM11);
  the pipeline inputs (RM7); the screenshot library as a development dependency; the build 2 defaults (RM4).
- Next: RM10 (the viewer), then RM12 starting with the aligner comparison.

### Night of 2026-11-13

- RM10 landed (0a88aee): the alignment viewer on the gene pages; screenshots in `#mitoalignments`. Left
  weak: in the dark theme the lifespan bars are a green close to the hydrophobic residues' green.
- The build is on Hugging Face (D6, 562150f): `bun run hf` packages it, the upload is run by hand with the
  maintainer's login, which the Hugging Face command line on this machine already holds. Pushed with each
  build; whether the dataset viewer built its tables was not checked yet.
- An island runs on the server too during the build: a browser-only call (an animation frame, a
  decompression stream) outside `onMount` fails the build, not the type check. And two signals that feed
  each other's effect need a comparison by value, or the page hangs with no error in the log.
- A dev server in a worktree whose `node_modules` is a link to the main clone's refuses to serve the
  islands; view a branch through its batch build and `preview`.
- The batch build of a branch is `build-wt.sbatch` in the runs folder, given the folder as `WT`; it prints
  the folder it builds. The shared CPU limit of the account can hold a 4-core job for half an hour.
- Everything about the alignments is posted in `#mitoalignments>general chat` (the maintainer: "move msa
  related answers and progress description to corresponding subchannel"). Python examples use polars and
  polars-bio (his word).
- The maintainer turned away at about 18:30 UTC. On his desk: #30 where the research code lives, #31 the go
  on mitoport's calibration, #32 the pipeline inputs, #33 the screenshot library as a dependency, #34 the
  five build 2 defaults that change results. The analysis plan (RM12) and its order were put to him in
  `#mitoalignments`; the order is a default, not a question on the desk.
- Next: RM12 step 1 (the aligner comparison), then the positive controls; RM3, RM2, RM8 after.

### Late evening of 2026-11-13

- RM12 steps 1 and 2 are done and reported in `#mitoalignments`. Aligners: the pin stays; ND6, ATP8 and ND5
  are soft, a site-level finding there is run on two alignments. Controls, mammals only: threonine up and
  cysteine down with lifespan hold after body mass, family and order, and base composition at fourfold
  sites; methionine shows nothing; outside mammals nothing holds. The control set for step 3 is those
  three. No real tree yet: family and order groupings.
- RM16 (peptides inside mtDNA) was asked by the maintainer and piloted: the human frames match the
  published ones; across species only SHLP6 looks kept, and none is beyond the null of its host gene.
  MTALTCO1 was not found by length; its coordinates are needed from the paper. Desk #36 asks whether the
  peptides go before the main analysis; the default is after.
- The research scripts and their outputs are in the cluster's run folder for this repository, under
  `rm12/`, until desk #30 says where they live. A column named after one letter (`C`, `I`, `Q`) breaks a
  statsmodels formula: the amino-acid columns are `aa_X`.
- Step 3 with a tree (IQ-TREE on the 13 proteins, phylogenetic regression): mammals keep one site,
  cytochrome b 43 methionine; ND5 200 is a marsupial marker; birds give nothing. Without a tree the same
  test gave 226 hits: family grouping is not enough, a tree is.
- Step 4 (HyPhy RELAX, long-lived against short-lived tips balanced within orders): ND3 and CYTB relaxed
  in the first draw, neither in a second disjoint draw. Withdrawn. Each gene takes 5 to 40 minutes on 4
  cores for about 110 species. `watchdog.py send` must be run from inside the repository.
- mitoport is going (the maintainer's go, relayed to desk #31): its files are in the run folder under
  `mitoport/`. IQ-TREE with a fixed tree needs `--keep-ident`, or it re-places identical sequences and the
  trees of two proteins no longer share branches. Two Coevol chains run until about 2026-11-15 midday.
- **A mistake to not repeat**: the roadmap's fixed rules for RM12 (the dated species tree, lifespan records
  of high or acceptable quality) were not read again before step 3, and the test ran on a gene-built tree
  and all records. The kron seat's note on its own run exposed it. On the right tree cytochrome b 43 fails
  (q = 0.29); corrected in the channel. Read an item's fixed rules again before each of its steps.
  `src/data/generated/phylogeny.json` is the dated tree (leaf = species id).
- Next: lifespan as a continuous trait on all branches (Coevol or the like), one gene first for the time;
  then step 5 (convergence), then RM16 steps 2 and 4.

### 2026-11-16, after two days without quota

- The seat's account ran out of its weekly window on the morning of 2026-11-14 and came back on the 16th.
  In between, other sessions of the maintainer carried the work much further, in both repositories: the
  manuscript (rounds to v0.3), hypotheses H7 to H16 in `dna-seq/mitoage-pipelines` (Coevol, structure
  alignments, contact maps for all complexes, the peptides on the whole build, the cybrids), PGLS for the
  site's own table, the EURING birds, an MCP server. Read `docs/HYPOTHESES.md` there and this
  repository's changelog before picking anything up: most of what these notes call "next" is done.
- Left to this seat: the complexes section of the site (RM17), the convergence step (RM12), the blind
  scan for peptides (RM16), seats in `mitoage-pipelines` (the maintainer asked; the seat's design was put
  to him on 2026-11-14 and not answered).

### 2026-11-16, afternoon

- Live: the complexes section (RM17, D21), not in the top menu (desk #42). Done: RM18 (25 long-read records
  of 2,344, so H8's control cannot run), RM21, and of RM15 the plot's sentence and the chips over the stars.
- Left unattended: RM12 step 5, RM16 blind scan, RM11 per-residue embeddings, the rest of RM15 (the outlined
  button on taxon pages, the old addresses, the whale families under two orders).
- Desk: #41 (a seat for mitoage-pipelines; default none), #42; #36 withdrawn as moot.
- Lessons: a site build queued in Slurm builds the worktree as it is when the job starts, not when it was
  submitted, so check the built files for the last edit before trusting it; other sessions push to main
  several times an hour, so fetch immediately before the merge, in the same command as the push; look at a
  screenshot of every page a change touches, since a link added to a hero paragraph was invisible until seen.

### For the maintainer, by hand

- Where the pipeline's inputs come from (RM7); the go on the alignments' design (RM10).
- The seat's picture: asked in the chat's avatars topic, since this machine cannot draw one.
- The laptop's join line, from the secretary, to seat the lead there.

## 2026-11-16, evening

- RM15 closed (1f233ae). RM24 is new: families under two orders, cause found (kept species follow AnAge, new
  ones the NCBI lineage, `pipeline/steps/build2.ts`), waiting on desk #43; a fix is a rerun of `bun run data`.
- Lesson: a `pkill -f` pattern also matches the shell that runs it when the same words stand earlier in that
  command line (the preview's own start line). Start the preview and stop it in separate commands.
- Open on the desk: #41, #42, #43, #32 to #35. Waiting: RM12 step 5 (look 2026-11-17), RM11 and RM16 (2026-11-18).

## 2026-11-17, night

- RM12 step 5 is H26 in `dna-seq/mitoage-pipelines` (entry 32adcfb before its code, code f9a914a). Its run
  folder is a fresh clone of main on the data disk, under the runs folder's `h26/clone`, with the pinned build
  and tree linked in. First job submitted (trait, pairs, selection inputs); the 46 RELAX and aBSREL tasks are
  held while the account is at its CPU cap, and the maintainer was asked whether to queue them anyway.
- I saw three readings of H26's pair test before the registered run (a status check that printed too much);
  the entry says so. Check a readout's printed columns before running it on real data.
- That repository's leak gate refuses the cluster's host name, the Slurm account and absolute paths: job files
  take the account on the command line and HyPhy from `$HYPHY` or PATH.
- RM8: the rule by sequence is done (`bun run duplicates`, 12 pairs); the rule by names waits on the raw inputs.
- RM2: the payload is 0.8 MB as downloaded; desk #44 asks what the target measures.
- Desk, open: #32 to #35, #41, #42, #43, #44.

## 2026-11-17, evening: the maintainer's handoff of the cluster analyses

The maintainer sent `docs/CLUSTER_HANDOFF.md` (86c0726) by direct message: "since now you take your control back on
mitoage related anslysis on the server". Its rules hold for this seat; the ones that were new to me:

- Every mitoage job goes to `compute` with `--nice=10000`, arrays throttled, so the Kron jobs stay first under the
  account's CPU limit.
- Run from a fresh clone under the runs folder, never pull into a clone a job runs from.
- `sacct` can hang: wrap it in `timeout`.
- Results come back to `main` as their own commit naming the job ids and the commit they ran from.

To do, in its order: H18's readout when its check job (6500885) ends, from the `h17-cybrid` clone (pull only
after it ends); the Coevol chains once a day, tracecomp after each leg, nothing read below an effective sample
size of 100, a fifth leg if the fourth ends short of 15,000 points; H26's selection array is queued (6500930,
four tasks at a time); then H19, then H21 to H25, throttled. Reports: `#mitoalignments` for RM12,
`#mitoage>mitoport` for RM11, `#mitoage` otherwise.

2026-11-18, from the desk's rigger (`#agent-chat>shares`, desk #52, while the maintainer decides): the seat's
default share of the account's 320 cores is 16, soft; nothing is stopped. The next batch gets an array throttle
that keeps it near the share (`%4` of 4-CPU tasks), and checkpointing batch work may go to partition `requeue`,
account `cluster`, outside the 320. H18's readout is to be redone from pulled `main` (the corrections of
4c3f9fc), not read from the check job; H26's readout and coupling and H21 to H25 run from a clone at 4c3f9fc or
later.

2026-11-19, the maintainer, relayed by the desk's secretary to every lead: "manuscript skills is super token
consuming, please fininsh this run but do not initialize run withou asking me or getting explicit instruciton on
it". No run of the manuscript-skills plugin (any of its skills, panels, improve, dashboard or other-model runs) is
started by this seat unless the maintainer asked for that run in his own words, or was asked and said yes; ask in
the seat's chat or on the desk, saying what the run is for.

### Upstream check, 2026-11-20

| Source | Pinned | Found |
|---|---|---|
| RefSeq release | 237 | **238 is out** (the release number file); its own item, RM26 |
| AnAge | build 15 | build 15, current |
| FishBase / SeaLifeBase | v26.06 | the mirror answers; whether a newer version is there was not checked |
| USGS BBL | v2025.1 | the page answers; its version was not read |
| EURING | list of 2023-09-01 (Internet Archive's copy) | not checked |

### State, 2026-11-20 afternoon

- H26 is read (pipelines 98a8c6d, findings 9fa9c5e, posted in `#mitoalignments`); its coevolution side waits for the
  mammal set of H21 to H25. Its readout clone is the second one in the H26 run folder, at d20393f.
- The lifespan-source rule is on the desk (#78), default AnAge first with the highest observed value as a second
  column of the downloads.
- Next, unattended: H27's leftovers (the species set reaching H2's column screen and H20's pair fits; the entry is
  extended before the code), then the screen of every record against independent sequences (RM25 item 1).
- Waiting on jobs: Coevol's second leg (tracecomp when it ends), H18's energy array and its check job.

### State, 2026-11-21 night

- H27's extension is read (pipelines 3ff40c3, findings 884aab9): H2 and H20 do not move on the restricted sets.
- H27 is complete: sample size as a covariate ran (pipelines 5b78bd3 and 0562dbf, findings 62f256c); the slopes of
  H1 and H11 stay. RM25 item 2 waits on desk #78 alone.
- The screen of every record against independent sequences ran and is committed (61e7074; job 6565328 from
  40e3a27), posted in `#mitoage>RM25 data quality`. Reading its rows is a person's; the 14 two-gene cases come
  first. The selector's choice is in the page address (da0a948). Of RM25 are left: the reading (items 1 and 6),
  desk #78 (item 2), the heavy runs' list (4), the manuscript counts (5) and the separate supplement (7).
- The headless browser for page checks needs `PLAYWRIGHT_BROWSERS_PATH` set to the playwright folder of the data
  disk's cache; the check scripts are in the runs folder's `shots`.
- H18 is read (pipelines c869d8e and ff05158, findings bf5868b, posted in `#mitoage>mitoport`): the interface
  energy adds nothing to divergence, and a control showed the energy does not repeat between two builds of a task.
  Its run clone (the `h17-cybrid` folder) is at d2c3646. A better protocol (several builds, or one shared build)
  is new work nobody decided.
- RM11, RM12 and RM16 wait until 2026-11-24: the cluster is still at its CPU cap. Coevol on 2026-11-21 16:00: the
  second leg ended at 6,814 to 7,903 points and the third started. tracecomp on copies of the traces (the runs
  folder's `coevol-tracecomp`, by date): nothing is read. Ages estimated: tree length (60) and dN/dS (78) are under
  100. Ages fixed: the covariances with lifespan and mass are under 100 and differ by 0.34 to 0.6 between chains.
  Posted in `#mitoage>Coevol`. Next tracecomp when the third leg ends, about 2026-11-24 16:00.
- H21 to H25's first job passed (27 tests, 25 of 25 breaks, the rerun gives the same bytes).
- H21 to H25's coevolution side: the coupling job 6587085 failed, because the entry's species rule keeps no species
  (H19's nuclear alignments cover 182 of 617 mammals and 137 of 883 fishes; no protein reaches 90% of the class).
  Fixed in pipelines 59f739a (an empty set is said as "not assessed", one test, one break) and run again as job
  6587349 from a second clone, `clone-coupling` beside the first, whose data folders are links to the first clone's:
  tests pass, 26 of 26 breaks caught, C1, C2 and P "not assessed" in both classes; the tables are in the first
  clone's `data/output/adaptations/coupling`. Whether to amend the rule is desk #81 (default: keep it; under the
  other reading marine mammals have 14 species and migrating fishes 8). The readout names 6587349 and 59f739a for
  the coupling tables. Never commit from `clone-coupling`: its data folders are replaced by links.
- Anton asked in `#mitoage>mitoport` where the mitoport hypothesis holds and where it agrees with experiments;
  answered there on 2026-11-21.
- H28: Anton agreed on 2026-11-22 in `#mitoage>mitoport` and asked for a check of the 2026 literature first (his
  answer is relayed on desk #82). The check changed the model to StaB-ddG (ProteinMPNN fine-tuned for binding energy
  changes; plain ProteinMPNN stays as a control arm); entry rewritten before the code (pipelines bcd8bb4), code
  de8a216 (`mitoport cybrid-stab`, `cybrid-stab-collect`, `cybrid-stab-readout`, `download stabddg`). No card was
  free, so it runs on CPU nodes from the runs folder's `h28-stab/clone` (with H17's inputs copied in). Anton then
  asked for a verdict per ported protein, not contacts: per-protein sets and the stability term were added
  (c0a229c; the entry says it as a change), the first two tasks cancelled (their output is in `h28-stab/first-try`)
  and the whole array restarted as 6591070 from c0a229c, two at a time (raise the throttle to four when the
  selection array of H21 to H25 has ended: `scontrol update JobId=6591070 ArrayTaskThrottle=4`). Measured before
  the change: 7.5 minutes a set for complex I, 1.4 for complex IV; a complex I task now has 57 sets, about 7 hours.
  H29 (disease variants against common ones, the check of what a per-protein number is worth) has its entry and
  code (pipelines f11db49: `download variants`, `mitoport variant-stab`, 19 tasks, about 4 hours each for complex I
  by my estimate); Anton was told it runs after H28 unless he says no. To run it: a fresh clone with H28's inputs
  and the build, `download variants`, `slurm/h29-variants.sbatch`, a second run, the check job. MITOMAP serves a
  browser only, so the harmful variants are ClinVar's expert-panel ones (41 rows; none in CYTB, COX1, COX3, ND2).
  Still to do for H28: the whole array a second time into another folder (`H28_OUT`), then
  `slurm/h28-stab-check.sbatch` with `H28_SECOND` naming that folder (collect, readout, byte comparison, tests, 21
  breaks; one break is caught only on the clone with data), then results into the entry against the rule, the
  tables into `results/`, findings and a post in `#mitoage>mitoport`.
- The drafts of the reports on audited records (RM25 item 8) are in `docs/analyses/record-reports/` (2a55267); the
  GenBank record and submitter behind each RefSeq record are not looked up.
- H19 had already run (its entry has the result of job 6493878); the handoff's table was older.
- H21 to H25 are submitted from a fresh clone at ff05158 in the runs folder's `h21-25`: the first job 6587083
  (tests, breaks, traits, pairs, fits, selection inputs), then the selection array 6587084 (four tasks at a time)
  and the coupling job 6587085 on H19's alignments, both after it. The mammal-wide hibernation tasks (array tasks
  63 to 83, 111 and 112) are left out: their table is on Dryad, which serves a browser only, asked on desk #80
  (default: the fish analyses run alone and H23 to H25's mammal-wide readouts stay "not run"). When the table is
  placed in the clone's `data/input/hibernation`: `mitoage download hibernation` checks it, then the first job's
  steps again and the left-out tasks. `adapt readout` comes last, when selection and coupling are done.
  The array stood at 55 of 107 tasks done, none failed, at 10:40 on 2026-11-22 (about five tasks an hour).
