# PR Check Doctor Core MVP Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the tested TypeScript core that turns normalized PR check failures into classified issues, a verdict, and one deterministic Markdown comment.

**Architecture:** Keep the first implementation mostly independent from GitHub APIs. The core modules accept plain TypeScript objects, which lets the test suite prove config parsing, log safety, classification, verdict calculation, and comment rendering before Octokit wiring exists.

**Tech Stack:** TypeScript, Vitest, Node.js 20, `js-yaml`, GitHub Action metadata.

---

## Shape Of The Work

This implementation should feel like a small library first and a GitHub Action second. The library layer is where product value appears: it knows what a failed check means, how much log evidence is safe to show, whether the PR is blocked, and how to write the triage comment. The action entrypoint can stay thin until the GitHub adapter work begins.

The README remains out of scope for this plan. It should be written after the action inputs, config behavior, and sample output are real.

## File Responsibilities

Create these files:

- `package.json`: scripts, runtime dependencies, dev dependencies, Node engine.
- `tsconfig.json`: strict TypeScript build settings for `src` and `test`.
- `vitest.config.ts`: test runner configuration.
- `action.yml`: minimal GitHub Action metadata and inputs.
- `src/types.ts`: shared categories, conclusions, check records, config, issues, and analysis result types.
- `src/config.ts`: YAML parsing, default config, check-rule matching.
- `src/logs.ts`: redaction and snippet extraction.
- `src/classifier.ts`: config-first and pattern-based issue classification.
- `src/verdict.ts`: `PASS`, `WARN`, `BLOCK` calculation.
- `src/comment.ts`: deterministic Markdown rendering.
- `src/index.ts`: minimal action entrypoint that reads inputs and reports the current core-only scope.
- `test/config.test.ts`: config defaults, overrides, and matching behavior.
- `test/logs.test.ts`: secret redaction and snippet limits.
- `test/classifier.test.ts`: category precedence and built-in classifiers.
- `test/verdict.test.ts`: blocking and non-blocking verdict behavior.
- `test/comment.test.ts`: comment marker, verdict, issue details, reproduction command.

Modify no existing source files. Do not edit `README.md` in this phase.

## Phase 1: Project Foundation

The first phase creates enough TypeScript and test infrastructure to let the following product behavior be driven by failing tests. This is the only phase that is mostly scaffolding.

### Task 1: Add TypeScript And Test Tooling

**Files:**

- Create: `package.json`
- Create: `tsconfig.json`
- Create: `vitest.config.ts`

- [ ] **Step 1: Create `package.json`**

```json
{
  "name": "pr-check-doctor",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "engines": {
    "node": ">=20"
  },
  "scripts": {
    "build": "tsc --noEmit",
    "test": "vitest run",
    "test:watch": "vitest"
  },
  "dependencies": {
    "@actions/core": "^1.11.1",
    "@actions/github": "^6.0.0",
    "js-yaml": "^4.1.0"
  },
  "devDependencies": {
    "@types/js-yaml": "^4.0.9",
    "@types/node": "^20.19.1",
    "tsx": "^4.20.3",
    "typescript": "^5.8.3",
    "vitest": "^3.2.4"
  }
}
```

- [ ] **Step 2: Create `tsconfig.json`**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "NodeNext",
    "moduleResolution": "NodeNext",
    "strict": true,
    "esModuleInterop": true,
    "forceConsistentCasingInFileNames": true,
    "skipLibCheck": true,
    "noEmit": true
  },
  "include": ["src/**/*.ts", "test/**/*.ts", "vitest.config.ts"]
}
```

- [ ] **Step 3: Create `vitest.config.ts`**

```ts
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    include: ["test/**/*.test.ts"]
  }
});
```

- [ ] **Step 4: Install dependencies**

Run: `npm install`

Expected: `package-lock.json` is created and npm exits successfully.

- [ ] **Step 5: Verify empty test suite behavior**

Run: `npm test -- --passWithNoTests`

Expected: Vitest exits successfully with no tests found.

- [ ] **Step 6: Commit foundation**

Run:

```bash
git add package.json package-lock.json tsconfig.json vitest.config.ts
git commit -m "chore: add typescript test tooling"
```

## Phase 2: Shared Model

The model types should be boring and explicit. Later modules should read like transformations from one model shape into another, not like ad hoc objects passed around with guessed fields.

### Task 2: Define Core Types

**Files:**

- Create: `src/types.ts`

- [ ] **Step 1: Create `src/types.ts`**

```ts
export type FailureCategory =
  | "test_failure"
  | "race_detected"
  | "lint_failure"
  | "format_drift"
  | "dependency_drift"
  | "build_failure"
  | "vulnerability"
  | "infra_validation"
  | "commit_policy"
  | "external_flake"
  | "cancelled"
  | "timeout"
  | "unknown";

export type Verdict = "PASS" | "WARN" | "BLOCK";

export type CheckConclusion =
  | "success"
  | "failure"
  | "cancelled"
  | "timed_out"
  | "neutral"
  | "skipped"
  | "action_required"
  | "startup_failure"
  | "unknown";

export interface CheckRule {
  category?: FailureCategory;
  local_command?: string;
  blocks_merge?: boolean;
}

export interface DoctorConfig {
  comment: {
    mode: "update";
    language: "en" | "ko";
  };
  verdict: {
    block_on: FailureCategory[];
  };
  checks: Record<string, CheckRule>;
}

export interface NormalizedCheck {
  name: string;
  workflowName?: string;
  conclusion: CheckConclusion;
  status?: "queued" | "in_progress" | "completed" | "unknown";
  log?: string;
}

export interface LogSnippet {
  text: string;
  truncated: boolean;
}

export interface ClassifiedIssue {
  checkName: string;
  workflowName?: string;
  category: FailureCategory;
  conclusion: CheckConclusion;
  blocksMerge: boolean;
  likelyCause: string;
  localCommand?: string;
  snippet?: LogSnippet;
}

export interface AnalysisResult {
  verdict: Verdict;
  issues: ClassifiedIssue[];
}
```

- [ ] **Step 2: Run typecheck**

Run: `npm run build`

Expected: TypeScript exits successfully.

- [ ] **Step 3: Commit core types**

Run:

```bash
git add src/types.ts
git commit -m "feat: define core triage types"
```

## Phase 3: Config As Product Contract

Configuration is the user's control surface. This phase establishes defaults and substring-based check matching, which lets repository-specific guidance override built-in guesses.

### Task 3: Parse Defaults And Match Check Rules

**Files:**

- Create: `test/config.test.ts`
- Create: `src/config.ts`

- [ ] **Step 1: Write failing config tests**

```ts
import { describe, expect, it } from "vitest";
import { defaultConfig, findMatchingCheckRule, parseDoctorConfig } from "../src/config.js";

describe("parseDoctorConfig", () => {
  it("returns defaults when config text is empty", () => {
    const config = parseDoctorConfig("");

    expect(config.comment).toEqual({ mode: "update", language: "en" });
    expect(config.verdict.block_on).toContain("test_failure");
    expect(config.verdict.block_on).toContain("build_failure");
    expect(config.checks).toEqual({});
  });

  it("merges configured checks with defaults", () => {
    const config = parseDoctorConfig(`
comment:
  language: ko
checks:
  "go test -race":
    category: race_detected
    local_command: |
      cd apps/api
      go test -race -cover ./...
    blocks_merge: true
`);

    expect(config.comment.language).toBe("ko");
    expect(config.comment.mode).toBe("update");
    expect(config.checks["go test -race"]?.category).toBe("race_detected");
  });
});

describe("findMatchingCheckRule", () => {
  it("matches check rules by case-insensitive substring", () => {
    const config = {
      ...defaultConfig,
      checks: {
        "build api": {
          category: "build_failure",
          local_command: "docker build apps/api",
          blocks_merge: true
        }
      }
    } as const;

    const match = findMatchingCheckRule("build-apps / build api", config);

    expect(match?.pattern).toBe("build api");
    expect(match?.rule.local_command).toBe("docker build apps/api");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- test/config.test.ts`

Expected: FAIL because `src/config.ts` does not exist.

- [ ] **Step 3: Implement config parsing and matching**

Implement `defaultConfig`, `parseDoctorConfig`, and `findMatchingCheckRule` in `src/config.ts`. Use `js-yaml` for parsing and keep unknown/missing sections harmless by falling back to defaults.

- [ ] **Step 4: Run config test**

Run: `npm test -- test/config.test.ts`

Expected: PASS.

- [ ] **Step 5: Commit config behavior**

Run:

```bash
git add src/config.ts test/config.test.ts
git commit -m "feat: parse doctor config"
```

## Phase 4: Log Safety Before Log Insight

Logs are useful only after they are safe to show. Redaction comes before snippet selection, and every rendered excerpt must have a predictable size limit.

### Task 4: Redact Secrets And Extract Snippets

**Files:**

- Create: `test/logs.test.ts`
- Create: `src/logs.ts`

- [ ] **Step 1: Write failing log tests**

```ts
import { describe, expect, it } from "vitest";
import { extractLogSnippet, redactSecrets } from "../src/logs.js";

describe("redactSecrets", () => {
  it("redacts common token and password values", () => {
    const redacted = redactSecrets(`
GITHUB_TOKEN=ghp_1234567890abcdefghijklmnopqrstuvwxyz
password: super-secret-value
Authorization: Bearer abc.def.ghi
`);

    expect(redacted).not.toContain("ghp_1234567890");
    expect(redacted).not.toContain("super-secret-value");
    expect(redacted).not.toContain("abc.def.ghi");
    expect(redacted).toContain("[REDACTED]");
  });
});

describe("extractLogSnippet", () => {
  it("keeps high-signal error lines and caps output", () => {
    const log = Array.from({ length: 80 }, (_, index) =>
      index === 41 ? "ERROR: docker build failed with exit code 1" : `line ${index}`
    ).join("\n");

    const snippet = extractLogSnippet(log, { maxLines: 5, maxChars: 120 });

    expect(snippet.text).toContain("ERROR: docker build failed");
    expect(snippet.text.length).toBeLessThanOrEqual(120);
    expect(snippet.truncated).toBe(true);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- test/logs.test.ts`

Expected: FAIL because `src/logs.ts` does not exist.

- [ ] **Step 3: Implement log handling**

Implement `redactSecrets(log: string): string` and `extractLogSnippet(log: string, options?: { maxLines?: number; maxChars?: number }): LogSnippet`. Apply redaction before line selection inside `extractLogSnippet`.

- [ ] **Step 4: Run log test**

Run: `npm test -- test/logs.test.ts`

Expected: PASS.

- [ ] **Step 5: Commit log behavior**

Run:

```bash
git add src/logs.ts test/logs.test.ts
git commit -m "feat: extract safe log snippets"
```

## Phase 5: Classification With Clear Precedence

Classification should prefer user config over built-in heuristics. The built-ins are intentionally conservative, with `unknown` as an acceptable fallback.

### Task 5: Classify Issues

**Files:**

- Create: `test/classifier.test.ts`
- Create: `src/classifier.ts`

- [ ] **Step 1: Write failing classifier tests**

```ts
import { describe, expect, it } from "vitest";
import { classifyCheck } from "../src/classifier.js";
import { defaultConfig } from "../src/config.js";

describe("classifyCheck", () => {
  it("uses config category and command before built-in patterns", () => {
    const issue = classifyCheck(
      {
        name: "custom quality gate",
        conclusion: "failure",
        log: "ERROR: docker build failed"
      },
      {
        ...defaultConfig,
        checks: {
          "custom quality": {
            category: "infra_validation",
            local_command: "make validate",
            blocks_merge: false
          }
        }
      }
    );

    expect(issue.category).toBe("infra_validation");
    expect(issue.localCommand).toBe("make validate");
    expect(issue.blocksMerge).toBe(false);
  });

  it("detects Go race detector output", () => {
    const issue = classifyCheck(
      {
        name: "go test -race (apps/api)",
        conclusion: "failure",
        log: "WARNING: DATA RACE\nRead at 0x00"
      },
      defaultConfig
    );

    expect(issue.category).toBe("race_detected");
    expect(issue.blocksMerge).toBe(true);
  });

  it("detects cancelled and timed out conclusions", () => {
    expect(classifyCheck({ name: "lint", conclusion: "cancelled" }, defaultConfig).category).toBe("cancelled");
    expect(classifyCheck({ name: "build", conclusion: "timed_out" }, defaultConfig).category).toBe("timeout");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- test/classifier.test.ts`

Expected: FAIL because `src/classifier.ts` does not exist.

- [ ] **Step 3: Implement classifier**

Implement `classifyCheck(check: NormalizedCheck, config: DoctorConfig): ClassifiedIssue`. Use config match first, then conclusions, then log/name patterns. Produce a concise `likelyCause` string for known categories and use `"The check failed, but PR Check Doctor could not classify the root cause yet."` for `unknown`.

- [ ] **Step 4: Run classifier test**

Run: `npm test -- test/classifier.test.ts`

Expected: PASS.

- [ ] **Step 5: Commit classifier behavior**

Run:

```bash
git add src/classifier.ts test/classifier.test.ts
git commit -m "feat: classify failed checks"
```

## Phase 6: Verdict As Merge Signal

The verdict is the bridge between many check details and one PR-level answer. It should be easy to reason about: any blocking issue makes the result `BLOCK`; non-blocking issues make it `WARN`; no issues make it `PASS`.

### Task 6: Calculate Verdicts

**Files:**

- Create: `test/verdict.test.ts`
- Create: `src/verdict.ts`

- [ ] **Step 1: Write failing verdict tests**

```ts
import { describe, expect, it } from "vitest";
import { calculateVerdict } from "../src/verdict.js";
import type { ClassifiedIssue } from "../src/types.js";

const baseIssue: ClassifiedIssue = {
  checkName: "lint",
  category: "lint_failure",
  conclusion: "failure",
  blocksMerge: true,
  likelyCause: "Lint failed."
};

describe("calculateVerdict", () => {
  it("returns PASS when there are no issues", () => {
    expect(calculateVerdict([])).toBe("PASS");
  });

  it("returns BLOCK when at least one issue blocks merge", () => {
    expect(calculateVerdict([baseIssue])).toBe("BLOCK");
  });

  it("returns WARN when issues are non-blocking", () => {
    expect(calculateVerdict([{ ...baseIssue, blocksMerge: false }])).toBe("WARN");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- test/verdict.test.ts`

Expected: FAIL because `src/verdict.ts` does not exist.

- [ ] **Step 3: Implement verdict calculation**

Implement `calculateVerdict(issues: ClassifiedIssue[]): Verdict`.

- [ ] **Step 4: Run verdict test**

Run: `npm test -- test/verdict.test.ts`

Expected: PASS.

- [ ] **Step 5: Commit verdict behavior**

Run:

```bash
git add src/verdict.ts test/verdict.test.ts
git commit -m "feat: calculate pr verdict"
```

## Phase 7: One Stable Comment

The comment renderer should be deterministic and concise. It should present the verdict first, then the evidence needed to reproduce and fix the failure.

### Task 7: Render Markdown Comment

**Files:**

- Create: `test/comment.test.ts`
- Create: `src/comment.ts`

- [ ] **Step 1: Write failing comment tests**

```ts
import { describe, expect, it } from "vitest";
import { renderComment } from "../src/comment.js";

describe("renderComment", () => {
  it("renders a stable PR triage comment", () => {
    const markdown = renderComment({
      verdict: "BLOCK",
      issues: [
        {
          checkName: "go-lint / go test -race (apps/api)",
          workflowName: "go-lint",
          category: "race_detected",
          conclusion: "failure",
          blocksMerge: true,
          likelyCause: "Go race detector reported a data race.",
          localCommand: "cd apps/api\ngo test -race -cover ./...",
          snippet: {
            text: "WARNING: DATA RACE",
            truncated: false
          }
        }
      ]
    });

    expect(markdown).toContain("<!-- pr-check-doctor -->");
    expect(markdown).toContain("## PR Check Doctor");
    expect(markdown).toContain("Verdict: BLOCK");
    expect(markdown).toContain("race_detected");
    expect(markdown).toContain("WARNING: DATA RACE");
    expect(markdown).toContain("go test -race -cover ./...");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- test/comment.test.ts`

Expected: FAIL because `src/comment.ts` does not exist.

- [ ] **Step 3: Implement renderer**

Implement `renderComment(result: AnalysisResult): string`. Use `<!-- pr-check-doctor -->` as the stable marker. Escape nothing beyond normal Markdown fencing because inputs are already normalized and snippets are placed in fenced code blocks.

- [ ] **Step 4: Run comment test**

Run: `npm test -- test/comment.test.ts`

Expected: PASS.

- [ ] **Step 5: Commit comment behavior**

Run:

```bash
git add src/comment.ts test/comment.test.ts
git commit -m "feat: render triage comment"
```

## Phase 8: Minimal Action Surface

This phase makes the repository recognizable as a GitHub Action without pretending the live GitHub adapter is complete. The entrypoint should be honest: it exposes inputs and logs that core implementation is present, while API collection remains the next focused project.

### Task 8: Add Action Metadata And Entrypoint

**Files:**

- Create: `action.yml`
- Create: `src/index.ts`

- [ ] **Step 1: Create `action.yml`**

```yaml
name: PR Check Doctor
description: Turn failed GitHub PR checks into one actionable comment.
author: pr-check-doctor
inputs:
  github-token:
    description: GitHub token used to read checks and write PR comments.
    required: true
  config-path:
    description: Path to the PR Check Doctor config file.
    required: false
    default: .check-doctor.yml
  dry-run:
    description: Render output without writing a PR comment.
    required: false
    default: "false"
runs:
  using: node20
  main: dist/index.js
```

- [ ] **Step 2: Create `src/index.ts`**

```ts
import * as core from "@actions/core";

export async function run(): Promise<void> {
  const configPath = core.getInput("config-path") || ".check-doctor.yml";
  const dryRun = core.getBooleanInput("dry-run");

  core.info(`PR Check Doctor core is ready. config-path=${configPath} dry-run=${dryRun}`);
  core.info("GitHub check collection and PR comment upsert will be wired in the adapter phase.");
}

run().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  core.setFailed(message);
});
```

- [ ] **Step 3: Run full verification**

Run: `npm test`

Expected: all test files pass.

Run: `npm run build`

Expected: TypeScript exits successfully.

- [ ] **Step 4: Commit action surface**

Run:

```bash
git add action.yml src/index.ts
git commit -m "feat: add action entrypoint"
```

## Final Verification

After all phases, run:

```bash
npm test
npm run build
git status --short
```

Expected:

- all Vitest tests pass;
- TypeScript strict build passes;
- `README.md` is unchanged;
- `docs/pr-check-doctor-plan.md` remains untouched if it was untracked before implementation;
- only implementation files from this plan are modified or added.

## What This Plan Deliberately Leaves For The Next Plan

The next implementation plan should cover GitHub API collection and comment upsert:

- resolving the PR from `workflow_run` or `workflow_dispatch`;
- listing check runs and workflow jobs for the PR head SHA;
- downloading job logs;
- updating an existing comment by the `<!-- pr-check-doctor -->` marker;
- adding fixture-based adapter tests.

Those steps depend on the core shapes created here, so they should come after this plan is green.
