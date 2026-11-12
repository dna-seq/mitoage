/** Number formatting shared by Astro pages and Solid islands (no data imports here). */

const nf = (min: number, max: number) =>
  new Intl.NumberFormat("en-US", { minimumFractionDigits: min, maximumFractionDigits: max });

const INT = nf(0, 0);
const D1 = nf(0, 1);
const D2 = nf(2, 2);
const D3 = nf(3, 3);

export const isNum = (v: unknown): v is number => typeof v === "number" && Number.isFinite(v);

export const fmtInt = (v: number | null | undefined): string => (isNum(v) ? INT.format(v) : "–");

/** Up to `digits` decimals, trailing zeros trimmed. */
export const fmtNum = (v: number | null | undefined, digits = 2): string =>
  isNum(v) ? nf(0, digits).format(v) : "–";

export const fmtFixed = (v: number | null | undefined, digits = 2): string =>
  isNum(v) ? (digits === 2 ? D2 : digits === 3 ? D3 : nf(digits, digits)).format(v) : "–";

export const fmtPct = (v: number | null | undefined, digits = 2): string =>
  isNum(v) ? `${fmtFixed(v, digits)}%` : "–";

export const fmtSigned = (v: number | null | undefined, digits = 3): string => {
  if (!isNum(v)) return "–";
  const s = fmtFixed(Math.abs(v), digits);
  return v < 0 ? `−${s}` : v > 0 ? `+${s}` : s;
};

export const fmtBp = (v: number | null | undefined): string => (isNum(v) ? `${INT.format(v)} bp` : "–");

/** Compact lifespan: "122.5 yr", "4 yr", "8.4 mo". */
export const fmtLifespan = (years: number | null | undefined): string => {
  if (!isNum(years)) return "–";
  if (years < 1) return `${D1.format(years * 12)} mo`;
  return `${D1.format(years)} yr`;
};

/** Spelled-out lifespan for prose: "122.5 years", "1 year", "8.4 months". */
export const fmtLifespanLong = (years: number | null | undefined): string => {
  if (!isNum(years)) return "unknown";
  if (years < 1) {
    const m = years * 12;
    return `${D1.format(m)} ${m === 1 ? "month" : "months"}`;
  }
  return `${D1.format(years)} ${years === 1 ? "year" : "years"}`;
};

/** Grams to a readable mass: "850 g", "62 kg", "136 t". */
export const fmtMass = (grams: number | null | undefined): string => {
  if (!isNum(grams)) return "–";
  if (grams >= 1e6) return `${D1.format(grams / 1e6)} t`;
  if (grams >= 1000) return `${D1.format(grams / 1000)} kg`;
  if (grams >= 1) return `${D1.format(grams)} g`;
  return `${nf(0, 3).format(grams * 1000)} mg`;
};

/** Days to a readable duration: "280 days", "4.5 years". */
export const fmtDays = (days: number | null | undefined): string => {
  if (!isNum(days)) return "–";
  if (days >= 730) return `${D1.format(days / 365.25)} years`;
  return `${INT.format(days)} days`;
};

export const fmtKelvinAsCelsius = (k: number | null | undefined): string =>
  isNum(k) ? `${D1.format(k - 273.15)} °C` : "–";

export const fmtDate = (iso: string): string => {
  const d = new Date(iso);
  return Number.isNaN(d.getTime())
    ? iso
    : d.toLocaleDateString("en-GB", { year: "numeric", month: "long", day: "numeric" });
};

export const fmtBytes = (n: number): string => {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${D1.format(n / 1024)} KB`;
  return `${D1.format(n / 1024 / 1024)} MB`;
};

export const plural = (n: number, one: string, many = `${one}s`): string =>
  `${fmtInt(n)} ${n === 1 ? one : many}`;

/** 1 -> "1st", 22 -> "22nd", 113 -> "113th". */
export const ordinal = (n: number): string => {
  const m100 = n % 100;
  const suffix = m100 >= 11 && m100 <= 13 ? "th" : (["th", "st", "nd", "rd"][n % 10] ?? "th");
  return `${fmtInt(n)}${suffix}`;
};
