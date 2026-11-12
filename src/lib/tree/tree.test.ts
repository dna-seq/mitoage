import { describe, expect, test } from "bun:test";
import { getTaxa } from "~/data";
import type { TaxonNode } from "~/data/schema";
import { buildTreePayload, checkDating, datingReport, nodeAges } from "./build";
import { ageTicks, computeLayout, interpolate, readableDepth } from "./layout";
import { abbrevName, rankCount } from "./names";
import { rampFill, ringScale } from "./ring";
import { decodeTree, parseKey, SPECIES_DEPTH } from "./types";

const model = decodeTree(buildTreePayload());

const node = (name: string, rank: TaxonNode["rank"], bl: number | null, children: TaxonNode[] = []): TaxonNode => ({
  name,
  rank,
  slug: name.toLowerCase(),
  speciesCount: children.length ? children.reduce((n, c) => n + c.speciesCount, 0) : 1,
  children,
  branchLengthMya: bl,
});

describe("dated tree", () => {
  test("the build tree is ultrametric apart from missing branches", () => {
    const r = datingReport();
    expect(r.dated).toBe(true);
    expect(r.rootAge).toBeGreaterThan(600);
    expect(r.maxDeviation).toBeLessThan(0.01);
    expect(r.incompleteTips).toBeLessThanOrEqual(5);
  });

  test("a tree whose tips end at different times is not dated", () => {
    const t = node("Root", "kingdom", null, [node("A", "species", 10), node("B", "species", 40)]);
    expect(checkDating(t).dated).toBe(false);
  });

  test("ages decrease from parent to child and species are at the present", () => {
    const r = datingReport();
    const root = node("Root", "kingdom", null, [
      node("P", "phylum", 50, [node("S1", "species", 50), node("S2", "species", null)]),
    ]);
    const ages = nodeAges(root, 100);
    const p = root.children[0] as TaxonNode;
    expect(ages.get(root)).toBe(100);
    expect(ages.get(p)).toBe(50);
    expect(ages.get(p.children[1] as TaxonNode)).toBe(0);
    for (const n of model.nodes) {
      const a = n.data.age ?? 0;
      if (!n.children) expect(a).toBe(0);
      if (n.parent) expect(a).toBeLessThanOrEqual(n.parent.data.age ?? Number.POSITIVE_INFINITY);
    }
    expect(model.rootAge).toBeCloseTo(r.rootAge, 1);
  });
});

describe("payload", () => {
  test("round-trips every taxon and species in pre-order", () => {
    expect(model.leaves.length).toBe(model.root.value ?? 0);
    model.leaves.forEach((l, k) => {
      expect(l.data.leafIndex).toBe(k);
      expect(l.data.sp).not.toBeNull();
      expect(l.depth).toBe(SPECIES_DEPTH);
    });
    for (const t of getTaxa()) expect(model.byKey.get(`${t.rank}:${t.slug}`)?.value).toBe(t.speciesCount);
  });

  test("stays small enough for phones", () => {
    expect(JSON.stringify(buildTreePayload()).length).toBeLessThan(400_000);
  });

  test("parses focus keys", () => {
    expect(parseKey("class:mammalia")).toEqual(["class", "mammalia"]);
    expect(parseKey("Order:Primates")).toEqual(["order", "primates"]);
    expect(parseKey("tribe:x")).toBeNull();
    expect(parseKey("nonsense")).toBeNull();
  });
});

describe("layout", () => {
  const opts = { mode: "rank" as const, displayDepth: SPECIES_DEPTH, bandDepth: 2, gap: 0.2 };

  test("leaves of the focus go round the circle in order, inside the opening", () => {
    const L = computeLayout(model, model.root, opts);
    let prev = -Infinity;
    for (let k = 0; k < model.leaves.length; k++) {
      const a = L.la[k] ?? 0;
      expect(a).toBeGreaterThan(prev);
      expect(a).toBeGreaterThanOrEqual(L.start);
      expect(a).toBeLessThanOrEqual(L.end);
      prev = a;
    }
    expect(L.visible.length).toBe(model.nodes.length);
    expect(L.r[0]).toBe(0);
    expect(L.bands.length).toBe(getTaxa().filter((t) => t.rank === "class").length);
  });

  test("a focused clade fills the circle and hides everything else", () => {
    const mam = model.byKey.get("class:mammalia");
    if (!mam) throw new Error("no Mammalia");
    const L = computeLayout(model, mam, { ...opts, bandDepth: 3, mode: "time" });
    expect(L.mode).toBe("time");
    expect(L.visible.length).toBe(mam.descendants().length);
    for (const n of L.visible) {
      const r = L.r[n.data.i] ?? -1;
      expect(r).toBeGreaterThanOrEqual(0);
      expect(r).toBeLessThanOrEqual(1);
    }
    const birds = model.byKey.get("class:aves");
    expect(birds && L.vis[birds.data.i]).toBe(0);
  });

  test("small screens collapse to a readable rank", () => {
    expect(readableDepth(model.root, 37)).toBe(2);
    const L = computeLayout(model, model.root, { ...opts, displayDepth: 2, bandDepth: 2 });
    expect(L.terminals.every((t) => t.depth === 2)).toBe(true);
  });

  test("interpolation starts at the old pose and ends at the new layout", () => {
    const from = computeLayout(model, model.root, opts);
    const mam = model.byKey.get("class:mammalia");
    if (!mam) throw new Error("no Mammalia");
    const to = computeLayout(model, mam, { ...opts, bandDepth: 3 });
    const f0 = interpolate(model, from, to, 0);
    const f1 = interpolate(model, from, to, 1);
    expect(f0.a[mam.data.i]).toBeCloseTo(from.a[mam.data.i] ?? 0);
    expect(f1.a).toBe(to.a);
  });

  test("time rings use round numbers", () => {
    expect(ageTicks(692)).toEqual([100, 200, 300, 400, 500, 600]);
    expect(ageTicks(181)).toEqual([50, 100, 150]);
    expect(ageTicks(0)).toEqual([]);
  });
});

describe("ring and names", () => {
  test("lifespan uses a log scale", () => {
    const s = ringScale("life", [0.2, 1, 10, 100, 500]);
    expect(s.norm(0.2)).toBe(0);
    expect(s.norm(500)).toBe(1);
    expect(s.norm(10)).toBeGreaterThan(s.norm(1));
    expect(s.ticks.map((t) => t.label)).toEqual(["1 yr", "10 yr", "100 yr"]);
  });

  test("colour ramp is a theme-aware colour-mix", () => {
    expect(rampFill(0)).toContain("var(--ring-lo)");
    expect(rampFill(1)).toContain("var(--ring-hi) 100%");
  });

  test("names", () => {
    expect(abbrevName("Homo sapiens")).toBe("H. sapiens");
    expect(rankCount(1, "genus")).toBe("1 genus");
    expect(rankCount(3, "family")).toBe("3 families");
  });
});
