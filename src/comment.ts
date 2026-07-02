import type { AnalysisResult, ClassifiedIssue } from "./types.js";

const commentMarker = "<!-- pr-check-doctor -->";

export function renderComment(result: AnalysisResult): string {
  const sections = [
    commentMarker,
    "## PR Check Doctor",
    "",
    `Verdict: ${result.verdict}`,
    "",
    renderIssues(result.issues),
    "",
    renderNextActions(result.issues)
  ];

  return sections.filter((section) => section.length > 0).join("\n").trimEnd();
}

function renderIssues(issues: ClassifiedIssue[]): string {
  if (issues.length === 0) {
    return "No failed or blocking checks were found.";
  }

  return ["### Failed Checks", "", ...issues.map(renderIssue)].join("\n");
}

function renderIssue(issue: ClassifiedIssue): string {
  const lines = [
    `#### ${issue.checkName}`,
    `- Category: ${issue.category}`,
    `- Impact: ${issue.blocksMerge ? "merge blocking" : "non-blocking"}`,
    `- Likely cause: ${issue.likelyCause}`
  ];

  if (issue.snippet) {
    lines.push("", "- Key log:", "  ```text", indentForListCodeBlock(issue.snippet.text), "  ```");
  }

  if (issue.localCommand) {
    lines.push("", "- Reproduce locally:", "  ```bash", indentForListCodeBlock(issue.localCommand), "  ```");
  }

  return lines.join("\n");
}

function renderNextActions(issues: ClassifiedIssue[]): string {
  if (issues.length === 0) {
    return "### Next Actions\n\nNo action required.";
  }

  const blockingIssues = issues.filter((issue) => issue.blocksMerge);
  const issueList = blockingIssues.length > 0 ? blockingIssues : issues;

  return [
    "### Next Actions",
    "",
    ...issueList.map((issue, index) => `${index + 1}. Fix or inspect \`${issue.checkName}\`.`),
    `${issueList.length + 1}. Re-run the affected PR checks after pushing the fix.`
  ].join("\n");
}

function indentForListCodeBlock(value: string): string {
  return value
    .split(/\r?\n/)
    .map((line) => `  ${line}`)
    .join("\n");
}
