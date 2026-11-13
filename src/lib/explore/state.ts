/**
 * Explorer view state <-> query string, so every view is a shareable link:
 *   /compare/plot/?x=maxLongevityYears&y=gc:ND6&logx=1&scope=class:Mammalia&highlight=homo-sapiens,mus-musculus&fit=1
 * Absent params take defaults; log flags default per variable (null = "use the variable's default").
 */

export interface ExploreState {
  x: string;
  y: string;
  logX: boolean | null;
  logY: boolean | null;
  /** "all", "class:Mammalia" or "order:Primates". */
  scope: string;
  highlight: string[];
  fit: boolean;
}

/** mtDNA first: GC content against GC skew of the whole genome. Lifespan is one click away. */
export const DEFAULT_X = "gc:total_mtDNA";
export const DEFAULT_Y = "gcSkew:total_mtDNA";
export const MAX_HIGHLIGHTS = 8;

export const DEFAULT_STATE: ExploreState = {
  x: DEFAULT_X,
  y: DEFAULT_Y,
  logX: null,
  logY: null,
  scope: "all",
  highlight: [],
  fit: false,
};

const bool = (v: string | null): boolean | null => {
  if (v === null) return null;
  if (v === "1" || v === "true" || v === "yes") return true;
  if (v === "0" || v === "false" || v === "no") return false;
  return null;
};

const SLUG = /^[a-z0-9][a-z0-9-]*$/;
const SCOPE = /^(?:all|(?:class|order):[A-Za-z][A-Za-z-]*)$/;

/**
 * Parse a query string. `isVar` validates axis keys; `isScope` validates scopes against the data
 * (unknown values fall back to defaults instead of breaking the page).
 */
export function parseState(
  search: string,
  isVar: (key: string) => boolean,
  isScope: (scope: string) => boolean = (s) => SCOPE.test(s),
): ExploreState {
  const q = new URLSearchParams(search);
  const x = q.get("x");
  const y = q.get("y");
  const scope = q.get("scope");
  const highlight = (q.get("highlight") ?? "")
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .filter((s, i, a) => SLUG.test(s) && a.indexOf(s) === i)
    .slice(0, MAX_HIGHLIGHTS);
  return {
    x: x && isVar(x) ? x : DEFAULT_X,
    y: y && isVar(y) ? y : DEFAULT_Y,
    logX: bool(q.get("logx")),
    logY: bool(q.get("logy")),
    scope: scope && SCOPE.test(scope) && isScope(scope) ? scope : "all",
    highlight,
    fit: bool(q.get("fit")) ?? false,
  };
}

/** Keep ":" and "," readable in links (both are allowed in a query string). */
const enc = (s: string): string => encodeURIComponent(s).replace(/%3A/gi, ":").replace(/%2C/gi, ",");

/**
 * Query string for a state, x and y always present, everything else only when it differs from the
 * default. `defaultLog` tells which log flags are implied by the variables.
 */
export function serializeState(s: ExploreState, defaultLog: (key: string) => boolean): string {
  const parts: [string, string][] = [
    ["x", s.x],
    ["y", s.y],
  ];
  if (s.logX !== null && s.logX !== defaultLog(s.x)) parts.push(["logx", s.logX ? "1" : "0"]);
  if (s.logY !== null && s.logY !== defaultLog(s.y)) parts.push(["logy", s.logY ? "1" : "0"]);
  if (s.scope !== "all") parts.push(["scope", s.scope]);
  if (s.highlight.length) parts.push(["highlight", s.highlight.join(",")]);
  if (s.fit) parts.push(["fit", "1"]);
  return `?${parts.map(([k, v]) => `${k}=${enc(v)}`).join("&")}`;
}
