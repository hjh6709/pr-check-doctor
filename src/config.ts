import yaml from "js-yaml";
import type { CheckRule, DoctorConfig, FailureCategory } from "./types.js";

const defaultBlockingCategories: FailureCategory[] = [
  "test_failure",
  "race_detected",
  "lint_failure",
  "format_drift",
  "dependency_drift",
  "build_failure",
  "vulnerability",
  "infra_validation",
  "commit_policy",
  "cancelled",
  "timeout"
];

export const defaultConfig: DoctorConfig = {
  comment: {
    mode: "update",
    language: "en"
  },
  verdict: {
    block_on: defaultBlockingCategories
  },
  checks: {}
};

export interface MatchingCheckRule {
  pattern: string;
  rule: CheckRule;
}

interface RawConfig {
  comment?: {
    mode?: unknown;
    language?: unknown;
  };
  verdict?: {
    block_on?: unknown;
  };
  checks?: unknown;
}

export function parseDoctorConfig(configText: string): DoctorConfig {
  const raw = parseYaml(configText);

  return {
    comment: {
      mode: "update",
      language: raw.comment?.language === "ko" ? "ko" : defaultConfig.comment.language
    },
    verdict: {
      block_on: parseBlockOn(raw.verdict?.block_on)
    },
    checks: parseChecks(raw.checks)
  };
}

export function findMatchingCheckRule(
  checkName: string,
  config: DoctorConfig
): MatchingCheckRule | undefined {
  const normalizedCheckName = normalizeForMatch(checkName);

  for (const [pattern, rule] of Object.entries(config.checks)) {
    if (normalizedCheckName.includes(normalizeForMatch(pattern))) {
      return { pattern, rule };
    }
  }

  return undefined;
}

function parseYaml(configText: string): RawConfig {
  if (configText.trim() === "") {
    return {};
  }

  const parsed = yaml.load(configText);

  if (!isRecord(parsed)) {
    return {};
  }

  return parsed as RawConfig;
}

function parseBlockOn(value: unknown): FailureCategory[] {
  if (!Array.isArray(value)) {
    return [...defaultConfig.verdict.block_on];
  }

  return value.filter(isFailureCategory);
}

function parseChecks(value: unknown): Record<string, CheckRule> {
  if (!isRecord(value)) {
    return {};
  }

  const checks: Record<string, CheckRule> = {};

  for (const [pattern, rawRule] of Object.entries(value)) {
    if (!isRecord(rawRule)) {
      continue;
    }

    const rule: CheckRule = {};

    if (isFailureCategory(rawRule.category)) {
      rule.category = rawRule.category;
    }

    if (typeof rawRule.local_command === "string") {
      rule.local_command = rawRule.local_command.trimEnd();
    }

    if (typeof rawRule.blocks_merge === "boolean") {
      rule.blocks_merge = rawRule.blocks_merge;
    }

    checks[pattern] = rule;
  }

  return checks;
}

function normalizeForMatch(value: string): string {
  return value.toLowerCase().trim();
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isFailureCategory(value: unknown): value is FailureCategory {
  return (
    value === "test_failure" ||
    value === "race_detected" ||
    value === "lint_failure" ||
    value === "format_drift" ||
    value === "dependency_drift" ||
    value === "build_failure" ||
    value === "vulnerability" ||
    value === "infra_validation" ||
    value === "commit_policy" ||
    value === "external_flake" ||
    value === "cancelled" ||
    value === "timeout" ||
    value === "unknown"
  );
}
