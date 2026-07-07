import { describe, expect, it } from "vitest";
import { analyzeChecks } from "../src/analyze.js";
import { defaultConfig } from "../src/config.js";
import type { NormalizedCheck } from "../src/types.js";

describe("analyzeChecks", () => {
  it("classifies triage candidates and calculates a blocking verdict", () => {
    const checks: NormalizedCheck[] = [
      {
        name: "go test -race (apps/api)",
        conclusion: "failure",
        log: "WARNING: DATA RACE\nRead at 0x00"
      },
      {
        name: "format",
        conclusion: "success"
      }
    ];

    const result = analyzeChecks(checks, defaultConfig);

    expect(result.verdict).toBe("BLOCK");
    expect(result.issues).toHaveLength(1);
    expect(result.issues[0]?.category).toBe("race_detected");
  });

  it("returns PASS when no checks need triage", () => {
    const result = analyzeChecks([{ name: "unit tests", conclusion: "success" }], defaultConfig);

    expect(result).toEqual({
      verdict: "PASS",
      issues: [],
      warnings: []
    });
  });

  it("warns when checks are still running", () => {
    const result = analyzeChecks(
      [
        {
          name: "unit tests",
          conclusion: "unknown",
          status: "in_progress"
        }
      ],
      defaultConfig
    );

    expect(result.warnings).toEqual([
      "Some checks are still running or queued: unit tests. Run this action as the final job with `if: always()` and `needs` to avoid incomplete triage."
    ]);
  });
});
