import { calculateVerdict } from "./verdict.js";
import { selectTriageCandidates } from "./checks.js";
import { classifyCheck } from "./classifier.js";
import type { AnalysisResult, DoctorConfig, NormalizedCheck } from "./types.js";

export function analyzeChecks(checks: NormalizedCheck[], config: DoctorConfig): AnalysisResult {
  const issues = selectTriageCandidates(checks).map((check) => classifyCheck(check, config));

  return {
    verdict: calculateVerdict(issues),
    issues,
    warnings: createWarnings(checks)
  };
}

function createWarnings(checks: NormalizedCheck[]): string[] {
  const incompleteCheckNames = checks
    .filter((check) => check.status === "queued" || check.status === "in_progress")
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
