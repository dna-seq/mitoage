/** Axis tick and value formatters for the explorer and compare views. Safe for islands. */
import { fmtNum, isNum } from "~/lib/format";

const MINUS = "−";

/** Compact number for axis ticks: 0.0001 -> "1e-4", 0.05 -> "0.05", 2500 -> "2,500", 16000 -> "16k", 2e6 -> "2M". */
export const fmtCompact = (v: number): string => {
  if (!isNum(v)) return "–";
  const a = Math.abs(v);
  const sign = v < 0 ? MINUS : "";
  if (a === 0) return "0";
  if (a >= 1e9) return `${sign}${fmtNum(a / 1e9, 1)}B`;
  if (a >= 1e6) return `${sign}${fmtNum(a / 1e6, 1)}M`;
  if (a >= 1e4) return `${sign}${fmtNum(a / 1e3, 1)}k`;
  if (a >= 1) return `${sign}${fmtNum(a, 2)}`;
  if (a >= 0.001) return `${sign}${fmtNum(a, 4)}`;
  const [m, e] = a.toExponential(0).split("e");
  return `${sign}${m}e${(e ?? "").replace("+", "").replace("-", MINUS)}`;
};

/** Signed number with a real minus sign, trailing zeros trimmed: -0.2 -> "−0.2". */
export const fmtSignedTick = (v: number, digits = 2): string =>
  !isNum(v) ? "–" : v === 0 ? "0" : `${v < 0 ? MINUS : ""}${fmtNum(Math.abs(v), digits)}`;

const SUP: Record<string, string> = {
  "0": "⁰", "1": "¹", "2": "²", "3": "³", "4": "⁴", "5": "⁵", "6": "⁶", "7": "⁷", "8": "⁸", "9": "⁹", "-": "⁻",
};

/** p-value for display: "0.032", "4.1 × 10⁻⁵", "< 10⁻³⁰⁰". */
export const fmtP = (p: number | null | undefined): string => {
  if (!isNum(p)) return "–";
  if (p === 0) return "< 10⁻³⁰⁰";
  if (p >= 0.001) return p >= 0.995 ? "1" : fmtNum(p, p >= 0.01 ? 2 : 3);
  const [m, e] = p.toExponential(1).split("e");
  const exp = String(Number(e))
    .split("")
    .map((c) => SUP[c] ?? c)
    .join("");
  return `${m} × 10${exp}`;
};

/** Correlation coefficient with a real minus sign: "−0.284", "0.512". */
export const fmtR = (r: number | null | undefined, digits = 3): string =>
  !isNum(r) ? "–" : `${r < 0 ? MINUS : ""}${Math.abs(r).toFixed(digits)}`;
