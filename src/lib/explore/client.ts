/**
 * Browser-side data loading for the plot explorer: /data/explorer.json once, per-gene codon and
 * amino-acid chunks on demand, and precomputed correlation slices. Every file is fetched once and
 * cached for the page's lifetime. Safe for islands only (uses fetch).
 */
import type { TraitKey } from "~/data/schema";
import { classGroup, classLabel } from "~/lib/classes";
import { speciesUrl } from "~/lib/urls";
import { chunkOf, getVariable, type Variable } from "./variables";
import { type ChunkFile, type CorrFile, corrUrl, chunkUrl, EXPLORER_URL, type ExplorerFile } from "./wire";

export interface SpeciesMeta {
  slug: string;
  name: string;
  common: string;
  className: string;
  order: string;
  /** Scatter legend group: a coloured class or "Other". */
  group: string;
  href: string;
}

export interface Dataset {
  build: string;
  n: number;
  ids: number[];
  species: SpeciesMeta[];
  indexBySlug: Map<string, number>;
  /** Classes and orders with their species counts, largest first. */
  classes: { name: string; label: string; count: number }[];
  orders: { name: string; className: string; count: number }[];
  file: ExplorerFile;
}

export type Column = Float64Array;

const getJson = async <T>(url: string): Promise<T> => {
  const r = await fetch(url);
  if (!r.ok) throw new Error(`${url}: HTTP ${r.status}`);
  return (await r.json()) as T;
};

let datasetPromise: Promise<Dataset> | null = null;

export function loadDataset(): Promise<Dataset> {
  if (!datasetPromise) {
    datasetPromise = getJson<ExplorerFile>(EXPLORER_URL)
      .then(toDataset)
      .catch((e: unknown) => {
        datasetPromise = null;
        throw e;
      });
  }
  return datasetPromise;
}

function toDataset(f: ExplorerFile): Dataset {
  const sp = f.species;
  const species: SpeciesMeta[] = sp.slug.map((slug, i) => {
    const className = f.classes[sp.class[i] ?? -1] ?? "";
    return {
      slug,
      name: sp.scientificName[i] ?? slug,
      common: (sp.commonName[i] ?? "").trim(),
      className,
      order: f.orders[sp.order[i] ?? -1] ?? "",
      group: classGroup(className),
      href: speciesUrl(slug),
    };
  });
  const classCount = new Map<string, number>();
  const orderCount = new Map<string, { className: string; count: number }>();
  for (const s of species) {
    classCount.set(s.className, (classCount.get(s.className) ?? 0) + 1);
    const o = orderCount.get(s.order) ?? { className: s.className, count: 0 };
    o.count++;
    orderCount.set(s.order, o);
  }
  return {
    build: f.build,
    n: species.length,
    ids: sp.id,
    species,
    indexBySlug: new Map(species.map((s, i) => [s.slug, i])),
    classes: [...classCount]
      .map(([name, count]) => ({ name, label: classLabel(name), count }))
      .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name)),
    orders: [...orderCount]
      .map(([name, o]) => ({ name, className: o.className, count: o.count }))
      .sort((a, b) => a.name.localeCompare(b.name)),
    file: f,
  };
}

const toColumn = (vals: readonly (number | null)[] | undefined, n: number): Column => {
  const out = new Float64Array(n).fill(Number.NaN);
  if (vals) for (let i = 0; i < n; i++) {
    const v = vals[i];
    if (typeof v === "number" && Number.isFinite(v)) out[i] = v;
  }
  return out;
};

const columns = new Map<string, Column>();
const chunks = new Map<string, Promise<void>>();

/** Values of a variable for every species, in dataset order (NaN = missing). */
export async function loadColumn(ds: Dataset, v: Variable): Promise<Column> {
  const hit = columns.get(v.key);
  if (hit) return hit;
  if (v.kind === "trait") {
    const col = toColumn(ds.file.traits[v.trait as TraitKey], ds.n);
    columns.set(v.key, col);
    return col;
  }
  const chunk = chunkOf(v);
  if (!chunk) {
    const col = toColumn(ds.file.values[v.key], ds.n);
    columns.set(v.key, col);
    return col;
  }
  const url = chunkUrl(chunk.region, chunk.kind);
  let p = chunks.get(url);
  if (!p) {
    p = getJson<ChunkFile>(url).then((c) => {
      // Align by species id: the chunk and explorer.json come from different build steps.
      const pos = new Map(c.ids.map((id, i) => [id, i]));
      const order = ds.ids.map((id) => pos.get(id) ?? -1);
      c.keys.forEach((key, k) => {
        const row = c.values[k] ?? [];
        const col = new Float64Array(ds.n).fill(Number.NaN);
        order.forEach((j, i) => {
          const val = j >= 0 ? row[j] : null;
          if (typeof val === "number" && Number.isFinite(val)) col[i] = val;
        });
        columns.set(key, col);
      });
    });
    p.catch(() => chunks.delete(url));
    chunks.set(url, p);
  }
  await p;
  const col = columns.get(v.key);
  if (!col) throw new Error(`No values for ${v.key}`);
  return col;
}

export const loadColumnByKey = (ds: Dataset, key: string): Promise<Column> => {
  const v = getVariable(key);
  return v ? loadColumn(ds, v) : Promise.reject(new Error(`Unknown variable ${key}`));
};

// ---------------------------------------------------------------- precomputed correlations

const corrFiles = new Map<string, Promise<{ file: CorrFile; index: Map<string, number> }>>();

export function loadCorr(trait: TraitKey, scope: string): Promise<{ file: CorrFile; index: Map<string, number> }> {
  const url = corrUrl(trait, scope);
  let p = corrFiles.get(url);
  if (!p) {
    p = getJson<CorrFile>(url).then((file) => ({ file, index: new Map(file.f.map((k, i) => [k, i])) }));
    p.catch(() => corrFiles.delete(url));
    corrFiles.set(url, p);
  }
  return p;
}

// ---------------------------------------------------------------- scopes

/** Species filter for a scope: "all", "class:Mammalia", "order:Primates". */
export function scopeFilter(ds: Dataset, scope: string): (i: number) => boolean {
  if (scope.startsWith("class:")) {
    const name = scope.slice(6);
    return (i) => ds.species[i]?.className === name;
  }
  if (scope.startsWith("order:")) {
    const name = scope.slice(6);
    return (i) => ds.species[i]?.order === name;
  }
  return () => true;
}

export function scopeLabel(ds: Dataset | null, scope: string): string {
  if (scope.startsWith("class:")) {
    const name = scope.slice(6);
    return `${classLabel(name)} (${name})`;
  }
  if (scope.startsWith("order:")) {
    const name = scope.slice(6);
    const o = ds?.orders.find((x) => x.name === name);
    return o ? `${name} (order of ${classLabel(o.className).toLowerCase()})` : `${name} (order)`;
  }
  return "All species";
}
