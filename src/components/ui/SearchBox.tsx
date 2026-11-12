/**
 * Global search: an ARIA 1.2 combobox over /search-index.json (species, taxa, genes).
 * The index is fetched once, on first focus or keystroke, and shared by every instance.
 * Without JS the surrounding <form> submits to /species/?q=..., which filters the species table.
 *
 * <SearchBox client:idle variant="header" />
 * <SearchBox client:load variant="hero" placeholder="Bowhead whale, Primates, ND6" />
 */
import { createMemo, createSignal, createUniqueId, For, onCleanup, onMount, Show } from "solid-js";
import { SEARCH_INDEX_URL, type SearchIndex, type SearchItem, type SearchKind } from "~/lib/searchTypes";
import { ICONS } from "./icons";

interface Props {
  variant?: "header" | "hero";
  placeholder?: string;
  label?: string;
  /** Show a "Search" submit button (hero). */
  submitButton?: boolean;
  indexUrl?: string;
}

interface Prepared extends SearchItem {
  nn: string;
  na: string;
}

let indexPromise: Promise<Prepared[]> | null = null;

const norm = (s: string): string =>
  s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[_-]+/g, " ")
    .trim();

const loadIndex = (url: string): Promise<Prepared[]> => {
  if (!indexPromise) {
    indexPromise = fetch(url)
      .then((r) => {
        if (!r.ok) throw new Error(`search index ${r.status}`);
        return r.json() as Promise<SearchIndex>;
      })
      .then((ix) => ix.items.map((it) => ({ ...it, nn: norm(it.n), na: norm(it.a) })))
      .catch((e: unknown) => {
        indexPromise = null;
        throw e;
      });
  }
  return indexPromise;
};

const scoreText = (text: string, q: string, base: number): number => {
  if (!text) return 0;
  if (text === q) return base + 40;
  if (text.startsWith(q)) return base + 25;
  if (text.includes(` ${q}`)) return base + 12;
  if (text.includes(q)) return base;
  return 0;
};

const score = (it: Prepared, q: string): number => {
  const s = Math.max(scoreText(it.nn, q, 40), scoreText(it.na, q, 36));
  if (!s) return 0;
  // Exact gene symbols and short exact taxon names deserve to win.
  return s + (it.k === "g" && it.nn === q ? 30 : 0) - it.n.length * 0.01;
};

const LIMITS: Record<SearchKind, number> = { s: 6, t: 4, g: 3 };
const GROUP_LABEL: Record<SearchKind, string> = { s: "Species", t: "Taxa", g: "Genes and regions" };
const KIND_BADGE: Record<SearchKind, { text: string; cls: string }> = {
  s: { text: "Sp", cls: "search__kind--species" },
  t: { text: "Tx", cls: "search__kind--taxon" },
  g: { text: "G", cls: "search__kind--gene" },
};

const Highlight = (p: { text: string; q: string; italic?: boolean }) => {
  const parts = createMemo(() => {
    const i = norm(p.text).indexOf(p.q);
    // norm() keeps length for ASCII names; fall back to no highlight otherwise.
    if (!p.q || i < 0 || norm(p.text).length !== p.text.length) return [p.text, "", ""] as const;
    return [p.text.slice(0, i), p.text.slice(i, i + p.q.length), p.text.slice(i + p.q.length)] as const;
  });
  return (
    <span style={p.italic ? { "font-style": "italic" } : undefined}>
      {parts()[0]}
      <Show when={parts()[1]}>
        <mark>{parts()[1]}</mark>
      </Show>
      {parts()[2]}
    </span>
  );
};

export default function SearchBox(props: Props) {
  const uid = createUniqueId();
  const inputId = `search-${uid}`;
  const listId = `search-list-${uid}`;
  const variant = () => props.variant ?? "header";
  const [query, setQuery] = createSignal("");
  const [items, setItems] = createSignal<Prepared[] | null>(null);
  const [error, setError] = createSignal(false);
  const [open, setOpen] = createSignal(false);
  const [active, setActive] = createSignal(-1);
  let root: HTMLDivElement | undefined;
  let input: HTMLInputElement | undefined;

  const ensureIndex = () => {
    if (items() || error()) return;
    loadIndex(props.indexUrl ?? SEARCH_INDEX_URL)
      .then(setItems)
      .catch(() => setError(true));
  };

  const q = createMemo(() => norm(query()));

  const groups = createMemo(() => {
    const all = items();
    const term = q();
    if (!all || term.length < 1) return [] as { kind: SearchKind; items: Prepared[] }[];
    const buckets: Record<SearchKind, { it: Prepared; s: number }[]> = { s: [], t: [], g: [] };
    for (const it of all) {
      const s = score(it, term);
      if (s > 0) buckets[it.k].push({ it, s });
    }
    const out: { kind: SearchKind; items: Prepared[]; top: number }[] = [];
    (["s", "t", "g"] as const).forEach((k) => {
      const b = buckets[k].sort((x, y) => y.s - x.s).slice(0, LIMITS[k]);
      if (b.length) out.push({ kind: k, items: b.map((x) => x.it), top: b[0]?.s ?? 0 });
    });
    // Put the group with the best match first.
    return out.sort((x, y) => y.top - x.top).map(({ kind, items: its }) => ({ kind, items: its }));
  });

  const flat = createMemo(() => groups().flatMap((g) => g.items));
  const optionId = (i: number) => `${listId}-opt-${i}`;

  const go = (it: Prepared | undefined) => {
    if (it) window.location.assign(it.u);
  };

  const onKeyDown = (e: KeyboardEvent) => {
    const n = flat().length;
    switch (e.key) {
      case "ArrowDown":
        e.preventDefault();
        setOpen(true);
        if (n) setActive((a) => (a + 1) % n);
        break;
      case "ArrowUp":
        e.preventDefault();
        setOpen(true);
        if (n) setActive((a) => (a <= 0 ? n - 1 : a - 1));
        break;
      case "Enter": {
        const it = flat()[active()] ?? (q() ? flat()[0] : undefined);
        if (it) {
          e.preventDefault();
          go(it);
        }
        break;
      }
      case "Escape":
        if (open()) {
          e.preventDefault();
          setOpen(false);
          setActive(-1);
        } else if (query()) {
          e.preventDefault();
          setQuery("");
        }
        break;
      default:
    }
  };

  onMount(() => {
    const onDocDown = (e: PointerEvent) => {
      if (root && !root.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("pointerdown", onDocDown);
    onCleanup(() => document.removeEventListener("pointerdown", onDocDown));
  });

  const showPanel = () => open() && q().length > 0;

  return (
    <div class={`search search--${variant()}`} ref={root}>
      <form
        role="search"
        action="/species/"
        method="get"
        onSubmit={(e) => {
          const it = flat()[active()] ?? flat()[0];
          if (it) {
            e.preventDefault();
            go(it);
          }
        }}
      >
        <label for={inputId} class="visually-hidden">
          {props.label ?? "Search species, taxa or genes"}
        </label>
        <div class="search__box">
          <svg
            class="search__icon"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2.6"
            stroke-linecap="round"
            aria-hidden="true"
            innerHTML={ICONS.search}
          />
          <input
            ref={input}
            id={inputId}
            class="search__input"
            type="search"
            name="q"
            autocomplete="off"
            spellcheck={false}
            placeholder={props.placeholder ?? "Search species, taxa, genes"}
            role="combobox"
            aria-autocomplete="list"
            aria-expanded={showPanel()}
            aria-controls={listId}
            aria-activedescendant={active() >= 0 && showPanel() ? optionId(active()) : undefined}
            value={query()}
            onFocus={() => {
              ensureIndex();
              setOpen(true);
            }}
            onInput={(e) => {
              ensureIndex();
              setQuery(e.currentTarget.value);
              setActive(-1);
              setOpen(true);
            }}
            onKeyDown={onKeyDown}
          />
          <Show when={query()}>
            <button
              type="button"
              class="search__clear"
              aria-label="Clear search"
              onClick={() => {
                setQuery("");
                setActive(-1);
                input?.focus();
              }}
            >
              <svg
                width="18"
                height="18"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                stroke-width="2.6"
                stroke-linecap="round"
                aria-hidden="true"
                innerHTML={ICONS.close}
              />
            </button>
          </Show>
          <Show when={props.submitButton}>
            <button type="submit" class="btn btn--action search__submit">
              Search
            </button>
          </Show>
        </div>
      </form>
      <div class="search__panel" hidden={!showPanel()}>
        <div id={listId} role="listbox" aria-label="Search results">
          <Show when={items() !== null || error()} fallback={<div class="search__empty">Loading the index…</div>}>
            <Show
              when={flat().length > 0}
              fallback={
                <div class="search__empty">
                  {error() ? "Search is unavailable right now." : `Nothing matches “${query()}”.`}
                </div>
              }
            >
              <For each={groups()}>
                {(g) => {
                  const start = flat().indexOf(g.items[0] as Prepared);
                  const gid = `${listId}-g-${g.kind}`;
                  return (
                    <div role="group" aria-labelledby={gid}>
                      <div class="search__group" id={gid} role="presentation">
                        {GROUP_LABEL[g.kind]}
                      </div>
                      <For each={g.items}>
                        {(it, i) => {
                          const idx = () => start + i();
                          return (
                            <a
                              id={optionId(idx())}
                              role="option"
                              href={it.u}
                              tabIndex={-1}
                              class="search__option"
                              aria-selected={active() === idx()}
                              onPointerMove={() => setActive(idx())}
                            >
                              <span class={`search__kind ${KIND_BADGE[it.k].cls}`} aria-hidden="true">
                                {KIND_BADGE[it.k].text}
                              </span>
                              <span class="search__text">
                                <span class="search__name">
                                  <Highlight text={it.n} q={q()} italic={it.k === "s"} />
                                </span>
                                <span class="search__meta">{[it.a, it.m].filter(Boolean).join(" · ")}</span>
                              </span>
                            </a>
                          );
                        }}
                      </For>
                    </div>
                  );
                }}
              </For>
            </Show>
          </Show>
        </div>
      </div>
    </div>
  );
}
