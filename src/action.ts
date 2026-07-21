import { readFile as readFileFromFs } from "node:fs/promises";
import { parseDoctorConfig } from "./config.js";
import {
  createGitHubChecksClient,
  createGitHubChecksWithLogsFetcher,
  createGitHubJobLogsClient,
  fetchAssociatedPullNumber,
  type CommitContext,
  type GitHubChecksFetcher
} from "./github/api.js";
import {
  createGitHubCommentsClient,
  upsertTriageComment,
  type GitHubCommentsClient
} from "./github/comments.js";
import { parsePullRequestEvent, parseWorkflowRunEvent } from "./github/event.js";
import { createTriageComment, createTriageCommentFromChecks } from "./triage.js";
import type { GitHubChecksLike } from "./github/checks.js";
import type { PullRequestContext } from "./github/event.js";
import type { NormalizedCheck } from "./types.js";

interface ActionCore {
  getInput(name: string): string;
  getBooleanInput(name: string): boolean;
  info(message: string): void;
  warning?(message: string): void;
}

interface Runtime {
  createFetchChecks?(token: string): GitHubChecksFetcher;
  createUpsertComment?(token: string): GitHubCommentUpserter;
  createResolvePullNumberForCommit?(token: string): ResolvePullNumberForCommit;
  fetchChecks?(context: PullRequestContext): Promise<NormalizedCheck[]>;
  resolvePullNumberForCommit?: ResolvePullNumberForCommit;
  getEnv?(name: string): string | undefined;
  readFile(path: string): Promise<string>;
}

type GitHubCommentUpserter = (context: PullRequestContext, body: string) => Promise<void>;
type ResolvePullNumberForCommit = (context: CommitContext) => Promise<number | undefined>;

interface TriageFixture {
  config?: string;
  gitHubChecks: GitHubChecksLike;
  logsByCheckName?: Record<string, string>;
}

const defaultRuntime: Runtime = {
  createFetchChecks: (token) =>
    createGitHubChecksWithLogsFetcher(
      token,
      createGitHubChecksClient,
      createGitHubJobLogsClient
    ),
  createUpsertComment: (token) =>
    createGitHubCommentUpserter(createGitHubCommentsClient(token)),
  createResolvePullNumberForCommit: (token) => {
    const client = createGitHubChecksClient(token);
    return (context) => fetchAssociatedPullNumber(context, client);
  },
  getEnv: (name) => process.env[name],
  readFile: (path) => readFileFromFs(path, "utf8")
};

export async function runAction(
  core: ActionCore,
  runtime: Runtime = defaultRuntime
): Promise<void> {
  const configPath = core.getInput("config-path") || ".check-doctor.yml";
  const dryRun = core.getBooleanInput("dry-run");
  const fixturePath = core.getInput("fixture-path");

  if (dryRun && fixturePath) {
    // Fixture mode keeps the render pipeline testable without calling GitHub.
    const fixture = JSON.parse(await runtime.readFile(fixturePath)) as TriageFixture;
    const { config, warnings } = parseDoctorConfig(fixture.config ?? "");
    warnings.forEach((warning) => core.warning?.(warning));
    const markdown = createTriageComment({
      config,
      gitHubChecks: fixture.gitHubChecks,
      logsByCheckName: fixture.logsByCheckName
    });

    core.info(markdown);
    return;
  }

  const eventPath = runtime.getEnv?.("GITHUB_EVENT_PATH");
  if (eventPath) {
    const eventName = runtime.getEnv?.("GITHUB_EVENT_NAME");
    const payload = JSON.parse(await runtime.readFile(eventPath));

    const context = await resolvePullRequestContext(eventName, payload, core, runtime);
    if (!context) {
      return;
    }

    core.info(
      `Loaded PR context ${context.owner}/${context.repo}#${context.pullNumber} head=${context.headSha}`
    );

    const fetchChecks = runtime.fetchChecks ?? createTokenFetchChecks(core, runtime);
    if (!fetchChecks) {
      // On pull_request events, silently skipping without a token would hide a broken setup.
      throw new Error("github-token input is required to read pull request checks.");
    }

    const configText = await readOptionalConfig(configPath, runtime);
    const { config, warnings } = parseDoctorConfig(configText);
    warnings.forEach((warning) => core.warning?.(warning));
    const checks = await fetchChecks(context);
    const markdown = createTriageCommentFromChecks({
      config,
      checks,
      // The action job is necessarily in progress while it renders the comment.
      ignoredWarningCheckNames: createCurrentCheckNameCandidates(runtime)
    });

    if (dryRun) {
      core.info(markdown);
      return;
    }

    const upsertComment = createTokenUpsertComment(core, runtime);
    if (upsertComment) {
      await upsertComment(context, markdown);
      return;
    }

    core.info(markdown);
    return;
  }

  core.info(`PR Check Doctor core is ready. config-path=${configPath} dry-run=${dryRun}`);
  core.info("GitHub check collection and PR comment upsert will be wired in the adapter phase.");
}

async function resolvePullRequestContext(
  eventName: string | undefined,
  payload: unknown,
  core: ActionCore,
  runtime: Runtime
): Promise<PullRequestContext | undefined> {
  if (!eventName || eventName === "pull_request") {
    return parsePullRequestEvent(payload);
  }

  if (eventName === "workflow_run") {
    return resolveWorkflowRunContext(payload, core, runtime);
  }

  // Push and manual events can run repository CI, but they do not have a PR comment target.
  core.info("Skipping PR Check Doctor because this is not a pull_request or workflow_run event.");
  return undefined;
}

async function resolveWorkflowRunContext(
  payload: unknown,
  core: ActionCore,
  runtime: Runtime
): Promise<PullRequestContext | undefined> {
  const workflowRun = parseWorkflowRunEvent(payload);

  if (!workflowRun.isPullRequestRun) {
    core.info(
      "Skipping PR Check Doctor because the workflow_run was not triggered by a pull_request."
    );
    return undefined;
  }

  const resolvePullNumber =
    runtime.resolvePullNumberForCommit ?? createTokenResolvePullNumber(core, runtime);
  if (!resolvePullNumber) {
    throw new Error(
      "github-token input is required to resolve the pull request for a workflow_run event."
    );
  }

  const pullNumber = await resolvePullNumber(workflowRun);
  if (pullNumber === undefined) {
    core.info(
      `Skipping PR Check Doctor because no open pull request is associated with commit ${workflowRun.headSha}.`
    );
    return undefined;
  }

  return {
    owner: workflowRun.owner,
    repo: workflowRun.repo,
    pullNumber,
    headSha: workflowRun.headSha
  };
}

function createTokenFetchChecks(
  core: ActionCore,
  runtime: Runtime
): GitHubChecksFetcher | undefined {
  const token = core.getInput("github-token");

  if (!token || !runtime.createFetchChecks) {
    return undefined;
  }

  return runtime.createFetchChecks(token);
}

function createTokenUpsertComment(
  core: ActionCore,
  runtime: Runtime
): GitHubCommentUpserter | undefined {
  const token = core.getInput("github-token");

  if (!token || !runtime.createUpsertComment) {
    return undefined;
  }

  return runtime.createUpsertComment(token);
}

function createTokenResolvePullNumber(
  core: ActionCore,
  runtime: Runtime
): ResolvePullNumberForCommit | undefined {
  const token = core.getInput("github-token");

  if (!token || !runtime.createResolvePullNumberForCommit) {
    return undefined;
  }

  return runtime.createResolvePullNumberForCommit(token);
}

function createCurrentCheckNameCandidates(runtime: Runtime): string[] {
  const jobId = runtime.getEnv?.("GITHUB_JOB");

  return jobId ? [jobId] : [];
}

function createGitHubCommentUpserter(client: GitHubCommentsClient): GitHubCommentUpserter {
  return (context, body) => upsertTriageComment(context, body, client);
}

async function readOptionalConfig(configPath: string, runtime: Runtime): Promise<string> {
  try {
    return await runtime.readFile(configPath);
  } catch (error) {
    if (isMissingFileError(error)) {
      return "";
    }

    throw error;
  }
}

function isMissingFileError(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (error as { code?: unknown }).code === "ENOENT"
  );
}
