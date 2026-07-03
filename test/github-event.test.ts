import { describe, expect, it } from "vitest";
import { parsePullRequestEvent } from "../src/github-event.js";

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
