import { commentMarker } from "./comment.js";
import type { PullRequestContext } from "./github-event.js";

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

export async function upsertTriageComment(
  context: PullRequestContext,
  body: string,
  client: GitHubCommentsClient
): Promise<void> {
  const comments = await client.request("GET /repos/{owner}/{repo}/issues/{issue_number}/comments", {
    owner: context.owner,
    repo: context.repo,
    issue_number: context.pullNumber,
    per_page: 100
  });
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
