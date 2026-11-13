# Decisions

The calls settled with the maintainer, one section each, `## Dn — the call (date)`, newest last: what
was decided, why, and the alternative it rejected. A call is never edited after the fact; a later one
that changes it says which it amends.

## D1 — The seats kit, with one seat, the lead (2026-11-13)

The repository adopts the seats kit (agent-seat-blueprints): standing roles for agent sessions, each
with a written priming under `docs/seats/`. The maintainer's answers at adoption:

- **Seats:** the lead only ("So far let's have lead"). Offered and not taken now: a correspondence
  seat (the upstream databases' releases and users' reports) and a strategist; either is added later.
- **Machines:** the lead runs on a cluster and, ideally, on the maintainer's laptop too ("I want to be
  able to run both on cluster and laptop"); each machine has its own clone and its own chat account
  for the seat. Rejected: one machine only.
- **Tracked, not an overlay:** the seat table and the primings are committed; the maintainer is the
  only author, so nobody else's sessions change. The kit's plugin is not pinned in the tracked
  `.claude/settings.json`: a clone enables it locally. Either can change later.
- **The lead's grant:** commit, and push `main` as a fast-forward, which deploys the site
  (`docs/seats/LEAD.md`, "Grant"). Rejected: commit only.
- **The id** is `mitoage`: the chat channel, the seat's account `mitoage/lead` and the desk's label.

The last three were the wizard's defaults, left unchanged by the maintainer.

## D2 — The maintainer's global permission to push holds for a session without a seat (2026-11-13)

A session that holds no seat finished a change (the species list's FASTA download) and met two
rules. The maintainer's global instructions say to "commit the changes and push them when the task is
done, without asking first", to "push to `main` directly and avoid pull requests", because "I mostly
work alone on my repositories". `CLAUDE.md` §2 left a push to the maintainer unless a seat's priming
granted it. Asked which holds, with the cost named (the push deploys the site), the maintainer
answered: "Push to main".

- **Decided:** where the maintainer's global instructions give that standing permission, a session
  without a seat pushes `main` to `origin` as a fast-forward once its task is done and checked
  (`CLAUDE.md` §2 and §8). The lead's grant (D1) is unchanged.
- **Rejected:** the work stays on its branch until the maintainer pushes it themself.
- **Its limit:** the question was put on one commit. That the answer stands for later sessions is the
  asking session's reading, said to the maintainer before the answer ("I'll record it in `CLAUDE.md`
  so the next session does not ask again"). Tags, releases, branch deletion and history rewriting stay
  the maintainer's.
