import { translate, type Language, type Strings } from "./i18n.js";
import type { AnalysisResult, ClassifiedIssue } from "./types.js";

export const commentMarker = "<!-- pr-check-doctor -->";

export function renderComment(result: AnalysisResult, language: Language): string {
  const strings = translate(language);
  const sections = [
    commentMarker,
    "## PR Check Doctor",
    "",
    `${strings.verdictLabel}: ${result.verdict}`,
    "",
    renderWarnings(result.warnings, strings),
    "",
    renderIssues(result.issues, strings),
    "",
    renderNextActions(result.issues, strings)
  ];

  return sections.filter((section) => section.length > 0).join("\n").trimEnd();
}

function renderWarnings(warnings: string[], strings: Strings): string {
  if (warnings.length === 0) {
    return "";
  }

  return [`### ${strings.warningsHeading}`, "", ...warnings.map((warning) => `- ${warning}`)].join("\n");
}

function renderIssues(issues: ClassifiedIssue[], strings: Strings): string {
  if (issues.length === 0) {
    return strings.noFailedChecks;
  }

  return [
    `### ${strings.failedChecksHeading}`,
    "",
    ...issues.map((issue) => renderIssue(issue, strings))
  ].join("\n");
}

function renderIssue(issue: ClassifiedIssue, strings: Strings): string {
  const lines = [
    `#### ${issue.checkName}`,
    `- ${strings.categoryLabel}: ${issue.category}`,
    `- ${strings.impactLabel}: ${issue.blocksMerge ? strings.impactBlocking : strings.impactNonBlocking}`,
    `- ${strings.likelyCauseLabel}: ${issue.likelyCause}`
  ];

  if (issue.snippet) {
    lines.push(
      "",
      `- ${strings.keyLogLabel}:`,
      "  ```text",
      indentForListCodeBlock(issue.snippet.text),
      "  ```"
    );
  }

  if (issue.localCommand) {
    lines.push(
      "",
      `- ${strings.reproduceLocallyLabel}:`,
      "  ```bash",
      indentForListCodeBlock(issue.localCommand),
      "  ```"
    );
  }

  return lines.join("\n");
}

function renderNextActions(issues: ClassifiedIssue[], strings: Strings): string {
  if (issues.length === 0) {
    return `### ${strings.nextActionsHeading}\n\n${strings.noActionRequired}`;
  }

  const blockingIssues = issues.filter((issue) => issue.blocksMerge);
  const issueList = blockingIssues.length > 0 ? blockingIssues : issues;

  return [
    `### ${strings.nextActionsHeading}`,
    "",
    ...issueList.map((issue, index) => `${index + 1}. ${strings.fixOrInspect(issue.checkName)}`),
    `${issueList.length + 1}. ${strings.rerunAffectedChecks}`
  ].join("\n");
}

function indentForListCodeBlock(value: string): string {
  return value
    .split(/\r?\n/)
    .map((line) => `  ${line}`)
    .join("\n");
}
