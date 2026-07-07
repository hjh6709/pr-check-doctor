import { describe, expect, it } from "vitest";
import { upsertTriageComment, type GitHubCommentsClient } from "../src/github-comments.js";

describe("upsertTriageComment", () => {
  it("updates an existing PR Check Doctor comment", async () => {
    const calls: Array<{ route: string; params: Record<string, string | number> }> = [];
    const client: GitHubCommentsClient = {
      request: (async (route, params) => {
        calls.push({ route, params });

        if (route === "GET /repos/{owner}/{repo}/issues/{issue_number}/comments") {
          return {
            data: [
              {
                id: 123,
                body: "<!-- pr-check-doctor -->\nold"
              }
            ]
          };
        }

        return { data: {} };
      }) as GitHubCommentsClient["request"]
    };

    await upsertTriageComment(
      {
        owner: "octo-org",
        repo: "pr-check-doctor",
        pullNumber: 42,
        headSha: "abc123"
      },
      "<!-- pr-check-doctor -->\nnew",
      client
    );

    expect(calls).toEqual([
      {
        route: "GET /repos/{owner}/{repo}/issues/{issue_number}/comments",
        params: {
          owner: "octo-org",
          repo: "pr-check-doctor",
          issue_number: 42,
          per_page: 100
        }
      },
      {
        route: "PATCH /repos/{owner}/{repo}/issues/comments/{comment_id}",
        params: {
          owner: "octo-org",
          repo: "pr-check-doctor",
          comment_id: 123,
          body: "<!-- pr-check-doctor -->\nnew"
        }
      }
    ]);
  });

  it("creates a comment when no marker comment exists", async () => {
    const calls: Array<{ route: string; params: Record<string, string | number> }> = [];
    const client: GitHubCommentsClient = {
      request: (async (route, params) => {
        calls.push({ route, params });

        if (route === "GET /repos/{owner}/{repo}/issues/{issue_number}/comments") {
          return {
            data: [
              {
                id: 123,
                body: "another comment"
              }
            ]
          };
        }

        return { data: {} };
      }) as GitHubCommentsClient["request"]
    };

    await upsertTriageComment(
      {
        owner: "octo-org",
        repo: "pr-check-doctor",
        pullNumber: 42,
        headSha: "abc123"
      },
      "<!-- pr-check-doctor -->\nnew",
      client
    );

    expect(calls.at(-1)).toEqual({
      route: "POST /repos/{owner}/{repo}/issues/{issue_number}/comments",
      params: {
        owner: "octo-org",
        repo: "pr-check-doctor",
        issue_number: 42,
        body: "<!-- pr-check-doctor -->\nnew"
      }
    });
  });
});
