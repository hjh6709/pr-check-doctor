import { describe, expect, it } from "vitest";
import {
  mapCheckRun,
  mapWorkflowJob,
  normalizeGitHubChecks
} from "../src/github-checks.js";

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
        name: "build",
        conclusion: "failure",
        status: "completed",
        workflow_name: "CI"
      })
    ).toEqual({
      name: "build",
      workflowName: "CI",
      conclusion: "failure",
      status: "completed"
    });
  });

  it("omits workflow name and uses unknown for unexpected values", () => {
    expect(
      mapWorkflowJob({
        name: "deploy",
        conclusion: "stale",
        status: null,
        workflow_name: null
      })
    ).toEqual({
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
        name: "test",
        workflowName: "CI",
        conclusion: "failure",
        status: "completed"
      }
    ]);
  });
});
