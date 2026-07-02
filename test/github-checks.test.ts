import { describe, expect, it } from "vitest";
import { mapCheckRun } from "../src/github-checks.js";

describe("mapCheckRun", () => {
  it("maps a GitHub check run into a normalized check", () => {
    expect(
      mapCheckRun({
        name: "go test -race",
        conclusion: "failure",
        status: "completed"
      })
    ).toEqual({
      name: "go test -race",
      conclusion: "failure",
      status: "completed"
    });
  });

  it("uses unknown for missing or unexpected conclusion and status values", () => {
    expect(
      mapCheckRun({
        name: "custom check",
        conclusion: null,
        status: "waiting"
      })
    ).toEqual({
      name: "custom check",
      conclusion: "unknown",
      status: "unknown"
    });
  });
});
