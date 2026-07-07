import { describe, expect, it } from "vitest";
import { parsePullRequestEvent, parseWorkflowRunEvent } from "../../src/github/event.js";

describe("parsePullRequestEvent", () => {
  it("extracts PR context from a pull_request event payload", () => {
    expect(
      parsePullRequestEvent({
        number: 42,
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
    ).toEqual({
      owner: "octo-org",
      repo: "pr-check-doctor",
      pullNumber: 42,
      headSha: "abc123"
    });
  });

  it("throws when required PR context is missing", () => {
    expect(() => parsePullRequestEvent({})).toThrow("pull_request event payload");
  });
});

describe("parseWorkflowRunEvent", () => {
  it("extracts context from a workflow_run event triggered by a pull request", () => {
    expect(
      parseWorkflowRunEvent({
        repository: {
          owner: {
            login: "octo-org"
          },
          name: "pr-check-doctor"
        },
        workflow_run: {
          head_sha: "abc123",
          event: "pull_request"
        }
      })
    ).toEqual({
      owner: "octo-org",
      repo: "pr-check-doctor",
      headSha: "abc123",
      isPullRequestRun: true
    });
  });

  it("flags workflow runs that were not triggered by a pull request", () => {
    const context = parseWorkflowRunEvent({
      repository: {
        owner: {
          login: "octo-org"
        },
        name: "pr-check-doctor"
      },
      workflow_run: {
        head_sha: "abc123",
        event: "push"
      }
    });

    expect(context.isPullRequestRun).toBe(false);
  });

  it("throws when required workflow_run context is missing", () => {
    expect(() => parseWorkflowRunEvent({})).toThrow("workflow_run event payload");
  });
});
