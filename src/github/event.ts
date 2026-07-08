export interface PullRequestContext {
  owner: string;
  repo: string;
  pullNumber: number;
  headSha: string;
}

export function parsePullRequestEvent(payload: unknown): PullRequestContext {
  if (!isRecord(payload)) {
    throw new Error("Expected pull_request event payload.");
  }

  const pullNumber = payload.number;
  const repository = payload.repository;
  const pullRequest = payload.pull_request;

  if (
    typeof pullNumber !== "number" ||
    !isRecord(repository) ||
    !isRecord(repository.owner) ||
    typeof repository.owner.login !== "string" ||
    typeof repository.name !== "string" ||
    !isRecord(pullRequest) ||
    !isRecord(pullRequest.head) ||
    typeof pullRequest.head.sha !== "string"
  ) {
    throw new Error("Expected pull_request event payload.");
  }

  return {
    owner: repository.owner.login,
    repo: repository.name,
    pullNumber,
    headSha: pullRequest.head.sha
  };
}

export interface WorkflowRunEventContext {
  owner: string;
  repo: string;
  headSha: string;
  isPullRequestRun: boolean;
}

export function parseWorkflowRunEvent(payload: unknown): WorkflowRunEventContext {
  if (!isRecord(payload)) {
    throw new Error("Expected workflow_run event payload.");
  }

  const repository = payload.repository;
  const workflowRun = payload.workflow_run;

  if (
    !isRecord(repository) ||
    !isRecord(repository.owner) ||
    typeof repository.owner.login !== "string" ||
    typeof repository.name !== "string" ||
    !isRecord(workflowRun) ||
    typeof workflowRun.head_sha !== "string"
  ) {
    throw new Error("Expected workflow_run event payload.");
  }

  return {
    owner: repository.owner.login,
    repo: repository.name,
    headSha: workflowRun.head_sha,
    // workflow_run fires for every trigger of the source workflow (push, schedule, ...), not
    // just pull_request, and it does not carry a pull request number here — forked-repo runs
    // often leave `workflow_run.pull_requests` empty, so the caller must look the PR number up
    // separately (see fetchAssociatedPullNumber in api.ts).
    isPullRequestRun: workflowRun.event === "pull_request"
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
