import type { CheckConclusion, NormalizedCheck } from "./types.js";

const triageConclusions = new Set<CheckConclusion>([
  "failure",
  "cancelled",
  "timed_out",
  "action_required",
  "startup_failure"
]);

export function selectTriageCandidates(checks: NormalizedCheck[]): NormalizedCheck[] {
  // Successful, skipped, and still-running checks should not become failure issues.
  return checks.filter((check) => triageConclusions.has(check.conclusion));
}
