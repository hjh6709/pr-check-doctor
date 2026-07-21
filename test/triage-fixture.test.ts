import { describe, expect, it } from "vitest";
import { parseDoctorConfig } from "../src/config.js";
import { createTriageComment, createTriageCommentFromChecks } from "../src/triage.js";

describe("fixture triage flow", () => {
  it("renders a blocking PR comment from GitHub check fixtures", () => {
    const { config } = parseDoctorConfig(`
checks:
  test:
    category: test_failure
    local_command: npm test
    blocks_merge: true
`);

    const markdown = createTriageComment({
      config,
      gitHubChecks: {
        checkRuns: [
          {
            name: "lint",
            conclusion: "success",
            status: "completed"
          }
        ],
        workflowJobs: [
          {
            name: "test",
            conclusion: "failure",
            status: "completed",
            workflow_name: "CI"
          }
        ]
      },
      logsByCheckName: {
        test: "Error: test failed password=hunter2"
      }
    });

    expect(markdown).toContain("<!-- pr-check-doctor -->");
    expect(markdown).toContain("Verdict: BLOCK");
    expect(markdown).toContain("test_failure");
    expect(markdown).toContain("Error: test failed");
    expect(markdown).toContain("password=[REDACTED]");
    expect(markdown).not.toContain("hunter2");
    expect(markdown).toContain("npm test");
  });

  it("renders a blocking PR comment from normalized checks", () => {
    const { config } = parseDoctorConfig(`
checks:
  test:
    category: test_failure
    local_command: npm test
    blocks_merge: true
`);

    const markdown = createTriageCommentFromChecks({
      config,
      checks: [
        {
          name: "test",
          workflowName: "CI",
          conclusion: "failure",
          status: "completed"
        }
      ],
      logsByCheckName: {
        test: "Error: test failed password=hunter2"
      }
    });

    expect(markdown).toContain("Verdict: BLOCK");
    expect(markdown).toContain("test_failure");
    expect(markdown).toContain("password=[REDACTED]");
    expect(markdown).not.toContain("hunter2");
  });
});
