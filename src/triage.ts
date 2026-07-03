import { analyzeChecks } from "./analyze.js";
import { renderComment } from "./comment.js";
import { normalizeGitHubChecks, type GitHubChecksLike } from "./github-checks.js";
import type { DoctorConfig, NormalizedCheck } from "./types.js";

export interface TriageCommentInput {
  config: DoctorConfig;
  gitHubChecks: GitHubChecksLike;
  logsByCheckName?: Record<string, string>;
}

export function createTriageComment(input: TriageCommentInput): string {
  const checks = normalizeGitHubChecks(input.gitHubChecks).map((check) =>
    attachLog(check, input.logsByCheckName)
  );

  return renderComment(analyzeChecks(checks, input.config));
}

function attachLog(
  check: NormalizedCheck,
  logsByCheckName: Record<string, string> | undefined
): NormalizedCheck {
  const log = logsByCheckName?.[check.name];

  if (!log) {
    return check;
  }

  return {
    ...check,
    log
  };
}
