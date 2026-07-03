import {
  mapCheckRun,
  mapWorkflowJob,
  type GitHubCheckRunLike,
  type GitHubWorkflowJobLike
} from "./github-checks.js";
import type { PullRequestContext } from "./github-event.js";
import type { NormalizedCheck } from "./types.js";

interface CheckRunsResponse {
  data: {
    check_runs: GitHubCheckRunLike[];
  };
}

interface WorkflowJobsResponse {
  data: {
    jobs: GitHubWorkflowJobLike[];
  };
}

export interface GitHubCheckRunsClient {
  request(
    route: "GET /repos/{owner}/{repo}/commits/{ref}/check-runs",
    params: {
      owner: string;
      repo: string;
      ref: string;
    }
  ): Promise<CheckRunsResponse>;
}

export interface GitHubWorkflowJobsClient {
  request(
    route: "GET /repos/{owner}/{repo}/actions/runs/{run_id}/jobs",
    params: {
      owner: string;
      repo: string;
      run_id: number;
    }
  ): Promise<WorkflowJobsResponse>;
}

export interface WorkflowRunContext {
  owner: string;
  repo: string;
  runId: number;
}

export async function fetchCheckRuns(
  context: PullRequestContext,
  client: GitHubCheckRunsClient
): Promise<NormalizedCheck[]> {
  const response = await client.request("GET /repos/{owner}/{repo}/commits/{ref}/check-runs", {
    owner: context.owner,
    repo: context.repo,
    ref: context.headSha
  });

  return response.data.check_runs.map(mapCheckRun);
}

export async function fetchWorkflowJobs(
  context: WorkflowRunContext,
  client: GitHubWorkflowJobsClient
): Promise<NormalizedCheck[]> {
  const response = await client.request("GET /repos/{owner}/{repo}/actions/runs/{run_id}/jobs", {
    owner: context.owner,
    repo: context.repo,
    run_id: context.runId
  });

  return response.data.jobs.map(mapWorkflowJob);
}
