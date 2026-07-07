import { describe, expect, it } from "vitest";
import { renderComment } from "../src/comment.js";

describe("renderComment", () => {
  it("renders a stable PR triage comment", () => {
    const markdown = renderComment({
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
    });

    expect(markdown).toContain("<!-- pr-check-doctor -->");
    expect(markdown).toContain("## PR Check Doctor");
    expect(markdown).toContain("Verdict: BLOCK");
    expect(markdown).toContain("race_detected");
    expect(markdown).toContain("WARNING: DATA RACE");
    expect(markdown).toContain("go test -race -cover ./...");
  });

  it("renders incomplete triage warnings", () => {
    const markdown = renderComment({
      verdict: "PASS",
      warnings: [
        "Some checks are still running or queued: unit tests. Run this action as the final job with `if: always()` and `needs` to avoid incomplete triage."
      ],
      issues: []
    });

    expect(markdown).toContain("### Warnings");
    expect(markdown).toContain("Some checks are still running or queued: unit tests.");
    expect(markdown).toContain("`if: always()`");
    expect(markdown).toContain("`needs`");
  });
});
