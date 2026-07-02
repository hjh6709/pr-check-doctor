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
