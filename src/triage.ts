import { analyzeChecks } from "./analyze.js";
import { renderComment } from "./comment.js";
import { normalizeGitHubChecks, type GitHubChecksLike } from "./github/checks.js";
import type { DoctorConfig, NormalizedCheck } from "./types.js";

export interface TriageCommentInput {
  config: DoctorConfig;
  gitHubChecks: GitHubChecksLike;
  logsByCheckName?: Record<string, string>;
}

export interface TriageChecksInput {
  config: DoctorConfig;
  checks: NormalizedCheck[];
  logsByCheckName?: Record<string, string>;
  ignoredWarningCheckNames?: string[];
}

export function createTriageComment(input: TriageCommentInput): string {
  return createTriageCommentFromChecks({
    config: input.config,
    checks: normalizeGitHubChecks(input.gitHubChecks),
    logsByCheckName: input.logsByCheckName
  });
}

export function createTriageCommentFromChecks(input: TriageChecksInput): string {
  const checks = input.checks.map((check) => attachLog(check, input.logsByCheckName));
  return renderComment(
    analyzeChecks(checks, input.config, {
      ignoredWarningCheckNames: input.ignoredWarningCheckNames
    }),
    input.config.comment.language
  );
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
