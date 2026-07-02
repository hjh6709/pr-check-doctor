import { describe, expect, it } from "vitest";
import { selectTriageCandidates } from "../src/checks.js";
import type { NormalizedCheck } from "../src/types.js";

describe("selectTriageCandidates", () => {
  it("keeps failed, cancelled, and timed out checks", () => {
    const checks: NormalizedCheck[] = [
      { name: "unit tests", conclusion: "failure" },
      { name: "lint", conclusion: "cancelled" },
      { name: "build", conclusion: "timed_out" },
      { name: "format", conclusion: "success" }
    ];

    expect(selectTriageCandidates(checks).map((check) => check.name)).toEqual([
      "unit tests",
      "lint",
      "build"
    ]);
  });

  it("keeps action required and startup failure checks as actionable failures", () => {
    const checks: NormalizedCheck[] = [
      { name: "license gate", conclusion: "action_required" },
      { name: "setup", conclusion: "startup_failure" },
      { name: "docs", conclusion: "skipped" },
      { name: "unknown", conclusion: "unknown" }
    ];

    expect(selectTriageCandidates(checks).map((check) => check.name)).toEqual([
      "license gate",
      "setup"
    ]);
  });
});
