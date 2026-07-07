import {
  mapCheckRun,
  mapWorkflowJob,
  type GitHubCheckRunLike,
  type GitHubWorkflowJobLike
} from "./github-checks.js";
import { selectTriageCandidates } from "./checks.js";
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

interface WorkflowJobLogResponse {
  data: string;
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

export interface GitHubWorkflowJobLogsClient {
  request(
    route: "GET /repos/{owner}/{repo}/actions/jobs/{job_id}/logs",
    params: {
      owner: string;
      repo: string;
      job_id: number;
    }
  ): Promise<WorkflowJobLogResponse>;
}

export type GitHubChecksClient = GitHubCheckRunsClient &
  GitHubWorkflowRunsClient &
  GitHubWorkflowJobsClient;

export type GitHubChecksFetcher = (context: PullRequestContext) => Promise<NormalizedCheck[]>;

export type GetOctokit = (token: string) => GitHubChecksClient;

export interface GitHubJsonTransport {
  getJson(url: string, headers: Record<string, string>): Promise<unknown>;
}

export interface GitHubTextTransport {
  getText(url: string, headers: Record<string, string>): Promise<string>;
}

const defaultGitHubTransport: GitHubJsonTransport = {
  getJson: async (url, headers) => {
    const response = await fetch(url, { headers });

    if (!response.ok) {
      throw new Error(`GitHub API request failed: ${response.status} ${response.statusText}`);
    }

    return response.json();
  }
};

const defaultGitHubTextTransport: GitHubTextTransport = {
  getText: async (url, headers) => {
    const response = await fetch(url, { headers });

    if (!response.ok) {
      throw new Error(`GitHub API request failed: ${response.status} ${response.statusText}`);
    }

    return response.text();
  }
};

export interface WorkflowRunContext {
  owner: string;
  repo: string;
  runId: number;
}

export interface WorkflowJobContext {
  owner: string;
  repo: string;
  jobId: number;
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

export async function fetchWorkflowJobLog(
  context: WorkflowJobContext,
  client: GitHubWorkflowJobLogsClient
): Promise<string> {
  const response = await client.request("GET /repos/{owner}/{repo}/actions/jobs/{job_id}/logs", {
    owner: context.owner,
    repo: context.repo,
    job_id: context.jobId
  });

  return response.data;
}

export async function attachWorkflowJobLogs(
  context: Omit<WorkflowJobContext, "jobId">,
  checks: NormalizedCheck[],
  client: GitHubWorkflowJobLogsClient
): Promise<NormalizedCheck[]> {
  const triageJobIds = new Set(
    selectTriageCandidates(checks)
      .map((check) => check.jobId)
      .filter((jobId): jobId is number => typeof jobId === "number")
  );

  return Promise.all(
    checks.map(async (check) => {
      if (typeof check.jobId !== "number" || !triageJobIds.has(check.jobId)) {
        return check;
      }

      try {
        const log = await fetchWorkflowJobLog({ ...context, jobId: check.jobId }, client);
        return { ...check, log };
      } catch {
        return check;
      }
    })
  );
}

export async function fetchGitHubChecks(
  context: PullRequestContext,
  client: GitHubChecksClient
): Promise<NormalizedCheck[]> {
  const [checkRuns, workflowRunIds] = await Promise.all([
    fetchCheckRuns(context, client),
    fetchWorkflowRunIds(context, client)
  ]);
  const workflowJobs = await Promise.all(
    workflowRunIds.map((runId) =>
      fetchWorkflowJobs(
        {
          owner: context.owner,
          repo: context.repo,
          runId
        },
        client
      )
    )
  );

  return [...checkRuns, ...workflowJobs.flat()];
}

export function createGitHubChecksFetcher(
  token: string,
  getOctokit: GetOctokit
): GitHubChecksFetcher {
  const client = getOctokit(token);

  return (context) => fetchGitHubChecks(context, client);
}

export function createGitHubJobLogsClient(
  token: string,
  transport: GitHubTextTransport = defaultGitHubTextTransport
): GitHubWorkflowJobLogsClient {
  const request = async (route: string, params: Record<string, string | number>) => {
    const data = await transport.getText(buildGitHubApiUrl(route, params), {
      accept: "application/vnd.github+json",
      authorization: `Bearer ${token}`,
      "user-agent": "pr-check-doctor",
      "x-github-api-version": "2022-11-28"
    });

    return { data };
  };

  return {
    request: request as GitHubWorkflowJobLogsClient["request"]
  };
}

export function createGitHubChecksClient(
  token: string,
  transport: GitHubJsonTransport = defaultGitHubTransport
): GitHubChecksClient {
  const request = async (route: string, params: Record<string, string | number>) => {
    const data = await transport.getJson(buildGitHubApiUrl(route, params), {
      accept: "application/vnd.github+json",
      authorization: `Bearer ${token}`,
      "user-agent": "pr-check-doctor",
      "x-github-api-version": "2022-11-28"
    });

    return { data };
  };

  return {
    request: request as GitHubChecksClient["request"]
  };
}

function buildGitHubApiUrl(route: string, params: Record<string, string | number>): string {
  const baseUrl = "https://api.github.com";
  const owner = encodeURIComponent(String(params.owner));
  const repo = encodeURIComponent(String(params.repo));

  if (route === "GET /repos/{owner}/{repo}/commits/{ref}/check-runs") {
    return `${baseUrl}/repos/${owner}/${repo}/commits/${encodeURIComponent(
      String(params.ref)
    )}/check-runs`;
  }

  if (route === "GET /repos/{owner}/{repo}/actions/runs/{run_id}/jobs") {
    return `${baseUrl}/repos/${owner}/${repo}/actions/runs/${params.run_id}/jobs`;
  }

  if (route === "GET /repos/{owner}/{repo}/actions/jobs/{job_id}/logs") {
    return `${baseUrl}/repos/${owner}/${repo}/actions/jobs/${params.job_id}/logs`;
  }

  if (route === "GET /repos/{owner}/{repo}/actions/runs") {
    const query = new URLSearchParams({
      head_sha: String(params.head_sha),
      per_page: String(params.per_page)
    });

    return `${baseUrl}/repos/${owner}/${repo}/actions/runs?${query}`;
  }

  throw new Error(`Unsupported GitHub API route: ${route}`);
}
