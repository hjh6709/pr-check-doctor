# Contributing

Thanks for your interest in PR Check Doctor. This project accepts pull requests, including from forks — see "Fork Pull Requests" in the [README](README.md) for how CI triage works on those.

## Prerequisites

- Node.js >= 20
- `npm ci` to install dependencies

## Workflow

This repository is built one small, focused PR at a time. Each PR should do one thing — a single feature, fix, or doc change — and stay reviewable. Don't bundle unrelated changes.

Follow test-driven development: write a failing test first, then the minimal implementation that makes it pass. `src/*.ts` files each have a matching `test/*.test.ts` file with dependency-injected transports/clients — no real network calls in tests.

If your change touches `src/**`, rebuild and commit the bundled action:

```bash
npm run build:action
```

This repo's CI checks that the committed `dist/index.cjs` matches a fresh build, so an out-of-date bundle will fail.

## Before opening a PR

Run the full release verification locally:

```bash
npm run verify:release
```

This runs `npm audit`, the test suite, the TypeScript build, the bundled action against the dry-run fixture, and confirms `dist/index.cjs` is up to date.

## Commit messages

Use `type: short summary` (`feat:`, `fix:`, `docs:`, `refactor:`, `ci:`, `chore:`, `test:`), matching this repository's existing history. Do not add a `Co-Authored-By` trailer.

## Pull requests

Fill in the PR template's Summary, Changes, and Test Plan sections. Keep the diff focused — if a change grows into two unrelated things, split it into two PRs.
