import { describe, expect, it } from "vitest";
import { buildSeries, dueStatus, nextDue, periodRange, shiftEarnings, shiftMinutes, toMinor } from "./finance";

describe("finance rules", () => {
  it("09:00-15:00 with 30 min break at £12.50 = 5.5h, £68.75", () => {
    const m = shiftMinutes("09:00", "15:00", 30);
    expect(m).toBe(330);
    expect(shiftEarnings(m, 1250)).toBe(6875);
  });
  it("overnight shift 22:00-02:00 = 4h", () => {
    expect(shiftMinutes("22:00", "02:00", 0)).toBe(240);
  });
  it("parses money to pence without float errors", () => {
    expect(toMinor("18.50")).toBe(1850);
    expect(toMinor("0.1")).toBe(10);
    expect(Number.isNaN(toMinor("abc"))).toBe(true);
  });
  it("weeks run Monday to Sunday", () => {
    const r = periodRange("this-week", 1, new Date(2026, 10, 6)); // Fri 6 Nov 2026
    expect(r).toEqual({ from: "2026-11-02", to: "2026-11-08" });
  });
  it("monthly rent rolls forward one month", () => {
    expect(nextDue("2026-01-31", "monthly")).toBe("2026-02-28");
  });
  it("unpaid past due is overdue; never auto-paid", () => {
    expect(dueStatus("2026-01-01", 1000, 0, new Date(2026, 0, 5))).toBe("overdue");
    expect(dueStatus("2026-01-01", 1000, 1000, new Date(2026, 0, 5))).toBe("paid");
  });
  it("series totals match inputs", () => {
    const s = buildSeries({ from: "2026-11-02", to: "2026-11-08" }, [{ date: "2026-11-03", amount: 6875 }], [{ date: "2026-11-03", amount: 1850 }]);
    expect(s[1]).toMatchObject({ income: 68.75, expense: 18.5 });
  });
});
