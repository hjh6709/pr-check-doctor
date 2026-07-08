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

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
