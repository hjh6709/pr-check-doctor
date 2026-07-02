# PR Check Doctor Core MVP Design

Date: 2026-07-02

## Goal

Build the first tested TypeScript core for PR Check Doctor before writing README content. The MVP core turns GitHub PR check failures into structured triage data and a single actionable Markdown comment.

The first implementation phase should avoid depending on live GitHub API calls. It should focus on deterministic, testable behavior:

- parse `.check-doctor.yml` with defaults;
- redact and extract useful log snippets;
- classify failed checks;
- map check names to local reproduction commands;
- compute `PASS`, `WARN`, or `BLOCK`;
- render a PR comment from the analysis result.

GitHub API collection and comment upsert should be implemented as thin adapters after the core behavior is covered by tests.

## Non-Goals

- No README rewrite in this phase.
- No optional AI summarization.
- No external SaaS integration.
- No broad GitHub Actions workflow support beyond the data model needed by the core.
- No attempt to perfectly parse every possible CI log format.

## Architecture

Use a small TypeScript GitHub Action project with pure core modules and a thin action entrypoint.

Initial modules:

- `src/types.ts`: shared data types for checks, jobs, config, categories, verdicts, and analysis results.
- `src/config.ts`: YAML config parsing and default config merging.
- `src/logs.ts`: secret redaction, log line selection, excerpt length limiting.
- `src/classifier.ts`: deterministic classification from check names, conclusions, and redacted log snippets.
- `src/verdict.ts`: verdict calculation from classified issues and blocking rules.
- `src/comment.ts`: Markdown rendering for the single PR comment body.
- `src/index.ts`: later GitHub Action entrypoint that wires adapters and core modules.

The core modules should accept plain data and return plain data. This keeps tests fast and avoids Octokit mocking for the first phase.

## Data Flow

1. Config is loaded from `.check-doctor.yml` if present and merged with defaults.
2. GitHub adapter eventually provides normalized check/job records for the current PR head SHA.
3. Each failed, cancelled, timed out, or selected long-running check becomes a triage candidate.
4. Logs are redacted before any snippet extraction.
5. Snippet extraction keeps only relevant lines and caps total output.
6. Classification chooses a failure category using config overrides first, then deterministic built-in patterns.
7. Reproduction command mapping uses the first matching configured check rule.
8. Verdict calculation uses `block_on` and per-check `blocks_merge`.
9. Comment rendering produces a stable Markdown body with a hidden marker for future update/upsert behavior.

## Configuration

The config file is `.check-doctor.yml`.

Supported initial fields:

```yaml
comment:
  mode: update
  language: ko

verdict:
  block_on:
    - test_failure
    - race_detected
    - lint_failure
    - format_drift
    - dependency_drift
    - build_failure
    - vulnerability
    - infra_validation
    - commit_policy

checks:
  "go test -race":
    category: test_failure
    local_command: |
      cd {module}
      go test -race -cover ./...
    blocks_merge: true
```

Check keys are substring match patterns against normalized check/job names for the MVP. Regex support can be added later if substring matching proves too limited.

## Failure Classification

Config category overrides take precedence. Built-in patterns should cover the MVP categories from the plan:

- `race_detected`: log contains Go race detector markers such as `WARNING: DATA RACE`.
- `test_failure`: test command names or common failed test output.
- `lint_failure`: lint command names or linter-style diagnostics.
- `format_drift`: formatting check names or format diff output.
- `dependency_drift`: `go mod tidy`, lockfile, dependency drift, or install resolution failures.
- `build_failure`: Docker/image/build command failures.
- `vulnerability`: Trivy, vulnerability, CVE, or SARIF scan failures.
- `infra_validation`: Terraform, Kubernetes, Ansible, YAML, or policy validation failures.
- `commit_policy`: commitlint, Conventional Commits, PR title checks.
- `cancelled`: GitHub conclusion is `cancelled`.
- `timeout`: GitHub conclusion is `timed_out` or logs indicate timeout.
- `unknown`: fallback.

Built-in matching should be conservative. It is better to return `unknown` than to claim a specific root cause without evidence.

## Log Handling

Security requirements:

- redact common secret-like values before rendering;
- never include full logs in comments;
- cap snippets by line count and character count;
- prefer lines around errors rather than arbitrary tail output.

Initial redaction patterns:

- GitHub tokens and generic token assignments;
- AWS access key IDs;
- private key blocks;
- bearer tokens;
- password/secret/API key assignments.

The redaction replacement should be `[REDACTED]`.

Snippet extraction should prioritize lines containing high-signal patterns such as `error`, `failed`, `fatal`, `panic`, `WARNING: DATA RACE`, `Traceback`, `CVE-`, `vulnerability`, `exit code`, and `timed out`.

## Verdict Model

Verdict values:

- `PASS`: no failed or blocking check issues.
- `WARN`: only non-blocking, flaky, pending, informational, or unknown non-blocking issues.
- `BLOCK`: at least one issue has a category in `verdict.block_on` and is not explicitly marked `blocks_merge: false`.

For the MVP, failed tests, lint, build, vulnerability, infra validation, commit policy, cancelled, and timeout issues should block by default unless config says otherwise.

## Comment Rendering

The comment body should include:

- a stable hidden marker for update detection;
- title: `PR Check Doctor`;
- verdict;
- failed checks grouped as sections;
- category;
- merge impact;
- likely cause, when classification has a known explanation;
- key log snippet, if available;
- local reproduction command, if configured;
- concise next actions.

The renderer should be deterministic so snapshot-style tests are useful.

## Testing Strategy

Use Vitest and TDD. The first tests should cover core behavior before adding production code:

- config defaults and config override matching;
- secret redaction before snippet extraction;
- log snippet extraction with length caps;
- classifier precedence: config override before built-in patterns;
- race detector and build failure classification;
- verdict calculation for blocking and non-blocking issues;
- comment rendering includes marker, verdict, issue details, and reproduction command.

GitHub API adapter tests can use fixtures later, after the pure core is stable.

## Package Shape

Use standard TypeScript GitHub Action dependencies:

- runtime dependencies: `@actions/core`, `@actions/github`, `js-yaml`;
- dev dependencies: `typescript`, `vitest`, `tsx`, `@types/node`;
- packaging dependency can be added later with `@vercel/ncc` when the action entrypoint is ready to publish.

## Implementation Order

1. Add TypeScript project metadata and test tooling.
2. Add failing tests for `config`, then implement minimum config parsing/matching.
3. Add failing tests for `logs`, then implement redaction and snippet extraction.
4. Add failing tests for `classifier`, then implement deterministic classification.
5. Add failing tests for `verdict`, then implement verdict calculation.
6. Add failing tests for `comment`, then implement Markdown rendering.
7. Add action metadata and a minimal `src/index.ts` after core tests pass.

README work remains last, after command names and config behavior are real.

## Implementation Assumptions

- The first core implementation does not include GitHub event handling. Adapter work later should start with `workflow_run` and `workflow_dispatch`.
- The first comment renderer outputs English Markdown. The config keeps `comment.language` so Korean rendering can be added later without changing the config shape.
