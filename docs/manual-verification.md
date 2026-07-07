# Manual PR Verification

Use this checklist before the first Marketplace release and after changes that affect GitHub API collection, comment writing, or log handling.

## Goal

Confirm that PR Check Doctor works on a real pull request, not only in fixture mode.

The verification should prove that:

- failed checks are collected from the PR head SHA,
- workflow job logs are summarized without leaking obvious secrets,
- the action writes or updates one stable PR comment,
- incomplete checks produce a warning instead of a false final verdict,
- re-running the workflow updates the existing comment instead of posting duplicates.

## Test pull request

Create a temporary branch and open a draft PR against `main`. The PR should include a harmless failing check, for example a temporary test that always fails or a workflow step that exits with code `1`.

Keep the change isolated so it can be closed without merging.

## Workflow expectations

Run PR Check Doctor after the failing jobs complete. The workflow should use:

- `if: always()` so the doctor still runs after failures,
- `needs` for the jobs it should wait for,
- `actions: read`, `checks: read`, `contents: read`, and `pull-requests: write`,
- `github-token: ${{ github.token }}`.

## Pass criteria

The PR comment is acceptable when:

- it contains the `<!-- pr-check-doctor -->` marker,
- the verdict is `BLOCK` for the intentional failure,
- the failed check name and likely category match the failing job,
- the log excerpt is short and actionable,
- secret-like values are redacted,
- a second run updates the same comment.

Close the draft PR after verification and record the PR link in the release notes or release checklist.
