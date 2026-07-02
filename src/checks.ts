import type { CheckConclusion, NormalizedCheck } from "./types.js";

const triageConclusions = new Set<CheckConclusion>([
  "failure",
  "cancelled",
  "timed_out",
  "action_required",
  "startup_failure"
]);

export function selectTriageCandidates(checks: NormalizedCheck[]): NormalizedCheck[] {
  return checks.filter((check) => triageConclusions.has(check.conclusion));
}
