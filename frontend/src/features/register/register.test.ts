import { describe, expect, it } from "vitest";

import { matchSheet } from "./UploadPdfs";
import { flagFor } from "./useSheets";

const sheets = [
  { id: "1", number: "A-101", aliases: [] },
  { id: "2", number: "A-101A", aliases: [] },
  { id: "3", number: "M-205", aliases: ["M-204"] },
];

describe("matchSheet (UploadDropzone)", () => {
  it("matches the sheet number inside the file name", () => {
    expect(matchSheet("A-101 Ground Floor Plan P03.pdf", sheets)).toBe("1");
    expect(matchSheet("a-101a.pdf", sheets)).toBe("2");
  });
  it("matches an old number kept as an alias", () => {
    expect(matchSheet("M-204_rev.pdf", sheets)).toBe("3");
  });
  it("does not match partial numbers", () => {
    expect(matchSheet("A101.pdf", sheets)).toBe("");
    expect(matchSheet("A-1010.pdf", sheets)).toBe("");
  });
});

describe("flagFor (DESIGN.md §2.3 texts)", () => {
  const base = { rule: "A-01", raised_at: "2026-10-23T02:30:00Z", escalated: false };
  it("at risk", () => {
    expect(flagFor({ ...base, kind: "at_risk", days: 4 }).text).toBe("Due in 4 days");
    expect(flagFor({ ...base, kind: "at_risk", days: 1 }).text).toBe("Due in 1 day");
    expect(flagFor({ ...base, kind: "at_risk", days: 0 }).text).toBe("Due today");
  });
  it("late, with escalation detail", () => {
    const flag = flagFor({ ...base, kind: "late", rule: "A-02", days: 3, escalated: true });
    expect(flag.text).toBe("Late 3 days");
    expect(flag.detail).toContain("Escalated");
  });
});
