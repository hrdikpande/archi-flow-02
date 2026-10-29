import { describe, expect, it } from "vitest";

import { addDays, isoWeek, mondayOf } from "./api";

describe("week maths", () => {
  it("finds the Monday on or before a date", () => {
    expect(mondayOf("2026-10-26")).toBe("2026-10-26"); // Monday
    expect(mondayOf("2026-11-01")).toBe("2026-10-26"); // Sunday belongs to the week before
    expect(mondayOf("2026-10-28")).toBe("2026-10-26");
  });

  it("numbers ISO weeks, including across the year end", () => {
    expect(isoWeek("2026-10-26")).toBe(44);
    expect(isoWeek("2026-12-28")).toBe(53); // 2026 has 53 ISO weeks
    expect(isoWeek("2027-01-04")).toBe(1);
    expect(isoWeek("2027-01-01")).toBe(53);
  });

  it("adds days without timezone drift", () => {
    expect(addDays("2026-10-26", 6)).toBe("2026-11-01");
    expect(addDays("2026-03-30", -7)).toBe("2026-03-23");
  });
});
