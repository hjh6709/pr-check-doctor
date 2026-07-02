import type { CheckConclusion, NormalizedCheck } from "./types.js";

type CheckRunStatus = NonNullable<NormalizedCheck["status"]>;

export interface GitHubCheckRunLike {
  name: string;
  conclusion: string | null;
  status: string | null;
}

export function mapCheckRun(checkRun: GitHubCheckRunLike): NormalizedCheck {
  return {
    name: checkRun.name,
    conclusion: normalizeConclusion(checkRun.conclusion),
    status: normalizeStatus(checkRun.status)
  };
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
