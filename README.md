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
      - uses: hjh6709/pr-check-doctor@v0.1.0
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

Check rule keys are matched as case-insensitive substrings against check names.

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

## Status

PR Check Doctor is preparing for its first Marketplace release. Before publishing, the release checklist and manual PR verification must pass:

- `docs/release-checklist.md`
- `docs/manual-verification.md`
