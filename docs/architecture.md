# Architecture

This is a map of how PR Check Doctor's modules fit together — useful when you're about to add a feature and aren't sure where it belongs.

## Two layers

**`src/github/`** — everything that talks to the GitHub REST API or parses GitHub event payloads. Nothing in here knows about triage categories, verdicts, or comment formatting.

- `transport.ts` — generic JSON/text fetching over a pluggable transport, including pagination-link following and loop detection. No GitHub-specific response shapes beyond the list-response merge keys (`check_runs`, `jobs`, `workflow_runs`).
- `api.ts` — typed REST clients built on `transport.ts`: check runs, workflow jobs, workflow job logs, and resolving a pull request number from a commit SHA. Also composes these into the `GitHubChecksFetcher` used by `action.ts`.
- `checks.ts` — maps raw GitHub check-run/workflow-job JSON into this project's `NormalizedCheck` shape, and deduplicates checks that both APIs report for the same job.
- `comments.ts` — finds-or-creates the one stable PR comment, keyed by a hidden marker.
- `event.ts` — parses `pull_request` and `workflow_run` event payloads (`GITHUB_EVENT_PATH`) into the context (`owner`/`repo`/`pullNumber`/`headSha`) the rest of the action needs.

**Everything else in `src/`** — the deterministic rule engine, with no GitHub API knowledge. It only knows about `NormalizedCheck`, `DoctorConfig`, and their derived types (`src/types.ts`).

- `config.ts` — parses `.check-doctor.yml`.
- `checks.ts` (not `github/checks.ts`) — selects which normalized checks are triage candidates.
- `classifier.ts` — maps a failing check to a `FailureCategory`.
- `verdict.ts` — turns classified issues into `PASS`/`WARN`/`BLOCK`.
- `logs.ts` — redacts secrets and extracts a bounded snippet from a log.
- `analyze.ts` — orchestrates checks → classify → verdict → warnings into an `AnalysisResult`.
- `comment.ts` — renders an `AnalysisResult` as the triage Markdown comment.
- `triage.ts` — the two public entry points (`createTriageComment`, `createTriageCommentFromChecks`) that glue config + checks + logs into rendered Markdown.

`src/action.ts` is the only file that depends on both layers: it resolves a `PullRequestContext` (via `src/github/event.ts` and, for `workflow_run`, `src/github/api.ts`), fetches checks (`src/github/api.ts`), and renders/upserts the comment (`src/triage.ts`, `src/github/comments.ts`).

## Where to add things

- A new GitHub API call → `src/github/api.ts`, built on `src/github/transport.ts`'s `request`/`fetchMergedJsonPages` pattern.
- A new failure category or classification rule → `src/classifier.ts` (and `src/types.ts`'s `FailureCategory` union).
- A new trigger event (beyond `pull_request` and `workflow_run`) → a new `parse*Event` function in `src/github/event.ts`, then a new branch in `resolvePullRequestContext` in `src/action.ts`. It should still resolve to a `PullRequestContext` so the rest of the pipeline doesn't need to change.
- A new config field → `src/config.ts`'s `parseDoctorConfig`, plus `src/types.ts`'s `DoctorConfig`.

## Testing

Every `src/` module has a matching `test/` file testing its public functions directly (dependency-injected transports/clients, no real network calls). `src/action.ts`'s tests inject a full fake `Runtime` and assert on the rendered comment or the `core.info` log lines, without touching `src/github/*` directly.
