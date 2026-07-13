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
  incompleteChecksWarning(checkNames: string[]): string;
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
  incompleteChecksWarning: (checkNames) =>
    `Some checks are still running or queued: ${checkNames.join(
      ", "
    )}. Run this action as the final job with \`if: always()\` and \`needs\` to avoid incomplete triage.`
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
  incompleteChecksWarning: (checkNames) =>
    `아직 실행 중이거나 대기 중인 체크가 있습니다: ${checkNames.join(
      ", "
    )}. 불완전한 triage를 피하려면 이 action을 \`if: always()\`와 \`needs\`로 마지막 job에 배치하세요.`
};

const translations: Record<Language, Strings> = { en, ko };

export function translate(language: Language): Strings {
  return translations[language];
}
