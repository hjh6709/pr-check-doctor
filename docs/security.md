# Security Notes

PR Check Doctor reads GitHub check results and workflow job logs, then writes a pull request comment. Treat it as a CI tool with access to potentially sensitive build output.

## Token Permissions

Use the narrowest permissions that match the workflow mode.

For normal comment writing:

```yaml
permissions:
  actions: read
  checks: read
  contents: read
  pull-requests: write
```

For dry-run workflows that do not write comments, use `pull-requests: read`.

Do not pass a personal access token unless the default `github.token` cannot satisfy your repository policy.

## Log Handling

PR Check Doctor does not publish full workflow logs. It attaches bounded excerpts from checks selected for triage.

Current safeguards:

- workflow job logs are capped before analysis,
- rendered snippets are capped by line and character count,
- common GitHub token, AWS access key, bearer token, password, API key, and private key shapes are redacted,
- missing or expired logs do not fail the whole action.

Redaction is best effort. It cannot guarantee removal of every secret format. Avoid printing secrets in CI logs, even when PR Check Doctor is enabled.

## Pull Request Comments

The action keeps one stable comment by searching for the hidden `<!-- pr-check-doctor -->` marker. Anyone who can read the pull request can read the rendered triage comment.

Before enabling the action on sensitive repositories, run `dry-run: "true"` and inspect the output.

## Forks

A `pull_request`-triggered workflow only gets a read-only `GITHUB_TOKEN` on pull requests from forks, so `pull-requests: write` fails there — this is a GitHub Actions restriction, not something PR Check Doctor can work around from inside a `pull_request` workflow.

To support fork PRs, use a `workflow_run`-triggered second workflow instead of `pull_request_target`. `workflow_run` runs in the base repository's context (so it gets a write-capable token) without ever checking out or executing the fork's code — PR Check Doctor only reads already-computed check results via the API. `pull_request_target` can also get a write-capable token on fork PRs, but it requires the workflow author to independently guarantee the job never checks out and runs fork content; `workflow_run` avoids that risk by construction, which is why it's the pattern documented here. See the README's "Fork Pull Requests" section for the exact two-workflow setup.
