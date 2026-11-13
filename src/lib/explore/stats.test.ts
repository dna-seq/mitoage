/**
 * Reference values from SciPy 1.16 (scipy.stats.pearsonr and its confidence_interval, spearmanr,
 * linregress, t.sf, false_discovery_control).
 */
import { describe, expect, test } from "bun:test";
import { benjaminiHochberg as pipelineBH } from "../../../pipeline/lib/stats";
import {
  benjaminiHochberg,
  correlationCI,
  correlationP,
  describePairs,
  incompleteBeta,
  logGamma,
  ols,
  pearson,
  rank,
  spearman,
  strengthWord,
  tTwoTailed,
} from "./stats";

// Anscombe's quartet, data set I.
const AX = [10, 8, 13, 9, 11, 14, 6, 4, 12, 7, 5];
const AY = [8.04, 6.95, 7.58, 8.81, 8.33, 9.96, 7.24, 4.26, 10.84, 4.82, 5.68];

// Ties in both variables.
const TX = [1, 2, 2, 3, 4, 5, 5, 5, 6, 7];
const TY = [2, 1, 4, 3, 6, 5, 8, 7, 9, 9];

describe("special functions", () => {
  test("logGamma", () => {
    expect(logGamma(1)).toBeCloseTo(0, 12);
    expect(logGamma(5)).toBeCloseTo(Math.log(24), 12);
    expect(logGamma(0.5)).toBeCloseTo(Math.log(Math.sqrt(Math.PI)), 12);
    expect(logGamma(100.5)).toBeCloseTo(361.43554046777757, 9);
    expect(logGamma(3.7)).toBeCloseTo(1.428072326665388, 12);
  });

  test("incompleteBeta", () => {
    expect(incompleteBeta(0, 2, 3)).toBe(0);
    expect(incompleteBeta(1, 2, 3)).toBe(1);
    // I_0.5(a, a) = 0.5 by symmetry
    expect(incompleteBeta(0.5, 7, 7)).toBeCloseTo(0.5, 12);
    // I_x(1, 1) = x
    expect(incompleteBeta(0.3, 1, 1)).toBeCloseTo(0.3, 12);
  });

  test("two-tailed t p-values", () => {
    expect(tTwoTailed(2.228138852, 10)).toBeCloseTo(0.04999999999883648, 10);
    expect(tTwoTailed(1.96, 1000)).toBeCloseTo(0.05027318495574871, 10);
    expect(tTwoTailed(0.5, 3)).toBeCloseTo(0.651447964848151, 10);
    expect(tTwoTailed(-3.5, 25)).toBeCloseTo(0.0017654953143569567, 12);
    expect(tTwoTailed(8, 40) / 7.905084110104544e-10).toBeCloseTo(1, 6);
    // Very small p-values keep their relative precision.
    expect(tTwoTailed(20, 900) / 6.5190436278595085e-74).toBeCloseTo(1, 5);
    expect(tTwoTailed(0, 12)).toBeCloseTo(1, 12);
  });
});

describe("correlation", () => {
  test("Pearson r and p (Anscombe I)", () => {
    const r = pearson(AX, AY);
    expect(r).toBeCloseTo(0.8164205163448395, 12);
    expect(correlationP(r, AX.length)).toBeCloseTo(0.0021696288730788152, 12);
  });

  test("Spearman rho and p (Anscombe I)", () => {
    const rho = spearman(AX, AY);
    expect(rho).toBeCloseTo(0.8181818181818182, 12);
    expect(correlationP(rho, AX.length)).toBeCloseTo(0.0020831448404786904, 12);
  });

  test("ties", () => {
    expect(rank([3, 1, 4, 1, 5, 9, 2, 6, 5, 3])).toEqual([4.5, 1.5, 6, 1.5, 7.5, 10, 3, 9, 7.5, 4.5]);
    expect(pearson(TX, TY)).toBeCloseTo(0.9146014917318099, 12);
    expect(spearman(TX, TY)).toBeCloseTo(0.9198231868799304, 12);
    expect(correlationP(spearman(TX, TY), TX.length)).toBeCloseTo(0.00016396978464388082, 12);
  });

  test("perfect and degenerate cases", () => {
    expect(pearson([1, 2, 3, 4], [2, 4, 6, 8])).toBeCloseTo(1, 12);
    expect(pearson([1, 2, 3, 4], [8, 6, 4, 2])).toBeCloseTo(-1, 12);
    expect(correlationP(1, 10)).toBe(0);
    expect(Number.isNaN(pearson([1, 2], [3, 4]))).toBe(true);
    expect(Number.isNaN(pearson([1, 1, 1], [3, 4, 5]))).toBe(true);
    expect(Number.isNaN(correlationP(0.5, 2))).toBe(true);
  });

  test("non-finite pairs are dropped", () => {
    const x = [...AX, Number.NaN, 3];
    const y = [...AY, 4, Number.POSITIVE_INFINITY];
    expect(pearson(x, y)).toBeCloseTo(0.8164205163448395, 12);
    expect(describePairs(x, y).n).toBe(AX.length);
  });
});

describe("regression and summary", () => {
  test("OLS (Anscombe I)", () => {
    const fit = ols(AX, AY);
    expect(fit).not.toBeNull();
    expect(fit?.slope).toBeCloseTo(0.5000909090909091, 12);
    expect(fit?.intercept).toBeCloseTo(3.0000909090909103, 12);
    expect(fit?.r2).toBeCloseTo(0.666542459508775, 12);
    expect(ols([2, 2, 2], [1, 2, 3])).toBeNull();
  });

  test("log-transformed axis (lifespan-like data)", () => {
    const life = [0.3, 1, 4, 10, 30, 122.5, 211];
    const gc = [17.8, 40.1, 36.5, 38.2, 41.0, 44.4, 40.6];
    const s = describePairs(life.map(Math.log10), gc);
    expect(s.n).toBe(7);
    expect(s.pearsonR).toBeCloseTo(0.7399510678428796, 12);
    expect(s.pearsonP).toBeCloseTo(0.05724580742945648, 12);
    expect(s.spearmanRho).toBeCloseTo(0.7857142857142859, 12);
    expect(s.spearmanP).toBeCloseTo(0.03623846267982713, 12);
    expect(s.fit?.slope).toBeCloseTo(6.181829361903239, 10);
    expect(s.fit?.intercept).toBeCloseTo(30.788650804365062, 10);
  });

  test("strength words", () => {
    expect(strengthWord(0.05)).toBe("no clear");
    expect(strengthWord(-0.2)).toBe("weak");
    expect(strengthWord(0.42)).toBe("moderate");
    expect(strengthWord(-0.8)).toBe("strong");
    expect(strengthWord(Number.NaN)).toBe("no clear");
  });
});

describe("confidence interval and multiple testing", () => {
  test("Fisher z interval of r (Anscombe I)", () => {
    const r = pearson(AX, AY);
    const ci = correlationCI(r, AX.length);
    expect(ci?.[0]).toBeCloseTo(0.4243912133932152, 12);
    expect(ci?.[1]).toBeCloseTo(0.9506932537865604, 12);
  });

  test("the interval contains r, mirrors with its sign and narrows with n", () => {
    for (const r of [-0.9, -0.3, 0, 0.12, 0.7]) {
      const [lo, hi] = correlationCI(r, 25)!;
      expect(lo).toBeLessThan(r);
      expect(hi).toBeGreaterThan(r);
      const [mlo, mhi] = correlationCI(-r, 25)!;
      expect(mlo).toBeCloseTo(-hi, 12);
      expect(mhi).toBeCloseTo(-lo, 12);
      const [wlo, whi] = correlationCI(r, 400)!;
      expect(whi - wlo).toBeLessThan(hi - lo);
    }
  });

  test("no interval without enough pairs or a coefficient", () => {
    expect(correlationCI(0.5, 3)).toBeNull();
    expect(correlationCI(Number.NaN, 50)).toBeNull();
    expect(correlationCI(1, 10)).toEqual([1, 1]);
  });

  test("Benjamini-Hochberg q-values", () => {
    const q = benjaminiHochberg([0.01, 0.04, 0.03, 0.005, 0.2, 0.9]);
    [0.03, 0.06, 0.06, 0.03, 0.24, 0.9].forEach((v, i) => expect(q[i]).toBeCloseTo(v, 12));
  });

  test("missing p-values are not counted as tests, and the pipeline's procedure agrees", () => {
    const p = [0.2, null, 0.0004, Number.NaN, 0.03, 0.03, undefined, 0.8, 1e-9, 0.049];
    const q = benjaminiHochberg(p);
    const dense = p.filter((v): v is number => typeof v === "number" && Number.isFinite(v));
    const qDense = benjaminiHochberg(dense);
    const ref = pipelineBH(p.map((v) => (typeof v === "number" ? v : Number.NaN)));
    let k = 0;
    p.forEach((v, i) => {
      if (typeof v === "number" && Number.isFinite(v)) {
        expect(q[i]).toBeCloseTo(qDense[k++]!, 14);
        expect(q[i]).toBeCloseTo(ref[i]!, 14);
        expect(q[i]!).toBeGreaterThanOrEqual(v);
      } else expect(Number.isNaN(q[i]!)).toBe(true);
    });
    expect(benjaminiHochberg([])).toEqual([]);
  });
});
