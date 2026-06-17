import { describe, it, expect } from "vitest";
import { formatCapDollars, parseCapDollars } from "../cap-format";

describe("formatCapDollars", () => {
  it("renders an empty string for null (no cap)", () => {
    expect(formatCapDollars(null)).toBe("");
  });

  it("renders dollar amounts with two decimals", () => {
    expect(formatCapDollars(10000)).toBe("100.00");
    expect(formatCapDollars(50)).toBe("0.50");
    expect(formatCapDollars(0)).toBe("0.00");
  });
});

describe("parseCapDollars", () => {
  it("treats an empty string as null (no cap)", () => {
    expect(parseCapDollars("")).toBe(null);
    expect(parseCapDollars("   ")).toBe(null);
  });

  it("parses dollar strings into smallest units", () => {
    expect(parseCapDollars("100")).toBe(10000);
    expect(parseCapDollars("100.00")).toBe(10000);
    expect(parseCapDollars("0.50")).toBe(50);
  });

  it("rounds fractional cents to the nearest cent", () => {
    expect(parseCapDollars("1.234")).toBe(123);
    expect(parseCapDollars("1.235")).toBe(124);
  });

  it("returns null for non-numeric input", () => {
    expect(parseCapDollars("nope")).toBe(null);
  });
});
