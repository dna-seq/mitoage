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
  node. No page can be viewed here (RM3).
- **Kept from before the kit:** `plans/handoffs/` (a record; no new file goes there) and
  `.claude/launch.json` (the preview launcher). Nothing retired, nothing moved under the watchdog.
- **Acting duties:** milestones (the channel's `state` and `milestones` topics, as the priming's
  "Reporting" already says). upstream-index does not apply as written: its watcher reads the Python
  package index and this repository has no Python; the upstream data sources are RM6.

### Upstream check, 2026-11-13

| Source | Pinned | Found |
|---|---|---|
| RefSeq release | 237 | 237, current |
| AnAge | build 15 | build 15, current |
| FishBase / SeaLifeBase | v26.06 | not checked |
| USGS BBL | v2025.1 | not checked |
| EURING | not retrieved | the site answers again (a redirect); the list itself not fetched (RM5) |

### For the maintainer, by hand

- Where pages are looked at (RM3), and where the pipeline's inputs come from (RM7).
- The laptop's join line, from the secretary, to seat the lead there.
