[English](README.md) | [한국어](README.ko.md) | [日本語](README.ja.md) | **简体中文** | [Español](README.es.md) | [Français](README.fr.md)

# PR Check Doctor

PR Check Doctor 将失败的 GitHub PR check 整理成一条可直接采取行动的 pull request 评论。

它是一个用于 CI 问题排查的 self-hosted GitHub Action。它收集失败的 check run 和 workflow job,总结有用的日志行,对疑似密钥的值进行 redact,对可能的失败原因进行分类,并创建或更新一条稳定的 PR 评论。

## 功能

- 收集 pull request head SHA 对应的 check run 和 workflow job。
- 遵循 GitHub API 分页,避免大型 PR 的 check 列表被静默截断。
- 下载需要排查的 check 的 workflow job 日志。
- 在渲染评论之前,对常见的 token、password、API key、private key 形态的值进行 redact。
- 生成 `PASS`、`WARN` 或 `BLOCK` 结论。
- 更新已存在的 PR Check Doctor 评论,而不是重复发布新评论。
- 支持 dry-run 和 fixture 模式,便于本地验证。

## 基本用法

请在需要分析的 job 之后运行 PR Check Doctor。使用 `if: always()`,这样即使前面的 job 失败也会继续执行。

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

`v0` 会跟踪最新的 `v0.x.y` 版本,因此会自动获取 patch 和 minor 更新。对于安全性要求较高的仓库,建议使用完整的 commit SHA 而不是可变标签进行固定:

```yaml
      - uses: hjh6709/pr-check-doctor@d0f5e1c592c3afee12dc6b998fb9600d9b28237f # v0.3.0
        with:
          github-token: ${{ github.token }}
```

## 配置

创建 `.check-doctor.yml`,将 check 名称映射到分类和本地复现命令。

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

check 规则的键会以不区分大小写的子字符串方式与 check 名称进行匹配。使用 `*` 作为通配符,可以用一条规则匹配 matrix job 的多种变体。例如:`"test (*)"` 会匹配 `test (ubuntu-latest, 18)`、`test (windows-latest, 20)` 等。

完整的配置参考请见 `docs/configuration.md`。

## Inputs

| Input | 必需 | 默认值 | 说明 |
| --- | --- | --- | --- |
| `github-token` | yes | | 用于读取 check、读取日志、写入 PR 评论的 token。 |
| `config-path` | no | `.check-doctor.yml` | PR Check Doctor 配置文件的路径。 |
| `dry-run` | no | `false` | 只输出结果,不写入 PR 评论。 |
| `fixture-path` | no | | 配合 dry-run 用于本地 Action 验证的 JSON fixture 路径。 |

## 权限

请为 action 使用所需的最小权限:

```yaml
permissions:
  actions: read
  checks: read
  contents: read
  pull-requests: write
```

只有当 action 需要写入或更新 PR 评论时才需要 `pull-requests: write`。仅进行 dry-run 的工作流可以使用 `pull-requests: read`。

关于 token 权限、日志摘录、redaction 以及 fork pull request 的安全注意事项,请见 `docs/security.md`。

## Fork Pull Request

`pull_request` 触发的工作流在来自 fork 的 pull request 上只能获得只读的 `GITHUB_TOKEN`,因此其中的 `pull-requests: write` 会失败。要支持 fork PR,需要将 CI 和 PR Check Doctor 拆分为两个工作流:CI 继续使用 `pull_request`(在 fork 上是安全的),PR Check Doctor 则在 CI 完成后通过 `workflow_run` 触发。`workflow_run` 在 base 仓库的上下文中运行,因此可以获得具有写权限的正常 token,而无需检出或执行 fork 的代码。

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

`workflows: ["CI"]` 必须与 CI 工作流的 `name:` 一致。PR Check Doctor 会根据 workflow run 的 commit 自动解析出对应的 pull request;对于不是由 pull request 触发的运行(例如直接 push 到 `main`),或没有关联的 open pull request 的运行,会自动跳过。关于这种方式为何比 `pull_request_target` 更安全,请见 `docs/security.md`。

如果你的仓库只需要处理同一仓库内的 pull request、不需要支持外部 fork,那么上面"基本用法"中的单工作流 `pull_request` 配置更简单,并且仍然完全可用。

## 贡献

关于开发流程、验证步骤和 PR 规范,请见 [CONTRIBUTING.md](CONTRIBUTING.md)。

## 状态

PR Check Doctor 自 `v0.3.0` 起已在 GitHub Marketplace 上发布。发布新版本的流程请见 `docs/release-checklist.md`。
