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

  it("matches matrix job variants with a wildcard pattern", () => {
    const config = {
      ...defaultConfig,
      checks: {
        "test (*)": {
          category: "test_failure",
          local_command: "npm test",
          blocks_merge: true
        }
      }
    } as const;

    const ubuntuMatch = findMatchingCheckRule("test (ubuntu-latest, 18)", config);
    const windowsMatch = findMatchingCheckRule("test (windows-latest, 20)", config);

    expect(ubuntuMatch?.pattern).toBe("test (*)");
    expect(windowsMatch?.pattern).toBe("test (*)");
  });

  it("does not match a wildcard pattern missing its literal parts", () => {
    const config = {
      ...defaultConfig,
      checks: {
        "test (*)": {
          category: "test_failure",
          local_command: "npm test",
          blocks_merge: true
        }
      }
    } as const;

    expect(findMatchingCheckRule("lint", config)).toBeUndefined();
  });

  it("matches a pattern with multiple wildcard segments", () => {
    const config = {
      ...defaultConfig,
      checks: {
        "test (*, *)": {
          category: "test_failure",
          local_command: "npm test",
          blocks_merge: true
        }
      }
    } as const;

    const match = findMatchingCheckRule("test (ubuntu-latest, 20)", config);

    expect(match?.pattern).toBe("test (*, *)");
  });
});
