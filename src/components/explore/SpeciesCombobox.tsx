/**
 * Species search combobox (ARIA 1.2) that picks a species instead of navigating to it.
 * Used by the plot explorer (highlight species) and the compare page (add species).
 * Items come from `load()`, called once on first focus or keystroke.
 *
 * <SpeciesCombobox load={() => Promise.resolve(items)} onSelect={(slug) => add(slug)}
 *                  exclude={new Set(current)} placeholder="Add a species" label="Add a species" />
 */
import { createMemo, createSignal, createUniqueId, For, onCleanup, onMount, Show } from "solid-js";
import { ICONS } from "~/components/ui/icons";

export interface SpeciesItem {
  slug: string;
  name: string;
  common: string;
  /** Meta line, e.g. "Primates · 122.5 yr". */
  meta: string;
  /** CSS colour of the class dot. */
  color: string;
}

interface Props {
  load: () => Promise<SpeciesItem[]>;
  onSelect: (slug: string) => void;
  exclude?: ReadonlySet<string> | undefined;
  placeholder?: string | undefined;
  /** Accessible label (visually hidden). */
  label: string;
  disabled?: boolean | undefined;
  /** Focus the input when mounted. */
  autofocus?: boolean | undefined;
  class?: string | undefined;
}

interface Prepared extends SpeciesItem {
  nn: string;
  nc: string;
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

const LIMIT = 8;

export default function SpeciesCombobox(props: Props) {
  const uid = createUniqueId();
  const inputId = `sp-combo-${uid}`;
  const listId = `sp-combo-list-${uid}`;
  const [items, setItems] = createSignal<Prepared[] | null>(null);
  const [error, setError] = createSignal(false);
  const [query, setQuery] = createSignal("");
  const [open, setOpen] = createSignal(false);
  const [active, setActive] = createSignal(-1);
  let root: HTMLDivElement | undefined;
  let input: HTMLInputElement | undefined;
  let loading = false;

  const ensure = () => {
    if (items() || loading) return;
    loading = true;
    props
      .load()
      .then((list) => setItems(list.map((it) => ({ ...it, nn: norm(it.name), nc: norm(it.common) }))))
      .catch(() => setError(true))
      .finally(() => {
        loading = false;
      });
  };

  const q = createMemo(() => norm(query()));
  const matches = createMemo(() => {
    const all = items();
    const term = q();
    if (!all || !term) return [] as Prepared[];
    const ex = props.exclude;
    const scored: { it: Prepared; s: number }[] = [];
    for (const it of all) {
      if (ex?.has(it.slug)) continue;
      const s = Math.max(scoreText(it.nn, term, 40), scoreText(it.nc, term, 38));
      if (s > 0) scored.push({ it, s: s - it.name.length * 0.01 });
    }
    return scored
      .sort((a, b) => b.s - a.s)
      .slice(0, LIMIT)
      .map((x) => x.it);
  });

  const choose = (it: Prepared | undefined) => {
    if (!it) return;
    props.onSelect(it.slug);
    setQuery("");
    setActive(-1);
    setOpen(false);
    input?.focus();
  };

  const onKeyDown = (e: KeyboardEvent) => {
    const n = matches().length;
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
      case "Enter":
        if (n) {
          e.preventDefault();
          choose(matches()[Math.max(0, active())]);
        }
        break;
      case "Escape":
        if (open() && query()) {
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
    if (props.autofocus) input?.focus();
  });

  const showPanel = () => open() && q().length > 0;
  const optionId = (i: number) => `${listId}-${i}`;

  return (
    <div class={`search sp-combo${props.class ? ` ${props.class}` : ""}`} ref={root}>
      <label for={inputId} class="visually-hidden">
        {props.label}
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
          autocomplete="off"
          spellcheck={false}
          disabled={props.disabled}
          placeholder={props.placeholder ?? "Search species"}
          role="combobox"
          aria-autocomplete="list"
          aria-expanded={showPanel()}
          aria-controls={listId}
          aria-activedescendant={active() >= 0 && showPanel() ? optionId(active()) : undefined}
          value={query()}
          onFocus={() => {
            ensure();
            setOpen(true);
          }}
          onInput={(e) => {
            ensure();
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
            aria-label="Clear"
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
      </div>
      <div class="search__panel" hidden={!showPanel()}>
        <div id={listId} role="listbox" aria-label="Matching species">
          <Show when={items() !== null || error()} fallback={<div class="search__empty">Loading species…</div>}>
            <Show
              when={matches().length > 0}
              fallback={
                <div class="search__empty">
                  {error() ? "Species list unavailable right now." : `No species matches “${query()}”.`}
                </div>
              }
            >
              <For each={matches()}>
                {(it, i) => (
                  <div
                    id={optionId(i())}
                    role="option"
                    class="search__option"
                    aria-selected={active() === i()}
                    onPointerMove={() => setActive(i())}
                    onPointerDown={(e) => e.preventDefault()}
                    onClick={() => choose(it)}
                  >
                    <span class="sp-combo__dot" style={{ "--dot": it.color }} aria-hidden="true" />
                    <span class="search__text">
                      <span class="search__name">
                        <i>{it.name}</i>
                      </span>
                      <span class="search__meta">{[it.common, it.meta].filter(Boolean).join(" · ")}</span>
                    </span>
                  </div>
                )}
              </For>
            </Show>
          </Show>
        </div>
      </div>
    </div>
  );
}
