import { describe, expect, it } from "vitest";

import { paramsToFilters } from "./ExportButton";

describe("paramsToFilters", () => {
  it("keeps list filters as lists and the rest as single values", () => {
    const params = new URLSearchParams("discipline=a&discipline=b&state=issued&q=plan&late=1&group=");
    expect(paramsToFilters(params)).toEqual({ discipline: ["a", "b"], state: ["issued"], q: "plan", late: "1" });
  });

  it("is empty without params", () => {
    expect(paramsToFilters()).toEqual({});
  });
});
