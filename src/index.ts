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
