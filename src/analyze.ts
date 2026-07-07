import { calculateVerdict } from "./verdict.js";
import { selectTriageCandidates } from "./checks.js";
import { classifyCheck } from "./classifier.js";
import type { AnalysisResult, DoctorConfig, NormalizedCheck } from "./types.js";

interface AnalysisOptions {
  ignoredWarningCheckNames?: string[];
}

export function analyzeChecks(
  checks: NormalizedCheck[],
  config: DoctorConfig,
  options: AnalysisOptions = {}
): AnalysisResult {
  const issues = selectTriageCandidates(checks).map((check) => classifyCheck(check, config));

  return {
    verdict: calculateVerdict(issues),
    issues,
    // Pending checks are not failures yet, but the comment should make incomplete triage explicit.
    warnings: createWarnings(checks, options.ignoredWarningCheckNames ?? [])
  };
}

function createWarnings(checks: NormalizedCheck[], ignoredCheckNames: string[]): string[] {
  const ignoredNames = new Set(ignoredCheckNames.map(normalizeCheckName));
  const incompleteCheckNames = checks
    .filter((check) => check.status === "queued" || check.status === "in_progress")
    .filter((check) => !ignoredNames.has(normalizeCheckName(check.name)))
    .map((check) => check.name);

  if (incompleteCheckNames.length === 0) {
    return [];
  }

  return [
    `Some checks are still running or queued: ${incompleteCheckNames.join(
      ", "
    )}. Run this action as the final job with \`if: always()\` and \`needs\` to avoid incomplete triage.`
  ];
}

function normalizeCheckName(value: string): string {
  return value.toLowerCase().trim().replace(/[-_\s]+/g, " ");
}
