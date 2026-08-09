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

  it("localizes the incomplete triage warning when comment.language is ko", () => {
    const result = analyzeChecks(
      [{ name: "unit tests", conclusion: "unknown", status: "in_progress" }],
      { ...defaultConfig, comment: { ...defaultConfig.comment, language: "ko" } }
    );

    expect(result.warnings).toEqual([
      "아직 실행 중이거나 대기 중인 체크가 있습니다: unit tests. 불완전한 triage를 피하려면 이 action을 `if: always()`와 `needs`로 마지막 job에 배치하세요."
    ]);
  });

  it("suggests a workflow_run setup when a pending check names its workflow", () => {
    const result = analyzeChecks(
      [
        {
          name: "CodeQL (go)",
          workflowName: "codeql",
          conclusion: "unknown",
          status: "in_progress"
        }
      ],
      defaultConfig
    );

    expect(result.warnings).toEqual([
      "Some checks are still running or queued: CodeQL (go) (workflow: codeql). Run this action as the final job with `if: always()` and `needs` to avoid incomplete triage. If those checks run in a separate workflow, trigger this action from `workflow_run` instead and list them: `workflows: [\"codeql\"]` — see the README's Fork Pull Requests section."
    ]);
  });

  it("dedupes workflow names across multiple pending checks in the same workflow", () => {
    const result = analyzeChecks(
      [
        {
          name: "CodeQL (go)",
          workflowName: "codeql",
          conclusion: "unknown",
          status: "in_progress"
        },
        {
          name: "CodeQL (javascript-typescript)",
          workflowName: "codeql",
          conclusion: "unknown",
          status: "in_progress"
        }
      ],
      defaultConfig
    );

    expect(result.warnings[0]).toContain('`workflows: ["codeql"]`');
  });
});
