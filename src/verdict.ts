import type { ClassifiedIssue, Verdict } from "./types.js";

export function calculateVerdict(issues: ClassifiedIssue[]): Verdict {
  if (issues.length === 0) {
    return "PASS";
  }

  if (issues.some((issue) => issue.blocksMerge)) {
    return "BLOCK";
  }

  return "WARN";
}
