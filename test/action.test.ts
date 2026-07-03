import { describe, expect, it } from "vitest";
import { runAction } from "../src/action.js";

describe("runAction", () => {
  it("renders a triage comment from a fixture in dry-run mode", async () => {
    const messages: string[] = [];

    await runAction(
      {
        getInput: (name) => (name === "fixture-path" ? "fixture.json" : ""),
        getBooleanInput: (name) => name === "dry-run",
        info: (message) => messages.push(message)
      },
      {
        readFile: async (path) => {
          expect(path).toBe("fixture.json");

          return JSON.stringify({
            config: `
checks:
  test:
    category: test_failure
    local_command: npm test
    blocks_merge: true
`,
            gitHubChecks: {
              checkRuns: [],
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
        }
      }
    );

    const output = messages.join("\n");

    expect(output).toContain("<!-- pr-check-doctor -->");
    expect(output).toContain("Verdict: BLOCK");
    expect(output).toContain("password=[REDACTED]");
    expect(output).not.toContain("hunter2");
  });
});
