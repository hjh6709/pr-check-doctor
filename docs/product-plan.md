# PR Check Doctor Product Plan

## 한 줄 설명

PR Check Doctor는 실패한 GitHub PR checks를 하나의 실행 가능한 triage comment로 정리하는 self-hosted GitHub Action이다.

## 문제 정의

GitHub Actions를 많이 쓰는 저장소에서는 PR 하나에 여러 workflow와 matrix job이 붙는다. check가 실패하면 개발자는 각 workflow 화면을 열고, job을 찾고, 긴 로그를 훑고, 실패 원인과 로컬 재현 명령을 직접 추론해야 한다.

PR Check Doctor는 이 반복 작업을 줄이는 데 집중한다. 일반적인 AI code review bot이 아니라 CI 실패 triage 도구다.

## 제품 원칙

- **Self-hosted first**: 외부 SaaS 없이 GitHub Actions 안에서 동작한다.
- **Rule-based core**: 기본 기능은 LLM 없이 deterministic rule로 동작한다.
- **One comment**: PR마다 하나의 comment를 생성하거나 갱신한다.
- **Actionable output**: 실패 종류, 핵심 로그, merge 영향, 로컬 재현 명령을 함께 보여준다.
- **Small PR workflow**: 기능은 작은 PR 단위로 나누어 구현한다.

## MVP 범위

MVP는 다음 흐름을 제공한다.

1. PR과 연결된 최신 head SHA를 찾는다.
2. 해당 SHA의 check run과 workflow job 결과를 수집한다.
3. failed, cancelled, timed out check를 triage 후보로 고른다.
4. 실패 로그에서 핵심 error snippet을 추출한다.
5. secret-like value를 comment에 노출하지 않도록 redaction한다.
6. 실패를 category로 분류한다.
7. config에 정의된 local reproduction command를 매핑한다.
8. `PASS`, `WARN`, `BLOCK` verdict를 계산한다.
9. PR에 하나의 comment를 생성하거나 기존 comment를 갱신한다.

## 실패 분류

초기 category는 다음을 지원한다.

- `test_failure`
- `race_detected`
- `lint_failure`
- `format_drift`
- `dependency_drift`
- `build_failure`
- `vulnerability`
- `infra_validation`
- `commit_policy`
- `external_flake`
- `cancelled`
- `timeout`
- `unknown`

## Verdict 모델

- `PASS`: 실패하거나 blocking인 check가 없다.
- `WARN`: non-blocking 또는 참고용 이슈만 있다.
- `BLOCK`: merge를 막아야 하는 실패가 하나 이상 있다.

기본값은 다음 category를 blocking으로 본다.

- `test_failure`
- `race_detected`
- `lint_failure`
- `format_drift`
- `dependency_drift`
- `build_failure`
- `vulnerability`
- `infra_validation`
- `commit_policy`
- `cancelled`
- `timeout`

## 설정 파일

사용자는 `.check-doctor.yml`로 check 이름과 로컬 재현 명령을 매핑한다.

```yaml
comment:
  mode: update
  language: ko

checks:
  "go test -race":
    category: race_detected
    local_command: |
      cd apps/api
      go test -race -cover ./...
    blocks_merge: true

  "build api":
    category: build_failure
    local_command: docker build apps/api
    blocks_merge: true
```

## 보안 기준

- full log를 PR comment에 그대로 출력하지 않는다.
- log excerpt는 line 수와 character 수를 제한한다.
- token, password, API key, private key 형태의 값을 redact한다.
- 최소 권한을 기본으로 한다: `actions: read`, `checks: read`, `contents: read`, `pull-requests: write`.
- dry-run mode를 지원해서 comment 작성 전 결과를 확인할 수 있게 한다.

## 운영 기준

- PR Check Doctor는 분석 대상 CI job들이 끝난 뒤 실행되어야 한다.
- 기본 사용법은 마지막 job에 배치하고 `if: always()`와 `needs`로 test, lint, build job을 기다리는 방식으로 안내한다.
- 아직 `queued` 또는 `in_progress` check가 있으면 comment에 불완전한 triage일 수 있다는 경고를 표시한다.

## 구현 순서

이미 구현된 core:

- TypeScript/Vitest 기반 프로젝트 구조
- config parsing
- log redaction과 snippet extraction
- deterministic classification
- verdict calculation
- Markdown comment rendering
- 최소 GitHub Action metadata

다음 구현 후보:

1. normalized check 후보를 만드는 pure function
2. core module을 묶는 `analyze` orchestration
3. Octokit 기반 GitHub API wrapper
4. workflow/job log download
5. PR comment upsert
6. README와 사용 예시 정리

각 작업은 하나의 작은 기능 PR로 분리하고, 가능하면 diff를 200줄 전후로 유지한다.
