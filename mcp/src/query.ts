/**
 * The questions the server answers, as plain functions over an open database.
 *
 * Every function returns values the build wrote. The one exception is `regionSummary`, which counts
 * and averages published rows; it says so in what it returns, so an answer can never be mistaken for
 * a statistic MitoAge publishes. Nothing here computes a correlation: `correlation` and
 * `rankFeatures` read the rows the site build wrote, and carry the dataset's filters with them.
 */
import type { DatabaseSync } from "node:sqlite";

export type Scalar = string | number | null;
export type Row = Record<string, Scalar>;

/** The ranks a scope can name, and the columns of `species` they are. */
export const RANKS = ["class", "order", "family", "genus"] as const;
export type Rank = (typeof RANKS)[number];

const quote = (name: string): string => `"${name.replace(/"/g, '""')}"`;

const all = (db: DatabaseSync, sql: string, params: Scalar[] = []): Row[] => db.prepare(sql).all(...params) as Row[];
const one = (db: DatabaseSync, sql: string, params: Scalar[] = []): Row | undefined => db.prepare(sql).get(...params) as Row | undefined;

/**
 * A scope, as the correlation rows spell it: "all", or a rank and a name, "class:Mammalia". The
 * name is matched exactly, as the build wrote it.
 */
export function scopeFilter(scope: string): { sql: string; params: Scalar[] } {
  if (scope === "all") return { sql: "1 = 1", params: [] };
  const at = scope.indexOf(":");
  if (at < 0) throw new Error(`scope "${scope}": write "all", or a rank and a name, such as "class:Mammalia"`);
  const rank = scope.slice(0, at);
  const name = scope.slice(at + 1);
  if (!(RANKS as readonly string[]).includes(rank)) throw new Error(`scope "${scope}": the rank must be one of ${RANKS.join(", ")}`);
  if (name === "") throw new Error(`scope "${scope}": the name after "${rank}:" is empty`);
  return { sql: `s.${quote(rank)} = ?`, params: [name] };
}

export interface BuildFacts {
  build: string;
  buildNumber: number | null;
  buildDate: string | null;
  speciesCount: number | null;
  databaseGeneratedAt: string | null;
  datasets: Row[];
  sources: Row[];
  tables: { table: string; rows: number }[];
}

/** What build this database is, which correlation datasets it holds, and where the values come from. */
export function buildFacts(db: DatabaseSync): BuildFacts {
  const info = one(db, `SELECT * FROM "build_info"`);
  if (!info) throw new Error("the database has no build_info row: it was not written by `bun run sqlite`");
  const tables = all(db, `SELECT name FROM sqlite_master WHERE type = 'table' ORDER BY name`).map((t) => {
    const name = String(t["name"]);
    return { table: name, rows: Number(one(db, `SELECT count(*) AS n FROM ${quote(name)}`)?.["n"] ?? 0) };
  });
  return {
    build: String(info["build"]),
    buildNumber: info["build_number"] as number | null,
    buildDate: info["build_date"] as string | null,
    speciesCount: info["species_count"] as number | null,
    databaseGeneratedAt: info["database_generated_at"] as string | null,
    datasets: all(db, `SELECT * FROM "correlation_dataset" ORDER BY "dataset"`),
    sources: all(db, `SELECT * FROM "source" ORDER BY "name"`),
    tables,
  };
}

const SPECIES_COLUMNS = [
  "id",
  "slug",
  "scientific_name",
  "common_name",
  "refseq",
  "class",
  "order",
  "family",
  "max_longevity_years",
  "adult_weight_g",
  "mtdna_size_bp",
  "gc_percent",
  "lifespan_source",
  "lifespan_quality",
  "lifespan_record_type",
  "lifespan_license",
  "record_status",
];

/**
 * Species whose scientific name, common name or slug contains `query`, longest-lived first. The
 * match is case-insensitive and unanchored, so "whale" finds every whale.
 */
export function searchSpecies(db: DatabaseSync, args: { query?: string | undefined; scope?: string | undefined; limit?: number | undefined }): Row[] {
  const limit = clampLimit(args.limit, 25, 200);
  const scope = scopeFilter(args.scope ?? "all");
  const params: Scalar[] = [...scope.params];
  let match = "1 = 1";
  if (args.query !== undefined && args.query.trim() !== "") {
    const like = `%${args.query.trim().toLowerCase()}%`;
    match = `(lower(s."scientific_name") LIKE ? OR lower(s."common_name") LIKE ? OR lower(s."slug") LIKE ?)`;
    params.push(like, like, like);
  }
  const cols = SPECIES_COLUMNS.map((c) => `s.${quote(c)}`).join(", ");
  return all(
    db,
    `SELECT ${cols} FROM "species" s WHERE ${scope.sql} AND ${match}
     ORDER BY s."max_longevity_years" IS NULL, s."max_longevity_years" DESC, s."scientific_name" LIMIT ${limit}`,
    params,
  );
}

export interface SpeciesProfile {
  species: Row;
  regions: Row[];
  structure: Row | null;
  lifespanObservations: Row[];
  /** The record is in the build but RefSeq (or MitoAge) retired it; said out loud, never dropped. */
  retired: boolean;
}

/** One species by slug or scientific name, with its regions, its structure and every lifespan record. */
export function speciesProfile(db: DatabaseSync, key: string): SpeciesProfile {
  const wanted = key.trim().toLowerCase();
  const species = one(
    db,
    `SELECT * FROM "species" WHERE lower("slug") = ? OR lower("scientific_name") = ? OR lower("common_name") = ?`,
    [wanted, wanted, wanted],
  );
  if (!species) {
    const near = searchSpecies(db, { query: key, limit: 5 }).map((r) => String(r["scientific_name"]));
    const hint = near.length > 0 ? ` Close by name: ${near.join(", ")}.` : "";
    throw new Error(`no species "${key}" in this build.${hint}`);
  }
  const id = species["id"] as number;
  return {
    species,
    regions: all(db, `SELECT * FROM "region_stats" WHERE "species_id" = ? ORDER BY "region"`, [id]),
    structure: one(db, `SELECT * FROM "mtdna_structure" WHERE "species_id" = ?`, [id]) ?? null,
    lifespanObservations: all(
      db,
      `SELECT * FROM "lifespan_observations" WHERE "species_id" = ? ORDER BY "is_chosen" DESC, "source", "value_years" DESC`,
      [id],
    ),
    retired: species["record_status"] === "retired",
  };
}

export interface Verdict {
  /** Benjamini-Hochberg across the features of this trait and scope. */
  fdrSignificant: boolean | null;
  /** On phylogenetically independent contrasts, with the same sign as the raw correlation. */
  survivesPhylogeny: boolean | null;
  /** Partial correlation on log10 adult weight, significant: the paper's Table 3 definition. */
  survivesBodyMass: boolean | null;
  summary: string;
}

const sameSign = (a: number, b: number): boolean => (a > 0 && b > 0) || (a < 0 && b < 0);

/**
 * What a correlation row survives. A control that was not computed for this row is null and is said
 * as "not assessed", never as a failure: MitoAge computes contrasts only where the dated tree
 * reaches, and the body-mass control only for maximum lifespan.
 */
export function verdictOf(c: Row): Verdict {
  const num = (k: string): number | null => (typeof c[k] === "number" ? (c[k] as number) : null);
  const r = num("pearson_r");
  const q = num("q_value");
  const picR = num("pic_r");
  const picP = num("pic_p_value");
  const parR = num("partial_r");
  const parP = num("partial_p_value");
  const fdrSignificant = q === null ? null : q < 0.05;
  const survivesPhylogeny = picR === null || picP === null || r === null ? null : picP < 0.05 && sameSign(picR, r);
  // Table 3 of the MitoAge 2 paper passes the body-mass control on its p-value alone, where the
  // contrast control also asks for the sign. The server counts the same rows the paper counts, and
  // says beside the answer when the partial correlation points the other way.
  const survivesBodyMass = parR === null || parP === null || r === null ? null : parP < 0.05;
  const bodyMassOpposite = survivesBodyMass === true && parR !== null && r !== null && !sameSign(parR, r);
  const said = (value: boolean | null, yes: string, no: string, unknown: string): string =>
    value === null ? unknown : value ? yes : no;
  const summary = [
    said(fdrSignificant, "passes the false discovery rate (q < 0.05)", "does not pass the false discovery rate (q >= 0.05)", "no q-value in this build: not assessed"),
    said(
      survivesPhylogeny,
      "and holds on phylogenetically independent contrasts, with the same sign",
      "and does not hold on phylogenetically independent contrasts",
      "and the contrasts were not computed for this row: not assessed",
    ),
    said(
      survivesBodyMass,
      `and holds with body mass controlled${bodyMassOpposite ? ", though the partial correlation has the opposite sign" : ", with the same sign"}`,
      "and does not hold with body mass controlled",
      "and the body-mass control was not computed for this row: not assessed",
    ),
  ].join(", ");
  return { fdrSignificant, survivesPhylogeny, survivesBodyMass, summary };
}

/**
 * One correlation: the row as the build wrote it, its dataset's filters, and what it survives. The
 * raw r is never returned on its own, because on this data it is usually the wrong answer.
 */
export function correlation(
  db: DatabaseSync,
  args: { featureKey: string; trait?: string | undefined; scope?: string | undefined; dataset?: string | undefined },
): { correlation: Row; verdict: Verdict } {
  const trait = args.trait ?? "maxLongevityYears";
  const scope = args.scope ?? "all";
  const dataset = args.dataset ?? "default";
  const row = one(
    db,
    `SELECT * FROM "correlations" WHERE "feature_key" = ? AND "trait" = ? AND "scope" = ? AND "dataset" = ?`,
    [args.featureKey, trait, scope, dataset],
  );
  if (!row) {
    const features = all(db, `SELECT DISTINCT "feature_key" FROM "correlations" WHERE lower("feature_key") LIKE ? LIMIT 5`, [
      `%${args.featureKey.toLowerCase()}%`,
    ]).map((r) => String(r["feature_key"]));
    const scopes = all(db, `SELECT DISTINCT "scope" FROM "correlations" WHERE "feature_key" = ? AND "trait" = ? LIMIT 8`, [
      args.featureKey,
      trait,
    ]).map((r) => String(r["scope"]));
    const hints = [
      features.length > 0 ? `features like it: ${features.join(", ")}` : "",
      scopes.length > 0 ? `scopes it has for ${trait}: ${scopes.join(", ")}` : "",
    ].filter((h) => h !== "");
    throw new Error(
      `no correlation for feature "${args.featureKey}", trait "${trait}", scope "${scope}", dataset "${dataset}".` +
        (hints.length > 0 ? ` ${hints.join("; ")}.` : ""),
    );
  }
  return { correlation: row, verdict: verdictOf(row) };
}

export interface RankedFeature {
  correlation: Row;
  verdict: Verdict;
}

/**
 * The features of one trait and scope, strongest raw correlation first, each with its q-value and
 * both controls. `onlySurviving` keeps the rows that pass the false discovery rate and hold on
 * contrasts with the same sign: the set the MitoAge 2 paper counts.
 */
export function rankFeatures(
  db: DatabaseSync,
  args: { trait?: string | undefined; scope?: string | undefined; dataset?: string | undefined; limit?: number | undefined; onlySurviving?: boolean | undefined },
): { trait: string; scope: string; dataset: string; assessed: number; features: RankedFeature[] } {
  const trait = args.trait ?? "maxLongevityYears";
  const scope = args.scope ?? "all";
  const dataset = args.dataset ?? "default";
  const limit = clampLimit(args.limit, 25, 200);
  const rows = all(
    db,
    `SELECT * FROM "correlations" WHERE "trait" = ? AND "scope" = ? AND "dataset" = ?
     ORDER BY abs("pearson_r") DESC, "feature_key"`,
    [trait, scope, dataset],
  );
  if (rows.length === 0) throw new Error(`no correlations for trait "${trait}", scope "${scope}", dataset "${dataset}"`);
  const judged: RankedFeature[] = rows.map((r) => ({ correlation: r, verdict: verdictOf(r) }));
  const kept =
    args.onlySurviving === true
      ? judged.filter((f) => f.verdict.fdrSignificant === true && f.verdict.survivesPhylogeny === true)
      : judged;
  return { trait, scope, dataset, assessed: rows.length, features: kept.slice(0, limit) };
}

/**
 * Counts and averages of the published `region_stats` rows for a scope: n, mean and sample standard
 * deviation of GC %, the skews and the length. These are computed here, from published values; the
 * answer says so, and a correlation with lifespan is never computed — that is what `correlation` is.
 */
export function regionSummary(db: DatabaseSync, args: { scope?: string | undefined; region?: string | undefined }): { computed: string; scope: string; regions: Row[] } {
  const scope = args.scope ?? "all";
  const filter = scopeFilter(scope);
  const params: Scalar[] = [...filter.params];
  let regionClause = "1 = 1";
  if (args.region !== undefined && args.region !== "") {
    regionClause = `rs."region" = ?`;
    params.push(args.region);
  }
  const agg = (col: string): string =>
    `count(rs.${quote(col)}) AS ${quote(`${col}_n`)}, avg(rs.${quote(col)}) AS ${quote(`${col}_mean`)},` +
    ` min(rs.${quote(col)}) AS ${quote(`${col}_min`)}, max(rs.${quote(col)}) AS ${quote(`${col}_max`)}`;
  const regions = all(
    db,
    `SELECT rs."region", count(*) AS "rows", ${agg("gc_percent")}, ${agg("gc_skew")}, ${agg("at_skew")}, ${agg("length_bp")}
     FROM "region_stats" rs JOIN "species" s ON s."id" = rs."species_id"
     WHERE ${filter.sql} AND ${regionClause} GROUP BY rs."region" ORDER BY rs."region"`,
    params,
  );
  if (regions.length === 0) throw new Error(`no region_stats rows for scope "${scope}"${args.region ? `, region "${args.region}"` : ""}`);
  return {
    computed: "n, mean, minimum and maximum over the published region_stats rows of this scope; MitoAge publishes no summary of its own for an arbitrary scope",
    scope,
    regions,
  };
}

/** A read-only query. One statement, starting with SELECT or WITH, and its rows are capped. */
export function runQuery(db: DatabaseSync, sql: string, limit?: number): { rows: Row[]; truncated: boolean; limit: number } {
  const capped = clampLimit(limit, 100, 1000);
  const trimmed = sql.trim().replace(/;\s*$/, "").trim();
  if (trimmed === "") throw new Error("the query is empty");
  if (trimmed.includes(";")) throw new Error("one statement at a time: the query holds a semicolon");
  if (!/^(select|with)\b/i.test(trimmed)) throw new Error("this tool runs read-only queries: start with SELECT or WITH");
  const rows = all(db, `SELECT * FROM (${trimmed}) LIMIT ${capped + 1}`);
  return { rows: rows.slice(0, capped), truncated: rows.length > capped, limit: capped };
}

function clampLimit(value: number | undefined, fallback: number, max: number): number {
  if (value === undefined) return fallback;
  if (!Number.isInteger(value) || value < 1) throw new Error(`limit ${value}: a whole number of 1 or more`);
  return Math.min(value, max);
}
