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
  return deduplicateNormalizedChecks([
    ...checks.checkRuns.map(mapCheckRun),
    ...checks.workflowJobs.map(mapWorkflowJob)
  ]);
}

export function deduplicateNormalizedChecks(checks: NormalizedCheck[]): NormalizedCheck[] {
  const deduplicated: NormalizedCheck[] = [];

  for (const check of checks) {
    const duplicateIndex = deduplicated.findIndex((candidate) => isDuplicateCheck(candidate, check));

    if (duplicateIndex === -1) {
      deduplicated.push(check);
      continue;
    }

    deduplicated[duplicateIndex] = mergeDuplicateChecks(deduplicated[duplicateIndex]!, check);
  }

  return deduplicated;
}

function isDuplicateCheck(left: NormalizedCheck, right: NormalizedCheck): boolean {
  if (normalizeName(left.name) !== normalizeName(right.name)) {
    return false;
  }

  return left.jobId === undefined || right.jobId === undefined || left.jobId === right.jobId;
}

function mergeDuplicateChecks(left: NormalizedCheck, right: NormalizedCheck): NormalizedCheck {
  const preferred = right.jobId !== undefined && left.jobId === undefined ? right : left;
  const fallback = preferred === left ? right : left;

  // Workflow jobs carry the job id needed for log download, while check runs often only mirror state.
  return {
    ...fallback,
    ...preferred,
    workflowName: preferred.workflowName ?? fallback.workflowName,
    log: preferred.log ?? fallback.log,
    status: preferred.status === "unknown" ? fallback.status : preferred.status,
    conclusion: preferred.conclusion === "unknown" ? fallback.conclusion : preferred.conclusion
  };
}

function normalizeName(value: string): string {
  return value.toLowerCase().trim();
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
