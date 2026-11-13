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

### For the maintainer, by hand

- Where the pipeline's inputs come from (RM7); the go on the alignments' design (RM10).
- The seat's picture: asked in the chat's avatars topic, since this machine cannot draw one.
- The laptop's join line, from the secretary, to seat the lead there.
