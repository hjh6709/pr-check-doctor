import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const packageJson = JSON.parse(readFileSync("package.json", "utf8")) as {
  license?: unknown;
};

const packageLock = JSON.parse(readFileSync("package-lock.json", "utf8")) as {
  packages?: {
    "": {
      license?: unknown;
    };
  };
};

describe("package metadata", () => {
  it("declares the repository license consistently", () => {
    expect(packageJson.license).toBe("Apache-2.0");
    expect(packageLock.packages?.[""].license).toBe("Apache-2.0");
  });
});
