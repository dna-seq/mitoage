/**
 * Zoomable radial taxonomy tree island.
 *
 * A radial dendrogram of the MitoAge species drawn on a canvas, with branches coloured by class, an
 * outer ring of per-species values (maximum lifespan on a log scale, whole-genome GC%, mtDNA size),
 * arcs and names for the classes, and a rank or time-scaled layout from the dated tree.
 *
 * Zoom with the wheel, a pinch or the + and − buttons; drag to pan. Selecting a clade flies to it and
 * turns it to 3 or 9 o'clock so its names read across; selecting a species opens its page once its
 * name shows (before that it flies to the species). Zoom is semantic: the ring, arcs and text keep
 * their size while the tree grows, clade names appear on their stems as they get room, and species
 * names (common and scientific, with the ring value) appear at deep zoom.
 *
 * Keyboard: arrow keys walk the tree, Enter selects, Escape goes up, + and − zoom, 0 shows the
 * whole tree. On the /tree/ page the clade in view is mirrored in ?focus=rank:slug.
 *
 * Data: fetches /tree/tree.json on mount (shared with the other clade islands on the page).
 * Styles: import "~/components/tree/tree.css" in the page that renders it.
 *
 * <RadialTree client:visible label="Taxonomy tree of 922 species" syncUrl panel />
 * <RadialTree client:visible label="Taxonomy tree of Mammalia" rootKey="class:mammalia" />
 */
import { easeCubicInOut } from "d3-ease";
import { interpolateZoom } from "d3-interpolate";
import { select } from "d3-selection";
import { zoom, zoomIdentity, type D3ZoomEvent, type ZoomBehavior, type ZoomTransform } from "d3-zoom";
import { batch, createEffect, createMemo, createSignal, For, on, onCleanup, onMount, Show, untrack } from "solid-js";
import { ICONS } from "~/components/ui/icons";
import { CLASS_GROUPS, classColor, classLabel, COLOURED_CLASSES } from "~/lib/classes";
import { fmtBp, fmtInt, fmtLifespan, fmtPct } from "~/lib/format";
import {
  angleDiff,
  cameraAt,
  cladeAt,
  clamp,
  constrain,
  fitClade,
  fitLeaf,
  geometryFor,
  leafAt,
  maxZoom,
  minZoom,
  nodeSpan,
  polar,
  projFor,
  radius,
  radiusInv,
  snapZoom,
  span,
  toPolar,
  viewCentre,
  viewClade,
  visibleArc,
  zoomAbout,
  zones,
  type Camera,
  type FitContext,
  type Proj,
  type Viewport,
} from "~/lib/tree/camera";
import { loadTree, TREE_DATA_URL, treeUrl } from "~/lib/tree/data";
import { pointInLabel, type PlacedLabel } from "~/lib/tree/labels";
import {
  canTime,
  computeLayout,
  defaultBandDepth,
  frameToPose,
  interpolate,
  isAncestorOf,
  type Frame,
  type Layout,
  type LayoutMode,
  type Pose,
} from "~/lib/tree/layout";
import { childRank, isItalicRank, RANK_LABEL, rankCount, rankPlural } from "~/lib/tree/names";
import { metricInfo, RAMP_MID, RING_METRICS, ringScale, type Metric } from "~/lib/tree/ring";
import { CLASS_DEPTH, nodeKey, parseKey, SPECIES_DEPTH, type TNode, type TreeModel } from "~/lib/tree/types";
import { uiScale } from "~/lib/uiScale";
import { speciesUrl, taxonUrl } from "~/lib/urls";
import TreeSearch from "./TreeSearch";
import { createMeasurer, drawScene, drawSkeleton, readPalette, type Measurer, type Palette, type Zone } from "./treeDraw";

export interface RadialTreeProps {
  /** Accessible name of the chart. */
  label: string;
  /** Clade shown first and the highest one reachable, "rank:slug"; default the whole tree. */
  rootKey?: string;
  /** Mirror the clade in view in ?focus=rank:slug and the browser history (the /tree/ page). */
  syncUrl?: boolean;
  /** Side panel with the clade in view: its numbers and children (the /tree/ page). */
  panel?: boolean;
  /** Show the find-in-tree box (default true). */
  search?: boolean;
  metric?: Metric;
  /** Largest width of the drawing in px (at the default text size). */
  maxSize?: number;
  dataUrl?: string;
}

const GAP = 0.2;
const DUR = 760;
const METRIC_DUR = 420;

interface Hover {
  node: TNode;
  zone: Zone;
  /** Pointer position, for wedges (the clade region under the pointer). */
  x?: number;
  y?: number;
}

const lerp = (x: number, y: number, t: number): number => x + (y - x) * t;

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

const Icon = (p: { d: string }) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
    <path d={p.d} />
  </svg>
);

const IC = {
  up: "M12 19V5M6 11l6-6 6 6",
  minus: "M5 12h14",
  plus: "M12 5v14M5 12h14",
  home: "M4 11.5 12 4l8 7.5M6.5 9.5V20h11V9.5",
  expand: "M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5",
  collapse: "M9 4v5H4M15 4v5h5M9 20v-5H4M15 20v-5h5",
};

// ---------------------------------------------------------------- component

export default function RadialTree(props: RadialTreeProps) {
  const [model, setModel] = createSignal<TreeModel | null>(null);
  const [failed, setFailed] = createSignal(false);
  const [vp, setVp] = createSignal<Viewport>({ w: 0, h: 0 });
  const [u, setU] = createSignal(1);
  const [focus, setFocus] = createSignal<TNode | null>(null);
  const [mode, setMode] = createSignal<LayoutMode>("rank");
  const [metric, setMetric] = createSignal<Metric>(props.metric ?? "life");
  const [hover, setHover] = createSignal<Hover | null>(null);
  const [pinned, setPinned] = createSignal(false);
  const [selected, setSelected] = createSignal<TNode | null>(null);
  const [touchHint, setTouchHint] = createSignal(false);
  const [cam, setCam] = createSignal<Camera | null>(null);
  const [expanded, setExpanded] = createSignal(false);
  const [hint, setHint] = createSignal(true);
  const [coarse, setCoarse] = createSignal(false);
  const [palVer, setPalVer] = createSignal(0);

  // Layout transition (rank <-> time) and metric transition.
  const [target, setTarget] = createSignal<Layout | null>(null);
  const [fromLayout, setFromLayout] = createSignal<Layout | null>(null);
  const [fromPose, setFromPose] = createSignal<Pose | null>(null);
  const [t, setT] = createSignal(1);
  const [valsFrom, setValsFrom] = createSignal<Float64Array | null>(null);
  const [mt, setMt] = createSignal(1);

  let rootEl: HTMLDivElement | undefined;
  let frameEl: HTMLDivElement | undefined;
  let canvasEl: HTMLCanvasElement | undefined;
  let zb: ZoomBehavior<HTMLCanvasElement, unknown> | null = null;
  /** Rotation of the camera; d3-zoom keeps k, x and y. */
  let thNow = 0;
  let stopTween: () => void = () => {};
  let stopMetricTween: () => void = () => {};
  let stopFly: () => void = () => {};
  let gestureFrom: ZoomTransform | null = null;
  /** Pointer (or pinch centre) before and after the current zoom step, for zooming about it. */
  let anchorFrom: [number, number] | null = null;
  let anchorTo: [number, number] | null = null;
  let lastPinch: [number, number] | null = null;
  let lastStems: PlacedLabel[] = [];
  let measurer: Measurer | null = null;
  let pal: Palette | null = null;
  let palDirty = true;
  let raf = 0;
  let syncTimer: ReturnType<typeof setTimeout> | undefined;

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

  // ---------------------------------------------------------------- geometry and layout

  const G = createMemo(() => {
    const v = vp();
    return v.w > 0 && v.h > 0 ? geometryFor(v, u()) : null;
  });

  const kRange = createMemo<[number, number]>(() => {
    const g = G();
    const L = target();
    if (!g || !L) return [1, 4];
    const lo = minZoom(g, L.unit);
    return [lo, Math.max(lo * 1.5, maxZoom(g, L.unit))];
  });

  const fitCtx = (): FitContext | null => {
    const m = model();
    const L = target();
    const g = G();
    if (!m || !L || !g) return null;
    const [kMin, kMax] = kRange();
    return { model: m, L, G: g, vp: vp(), kMin, kMax };
  };

  /** Radius mapping of the layout at rest. */
  const proj = createMemo<Proj | null>(() => {
    const g = G();
    const L = target();
    return g && L ? projFor(g, L, kRange()[0]) : null;
  });

  /** Distance from the tips to the centre at zoom k, blended while the layout changes. */
  const depthNow = (k: number): number => {
    const g = G();
    const L = target();
    if (!g || !L) return 1;
    const kMin = kRange()[0];
    const to = span(projFor(g, L, kMin), k);
    const from = fromLayout();
    if (!from || t() >= 1) return to;
    return lerp(span(projFor(g, from, kMin), k), to, ease());
  };

  const layoutFor = (m: TreeModel, lim: TNode, md: LayoutMode): Layout =>
    computeLayout(m, lim, {
      mode: md,
      displayDepth: SPECIES_DEPTH,
      bandDepth: lim.depth >= SPECIES_DEPTH - 1 ? 0 : defaultBandDepth(lim),
      gap: GAP,
    });

  const ease = () => easeCubicInOut(t());

  const frame = createMemo<Frame | null>(() => {
    const m = model();
    const to = target();
    if (!m || !to) return null;
    return interpolate(m, fromPose(), to, ease());
  });

  const animateLayout = () => {
    stopTween();
    if (prefersReducedMotion()) {
      setT(1);
      return;
    }
    stopTween = tween(DUR, setT);
  };

  // ---------------------------------------------------------------- camera

  const applyCamera = (c: Camera) => {
    thNow = c.th;
    if (zb && canvasEl) zb.transform(select(canvasEl), zoomIdentity.translate(c.x, c.y).scale(c.k));
    else setCam(c);
  };

  /** Animated flight to a camera along a smooth zoom path, turning on the way. */
  const flyTo = (to: Camera, done?: () => void) => {
    stopFly();
    clearTimeout(syncTimer);
    const from = untrack(cam);
    const v = untrack(vp);
    if (!from || prefersReducedMotion() || v.w <= 0) {
      applyCamera(to);
      done?.();
      return;
    }
    const c0 = viewCentre(from, v);
    const c1 = viewCentre(to, v);
    const zi = interpolateZoom([c0[0], c0[1], v.w / from.k], [c1[0], c1[1], v.w / to.k]);
    const dth = angleDiff(from.th, to.th);
    const ms = clamp(Number.isFinite(zi.duration) ? zi.duration * 0.85 : 600, 450, 1400);
    stopFly = tween(ms, (q) => {
      if (q >= 1) {
        applyCamera(to);
        done?.();
        return;
      }
      const e = easeCubicInOut(q);
      const [px, py, w] = zi(e);
      applyCamera(cameraAt([px, py], v.w / w, from.th + dth * e, v));
    });
  };

  const resetCamera = () => {
    const ctx = fitCtx();
    const f = focus();
    if (!ctx || !f) return;
    stopFly();
    applyCamera(fitClade(ctx, f));
  };

  // ---------------------------------------------------------------- loading, size, URL, theme

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

    setCoarse(window.matchMedia?.("(hover: none)").matches === true);

    if (frameEl && "ResizeObserver" in window) {
      const ro = new ResizeObserver((entries) => {
        const r = entries[0]?.contentRect;
        if (!r) return;
        const w = Math.round(r.width);
        const h = Math.round(r.height);
        if (w > 0 && h > 0) {
          batch(() => {
            setU(uiScale());
            setVp((v) => (v.w === w && v.h === h ? v : { w, h }));
          });
        }
      });
      ro.observe(frameEl);
      onCleanup(() => ro.disconnect());
    }

    if (frameEl) {
      // Capture phase on the frame runs before d3-zoom's own listeners on the canvas.
      const at = (x: number, y: number): [number, number] => {
        const r = (canvasEl as HTMLCanvasElement).getBoundingClientRect();
        return [x - r.left, y - r.top];
      };
      const centre = (ts: TouchList): [number, number] | null => {
        if (!ts.length) return null;
        let x = 0;
        let y = 0;
        for (let i = 0; i < ts.length; i++) {
          x += ts[i]?.clientX ?? 0;
          y += ts[i]?.clientY ?? 0;
        }
        return at(x / ts.length, y / ts.length);
      };
      const onWheel = (e: WheelEvent) => {
        anchorFrom = anchorTo = at(e.clientX, e.clientY);
      };
      const onTouch = (e: TouchEvent) => {
        const c = centre(e.touches);
        if (e.type === "touchmove") {
          anchorFrom = lastPinch ?? c;
          anchorTo = c;
        } else anchorFrom = anchorTo = c;
        lastPinch = c;
      };
      const opts = { capture: true, passive: true };
      frameEl.addEventListener("wheel", onWheel, opts);
      for (const ev of ["touchstart", "touchmove", "touchend"] as const) frameEl.addEventListener(ev, onTouch, opts);
      onCleanup(() => {
        frameEl?.removeEventListener("wheel", onWheel, opts);
        for (const ev of ["touchstart", "touchmove", "touchend"] as const) frameEl?.removeEventListener(ev, onTouch, opts);
      });
    }

    if (canvasEl) {
      const ctx = canvasEl.getContext("2d");
      if (ctx) measurer = createMeasurer(ctx, () => pal?.family ?? "sans-serif");
      zb = zoom<HTMLCanvasElement, unknown>()
        .scaleExtent(kRange())
        .clickDistance(5)
        .tapDistance(12)
        .filter((e: Event) => {
          if (e.type === "wheel") return true;
          if (e.type === "touchstart") {
            // At the whole-tree view one finger scrolls the page; pinch to zoom.
            const n = (e as TouchEvent).touches.length;
            return n > 1 || (untrack(cam)?.k ?? 1) > untrack(kRange)[0] * 1.02;
          }
          const me = e as MouseEvent;
          return !me.ctrlKey && !me.button;
        })
        .constrain((tr) => {
          const g = G();
          const L = target();
          const P = proj();
          if (!g || !L || !P) return tr;
          let c: Camera = { k: tr.k, x: tr.x, y: tr.y, th: thNow };
          // d3-zoom scales the drawing as if it were flat; ours keeps the rings and labels at a
          // fixed size, so keep whatever is under the pointer under it ourselves.
          const prev = untrack(cam);
          if (prev && anchorFrom && anchorTo && Math.abs(prev.k - tr.k) > 1e-9) c = zoomAbout(P, prev, tr.k, anchorFrom, anchorTo);
          c = constrain(g, L.unit, vp(), c);
          return c.x === tr.x && c.y === tr.y ? tr : zoomIdentity.translate(c.x, c.y).scale(c.k);
        })
        .on("start", (e: D3ZoomEvent<HTMLCanvasElement, unknown>) => {
          if (!e.sourceEvent) return;
          stopFly();
          clearTimeout(syncTimer);
          gestureFrom = e.transform;
        })
        .on("zoom", (e: D3ZoomEvent<HTMLCanvasElement, unknown>) => {
          const tr = e.transform;
          setCam({ k: tr.k, x: tr.x, y: tr.y, th: thNow });
          if (e.sourceEvent && gestureFrom && (tr.k !== gestureFrom.k || Math.hypot(tr.x - gestureFrom.x, tr.y - gestureFrom.y) > 2)) {
            setHint(false);
            if (!pinned()) setHover(null);
          }
        })
        .on("end", (e: D3ZoomEvent<HTMLCanvasElement, unknown>) => {
          if (!e.sourceEvent || !gestureFrom) return;
          const tr = e.transform;
          const moved = tr.k !== gestureFrom.k || Math.hypot(tr.x - gestureFrom.x, tr.y - gestureFrom.y) > 2;
          const zoomed = tr.k !== gestureFrom.k;
          gestureFrom = null;
          if (!moved) return;
          // Do not rest where the species names are half faded in: settle on the nearer clean zoom.
          const c = untrack(cam);
          const g = G();
          const L = target();
          const P = proj();
          if (zoomed && c && g && L && P) {
            const [lo, hi] = kRange();
            const k2 = clamp(snapZoom(g, L.unit, c.k), lo, hi);
            if (Math.abs(k2 - c.k) > 1e-4) {
              const v = vp();
              const at = anchorTo ?? ([v.w / 2, v.h / 2] as [number, number]);
              flyTo(constrain(g, L.unit, v, zoomAbout(P, c, k2, at, at)), scheduleViewSync);
              return;
            }
          }
          scheduleViewSync();
        });
      select(canvasEl).call(zb).on("dblclick.zoom", null);
    }

    // Theme: the header toggle sets data-theme on <html>; the OS setting can change too.
    const mo = new MutationObserver(() => setPalVer((v) => v + 1));
    mo.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });
    const mq = window.matchMedia?.("(prefers-color-scheme: dark)");
    const onScheme = () => setPalVer((v) => v + 1);
    mq?.addEventListener?.("change", onScheme);
    document.fonts?.ready.then(() => {
      measurer?.clear();
      scheduleDraw();
    });
    onCleanup(() => {
      mo.disconnect();
      mq?.removeEventListener?.("change", onScheme);
    });

    if (props.syncUrl) {
      const onPop = () => {
        const m = model();
        const ctx = fitCtx();
        if (!m || !ctx) return;
        const n = resolveKey(m, urlFocus()) ?? limitIn(m);
        batch(() => {
          setPinned(false);
          setHover(null);
          setFocus(() => n);
        });
        flyTo(fitClade(ctx, n));
      };
      window.addEventListener("popstate", onPop);
      onCleanup(() => window.removeEventListener("popstate", onPop));
    }
    onCleanup(() => {
      stopTween();
      stopMetricTween();
      stopFly();
      clearTimeout(syncTimer);
      cancelAnimationFrame(raf);
      document.documentElement.classList.remove("rtree-lock");
      if (canvasEl) select(canvasEl).on(".zoom", null);
    });
  });

  // Layout: computed for the root of the island; animated when the mode changes.
  createEffect(
    on([model, rootLimit, mode], () => {
      const m = model();
      const lim = rootLimit();
      if (!m || !lim) return;
      const next = layoutFor(m, lim, mode());
      const prev = untrack(target);
      if (prev && prev.focus === next.focus && prev.mode === next.mode) return;
      const cur = untrack(frame);
      batch(() => {
        setFromPose(prev && cur ? frameToPose(cur) : null);
        setFromLayout(prev);
        setTarget(next);
        setT(prev ? 0 : 1);
      });
      if (!prev) {
        resetCamera();
        return;
      }
      animateLayout();
      const ctx = fitCtx();
      const f = untrack(focus);
      if (ctx && f) flyTo(fitClade(ctx, f));
    }),
  );

  // New canvas size: fit the clade in view again.
  createEffect(
    on(G, (g) => {
      if (g) resetCamera();
    }),
  );

  createEffect(() => {
    const ext = kRange();
    zb?.scaleExtent(ext);
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

  /** Fly to a clade and make it the focus. */
  const navigate = (n: TNode, how: "push" | "replace" = "push", to?: Camera, done?: () => void) => {
    const ctx = fitCtx();
    if (!ctx || !n.children) return;
    const prev = focus();
    batch(() => {
      setPinned(false);
      setHover(null);
      setFocus(() => n);
    });
    setHint(false);
    flyTo(to ?? fitClade(ctx, n), done);
    if (n !== prev) writeUrl(n, prev, how);
  };

  /** After the reader pans or zooms, the focus follows the clade in view. */
  const scheduleViewSync = () => {
    clearTimeout(syncTimer);
    syncTimer = setTimeout(() => {
      const m = model();
      const L = target();
      const g = G();
      const c = cam();
      if (!m || !L || !g || !c) return;
      const prev = focus();
      const n = viewClade(m, L, g, c, vp(), kRange()[0], prev);
      if (n !== prev) {
        setFocus(() => n);
        writeUrl(n, prev, "replace");
      }
    }, 380);
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
    navigate(parent, "replace");
  };

  const zoomBy = (f: number) => {
    const c = cam();
    const g = G();
    const L = target();
    if (!c || !g || !L) return;
    const P = proj();
    if (!P) return;
    const [lo, hi] = kRange();
    const k = clamp(snapZoom(g, L.unit, clamp(c.k * f, lo, hi), f > 1 ? "near" : "down"), lo, hi);
    const v = vp();
    const mid: [number, number] = [v.w / 2, v.h / 2];
    setHint(false);
    flyTo(constrain(g, L.unit, v, zoomAbout(P, c, k, mid, mid)), scheduleViewSync);
  };

  const toggleExpanded = () => {
    const next = !expanded();
    setExpanded(next);
    document.documentElement.classList.toggle("rtree-lock", next);
    if (next) requestAnimationFrame(() => canvasEl?.focus({ preventScroll: true }));
  };

  // ---------------------------------------------------------------- ring values

  const ringData = createMemo(() => {
    const m = model();
    if (!m) return null;
    const key = metric();
    const raw = m.leaves.map((l) => (key === "life" ? l.data.sp?.life : key === "gc" ? l.data.sp?.gc : l.data.sp?.size) ?? Number.NaN);
    const scale = ringScale(key, raw);
    const vals = new Float64Array(raw.length);
    raw.forEach((v, k) => (vals[k] = Number.isFinite(v) ? scale.norm(v) : Number.NaN));
    return { scale, vals };
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

  const ringVals = createMemo<Float64Array | null>(() => {
    const rd = ringData();
    if (!rd) return null;
    const vf = valsFrom();
    if (!vf) return rd.vals;
    const k = easeCubicInOut(mt());
    const out = new Float64Array(rd.vals.length);
    for (let i = 0; i < out.length; i++) {
      const a = vf[i] ?? Number.NaN;
      const b = rd.vals[i] ?? Number.NaN;
      out[i] = lerp(Number.isFinite(a) ? a : 0, Number.isFinite(b) ? b : 0, k);
    }
    return out;
  });

  const valueText = (leaf: TNode): string => {
    const sp = leaf.data.sp;
    if (!sp) return "";
    const key = untrack(metric);
    return key === "life" ? fmtLifespan(sp.life) : key === "gc" ? fmtPct(sp.gc, 1) : fmtBp(sp.size);
  };

  // ---------------------------------------------------------------- drawing

  const draw = () => {
    raf = 0;
    const c = canvasEl;
    const g = G();
    const v = vp();
    if (!c || !g || !rootEl || !measurer) return;
    const dpr = Math.min(3, window.devicePixelRatio || 1);
    const W = Math.round(v.w * dpr);
    const H = Math.round(v.h * dpr);
    if (c.width !== W) c.width = W;
    if (c.height !== H) c.height = H;
    const ctx = c.getContext("2d");
    if (!ctx) return;
    const m = model();
    if (palDirty || !pal) {
      pal = readPalette(rootEl, m, metric());
      palDirty = false;
      measurer.clear();
    }
    const L = target();
    const cm = cam();
    const f = frame();
    const vals = ringVals();
    if (!m || !L || !cm || !f || !vals) {
      drawSkeleton(ctx, v, dpr, g, pal, failed() ? "The tree could not be loaded." : "Growing the tree…");
      lastStems = [];
      return;
    }
    const out = drawScene(
      ctx,
      {
        model: m,
        L,
        pose: frameToPose(f),
        rest: t() >= 1,
        G: g,
        cam: cm,
        vp: v,
        dpr,
        D: depthNow(cm.k),
        kMin: kRange()[0],
        vals,
        ticks: ringData()?.scale.ticks ?? [],
        valueText,
        hover: hover(),
        selected: selected(),
      },
      pal,
      measurer,
    );
    lastStems = out.stems;
  };

  const scheduleDraw = () => {
    if (!raf && typeof window !== "undefined") raf = requestAnimationFrame(draw);
  };

  createEffect(() => {
    cam();
    frame();
    ringVals();
    hover();
    selected();
    G();
    model();
    failed();
    t();
    scheduleDraw();
  });

  createEffect(
    on([palVer, metric, model], () => {
      palDirty = true;
      scheduleDraw();
    }),
  );

  // ---------------------------------------------------------------- hit testing

  const hitTest = (px: number, py: number, touch: boolean): Hover | null => {
    const m = model();
    const L = target();
    const g = G();
    const c = cam();
    if (!m || !L || !g || !c || t() < 1) return null;
    const z = zones(g, L.unit, c.k);
    const { a, s } = toPolar(c, px, py);
    if (s > z.labOut + 4 * g.u) return null;
    const band = (): Hover | null => {
      const b = L.bands.find((bb) => a >= bb.a0 && a <= bb.a1);
      return b ? { node: b.node, zone: "band" } : null;
    };
    if (s >= z.T - Math.min(6 * g.u, 0.5 * L.unit * z.T + 2 * g.u)) {
      if (s >= z.arcIn - 2 * g.u && z.leafA < 0.5) return band();
      const leaf = leafAt(m, L, L.focus, a, ((touch ? 8 : 2) * g.u) / Math.max(1, s));
      if (leaf) return { node: leaf, zone: "ring" };
      return s >= z.arcIn - 2 * g.u ? band() : null;
    }
    for (const lab of lastStems) if (pointInLabel(lab, px, py, 3 * g.u)) return { node: lab.node, zone: "tree" };
    const P = proj();
    if (!P) return null;
    let best: TNode | null = null;
    let bd = (touch ? 20 : 11) * g.u;
    L.focus.each((n) => {
      if (!n.children || n === L.focus) return;
      const [x, y] = polar(c, L.a[n.data.i] ?? 0, radius(P, c.k, L.r[n.data.i] ?? 0));
      const d = Math.hypot(x - px, y - py);
      if (d < bd) {
        bd = d;
        best = n;
      }
    });
    // A clade too small to see at this zoom stands for its visible ancestor, so selecting zooms
    // in a level or two at a time rather than straight to a genus.
    const minPx = 34 * g.u;
    const visible = (n: TNode): TNode => {
      let v = n;
      while (v !== L.focus && v.parent) {
        const [a0, a1] = nodeSpan(m, L, v);
        if ((a1 - a0) * g.R * c.k >= minPx) break;
        v = v.parent;
      }
      return v;
    };
    if (best) {
      const v = visible(best);
      return v === L.focus ? null : { node: v, zone: v === best ? "tree" : "wedge", x: px, y: py };
    }
    const n = visible(cladeAt(m, L, L.focus, a, radiusInv(P, c.k, s)));
    return n === L.focus ? null : { node: n, zone: "wedge", x: px, y: py };
  };

  const local = (e: MouseEvent): [number, number] => {
    const r = (canvasEl as HTMLCanvasElement).getBoundingClientRect();
    return [e.clientX - r.left, e.clientY - r.top];
  };

  /** Species names are on screen, so selecting a species opens it. */
  const leavesReadable = (): boolean => {
    const L = target();
    const g = G();
    const c = cam();
    return !!L && !!g && !!c && zones(g, L.unit, c.k).leafA > 0.5;
  };

  // ---------------------------------------------------------------- interaction

  const openSpecies = (leaf: TNode, newTab = false) => {
    const url = speciesUrl(leaf.data.slug);
    if (newTab) window.open(url, "_blank", "noopener");
    else window.location.assign(url);
  };

  /** Fly to a species among its relatives, highlighted with its card open. */
  const showSpecies = (leaf: TNode) => {
    const ctx = fitCtx();
    const lim = rootLimit();
    if (!ctx || !lim) return;
    const genus = leaf.parent;
    const family = genus?.parent ?? null;
    let f: TNode = genus && (genus.value ?? 0) >= 2 ? genus : (family ?? genus ?? lim);
    if (!isAncestorOf(lim, f)) f = lim;
    setSelected(() => leaf);
    navigate(f, "push", fitLeaf(ctx, leaf), () => {
      setTouchHint(false);
      setHover({ node: leaf, zone: "ring" });
      setPinned(true);
    });
  };

  const activateClade = (n: TNode) => {
    if ((n.value ?? 0) < 2) {
      const leaf = n.leaves()[0];
      if (leaf) showSpecies(leaf);
      return;
    }
    setSelected(null);
    navigate(n);
  };

  const onPointerMove = (e: PointerEvent) => {
    if (e.pointerType !== "mouse" || pinned() || e.buttons) return;
    const [x, y] = local(e);
    const h = hitTest(x, y, false);
    const cur = hover();
    if (!h) {
      if (cur) setHover(null);
      return;
    }
    if (h.node !== cur?.node || h.zone !== cur?.zone || h.zone === "wedge") setHover(h);
  };

  const onPointerLeave = (e: PointerEvent) => {
    if (e.pointerType === "mouse" && !pinned()) setHover(null);
  };

  const onClick = (e: MouseEvent) => {
    const pe = e as PointerEvent;
    const touch = pe.pointerType === "touch" || pe.pointerType === "pen";
    const [x, y] = local(e);
    const h = hitTest(x, y, touch);
    setHint(false);
    if (!h) {
      batch(() => {
        setPinned(false);
        setHover(null);
        setSelected(null);
      });
      return;
    }
    const n = h.node;
    if (!n.children) {
      if (!leavesReadable() && n !== selected()) {
        showSpecies(n);
        return;
      }
      if (touch && (hover()?.node !== n || !pinned())) {
        // First tap shows the species, a second tap opens it.
        setTouchHint(true);
        setHover(h);
        setPinned(true);
        return;
      }
      openSpecies(n, e.ctrlKey || e.metaKey || e.shiftKey);
      return;
    }
    activateClade(n);
  };

  const onAuxClick = (e: MouseEvent) => {
    if (e.button !== 1) return;
    const [x, y] = local(e);
    const h = hitTest(x, y, false);
    if (h && !h.node.children && leavesReadable()) {
      e.preventDefault();
      openSpecies(h.node, true);
    }
  };

  /** Screen point of a node: its dot, or the middle of its ring slot for a species. */
  const pointOf = (n: TNode): [number, number] | null => {
    const L = target();
    const g = G();
    const c = cam();
    if (!L || !g || !c) return null;
    if (!n.children) {
      const z = zones(g, L.unit, c.k);
      return polar(c, L.la[n.data.leafIndex] ?? 0, (z.ringIn + z.ringOut) / 2);
    }
    const P = proj();
    return P ? polar(c, L.a[n.data.i] ?? 0, radius(P, c.k, L.r[n.data.i] ?? 0)) : null;
  };

  const ensureVisible = (n: TNode) => {
    const p = pointOf(n);
    const c = cam();
    const g = G();
    const L = target();
    if (!p || !c || !g || !L) return;
    const v = vp();
    const m = 48 * g.u;
    if (p[0] >= m && p[0] <= v.w - m && p[1] >= m && p[1] <= v.h - m) return;
    flyTo(constrain(g, L.unit, v, { ...c, x: c.x + v.w / 2 - p[0], y: c.y + v.h / 2 - p[1] }), scheduleViewSync);
  };

  const moveActive = (next: TNode | undefined) => {
    if (!next) return;
    setTouchHint(false);
    setHover({ node: next, zone: next.children ? "tree" : "ring" });
    setPinned(true);
    ensureVisible(next);
  };

  const visibleByDepth = createMemo(() => {
    const L = target();
    const map = new Map<number, TNode[]>();
    if (!L) return map;
    L.focus.each((n) => {
      if (n === L.focus) return;
      const list = map.get(n.depth) ?? [];
      list.push(n);
      map.set(n.depth, list);
    });
    return map;
  });

  const onKeyDown = (e: KeyboardEvent) => {
    const L = target();
    if (!L) return;
    const cur = hover()?.node;
    if (e.key === "Escape") {
      e.preventDefault();
      if (cur || selected()) {
        batch(() => {
          setHover(null);
          setPinned(false);
          setSelected(null);
        });
      } else if (canGoUp()) goUp();
      else if (expanded()) toggleExpanded();
      return;
    }
    if (e.key === "Enter" || e.key === " ") {
      if (cur) {
        e.preventDefault();
        if (cur.children) activateClade(cur);
        else if (leavesReadable()) openSpecies(cur, e.ctrlKey || e.metaKey);
        else showSpecies(cur);
      }
      return;
    }
    if (e.key === "+" || e.key === "=") {
      e.preventDefault();
      zoomBy(1.6);
      return;
    }
    if (e.key === "-" || e.key === "_") {
      e.preventDefault();
      zoomBy(1 / 1.6);
      return;
    }
    if (e.key === "0") {
      e.preventDefault();
      const lim = rootLimit();
      if (lim) navigate(lim);
      return;
    }
    const f = focus() ?? L.focus;
    const firstChild = (n: TNode) => n.children?.[0];
    let next: TNode | undefined;
    if (!cur) {
      if (["ArrowRight", "ArrowLeft", "ArrowUp", "ArrowDown", "Home"].includes(e.key)) next = firstChild(f);
    } else if (e.key === "ArrowRight" || e.key === "ArrowLeft") {
      const list = visibleByDepth().get(cur.depth) ?? [];
      const i = list.indexOf(cur);
      const step = e.key === "ArrowRight" ? 1 : -1;
      next = list[(i + step + list.length) % list.length];
    } else if (e.key === "ArrowUp") {
      next = cur.parent && cur.parent !== L.focus ? cur.parent : undefined;
    } else if (e.key === "ArrowDown") {
      next = firstChild(cur);
    } else if (e.key === "Home") {
      next = firstChild(f);
    } else return;
    e.preventDefault();
    moveActive(next);
  };

  const onRootKeyDown = (e: KeyboardEvent) => {
    if (e.key !== "Escape" || e.defaultPrevented) return;
    const tgt = e.target as HTMLElement | null;
    if (tgt && (tgt.tagName === "INPUT" || (tgt as Element) === canvasEl)) return;
    e.preventDefault();
    if (canGoUp()) goUp();
    else if (expanded()) toggleExpanded();
  };

  const onPick = (n: TNode) => {
    if (n.children && (n.value ?? 0) >= 2) {
      activateClade(n);
      return;
    }
    const leaf = n.children ? n.leaves()[0] : n;
    if (leaf) showSpecies(leaf);
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
    const L = target();
    const g = G();
    const c = cam();
    const m = model();
    const vals = ringVals();
    if (!h || !L || !g || !c || !m || !vals || t() < 1) return null;
    const v = vp();
    const z = zones(g, L.unit, c.k);
    let x: number;
    let y: number;
    if (h.zone === "wedge" && h.x !== undefined && h.y !== undefined) {
      x = h.x;
      y = h.y;
    } else if (h.zone === "band") {
      const [a0, a1] = nodeSpan(m, L, h.node);
      const run = visibleArc(c, v, z.arcIn, a0 + c.th, a1 + c.th, 0);
      const p = run ? (run[0] + run[1]) / 2 : (a0 + a1) / 2 + c.th;
      x = c.x + z.arcIn * Math.sin(p);
      y = c.y - z.arcIn * Math.cos(p);
    } else if (!h.node.children) {
      const k = h.node.data.leafIndex;
      const val = vals[k] ?? Number.NaN;
      [x, y] = polar(c, L.la[k] ?? 0, z.ringIn + (z.ringOut - z.ringIn) * (0.1 + 0.9 * (Number.isFinite(val) ? val : 0)));
    } else {
      const P = proj();
      if (!P) return null;
      [x, y] = polar(c, L.a[h.node.data.i] ?? 0, radius(P, c.k, L.r[h.node.data.i] ?? 0));
    }
    if (x < -20 || x > v.w + 20 || y < -20 || y > v.h + 20) return null;
    const half = Math.min(140 * g.u, v.w * 0.42);
    return { h, left: clamp(x, half, v.w - half), top: clamp(y, 0, v.h), below: y < v.h * 0.34 };
  });

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
    const lim = rootLimit();
    return !!m && !!lim && canTime(m, lim);
  };

  const atMin = () => (cam()?.k ?? 1) <= kRange()[0] * 1.001;
  const atMax = () => (cam()?.k ?? 1) >= kRange()[1] * 0.999;
  const metricTitle = () => metricInfo(metric()).title;
  const nodeColorVar = (n: TNode): string => (n.depth >= CLASS_DEPTH && n.data.cls ? classColor(n.data.cls) : "var(--rt-neutral)");

  const tipHint = (n: TNode): string => {
    if (!n.children) return leavesReadable() || n === selected() ? (touchHint() ? "Tap again to open" : "Select to open") : "Select to zoom to it";
    if ((n.value ?? 0) < 2) return "Select to zoom to its species";
    return n === focus() ? "In view" : coarse() ? "Tap to zoom in" : "Select to zoom in";
  };

  // ---------------------------------------------------------------- render

  return (
    <div
      ref={rootEl}
      class="rtree"
      classList={{ "rtree--panel": !!props.panel, "is-expanded": expanded() }}
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

      <div class="rtree__bar">
        <nav class="rtree__trail" aria-label="Clade in view">
          <ol role="list">
            <For each={trail()}>
              {(n, i) => (
                <li classList={{ "is-mid": i() > 0 && i() < trail().length - 2 }}>
                  <Show when={i() === 1 && trail().length > 3}>
                    <span class="rtree__more" aria-hidden="true">
                      …
                    </span>
                  </Show>
                  <Show
                    when={i() < trail().length - 1}
                    fallback={
                      <span class="chip chip--current" aria-current="true">
                        <span class="chip__rank">{n.data.rank}</span>
                        <span class={isItalicRank(n.data.rank) ? "sci" : undefined}>{n.data.name}</span>
                      </span>
                    }
                  >
                    <button type="button" class="chip chip--soft" onClick={() => navigate(n)}>
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
        <div class="rtree__view" role="group" aria-label="Zoom">
          <button
            type="button"
            class="rtree__btn"
            disabled={!canGoUp()}
            onClick={goUp}
            aria-label={canGoUp() ? `Up to ${focus()?.parent?.data.name ?? "parent"}` : "Up a level"}
            title={canGoUp() ? `Up to ${focus()?.parent?.data.name ?? "parent"} (Esc)` : "Up a level"}
          >
            <Icon d={IC.up} />
          </button>
          <button type="button" class="rtree__btn" disabled={atMin()} onClick={() => zoomBy(1 / 1.6)} aria-label="Zoom out" title="Zoom out (−)">
            <Icon d={IC.minus} />
          </button>
          <button type="button" class="rtree__btn" disabled={atMax()} onClick={() => zoomBy(1.6)} aria-label="Zoom in" title="Zoom in (+)">
            <Icon d={IC.plus} />
          </button>
          <button
            type="button"
            class="rtree__btn"
            disabled={focus() === rootLimit() && atMin()}
            onClick={() => {
              const lim = rootLimit();
              if (lim) navigate(lim);
            }}
            aria-label="Whole tree"
            title="Whole tree (0)"
          >
            <Icon d={IC.home} />
          </button>
          <button
            type="button"
            class="rtree__btn"
            aria-pressed={expanded()}
            onClick={toggleExpanded}
            aria-label={expanded() ? "Leave full screen" : "Full screen"}
            title={expanded() ? "Leave full screen" : "Full screen"}
          >
            <Icon d={expanded() ? IC.collapse : IC.expand} />
          </button>
        </div>
      </div>

      <div class="rtree__body">
        <div class="rtree__sizer" style={{ "--rt-max": `${(props.maxSize ?? 860) / 16}rem` }}>
          <div class="rtree__frame" ref={frameEl}>
            <canvas
              ref={canvasEl}
              class="rtree__canvas"
              classList={{ "is-pointer": !!hover(), "is-zoomed": !atMin() }}
              style={{ "touch-action": atMin() ? "pan-y" : "none" }}
              role="application"
              aria-roledescription="zoomable tree"
              aria-label={`${props.label}. Arrow keys move between clades, Enter opens, Escape goes up, plus and minus zoom.`}
              tabIndex={0}
              onPointerMove={onPointerMove}
              onPointerLeave={onPointerLeave}
              onClick={onClick}
              onAuxClick={onAuxClick}
              onKeyDown={onKeyDown}
              onBlur={() => {
                if (!expanded()) {
                  setPinned(false);
                  setHover(null);
                }
              }}
            />
            <Show when={hint() && model() && atMin() && !coarse()}>
              <p class="rtree__hint" aria-hidden="true">
                Scroll to zoom · drag to move
              </p>
            </Show>
            <Show when={tip()}>
              {(tp) => {
                const n = () => tp().h.node;
                const sp = () => n().data.sp;
                return (
                  <div
                    class="rtree__tip chart__tooltip"
                    classList={{ "is-below": tp().below }}
                    style={{ left: `${tp().left}px`, top: `${tp().top}px` }}
                    aria-hidden="true"
                  >
                    <div class="rtree__tip-rank" style={{ "--c": nodeColorVar(n()) }}>
                      {n().children ? RANK_LABEL[n().data.rank] : "Species"}
                      <Show when={n().data.cls && n().depth > CLASS_DEPTH}> · {classLabel(n().data.cls ?? "")}</Show>
                    </div>
                    <div class="chart__tooltip-title">
                      <span class={isItalicRank(n().data.rank) ? "sci" : undefined}>{n().data.name}</span>
                    </div>
                    <Show
                      when={sp()}
                      fallback={
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
                      }
                    >
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
                    <div class="chart__tooltip-hint">{tipHint(n())}</div>
                  </div>
                );
              }}
            </Show>
            <div class="visually-hidden" aria-live="polite">{announce()}</div>
          </div>
          <Show when={coarse() && model()}>
            <p class="rtree__caption" aria-hidden="true">
              Pinch to zoom, drag to move, tap a group to zoom in
            </p>
          </Show>
        </div>

        <Show when={props.panel && focusInfo()}>
          {(fi) => (
            <aside class="rtree__panel" aria-label="Clade in view">
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
                          <a class="chip chip--soft" href={c.children ? taxonUrl(c.data.rank, c.data.slug) : speciesUrl(c.data.slug)}>
                            <span class="chip__dot" style={{ "--dot": nodeColorVar(c) }} />
                            <span class={isItalicRank(c.data.rank) ? "sci" : undefined}>{c.data.name}</span>
                            <Show when={c.children}>
                              <span class="chip__count">1</span>
                            </Show>
                          </a>
                        }
                      >
                        <button type="button" class="chip chip--soft" onClick={() => activateClade(c)}>
                          <span class="chip__dot" style={{ "--dot": nodeColorVar(c) }} />
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
            ? "Distance from the centre is time: rings mark millions of years ago, tips are the present (TimeTree dates on the Open Tree of Life topology). "
            : "Each ring is one rank. "}
          {coarse()
            ? "Tap a species to see it, and tap again to open its page."
            : "Scroll or use + and − to zoom, drag to move; select a group to zoom into it, a species to open it."}
        </p>
      </div>
    </div>
  );
}
