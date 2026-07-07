import { describe, expect, it } from "vitest";
import {
  attachWorkflowJobLogs,
  createGitHubChecksClient,
  createGitHubChecksFetcher,
  createGitHubChecksWithLogsFetcher,
  createGitHubJobLogsClient,
  fetchCheckRuns,
  fetchGitHubChecks,
  fetchWorkflowJobLog,
  fetchWorkflowJobs,
  fetchWorkflowRunIds,
  type GitHubChecksClient,
  type GitHubWorkflowJobLogsClient
} from "../src/github-api.js";

describe("createGitHubChecksClient", () => {
  it("creates a token-backed REST client for GitHub API routes", async () => {
    const requests: Array<{ url: string; headers: Record<string, string> }> = [];
    const client = createGitHubChecksClient("github-token", {
      getJson: async (url, headers) => {
        requests.push({ url, headers });

        return {
          check_runs: []
        };
      }
    });

    await fetchCheckRuns(
      {
        owner: "octo-org",
        repo: "pr-check-doctor",
        pullNumber: 42,
        headSha: "abc123"
      },
      client
    );

    expect(requests).toEqual([
      {
        url: "https://api.github.com/repos/octo-org/pr-check-doctor/commits/abc123/check-runs",
        headers: expect.objectContaining({
          accept: "application/vnd.github+json",
          authorization: "Bearer github-token",
          "x-github-api-version": "2022-11-28"
        }) as Record<string, string>
      }
    ]);
  });
});

describe("createGitHubJobLogsClient", () => {
  it("creates a token-backed REST client for workflow job logs", async () => {
    const requests: Array<{ url: string; headers: Record<string, string> }> = [];
    const client = createGitHubJobLogsClient("github-token", {
      getText: async (url, headers) => {
        requests.push({ url, headers });

        return "Error: test failed";
      }
    });

    const log = await fetchWorkflowJobLog(
      {
        owner: "octo-org",
        repo: "pr-check-doctor",
        jobId: 123
      },
      client
    );

    expect(log).toBe("Error: test failed");
    expect(requests).toEqual([
      {
        url: "https://api.github.com/repos/octo-org/pr-check-doctor/actions/jobs/123/logs",
        headers: expect.objectContaining({
          accept: "application/vnd.github+json",
          authorization: "Bearer github-token",
          "x-github-api-version": "2022-11-28"
        }) as Record<string, string>
      }
    ]);
  });
});

describe("attachWorkflowJobLogs", () => {
  it("attaches logs to triage candidate workflow jobs", async () => {
    const calls: number[] = [];
    const client: GitHubWorkflowJobLogsClient = {
      request: async (_route, params) => {
        calls.push(params.job_id);

        return {
          data: `log for ${params.job_id}`
        };
      }
    };

    const checks = await attachWorkflowJobLogs(
      {
        owner: "octo-org",
        repo: "pr-check-doctor"
      },
      [
        { jobId: 123, name: "test", conclusion: "failure", status: "completed" },
        { jobId: 456, name: "lint", conclusion: "success", status: "completed" },
        { name: "check run", conclusion: "failure", status: "completed" }
      ],
      client
    );

    expect(calls).toEqual([123]);
    expect(checks).toEqual([
      {
        jobId: 123,
        name: "test",
        conclusion: "failure",
        status: "completed",
        log: "log for 123"
      },
      { jobId: 456, name: "lint", conclusion: "success", status: "completed" },
      { name: "check run", conclusion: "failure", status: "completed" }
    ]);
  });

  it("leaves a check unchanged when its log cannot be fetched", async () => {
    const client: GitHubWorkflowJobLogsClient = {
      request: async () => {
        throw new Error("log unavailable");
      }
    };

    await expect(
      attachWorkflowJobLogs(
        {
          owner: "octo-org",
          repo: "pr-check-doctor"
        },
        [{ jobId: 123, name: "test", conclusion: "failure", status: "completed" }],
        client
      )
    ).resolves.toEqual([
      { jobId: 123, name: "test", conclusion: "failure", status: "completed" }
    ]);
  });
});

describe("fetchCheckRuns", () => {
  it("requests check runs for the PR head SHA and normalizes them", async () => {
    const calls: Array<{ route: string; params: Record<string, string> }> = [];

    const checks = await fetchCheckRuns(
      {
        owner: "octo-org",
        repo: "pr-check-doctor",
        pullNumber: 42,
        headSha: "abc123"
      },
      {
        request: async (route, params) => {
          calls.push({ route, params });

          return {
            data: {
              check_runs: [
                {
                  name: "lint",
                  conclusion: "failure",
                  status: "completed"
                }
              ]
            }
          };
        }
      }
    );

    expect(calls).toEqual([
      {
        route: "GET /repos/{owner}/{repo}/commits/{ref}/check-runs",
        params: {
          owner: "octo-org",
          repo: "pr-check-doctor",
          ref: "abc123"
        }
      }
    ]);
    expect(checks).toEqual([
      {
        name: "lint",
        conclusion: "failure",
        status: "completed"
      }
    ]);
  });
});

describe("fetchWorkflowJobs", () => {
  it("requests jobs for a workflow run and normalizes them", async () => {
    const calls: Array<{ route: string; params: Record<string, string | number> }> = [];

    const checks = await fetchWorkflowJobs(
      {
        owner: "octo-org",
        repo: "pr-check-doctor",
        runId: 123
      },
      {
        request: async (route, params) => {
          calls.push({ route, params });

          return {
            data: {
              jobs: [
                {
                  id: 12345,
                  name: "test",
                  conclusion: "failure",
                  status: "completed",
                  workflow_name: "CI"
                }
              ]
            }
          };
        }
      }
    );

    expect(calls).toEqual([
      {
        route: "GET /repos/{owner}/{repo}/actions/runs/{run_id}/jobs",
        params: {
          owner: "octo-org",
          repo: "pr-check-doctor",
          run_id: 123
        }
      }
    ]);
    expect(checks).toEqual([
      {
        jobId: 12345,
        name: "test",
        workflowName: "CI",
        conclusion: "failure",
        status: "completed"
      }
    ]);
  });
});

describe("fetchWorkflowRunIds", () => {
  it("requests workflow runs for the PR head SHA and returns run ids", async () => {
    const calls: Array<{ route: string; params: Record<string, string | number> }> = [];

    const runIds = await fetchWorkflowRunIds(
      {
        owner: "octo-org",
        repo: "pr-check-doctor",
        pullNumber: 42,
        headSha: "abc123"
      },
      {
        request: async (route, params) => {
          calls.push({ route, params });

          return {
            data: {
              workflow_runs: [{ id: 123 }, { id: 456 }]
            }
          };
        }
      }
    );

    expect(calls).toEqual([
      {
        route: "GET /repos/{owner}/{repo}/actions/runs",
        params: {
          owner: "octo-org",
          repo: "pr-check-doctor",
          head_sha: "abc123",
          per_page: 100
        }
      }
    ]);
    expect(runIds).toEqual([123, 456]);
  });
});

describe("fetchGitHubChecks", () => {
  it("collects check runs and workflow jobs for a PR head SHA", async () => {
    const client = {
      request: async (route, params) => {
        if (route === "GET /repos/{owner}/{repo}/commits/{ref}/check-runs") {
          return {
            data: {
              check_runs: [
                {
                  name: "lint",
                  conclusion: "success",
                  status: "completed"
                }
              ]
            }
          };
        }

        if (route === "GET /repos/{owner}/{repo}/actions/runs") {
          return {
            data: {
              workflow_runs: [{ id: 123 }]
            }
          };
        }

        expect(params).toMatchObject({ run_id: 123 });

        return {
          data: {
            jobs: [
              {
                id: 12345,
                name: "test",
                conclusion: "failure",
                status: "completed",
                workflow_name: "CI"
              }
            ]
          }
        };
      }
    } as GitHubChecksClient;

    const checks = await fetchGitHubChecks(
      {
        owner: "octo-org",
        repo: "pr-check-doctor",
        pullNumber: 42,
        headSha: "abc123"
      },
      client
    );

    expect(checks).toEqual([
      {
        name: "lint",
        conclusion: "success",
        status: "completed"
      },
      {
        jobId: 12345,
        name: "test",
        workflowName: "CI",
        conclusion: "failure",
        status: "completed"
      }
    ]);
  });
});

describe("createGitHubChecksFetcher", () => {
  it("creates a token-backed GitHub checks fetcher", async () => {
    const tokens: string[] = [];
    const fetchChecks = createGitHubChecksFetcher("github-token", (token) => {
      tokens.push(token);

      return {
        request: async (route) => {
          if (route === "GET /repos/{owner}/{repo}/commits/{ref}/check-runs") {
            return {
              data: {
                check_runs: []
              }
            };
          }

          if (route === "GET /repos/{owner}/{repo}/actions/runs") {
            return {
              data: {
                workflow_runs: [{ id: 123 }]
              }
            };
          }

          return {
            data: {
              jobs: [
                {
                  id: 12345,
                  name: "test",
                  conclusion: "failure",
                  status: "completed"
                }
              ]
            }
          };
        }
      } as GitHubChecksClient;
    });

    const checks = await fetchChecks({
      owner: "octo-org",
      repo: "pr-check-doctor",
      pullNumber: 42,
      headSha: "abc123"
    });

    expect(tokens).toEqual(["github-token"]);
    expect(checks).toEqual([
      {
        jobId: 12345,
        name: "test",
        conclusion: "failure",
        status: "completed"
      }
    ]);
  });
});

describe("createGitHubChecksWithLogsFetcher", () => {
  it("creates a token-backed GitHub checks fetcher that attaches job logs", async () => {
    const tokens: string[] = [];
    const fetchChecks = createGitHubChecksWithLogsFetcher(
      "github-token",
      (token) => {
        tokens.push(`checks:${token}`);

        return {
          request: async (route) => {
            if (route === "GET /repos/{owner}/{repo}/commits/{ref}/check-runs") {
              return {
                data: {
                  check_runs: []
                }
              };
            }

            if (route === "GET /repos/{owner}/{repo}/actions/runs") {
              return {
                data: {
                  workflow_runs: [{ id: 123 }]
                }
              };
            }

            return {
              data: {
                jobs: [
                  {
                    id: 12345,
                    name: "test",
                    conclusion: "failure",
                    status: "completed"
                  }
                ]
              }
            };
          }
        } as GitHubChecksClient;
      },
      (token) => {
        tokens.push(`logs:${token}`);

        return {
          request: async () => ({
            data: "Error: test failed"
          })
        };
      }
    );

    const checks = await fetchChecks({
      owner: "octo-org",
      repo: "pr-check-doctor",
      pullNumber: 42,
      headSha: "abc123"
    });

    expect(tokens).toEqual(["checks:github-token", "logs:github-token"]);
    expect(checks).toEqual([
      {
        jobId: 12345,
        name: "test",
        conclusion: "failure",
        status: "completed",
        log: "Error: test failed"
      }
    ]);
  });
});
