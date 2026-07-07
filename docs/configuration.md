# Configuration Reference

PR Check Doctor reads `.check-doctor.yml` by default. Use `config-path` to point at a different file.

```yaml
comment:
  mode: update
  language: en

verdict:
  block_on:
    - test_failure
    - build_failure

checks:
  "npm test":
    category: test_failure
    local_command: npm test
    blocks_merge: true
```

## Comment

| Field | Values | Default | Description |
| --- | --- | --- | --- |
| `comment.mode` | `update` | `update` | Keep one stable PR comment. |
| `comment.language` | `en`, `ko` | `en` | Reserved for localized comment output. |

## Verdict

`verdict.block_on` controls which categories produce a `BLOCK` verdict by default.

When omitted, PR Check Doctor blocks on:

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

Categories not in `block_on` can still appear in the comment, but they produce `WARN` unless an individual check rule sets `blocks_merge: true`.

## Checks

Each key under `checks` is matched as a case-insensitive substring against the check name.

| Field | Required | Description |
| --- | --- | --- |
| `category` | no | Failure category to use when this rule matches. |
| `local_command` | no | Command shown in the PR comment for local reproduction. |
| `blocks_merge` | no | Overrides the category-level blocking decision for this rule. |

## Categories

Supported categories are:

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
