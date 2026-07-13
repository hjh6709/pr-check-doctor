[English](README.md) | [한국어](README.ko.md) | **日本語** | [简体中文](README.zh-Hans.md) | [Español](README.es.md) | [Français](README.fr.md)

# PR Check Doctor

PR Check Doctor は、失敗した GitHub の PR check を 1 つの実行可能な pull request コメントにまとめます。

CI のトリアージを行う self-hosted GitHub Action です。失敗した check run と workflow job を収集し、有用なログ行を要約し、シークレットらしき値を redact し、失敗原因を分類して、1 つの安定したコメントを作成または更新します。

## できること

- pull request の head SHA に対する check run と workflow job を収集します。
- GitHub API のページネーションに追従するため、大きな PR の check 一覧が黙って切り捨てられません。
- トリアージが必要な check の workflow job ログをダウンロードします。
- コメントをレンダリングする前に、token、password、API key、private key らしき値を redact します。
- `PASS`、`WARN`、`BLOCK` の verdict を出力します。
- 新しいコメントを重複投稿する代わりに、既存の PR Check Doctor コメントを更新します。
- ローカル検証用に dry-run と fixture モードをサポートします。

## 基本的な使い方

PR Check Doctor は、分析対象の job の後に実行してください。前の job が失敗しても実行されるよう `if: always()` を使います。

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

`v0` は最新の `v0.x.y` リリースを追跡するため、patch/minor の更新が自動的に反映されます。セキュリティ要件の厳しいリポジトリでは、可変タグの代わりにフルコミット SHA で固定してください。

```yaml
      - uses: hjh6709/pr-check-doctor@d0f5e1c592c3afee12dc6b998fb9600d9b28237f # v0.3.0
        with:
          github-token: ${{ github.token }}
```

## 設定

check 名を category とローカル再現コマンドにマッピングするには `.check-doctor.yml` を作成します。

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

check ルールのキーは、check 名に対する大文字小文字を区別しない部分文字列としてマッチします。`*` をワイルドカードとして使うと、1 つのルールで matrix job のバリエーションをまとめてマッチできます。例: `"test (*)"` は `test (ubuntu-latest, 18)`、`test (windows-latest, 20)` などにマッチします。

完全な設定リファレンスは `docs/configuration.md` を参照してください。

## Inputs

| Input | 必須 | デフォルト | 説明 |
| --- | --- | --- | --- |
| `github-token` | yes | | check の読み取り、ログの読み取り、PR コメントの書き込みに使うトークン。 |
| `config-path` | no | `.check-doctor.yml` | PR Check Doctor の設定ファイルのパス。 |
| `dry-run` | no | `false` | PR コメントを書き込まずに結果を出力します。 |
| `fixture-path` | no | | dry-run でのローカル Action 検証に使う JSON fixture のパス。 |

## 権限

action に必要な最小限の権限を使ってください。

```yaml
permissions:
  actions: read
  checks: read
  contents: read
  pull-requests: write
```

`pull-requests: write` は、action が PR コメントを書き込む・更新する場合にのみ必要です。dry-run 専用のワークフローでは `pull-requests: read` を使ってください。

トークン権限、ログの抜粋、redaction、fork からの pull request に関するセキュリティ上の注意点は `docs/security.md` を参照してください。

## Fork からの Pull Request

`pull_request` でトリガーされるワークフローは、fork からの pull request では読み取り専用の `GITHUB_TOKEN` しか受け取れないため、その中では `pull-requests: write` が失敗します。fork からの PR に対応するには、CI と PR Check Doctor を 2 つのワークフローに分割してください。CI は引き続き `pull_request` のままにし(fork でも安全)、PR Check Doctor は CI が完了した後に `workflow_run` でトリガーします。`workflow_run` はベースリポジトリのコンテキストで実行されるため、fork のコードをチェックアウトしたり実行したりすることなく、書き込み可能な通常のトークンを受け取れます。

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

`workflows: ["CI"]` は CI ワークフローの `name:` と一致している必要があります。PR Check Doctor は workflow run のコミットから pull request を自動的に解決します。pull request によってトリガーされなかった実行(例: `main` への直接 push)や、関連する open な pull request がない場合はスキップされます。この方式が `pull_request_target` よりも安全な理由については `docs/security.md` を参照してください。

同一リポジトリ内の pull request だけを扱えばよく、外部の fork をサポートする必要がない場合は、上記「基本的な使い方」の単一ワークフローによる `pull_request` 構成の方がシンプルで、引き続き完全にサポートされます。

## コントリビュート

開発ワークフロー、検証手順、PR の規約については [CONTRIBUTING.md](CONTRIBUTING.md) を参照してください。

## ステータス

PR Check Doctor は `v0.3.0` 以降、GitHub Marketplace で公開されています。新しいリリースを出す手順については `docs/release-checklist.md` を参照してください。
