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
  incompleteChecksWarning(checks: Array<{ name: string; workflowName?: string }>): string;
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
  incompleteChecksWarning: (checks) => {
    const checkList = checks
      .map((check) => (check.workflowName ? `${check.name} (workflow: ${check.workflowName})` : check.name))
      .join(", ");
    const base = `Some checks are still running or queued: ${checkList}. Run this action as the final job with \`if: always()\` and \`needs\` to avoid incomplete triage.`;
    const workflowNames = uniqueWorkflowNames(checks);

    if (workflowNames.length === 0) {
      return base;
    }

    return `${base} If those checks run in a separate workflow, trigger this action from \`workflow_run\` instead and list them: \`workflows: [${formatWorkflowNames(workflowNames)}]\` — see the README's Fork Pull Requests section.`;
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
  incompleteChecksWarning: (checks) => {
    const checkList = checks
      .map((check) => (check.workflowName ? `${check.name} (workflow: ${check.workflowName})` : check.name))
      .join(", ");
    const base = `아직 실행 중이거나 대기 중인 체크가 있습니다: ${checkList}. 불완전한 triage를 피하려면 이 action을 \`if: always()\`와 \`needs\`로 마지막 job에 배치하세요.`;
    const workflowNames = uniqueWorkflowNames(checks);

    if (workflowNames.length === 0) {
      return base;
    }

    return `${base} 이 체크들이 별도 워크플로에서 온다면, \`workflow_run\`으로 이 action을 트리거하고 다음을 등록하세요: \`workflows: [${formatWorkflowNames(workflowNames)}]\` — README의 "Fork Pull Requests" 섹션 참고.`;
  }
};

const translations: Record<Language, Strings> = { en, ko };

export function translate(language: Language): Strings {
  return translations[language];
}

function uniqueWorkflowNames(checks: Array<{ workflowName?: string }>): string[] {
  return [...new Set(checks.map((check) => check.workflowName).filter((name): name is string => Boolean(name)))];
}

function formatWorkflowNames(names: string[]): string {
  return names.map((name) => `"${name}"`).join(", ");
}
