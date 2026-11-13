/** CSV writing and browser downloads. Safe for islands and endpoints. */

const cell = (v: string | number | null | undefined): string => {
  if (v === null || v === undefined) return "";
  if (typeof v === "number") {
    if (!Number.isFinite(v)) return "";
    // Up to 6 decimals, no exponent for ordinary values, trailing zeros trimmed.
    return Math.abs(v) >= 1e-6 || v === 0 ? String(Number(v.toFixed(6))) : v.toExponential(4);
  }
  return /[",\r\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v;
};

/** RFC 4180 CSV with a header row and CRLF line ends. */
export const toCsv = (header: readonly string[], rows: readonly (readonly (string | number | null | undefined)[])[]): string =>
  [header.map(cell).join(","), ...rows.map((r) => r.map(cell).join(","))].join("\r\n") + "\r\n";

/** Offer text as a file download (browser only). */
export function downloadText(filename: string, text: string, type = "text/plain"): void {
  const url = URL.createObjectURL(new Blob([text], { type: `${type};charset=utf-8` }));
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
