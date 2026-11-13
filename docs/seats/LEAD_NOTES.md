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
| EURING | not retrieved | the site answers again (a redirect); the list itself not fetched (RM5) |

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

### For the maintainer, by hand

- Where the pipeline's inputs come from (RM7); the go on the alignments' design (RM10).
- The seat's picture: asked in the chat's avatars topic, since this machine cannot draw one.
- The laptop's join line, from the secretary, to seat the lead there.
