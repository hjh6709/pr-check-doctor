import { describe, expect, it } from "vitest";
import { classifyCheck } from "../src/classifier.js";
import { defaultConfig } from "../src/config.js";

describe("classifyCheck", () => {
  it("uses config category and command before built-in patterns", () => {
    const issue = classifyCheck(
      {
        name: "custom quality gate",
        conclusion: "failure",
        log: "ERROR: docker build failed"
      },
      {
        ...defaultConfig,
        checks: {
          "custom quality": {
            category: "infra_validation",
            local_command: "make validate",
            blocks_merge: false
          }
        }
      }
    );

    expect(issue.category).toBe("infra_validation");
    expect(issue.localCommand).toBe("make validate");
    expect(issue.blocksMerge).toBe(false);
  });

  it("detects Go race detector output", () => {
    const issue = classifyCheck(
      {
        name: "go test -race (apps/api)",
        conclusion: "failure",
        log: "WARNING: DATA RACE\nRead at 0x00"
      },
      defaultConfig
    );

    expect(issue.category).toBe("race_detected");
    expect(issue.blocksMerge).toBe(true);
  });

  it("detects cancelled and timed out conclusions", () => {
    expect(classifyCheck({ name: "lint", conclusion: "cancelled" }, defaultConfig).category).toBe("cancelled");
    expect(classifyCheck({ name: "build", conclusion: "timed_out" }, defaultConfig).category).toBe("timeout");
  });

  it("suggests a built-in local command for a recognized tool without config", () => {
    const issue = classifyCheck(
      {
        name: "lint",
        conclusion: "failure",
        log: "eslint found 3 problems"
      },
      defaultConfig
    );

    expect(issue.category).toBe("lint_failure");
    expect(issue.localCommand).toBe("npx eslint .");
  });

  it("has no built-in local command for a generic, non-tool-specific match", () => {
    const issue = classifyCheck(
      {
        name: "lint",
        conclusion: "failure",
        log: "ERROR: lint check failed"
      },
      defaultConfig
    );

    expect(issue.category).toBe("lint_failure");
    expect(issue.localCommand).toBeUndefined();
  });

  it("suggests pytest and terraform built-in commands", () => {
    const pytestIssue = classifyCheck(
      { name: "pytest", conclusion: "failure", log: "1 failed, 2 passed" },
      defaultConfig
    );
    const terraformIssue = classifyCheck(
      { name: "terraform plan", conclusion: "failure", log: "Error: terraform validation failed" },
      defaultConfig
    );

    expect(pytestIssue.localCommand).toBe("pytest");
    expect(terraformIssue.localCommand).toBe("terraform validate");
  });
});
