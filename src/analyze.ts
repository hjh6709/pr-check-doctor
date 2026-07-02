import { calculateVerdict } from "./verdict.js";
import { selectTriageCandidates } from "./checks.js";
import { classifyCheck } from "./classifier.js";
import type { AnalysisResult, DoctorConfig, NormalizedCheck } from "./types.js";

export function analyzeChecks(checks: NormalizedCheck[], config: DoctorConfig): AnalysisResult {
  const issues = selectTriageCandidates(checks).map((check) => classifyCheck(check, config));

  return {
    verdict: calculateVerdict(issues),
    issues
  };
}
