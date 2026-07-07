import { describe, expect, it } from "vitest";
import {
  createGitHubCommentsClient,
  upsertTriageComment,
  type GitHubCommentsClient
} from "../src/github-comments.js";

describe("createGitHubCommentsClient", () => {
  it("creates a token-backed REST client for PR comments", async () => {
    const requests: Array<{
      body?: unknown;
      headers: Record<string, string>;
      method: string;
      url: string;
    }> = [];
    const client = createGitHubCommentsClient("github-token", {
      requestJson: async (method, url, headers, body) => {
        requests.push({ body, headers, method, url });

        if (method === "GET") {
          return [];
        }

        return {};
      }
    });

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

    expect(requests).toEqual([
      {
        body: undefined,
        headers: expect.objectContaining({
          accept: "application/vnd.github+json",
          authorization: "Bearer github-token",
          "x-github-api-version": "2022-11-28"
        }) as Record<string, string>,
        method: "GET",
        url: "https://api.github.com/repos/octo-org/pr-check-doctor/issues/42/comments?per_page=100"
      },
      {
        body: {
          body: "<!-- pr-check-doctor -->\nnew"
        },
        headers: expect.objectContaining({
          authorization: "Bearer github-token"
        }) as Record<string, string>,
        method: "POST",
        url: "https://api.github.com/repos/octo-org/pr-check-doctor/issues/42/comments"
      }
    ]);
  });
});

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
