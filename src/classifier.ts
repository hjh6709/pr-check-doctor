import { findMatchingCheckRule } from "./config.js";
import { extractLogSnippet } from "./logs.js";
import type { ClassifiedIssue, DoctorConfig, FailureCategory, NormalizedCheck } from "./types.js";

const likelyCauses: Record<FailureCategory, string> = {
  test_failure: "A test command failed.",
  race_detected: "Go race detector reported a data race.",
  lint_failure: "A lint check reported code quality issues.",
  format_drift: "A formatting check detected files that need formatting.",
  dependency_drift: "Dependency files are out of sync or failed to resolve.",
  build_failure: "A build command failed.",
  vulnerability: "A security scan reported a vulnerability.",
  infra_validation: "Infrastructure or configuration validation failed.",
  commit_policy: "Commit message or PR title policy failed.",
  external_flake: "The check appears to be affected by an external or flaky failure.",
  cancelled: "The check was cancelled before it completed.",
  timeout: "The check timed out.",
  unknown: "The check failed, but PR Check Doctor could not classify the root cause yet."
};

export function classifyCheck(check: NormalizedCheck, config: DoctorConfig): ClassifiedIssue {
  const match = findMatchingCheckRule(check.name, config);
  // Repository config wins over built-in heuristics because local check names carry project context.
  const category = match?.rule.category ?? classifyByBuiltInPatterns(check);
  const snippet = check.log ? extractLogSnippet(check.log) : undefined;
  const blocksMerge = match?.rule.blocks_merge ?? config.verdict.block_on.includes(category);

  return {
    checkName: check.name,
    workflowName: check.workflowName,
    category,
    conclusion: check.conclusion,
    blocksMerge,
    likelyCause: likelyCauses[category],
    localCommand: match?.rule.local_command ?? builtInLocalCommand(check),
    snippet
  };
}

function classifyByBuiltInPatterns(check: NormalizedCheck): FailureCategory {
  if (check.conclusion === "cancelled") {
    return "cancelled";
  }

  if (check.conclusion === "timed_out") {
    return "timeout";
  }

  const haystack = buildHaystack(check);

  // Order matters: specific signals should be classified before broad words such as "lint" or "build".
  if (haystack.includes("warning: data race")) {
    return "race_detected";
  }

  if (/\b(commitlint|conventional commits?|pr title)\b/.test(haystack)) {
    return "commit_policy";
  }

  if (/\b(trivy|vulnerabilit(?:y|ies)|cve-)\b/.test(haystack)) {
    return "vulnerability";
  }

  if (/\b(golangci-lint|eslint|ruff|pre-commit|lint)\b/.test(haystack)) {
    return "lint_failure";
  }

  if (/\b(format|formatted|prettier|black|gofmt)\b/.test(haystack)) {
    return "format_drift";
  }

  if (/\b(go mod tidy|lockfile|dependency|dependencies|pnpm install|npm install)\b/.test(haystack)) {
    return "dependency_drift";
  }

  if (/\b(docker build|build failed|image build|exit code)\b/.test(haystack)) {
    return "build_failure";
  }

  if (/\b(terraform|kubernetes|kubectl|ansible|yaml|policy validation)\b/.test(haystack)) {
    return "infra_validation";
  }

  if (/\b(test failed|failing test|go test|pytest|vitest|jest)\b/.test(haystack)) {
    return "test_failure";
  }

  if (/\b(timed out|timeout)\b/.test(haystack)) {
    return "timeout";
  }

  return "unknown";
}

function buildHaystack(check: NormalizedCheck): string {
  return `${check.workflowName ?? ""}\n${check.name}\n${check.log ?? ""}`.toLowerCase();
}

const builtInLocalCommands: Array<{ pattern: RegExp; command: string }> = [
  { pattern: /\bgolangci-lint\b/, command: "golangci-lint run" },
  { pattern: /\beslint\b/, command: "npx eslint ." },
  { pattern: /\bruff\b/, command: "ruff check ." },
  { pattern: /\bpre-commit\b/, command: "pre-commit run --all-files" },
  { pattern: /\bprettier\b/, command: "npx prettier --check ." },
  { pattern: /\bblack\b/, command: "black --check ." },
  { pattern: /\bgofmt\b/, command: "gofmt -l ." },
  { pattern: /\bgo mod tidy\b/, command: "go mod tidy" },
  { pattern: /\bpnpm install\b/, command: "pnpm install" },
  { pattern: /\bnpm install\b/, command: "npm install" },
  { pattern: /\bdocker build\b/, command: "docker build ." },
  { pattern: /\bterraform\b/, command: "terraform validate" },
  { pattern: /\bgo test\b/, command: "go test ./..." },
  { pattern: /\bpytest\b/, command: "pytest" },
  { pattern: /\bvitest\b/, command: "npx vitest run" },
  { pattern: /\bjest\b/, command: "npx jest" },
  { pattern: /\btrivy\b/, command: "trivy fs ." }
];

function builtInLocalCommand(check: NormalizedCheck): string | undefined {
  const haystack = buildHaystack(check);

  return builtInLocalCommands.find(({ pattern }) => pattern.test(haystack))?.command;
}
