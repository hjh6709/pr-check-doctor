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

interface WorkflowRunsResponse {
  data: {
    workflow_runs: Array<{
      id: number;
    }>;
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

export interface GitHubWorkflowRunsClient {
  request(
    route: "GET /repos/{owner}/{repo}/actions/runs",
    params: {
      owner: string;
      repo: string;
      head_sha: string;
      per_page: number;
    }
  ): Promise<WorkflowRunsResponse>;
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

export async function fetchWorkflowRunIds(
  context: PullRequestContext,
  client: GitHubWorkflowRunsClient
): Promise<number[]> {
  const response = await client.request("GET /repos/{owner}/{repo}/actions/runs", {
    owner: context.owner,
    repo: context.repo,
    head_sha: context.headSha,
    per_page: 100
  });

  return response.data.workflow_runs.map((run) => run.id);
}
