/**
 * Radial taxonomy tree island.
 *
 * A radial dendrogram of the MitoAge species with branches coloured by class, an outer ring of
 * per-species values (maximum lifespan on a log scale, whole-genome GC%, mtDNA size), arcs and
 * labels for the classes (or the rank below the focused clade), a rank layout or a time-scaled
 * layout from the dated tree, and animated re-rooting on any clade. Hover or tap shows a node;
 * select a clade to focus it, a species to open its page. Keyboard: arrow keys walk the tree,
 * Enter selects, Escape goes up. On narrow screens the tree is collapsed to the deepest rank
 * whose clades can be labelled, and the reader drills down.
 *
 * Data: fetches /tree/tree.json on mount (shared with the other clade islands on the page).
 * Styles: import "~/components/tree/tree.css" in the page that renders it.
 *
 * <RadialTree client:visible label="Taxonomy tree of 922 species" syncUrl panel />
 * <RadialTree client:visible label="Taxonomy tree of Mammalia" rootKey="class:mammalia" />
 */
import { Delaunay } from "d3-delaunay";
import { easeCubicInOut } from "d3-ease";
import { batch, createEffect, createMemo, createSignal, createUniqueId, For, Index, on, onCleanup, onMount, Show, untrack } from "solid-js";
import { ICONS } from "~/components/ui/icons";
import { CLASS_GROUPS, classColor, classLabel, COLOURED_CLASSES } from "~/lib/classes";
import { fmtBp, fmtInt, fmtLifespan, fmtNum, fmtPct } from "~/lib/format";
import { loadTree, TREE_DATA_URL, treeUrl } from "~/lib/tree/data";
import {
  ageTicks,
  canTime,
  computeLayout,
  defaultBandDepth,
  frameToPose,
  interpolate,
  isAncestorOf,
  readableDepth,
  type Band,
  type Frame,
  type Layout,
  type LayoutMode,
  type Pose,
} from "~/lib/tree/layout";
import { abbrevName, childRank, isItalicRank, RANK_LABEL, rankCount, rankPlural } from "~/lib/tree/names";
import { metricInfo, RAMP_MID, rampFill, RING_METRICS, ringScale, type Metric } from "~/lib/tree/ring";
import { CLASS_DEPTH, nodeKey, parseKey, RANKS, SPECIES_DEPTH, type TNode, type TreeModel } from "~/lib/tree/types";
import { speciesUrl, taxonUrl } from "~/lib/urls";
import TreeSearch from "./TreeSearch";

export interface RadialTreeProps {
  /** Accessible name of the chart. */
  label: string;
  /** Clade shown first and the highest one reachable, "rank:slug"; default the whole tree. */
  rootKey?: string;
  /** Mirror the focus in ?focus=rank:slug and the browser history (the /tree/ page). */
  syncUrl?: boolean;
  /** Side panel with the focused clade's numbers and children (the /tree/ page). */
  panel?: boolean;
  /** Show the find-in-tree box (default true). */
  search?: boolean;
  metric?: Metric;
  /** Largest drawing size in px. */
  maxSize?: number;
  dataUrl?: string;
}

// ---------------------------------------------------------------- geometry helpers

const GAP = 0.2;
const DUR = 760;
const METRIC_DUR = 420;
const COMPACT_BELOW = 520;
const NEUTRAL = "var(--rt-neutral)";

const at = (arr: Float64Array, i: number): number => arr[i] ?? 0;
const f1 = (v: number): number => Math.round(v * 10) / 10;
const lerp = (x: number, y: number, t: number): number => x + (y - x) * t;
const pt = (c: number, a: number, r: number): string => `${f1(c + r * Math.sin(a))} ${f1(c - r * Math.cos(a))}`;
const xy = (c: number, a: number, r: number): [number, number] => [c + r * Math.sin(a), c - r * Math.cos(a)];

const linkPath = (c: number, ac: number, rc: number, ap: number, rp: number): string => {
  let d = `M${pt(c, ac, rc)}L${pt(c, ac, rp)}`;
  if (rp > 0.5 && Math.abs(ap - ac) > 1e-4) {
    d += `A${f1(rp)} ${f1(rp)} 0 ${Math.abs(ap - ac) > Math.PI ? 1 : 0} ${ap > ac ? 1 : 0} ${pt(c, ap, rp)}`;
  }
  return d;
};

const sector = (c: number, a0: number, a1: number, r0: number, r1: number): string => {
  const large = a1 - a0 > Math.PI ? 1 : 0;
  return `M${pt(c, a0, r0)}L${pt(c, a0, r1)}A${f1(r1)} ${f1(r1)} 0 ${large} 1 ${pt(c, a1, r1)}L${pt(c, a1, r0)}A${f1(r0)} ${f1(r0)} 0 ${large} 0 ${pt(c, a0, r0)}Z`;
};

const circleArc = (c: number, a0: number, a1: number, r: number): string =>
  `M${pt(c, a0, r)}A${f1(r)} ${f1(r)} 0 ${a1 - a0 > Math.PI ? 1 : 0} 1 ${pt(c, a1, r)}`;

const colorOf = (n: TNode): string => (n.depth >= CLASS_DEPTH && n.data.cls ? classColor(n.data.cls) : NEUTRAL);

interface Geo {
  S: number;
  c: number;
  R: number;
  ringIn: number;
  ringOut: number;
  arcIn: number;
  arcOut: number;
  labIn: number;
  labOut: number;
  fs: number;
}

/** Radii from the outside in: band labels, band arcs, leaf labels (optional), value ring, tree. */
const geometry = (S: number, labW: number, compact: boolean): Geo => {
  const c = S / 2;
  const fs = compact ? 11.5 : 12.5;
  const arcOut = c - 4 - (compact ? 17 : 19);
  const arcIn = arcOut - (compact ? 6 : 7);
  const labOut = arcIn - 5;
  const labIn = labOut - labW;
  const ringOut = labW > 0 ? labIn - 4 : arcIn - 5;
  const ringH = Math.max(18, Math.min(54, S * 0.07));
  const ringIn = ringOut - ringH;
  return { S, c, R: Math.max(12, ringIn - 6), ringIn, ringOut, arcIn, arcOut, labIn, labOut, fs };
};

const LABEL_CHAR = 6.1;

/** Width reserved for radial species labels, 0 when they do not fit. */
const leafLabelWidth = (L: Layout, S: number, compact: boolean): number => {
  if (compact || L.displayDepth < SPECIES_DEPTH) return 0;
  let maxChars = 0;
  for (const t of L.terminals) maxChars = Math.max(maxChars, abbrevName(t.data.name).length);
  const W = Math.min(130, maxChars * LABEL_CHAR + 8);
  const g = geometry(S, W, compact);
  return L.unit * g.labIn >= 12.5 && g.R >= S * 0.17 ? W : 0;
};

/** Label candidates for a band, longest first. */
const bandTexts = (n: TNode): string[] => {
  if (!n.children) return [abbrevName(n.data.name)];
  if (n.data.rank === "class") {
    const friendly = classLabel(n.data.name);
    return friendly !== n.data.name ? [friendly, n.data.name] : [n.data.name];
  }
  return [n.data.name];
};

type Zone = "tree" | "ring" | "band";
interface Hover {
  node: TNode;
  zone: Zone;
}

/**
 * Run `step(k)` with k from 0 to 1 over `ms` on animation frames. Frames stop in hidden tabs,
 * so a timer finishes the tween regardless. Returns a cancel function.
 */
const tween = (ms: number, step: (k: number) => void): (() => void) => {
  const t0 = performance.now();
  let raf = 0;
  let done = false;
  const finish = () => {
    if (done) return;
    done = true;
    cancelAnimationFrame(raf);
    clearTimeout(timer);
    step(1);
  };
  const frame = (now: number) => {
    if (done) return;
    const k = Math.min(1, (now - t0) / ms);
    if (k >= 1) finish();
    else {
      step(k);
      raf = requestAnimationFrame(frame);
    }
  };
  const timer = setTimeout(finish, ms + 250);
  raf = requestAnimationFrame(frame);
  return () => {
    done = true;
    cancelAnimationFrame(raf);
    clearTimeout(timer);
  };
};

const prefersReducedMotion = (): boolean =>
  typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches === true;

// ---------------------------------------------------------------- component

export default function RadialTree(props: RadialTreeProps) {
  const uid = createUniqueId();
  const [model, setModel] = createSignal<TreeModel | null>(null);
  const [failed, setFailed] = createSignal(false);
  const [S, setS] = createSignal(props.maxSize ?? 720);
  const [focus, setFocus] = createSignal<TNode | null>(null);
  const [mode, setMode] = createSignal<LayoutMode>("rank");
  const [metric, setMetric] = createSignal<Metric>(props.metric ?? "life");
  const [hover, setHover] = createSignal<Hover | null>(null);
  const [pinned, setPinned] = createSignal(false);
  const [selected, setSelected] = createSignal<TNode | null>(null);
  const [touchHint, setTouchHint] = createSignal(false);

  // Transition state
  const [target, setTarget] = createSignal<Layout | null>(null);
  const [fromPose, setFromPose] = createSignal<Pose | null>(null);
  const [fromLayout, setFromLayout] = createSignal<Layout | null>(null);
  const [labFrom, setLabFrom] = createSignal(0);
  const [t, setT] = createSignal(1);
  const [valsFrom, setValsFrom] = createSignal<Float64Array | null>(null);
  const [mt, setMt] = createSignal(1);

  let sizer: HTMLDivElement | undefined;
  let frameEl: HTMLDivElement | undefined;
  let svgEl: SVGSVGElement | undefined;
  let stopTween: () => void = () => {};
  let stopMetricTween: () => void = () => {};

  const compact = () => S() < COMPACT_BELOW;
  const limitIn = (m: TreeModel): TNode => {
    const k = parseKey(props.rootKey);
    return (k && m.byKey.get(`${k[0]}:${k[1]}`)) || m.root;
  };
  const rootLimit = createMemo<TNode | null>(() => {
    const m = model();
    return m ? limitIn(m) : null;
  });

  /** Clade for a ?focus= value, if it is inside the reachable part of the tree. */
  const resolveKey = (m: TreeModel, key: string | null): TNode | null => {
    const k = parseKey(key);
    if (!k) return null;
    const n = m.byKey.get(`${k[0]}:${k[1]}`);
    return n && n.children && isAncestorOf(limitIn(m), n) ? n : null;
  };
  const urlFocus = (): string | null => new URLSearchParams(window.location.search).get("focus");

  // ---------------------------------------------------------------- loading, size, URL

  onMount(() => {
    loadTree(props.dataUrl ?? TREE_DATA_URL)
      .then((m) => {
        const fromUrl = props.syncUrl ? resolveKey(m, urlFocus()) : null;
        batch(() => {
          setModel(m);
          setFocus(() => fromUrl ?? limitIn(m));
        });
        if (props.syncUrl) {
          const f = focus();
          if (f) window.history.replaceState({ ...(window.history.state ?? {}), rtree: nodeKey(f), rtreePrev: null }, "");
        }
      })
      .catch(() => setFailed(true));

    if (sizer && "ResizeObserver" in window) {
      const ro = new ResizeObserver((entries) => {
        const w = entries[0]?.contentRect.width ?? 0;
        if (w > 0) setS(Math.round(Math.min(props.maxSize ?? 860, Math.max(260, w))));
      });
      ro.observe(sizer);
      onCleanup(() => ro.disconnect());
    }

    if (props.syncUrl) {
      const onPop = () => {
        const m = model();
        if (!m) return;
        const n = resolveKey(m, urlFocus()) ?? limitIn(m);
        if (n && n !== focus()) {
          setPinned(false);
          setHover(null);
          setFocus(() => n);
        }
      };
      window.addEventListener("popstate", onPop);
      onCleanup(() => window.removeEventListener("popstate", onPop));
    }
    onCleanup(() => {
      stopTween();
      stopMetricTween();
    });
  });

  /**
   * Mirror the focus in the URL. Each history entry remembers the focus of the entry before it
   * (rtreePrev), so going up can step back through history instead of piling up entries.
   */
  const writeUrl = (n: TNode, prev: TNode | null, how: "push" | "replace") => {
    if (!props.syncUrl) return;
    const url = new URL(window.location.href);
    const q = new URLSearchParams(url.search);
    if (n === rootLimit()) q.delete("focus");
    else q.set("focus", nodeKey(n));
    const search = q.toString().replace(/%3A/gi, ":");
    const cur = window.history.state as { rtreePrev?: string | null } | null;
    const state = { rtree: nodeKey(n), rtreePrev: how === "push" ? (prev ? nodeKey(prev) : null) : (cur?.rtreePrev ?? null) };
    const href = `${url.pathname}${search ? `?${search}` : ""}${url.hash}`;
    if (how === "push") window.history.pushState(state, "", href);
    else window.history.replaceState(state, "", href);
  };

  const goTo = (n: TNode, how: "push" | "replace" = "push") => {
    const prev = focus();
    if (!n.children || n === prev) return;
    batch(() => {
      setPinned(false);
      setHover(null);
      setFocus(() => n);
    });
    writeUrl(n, prev, how);
  };

  const canGoUp = () => {
    const f = focus();
    return !!f && f !== rootLimit() && !!f.parent;
  };

  const goUp = () => {
    const f = focus();
    if (!f || !canGoUp() || !f.parent) return;
    const parent = f.parent;
    const st = window.history.state as { rtreePrev?: string | null } | null;
    if (props.syncUrl && st?.rtreePrev === nodeKey(parent)) {
      window.history.back();
      return;
    }
    // Not where we came from (e.g. after a search): replace, so Back still leaves the tree.
    goTo(parent, "replace");
  };

  // ---------------------------------------------------------------- layout and transitions

  const maxTerminals = () => {
    const g = geometry(S(), 0, true);
    return Math.max(6, Math.floor((g.arcOut * (Math.PI * 2 - GAP)) / 26));
  };

  const layoutFor = (m: TreeModel, f: TNode): Layout => {
    if (compact()) {
      const d = readableDepth(f, maxTerminals());
      return computeLayout(m, f, { mode: mode(), displayDepth: d, bandDepth: d, gap: GAP });
    }
    const band = f.depth >= SPECIES_DEPTH - 1 ? 0 : defaultBandDepth(f);
    return computeLayout(m, f, { mode: mode(), displayDepth: SPECIES_DEPTH, bandDepth: band, gap: GAP });
  };

  const labTo = createMemo(() => {
    const L = target();
    return L ? leafLabelWidth(L, S(), compact()) : 0;
  });

  const ease = () => easeCubicInOut(t());

  const frame = createMemo<Frame | null>(() => {
    const m = model();
    const to = target();
    if (!m || !to) return null;
    return interpolate(m, fromPose(), to, ease());
  });

  const geo = createMemo(() => geometry(S(), lerp(labFrom(), labTo(), ease()), compact()));
  const atRest = () => t() >= 1;

  const animate = () => {
    stopTween();
    if (prefersReducedMotion()) {
      setT(1);
      return;
    }
    stopTween = tween(DUR, setT);
  };

  createEffect(
    on([model, focus, mode, compact, maxTerminals], () => {
      const m = model();
      const f = focus();
      if (!m || !f) return;
      const next = layoutFor(m, f);
      const prev = untrack(target);
      const same =
        prev &&
        prev.focus === next.focus &&
        prev.mode === next.mode &&
        prev.displayDepth === next.displayDepth &&
        prev.bandDepth === next.bandDepth;
      const cur = untrack(frame);
      const curLab = untrack(() => lerp(labFrom(), labTo(), ease()));
      batch(() => {
        if (!prev || same) {
          setFromPose(null);
          setFromLayout(null);
          setTarget(next);
          setLabFrom(untrack(labTo));
          setT(1);
        } else {
          setFromPose(cur ? frameToPose(cur) : null);
          setFromLayout(prev);
          setLabFrom(curLab);
          setTarget(next);
          setT(0);
        }
      });
      if (prev && !same) animate();
    }),
  );

  // Ring values per leaf for the current metric (and the previous one, for the height transition).
  const ringData = createMemo(() => {
    const m = model();
    if (!m) return null;
    const key = metric();
    const raw = m.leaves.map((l) => (key === "life" ? l.data.sp?.life : key === "gc" ? l.data.sp?.gc : l.data.sp?.size) ?? Number.NaN);
    const scale = ringScale(key, raw);
    const vals = new Float64Array(raw.length);
    raw.forEach((v, k) => (vals[k] = Number.isFinite(v) ? scale.norm(v) : 0));
    return { scale, vals, fills: Array.from(vals, (v) => rampFill(v, RAMP_MID[key])) };
  });

  createEffect(
    on(
      ringData,
      (next, prev) => {
        if (!prev || !next || prefersReducedMotion()) return;
        setValsFrom(prev.vals);
        setMt(0);
        stopMetricTween();
        stopMetricTween = tween(METRIC_DUR, (k) => {
          setMt(k);
          if (k >= 1) setValsFrom(null);
        });
      },
      { defer: true },
    ),
  );

  // ---------------------------------------------------------------- drawing data

  const linkWidth = createMemo(() => {
    const n = target()?.leafCount ?? 922;
    return n > 500 ? 0.85 : n > 200 ? 1.1 : n > 60 ? 1.5 : 2;
  });

  const linkGroups = createMemo(() => {
    const f = frame();
    const m = model();
    if (!f || !m) return [] as { color: string; op: number; d: string }[];
    const g = geo();
    const drawn = new Uint8Array(m.nodes.length);
    for (const i of f.draw) drawn[i] = 1;
    const groups = new Map<string, { color: string; op: number; parts: string[] }>();
    for (const i of f.draw) {
      const n = m.nodes[i];
      const p = n?.parent;
      if (!n || !p || !drawn[p.data.i]) continue;
      const op = at(f.op, i);
      if (op < 0.02) continue;
      const q = Math.round(op * 10) / 10;
      const color = colorOf(n);
      const key = `${color}|${q}`;
      let grp = groups.get(key);
      if (!grp) groups.set(key, (grp = { color, op: q, parts: [] }));
      grp.parts.push(linkPath(g.c, at(f.a, i), at(f.r, i) * g.R, at(f.a, p.data.i), at(f.r, p.data.i) * g.R));
    }
    return [...groups.values()].map((x) => ({ color: x.color, op: x.op, d: x.parts.join("") }));
  });

  /** Collapsed clades (small screens) drawn as fans from the node to the tips. */
  const wedges = createMemo(() => {
    const f = frame();
    const m = model();
    const to = target();
    if (!f || !m || !to) return [] as { d: string; color: string; op: number }[];
    const g = geo();
    const e = ease();
    const fromL = fromLayout();
    const toSet = new Set(to.terminals.filter((n) => n.children));
    const fromSet = new Set(fromL && t() < 1 ? fromL.terminals.filter((n) => n.children) : []);
    const out: { d: string; color: string; op: number }[] = [];
    const add = (n: TNode, op: number) => {
      if (op < 0.02) return;
      const i = n.data.i;
      const l0 = m.leafRange[2 * i] ?? 0;
      const l1 = m.leafRange[2 * i + 1] ?? 0;
      const a0 = at(f.la, l0) - at(f.lw, l0) * 0.86;
      const a1 = at(f.la, l1) + at(f.lw, l1) * 0.86;
      if (a1 - a0 < 1e-4) return;
      const rn = at(f.r, i) * g.R;
      const d = `M${pt(g.c, at(f.a, i), rn)}L${pt(g.c, a0, g.R)}A${f1(g.R)} ${f1(g.R)} 0 ${a1 - a0 > Math.PI ? 1 : 0} 1 ${pt(g.c, a1, g.R)}Z`;
      out.push({ d, color: colorOf(n), op });
    };
    for (const n of toSet) add(n, fromSet.has(n) || t() >= 1 ? 1 : e);
    for (const n of fromSet) if (!toSet.has(n)) add(n, 1 - e);
    return out;
  });

  const ringH = () => geo().ringOut - geo().ringIn;

  const barPaths = createMemo(() => {
    const f = frame();
    const rd = ringData();
    const to = target();
    if (!f || !rd || !to) return [] as string[];
    const g = geo();
    const h = ringH();
    const vf = valsFrom();
    const k = easeCubicInOut(mt());
    const gapK = to.unit * g.ringIn > 3 ? 0.8 : 1;
    // In small clades a slot can be wide; keep bars slim (about 14 px at the ring).
    const maxW = 7 / Math.max(1, g.ringIn);
    const out = new Array<string>(rd.vals.length);
    for (let i = 0; i < rd.vals.length; i++) {
      const w = Math.min(at(f.lw, i) * gapK, maxW);
      if (w < 1e-5) {
        out[i] = "";
        continue;
      }
      const v = vf ? lerp(at(vf, i), at(rd.vals, i), k) : at(rd.vals, i);
      const a = at(f.la, i);
      out[i] = sector(g.c, a - w, a + w, g.ringIn, g.ringIn + h * (0.1 + 0.9 * v));
    }
    return out;
  });

  const bandArcs = createMemo(() => {
    const f = frame();
    const m = model();
    const to = target();
    if (!f || !m || !to) return [] as { d: string; color: string; op: number; alt: boolean }[];
    const g = geo();
    const e = ease();
    const fromL = t() < 1 ? fromLayout() : null;
    const out: { d: string; color: string; op: number; alt: boolean }[] = [];
    const add = (b: Band, idx: number, op: number) => {
      if (op < 0.02) return;
      const i = b.node.data.i;
      const l0 = m.leafRange[2 * i] ?? 0;
      const l1 = m.leafRange[2 * i + 1] ?? 0;
      const a0 = at(f.la, l0) - at(f.lw, l0);
      const a1 = at(f.la, l1) + at(f.lw, l1);
      if (a1 - a0 < 1e-4) return;
      out.push({ d: sector(g.c, a0, a1, g.arcIn, g.arcOut), color: colorOf(b.node), op, alt: idx % 2 === 1 });
    };
    const toNodes = new Set(to.bands.map((b) => b.node));
    const fromNodes = new Set(fromL ? fromL.bands.map((b) => b.node) : []);
    to.bands.forEach((b, idx) => add(b, idx, fromNodes.has(b.node) || !fromL ? 1 : e));
    fromL?.bands.forEach((b, idx) => {
      if (!toNodes.has(b.node)) add(b, idx, 1 - e);
    });
    return out;
  });

  const bandLabels = createMemo(() => {
    const to = target();
    if (!to || !atRest()) return [] as { id: string; d: string; text: string; italic: boolean }[];
    const g = geo();
    const fs = g.fs;
    return to.bands.flatMap((b, idx) => {
      const span = b.a1 - b.a0;
      const mid = (b.a0 + b.a1) / 2;
      const bottom = mid > Math.PI / 2 && mid < (3 * Math.PI) / 2;
      const r = bottom ? g.arcOut + 4 + fs * 0.74 : g.arcOut + 4;
      const room = span * r * 0.94;
      const text = bandTexts(b.node).find((s) => s.length * fs * 0.6 <= room);
      if (!text) return [];
      const h = Math.min(span / 2, 1.45);
      const d = bottom
        ? `M${pt(g.c, mid + h, r)}A${f1(r)} ${f1(r)} 0 0 0 ${pt(g.c, mid - h, r)}`
        : `M${pt(g.c, mid - h, r)}A${f1(r)} ${f1(r)} 0 0 1 ${pt(g.c, mid + h, r)}`;
      return [{ id: `rt${uid}-b${idx}`, d, text, italic: isItalicRank(b.node.data.rank) }];
    });
  });

  const leafLabels = createMemo(() => {
    const to = target();
    const lw = labTo();
    if (!to || !atRest() || lw <= 0) return [] as { x: number; y: number; rot: number; anchor: "start" | "end"; text: string; node: TNode }[];
    const g = geo();
    return to.terminals.map((n) => {
      const a = at(to.a, n.data.i);
      const [x, y] = xy(g.c, a, g.labIn + 2);
      const deg = (a * 180) / Math.PI;
      const left = a > Math.PI;
      return { x, y, rot: left ? deg + 90 : deg - 90, anchor: left ? ("end" as const) : ("start" as const), text: abbrevName(n.data.name), node: n };
    });
  });

  const guides = createMemo(() => {
    const to = target();
    if (!to) return [] as { r: number; label: string }[];
    const g = geo();
    const fd = to.focus.depth;
    if (to.mode === "time") {
      return ageTicks(to.focusAge).map((age) => ({
        r: (1 - age / to.focusAge) * g.R,
        label: `${fmtNum(age, 1)} Mya`,
      }));
    }
    const denom = (to.displayDepth >= SPECIES_DEPTH ? SPECIES_DEPTH : to.displayDepth + 1) - fd;
    const out: { r: number; label: string }[] = [];
    for (let d = fd + 1; d <= Math.min(to.displayDepth, SPECIES_DEPTH - 1); d++) {
      const rank = RANKS[d];
      if (rank) out.push({ r: ((d - fd) / denom) * g.R, label: rankPlural(rank) });
    }
    return out;
  });

  /** Small dots on internal nodes, grouped by colour (drawn at rest). */
  const nodeDots = createMemo(() => {
    const to = target();
    if (!to || !atRest()) return [] as { color: string; d: string }[];
    const g = geo();
    const internal = to.visible.filter((n) => n.children && n !== to.focus && n.depth < to.displayDepth);
    const dense = internal.length > 260;
    const groups = new Map<string, string[]>();
    for (const n of internal) {
      if (dense && n.depth > Math.max(to.bandDepth, CLASS_DEPTH)) continue;
      const [x, y] = xy(g.c, at(to.a, n.data.i), at(to.r, n.data.i) * g.R);
      const r = n.depth <= Math.max(to.bandDepth, CLASS_DEPTH) ? 3.2 : 2.4;
      const color = colorOf(n);
      const list = groups.get(color) ?? [];
      list.push(`M${f1(x - r)} ${f1(y)}a${r} ${r} 0 1 0 ${2 * r} 0a${r} ${r} 0 1 0 ${-2 * r} 0`);
      groups.set(color, list);
    }
    return [...groups.entries()].map(([color, parts]) => ({ color, d: parts.join("") }));
  });

  // ---------------------------------------------------------------- hover, hit testing, overlay

  const visibleByDepth = createMemo(() => {
    const to = target();
    const map = new Map<number, TNode[]>();
    if (!to) return map;
    for (const n of to.visible) {
      if (n === to.focus) continue;
      const list = map.get(n.depth) ?? [];
      list.push(n);
      map.set(n.depth, list);
    }
    return map;
  });

  const delaunay = createMemo(() => {
    const to = target();
    if (!to || !atRest()) return null;
    const g = geo();
    const pts = to.visible.filter((n) => n !== to.focus);
    const coords = new Float64Array(pts.length * 2);
    pts.forEach((n, k) => {
      const [x, y] = xy(g.c, at(to.a, n.data.i), at(to.r, n.data.i) * g.R);
      coords[2 * k] = x;
      coords[2 * k + 1] = y;
    });
    return { pts, coords, d: new Delaunay(coords) };
  });

  const toSvg = (clientX: number, clientY: number): [number, number] | null => {
    if (!svgEl) return null;
    const r = svgEl.getBoundingClientRect();
    const k = S() / r.width;
    return [(clientX - r.left) * k, (clientY - r.top) * k];
  };

  const leafAtAngle = (to: Layout, m: TreeModel, a: number): TNode | null => {
    const fi = to.focus.data.i;
    let lo = m.leafRange[2 * fi] ?? 0;
    let hi = m.leafRange[2 * fi + 1] ?? 0;
    const first = lo;
    const last = hi;
    while (lo < hi) {
      const mid = (lo + hi) >> 1;
      if (at(to.la, mid) < a) lo = mid + 1;
      else hi = mid;
    }
    let best: number = lo;
    if (lo > first && Math.abs(at(to.la, lo - 1) - a) < Math.abs(at(to.la, lo) - a)) best = lo - 1;
    if (best < first || best > last) return null;
    return Math.abs(at(to.la, best) - a) <= Math.max(to.unit * 0.9, 0.012) ? (m.leaves[best] ?? null) : null;
  };

  const hitTest = (x: number, y: number, touch: boolean): Hover | null => {
    const m = model();
    const to = target();
    if (!m || !to || !atRest()) return null;
    const g = geo();
    const dx = x - g.c;
    const dy = y - g.c;
    const rr = Math.hypot(dx, dy);
    let a = Math.atan2(dx, -dy);
    if (a < 0) a += Math.PI * 2;
    if (rr > g.c) return null;
    if (rr >= g.arcIn - 2) {
      const b = to.bands.find((bb) => a >= bb.a0 && a <= bb.a1);
      return b ? { node: b.node, zone: "band" } : null;
    }
    if (rr >= g.ringIn - 3) {
      const leaf = leafAtAngle(to, m, a);
      return leaf ? { node: leaf, zone: "ring" } : null;
    }
    const dl = delaunay();
    if (dl && dl.pts.length) {
      const k = dl.d.find(x, y);
      const n = dl.pts[k];
      if (n) {
        const dist = Math.hypot(at(dl.coords, 2 * k) - x, at(dl.coords, 2 * k + 1) - y);
        if (dist <= (touch ? 24 : 15)) return { node: n, zone: "tree" };
      }
    }
    // Inside a collapsed fan?
    if (to.displayDepth < SPECIES_DEPTH && rr <= g.R + 2) {
      for (const n of to.terminals) {
        if (!n.children) continue;
        const i = n.data.i;
        const l0 = m.leafRange[2 * i] ?? 0;
        const l1 = m.leafRange[2 * i + 1] ?? 0;
        if (a >= at(to.la, l0) - at(to.lw, l0) && a <= at(to.la, l1) + at(to.lw, l1) && rr >= at(to.r, i) * g.R - 4) {
          return { node: n, zone: "tree" };
        }
      }
    }
    return null;
  };

  /** Links of the hovered node's lineage (focus -> node) and subtree, drawn on top. */
  const overlay = createMemo(() => {
    const h = hover() ?? (selected() ? { node: selected() as TNode, zone: "tree" as Zone } : null);
    const to = target();
    const m = model();
    if (!h || !to || !m || !atRest() || !isAncestorOf(to.focus, h.node)) return null;
    const g = geo();
    const pos = (n: TNode): [number, number] => [at(to.a, n.data.i), at(to.r, n.data.i) * g.R];
    const lineage: string[] = [];
    let n: TNode | null = h.node;
    while (n && n !== to.focus && n.parent) {
      const [ac, rc] = pos(n);
      const [ap, rp] = pos(n.parent);
      lineage.push(linkPath(g.c, ac, rc, ap, rp));
      n = n.parent;
    }
    const sub: string[] = [];
    if (h.node.children) {
      h.node.each((d) => {
        if (d === h.node || !d.parent || to.vis[d.data.i] !== 1) return;
        const [ac, rc] = pos(d);
        const [ap, rp] = pos(d.parent);
        sub.push(linkPath(g.c, ac, rc, ap, rp));
      });
    }
    const [x, y] = xy(g.c, ...pos(h.node));
    return { lineage: lineage.join(""), sub: sub.join(""), color: colorOf(h.node), x, y, node: h.node };
  });

  /** Outline of the hovered leaf's bar or of the hovered band. */
  const outline = createMemo(() => {
    const h = hover();
    const to = target();
    const m = model();
    const rd = ringData();
    if (!h || !to || !m || !rd || !atRest()) return null;
    const g = geo();
    if (h.zone === "band") {
      const b = to.bands.find((bb) => bb.node === h.node);
      return b ? sector(g.c, b.a0, b.a1, g.arcIn - 1, g.arcOut + 1) : null;
    }
    if (!h.node.children) {
      const k = h.node.data.leafIndex;
      const w = Math.min(Math.max(at(to.lw, k), 0.004), 8 / Math.max(1, g.ringIn));
      const a = at(to.la, k);
      return sector(g.c, a - w, a + w, g.ringIn - 1, g.ringIn + ringH() * (0.1 + 0.9 * at(rd.vals, k)) + 1);
    }
    return null;
  });

  const selectedMark = createMemo(() => {
    const s = selected();
    const to = target();
    if (!s || !to || !atRest() || to.vis[s.data.i] !== 1) return null;
    const g = geo();
    const [x, y] = xy(g.c, at(to.a, s.data.i), at(to.r, s.data.i) * g.R);
    const k = s.data.leafIndex;
    const w = Math.min(Math.max(at(to.lw, k), 0.006), 9 / Math.max(1, g.ringIn));
    const a = at(to.la, k);
    return { x, y, bar: k >= 0 ? sector(g.c, a - w, a + w, g.ringIn - 2, g.ringOut + 2) : "" };
  });

  // ---------------------------------------------------------------- interaction

  const activate = (n: TNode) => {
    if (!n.children) {
      window.location.assign(speciesUrl(n.data.slug));
      return;
    }
    if ((n.value ?? 0) < 2) {
      window.location.assign(taxonUrl(n.data.rank, n.data.slug));
      return;
    }
    if (n === focus()) return;
    setSelected(null);
    goTo(n);
  };

  const onPointerMove = (e: PointerEvent) => {
    if (e.pointerType !== "mouse" || pinned()) return;
    const p = toSvg(e.clientX, e.clientY);
    const h = p ? hitTest(p[0], p[1], false) : null;
    const cur = hover();
    if (h?.node !== cur?.node || h?.zone !== cur?.zone) setHover(h);
  };

  const onPointerLeave = (e: PointerEvent) => {
    if (e.pointerType === "mouse" && !pinned()) setHover(null);
  };

  const onClick = (e: MouseEvent) => {
    const pe = e as PointerEvent;
    const touch = pe.pointerType === "touch" || pe.pointerType === "pen";
    const p = toSvg(e.clientX, e.clientY);
    const h = p ? hitTest(p[0], p[1], touch) : null;
    if (!h) {
      setPinned(false);
      setHover(null);
      return;
    }
    if (touch && (hover()?.node !== h.node || !pinned())) {
      // First tap inspects, a second tap on the same node acts.
      setTouchHint(true);
      setHover(h);
      setPinned(true);
      return;
    }
    activate(h.node);
  };

  const moveActive = (next: TNode | undefined) => {
    if (!next) return;
    setTouchHint(false);
    setHover({ node: next, zone: next.children ? "tree" : "ring" });
    setPinned(true);
  };

  const onKeyDown = (e: KeyboardEvent) => {
    const to = target();
    if (!to) return;
    const cur = hover()?.node;
    const byDepth = visibleByDepth();
    if (e.key === "Escape") {
      e.preventDefault();
      if (cur || selected()) {
        setHover(null);
        setPinned(false);
        setSelected(null);
      } else goUp();
      return;
    }
    if (e.key === "Enter" || e.key === " ") {
      if (cur) {
        e.preventDefault();
        activate(cur);
      }
      return;
    }
    const firstChild = (n: TNode) => n.children?.find((c) => to.vis[c.data.i] === 1);
    let next: TNode | undefined;
    if (!cur) {
      if (["ArrowRight", "ArrowLeft", "ArrowUp", "ArrowDown", "Home"].includes(e.key)) next = firstChild(to.focus);
    } else if (e.key === "ArrowRight" || e.key === "ArrowLeft") {
      const list = byDepth.get(cur.depth) ?? [];
      const i = list.indexOf(cur);
      const step = e.key === "ArrowRight" ? 1 : -1;
      next = list[(i + step + list.length) % list.length];
    } else if (e.key === "ArrowUp") {
      next = cur.parent && cur.parent !== to.focus ? cur.parent : undefined;
    } else if (e.key === "ArrowDown") {
      next = firstChild(cur);
    } else if (e.key === "Home") {
      next = firstChild(to.focus);
    } else return;
    e.preventDefault();
    moveActive(next);
  };

  const onRootKeyDown = (e: KeyboardEvent) => {
    if (e.key !== "Escape" || e.defaultPrevented) return;
    const tgt = e.target as HTMLElement | null;
    if (tgt && (tgt.tagName === "INPUT" || (tgt as Element) === svgEl)) return;
    e.preventDefault();
    goUp();
  };

  const onPick = (n: TNode) => {
    const lim = rootLimit();
    if (!lim) return;
    if (n.children && (n.value ?? 0) >= 2) {
      setSelected(null);
      goTo(n);
      return;
    }
    // A species (or a clade with a single species): show it among its relatives.
    const leaf = n.children ? n.leaves()[0] : n;
    if (!leaf) return;
    const family = leaf.ancestors().find((x) => x.data.rank === "family");
    const genus = leaf.ancestors().find((x) => x.data.rank === "genus");
    let f: TNode | undefined = family && (family.value ?? 0) >= 2 ? family : leaf.parent?.parent ?? undefined;
    if (compact() && genus && (genus.value ?? 0) >= 2 && f && readableDepth(f, maxTerminals()) < SPECIES_DEPTH) f = genus;
    if (!f || !isAncestorOf(lim, f)) f = lim;
    setSelected(() => leaf);
    if (f !== focus()) goTo(f);
    setHover({ node: leaf, zone: "ring" });
    setPinned(true);
  };

  // ---------------------------------------------------------------- derived text

  const focusInfo = createMemo(() => {
    const f = focus();
    if (!f) return null;
    const leaves = f.leaves();
    let longest: TNode | undefined;
    let shortest: TNode | undefined;
    const gcs: number[] = [];
    for (const l of leaves) {
      const sp = l.data.sp;
      if (!sp) continue;
      if (!longest || sp.life > (longest.data.sp?.life ?? 0)) longest = l;
      if (!shortest || sp.life < (shortest.data.sp?.life ?? Infinity)) shortest = l;
      if (Number.isFinite(sp.gc)) gcs.push(sp.gc);
    }
    gcs.sort((a, b) => a - b);
    const mid = gcs.length >> 1;
    const medianGc = gcs.length ? (gcs.length % 2 ? (gcs[mid] ?? 0) : ((gcs[mid - 1] ?? 0) + (gcs[mid] ?? 0)) / 2) : Number.NaN;
    const children = [...(f.children ?? [])].sort((a, b) => (b.value ?? 0) - (a.value ?? 0) || a.data.name.localeCompare(b.data.name));
    return { f, count: leaves.length, longest, shortest, medianGc, children };
  });

  const trail = createMemo(() => {
    const f = focus();
    const lim = rootLimit();
    if (!f || !lim) return [] as TNode[];
    return f.ancestors().reverse().filter((n) => isAncestorOf(lim, n));
  });

  const announce = createMemo(() => {
    const h = hover();
    if (!h) return "";
    const n = h.node;
    if (!n.children && n.data.sp) {
      return `${n.data.name}${n.data.sp.common ? `, ${n.data.sp.common}` : ""}: lifespan ${fmtLifespan(n.data.sp.life)}, GC ${fmtPct(n.data.sp.gc, 1)}, ${fmtBp(n.data.sp.size)}`;
    }
    return `${RANK_LABEL[n.data.rank]} ${n.data.name}, ${rankCount(n.value ?? 0, "species")}`;
  });

  const tip = createMemo(() => {
    const h = hover();
    const to = target();
    const rd = ringData();
    if (!h || !to || !rd || !atRest()) return null;
    const g = geo();
    let a: number;
    let r: number;
    if (h.zone === "band") {
      const b = to.bands.find((bb) => bb.node === h.node);
      a = b ? (b.a0 + b.a1) / 2 : 0;
      r = g.arcIn;
    } else if (h.zone === "ring" && !h.node.children) {
      const k = h.node.data.leafIndex;
      a = at(to.la, k);
      r = g.ringIn + ringH() * (0.1 + 0.9 * at(rd.vals, k));
    } else {
      a = at(to.a, h.node.data.i);
      r = at(to.r, h.node.data.i) * g.R;
    }
    const [x, y] = xy(g.c, a, r);
    const half = Math.min(132, g.S * 0.4);
    return { h, left: Math.min(Math.max(x, half), g.S - half), top: y, below: y < g.S * 0.32 };
  });

  const focusColor = () => {
    const f = focus();
    return f ? colorOf(f) : NEUTRAL;
  };

  const legendClasses = createMemo(() => {
    const f = focus();
    if (!f) return [] as { key: string; label: string; color: string }[];
    const present = new Set<string>();
    f.each((n) => {
      if (n.data.cls) present.add(n.data.cls);
    });
    const out = CLASS_GROUPS.filter((g) => (g.key === "Other" ? [...present].some((c) => !(COLOURED_CLASSES as readonly string[]).includes(c)) : present.has(g.key)));
    return out.length > 1 || f.depth < CLASS_DEPTH ? out : [];
  });

  const timeAvailable = () => {
    const m = model();
    const f = focus();
    return !!m && !!f && canTime(m, f);
  };

  const metricTitle = () => metricInfo(metric()).title;

  // ---------------------------------------------------------------- render

  return (
    <div
      class="rtree"
      classList={{ "rtree--panel": !!props.panel, "is-moving": !atRest(), "is-hovering": !!overlay() }}
      data-metric={metric()}
      onKeyDown={onRootKeyDown}
    >
      <div class="rtree__toolbar">
        <Show when={props.search !== false && model() && rootLimit()}>
          <TreeSearch model={model() as TreeModel} scope={rootLimit() as TNode} onPick={onPick} />
        </Show>
        <div class="rtree__controls">
          <div class="rtree__control" role="group" aria-label="Layout">
            <span class="rtree__control-label" aria-hidden="true">Layout</span>
            <div class="seg">
              <button type="button" class="seg__btn" aria-pressed={mode() === "rank"} onClick={() => setMode("rank")}>
                By rank
              </button>
              <button
                type="button"
                class="seg__btn"
                aria-pressed={mode() === "time" && timeAvailable()}
                disabled={!timeAvailable()}
                title={timeAvailable() ? "Branch lengths in millions of years" : "No dated tree for this clade"}
                onClick={() => setMode("time")}
              >
                By time
              </button>
            </div>
          </div>
          <div class="rtree__control" role="group" aria-label="Outer ring">
            <span class="rtree__control-label" aria-hidden="true">Ring</span>
            <div class="seg">
              <For each={RING_METRICS}>
                {(mm) => (
                  <button type="button" class="seg__btn" aria-pressed={metric() === mm.key} onClick={() => setMetric(mm.key)}>
                    {mm.short}
                  </button>
                )}
              </For>
            </div>
          </div>
        </div>
      </div>

      <nav class="rtree__trail" aria-label="Focused clade">
        <ol role="list">
          <For each={trail()}>
            {(n, i) => (
              <li>
                <Show
                  when={i() < trail().length - 1}
                  fallback={
                    <span class="chip chip--current" aria-current="true">
                      <span class="chip__rank">{n.data.rank}</span>
                      <span class={isItalicRank(n.data.rank) ? "sci" : undefined}>{n.data.name}</span>
                    </span>
                  }
                >
                  <button type="button" class="chip chip--soft" onClick={() => goTo(n)}>
                    <span class="chip__rank">{n.data.rank}</span>
                    <span class={isItalicRank(n.data.rank) ? "sci" : undefined}>{n.data.name}</span>
                  </button>
                  <svg class="rtree__sep" viewBox="0 0 24 24" aria-hidden="true">
                    <path d="M9 6l6 6-6 6" />
                  </svg>
                </Show>
              </li>
            )}
          </For>
        </ol>
        <Show when={!props.panel && focus() && focus() !== rootLimit()}>
          <a class="rtree__trail-link" href={taxonUrl((focus() as TNode).data.rank, (focus() as TNode).data.slug)}>
            Open the {(focus() as TNode).data.name} page
          </a>
        </Show>
        <Show when={!props.syncUrl && focus()}>
          <a class="rtree__trail-link" href={treeUrl(nodeKey(focus() as TNode))}>
            Full tree
          </a>
        </Show>
      </nav>

      <div class="rtree__body">
        <div class="rtree__sizer" ref={sizer} style={{ "--rt-max": `${props.maxSize ?? 860}px` }}>
          <div class="rtree__frame" ref={frameEl}>
            <svg
              ref={svgEl}
              class="chart__svg rtree__svg"
              viewBox={`0 0 ${S()} ${S()}`}
              role="application"
              aria-roledescription="radial tree"
              aria-label={`${props.label}. Arrow keys move between clades, Enter opens, Escape goes up a level.`}
              tabIndex={0}
              style={{ "--rt-link": `${linkWidth()}px` }}
              onPointerMove={onPointerMove}
              onPointerLeave={onPointerLeave}
              onClick={onClick}
              onKeyDown={onKeyDown}
              onBlur={() => {
                setPinned(false);
                setHover(null);
              }}
            >
              <defs>
                <For each={bandLabels()}>{(l) => <path id={l.id} d={l.d} />}</For>
              </defs>
              <g class="rtree__guides">
                <For each={guides()}>
                  {(gd) => <path class="rtree__guide" d={circleArc(geo().c, target()?.start ?? 0, target()?.end ?? 0, gd.r)} />}
                </For>
              </g>
              <path
                class="rtree__track"
                d={sector(geo().c, (target()?.start ?? GAP / 2) - 0.004, (target()?.end ?? Math.PI * 2 - GAP / 2) + 0.004, geo().ringIn, geo().ringOut)}
              />
              <g class="rtree__bars">
                <Index each={barPaths()}>
                  {(d, k) => <path d={d()} style={{ fill: ringData()?.fills[k] ?? "transparent" }} />}
                </Index>
              </g>
              <g class="rtree__wedges">
                <Index each={wedges()}>
                  {(w) => <path d={w().d} style={{ "--c": w().color, opacity: w().op }} />}
                </Index>
              </g>
              <g class="rtree__links">
                <Index each={linkGroups()}>
                  {(lg) => <path d={lg().d} style={{ stroke: lg().color, opacity: lg().op }} />}
                </Index>
              </g>
              <g class="rtree__dots">
                <For each={nodeDots()}>{(nd) => <path d={nd.d} style={{ stroke: nd.color }} />}</For>
              </g>
              <Show when={overlay()}>
                {(o) => (
                  <g class="rtree__overlay" style={{ "--c": o().color }}>
                    <path class="rtree__overlay-sub" d={o().sub} />
                    <path class="rtree__overlay-line" d={o().lineage} />
                    <circle class="rtree__overlay-node" cx={o().x} cy={o().y} r={o().node.children ? 5.5 : 4} />
                  </g>
                )}
              </Show>
              <g class="rtree__bands">
                <Index each={bandArcs()}>
                  {(b) => <path classList={{ "is-alt": b().alt }} d={b().d} style={{ fill: b().color, opacity: b().op }} />}
                </Index>
              </g>
              <g class="rtree__labels">
                <For each={bandLabels()}>
                  {(l) => (
                    <text class="rtree__band-label" classList={{ sci: l.italic }}>
                      <textPath href={`#${l.id}`} startOffset="50%" text-anchor="middle">
                        {l.text}
                      </textPath>
                    </text>
                  )}
                </For>
                <For each={leafLabels()}>
                  {(l) => (
                    <text
                      class="rtree__leaf-label"
                      classList={{ "is-on": hover()?.node === l.node || selected() === l.node }}
                      x={f1(l.x)}
                      y={f1(l.y)}
                      dy="0.34em"
                      text-anchor={l.anchor}
                      transform={`rotate(${f1(l.rot)} ${f1(l.x)} ${f1(l.y)})`}
                    >
                      {l.text}
                    </text>
                  )}
                </For>
              </g>
              <g class="rtree__axis">
                <For each={guides()}>
                  {(gd) => (
                    <text x={geo().c} y={geo().c - gd.r} dy="0.34em" text-anchor="middle">
                      {gd.label}
                    </text>
                  )}
                </For>
              </g>
              <Show when={outline()}>{(d) => <path class="rtree__outline" d={d()} />}</Show>
              <Show when={selectedMark()}>
                {(s) => (
                  <g class="rtree__selected">
                    <path d={s().bar} />
                    <circle cx={s().x} cy={s().y} r={9} />
                  </g>
                )}
              </Show>
              <circle class="rtree__center" cx={geo().c} cy={geo().c} r={focus() ? 6 : 0} style={{ fill: focusColor() }} />
              <Show when={!model()}>
                <g class="rtree__skeleton">
                  <circle cx={geo().c} cy={geo().c} r={geo().R * 0.62} />
                  <circle cx={geo().c} cy={geo().c} r={(geo().ringIn + geo().ringOut) / 2} />
                  <text x={geo().c} y={geo().c} dy="0.34em" text-anchor="middle" style={{ "font-size": `${Math.round(S() * 0.034)}px` }}>
                    {failed() ? "The tree could not be loaded." : "Growing the tree…"}
                  </text>
                </g>
              </Show>
            </svg>

            <Show when={canGoUp() && focus()?.parent}>
              <button
                type="button"
                class="rtree__up"
                style={{ left: `${(geo().c / S()) * 100}%`, top: `${(geo().c / S()) * 100}%` }}
                onClick={goUp}
                aria-label={`Up to ${focus()?.parent?.data.name ?? "parent"}`}
                title={`Up to ${focus()?.parent?.data.name ?? "parent"}`}
              >
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                  <path d="M12 19V5M6 11l6-6 6 6" />
                </svg>
              </button>
            </Show>

            <Show when={tip()}>
              {(tp) => {
                const n = () => tp().h.node;
                const sp = () => n().data.sp;
                return (
                  <div
                    class="rtree__tip chart__tooltip"
                    classList={{ "is-below": tp().below }}
                    style={{ left: `${(tp().left / S()) * 100}%`, top: `${(tp().top / S()) * 100}%` }}
                    aria-hidden="true"
                  >
                    <div class="rtree__tip-rank" style={{ "--c": colorOf(n()) }}>
                      {n().children ? RANK_LABEL[n().data.rank] : "Species"}
                      <Show when={n().data.cls && n().depth > CLASS_DEPTH}> · {classLabel(n().data.cls ?? "")}</Show>
                    </div>
                    <div class="chart__tooltip-title">
                      <span class={isItalicRank(n().data.rank) ? "sci" : undefined}>{n().data.name}</span>
                    </div>
                    <Show when={sp()} fallback={
                      <>
                        <Show when={n().data.rank === "class"}>
                          <div class="chart__tooltip-sub">{classLabel(n().data.name)}</div>
                        </Show>
                        <div class="chart__tooltip-vals">
                          <span>{rankCount(n().value ?? 0, "species")}</span>
                          <Show when={n().children && n().children!.length > 1 && n().data.rank !== "genus"}>
                            <span>{rankCount(n().children?.length ?? 0, childRank(n().data.rank))}</span>
                          </Show>
                        </div>
                      </>
                    }>
                      {(s) => (
                        <>
                          <Show when={s().common}>
                            <div class="chart__tooltip-sub">{s().common}</div>
                          </Show>
                          <dl class="rtree__tip-vals">
                            <div classList={{ "is-on": metric() === "life" }}><dt>Lifespan</dt><dd>{fmtLifespan(s().life)}</dd></div>
                            <div classList={{ "is-on": metric() === "gc" }}><dt>GC</dt><dd>{fmtPct(s().gc, 1)}</dd></div>
                            <div classList={{ "is-on": metric() === "size" }}><dt>mtDNA</dt><dd>{fmtBp(s().size)}</dd></div>
                          </dl>
                        </>
                      )}
                    </Show>
                    <div class="chart__tooltip-hint">
                      {n().children
                        ? (n().value ?? 0) >= 2
                          ? n() === focus()
                            ? "Focused"
                            : touchHint() ? "Tap again to focus" : "Select to focus"
                          : touchHint() ? "Tap again to open" : "Select to open"
                        : touchHint() ? "Tap again to open" : "Select to open"}
                    </div>
                  </div>
                );
              }}
            </Show>
            <div class="visually-hidden" aria-live="polite">{announce()}</div>
          </div>
        </div>

        <Show when={props.panel && focusInfo()}>
          {(fi) => (
            <aside class="rtree__panel" aria-label="Focused clade">
              <p class="eyebrow">{RANK_LABEL[fi().f.data.rank]}</p>
              <h2 class="rtree__panel-title" classList={{ sci: isItalicRank(fi().f.data.rank) }}>
                {fi().f.data.name}
              </h2>
              <Show when={fi().f.data.rank === "class"}>
                <p class="rtree__panel-sub">{classLabel(fi().f.data.name)}</p>
              </Show>
              <dl class="rtree__facts">
                <div>
                  <dt>Species</dt>
                  <dd>{fmtInt(fi().count)}</dd>
                </div>
                <Show when={fi().children.length && fi().f.data.rank !== "genus"}>
                  <div>
                    <dt>{rankPlural(childRank(fi().f.data.rank)).replace(/^./, (c) => c.toUpperCase())}</dt>
                    <dd>{fmtInt(fi().children.length)}</dd>
                  </div>
                </Show>
                <div>
                  <dt>Lifespan</dt>
                  <dd>
                    {fmtLifespan(fi().shortest?.data.sp?.life)}–{fmtLifespan(fi().longest?.data.sp?.life)}
                  </dd>
                </div>
                <div>
                  <dt>Median GC</dt>
                  <dd>{fmtPct(fi().medianGc, 1)}</dd>
                </div>
              </dl>
              <Show when={fi().longest}>
                {(l) => (
                  <p class="rtree__longest">
                    Longest-lived:{" "}
                    <a href={speciesUrl(l().data.slug)}>{l().data.sp?.common || l().data.name}</a>,{" "}
                    {fmtLifespan(l().data.sp?.life)}
                  </p>
                )}
              </Show>
              <a class="btn btn--primary btn--sm rtree__open" href={taxonUrl(fi().f.data.rank, fi().f.data.slug)}>
                Open the {fi().f.data.name} page
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" innerHTML={ICONS.arrowRight} />
              </a>
              <h3 class="rtree__panel-h">{rankPlural(childRank(fi().f.data.rank)).replace(/^./, (c) => c.toUpperCase())}</h3>
              <ul role="list" class="rtree__children">
                <For each={fi().children}>
                  {(c) => (
                    <li>
                      <Show
                        when={c.children && (c.value ?? 0) >= 2}
                        fallback={
                          <a
                            class="chip chip--soft"
                            href={c.children ? taxonUrl(c.data.rank, c.data.slug) : speciesUrl(c.data.slug)}
                          >
                            <span class="chip__dot" style={{ "--dot": colorOf(c) }} />
                            <span class={isItalicRank(c.data.rank) ? "sci" : undefined}>{c.data.name}</span>
                            <Show when={c.children}>
                              <span class="chip__count">1</span>
                            </Show>
                          </a>
                        }
                      >
                        <button type="button" class="chip chip--soft" onClick={() => goTo(c)}>
                          <span class="chip__dot" style={{ "--dot": colorOf(c) }} />
                          <span class={isItalicRank(c.data.rank) ? "sci" : undefined}>
                            {c.data.rank === "class" ? classLabel(c.data.name) : c.data.name}
                          </span>
                          <span class="chip__count">{fmtInt(c.value ?? 0)}</span>
                        </button>
                      </Show>
                    </li>
                  )}
                </For>
              </ul>
            </aside>
          )}
        </Show>
      </div>

      <div class="rtree__legend">
        <div class="rtree__legend-ring">
          <span class="rtree__legend-title">Outer ring: {metricTitle()}</span>
          <div class="rtree__ramp" aria-hidden="true">
            <div class="rtree__ramp-bar" style={{ "--ramp-mid": `${RAMP_MID[metric()] * 100}%` }} />
            <Show when={ringData()}>
              {(rd) => (
                <For each={rd().scale.ticks}>
                  {(tk) => (
                    <span class="rtree__ramp-tick" style={{ left: `${(tk.t * 100).toFixed(1)}%` }}>
                      {tk.label}
                    </span>
                  )}
                </For>
              )}
            </Show>
          </div>
        </div>
        <Show when={legendClasses().length}>
          <ul class="chart__legend rtree__legend-classes" aria-label="Branch colours">
            <For each={legendClasses()}>
              {(c) => (
                <li>
                  <span class="chart__legend-btn">
                    <span class="chart__legend-swatch" style={{ "--swatch": c.color }} />
                    {c.label}
                  </span>
                </li>
              )}
            </For>
          </ul>
        </Show>
        <p class="chart__note">
          {target()?.mode === "time"
            ? "Distance from the centre is time: rings mark millions of years ago, tips are the present (TimeTree dates on the Open Tree of Life topology)."
            : compact()
              ? "Each ring is one rank. Fans are clades: tap one to look inside, tap again to focus."
              : "Each ring is one rank. Hover to see a clade or species; select a clade to focus it, a species to open it."}
        </p>
      </div>
    </div>
  );
}
