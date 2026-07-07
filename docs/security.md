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

Be careful when running on pull requests from forks. GitHub token permissions and secret availability differ for forked pull requests, and comment-writing permissions may be restricted by repository settings.
