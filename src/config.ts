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

export interface ParsedDoctorConfig {
  config: DoctorConfig;
  warnings: string[];
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

export function parseDoctorConfig(configText: string): ParsedDoctorConfig {
  const raw = parseYaml(configText);
  const warnings: string[] = [];

  const config: DoctorConfig = {
    comment: {
      mode: "update",
      language: raw.comment?.language === "ko" ? "ko" : defaultConfig.comment.language
    },
    verdict: {
      block_on: parseBlockOn(raw.verdict?.block_on, warnings)
    },
    checks: parseChecks(raw.checks, warnings)
  };

  return { config, warnings };
}

export function findMatchingCheckRule(
  checkName: string,
  config: DoctorConfig
): MatchingCheckRule | undefined {
  const normalizedCheckName = normalizeForMatch(checkName);

  for (const [pattern, rule] of Object.entries(config.checks)) {
    if (buildMatchPattern(normalizeForMatch(pattern)).test(normalizedCheckName)) {
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

function parseBlockOn(value: unknown, warnings: string[]): FailureCategory[] {
  if (!Array.isArray(value)) {
    // Missing or invalid verdict config falls back to the conservative default blocking set.
    return [...defaultConfig.verdict.block_on];
  }

  return value.filter((entry) => {
    if (isFailureCategory(entry)) {
      return true;
    }

    warnings.push(`Ignored unknown category "${String(entry)}" in verdict.block_on.`);
    return false;
  });
}

function parseChecks(value: unknown, warnings: string[]): Record<string, CheckRule> {
  if (!isRecord(value)) {
    return {};
  }

  const checks: Record<string, CheckRule> = {};

  for (const [pattern, rawRule] of Object.entries(value)) {
    if (!isRecord(rawRule)) {
      // Ignore malformed entries instead of failing the whole action on one bad check rule.
      warnings.push(`Ignored malformed check rule for "${pattern}".`);
      continue;
    }

    const rule: CheckRule = {};

    if (rawRule.category !== undefined) {
      if (isFailureCategory(rawRule.category)) {
        rule.category = rawRule.category;
      } else {
        warnings.push(
          `Ignored unknown category "${String(rawRule.category)}" for check rule "${pattern}".`
        );
      }
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

function buildMatchPattern(normalizedPattern: string): RegExp {
  const escaped = normalizedPattern
    .split("*")
    .map(escapeRegExpLiteral)
    .join(".*");

  return new RegExp(escaped);
}

function escapeRegExpLiteral(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
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
