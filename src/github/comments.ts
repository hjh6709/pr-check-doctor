import { commentMarker } from "../comment.js";
import { fetchWithRetry } from "./transport.js";
import type { PullRequestContext } from "./event.js";

interface IssueCommentLike {
  id: number;
  body?: string | null;
}

interface IssueCommentsResponse {
  data: IssueCommentLike[];
}

interface EmptyResponse {
  data: unknown;
}

type GitHubCommentMethod = "GET" | "PATCH" | "POST";

export interface GitHubCommentsTransport {
  requestJson(
    method: GitHubCommentMethod,
    url: string,
    headers: Record<string, string>,
    body?: unknown
  ): Promise<unknown>;
}

export interface GitHubCommentsClient {
  request(
    route: "GET /repos/{owner}/{repo}/issues/{issue_number}/comments",
    params: {
      owner: string;
      repo: string;
      issue_number: number;
      per_page: number;
    }
  ): Promise<IssueCommentsResponse>;
  request(
    route: "PATCH /repos/{owner}/{repo}/issues/comments/{comment_id}",
    params: {
      owner: string;
      repo: string;
      comment_id: number;
      body: string;
    }
  ): Promise<EmptyResponse>;
  request(
    route: "POST /repos/{owner}/{repo}/issues/{issue_number}/comments",
    params: {
      owner: string;
      repo: string;
      issue_number: number;
      body: string;
    }
  ): Promise<EmptyResponse>;
}

const defaultGitHubCommentsTransport: GitHubCommentsTransport = {
  requestJson: async (method, url, headers, body) => {
    const response = await fetchWithRetry(() =>
      fetch(url, {
        method,
        headers,
        body: body === undefined ? undefined : JSON.stringify(body)
      })
    );

    if (!response.ok) {
      throw new Error(`GitHub API request failed: ${response.status} ${response.statusText}`);
    }

    if (response.status === 204) {
      return {};
    }

    return response.json();
  }
};

export function createGitHubCommentsClient(
  token: string,
  transport: GitHubCommentsTransport = defaultGitHubCommentsTransport
): GitHubCommentsClient {
  const request = async (route: string, params: Record<string, string | number>) => {
    const { body, method, url } = buildGitHubCommentsRequest(route, params);
    const data = await transport.requestJson(
      method,
      url,
      {
        accept: "application/vnd.github+json",
        authorization: `Bearer ${token}`,
        "content-type": "application/json",
        "user-agent": "pr-check-doctor",
        "x-github-api-version": "2022-11-28"
      },
      body
    );

    return { data };
  };

  return {
    request: request as GitHubCommentsClient["request"]
  };
}

export async function upsertTriageComment(
  context: PullRequestContext,
  body: string,
  client: GitHubCommentsClient
): Promise<void> {
  // Pull request comments are issue comments in GitHub's API.
  const comments = await client.request("GET /repos/{owner}/{repo}/issues/{issue_number}/comments", {
    owner: context.owner,
    repo: context.repo,
    issue_number: context.pullNumber,
    per_page: 100
  });
  // The hidden marker lets the action keep one stable comment instead of posting a new one per run.
  const existingComment = comments.data.find((comment) => comment.body?.includes(commentMarker));

  if (existingComment) {
    await client.request("PATCH /repos/{owner}/{repo}/issues/comments/{comment_id}", {
      owner: context.owner,
      repo: context.repo,
      comment_id: existingComment.id,
      body
    });
    return;
  }

  await client.request("POST /repos/{owner}/{repo}/issues/{issue_number}/comments", {
    owner: context.owner,
    repo: context.repo,
    issue_number: context.pullNumber,
    body
  });
}

function buildGitHubCommentsRequest(
  route: string,
  params: Record<string, string | number>
): { body?: unknown; method: GitHubCommentMethod; url: string } {
  const baseUrl = "https://api.github.com";
  const owner = encodeURIComponent(String(params.owner));
  const repo = encodeURIComponent(String(params.repo));

  if (route === "GET /repos/{owner}/{repo}/issues/{issue_number}/comments") {
    const query = new URLSearchParams({
      per_page: String(params.per_page)
    });

    return {
      method: "GET",
      url: `${baseUrl}/repos/${owner}/${repo}/issues/${params.issue_number}/comments?${query}`
    };
  }

  if (route === "PATCH /repos/{owner}/{repo}/issues/comments/{comment_id}") {
    return {
      body: { body: String(params.body) },
      method: "PATCH",
      url: `${baseUrl}/repos/${owner}/${repo}/issues/comments/${params.comment_id}`
    };
  }

  if (route === "POST /repos/{owner}/{repo}/issues/{issue_number}/comments") {
    return {
      body: { body: String(params.body) },
      method: "POST",
      url: `${baseUrl}/repos/${owner}/${repo}/issues/${params.issue_number}/comments`
    };
  }

  throw new Error(`Unsupported GitHub comments route: ${route}`);
}
