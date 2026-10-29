import { describe, expect, it } from "vitest";

import { ApiError } from "./client";
import { cursorFrom } from "./cursor";

describe("ApiError", () => {
  it("reads the server's code, detail and field errors", () => {
    const err = new ApiError(400, { code: "invalid", detail: "Please correct the highlighted fields.", errors: { code: ["Use 1–3 capital letters."] } });
    expect(err.status).toBe(400);
    expect(err.code).toBe("invalid");
    expect(err.message).toBe("Please correct the highlighted fields.");
    expect(err.field("code")).toBe("Use 1–3 capital letters.");
    expect(err.field("name")).toBeUndefined();
  });

  it("keeps extra fields such as the duplicate contact", () => {
    const err = new ApiError(409, { code: "duplicate_email", detail: "Ravi already uses it.", existing: { id: "1" } });
    expect(err.body.existing).toEqual({ id: "1" });
  });

  it("survives a non-JSON body", () => {
    expect(new ApiError(502, undefined).message).toMatch(/Something went wrong/);
  });
});

describe("cursorFrom", () => {
  it("extracts the cursor from a next link", () => {
    expect(cursorFrom("http://localhost/api/v1/contacts?cursor=cD0yMDI2&q=a")).toBe("cD0yMDI2");
    expect(cursorFrom(null)).toBeUndefined();
  });
});
