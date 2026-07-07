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
      per_page: number;
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
      per_page: number;
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
export type GetGitHubJobLogsClient = (token: string) => GitHubWorkflowJobLogsClient;

interface GitHubJsonPage {
  data: unknown;
  nextUrl?: string;
}

type GitHubJsonTransportResult = GitHubJsonPage | unknown;

export interface GitHubJsonTransport {
  getJson(url: string, headers: Record<string, string>): Promise<GitHubJsonTransportResult>;
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

    return {
      data: await response.json(),
      nextUrl: parseNextLinkUrl(response.headers.get("link"))
    };
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

interface AttachWorkflowJobLogsOptions {
  maxLogChars?: number;
}

const defaultMaxAttachedLogChars = 200_000;

export async function fetchCheckRuns(
  context: PullRequestContext,
  client: GitHubCheckRunsClient
): Promise<NormalizedCheck[]> {
  const response = await client.request("GET /repos/{owner}/{repo}/commits/{ref}/check-runs", {
    owner: context.owner,
    repo: context.repo,
    ref: context.headSha,
    per_page: 100
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
    run_id: context.runId,
    per_page: 100
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
  client: GitHubWorkflowJobLogsClient,
  options: AttachWorkflowJobLogsOptions = {}
): Promise<NormalizedCheck[]> {
  const maxLogChars = options.maxLogChars ?? defaultMaxAttachedLogChars;
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
        return { ...check, log: log.slice(0, maxLogChars) };
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

export function createGitHubChecksWithLogsFetcher(
  token: string,
  getChecksClient: GetOctokit,
  getJobLogsClient: GetGitHubJobLogsClient
): GitHubChecksFetcher {
  const checksClient = getChecksClient(token);
  const jobLogsClient = getJobLogsClient(token);

  return async (context) => {
    const checks = await fetchGitHubChecks(context, checksClient);

    return attachWorkflowJobLogs(
      {
        owner: context.owner,
        repo: context.repo
      },
      checks,
      jobLogsClient
    );
  };
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
    const headers = {
      accept: "application/vnd.github+json",
      authorization: `Bearer ${token}`,
      "user-agent": "pr-check-doctor",
      "x-github-api-version": "2022-11-28"
    };
    const data = await fetchMergedJsonPages(buildGitHubApiUrl(route, params), headers, transport);

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
    const query = new URLSearchParams({
      per_page: String(params.per_page)
    });

    return `${baseUrl}/repos/${owner}/${repo}/commits/${encodeURIComponent(
      String(params.ref)
    )}/check-runs?${query}`;
  }

  if (route === "GET /repos/{owner}/{repo}/actions/runs/{run_id}/jobs") {
    const query = new URLSearchParams({
      per_page: String(params.per_page)
    });

    return `${baseUrl}/repos/${owner}/${repo}/actions/runs/${params.run_id}/jobs?${query}`;
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

async function fetchMergedJsonPages(
  url: string,
  headers: Record<string, string>,
  transport: GitHubJsonTransport
): Promise<unknown> {
  const pages: unknown[] = [];
  const seenUrls = new Set<string>();
  let nextUrl: string | undefined = url;

  while (nextUrl) {
    if (seenUrls.has(nextUrl)) {
      throw new Error(`GitHub API pagination loop detected at ${nextUrl}`);
    }

    seenUrls.add(nextUrl);
    const page = normalizeJsonPage(await transport.getJson(nextUrl, headers));
    pages.push(page.data);
    nextUrl = page.nextUrl;
  }

  return mergeJsonPages(pages);
}

function normalizeJsonPage(result: GitHubJsonTransportResult): GitHubJsonPage {
  if (isJsonPageEnvelope(result)) {
    return {
      data: result.data,
      nextUrl: typeof result.nextUrl === "string" ? result.nextUrl : undefined
    };
  }

  return { data: result };
}

function isJsonPageEnvelope(value: unknown): value is GitHubJsonPage {
  return (
    isRecord(value) &&
    "data" in value &&
    !("check_runs" in value) &&
    !("jobs" in value) &&
    !("workflow_runs" in value)
  );
}

function mergeJsonPages(pages: unknown[]): unknown {
  const firstPage = pages[0];

  if (pages.length <= 1 || !isRecord(firstPage)) {
    return firstPage;
  }

  for (const key of ["check_runs", "jobs", "workflow_runs"]) {
    if (Array.isArray(firstPage[key])) {
      return {
        ...firstPage,
        [key]: pages.flatMap((page) => (isRecord(page) && Array.isArray(page[key]) ? page[key] : []))
      };
    }
  }

  return firstPage;
}

function parseNextLinkUrl(linkHeader: string | null): string | undefined {
  if (!linkHeader) {
    return undefined;
  }

  for (const part of linkHeader.split(",")) {
    const match = part.match(/<([^>]+)>;\s*rel="next"/);
    if (match?.[1]) {
      return match[1];
    }
  }

  return undefined;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
