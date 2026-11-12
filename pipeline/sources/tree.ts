/**
 * Dated phylogeny for the species set:
 *  - topology: Open Tree of Life synthetic tree (TNRS name matching + induced subtree), undated;
 *  - node ages: TimeTree 5 API (MRCA age of representative descendants, by NCBI taxon id);
 *  - nodes without a TimeTree age are placed midway between their parent and oldest child
 *    (BLADJ-style interpolation); ages are made monotone (parent >= child).
 * Everything is cached under data/cache/tree so reruns are offline.
 */
import { createHash } from "node:crypto";
import { existsSync } from "node:fs";
import { cachePath, fetchWithRetry, rateLimiter } from "../lib/cache";
import type { PhyloNode } from "../lib/stats";

const OTL = "https://api.opentreeoflife.org/v3";
const TIMETREE = "https://api.timetree.org";

export interface TreeInput {
  id: number;
  names: string[]; // preferred first (MitoAge name, then AnAge 15 name if different)
  taxid: number | null;
}

export interface DatedTree {
  root: PhyloNode;
  /** Age (Mya) of the MRCA of the given species ids present in the tree; null if none present. */
  ageOf: (ids: number[]) => number | null;
  inTree: Set<number>;
  stats: {
    matchedNames: number;
    leaves: number;
    internalNodes: number;
    datedByTimeTree: number;
    interpolated: number;
    madeMonotone: number;
    timetreeQueries: number;
    rootAge: number;
  };
  otlSynthVersion: string;
}

const hash = (s: string) => createHash("sha1").update(s).digest("hex").slice(0, 16);

async function cachedJson<T>(rel: string, fetcher: () => Promise<T>): Promise<T> {
  const p = cachePath(rel);
  if (existsSync(p)) return JSON.parse(await Bun.file(p).text()) as T;
  const v = await fetcher();
  await Bun.write(p, JSON.stringify(v));
  return v;
}

const otlLimit = rateLimiter(2);
const ttLimit = rateLimiter(3);

async function postJson(url: string, body: unknown): Promise<unknown> {
  await otlLimit();
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(300_000),
  });
  const text = await res.text();
  try {
    return JSON.parse(text);
  } catch {
    throw new Error(`OTL ${url}: HTTP ${res.status} ${text.slice(0, 200)}`);
  }
}

interface TnrsResult {
  results: { name: string; matches: { taxon: { ott_id: number; name: string; rank: string }; is_approximate_match: boolean }[] }[];
}

async function matchNames(names: string[]): Promise<Map<string, number>> {
  const out = new Map<string, number>();
  for (let i = 0; i < names.length; i += 250) {
    const batch = names.slice(i, i + 250);
    const res = await cachedJson<TnrsResult>(`tree/tnrs_${hash(batch.join("|"))}.json`, async () => {
      console.log(`    OTL TNRS batch ${i / 250 + 1}`);
      return (await postJson(`${OTL}/tnrs/match_names`, {
        names: batch,
        context_name: "Animals",
        do_approximate_matching: false,
      })) as TnrsResult;
    });
    for (const r of res.results) {
      const m = r.matches.find((x) => !x.is_approximate_match);
      if (m) out.set(r.name.toLowerCase(), m.taxon.ott_id);
    }
  }
  return out;
}

interface NewickNode {
  label: string;
  children: NewickNode[];
}

export function parseNewick(s: string): NewickNode {
  let i = 0;
  const parseLabel = (): string => {
    let label = "";
    if (s[i] === "'") {
      i++;
      while (i < s.length && s[i] !== "'") label += s[i++];
      i++;
    } else {
      while (i < s.length && !",():;".includes(s[i]!)) label += s[i++];
    }
    if (s[i] === ":") {
      i++;
      while (i < s.length && !",();".includes(s[i]!)) i++;
    }
    return label.trim();
  };
  const parseNode = (): NewickNode => {
    const children: NewickNode[] = [];
    if (s[i] === "(") {
      i++;
      children.push(parseNode());
      while (s[i] === ",") {
        i++;
        children.push(parseNode());
      }
      i++; // ')'
    }
    return { label: parseLabel(), children };
  };
  return parseNode();
}

interface TimeTreeMrca {
  found_ids?: number[];
  adjusted_age?: number | string | null;
  precomputed_age?: number | string | null;
}

async function timetreeMrca(taxids: number[]): Promise<number | null> {
  const ids = [...new Set(taxids)].sort((a, b) => a - b);
  if (ids.length < 2) return null;
  const res = await cachedJson<TimeTreeMrca | null>(`tree/timetree/mrca_${hash(ids.join("+"))}.json`, async () => {
    await ttLimit();
    try {
      const r = await fetchWithRetry(`${TIMETREE}/mrca/id/${ids.join("+")}/json`);
      const text = await r.text();
      try {
        return JSON.parse(text) as TimeTreeMrca;
      } catch {
        return null;
      }
    } catch {
      return null;
    }
  });
  if (!res || (res.found_ids?.length ?? 0) < 2) return null;
  const age = Number(res.adjusted_age ?? res.precomputed_age);
  return Number.isFinite(age) && age > 0 ? age : null;
}

export async function buildDatedTree(input: TreeInput[]): Promise<DatedTree> {
  // 1. Names -> OTT ids.
  const allNames = [...new Set(input.flatMap((s) => s.names))];
  const ott = await matchNames(allNames);
  const speciesOtt = new Map<number, number>();
  const ottSpecies = new Map<number, number>();
  for (const s of input) {
    for (const n of s.names) {
      const o = ott.get(n.toLowerCase());
      if (o !== undefined && !ottSpecies.has(o)) {
        speciesOtt.set(s.id, o);
        ottSpecies.set(o, s.id);
        break;
      }
    }
  }
  console.log(`    OTL: ${speciesOtt.size}/${input.length} species matched to OTT ids`);

  // 2. Induced subtree, dropping ids the synthetic tree does not know.
  let ids = [...speciesOtt.values()].sort((a, b) => a - b);
  type Induced = { newick: string; broken?: Record<string, string>; synth_id?: string };
  let induced: Induced | null = null;
  for (let attempt = 0; attempt < 5 && !induced; attempt++) {
    const key = `tree/induced_${hash(ids.join(","))}.json`;
    const res = await cachedJson<Induced | { unknown: Record<string, string> }>(key, async () => {
      console.log(`    OTL induced subtree for ${ids.length} taxa`);
      return (await postJson(`${OTL}/tree_of_life/induced_subtree`, { ott_ids: ids, label_format: "id" })) as Induced;
    });
    if ("newick" in res) induced = res;
    else if ("unknown" in res && res.unknown) {
      const bad = new Set(Object.keys(res.unknown).map((k) => Number(k.replace("ott", ""))));
      console.log(`    OTL: ${bad.size} ids not in the synthetic tree, retrying without them`);
      ids = ids.filter((x) => !bad.has(x));
    } else throw new Error("Unexpected OTL induced_subtree response");
  }
  if (!induced) throw new Error("OTL induced subtree failed");
  const about = await cachedJson<{ synth_id?: string }>("tree/otl_about.json", async () =>
    (await postJson(`${OTL}/tree_of_life/about`, {})) as { synth_id?: string },
  );

  // Map labels (including broken taxa mapped onto MRCA nodes) back to species.
  const labelSpecies = new Map<string, number>();
  for (const [o, sid] of ottSpecies) labelSpecies.set(`ott${o}`, sid);
  for (const [from, to] of Object.entries(induced.broken ?? {})) {
    const sid = labelSpecies.get(from);
    if (sid !== undefined && !labelSpecies.has(to)) labelSpecies.set(to, sid);
  }

  // 3. Convert, attach species, collapse unary nodes and drop empty branches.
  interface N {
    children: N[];
    leaf?: number;
    age: number | null;
    parent?: N;
  }
  const taxidOf = new Map(input.map((s) => [s.id, s.taxid]));
  const convert = (n: NewickNode): N | null => {
    const kids = n.children.map(convert).filter((x): x is N => x !== null);
    const sid = labelSpecies.get(n.label);
    if (sid !== undefined) {
      const leaf: N = { children: [], leaf: sid, age: 0 };
      if (kids.length === 0) return leaf;
      kids.push(leaf); // a species mapped onto an internal (broken-taxon) node
    }
    if (kids.length === 0) return null;
    if (kids.length === 1) return kids[0]!;
    return { children: kids, age: null };
  };
  const root = convert(parseNewick(induced.newick.replace(/;\s*$/, "")));
  if (!root) throw new Error("Empty induced tree");

  // 4. Date internal nodes with TimeTree.
  const leavesOf = (n: N): number[] => (n.leaf !== undefined ? [n.leaf] : n.children.flatMap(leavesOf));
  const internal: N[] = [];
  const collect = (n: N, parent?: N) => {
    if (parent) n.parent = parent;
    n.children.forEach((c) => collect(c, n));
    if (n.leaf === undefined) internal.push(n);
  };
  collect(root);
  let queries = 0;
  let dated = 0;
  let done = 0;
  for (const n of internal) {
    // Up to three representatives (with NCBI taxon ids) from each child clade.
    const reps: number[] = [];
    for (const c of n.children.slice(0, 12)) {
      const tx = leavesOf(c)
        .map((sid) => taxidOf.get(sid))
        .filter((t): t is number => typeof t === "number")
        .slice(0, 3);
      reps.push(...tx);
    }
    queries++;
    n.age = await timetreeMrca(reps);
    if (n.age !== null) dated++;
    if (++done % 100 === 0) console.log(`    TimeTree: ${done}/${internal.length} nodes`);
  }

  // 5. Monotone ages (post-order) and interpolation of undated nodes (pre-order).
  let madeMonotone = 0;
  const minAge = new Map<N, number>();
  const post = (n: N): number => {
    if (n.leaf !== undefined) return 0;
    let m = 0;
    for (const c of n.children) m = Math.max(m, post(c));
    minAge.set(n, m);
    if (n.age !== null && n.age < m) {
      n.age = m;
      madeMonotone++;
    }
    return n.age ?? m;
  };
  post(root);
  let interpolated = 0;
  if (root.age === null) {
    root.age = (minAge.get(root) ?? 0) * 1.1 + 1;
    interpolated++;
  }
  const pre = (n: N) => {
    for (const c of n.children) {
      if (c.leaf === undefined && c.age === null) {
        c.age = ((n.age ?? 0) + (minAge.get(c) ?? 0)) / 2;
        interpolated++;
      }
      pre(c);
    }
  };
  pre(root);

  // 6. To PhyloNode with branch lengths = parent age - node age.
  const toPhylo = (n: N, parentAge: number): PhyloNode => {
    const age = n.age ?? 0;
    const node: PhyloNode = { length: Math.max(0, parentAge - age), children: n.children.map((c) => toPhylo(c, age)) };
    if (n.leaf !== undefined) node.leaf = n.leaf;
    return node;
  };
  const phylo = toPhylo(root, root.age ?? 0);

  // MRCA ages for arbitrary species sets.
  const leafNode = new Map<number, N>();
  const depth = new Map<N, number>();
  const index = (n: N, d: number) => {
    depth.set(n, d);
    if (n.leaf !== undefined) leafNode.set(n.leaf, n);
    n.children.forEach((c) => index(c, d + 1));
  };
  index(root, 0);
  const lca = (a: N, b: N): N => {
    let x = a;
    let y = b;
    while (depth.get(x)! > depth.get(y)!) x = x.parent!;
    while (depth.get(y)! > depth.get(x)!) y = y.parent!;
    while (x !== y) {
      x = x.parent!;
      y = y.parent!;
    }
    return x;
  };
  const ageOf = (sids: number[]): number | null => {
    const nodes = sids.map((s) => leafNode.get(s)).filter((x): x is N => !!x);
    if (nodes.length === 0) return null;
    let m = nodes[0]!;
    for (let i = 1; i < nodes.length; i++) m = lca(m, nodes[i]!);
    return m.age ?? 0;
  };

  return {
    root: phylo,
    ageOf,
    inTree: new Set(leafNode.keys()),
    stats: {
      matchedNames: speciesOtt.size,
      leaves: leafNode.size,
      internalNodes: internal.length,
      datedByTimeTree: dated,
      interpolated,
      madeMonotone,
      timetreeQueries: queries,
      rootAge: root.age ?? 0,
    },
    otlSynthVersion: induced.synth_id ?? about.synth_id ?? "unknown",
  };
}
