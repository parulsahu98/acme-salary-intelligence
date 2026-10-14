import { describe, expect, it } from "vitest";
import { isValidSalary, salaryDistribution } from "../src/domain/salary.js";

describe("currency-aware salary validation", () => {
  it("accepts positive amounts using the currency's minor unit precision", () => {
    expect(isValidSalary("1250.75", "USD")).toBe(true);
    expect(isValidSalary("5000", "JPY")).toBe(true);
    expect(isValidSalary("123.456", "BHD")).toBe(true);
  });

  it("rejects zero, excess precision, negative, and non-decimal input", () => {
    expect(isValidSalary("0.00", "USD")).toBe(false);
    expect(isValidSalary("1.001", "USD")).toBe(false);
    expect(isValidSalary("100.1", "JPY")).toBe(false);
    expect(isValidSalary("-4", "BHD")).toBe(false);
    expect(isValidSalary("1e5", "USD")).toBe(false);
  });
});

describe("salary analytics helpers", () => {
  it("calculates odd and even medians without mutating its input", () => {
    const input = ["9", "1", "5", "3"];
    expect(salaryDistribution(input, "USD").median).toBe("4.00");
    expect(input).toEqual(["9", "1", "5", "3"]);
    expect(salaryDistribution(["9", "1", "5"], "USD").median).toBe("5.00");
    expect(salaryDistribution([], "USD").median).toBeNull();
  });

  it("assigns relative quartile bands independently within the currency", () => {
    expect(salaryDistribution(["10", "20", "30", "40"], "USD").bands).toEqual({
      lower: 1,
      middle: 2,
      upper: 1,
    });
  });

  it("calculates financial medians with decimal arithmetic and currency-specific rounding", () => {
    expect(salaryDistribution(["1.00", "1.01"], "USD").median).toBe("1.01");
    expect(salaryDistribution(["100.001", "100.002"], "BHD").median).toBe(
      "100.002",
    );
    expect(salaryDistribution(["100", "200"], "JPY").median).toBe("150");
  });
});
