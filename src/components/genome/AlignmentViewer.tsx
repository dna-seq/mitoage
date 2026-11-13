/**
 * The alignment of one gene across the species of the build, on /genes/{gene}/: one row per
 * species in the order of the site's tree, the residues as coloured cells, a conservation bar above
 * each column and the maximum lifespan beside each row. Filter by class and order, sort by
 * lifespan, hide the columns that are mostly gaps, find a species.
 *
 * The rows are drawn on a canvas (2,300 species by several hundred columns), over a scroll area
 * that keeps the browser's own scrolling, by touch and by keyboard. The file is the gzipped FASTA
 * under /data/alignments/, fetched with the species list when the viewer scrolls into view.
 */
import { createEffect, createMemo, createSignal, For, onCleanup, onMount, Show } from "solid-js";
import {
  type AlignedRow,
  type Alignment,
  type AlignmentKind,
  type AlignmentSpeciesPayload,
  columnProfile,
  GAP,
  groupIndexByByte,
  groupsOf,
  maybeGunzipText,
  parseAlignment,
  residueName,
  shownColumns,
} from "~/lib/alignment";
import { classColor, classLabel } from "~/lib/classes";
import { fmtInt } from "~/lib/format";

export interface AlignmentViewerProps {
  /** Gene symbol as shown, e.g. "COX1". */
  symbol: string;
  kind: AlignmentKind;
  /** URL of the gzipped aligned FASTA. */
  fileUrl: string;
  /** URL of /genes/alignment-species.json. */
  speciesUrl: string;
  /** Base of the species pages, ending with "/". */
  speciesBase: string;
  /** Rows and columns of the file, from the manifest, for the text shown before it loads. */
  sequences: number;
  columns: number;
}

interface Meta {
  tree: number;
  common: string;
  cls: string;
  order: string;
  life: number;
}

interface Row extends AlignedRow {
  meta: Meta | null;
}

type Sort = "tree" | "life";
type Zoom = "letters" | "overview";

interface Palette {
  surface: string;
  sunken: string;
  text: string;
  muted: string;
  grid: string;
  bar: string;
  life: string;
  highlight: string;
  groups: string[];
  classes: Map<string, string>;
  mono: string;
  sans: string;
}

const HEAD_H = 46;
const BAR_H = 30;
const CELL = { letters: { w: 13, h: 18 }, overview: { w: 3, h: 3 } } as const;

const fmtLife = (y: number): string => (y >= 100 ? y.toFixed(0) : y >= 10 ? y.toFixed(1) : y.toFixed(2)).replace(/\.0+$/, "");

export default function AlignmentViewer(props: AlignmentViewerProps) {
  const [state, setState] = createSignal<"loading" | "ready" | "error">("loading");
  const [error, setError] = createSignal("");
  const [rows, setRows] = createSignal<Row[]>([]);
  const [columns, setColumns] = createSignal(0);
  const [cls, setCls] = createSignal("");
  const [order, setOrder] = createSignal("");
  const [sort, setSort] = createSignal<Sort>("tree");
  const [zoom, setZoom] = createSignal<Zoom>("letters");
  const [hideSparse, setHideSparse] = createSignal(true);
  const [query, setQuery] = createSignal("");
  const [searchNote, setSearchNote] = createSignal("");
  const [pinned, setPinned] = createSignal<{ slug: string; col: number | null } | null>(null);
  const [hover, setHover] = createSignal<{ row: number; col: number | null } | null>(null);
  // Compared by value: the effects that measure the scroll area also read it, and a new object
  // with the same numbers must not run them again.
  const [size, setSize] = createSignal({ w: 0, h: 0 }, { equals: (a, b) => a.w === b.w && a.h === b.h });
  const [scroll, setScroll] = createSignal({ x: 0, y: 0 }, { equals: (a, b) => a.x === b.x && a.y === b.y });
  const [pal, setPal] = createSignal<Palette | null>(null);

  let rootEl: HTMLDivElement | undefined;
  let scrollEl: HTMLDivElement | undefined;
  let canvasEl: HTMLCanvasElement | undefined;

  // ---------------------------------------------------------------- data

  onMount(() => {
    const stop = new AbortController();
    onCleanup(() => stop.abort());
    const get = async (url: string): Promise<Response> => {
      const res = await fetch(url, { signal: stop.signal });
      if (!res.ok) throw new Error(`${url} answered ${res.status}`);
      return res;
    };
    (async () => {
      if (typeof DecompressionStream === "undefined") {
        throw new Error("this browser cannot unpack gzip files; the downloads below hold the alignment");
      }
      const [fileRes, speciesRes] = await Promise.all([get(props.fileUrl), get(props.speciesUrl)]);
      const alignment: Alignment = parseAlignment(await maybeGunzipText(await fileRes.arrayBuffer()));
      const payload = (await speciesRes.json()) as AlignmentSpeciesPayload;
      const meta = new Map<string, Meta>();
      payload.rows.forEach(([slug, common, c, o, life], tree) => {
        meta.set(slug, { tree, common, cls: payload.classes[c] ?? "", order: payload.orders[o] ?? "", life });
      });
      setColumns(alignment.columns);
      setRows(alignment.rows.map((r) => ({ ...r, meta: meta.get(r.slug) ?? null })));
      setState("ready");
    })().catch((e: unknown) => {
      if (stop.signal.aborted) return;
      setError(e instanceof Error ? e.message : String(e));
      setState("error");
    });
  });

  const classOptions = createMemo(() => {
    const counts = new Map<string, number>();
    for (const r of rows()) if (r.meta) counts.set(r.meta.cls, (counts.get(r.meta.cls) ?? 0) + 1);
    return [...counts].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
  });
  const orderOptions = createMemo(() => {
    const c = cls();
    if (!c) return [];
    const counts = new Map<string, number>();
    for (const r of rows()) if (r.meta?.cls === c) counts.set(r.meta.order, (counts.get(r.meta.order) ?? 0) + 1);
    return [...counts].sort((a, b) => a[0].localeCompare(b[0]));
  });
  const unknownRows = createMemo(() => rows().filter((r) => !r.meta).length);

  const shown = createMemo(() => {
    const c = cls();
    const o = order();
    const list = rows().filter((r) => (!c || r.meta?.cls === c) && (!o || r.meta?.order === o));
    const tree = (r: Row) => r.meta?.tree ?? Number.MAX_SAFE_INTEGER;
    if (sort() === "life") {
      list.sort((a, b) => (b.meta?.life ?? -1) - (a.meta?.life ?? -1) || tree(a) - tree(b) || a.slug.localeCompare(b.slug));
    } else list.sort((a, b) => tree(a) - tree(b) || a.slug.localeCompare(b.slug));
    return list;
  });
  const profile = createMemo(() => columnProfile(shown(), columns()));
  const cols = createMemo(() => shownColumns(profile().occupancy, hideSparse()));
  const lifeRange = createMemo(() => {
    let lo = Number.POSITIVE_INFINITY;
    let hi = 0;
    for (const r of rows()) {
      const l = r.meta?.life;
      if (l && l > 0) {
        if (l < lo) lo = l;
        if (l > hi) hi = l;
      }
    }
    return hi > 0 ? { lo: Math.log(lo), hi: Math.log(hi) } : null;
  });

  // ---------------------------------------------------------------- geometry

  const cell = () => CELL[zoom()];
  const gutter = () => (zoom() === "overview" ? 64 : size().w < 560 ? 138 : 248);
  const total = createMemo(() => ({ w: gutter() + cols().length * cell().w, h: HEAD_H + shown().length * cell().h }), undefined, {
    equals: (a, b) => a.w === b.w && a.h === b.h,
  });

  // ---------------------------------------------------------------- theme

  const readPalette = () => {
    if (!rootEl) return;
    const probe = document.createElement("span");
    probe.setAttribute("aria-hidden", "true");
    probe.style.cssText = "position:absolute;width:0;height:0;overflow:hidden;visibility:hidden;pointer-events:none";
    rootEl.appendChild(probe);
    const res = (v: string): string => {
      probe.style.color = "";
      probe.style.color = v;
      return getComputedStyle(probe).color;
    };
    const font = (v: string): string => {
      probe.style.fontFamily = v;
      return getComputedStyle(probe).fontFamily || "monospace";
    };
    const classes = new Map<string, string>();
    for (const [c] of classOptions()) classes.set(c, res(classColor(c)));
    setPal({
      surface: res("var(--color-surface)"),
      sunken: res("var(--color-surface-sunken)"),
      text: res("var(--color-text)"),
      muted: res("var(--color-text-muted)"),
      grid: res("var(--chart-grid)"),
      bar: res("var(--tone-green-bar)"),
      life: res("var(--heat-mid)"),
      highlight: res("var(--chart-highlight)"),
      groups: groupsOf(props.kind).map((g) => res(g.color)),
      classes,
      mono: font("var(--font-mono)"),
      sans: font("var(--font-sans)"),
    });
    probe.remove();
  };

  onMount(() => {
    const mo = new MutationObserver(readPalette);
    mo.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    mq.addEventListener("change", readPalette);
    onCleanup(() => {
      mo.disconnect();
      mq.removeEventListener("change", readPalette);
    });
  });
  createEffect(() => {
    if (state() === "ready") {
      classOptions();
      readPalette();
    }
  });

  // ---------------------------------------------------------------- size and scroll

  createEffect(() => {
    if (state() !== "ready" || !scrollEl) return;
    const el = scrollEl;
    const measure = () => setSize({ w: el.clientWidth, h: el.clientHeight });
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    measure();
    onCleanup(() => ro.disconnect());
  });
  // A new set of rows or columns changes the scroll area: measure again, and keep the scroll inside it.
  createEffect(() => {
    total();
    if (!scrollEl) return;
    const el = scrollEl;
    queueMicrotask(() => {
      setSize({ w: el.clientWidth, h: el.clientHeight });
      setScroll({ x: el.scrollLeft, y: el.scrollTop });
    });
  });

  // ---------------------------------------------------------------- drawing

  const groupOf = groupIndexByByte(props.kind);

  const draw = () => {
    const p = pal();
    const { w, h } = size();
    if (!canvasEl || !p || !w || !h) return;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    if (canvasEl.width !== Math.round(w * dpr) || canvasEl.height !== Math.round(h * dpr)) {
      canvasEl.width = Math.round(w * dpr);
      canvasEl.height = Math.round(h * dpr);
    }
    const ctx = canvasEl.getContext("2d");
    if (!ctx) return;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.fillStyle = p.surface;
    ctx.fillRect(0, 0, w, h);

    const list = shown();
    const cc = cols();
    const prof = profile();
    const { w: cw, h: ch } = cell();
    const g = gutter();
    const { x: sx, y: sy } = scroll();
    const letters = zoom() === "letters";
    const c0 = Math.max(0, Math.floor(sx / cw));
    const c1 = Math.min(cc.length, Math.ceil((sx + w - g) / cw));
    const r0 = Math.max(0, Math.floor(sy / ch));
    const r1 = Math.min(list.length, Math.ceil((sy + h - HEAD_H) / ch));
    const pin = pinned();
    const hov = hover();

    // Cells.
    ctx.save();
    ctx.beginPath();
    ctx.rect(g, HEAD_H, w - g, h - HEAD_H);
    ctx.clip();
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.font = `600 12px ${p.mono}`;
    for (let r = r0; r < r1; r++) {
      const seq = list[r]!.seq;
      const y = HEAD_H + r * ch - sy;
      for (let c = c0; c < c1; c++) {
        const b = seq[cc[c]!]!;
        if (b === GAP) continue;
        const x = g + c * cw - sx;
        const gi = groupOf[b & 127]!;
        if (gi >= 0) {
          ctx.globalAlpha = letters ? 0.42 : 1;
          ctx.fillStyle = p.groups[gi]!;
          ctx.fillRect(x, y, cw, ch);
          ctx.globalAlpha = 1;
        }
        if (letters) {
          ctx.fillStyle = p.text;
          ctx.fillText(String.fromCharCode(b), x + cw / 2, y + ch / 2 + 1);
        }
      }
    }
    // The column under the pointer or of the pinned cell.
    const markCol = hov?.col ?? null;
    if (markCol !== null && markCol >= c0 && markCol < c1) {
      ctx.globalAlpha = 0.14;
      ctx.fillStyle = p.text;
      ctx.fillRect(g + markCol * cw - sx, HEAD_H, Math.max(cw, 1), h - HEAD_H);
      ctx.globalAlpha = 1;
    }
    ctx.restore();

    // Header: conservation bars and column numbers.
    ctx.fillStyle = p.sunken;
    ctx.fillRect(0, 0, w, HEAD_H);
    ctx.save();
    ctx.beginPath();
    ctx.rect(g, 0, w - g, HEAD_H);
    ctx.clip();
    ctx.fillStyle = p.bar;
    for (let c = c0; c < c1; c++) {
      const v = prof.conservation[cc[c]!]!;
      const bh = Math.max(1, v * (BAR_H - 4));
      ctx.fillRect(g + c * cw - sx, BAR_H - bh, Math.max(cw - (letters ? 2 : 0), 1), bh);
    }
    ctx.fillStyle = p.muted;
    ctx.font = `700 11px ${p.sans}`;
    ctx.textAlign = "center";
    ctx.textBaseline = "alphabetic";
    const step = letters ? 10 : 100;
    for (let c = c0; c < c1; c++) {
      const n = cc[c]! + 1;
      if (n % step) continue;
      ctx.fillText(String(n), g + c * cw - sx + cw / 2, HEAD_H - 4);
    }
    ctx.restore();

    // Gutter: class stripe, species name, lifespan.
    ctx.fillStyle = p.surface;
    ctx.fillRect(0, HEAD_H, g, h - HEAD_H);
    ctx.save();
    ctx.beginPath();
    ctx.rect(0, HEAD_H, g, h - HEAD_H);
    ctx.clip();
    const lr = lifeRange();
    const lifeW = letters ? 58 : g - 12;
    const lifeX = g - lifeW - 4;
    for (let r = r0; r < r1; r++) {
      const row = list[r]!;
      const y = HEAD_H + r * ch - sy;
      ctx.fillStyle = (row.meta && p.classes.get(row.meta.cls)) || p.muted;
      ctx.fillRect(0, y, 5, ch);
      const life = row.meta?.life;
      if (lr && life && life > 0) {
        const f = lr.hi > lr.lo ? (Math.log(life) - lr.lo) / (lr.hi - lr.lo) : 1;
        ctx.globalAlpha = letters ? 0.7 : 1;
        ctx.fillStyle = p.life;
        ctx.fillRect(lifeX, y + (letters ? 2 : 0), Math.max(2, f * lifeW), letters ? ch - 4 : ch);
        ctx.globalAlpha = 1;
      }
      if (letters) {
        ctx.textBaseline = "middle";
        ctx.fillStyle = p.text;
        ctx.font = `700 11px ${p.sans}`;
        ctx.textAlign = "right";
        ctx.fillText(life && life > 0 ? `${fmtLife(life)} y` : "?", g - 8, y + ch / 2 + 1);
        ctx.save();
        ctx.beginPath();
        ctx.rect(9, y, lifeX - 13, ch);
        ctx.clip();
        ctx.textAlign = "left";
        ctx.font = `italic 600 12px ${p.sans}`;
        ctx.fillText(row.name || row.slug, 10, y + ch / 2 + 1);
        ctx.restore();
      }
    }
    ctx.restore();

    // The pinned row and the row under the pointer, across gutter and cells.
    const outline = (r: number, color: string, width: number) => {
      if (r < r0 || r >= r1) return;
      const y = HEAD_H + r * ch - sy;
      if (y + ch <= HEAD_H) return;
      ctx.strokeStyle = color;
      ctx.lineWidth = width;
      ctx.strokeRect(0.5, Math.max(y, HEAD_H) - 0.5, w - 1, Math.max(ch, 3) + 1);
    };
    if (hov) outline(hov.row, p.muted, 1);
    if (pin) {
      const r = list.findIndex((x) => x.slug === pin.slug);
      if (r >= 0) outline(r, p.highlight, 2);
    }

    // Corner and rules.
    ctx.fillStyle = p.sunken;
    ctx.fillRect(0, 0, g, HEAD_H);
    ctx.fillStyle = p.muted;
    ctx.font = `700 11px ${p.sans}`;
    ctx.textBaseline = "alphabetic";
    if (letters) {
      ctx.textAlign = "left";
      ctx.fillText("Conservation", 10, BAR_H - 10);
      ctx.fillText("Species", 10, HEAD_H - 4);
      ctx.textAlign = "right";
      ctx.fillText("Lifespan", g - 8, HEAD_H - 4);
    } else {
      ctx.textAlign = "left";
      ctx.fillText("Lifespan", 8, HEAD_H - 4);
    }
    ctx.fillStyle = p.grid;
    ctx.fillRect(g - 1, 0, 1, h);
    ctx.fillRect(0, HEAD_H - 1, w, 1);
  };

  let frame = 0;
  createEffect(() => {
    // Everything the drawing reads.
    pal();
    size();
    scroll();
    shown();
    cols();
    zoom();
    pinned();
    hover();
    cancelAnimationFrame(frame);
    frame = requestAnimationFrame(draw);
  });
  // Registered in the browser only: the server renders the component too, and has no animation frames.
  onMount(() => onCleanup(() => cancelAnimationFrame(frame)));

  // ---------------------------------------------------------------- pointer, search

  const cellAt = (e: MouseEvent): { row: number; col: number | null } | null => {
    if (!scrollEl) return null;
    const rect = scrollEl.getBoundingClientRect();
    const px = e.clientX - rect.left;
    const py = e.clientY - rect.top;
    if (px > size().w || py > size().h || py < HEAD_H) return null;
    const row = Math.floor((py - HEAD_H + scrollEl.scrollTop) / cell().h);
    if (row < 0 || row >= shown().length) return null;
    const col = px < gutter() ? null : Math.floor((px - gutter() + scrollEl.scrollLeft) / cell().w);
    return { row, col: col !== null && col >= 0 && col < cols().length ? col : null };
  };

  const onMove = (e: MouseEvent) => setHover(cellAt(e));
  const onClick = (e: MouseEvent) => {
    const at = cellAt(e);
    if (!at) return;
    const row = shown()[at.row]!;
    const cur = pinned();
    setPinned(cur && cur.slug === row.slug && cur.col === at.col ? null : { slug: row.slug, col: at.col });
  };

  const find = (e: Event) => {
    e.preventDefault();
    const q = query().trim().toLowerCase();
    if (!q) return;
    const list = shown();
    const hit = (r: Row) =>
      r.name.toLowerCase().includes(q) || r.slug.includes(q.replace(/\s+/g, "-")) || (r.meta?.common.toLowerCase().includes(q) ?? false);
    const exact = list.findIndex((r) => r.name.toLowerCase() === q || r.meta?.common.toLowerCase() === q);
    const i = exact >= 0 ? exact : list.findIndex(hit);
    if (i < 0) {
      setSearchNote(`No species among the ${fmtInt(list.length)} rows on show matches "${query().trim()}".`);
      return;
    }
    const n = list.filter(hit).length;
    setSearchNote(n > 1 ? `${fmtInt(n)} rows match; the first is marked.` : "");
    setPinned({ slug: list[i]!.slug, col: null });
    scrollEl?.scrollTo({ top: Math.max(0, i * cell().h - (size().h - HEAD_H) / 2), behavior: "auto" });
  };

  // ---------------------------------------------------------------- status line

  const told = createMemo(() => {
    const list = shown();
    const hov = hover();
    const pin = pinned();
    let row: Row | undefined;
    let col: number | null = null;
    if (hov) {
      row = list[hov.row];
      col = hov.col;
    } else if (pin) {
      row = list.find((r) => r.slug === pin.slug);
      col = pin.col;
    }
    if (!row) return null;
    const source = col !== null ? cols()[col] : undefined;
    return {
      row,
      column: source !== undefined ? source + 1 : null,
      residue: source !== undefined ? residueName(row.seq[source]!, props.kind) : null,
      conservation: source !== undefined ? profile().conservation[source]! : null,
      consensus: source !== undefined ? profile().consensus[source]! : 0,
    };
  });

  const unit = () => (props.kind === "protein" ? "amino-acid" : "nucleotide");

  return (
    <div class="aln" ref={rootEl}>
      <Show when={state() === "loading"}>
        <p class="aln__hold" role="status">
          Loading the alignment of {props.symbol}: {fmtInt(props.sequences)} species, {fmtInt(props.columns)} columns.
        </p>
      </Show>
      <Show when={state() === "error"}>
        <p class="aln__hold aln__hold--error" role="alert">
          The alignment could not be shown: {error()}. The files below hold it.
        </p>
      </Show>
      <Show when={state() === "ready"}>
        <div class="aln__controls">
          <label class="field">
            Class
            <select
              class="select"
              value={cls()}
              onChange={(e) => {
                setCls(e.currentTarget.value);
                setOrder("");
                setHover(null);
              }}
            >
              <option value="">All classes ({fmtInt(rows().length)})</option>
              <For each={classOptions()}>
                {([c, n]) => (
                  <option value={c}>
                    {classLabel(c) === c ? c : `${classLabel(c)}, ${c}`} ({fmtInt(n)})
                  </option>
                )}
              </For>
            </select>
          </label>
          <label class="field">
            Order
            <select
              class="select"
              value={order()}
              disabled={!cls()}
              onChange={(e) => {
                setOrder(e.currentTarget.value);
                setHover(null);
              }}
            >
              <option value="">{cls() ? "All orders" : "Pick a class first"}</option>
              <For each={orderOptions()}>
                {([o, n]) => (
                  <option value={o}>
                    {o} ({fmtInt(n)})
                  </option>
                )}
              </For>
            </select>
          </label>
          <div class="field">
            <span id={`aln-sort-${props.symbol}`}>Rows</span>
            <div class="seg" role="group" aria-labelledby={`aln-sort-${props.symbol}`}>
              <button type="button" class="seg__btn" aria-pressed={sort() === "tree"} onClick={() => setSort("tree")}>
                Tree order
              </button>
              <button type="button" class="seg__btn" aria-pressed={sort() === "life"} onClick={() => setSort("life")}>
                Longest-lived first
              </button>
            </div>
          </div>
          <div class="field">
            <span id={`aln-zoom-${props.symbol}`}>View</span>
            <div class="seg" role="group" aria-labelledby={`aln-zoom-${props.symbol}`}>
              <button type="button" class="seg__btn" aria-pressed={zoom() === "letters"} onClick={() => setZoom("letters")}>
                Letters
              </button>
              <button type="button" class="seg__btn" aria-pressed={zoom() === "overview"} onClick={() => setZoom("overview")}>
                Overview
              </button>
            </div>
          </div>
          <form class="field aln__find" onSubmit={find}>
            <label for={`aln-find-${props.symbol}`}>Find a species</label>
            <span class="aln__find-row">
              <input
                id={`aln-find-${props.symbol}`}
                class="input"
                type="search"
                placeholder="Name, e.g. Homo sapiens"
                value={query()}
                onInput={(e) => {
                  setQuery(e.currentTarget.value);
                  setSearchNote("");
                }}
              />
              <button type="submit" class="btn btn--soft btn--sm">
                Find
              </button>
            </span>
          </form>
        </div>
        <label class="aln__check">
          <input type="checkbox" checked={hideSparse()} onChange={(e) => setHideSparse(e.currentTarget.checked)} />
          Hide columns where more than half of the rows on show have a gap
        </label>
        <p class="aln__count" role="status">
          {fmtInt(shown().length)} of {fmtInt(rows().length)} species, {fmtInt(cols().length)} of {fmtInt(columns())} columns.
          <Show when={searchNote()}> {searchNote()}</Show>
        </p>

        <div class="aln__frame">
          <div
            class="aln__scroll"
            ref={scrollEl}
            tabindex="0"
            role="group"
            aria-label={`${unit()} alignment of ${props.symbol}: ${shown().length} species by ${cols().length} columns. Scroll to move through it; the files under the viewer hold the same rows.`}
            onScroll={(e) => setScroll({ x: e.currentTarget.scrollLeft, y: e.currentTarget.scrollTop })}
            onMouseMove={onMove}
            onMouseLeave={() => setHover(null)}
            onClick={onClick}
          >
            <div class="aln__spacer" style={{ width: `${total().w}px`, height: `${total().h}px` }} />
          </div>
          <canvas class="aln__canvas" ref={canvasEl} style={{ width: `${size().w}px`, height: `${size().h}px` }} aria-hidden="true" />
        </div>

        <p class="aln__told" aria-live="off">
          <Show
            when={told()}
            fallback={
              <span class="aln__muted">Point at a cell, or select one, to read the species, the column and the residue.</span>
            }
          >
            {(t) => (
              <>
                <a href={`${props.speciesBase}${t().row.slug}/`}>
                  <i>{t().row.name || t().row.slug}</i>
                </a>
                <Show when={t().row.meta?.common}> ({t().row.meta?.common})</Show>
                <Show when={t().row.meta}>
                  {(m) => (
                    <>
                      {" · "}
                      {m().order}
                      {" · "}maximum lifespan {fmtLife(m().life)} years
                    </>
                  )}
                </Show>
                <Show when={t().column !== null}>
                  {" · "}column {t().column}: {t().residue}
                  {" · "}most common {String.fromCharCode(t().consensus)} in {Math.round((t().conservation ?? 0) * 100)}% of the rows on
                  show with a residue
                </Show>
              </>
            )}
          </Show>
        </p>

        <ul class="aln__legend" role="list" aria-label="Colours">
          <For each={groupsOf(props.kind)}>
            {(g) => (
              <li>
                <span class="aln__swatch" style={{ background: g.color }} aria-hidden="true" />
                {props.kind === "protein" ? `${g.label} (${g.letters.split("").join(" ")})` : g.label}
              </li>
            )}
          </For>
          <li>
            <span class="aln__swatch" style={{ background: "var(--heat-mid)" }} aria-hidden="true" />
            Maximum lifespan, log scale
          </li>
        </ul>
        <p class="aln__note">
          The bar above a column is the share of the rows on show that carry its most common residue, among the rows with a
          residue there. Column numbers are those of the alignment file. The stripe at the left of a row is the class.
          <Show when={unknownRows() > 0}> {fmtInt(unknownRows())} rows have no species record in this build and stand last.</Show>
        </p>
      </Show>
    </div>
  );
}
