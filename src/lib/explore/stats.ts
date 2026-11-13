/**
 * Correlation statistics computed in the browser by the plot explorer. Pure functions,
 * no dependencies, safe for islands. Checked against SciPy in stats.test.ts.
 *
 *   const s = describePairs(xs, ys);   // n, Pearson r, Spearman rho, p-values, OLS fit
 */

const finitePairs = (x: ArrayLike<number>, y: ArrayLike<number>): [number[], number[]] => {
  const xs: number[] = [];
  const ys: number[] = [];
  const n = Math.min(x.length, y.length);
  for (let i = 0; i < n; i++) {
    const a = x[i]!;
    const b = y[i]!;
    if (Number.isFinite(a) && Number.isFinite(b)) {
      xs.push(a);
      ys.push(b);
    }
  }
  return [xs, ys];
};

const mean = (v: readonly number[]): number => {
  let s = 0;
  for (const x of v) s += x;
  return s / v.length;
};

/** Pearson product-moment correlation. NaN when fewer than 3 pairs or a variable is constant. */
export function pearson(x: ArrayLike<number>, y: ArrayLike<number>): number {
  const [xs, ys] = finitePairs(x, y);
  const n = xs.length;
  if (n < 3) return Number.NaN;
  const mx = mean(xs);
  const my = mean(ys);
  let sxy = 0;
  let sxx = 0;
  let syy = 0;
  for (let i = 0; i < n; i++) {
    const dx = xs[i]! - mx;
    const dy = ys[i]! - my;
    sxy += dx * dy;
    sxx += dx * dx;
    syy += dy * dy;
  }
  if (sxx === 0 || syy === 0) return Number.NaN;
  return Math.max(-1, Math.min(1, sxy / Math.sqrt(sxx * syy)));
}

/** Ranks starting at 1; ties get the average of the ranks they span. */
export function rank(v: readonly number[]): number[] {
  const idx = v.map((_, i) => i).sort((a, b) => v[a]! - v[b]!);
  const out = new Array<number>(v.length);
  let i = 0;
  while (i < idx.length) {
    let j = i;
    while (j + 1 < idx.length && v[idx[j + 1]!] === v[idx[i]!]) j++;
    const r = (i + j) / 2 + 1;
    for (let k = i; k <= j; k++) out[idx[k]!] = r;
    i = j + 1;
  }
  return out;
}

/** Spearman rank correlation (Pearson on average ranks, so ties are handled). */
export function spearman(x: ArrayLike<number>, y: ArrayLike<number>): number {
  const [xs, ys] = finitePairs(x, y);
  if (xs.length < 3) return Number.NaN;
  return pearson(rank(xs), rank(ys));
}

// ---------------------------------------------------------------- t distribution

/** ln Γ(x), Lanczos approximation (g = 7, n = 9), accurate to ~1e-15 for x > 0. */
export function logGamma(x: number): number {
  const c = [
    0.99999999999980993, 676.5203681218851, -1259.1392167224028, 771.32342877765313, -176.61502916214059,
    12.507343278686905, -0.13857109526572012, 9.9843695780195716e-6, 1.5056327351493116e-7,
  ];
  if (x < 0.5) return Math.log(Math.PI / Math.abs(Math.sin(Math.PI * x))) - logGamma(1 - x);
  const z = x - 1;
  let a = c[0]!;
  const t = z + 7.5;
  for (let i = 1; i < 9; i++) a += c[i]! / (z + i);
  return 0.5 * Math.log(2 * Math.PI) + (z + 0.5) * Math.log(t) - t + Math.log(a);
}

/** Continued fraction for the incomplete beta function (modified Lentz). */
function betaContinuedFraction(x: number, a: number, b: number): number {
  const TINY = 1e-300;
  const EPS = 1e-15;
  const qab = a + b;
  const qap = a + 1;
  const qam = a - 1;
  let c = 1;
  let d = 1 - (qab * x) / qap;
  if (Math.abs(d) < TINY) d = TINY;
  d = 1 / d;
  let h = d;
  for (let m = 1; m <= 500; m++) {
    const m2 = 2 * m;
    let aa = (m * (b - m) * x) / ((qam + m2) * (a + m2));
    d = 1 + aa * d;
    if (Math.abs(d) < TINY) d = TINY;
    c = 1 + aa / c;
    if (Math.abs(c) < TINY) c = TINY;
    d = 1 / d;
    h *= d * c;
    aa = (-(a + m) * (qab + m) * x) / ((a + m2) * (qap + m2));
    d = 1 + aa * d;
    if (Math.abs(d) < TINY) d = TINY;
    c = 1 + aa / c;
    if (Math.abs(c) < TINY) c = TINY;
    d = 1 / d;
    const del = d * c;
    h *= del;
    if (Math.abs(del - 1) < EPS) break;
  }
  return h;
}

/** Regularised incomplete beta function I_x(a, b). */
export function incompleteBeta(x: number, a: number, b: number): number {
  if (x <= 0) return 0;
  if (x >= 1) return 1;
  const lnFront = logGamma(a + b) - logGamma(a) - logGamma(b) + a * Math.log(x) + b * Math.log(1 - x);
  const front = Math.exp(lnFront);
  // Use the symmetry relation where the continued fraction converges fastest.
  if (x < (a + 1) / (a + b + 2)) return (front * betaContinuedFraction(x, a, b)) / a;
  return 1 - (front * betaContinuedFraction(1 - x, b, a)) / b;
}

/** Two-tailed p-value of Student's t with `df` degrees of freedom. */
export function tTwoTailed(t: number, df: number): number {
  if (!Number.isFinite(t)) return Number.isNaN(t) ? Number.NaN : 0;
  if (df <= 0) return Number.NaN;
  // P(|T| > t) = I_{df/(df+t^2)}(df/2, 1/2); computed directly so tiny p-values keep precision.
  return Math.min(1, incompleteBeta(df / (df + t * t), df / 2, 0.5));
}

/** Two-tailed p-value for a correlation coefficient r from n pairs (t test, n - 2 df). */
export function correlationP(r: number, n: number): number {
  if (!Number.isFinite(r) || n < 3) return Number.NaN;
  const df = n - 2;
  if (Math.abs(r) >= 1) return 0;
  const t = r * Math.sqrt(df / (1 - r * r));
  return tTwoTailed(t, df);
}

// ---------------------------------------------------------------- regression

export interface OlsFit {
  slope: number;
  intercept: number;
  /** Coefficient of determination. */
  r2: number;
}

/** Ordinary least squares y = intercept + slope * x. Null when x is constant or n < 3. */
export function ols(x: ArrayLike<number>, y: ArrayLike<number>): OlsFit | null {
  const [xs, ys] = finitePairs(x, y);
  const n = xs.length;
  if (n < 3) return null;
  const mx = mean(xs);
  const my = mean(ys);
  let sxy = 0;
  let sxx = 0;
  let syy = 0;
  for (let i = 0; i < n; i++) {
    const dx = xs[i]! - mx;
    const dy = ys[i]! - my;
    sxy += dx * dy;
    sxx += dx * dx;
    syy += dy * dy;
  }
  if (sxx === 0) return null;
  const slope = sxy / sxx;
  return { slope, intercept: my - slope * mx, r2: syy === 0 ? 0 : (sxy * sxy) / (sxx * syy) };
}

// ---------------------------------------------------------------- summary

export interface PairStats {
  n: number;
  pearsonR: number;
  /** Two-tailed p for Pearson r. */
  pearsonP: number;
  spearmanRho: number;
  /** Two-tailed p for Spearman rho (t approximation, as in SciPy). */
  spearmanP: number;
  fit: OlsFit | null;
}

/** Everything the explorer shows for a set of (already transformed) pairs. */
export function describePairs(x: ArrayLike<number>, y: ArrayLike<number>): PairStats {
  const [xs, ys] = finitePairs(x, y);
  const n = xs.length;
  const r = pearson(xs, ys);
  const rho = spearman(xs, ys);
  return {
    n,
    pearsonR: r,
    pearsonP: correlationP(r, n),
    spearmanRho: rho,
    spearmanP: correlationP(rho, n),
    fit: ols(xs, ys),
  };
}

/** Plain-language strength of a correlation coefficient. */
export function strengthWord(r: number): "no clear" | "weak" | "moderate" | "strong" {
  const a = Math.abs(r);
  if (!Number.isFinite(a) || a < 0.1) return "no clear";
  if (a < 0.3) return "weak";
  if (a < 0.5) return "moderate";
  return "strong";
}

// ---------------------------------------------------------------- intervals and multiple testing

/**
 * Confidence interval of a correlation coefficient from n pairs, by Fisher's z transformation
 * (95% by default). Null when r is not finite or there are fewer than 4 pairs.
 */
export function correlationCI(r: number, n: number, z = 1.959963984540054): [number, number] | null {
  if (!Number.isFinite(r) || n < 4) return null;
  if (Math.abs(r) >= 1) return [r, r];
  const zr = Math.atanh(r);
  const se = 1 / Math.sqrt(n - 3);
  return [Math.tanh(zr - z * se), Math.tanh(zr + z * se)];
}

/**
 * Benjamini-Hochberg adjusted q-values. Missing and non-finite p-values stay NaN and are not
 * counted as tests. Same procedure as the pipeline's (pipeline/lib/stats.ts); stats.test.ts
 * checks that the two agree.
 */
export function benjaminiHochberg(p: ArrayLike<number | null | undefined>): number[] {
  const valid: [number, number][] = [];
  const q: number[] = [];
  for (let i = 0; i < p.length; i++) {
    const v = p[i];
    q.push(Number.NaN);
    if (v !== null && v !== undefined && Number.isFinite(v)) valid.push([v, i]);
  }
  valid.sort((a, b) => a[0] - b[0]);
  const m = valid.length;
  let prev = 1;
  for (let k = m - 1; k >= 0; k--) {
    const [v, i] = valid[k]!;
    prev = Math.min(prev, (v * m) / (k + 1));
    q[i] = Math.min(1, prev);
  }
  return q;
}
