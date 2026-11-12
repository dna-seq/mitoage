/**
 * Small combobox that finds a taxon or species inside the radial tree's data (no network:
 * it searches the already loaded tree). Used by RadialTree.
 */
import { createMemo, createSignal, createUniqueId, For, onCleanup, onMount, Show } from "solid-js";
import { ICONS } from "~/components/ui/icons";
import { classLabel } from "~/lib/classes";
import { fmtInt } from "~/lib/format";
import { isAncestorOf } from "~/lib/tree/layout";
import { isItalicRank, RANK_LABEL } from "~/lib/tree/names";
import type { TNode, TreeModel } from "~/lib/tree/types";

interface Item {
  node: TNode;
  name: string;
  alt: string;
  nn: string;
  na: string;
}

const norm = (s: string): string =>
  s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[_-]+/g, " ")
    .trim();

const scoreText = (text: string, q: string, base: number): number => {
  if (!text) return 0;
  if (text === q) return base + 40;
  if (text.startsWith(q)) return base + 25;
  if (text.includes(` ${q}`)) return base + 12;
  if (text.includes(q)) return base;
  return 0;
};

export interface TreeSearchProps {
  model: TreeModel;
  /** Only nodes inside this clade are offered. */
  scope: TNode;
  onPick: (node: TNode) => void;
}

export default function TreeSearch(props: TreeSearchProps) {
  const uid = createUniqueId();
  const listId = `rts-${uid}`;
  const [query, setQuery] = createSignal("");
  const [open, setOpen] = createSignal(false);
  const [active, setActive] = createSignal(-1);
  let root: HTMLDivElement | undefined;
  let input: HTMLInputElement | undefined;

  const items = createMemo<Item[]>(() => {
    const out: Item[] = [];
    const scope = props.scope;
    for (const n of props.model.nodes) {
      if (n === scope || !isAncestorOf(scope, n)) continue;
      const alt = n.data.sp?.common ?? (n.data.rank === "class" ? classLabel(n.data.name) : "");
      out.push({ node: n, name: n.data.name, alt, nn: norm(n.data.name), na: norm(alt) });
    }
    return out;
  });

  const results = createMemo(() => {
    const q = norm(query());
    if (!q) return [] as Item[];
    return items()
      .map((it) => {
        const s = Math.max(scoreText(it.nn, q, 40), scoreText(it.na, q, 36));
        // Taxa slightly before species with the same score; shorter names first.
        return { it, s: s ? s + (it.node.children ? 3 : 0) - it.name.length * 0.01 : 0 };
      })
      .filter((x) => x.s > 0)
      .sort((a, b) => b.s - a.s)
      .slice(0, 8)
      .map((x) => x.it);
  });

  const pick = (it: Item | undefined) => {
    if (!it) return;
    props.onPick(it.node);
    setQuery("");
    setOpen(false);
    setActive(-1);
  };

  const onKeyDown = (e: KeyboardEvent) => {
    const n = results().length;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setOpen(true);
      if (n) setActive((a) => (a + 1) % n);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setOpen(true);
      if (n) setActive((a) => (a <= 0 ? n - 1 : a - 1));
    } else if (e.key === "Enter") {
      const it = results()[active()] ?? results()[0];
      if (it) {
        e.preventDefault();
        pick(it);
      }
    } else if (e.key === "Escape") {
      // Keep Escape inside the search: it must not also move the tree up a level.
      e.stopPropagation();
      if (open() && query()) {
        e.preventDefault();
        setOpen(false);
      } else if (query()) {
        e.preventDefault();
        setQuery("");
      }
    }
  };

  onMount(() => {
    const onDown = (e: PointerEvent) => {
      if (root && !root.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("pointerdown", onDown);
    onCleanup(() => document.removeEventListener("pointerdown", onDown));
  });

  const optId = (i: number) => `${listId}-${i}`;
  const showPanel = () => open() && query().trim().length > 0;

  return (
    <div class="rtree-search" ref={root}>
      <label class="visually-hidden" for={`${listId}-input`}>
        Find a taxon or species in the tree
      </label>
      <svg
        class="rtree-search__icon"
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
        id={`${listId}-input`}
        class="input rtree-search__input"
        type="search"
        autocomplete="off"
        spellcheck={false}
        placeholder="Find in the tree"
        role="combobox"
        aria-autocomplete="list"
        aria-expanded={showPanel()}
        aria-controls={listId}
        aria-activedescendant={active() >= 0 && showPanel() ? optId(active()) : undefined}
        value={query()}
        onInput={(e) => {
          setQuery(e.currentTarget.value);
          setActive(-1);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        onKeyDown={onKeyDown}
      />
      <div class="rtree-search__panel" hidden={!showPanel()}>
        <ul id={listId} role="listbox" aria-label="Taxa and species in the tree">
          <For each={results()}>
              {(it, i) => (
                <li
                  id={optId(i())}
                  role="option"
                  aria-selected={active() === i()}
                  class="rtree-search__option"
                  onPointerMove={() => setActive(i())}
                  onPointerDown={(e) => e.preventDefault()}
                  onClick={() => {
                    pick(it);
                    input?.blur();
                  }}
                >
                  <span class="rtree-search__rank">{it.node.children ? RANK_LABEL[it.node.data.rank] : "Species"}</span>
                  <span class="rtree-search__text">
                    <span class={isItalicRank(it.node.data.rank) ? "sci" : undefined}>{it.name}</span>
                    <span class="rtree-search__meta">
                      {it.node.children
                        ? `${it.alt ? `${it.alt} · ` : ""}${fmtInt(it.node.value ?? 0)} species`
                        : it.alt}
                    </span>
                  </span>
                </li>
              )}
          </For>
        </ul>
        <Show when={!results().length}>
          <p class="rtree-search__empty">Nothing matches “{query()}”.</p>
        </Show>
      </div>
    </div>
  );
}
