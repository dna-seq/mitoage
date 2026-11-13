/**
 * Sortable, filterable, paginated data table island. On phones (< 40rem) rows turn into
 * stacked cards and a sort <select> replaces the header buttons.
 *
 * Column specs and rows are plain JSON, so Astro pages can pass them as props:
 *
 * <DataTable client:visible
 *   caption="Species"
 *   columns={[
 *     { key: "name", label: "Species", kind: "sci", hrefKey: "href", subKey: "common", primary: true },
 *     { key: "lifespan", label: "Max lifespan", format: "lifespan" },
 *   ]}
 *   rows={[{ name: "Homo sapiens", common: "Human", href: "/species/homo-sapiens/", lifespan: 122.5 }]}
 *   initialSort={{ key: "lifespan", dir: "desc" }}
 *   pageSize={50} search={{ keys: ["name", "common"], placeholder: "Filter species" }}
 *   facets={[{ key: "class", label: "Class" }]} urlParam="q" />
 */
import { createEffect, createMemo, createSignal, For, onMount, Show } from "solid-js";
import { basePercents } from "~/lib/composition";
import { downloadText, toCsv } from "~/lib/csv";
import { fmtP, fmtR } from "~/lib/explore/format";
import {
  fmtBp,
  fmtDays,
  fmtFixed,
  fmtInt,
  fmtKelvinAsCelsius,
  fmtLifespan,
  fmtMass,
  fmtNum,
  fmtPct,
  fmtSigned,
} from "~/lib/format";
import { ICONS } from "./icons";

export type Cell = string | number | null | number[];
export type Row = Record<string, Cell>;

export type ColumnFormat =
  | "text"
  | "int"
  | "dec1"
  | "dec2"
  | "dec3"
  | "pct1"
  | "pct2"
  | "signed2"
  | "signed3"
  | "r"
  | "p"
  | "lifespan"
  | "mass"
  | "days"
  | "celsius"
  | "bp";

export interface Column {
  key: string;
  label: string;
  /** text (default), sci (italic name), number, composition ([a,c,g,t] array as a mini bar). */
  kind?: "text" | "sci" | "number" | "composition";
  format?: ColumnFormat;
  /** Row key holding a ColumnFormat for this cell, overriding `format` (rows with different units). */
  formatKey?: string;
  /** Row key holding a URL; the cell becomes a link. */
  hrefKey?: string;
  /** Row key shown as a second, smaller line. */
  subKey?: string;
  /** Row key holding a URL for the second line (the sub line becomes the link). */
  subHrefKey?: string;
  /** Show the second line as a scientific name (italic). */
  subSci?: boolean;
  /** CSV header for the second line; when set, the CSV export gets an extra column for it. */
  csvSub?: string;
  sortable?: boolean;
  /** Title cell of a stacked card on phones. */
  primary?: boolean;
  /** Hide on phones. */
  hideOnMobile?: boolean;
  /** Abbreviation tooltip for the header. */
  title?: string;
  /** Not shown in the table, only exported to CSV. */
  csvOnly?: boolean;
}

export interface DataTableProps {
  columns: Column[];
  rows: Row[];
  caption: string;
  /** Show the caption visibly (otherwise screen-reader only). */
  showCaption?: boolean;
  initialSort?: { key: string; dir: "asc" | "desc" };
  /** 0 = no pagination. */
  pageSize?: number;
  search?: { keys: string[]; placeholder?: string };
  facets?: { key: string; label: string; allLabel?: string }[];
  /** Read the initial search text from this URL query parameter and keep it in sync. */
  urlParam?: string;
  /** Stack rows as cards on phones (default true). */
  stackOnMobile?: boolean;
  /** Noun for the status line, e.g. ["species", "species"]. */
  noun?: [string, string];
  /** Show a "Download CSV" button that exports the filtered, sorted rows (every page). */
  csv?: { filename: string; label?: string };
}

const isNumCol = (c: Column) =>
  c.kind === "number" || c.formatKey !== undefined || (c.format !== undefined && c.format !== "text");

const formatCell = (c: Column, v: Cell, row?: Row): string => {
  if (v === null || v === undefined) return "–";
  if (Array.isArray(v)) return v.join(", ");
  if (typeof v === "string") return v;
  const rowFormat = c.formatKey && row ? row[c.formatKey] : null;
  const format = typeof rowFormat === "string" ? (rowFormat as ColumnFormat) : c.format;
  switch (format) {
    case "int":
      return fmtInt(v);
    case "dec1":
      return fmtFixed(v, 1);
    case "dec2":
      return fmtFixed(v, 2);
    case "dec3":
      return fmtFixed(v, 3);
    case "pct1":
      return fmtPct(v, 1);
    case "pct2":
      return fmtPct(v, 2);
    case "signed2":
      return fmtSigned(v, 2);
    case "signed3":
      return fmtSigned(v, 3);
    case "r":
      return fmtR(v, 2);
    case "p":
      return fmtP(v);
    case "lifespan":
      return fmtLifespan(v);
    case "mass":
      return fmtMass(v);
    case "days":
      return fmtDays(v);
    case "celsius":
      return fmtKelvinAsCelsius(v);
    case "bp":
      return fmtBp(v);
    default:
      return fmtNum(v, 3);
  }
};

const norm = (s: string) =>
  s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase();

const Comp = (p: { v: Cell }) => {
  const arr = Array.isArray(p.v) ? p.v : [];
  const pct = basePercents({ a: arr[0] ?? 0, c: arr[1] ?? 0, g: arr[2] ?? 0, t: arr[3] ?? 0 });
  const segs = [
    ["a", "A"],
    ["t", "T"],
    ["g", "G"],
    ["c", "C"],
  ] as const;
  return (
    <div
      class="comp-bar comp-bar--xs"
      role="img"
      aria-label={segs.map(([k, l]) => `${l} ${pct[k].toFixed(1)}%`).join(", ")}
    >
      <For each={segs}>
        {([k]) => <span class={`comp-bar__seg nt-${k}`} style={{ width: `${pct[k].toFixed(2)}%` }} />}
      </For>
    </div>
  );
};

const CsvButton = (p: { label?: string | undefined; onClick: () => void }) => (
  <button type="button" class="btn btn--soft btn--sm dtable__csv" onClick={() => p.onClick()}>
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      stroke-width="2.6"
      stroke-linecap="round"
      stroke-linejoin="round"
      aria-hidden="true"
      innerHTML={ICONS.download}
    />
    {p.label ?? "Download CSV"}
  </button>
);

export default function DataTable(props: DataTableProps) {
  const [sortKey, setSortKey] = createSignal(props.initialSort?.key ?? "");
  const [sortDir, setSortDir] = createSignal<"asc" | "desc">(props.initialSort?.dir ?? "asc");
  const [text, setText] = createSignal("");
  const [facetVals, setFacetVals] = createSignal<Record<string, string>>({});
  const [page, setPage] = createSignal(0);
  let scrollEl: HTMLDivElement | undefined;

  onMount(() => {
    if (!props.urlParam) return;
    const v = new URLSearchParams(window.location.search).get(props.urlParam);
    if (v) setText(v);
  });

  createEffect(() => {
    if (!props.urlParam || typeof window === "undefined") return;
    const t = text();
    const url = new URL(window.location.href);
    if (t) url.searchParams.set(props.urlParam, t);
    else url.searchParams.delete(props.urlParam);
    window.history.replaceState(null, "", url);
  });

  const facetOptions = createMemo(() =>
    (props.facets ?? []).map((f) => {
      const counts = new Map<string, number>();
      for (const r of props.rows) {
        const v = r[f.key];
        if (typeof v === "string" && v) counts.set(v, (counts.get(v) ?? 0) + 1);
      }
      return { ...f, options: [...counts.entries()].sort((a, b) => b[1] - a[1]) };
    }),
  );

  const filtered = createMemo(() => {
    const q = norm(text().trim());
    const fv = facetVals();
    const keys = props.search?.keys ?? [];
    return props.rows.filter((r) => {
      for (const [k, v] of Object.entries(fv)) if (v && r[k] !== v) return false;
      if (!q) return true;
      return keys.some((k) => {
        const v = r[k];
        return typeof v === "string" && norm(v).includes(q);
      });
    });
  });

  const sorted = createMemo(() => {
    const key = sortKey();
    if (!key) return filtered();
    const dir = sortDir() === "asc" ? 1 : -1;
    return [...filtered()].sort((a, b) => {
      const va = a[key];
      const vb = b[key];
      if (va === null || va === undefined) return vb === null || vb === undefined ? 0 : 1;
      if (vb === null || vb === undefined) return -1;
      if (typeof va === "number" && typeof vb === "number") return (va - vb) * dir;
      return String(va).localeCompare(String(vb)) * dir;
    });
  });

  const size = () => props.pageSize ?? 0;
  const pages = createMemo(() => (size() > 0 ? Math.max(1, Math.ceil(sorted().length / size())) : 1));
  const visible = createMemo(() => {
    if (size() <= 0) return sorted();
    const p = Math.min(page(), pages() - 1);
    return sorted().slice(p * size(), (p + 1) * size());
  });

  createEffect(() => {
    // Back to the first page whenever the filter or sort changes.
    text();
    facetVals();
    sortKey();
    sortDir();
    setPage(0);
  });

  const toggleSort = (c: Column) => {
    if (sortKey() === c.key) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else {
      setSortKey(c.key);
      setSortDir(isNumCol(c) ? "desc" : "asc");
    }
  };

  const sortable = (c: Column) => c.sortable !== false && c.kind !== "composition";
  const shown = createMemo(() => props.columns.filter((c) => !c.csvOnly));

  const exportCsv = () => {
    const csv = props.csv;
    if (!csv) return;
    const cols = props.columns.filter((c) => c.kind !== "composition");
    const header: string[] = [];
    for (const c of cols) {
      header.push(c.label);
      if (c.subKey && c.csvSub) header.push(c.csvSub);
    }
    const body = sorted().map((r) => {
      const out: (string | number | null)[] = [];
      for (const c of cols) {
        const v = r[c.key];
        out.push(Array.isArray(v) ? v.join(" ") : (v ?? null));
        if (c.subKey && c.csvSub) {
          const sv = r[c.subKey];
          out.push(Array.isArray(sv) ? sv.join(" ") : (sv ?? null));
        }
      }
      return out;
    });
    downloadText(csv.filename, toCsv(header, body), "text/csv");
  };
  const noun = (n: number) => (n === 1 ? (props.noun?.[0] ?? "row") : (props.noun?.[1] ?? "rows"));
  const gotoPage = (p: number) => {
    setPage(p);
    scrollEl?.scrollIntoView({ block: "nearest", behavior: "smooth" });
  };

  return (
    <div class={`dtable${props.stackOnMobile === false ? "" : " dtable--stack"}`}>
      <Show when={props.search || props.facets?.length}>
        <div class="dtable__toolbar">
          <Show when={props.search}>
            <label class="dtable__search">
              <span class="visually-hidden">{props.search?.placeholder ?? "Filter"}</span>
              <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                stroke-width="2.6"
                stroke-linecap="round"
                aria-hidden="true"
                innerHTML={ICONS.search}
              />
              <input
                class="input"
                type="search"
                placeholder={props.search?.placeholder ?? "Filter"}
                value={text()}
                onInput={(e) => setText(e.currentTarget.value)}
              />
            </label>
          </Show>
          <For each={facetOptions()}>
            {(f) => (
              <label class="field">
                {f.label}
                <select
                  class="select"
                  value={facetVals()[f.key] ?? ""}
                  onChange={(e) => {
                    const v = e.currentTarget.value;
                    setFacetVals((cur) => ({ ...cur, [f.key]: v }));
                  }}
                >
                  <option value="">{f.allLabel ?? "All"}</option>
                  <For each={f.options}>
                    {([v, n]) => (
                      <option value={v} selected={facetVals()[f.key] === v}>
                        {v} ({n})
                      </option>
                    )}
                  </For>
                </select>
              </label>
            )}
          </For>
          <Show when={props.csv}>
            <CsvButton label={props.csv?.label} onClick={exportCsv} />
          </Show>
          <label class="field dtable__mobile-sort">
            Sort by
            <select
              class="select"
              value={`${sortKey()}:${sortDir()}`}
              onChange={(e) => {
                const [k, d] = e.currentTarget.value.split(":");
                setSortKey(k ?? "");
                setSortDir(d === "desc" ? "desc" : "asc");
              }}
            >
              <For each={shown().filter(sortable)}>
                {(c) => (
                  <>
                    <option
                      value={`${c.key}:${isNumCol(c) ? "desc" : "asc"}`}
                      selected={`${sortKey()}:${sortDir()}` === `${c.key}:${isNumCol(c) ? "desc" : "asc"}`}
                    >
                      {c.label} {isNumCol(c) ? "(high to low)" : "(A to Z)"}
                    </option>
                    <option
                      value={`${c.key}:${isNumCol(c) ? "asc" : "desc"}`}
                      selected={`${sortKey()}:${sortDir()}` === `${c.key}:${isNumCol(c) ? "asc" : "desc"}`}
                    >
                      {c.label} {isNumCol(c) ? "(low to high)" : "(Z to A)"}
                    </option>
                  </>
                )}
              </For>
            </select>
          </label>
        </div>
      </Show>
      <Show when={props.search || props.facets?.length}>
        <p class="dtable__status" aria-live="polite">
          {sorted().length === props.rows.length
            ? `${props.rows.length.toLocaleString("en-US")} ${noun(props.rows.length)}`
            : `${sorted().length.toLocaleString("en-US")} of ${props.rows.length.toLocaleString("en-US")} ${noun(props.rows.length)}`}
        </p>
      </Show>
      <div class="dtable__scroll" ref={scrollEl} tabIndex={0} role="region" aria-label={props.caption}>
        <table>
          <caption class={props.showCaption ? "card__title" : "visually-hidden"}>{props.caption}</caption>
          <thead>
            <tr>
              <For each={shown()}>
                {(c) => (
                  <th
                    scope="col"
                    class={isNumCol(c) ? "is-num" : undefined}
                    aria-sort={
                      sortKey() === c.key ? (sortDir() === "asc" ? "ascending" : "descending") : undefined
                    }
                  >
                    <Show
                      when={sortable(c)}
                      fallback={<span title={c.title}>{c.label}</span>}
                    >
                      <button
                        type="button"
                        class="dtable__sort"
                        title={c.title}
                        data-dir={sortKey() === c.key ? sortDir() : undefined}
                        onClick={() => toggleSort(c)}
                      >
                        {c.label}
                        <svg
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          stroke-width="2.6"
                          stroke-linecap="round"
                          stroke-linejoin="round"
                          aria-hidden="true"
                          innerHTML={
                            sortKey() === c.key ? (sortDir() === "asc" ? ICONS.sortAsc : ICONS.sortDesc) : ICONS.sort
                          }
                        />
                      </button>
                    </Show>
                  </th>
                )}
              </For>
            </tr>
          </thead>
          <tbody>
            <For each={visible()}>
              {(r) => (
                <tr>
                  <For each={shown()}>
                    {(c) => {
                      const v = r[c.key] ?? null;
                      const href = c.hrefKey ? r[c.hrefKey] : null;
                      const sub = c.subKey ? r[c.subKey] : null;
                      const cls = [
                        isNumCol(c) ? "is-num" : "",
                        c.primary ? "is-primary dtable__primary" : "",
                        c.kind === "composition" ? "is-wide dtable__comp" : "",
                        c.hideOnMobile ? "hide-sm" : "",
                      ]
                        .filter(Boolean)
                        .join(" ");
                      const content =
                        c.kind === "composition" ? (
                          <Comp v={v} />
                        ) : c.kind === "sci" ? (
                          <i>{formatCell(c, v, r)}</i>
                        ) : (
                          formatCell(c, v, r)
                        );
                      return (
                        <td class={cls || undefined} data-label={c.label}>
                          {typeof href === "string" && href ? <a href={href}>{content}</a> : content}
                          <Show when={typeof sub === "string" && sub}>
                            {(() => {
                              const subHref = c.subHrefKey ? r[c.subHrefKey] : null;
                              const text = c.subSci ? <i>{sub as string}</i> : (sub as string);
                              return typeof subHref === "string" && subHref ? (
                                <a class="dtable__sub" href={subHref}>
                                  {text}
                                </a>
                              ) : (
                                <span class="dtable__sub">{text}</span>
                              );
                            })()}
                          </Show>
                        </td>
                      );
                    }}
                  </For>
                </tr>
              )}
            </For>
          </tbody>
        </table>
        <Show when={!visible().length}>
          <p class="search__empty">No rows match these filters.</p>
        </Show>
      </div>
      <Show when={props.csv && !(props.search || props.facets?.length)}>
        <div class="dtable__foot">
          <CsvButton label={props.csv?.label} onClick={exportCsv} />
        </div>
      </Show>
      <Show when={pages() > 1}>
        <nav class="dtable__pager" aria-label="Pages">
          <span class="dtable__status">
            Page {Math.min(page(), pages() - 1) + 1} of {pages()}
          </span>
          <div class="dtable__pager-btns">
            <button
              type="button"
              class="btn btn--soft btn--sm"
              disabled={page() === 0}
              onClick={() => gotoPage(Math.max(0, page() - 1))}
            >
              Previous
            </button>
            <button
              type="button"
              class="btn btn--soft btn--sm"
              disabled={page() >= pages() - 1}
              onClick={() => gotoPage(Math.min(pages() - 1, page() + 1))}
            >
              Next
            </button>
          </div>
        </nav>
      </Show>
    </div>
  );
}
