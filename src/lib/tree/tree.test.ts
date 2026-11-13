import { describe, expect, test } from "bun:test";
import { getTaxa } from "~/data";
import type { TaxonNode } from "~/data/schema";
import { buildTreePayload, checkDating, datingReport, nodeAges } from "./build";
import {
  cladeAt,
  clipRay,
  constrain,
  fitClade,
  fitLeaf,
  geometryFor,
  home,
  leafAt,
  maxZoom,
  minZoom,
  niceTicks,
  nodeSpan,
  normAngle,
  polar,
  projFor,
  radius,
  radiusInv,
  readableTurn,
  snapZoom,
  toPolar,
  viewClade,
  visibleArc,
  zones,
  zoomAbout,
  zoomForSpacing,
} from "./camera";
import { boxesOverlap, placeStemLabels, radialRotation } from "./labels";
import { ageTicks, computeLayout, interpolate, isAncestorOf } from "./layout";
import { abbrevName, rankCount } from "./names";
import { mixOklab, parseRgb, rampColors, ringScale, type Rgb } from "./ring";
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

  test("names", () => {
    expect(abbrevName("Homo sapiens")).toBe("H. sapiens");
    expect(rankCount(1, "genus")).toBe("1 genus");
    expect(rankCount(3, "family")).toBe("3 families");
  });
});

describe("zoomable camera", () => {
  const vp = { w: 860, h: 760 };
  const G = geometryFor(vp, 1);
  const L = computeLayout(model, model.root, { mode: "rank", displayDepth: SPECIES_DEPTH, bandDepth: 2, gap: 0.2 });
  const kMin = minZoom(G, L.unit);
  const kMax = maxZoom(G, L.unit);
  const ctx = { model, L, G, vp, kMin, kMax };
  const P = projFor(G, L, kMin);
  const get = (key: string) => {
    const n = model.byKey.get(key);
    if (!n) throw new Error(`no ${key}`);
    return n;
  };
  const inView = ([x, y]: [number, number], m = 0) => x >= -m && x <= vp.w + m && y >= -m && y <= vp.h + m;
  const ringMid = (k: number) => {
    const z = zones(G, L.unit, k);
    return (z.ringIn + z.ringOut) / 2;
  };

  test("the whole tree fits at zoom 1 and labels only show when zoomed in", () => {
    expect(kMin).toBe(1);
    expect(zones(G, L.unit, 1).labOut).toBeLessThanOrEqual(Math.min(vp.w, vp.h) / 2);
    expect(zones(G, L.unit, 1).leafA).toBe(0);
    expect(zones(G, L.unit, kMax).twoA).toBe(1);
    expect(fitClade(ctx, model.root)).toEqual(home(vp, 1));
  });

  test("a small clade at the root of the island zooms out to make room for its names", () => {
    const hom = get("family:hominidae");
    const Lh = computeLayout(model, hom, { mode: "rank", displayDepth: SPECIES_DEPTH, bandDepth: 0, gap: 0.2 });
    const k = minZoom(G, Lh.unit);
    expect(k).toBeLessThan(1);
    expect(zones(G, Lh.unit, k).labOut).toBeLessThanOrEqual(Math.min(vp.w, vp.h) / 2);
  });

  test("the rank layout keeps ranks at most one step apart, the time layout is linear", () => {
    expect(radius(P, 1, 1)).toBeCloseTo(G.R);
    expect(radius(P, 1, 0)).toBeCloseTo(0);
    const k = 20;
    expect(radius(P, k, 1) - radius(P, k, 5 / 6)).toBeLessThanOrEqual(G.step + 1e-6);
    expect(radiusInv(P, k, radius(P, k, 0.7))).toBeCloseTo(0.7);
    const Pt = projFor(G, { ...L, mode: "time" }, kMin);
    expect(radius(Pt, k, 0.5)).toBeCloseTo(0.5 * G.R * k);
  });

  test("a clade flies in turned to 3 or 9 o'clock, with all of its species on screen", () => {
    const prim = get("order:primates");
    const cam = fitClade(ctx, prim);
    expect(cam.k).toBeGreaterThan(2);
    const [a0, a1] = nodeSpan(model, L, prim);
    const mid = normAngle((a0 + a1) / 2 + cam.th);
    expect(Math.min(Math.abs(mid - Math.PI / 2), Math.abs(mid - (3 * Math.PI) / 2))).toBeLessThan(1e-6);
    for (const leaf of prim.leaves()) expect(inView(polar(cam, L.la[leaf.data.leafIndex] ?? 0, ringMid(cam.k)), 1)).toBe(true);
  });

  test("a small clade gets readable species names", () => {
    const hom = get("family:hominidae");
    const cam = fitClade(ctx, hom);
    const z = zones(G, L.unit, cam.k);
    expect(z.spacing).toBeGreaterThanOrEqual(1.3 * G.fs);
    expect(z.leafA).toBe(1);
    for (const leaf of hom.leaves()) expect(inView(polar(cam, L.la[leaf.data.leafIndex] ?? 0, z.labIn))).toBe(true);
    // The family's own node is on screen too.
    expect(inView(polar(cam, L.a[hom.data.i] ?? 0, radius(P, cam.k, L.r[hom.data.i] ?? 0)))).toBe(true);
  });

  test("a species is centred with its two-line name", () => {
    const human = get("species:homo-sapiens");
    const cam = fitLeaf(ctx, human);
    expect(zones(G, L.unit, cam.k).twoA).toBe(1);
    const [x, y] = polar(cam, L.la[human.data.leafIndex] ?? 0, ringMid(cam.k));
    expect(Math.abs(y - vp.h / 2)).toBeLessThan(vp.h * 0.2);
    expect(x).toBeGreaterThan(0);
    expect(x).toBeLessThan(vp.w);
  });

  test("the view never rests on half-faded species names", () => {
    const kIn = zoomForSpacing(G, L.unit, 1.08 * G.fs);
    const v = zones(G, L.unit, kIn).leafA;
    expect(v).toBeGreaterThan(0.05);
    expect(v).toBeLessThan(0.95);
    for (const how of ["near", "down"] as const) {
      const z = zones(G, L.unit, snapZoom(G, L.unit, kIn, how));
      expect(z.leafA <= 0.02 || z.leafA >= 0.98).toBe(true);
      expect(z.twoA <= 0.02 || z.twoA >= 0.98).toBe(true);
    }
    expect(zones(G, L.unit, snapZoom(G, L.unit, kIn, "down")).leafA).toBeLessThanOrEqual(0.02);
    // Small clades on a phone: the whole-circle view shows names fully or not at all.
    const phone = geometryFor({ w: 343, h: 343 }, 1);
    for (const key of ["order:carnivora", "order:primates", "family:felidae"]) {
      const n = get(key);
      const Ln = computeLayout(model, n, { mode: "rank", displayDepth: SPECIES_DEPTH, bandDepth: n.depth + 1, gap: 0.2 });
      const z = zones(phone, Ln.unit, minZoom(phone, Ln.unit));
      expect(z.leafA <= 0.02 || z.leafA >= 0.98).toBe(true);
      expect(z.labOut).toBeLessThanOrEqual(343 / 2);
    }
  });

  test("hit tests find the clade wedge and the species slot under a point", () => {
    const prim = get("order:primates");
    const [a0, a1] = nodeSpan(model, L, prim);
    const fam = prim.children?.[0];
    if (!fam) throw new Error("no family");
    const rr = ((L.r[prim.data.i] ?? 0) + (L.r[fam.data.i] ?? 0)) / 2;
    expect(cladeAt(model, L, model.root, (a0 + a1) / 2, rr)).toBe(prim);
    const human = get("species:homo-sapiens");
    expect(leafAt(model, L, model.root, L.la[human.data.leafIndex] ?? 0)).toBe(human);
  });

  test("the clade in view follows the camera", () => {
    expect(viewClade(model, L, G, home(vp, 1), vp, kMin)).toBe(model.root);
    const hom = get("family:hominidae");
    const cam = fitClade(ctx, hom);
    const seen = viewClade(model, L, G, cam, vp, kMin);
    expect(isAncestorOf(seen, hom) || isAncestorOf(hom, seen)).toBe(true);
    expect(viewClade(model, L, G, cam, vp, kMin, hom)).toBe(hom);
  });

  test("zooming keeps the point under the pointer in place", () => {
    const cam = fitClade(ctx, get("order:carnivora"));
    for (const p of [
      [vp.w * 0.3, vp.h * 0.4],
      [vp.w * 0.8, vp.h * 0.6],
    ] as [number, number][]) {
      const before = toPolar(cam, p[0], p[1]);
      const next = zoomAbout(P, cam, cam.k * 1.7, p, p);
      const after = toPolar(next, p[0], p[1]);
      expect(normAngle(after.a - before.a + 1e-9)).toBeLessThan(1e-6);
      const T0 = G.R * cam.k;
      const T1 = G.R * next.k;
      if (before.s >= T0) expect(after.s - T1).toBeCloseTo(before.s - T0, 6);
      else expect(radiusInv(P, next.k, after.s)).toBeCloseTo(radiusInv(P, cam.k, before.s), 6);
    }
  });

  test("the view stays centred at the whole-tree zoom and on the drawing when zoomed", () => {
    expect(constrain(G, L.unit, vp, { k: 1, x: 10, y: 900, th: 0 })).toEqual({ k: 1, x: vp.w / 2, y: vp.h / 2, th: 0 });
    const c = constrain(G, L.unit, vp, { k: 8, x: -1e6, y: 1e6, th: 0 });
    const rad = zones(G, L.unit, 8).labOut;
    expect(c.x).toBeGreaterThan(vp.w - rad - vp.w);
    expect(c.y).toBeLessThan(rad + vp.h);
  });

  test("clade names sit on their stems, on screen, without overlapping", () => {
    const cam = fitClade(ctx, get("order:primates"));
    const labels = placeStemLabels({
      focus: model.root,
      pose: L,
      G,
      cam,
      vp,
      rad: (r) => radius(P, cam.k, r),
      measure: (t) => t.length * G.fs * 0.6,
    });
    expect(labels.length).toBeGreaterThan(3);
    expect(labels.some((l) => l.text === "Primates")).toBe(true);
    for (const l of labels) {
      expect(inView([l.cx, l.cy])).toBe(true);
      for (const o of labels) if (o !== l) expect(boxesOverlap(l, o)).toBe(false);
    }
    // Nothing fits at the whole-tree view of a small canvas.
    const small = geometryFor({ w: 340, h: 340 }, 1);
    const none = placeStemLabels({
      focus: model.root,
      pose: L,
      G: small,
      cam: home({ w: 340, h: 340 }),
      vp: { w: 340, h: 340 },
      rad: (r) => r * small.R,
      measure: (t) => t.length * small.fs * 0.6,
    });
    expect(none.length).toBeLessThanOrEqual(2);
  });

  test("labels read upright on both sides", () => {
    expect(radialRotation(Math.PI / 2)).toEqual({ rot: 0, flip: false });
    expect(radialRotation((3 * Math.PI) / 2).flip).toBe(true);
    expect(normAngle(radialRotation((3 * Math.PI) / 2).rot)).toBeCloseTo(0);
    expect(readableTurn(0.3, 0.2)).toBeCloseTo(Math.PI / 2 - 0.3);
    expect(readableTurn(5, 0.2)).toBeCloseTo((3 * Math.PI) / 2 - 5);
    expect(readableTurn(1, 4)).toBe(0);
  });

  test("ticks and clipping helpers", () => {
    expect(niceTicks(0, 10, 5)).toEqual([0, 2, 4, 6, 8, 10]);
    expect(niceTicks(3, 3, 5)).toEqual([]);
    const cam = home(vp);
    expect(clipRay(cam, vp, Math.PI / 2, 0, 10_000, 0)).toEqual([0, vp.w / 2]);
    const run = visibleArc(cam, vp, 100, 0, Math.PI, 0);
    expect(run?.[0]).toBeCloseTo(0);
    expect(run?.[1]).toBeCloseTo(Math.PI);
    expect(visibleArc({ ...cam, x: -5000 }, vp, 10, 0, Math.PI, 0)).toBeNull();
  });
});

describe("ring colours", () => {
  test("parse computed colours", () => {
    expect(parseRgb("rgb(1, 2, 3)")).toEqual([1, 2, 3]);
    expect(parseRgb("rgba(10 20 30 / 0.5)")).toEqual([10, 20, 30]);
    expect(parseRgb("#0e4a22")).toEqual([14, 74, 34]);
    expect(parseRgb("#fff")).toEqual([255, 255, 255]);
    expect(parseRgb("oklch(0.5 0.1 120)")).toBeNull();
  });

  test("the canvas ramp runs lo -> mid -> hi like the CSS one", () => {
    const lo: Rgb = [240, 245, 230];
    const mid: Rgb = [247, 168, 27];
    const hi: Rgb = [232, 80, 58];
    const ramp = rampColors(lo, mid, hi, 0.4, 11);
    expect(ramp).toHaveLength(11);
    expect(ramp[0]).toBe("rgb(240, 245, 230)");
    expect(ramp[10]).toBe("rgb(232, 80, 58)");
    expect(ramp[4]).toBe("rgb(247, 168, 27)");
    expect(mixOklab(mid, mid, 0.5)).toEqual(mid);
  });
});
