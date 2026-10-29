import { describe, expect, it } from "vitest";

import { formatDate, formatDateTime, formatINR, formatNumber, formatTime } from "./format";

describe("N-08 display formats", () => {
  it("formats dates as DD-Mon-YYYY", () => {
    expect(formatDate("2026-10-23")).toBe("23-Oct-2026");
    expect(formatDate("2026-09-01")).toBe("01-Sep-2026"); // not "Sept"
  });

  it("never shifts date-only values by timezone", () => {
    expect(formatDate("2026-01-01", "America/Los_Angeles")).toBe("01-Jan-2026");
  });

  it("shows instants in the organisation timezone (IST by default)", () => {
    expect(formatDateTime("2026-10-23T18:45:00Z")).toBe("24-Oct-2026 00:15");
    expect(formatTime("2026-10-23T09:00:00Z", "Asia/Kolkata")).toBe("14:30");
  });

  it("returns empty text for missing or invalid values", () => {
    expect(formatDate(null)).toBe("");
    expect(formatDate("not a date")).toBe("");
    expect(formatINR(undefined)).toBe("");
  });

  it("formats rupees with Indian digit grouping", () => {
    expect(formatINR(100000)).toBe("₹1,00,000");
    expect(formatINR(3840000)).toBe("₹38,40,000");
    expect(formatINR("1250.5")).toBe("₹1,250.50");
    expect(formatNumber(10000000)).toBe("1,00,00,000");
  });
});
