# Release Checklist

This checklist keeps release work separate from product planning and user-facing README content.

## Release candidate gate

Before cutting a release, the `main` branch should be green and the local tree should match the committed action bundle.

```bash
npm ci
npm run verify:release
```

## Marketplace readiness

GitHub Marketplace publishing expects a public action repository with one root action metadata file. For this repository, confirm:

- `action.yml` is the only root action metadata file.
- `action.yml` has a stable `name`, `description`, `runs`, and `branding`.
- `LICENSE`, `package.json`, and `package-lock.json` all declare Apache-2.0.
- The README explains installation, permissions, scheduling after other jobs, configuration, and security behavior.
- A real pull request has passed `docs/manual-verification.md`.

## Release flow

Use a SemVer tag for each public release.

1. Verify the release candidate gate on `main`.
2. Create a GitHub release from the final commit.
3. Select "Publish this Action to the GitHub Marketplace" in the release form.
4. Choose a Marketplace category that matches CI or code quality tooling.
5. Confirm the release page renders the action metadata without warnings.

`v0.1.0` was used as the initial release tag. If Marketplace publication happens after README or security guidance changes, publish the next SemVer patch tag.

Do not publish a release while README or real PR verification is still incomplete.
