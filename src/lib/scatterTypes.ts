/** Types shared by the Scatter island and the build-time code that feeds it. Safe for islands. */

export interface ScatterPoint {
  /** Stable id, e.g. species slug. */
  id: string;
  x: number;
  y: number;
  /** Legend group key, e.g. "Mammalia". */
  group: string;
  /** Tooltip title, e.g. scientific name. */
  label: string;
  /** Tooltip subtitle, e.g. common name. */
  sub?: string;
  /** Short label drawn next to key points, e.g. "Human". */
  short?: string;
  /** Where a click/tap-again goes. */
  href?: string;
}

export interface ScatterGroup {
  key: string;
  label: string;
  /** Any CSS colour, typically "var(--class-mammalia)". */
  color: string;
}

/** Columnar wire format used by static JSON endpoints (smaller than an array of objects). */
export interface ScatterPayload {
  id: string[];
  x: number[];
  y: number[];
  group: string[];
  label: string[];
  sub: string[];
  href: string[];
}

export const payloadToPoints = (p: ScatterPayload): ScatterPoint[] =>
  p.id.map((id, i) => {
    const pt: ScatterPoint = {
      id,
      x: p.x[i] ?? Number.NaN,
      y: p.y[i] ?? Number.NaN,
      group: p.group[i] ?? "",
      label: p.label[i] ?? id,
    };
    const sub = p.sub[i];
    const href = p.href[i];
    if (sub) pt.sub = sub;
    if (href) pt.href = href;
    return pt;
  });

export const pointsToPayload = (pts: readonly ScatterPoint[]): ScatterPayload => ({
  id: pts.map((p) => p.id),
  x: pts.map((p) => p.x),
  y: pts.map((p) => p.y),
  group: pts.map((p) => p.group),
  label: pts.map((p) => p.label),
  sub: pts.map((p) => p.sub ?? ""),
  href: pts.map((p) => p.href ?? ""),
});
