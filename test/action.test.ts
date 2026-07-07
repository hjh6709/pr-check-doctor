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
        fetchChecks: async () => [],
        getEnv: (name) => (name === "GITHUB_EVENT_PATH" ? "event.json" : undefined),
        readFile: async (path) => {
          if (path === ".check-doctor.yml") {
            throw Object.assign(new Error("missing config"), { code: "ENOENT" });
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
        }
      }
    );

    expect(messages.join("\n")).toContain(
      "Loaded PR context octo-org/pr-check-doctor#7 head=abc123"
    );
  });

  it("fails clearly when a pull_request event has no GitHub token", async () => {
    await expect(
      runAction(
        {
          getInput: () => "",
          getBooleanInput: () => false,
          info: () => undefined
        },
        {
          getEnv: (name) => (name === "GITHUB_EVENT_PATH" ? "event.json" : undefined),
          readFile: async () =>
            JSON.stringify({
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
            })
        }
      )
    ).rejects.toThrow("github-token input is required");
  });

  it("skips non pull_request event payloads", async () => {
    const messages: string[] = [];

    await runAction(
      {
        getInput: () => "",
        getBooleanInput: () => false,
        info: (message) => messages.push(message)
      },
      {
        fetchChecks: async () => {
          throw new Error("non-PR events should not fetch checks");
        },
        getEnv: (name) => {
          if (name === "GITHUB_EVENT_NAME") {
            return "push";
          }

          return name === "GITHUB_EVENT_PATH" ? "event.json" : undefined;
        },
        readFile: async () =>
          JSON.stringify({
            ref: "refs/heads/main",
            repository: {
              owner: {
                login: "octo-org"
              },
              name: "pr-check-doctor"
            }
          })
      }
    );

    expect(messages.join("\n")).toContain(
      "Skipping PR Check Doctor because this is not a pull_request event."
    );
  });

  it("renders a triage comment from collected GitHub checks", async () => {
    const messages: string[] = [];

    await runAction(
      {
        getInput: (name) =>
          name === "config-path"
            ? ".check-doctor.yml"
            : name === "github-token"
              ? "github-token"
              : "",
        getBooleanInput: (name) => name === "dry-run",
        info: (message) => messages.push(message)
      },
      {
        createUpsertComment: () => {
          throw new Error("dry-run should not write a PR comment");
        },
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

  it("creates a checks fetcher from the GitHub token when one is not injected", async () => {
    const messages: string[] = [];
    const tokens: string[] = [];

    await runAction(
      {
        getInput: (name) => (name === "github-token" ? "github-token" : ""),
        getBooleanInput: () => false,
        info: (message) => messages.push(message)
      },
      {
        createFetchChecks: (token) => {
          tokens.push(token);

          return async () => [
            {
              name: "test",
              conclusion: "failure",
              status: "completed"
            }
          ];
        },
        getEnv: (name) => (name === "GITHUB_EVENT_PATH" ? "event.json" : undefined),
        readFile: async () =>
          JSON.stringify({
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
          })
      }
    );

    expect(tokens).toEqual(["github-token"]);
    expect(messages.join("\n")).toContain("<!-- pr-check-doctor -->");
  });

  it("writes the triage comment to the pull request outside dry-run mode", async () => {
    const comments: Array<{ body: string; pullNumber: number }> = [];

    await runAction(
      {
        getInput: (name) => (name === "github-token" ? "github-token" : ""),
        getBooleanInput: () => false,
        info: () => undefined
      },
      {
        createUpsertComment: (token) => {
          expect(token).toBe("github-token");

          return async (context, body) => {
            comments.push({
              body,
              pullNumber: context.pullNumber
            });
          };
        },
        fetchChecks: async () => [
          {
            name: "test",
            conclusion: "failure",
            status: "completed"
          }
        ],
        getEnv: (name) => (name === "GITHUB_EVENT_PATH" ? "event.json" : undefined),
        readFile: async () =>
          JSON.stringify({
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
          })
      }
    );

    expect(comments).toHaveLength(1);
    expect(comments[0]?.pullNumber).toBe(7);
    expect(comments[0]?.body).toContain("<!-- pr-check-doctor -->");
  });

  it("does not warn about the currently running doctor job", async () => {
    const messages: string[] = [];

    await runAction(
      {
        getInput: () => "",
        getBooleanInput: (name) => name === "dry-run",
        info: (message) => messages.push(message)
      },
      {
        fetchChecks: async () => [
          {
            name: "manual test failure",
            conclusion: "failure",
            status: "completed"
          },
          {
            name: "doctor smoke",
            conclusion: "unknown",
            status: "in_progress"
          }
        ],
        getEnv: (name) => {
          if (name === "GITHUB_EVENT_PATH") {
            return "event.json";
          }

          if (name === "GITHUB_JOB") {
            return "doctor-smoke";
          }

          return undefined;
        },
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
        }
      }
    );

    const output = messages.join("\n");

    expect(output).toContain("#### manual test failure");
    expect(output).not.toContain("Some checks are still running or queued");
  });
});
