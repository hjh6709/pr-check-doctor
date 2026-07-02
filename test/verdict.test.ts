import { describe, expect, it } from "vitest";
import { calculateVerdict } from "../src/verdict.js";
import type { ClassifiedIssue } from "../src/types.js";

const baseIssue: ClassifiedIssue = {
  checkName: "lint",
  category: "lint_failure",
  conclusion: "failure",
  blocksMerge: true,
  likelyCause: "Lint failed."
};

describe("calculateVerdict", () => {
  it("returns PASS when there are no issues", () => {
    expect(calculateVerdict([])).toBe("PASS");
  });

  it("returns BLOCK when at least one issue blocks merge", () => {
    expect(calculateVerdict([baseIssue])).toBe("BLOCK");
  });

  it("returns WARN when issues are non-blocking", () => {
    expect(calculateVerdict([{ ...baseIssue, blocksMerge: false }])).toBe("WARN");
  });
});
