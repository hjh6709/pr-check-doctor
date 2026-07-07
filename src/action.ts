import { readFile as readFileFromFs } from "node:fs/promises";
import { parseDoctorConfig } from "./config.js";
import {
  createGitHubChecksClient,
  createGitHubChecksFetcher,
  type GitHubChecksFetcher
} from "./github-api.js";
import {
  createGitHubCommentsClient,
  upsertTriageComment,
  type GitHubCommentsClient
} from "./github-comments.js";
import { parsePullRequestEvent } from "./github-event.js";
import { createTriageComment, createTriageCommentFromChecks } from "./triage.js";
import type { GitHubChecksLike } from "./github-checks.js";
import type { PullRequestContext } from "./github-event.js";
import type { NormalizedCheck } from "./types.js";

interface ActionCore {
  getInput(name: string): string;
  getBooleanInput(name: string): boolean;
  info(message: string): void;
}

interface Runtime {
  createFetchChecks?(token: string): GitHubChecksFetcher;
  createUpsertComment?(token: string): GitHubCommentUpserter;
  fetchChecks?(context: PullRequestContext): Promise<NormalizedCheck[]>;
  getEnv?(name: string): string | undefined;
  readFile(path: string): Promise<string>;
}

type GitHubCommentUpserter = (context: PullRequestContext, body: string) => Promise<void>;

interface TriageFixture {
  config?: string;
  gitHubChecks: GitHubChecksLike;
  logsByCheckName?: Record<string, string>;
}

const defaultRuntime: Runtime = {
  createFetchChecks: (token) => createGitHubChecksFetcher(token, createGitHubChecksClient),
  createUpsertComment: (token) =>
    createGitHubCommentUpserter(createGitHubCommentsClient(token)),
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
    const fixture = JSON.parse(await runtime.readFile(fixturePath)) as TriageFixture;
    const markdown = createTriageComment({
      config: parseDoctorConfig(fixture.config ?? ""),
      gitHubChecks: fixture.gitHubChecks,
      logsByCheckName: fixture.logsByCheckName
    });

    core.info(markdown);
    return;
  }

  const eventPath = runtime.getEnv?.("GITHUB_EVENT_PATH");
  if (eventPath) {
    const context = parsePullRequestEvent(JSON.parse(await runtime.readFile(eventPath)));
    core.info(
      `Loaded PR context ${context.owner}/${context.repo}#${context.pullNumber} head=${context.headSha}`
    );

    const fetchChecks = runtime.fetchChecks ?? createTokenFetchChecks(core, runtime);
    if (fetchChecks) {
      const configText = await readOptionalConfig(configPath, runtime);
      const checks = await fetchChecks(context);
      const markdown = createTriageCommentFromChecks({
        config: parseDoctorConfig(configText),
        checks
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
  }

  core.info(`PR Check Doctor core is ready. config-path=${configPath} dry-run=${dryRun}`);
  core.info("GitHub check collection and PR comment upsert will be wired in the adapter phase.");
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
