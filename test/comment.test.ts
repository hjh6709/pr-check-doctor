import { describe, expect, it } from "vitest";
import { renderComment } from "../src/comment.js";

describe("renderComment", () => {
  it("renders a stable PR triage comment", () => {
    const markdown = renderComment(
      {
        verdict: "BLOCK",
        warnings: [],
        issues: [
          {
            checkName: "go-lint / go test -race (apps/api)",
            workflowName: "go-lint",
            category: "race_detected",
            conclusion: "failure",
            blocksMerge: true,
            likelyCause: "Go race detector reported a data race.",
            localCommand: "cd apps/api\ngo test -race -cover ./...",
            snippet: {
              text: "WARNING: DATA RACE",
              truncated: false
            }
          }
        ]
      },
      "en"
    );

    expect(markdown).toContain("<!-- pr-check-doctor -->");
    expect(markdown).toContain("## PR Check Doctor");
    expect(markdown).toContain("Verdict: BLOCK");
    expect(markdown).toContain("race_detected");
    expect(markdown).toContain("WARNING: DATA RACE");
    expect(markdown).toContain("go test -race -cover ./...");
  });

  it("renders incomplete triage warnings", () => {
    const markdown = renderComment(
      {
        verdict: "PASS",
        warnings: [
          "Some checks are still running or queued: unit tests. Run this action as the final job with `if: always()` and `needs` to avoid incomplete triage."
        ],
        issues: []
      },
      "en"
    );

    expect(markdown).toContain("### Warnings");
    expect(markdown).toContain("Some checks are still running or queued: unit tests.");
    expect(markdown).toContain("`if: always()`");
    expect(markdown).toContain("`needs`");
    // Failed Checks needs its own heading so "No failed checks" doesn't read as a stray
    // line under Warnings.
    expect(markdown).toContain("### Failed Checks\n\nNo failed or blocking checks were found.");
  });

  it("renders headings and labels in Korean when language is ko", () => {
    const markdown = renderComment(
      {
        verdict: "BLOCK",
        warnings: [],
        issues: [
          {
            checkName: "lint",
            category: "lint_failure",
            conclusion: "failure",
            blocksMerge: true,
            likelyCause: "린트 검사에서 코드 품질 문제가 발견됐습니다.",
            localCommand: "npx eslint ."
          }
        ]
      },
      "ko"
    );

    expect(markdown).toContain("판정: BLOCK");
    expect(markdown).toContain("### 실패한 체크");
    expect(markdown).toContain("카테고리: lint_failure");
    expect(markdown).toContain("영향: 머지 차단");
    expect(markdown).toContain("예상 원인: 린트 검사에서 코드 품질 문제가 발견됐습니다.");
    expect(markdown).toContain("로컬 재현:");
    expect(markdown).toContain("### 다음 조치");
    expect(markdown).toContain("`lint`를 수정하거나 확인하세요.");
  });
});
