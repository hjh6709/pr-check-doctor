**English** | [한국어](README.ko.md) | [日本語](README.ja.md) | [简体中文](README.zh-Hans.md) | [Español](README.es.md) | [Français](README.fr.md)

# PR Check Doctor

PR Check Doctor turns failed GitHub PR checks into one actionable pull request comment.

It is a self-hosted GitHub Action for CI triage. It collects failed check runs and workflow jobs, summarizes useful log lines, redacts secret-like values, classifies likely failure categories, and creates or updates one stable PR comment.

## What It Does

- Collects check runs and workflow jobs for the pull request head SHA.
- Follows GitHub API pagination so large PR check sets are not silently truncated.
- Downloads workflow job logs for checks that need triage.
- Redacts common token, password, API key, and private key shapes before rendering comments.
- Produces `PASS`, `WARN`, or `BLOCK` verdicts.
- Updates the existing PR Check Doctor comment instead of posting duplicates.
- Supports dry-run and fixture modes for local verification.

## Basic Usage

Run PR Check Doctor after the jobs it should analyze. Use `if: always()` so it still runs when earlier jobs fail.

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

`v0` tracks the latest `v0.x.y` release, so it picks up patch and minor updates automatically. For security-sensitive repositories, pin the action to a full commit SHA instead of a mutable tag:

```yaml
      - uses: hjh6709/pr-check-doctor@d0f5e1c592c3afee12dc6b998fb9600d9b28237f # v0.3.0
        with:
          github-token: ${{ github.token }}
```

## Configuration

Create `.check-doctor.yml` to map check names to categories and local reproduction commands.

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

Check rule keys are matched as case-insensitive substrings against check names. Use `*` as a wildcard to match matrix job variants with one rule, e.g. `"test (*)"` matches `test (ubuntu-latest, 18)`, `test (windows-latest, 20)`, and so on.

See `docs/configuration.md` for the full configuration reference.

## Inputs

| Input | Required | Default | Description |
| --- | --- | --- | --- |
| `github-token` | yes | | Token used to read checks, read logs, and write PR comments. |
| `config-path` | no | `.check-doctor.yml` | Path to the PR Check Doctor config file. |
| `dry-run` | no | `false` | Render output without writing a PR comment. |
| `fixture-path` | no | | JSON fixture path used with dry-run for local Action verification. |

## Permissions

Use the smallest permissions needed by the action:

```yaml
permissions:
  actions: read
  checks: read
  contents: read
  pull-requests: write
```

`pull-requests: write` is required only when the action writes or updates the PR comment. For dry-run-only workflows, use `pull-requests: read`.

See `docs/security.md` for security notes on token permissions, log excerpts, redaction, and forked pull requests.

## Fork Pull Requests

A `pull_request`-triggered workflow gets a read-only `GITHUB_TOKEN` on pull requests from forks, so `pull-requests: write` fails there. To support fork PRs, split CI and PR Check Doctor into two workflows: keep CI on `pull_request` (safe on forks), and trigger PR Check Doctor from `workflow_run` once CI finishes. `workflow_run` runs in the base repository's context, so it gets a normal write-capable token, without ever checking out or running the fork's code.

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

`workflows: ["CI"]` must match the `name:` of the CI workflow. PR Check Doctor resolves the pull request from the workflow run's commit automatically; it skips runs that weren't triggered by a pull request (e.g. a direct push to `main`) or that have no associated open pull request. See `docs/security.md` for why this is safer here than `pull_request_target`.

If your repository only needs same-repo pull requests (no external forks), the single-workflow `pull_request` setup in "Basic Usage" above is simpler and still fully supported.

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md) for the dev workflow, verification steps, and PR conventions.

## Status

PR Check Doctor is published on the GitHub Marketplace as of `v0.3.0`. See `docs/release-checklist.md` for the process used to cut new releases.
