import * as core from "@actions/core";
import { runAction } from "./action.js";

export async function run(): Promise<void> {
  await runAction(core);
}

run().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  core.setFailed(message);
});
