import { describe, expect, test } from "bun:test";
import { fmtCompact, fmtP, fmtR, fmtSignedTick } from "./format";
import { scopeSlug } from "./wire";

describe("explorer formatters", () => {
  test("compact ticks", () => {
    expect(fmtCompact(0)).toBe("0");
    expect(fmtCompact(0.0001)).toBe("1e−4");
    expect(fmtCompact(0.05)).toBe("0.05");
    expect(fmtCompact(2500)).toBe("2,500");
    expect(fmtCompact(16000)).toBe("16k");
    expect(fmtCompact(2_000_000)).toBe("2M");
    expect(fmtCompact(-15000)).toBe("−15k");
  });

  test("p-values", () => {
    expect(fmtP(0.5)).toBe("0.5");
    expect(fmtP(0.032)).toBe("0.03");
    expect(fmtP(0.0042)).toBe("0.004");
    expect(fmtP(4.1e-5)).toBe("4.1 × 10⁻⁵");
    expect(fmtP(1.9e-15)).toBe("1.9 × 10⁻¹⁵");
    expect(fmtP(0)).toBe("< 10⁻³⁰⁰");
    expect(fmtP(null)).toBe("–");
  });

  test("signed values use a real minus sign", () => {
    expect(fmtR(-0.2841)).toBe("−0.284");
    expect(fmtR(0.5, 2)).toBe("0.50");
    expect(fmtSignedTick(-0.2)).toBe("−0.2");
    expect(fmtSignedTick(0)).toBe("0");
  });

  test("scope slugs used in correlation file names", () => {
    expect(scopeSlug("all")).toBe("all");
    expect(scopeSlug("class:Mammalia")).toBe("class-mammalia");
    expect(scopeSlug("order:Primates")).toBe("order-primates");
  });
});
