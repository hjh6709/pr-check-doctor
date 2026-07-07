export type FailureCategory =
  | "test_failure"
  | "race_detected"
  | "lint_failure"
  | "format_drift"
  | "dependency_drift"
  | "build_failure"
  | "vulnerability"
  | "infra_validation"
  | "commit_policy"
  | "external_flake"
  | "cancelled"
  | "timeout"
  | "unknown";

export type Verdict = "PASS" | "WARN" | "BLOCK";

export type CheckConclusion =
  | "success"
  | "failure"
  | "cancelled"
  | "timed_out"
  | "neutral"
  | "skipped"
  | "action_required"
  | "startup_failure"
  | "unknown";

export interface CheckRule {
  category?: FailureCategory;
  local_command?: string;
  blocks_merge?: boolean;
}

export interface DoctorConfig {
  comment: {
    mode: "update";
    language: "en" | "ko";
  };
  verdict: {
    block_on: FailureCategory[];
  };
  checks: Record<string, CheckRule>;
}

export interface NormalizedCheck {
  name: string;
  workflowName?: string;
  conclusion: CheckConclusion;
  status?: "queued" | "in_progress" | "completed" | "unknown";
  log?: string;
}

export interface LogSnippet {
  text: string;
  truncated: boolean;
}

export interface ClassifiedIssue {
  checkName: string;
  workflowName?: string;
  category: FailureCategory;
  conclusion: CheckConclusion;
  blocksMerge: boolean;
  likelyCause: string;
  localCommand?: string;
  snippet?: LogSnippet;
}

export interface AnalysisResult {
  verdict: Verdict;
  issues: ClassifiedIssue[];
  warnings: string[];
}
