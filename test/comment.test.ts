import { describe, expect, it } from "vitest";
import { renderComment } from "../src/comment.js";

describe("renderComment", () => {
  it("renders a stable PR triage comment", () => {
    const markdown = renderComment({
      verdict: "BLOCK",
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
});
