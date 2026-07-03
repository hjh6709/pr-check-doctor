import { mapCheckRun, type GitHubCheckRunLike } from "./github-checks.js";
import type { PullRequestContext } from "./github-event.js";
import type { NormalizedCheck } from "./types.js";

interface CheckRunsResponse {
  data: {
    check_runs: GitHubCheckRunLike[];
  };
}

export interface GitHubRequestClient {
  request(
    route: "GET /repos/{owner}/{repo}/commits/{ref}/check-runs",
    params: {
      owner: string;
      repo: string;
      ref: string;
    }
  ): Promise<CheckRunsResponse>;
}

export async function fetchCheckRuns(
  context: PullRequestContext,
  client: GitHubRequestClient
): Promise<NormalizedCheck[]> {
  const response = await client.request("GET /repos/{owner}/{repo}/commits/{ref}/check-runs", {
    owner: context.owner,
    repo: context.repo,
    ref: context.headSha
  });

  return response.data.check_runs.map(mapCheckRun);
}
