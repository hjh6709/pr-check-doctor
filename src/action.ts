import { readFile as readFileFromFs } from "node:fs/promises";
import { parseDoctorConfig } from "./config.js";
import { createTriageComment } from "./triage.js";
import type { GitHubChecksLike } from "./github-checks.js";

interface ActionCore {
  getInput(name: string): string;
  getBooleanInput(name: string): boolean;
  info(message: string): void;
}

interface Runtime {
  readFile(path: string): Promise<string>;
}

interface TriageFixture {
  config?: string;
  gitHubChecks: GitHubChecksLike;
  logsByCheckName?: Record<string, string>;
}

const defaultRuntime: Runtime = {
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

  core.info(`PR Check Doctor core is ready. config-path=${configPath} dry-run=${dryRun}`);
  core.info("GitHub check collection and PR comment upsert will be wired in the adapter phase.");
}
