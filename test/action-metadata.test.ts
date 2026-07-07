import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { load } from "js-yaml";

const actionMetadata = load(readFileSync("action.yml", "utf8")) as {
  name?: unknown;
  description?: unknown;
  branding?: {
    icon?: unknown;
    color?: unknown;
  };
  runs?: {
    using?: unknown;
    main?: unknown;
  };
};

describe("action metadata", () => {
  it("keeps marketplace-facing metadata configured", () => {
    expect(actionMetadata.name).toBe("PR Check Doctor");
    expect(actionMetadata.description).toBe(
      "Turn failed GitHub PR checks into one actionable comment."
    );
    expect(actionMetadata.branding).toEqual({
      icon: "git-pull-request",
      color: "blue"
    });
  });

  it("points GitHub Actions at the bundled Node entrypoint", () => {
    expect(actionMetadata.runs).toEqual({
      using: "node20",
      main: "dist/index.cjs"
    });
  });
});
