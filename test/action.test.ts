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

  it("loads pull request context from the GitHub event payload", async () => {
    const messages: string[] = [];

    await runAction(
      {
        getInput: () => "",
        getBooleanInput: () => false,
        info: (message) => messages.push(message)
      },
      {
        getEnv: (name) => (name === "GITHUB_EVENT_PATH" ? "event.json" : undefined),
        readFile: async (path) => {
          expect(path).toBe("event.json");

          return JSON.stringify({
            number: 7,
            repository: {
              owner: {
                login: "octo-org"
              },
              name: "pr-check-doctor"
            },
            pull_request: {
              head: {
                sha: "abc123"
              }
            }
          });
        }
      }
    );

    expect(messages.join("\n")).toContain(
      "Loaded PR context octo-org/pr-check-doctor#7 head=abc123"
    );
  });

  it("renders a triage comment from collected GitHub checks", async () => {
    const messages: string[] = [];

    await runAction(
      {
        getInput: (name) => (name === "config-path" ? ".check-doctor.yml" : ""),
        getBooleanInput: () => false,
        info: (message) => messages.push(message)
      },
      {
        getEnv: (name) => (name === "GITHUB_EVENT_PATH" ? "event.json" : undefined),
        readFile: async (path) => {
          if (path === ".check-doctor.yml") {
            return `
checks:
  test:
    category: test_failure
    local_command: npm test
    blocks_merge: true
`;
          }

          expect(path).toBe("event.json");

          return JSON.stringify({
            number: 7,
            repository: {
              owner: {
                login: "octo-org"
              },
              name: "pr-check-doctor"
            },
            pull_request: {
              head: {
                sha: "abc123"
              }
            }
          });
        },
        fetchChecks: async (context) => {
          expect(context).toEqual({
            owner: "octo-org",
            repo: "pr-check-doctor",
            pullNumber: 7,
            headSha: "abc123"
          });

          return [
            {
              name: "test",
              conclusion: "failure",
              status: "completed"
            }
          ];
        }
      }
    );

    const output = messages.join("\n");

    expect(output).toContain("<!-- pr-check-doctor -->");
    expect(output).toContain("Verdict: BLOCK");
    expect(output).toContain("test_failure");
    expect(output).toContain("npm test");
    expect(output).toContain("#### test");
  });

  it("uses the default config when the config file is missing", async () => {
    const messages: string[] = [];

    await runAction(
      {
        getInput: (name) => (name === "config-path" ? ".check-doctor.yml" : ""),
        getBooleanInput: () => false,
        info: (message) => messages.push(message)
      },
      {
        getEnv: (name) => (name === "GITHUB_EVENT_PATH" ? "event.json" : undefined),
        readFile: async (path) => {
          if (path === ".check-doctor.yml") {
            throw Object.assign(new Error("missing config"), { code: "ENOENT" });
          }

          return JSON.stringify({
            number: 7,
            repository: {
              owner: {
                login: "octo-org"
              },
              name: "pr-check-doctor"
            },
            pull_request: {
              head: {
                sha: "abc123"
              }
            }
          });
        },
        fetchChecks: async () => [
          {
            name: "test",
            conclusion: "failure",
            status: "completed"
          }
        ]
      }
    );

    const output = messages.join("\n");

    expect(output).toContain("<!-- pr-check-doctor -->");
    expect(output).toContain("Verdict: WARN");
  });
});
