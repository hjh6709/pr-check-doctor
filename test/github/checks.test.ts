import { describe, expect, it } from "vitest";
import {
  deduplicateNormalizedChecks,
  mapCheckRun,
  mapWorkflowJob,
  normalizeGitHubChecks
} from "../../src/github/checks.js";

describe("mapCheckRun", () => {
  it("maps a GitHub check run into a normalized check", () => {
    expect(
      mapCheckRun({
        name: "go test -race",
        conclusion: "failure",
        status: "completed"
      })
    ).toEqual({
      name: "go test -race",
      conclusion: "failure",
      status: "completed"
    });
  });

  it("uses unknown for missing or unexpected conclusion and status values", () => {
    expect(
      mapCheckRun({
        name: "custom check",
        conclusion: null,
        status: "waiting"
      })
    ).toEqual({
      name: "custom check",
      conclusion: "unknown",
      status: "unknown"
    });
  });
});

describe("mapWorkflowJob", () => {
  it("maps a GitHub workflow job into a normalized check", () => {
    expect(
      mapWorkflowJob({
        id: 123,
        name: "build",
        conclusion: "failure",
        status: "completed",
        workflow_name: "CI"
      })
    ).toEqual({
      jobId: 123,
      name: "build",
      workflowName: "CI",
      conclusion: "failure",
      status: "completed"
    });
  });

  it("omits workflow name and uses unknown for unexpected values", () => {
    expect(
      mapWorkflowJob({
        id: 456,
        name: "deploy",
        conclusion: "stale",
        status: null,
        workflow_name: null
      })
    ).toEqual({
      jobId: 456,
      name: "deploy",
      conclusion: "unknown",
      status: "unknown"
    });
  });
});

describe("normalizeGitHubChecks", () => {
  it("combines check runs and workflow jobs into normalized checks", () => {
    expect(
      normalizeGitHubChecks({
        checkRuns: [
          {
            name: "lint",
            conclusion: "success",
            status: "completed"
          }
        ],
        workflowJobs: [
          {
            id: 123,
            name: "test",
            conclusion: "failure",
            status: "completed",
            workflow_name: "CI"
          }
        ]
      })
    ).toEqual([
      {
        name: "lint",
        conclusion: "success",
        status: "completed"
      },
      {
        jobId: 123,
        name: "test",
        workflowName: "CI",
        conclusion: "failure",
        status: "completed"
      }
    ]);
  });

  it("prefers workflow jobs over duplicate check runs", () => {
    expect(
      normalizeGitHubChecks({
        checkRuns: [
          {
            name: "manual test failure",
            conclusion: "failure",
            status: "completed"
          }
        ],
        workflowJobs: [
          {
            id: 123,
            name: "manual test failure",
            conclusion: "failure",
            status: "completed",
            workflow_name: "CI"
          }
        ]
      })
    ).toEqual([
      {
        jobId: 123,
        name: "manual test failure",
        workflowName: "CI",
        conclusion: "failure",
        status: "completed"
      }
    ]);
  });
});

describe("deduplicateNormalizedChecks", () => {
  it("keeps same-name workflow jobs when they have different job ids", () => {
    expect(
      deduplicateNormalizedChecks([
        { jobId: 123, name: "test", conclusion: "failure", status: "completed" },
        { jobId: 456, name: "test", conclusion: "failure", status: "completed" }
      ])
    ).toEqual([
      { jobId: 123, name: "test", conclusion: "failure", status: "completed" },
      { jobId: 456, name: "test", conclusion: "failure", status: "completed" }
    ]);
  });
});
