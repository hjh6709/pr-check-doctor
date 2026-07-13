[English](README.md) | **한국어** | [日本語](README.ja.md) | [简体中文](README.zh-Hans.md) | [Español](README.es.md) | [Français](README.fr.md)

# PR Check Doctor

PR Check Doctor는 실패한 GitHub PR check를 하나의 실행 가능한 pull request 코멘트로 정리해줍니다.

self-hosted GitHub Action으로 CI triage를 수행합니다. 실패한 check run과 workflow job을 수집하고, 유용한 로그 라인을 요약하고, 시크릿으로 보이는 값을 redact하고, 실패 원인을 분류해서 하나의 안정적인 PR 코멘트를 생성하거나 갱신합니다.

## 하는 일

- pull request head SHA에 대한 check run과 workflow job을 수집합니다.
- GitHub API 페이지네이션을 따라가서 큰 PR의 check 목록이 잘리지 않게 합니다.
- triage가 필요한 check의 workflow job 로그를 다운로드합니다.
- 코멘트를 렌더링하기 전에 흔한 token, password, API key, private key 형태의 값을 redact합니다.
- `PASS`, `WARN`, `BLOCK` verdict를 생성합니다.
- 새 코멘트를 중복해서 올리는 대신 기존 PR Check Doctor 코멘트를 갱신합니다.
- 로컬 검증을 위한 dry-run과 fixture 모드를 지원합니다.

## 기본 사용법

PR Check Doctor가 분석해야 하는 job들 뒤에 실행하세요. 앞선 job이 실패해도 실행되도록 `if: always()`를 사용합니다.

```yaml
name: CI

on:
  pull_request:

permissions:
  actions: read
  checks: read
  contents: read
  pull-requests: write

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - run: npm ci
      - run: npm test

  doctor:
    runs-on: ubuntu-latest
    needs:
      - test
    if: ${{ always() }}
    steps:
      - uses: actions/checkout@v4
      - uses: hjh6709/pr-check-doctor@v0
        with:
          github-token: ${{ github.token }}
```

`v0`는 최신 `v0.x.y` 릴리즈를 추적하므로 patch/minor 업데이트를 자동으로 반영합니다. 보안에 민감한 저장소라면 태그 대신 전체 커밋 SHA로 고정하세요:

```yaml
      - uses: hjh6709/pr-check-doctor@d0f5e1c592c3afee12dc6b998fb9600d9b28237f # v0.3.0
        with:
          github-token: ${{ github.token }}
```

## 설정

check 이름을 category와 로컬 재현 명령어에 매핑하려면 `.check-doctor.yml`을 만드세요.

```yaml
comment:
  mode: update
  language: en

checks:
  "npm test":
    category: test_failure
    local_command: npm test
    blocks_merge: true

  "lint":
    category: lint_failure
    local_command: npm run lint
    blocks_merge: true
```

check 규칙 키는 check 이름에 대한 대소문자 무시 부분 문자열로 매칭됩니다. `*`를 wildcard로 사용하면 규칙 하나로 matrix job 변형들을 매칭할 수 있습니다. 예: `"test (*)"`는 `test (ubuntu-latest, 18)`, `test (windows-latest, 20)` 등에 매칭됩니다.

전체 설정 레퍼런스는 `docs/configuration.md`를 참고하세요.

## Inputs

| Input | 필수 | 기본값 | 설명 |
| --- | --- | --- | --- |
| `github-token` | yes | | check 읽기, 로그 읽기, PR 코멘트 작성에 사용하는 토큰. |
| `config-path` | no | `.check-doctor.yml` | PR Check Doctor 설정 파일 경로. |
| `dry-run` | no | `false` | PR 코멘트를 작성하지 않고 결과만 출력합니다. |
| `fixture-path` | no | | 로컬 Action 검증용 dry-run에 쓰이는 JSON fixture 경로. |

## 권한

action에 필요한 최소 권한만 부여하세요:

```yaml
permissions:
  actions: read
  checks: read
  contents: read
  pull-requests: write
```

`pull-requests: write`는 action이 PR 코멘트를 작성하거나 갱신할 때만 필요합니다. dry-run 전용 워크플로에서는 `pull-requests: read`를 쓰세요.

토큰 권한, 로그 발췌, redaction, fork pull request에 대한 보안 참고 사항은 `docs/security.md`를 참고하세요.

## Fork Pull Request

`pull_request`로 트리거되는 워크플로는 fork에서 온 PR에서는 읽기 전용 `GITHUB_TOKEN`을 받기 때문에, 그 안에서는 `pull-requests: write`가 실패합니다. fork PR을 지원하려면 CI와 PR Check Doctor를 두 개의 워크플로로 나누세요: CI는 그대로 `pull_request`로 유지하고(fork에서도 안전), PR Check Doctor는 CI가 끝난 뒤 `workflow_run`으로 트리거합니다. `workflow_run`은 base 저장소의 컨텍스트에서 실행되므로, fork의 코드를 체크아웃하거나 실행하지 않고도 쓰기 권한이 있는 정상 토큰을 받습니다.

```yaml
# .github/workflows/ci.yml — unchanged, still triggers on pull_request
name: CI

on:
  pull_request:

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - run: npm ci
      - run: npm test
```

```yaml
# .github/workflows/doctor.yml — new, triggers after CI completes
name: PR Check Doctor

on:
  workflow_run:
    workflows: ["CI"]
    types: [completed]

permissions:
  actions: read
  checks: read
  contents: read
  pull-requests: write

jobs:
  doctor:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: hjh6709/pr-check-doctor@v0
        with:
          github-token: ${{ github.token }}
```

`workflows: ["CI"]`는 CI 워크플로의 `name:`과 일치해야 합니다. PR Check Doctor는 workflow run의 커밋으로부터 pull request를 자동으로 찾아냅니다. pull request로 트리거되지 않은 실행(예: `main`에 직접 push)이거나, 연결된 열린 pull request가 없으면 건너뜁니다. 이 방식이 `pull_request_target`보다 왜 더 안전한지는 `docs/security.md`를 참고하세요.

같은 저장소의 pull request만 다루고 외부 fork를 지원할 필요가 없다면, 위 "기본 사용법"의 단일 워크플로 `pull_request` 설정이 더 단순하고 여전히 완전히 지원됩니다.

## 기여하기

개발 워크플로, 검증 절차, PR 컨벤션은 [CONTRIBUTING.md](CONTRIBUTING.md)를 참고하세요.

## Status

PR Check Doctor는 `v0.3.0`부터 GitHub Marketplace에 공개돼 있습니다. 새 릴리즈를 내는 과정은 `docs/release-checklist.md`를 참고하세요.
