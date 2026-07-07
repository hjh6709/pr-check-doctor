import type { CheckConclusion, NormalizedCheck } from "./types.js";

type CheckRunStatus = NonNullable<NormalizedCheck["status"]>;

export interface GitHubCheckRunLike {
  name: string;
  conclusion: string | null;
  status: string | null;
}

export interface GitHubWorkflowJobLike {
  id?: number;
  name: string;
  conclusion: string | null;
  status: string | null;
  workflow_name?: string | null;
}

export interface GitHubChecksLike {
  checkRuns: GitHubCheckRunLike[];
  workflowJobs: GitHubWorkflowJobLike[];
}

export function mapCheckRun(checkRun: GitHubCheckRunLike): NormalizedCheck {
  return {
    name: checkRun.name,
    conclusion: normalizeConclusion(checkRun.conclusion),
    status: normalizeStatus(checkRun.status)
  };
}

export function mapWorkflowJob(job: GitHubWorkflowJobLike): NormalizedCheck {
  return {
    ...(typeof job.id === "number" ? { jobId: job.id } : {}),
    name: job.name,
    ...(job.workflow_name ? { workflowName: job.workflow_name } : {}),
    conclusion: normalizeConclusion(job.conclusion),
    status: normalizeStatus(job.status)
  };
}

export function normalizeGitHubChecks(
  checks: GitHubChecksLike
): NormalizedCheck[] {
  return [
    ...checks.checkRuns.map(mapCheckRun),
    ...checks.workflowJobs.map(mapWorkflowJob)
  ];
}

function normalizeConclusion(conclusion: string | null): CheckConclusion {
  switch (conclusion) {
    case "success":
    case "failure":
    case "cancelled":
    case "timed_out":
    case "neutral":
    case "skipped":
    case "action_required":
    case "startup_failure":
      return conclusion;
    default:
      return "unknown";
  }
}

function normalizeStatus(status: string | null): CheckRunStatus {
  switch (status) {
    case "queued":
    case "in_progress":
    case "completed":
      return status;
    default:
      return "unknown";
  }
}
