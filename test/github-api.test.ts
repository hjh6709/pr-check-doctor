import { describe, expect, it } from "vitest";
import {
  fetchCheckRuns,
  fetchGitHubChecks,
  fetchWorkflowJobs,
  fetchWorkflowRunIds,
  type GitHubChecksClient
} from "../src/github-api.js";

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
        name: "test",
        workflowName: "CI",
        conclusion: "failure",
        status: "completed"
      }
    ]);
  });
});
