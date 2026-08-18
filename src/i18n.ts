export type Language = "en" | "ko";

export interface Strings {
  verdictLabel: string;
  warningsHeading: string;
  failedChecksHeading: string;
  noFailedChecks: string;
  categoryLabel: string;
  impactLabel: string;
  impactBlocking: string;
  impactNonBlocking: string;
  likelyCauseLabel: string;
  keyLogLabel: string;
  reproduceLocallyLabel: string;
  nextActionsHeading: string;
  noActionRequired: string;
  fixOrInspect(checkName: string): string;
  rerunAffectedChecks: string;
  incompleteChecksWarning(
    checks: Array<{ name: string; workflowName?: string }>,
    currentWorkflowName?: string
  ): string;
}

const en: Strings = {
  verdictLabel: "Verdict",
  warningsHeading: "Warnings",
  failedChecksHeading: "Failed Checks",
  noFailedChecks: "No failed or blocking checks were found.",
  categoryLabel: "Category",
  impactLabel: "Impact",
  impactBlocking: "merge blocking",
  impactNonBlocking: "non-blocking",
  likelyCauseLabel: "Likely cause",
  keyLogLabel: "Key log",
  reproduceLocallyLabel: "Reproduce locally",
  nextActionsHeading: "Next Actions",
  noActionRequired: "No action required.",
  fixOrInspect: (checkName) => `Fix or inspect \`${checkName}\`.`,
  rerunAffectedChecks: "Re-run the affected PR checks after pushing the fix.",
  incompleteChecksWarning: (checks, currentWorkflowName) => {
    const checkList = checks
      .map((check) => (check.workflowName ? `${check.name} (workflow: ${check.workflowName})` : check.name))
      .join(", ");
    const parts = [
      `Some checks are still running or queued: ${checkList}. Run this action as the final job with \`if: always()\` and \`needs\` to avoid incomplete triage.`
    ];

    // A pending check from doctor's own workflow can never be reached via workflow_run — that
    // trigger only fires once the whole workflow (including doctor) has already finished.
    if (hasSameWorkflowCheck(checks, currentWorkflowName)) {
      parts.push(
        "Some of those checks run in this same workflow — add their job to this job's `needs:` instead, since `workflow_run` can't wait on a workflow it's already part of."
      );
    }

    const otherWorkflowNames = uniqueWorkflowNames(checks, currentWorkflowName);
    if (otherWorkflowNames.length > 0) {
      parts.push(
        `If those checks run in a separate workflow, trigger this action from \`workflow_run\` instead and list them: \`workflows: [${formatWorkflowNames(otherWorkflowNames)}]\` — see the README's Fork Pull Requests section.`
      );
    }

    return parts.join(" ");
  }
};

const ko: Strings = {
  verdictLabel: "판정",
  warningsHeading: "경고",
  failedChecksHeading: "실패한 체크",
  noFailedChecks: "실패했거나 머지를 막는 체크가 없습니다.",
  categoryLabel: "카테고리",
  impactLabel: "영향",
  impactBlocking: "머지 차단",
  impactNonBlocking: "차단 안 함",
  likelyCauseLabel: "예상 원인",
  keyLogLabel: "핵심 로그",
  reproduceLocallyLabel: "로컬 재현",
  nextActionsHeading: "다음 조치",
  noActionRequired: "필요한 조치가 없습니다.",
  fixOrInspect: (checkName) => `\`${checkName}\`를 수정하거나 확인하세요.`,
  rerunAffectedChecks: "수정 사항을 push한 뒤 영향받은 PR 체크를 다시 실행하세요.",
  incompleteChecksWarning: (checks, currentWorkflowName) => {
    const checkList = checks
      .map((check) => (check.workflowName ? `${check.name} (workflow: ${check.workflowName})` : check.name))
      .join(", ");
    const parts = [
      `아직 실행 중이거나 대기 중인 체크가 있습니다: ${checkList}. 불완전한 triage를 피하려면 이 action을 \`if: always()\`와 \`needs\`로 마지막 job에 배치하세요.`
    ];

    if (hasSameWorkflowCheck(checks, currentWorkflowName)) {
      parts.push(
        "이 중 일부는 이 action과 같은 워크플로 소속입니다 — `workflow_run`은 자기 자신이 속한 워크플로가 끝나길 기다릴 수 없으니, 대신 그 job을 이 job의 `needs:`에 추가하세요."
      );
    }

    const otherWorkflowNames = uniqueWorkflowNames(checks, currentWorkflowName);
    if (otherWorkflowNames.length > 0) {
      parts.push(
        `이 체크들이 별도 워크플로에서 온다면, \`workflow_run\`으로 이 action을 트리거하고 다음을 등록하세요: \`workflows: [${formatWorkflowNames(otherWorkflowNames)}]\` — README의 "Fork Pull Requests" 섹션 참고.`
      );
    }

    return parts.join(" ");
  }
};

const translations: Record<Language, Strings> = { en, ko };

export function translate(language: Language): Strings {
  return translations[language];
}

function uniqueWorkflowNames(checks: Array<{ workflowName?: string }>, exclude?: string): string[] {
  return [
    ...new Set(
      checks
        .map((check) => check.workflowName)
        .filter((name): name is string => Boolean(name) && name !== exclude)
    )
  ];
}

function hasSameWorkflowCheck(checks: Array<{ workflowName?: string }>, currentWorkflowName?: string): boolean {
  return currentWorkflowName !== undefined && checks.some((check) => check.workflowName === currentWorkflowName);
}

function formatWorkflowNames(names: string[]): string {
  return names.map((name) => `"${name}"`).join(", ");
}
