import type { LogSnippet } from "./types.js";

interface SnippetOptions {
  maxLines?: number;
  maxChars?: number;
}

const secretPatterns: Array<[RegExp, string]> = [
  [/\bgh[pousr]_[A-Za-z0-9_]{20,}\b/g, "[REDACTED]"],
  [/\bAKIA[0-9A-Z]{16}\b/g, "[REDACTED]"],
  [/-----BEGIN [A-Z ]*PRIVATE KEY-----[\s\S]*?-----END [A-Z ]*PRIVATE KEY-----/g, "[REDACTED]"],
  [/(Authorization:\s*Bearer\s+)[^\s]+/gi, "$1[REDACTED]"],
  [/((?:token|password|secret|api[_-]?key)\s*[:=]\s*)[^\s]+/gi, "$1[REDACTED]"]
];

const signalPattern =
  /warning: data race|traceback|cve-|vulnerability|error|failed|fatal|panic|exit code|timed out/i;

export function redactSecrets(log: string): string {
  return secretPatterns.reduce(
    (redacted, [pattern, replacement]) => redacted.replace(pattern, replacement),
    log
  );
}

export function extractLogSnippet(log: string, options: SnippetOptions = {}): LogSnippet {
  const maxLines = options.maxLines ?? 20;
  const maxChars = options.maxChars ?? 4000;
  const redactedLog = redactSecrets(log);
  const lines = redactedLog.split(/\r?\n/);
  const signalIndexes = lines
    .map((line, index) => (signalPattern.test(line) ? index : -1))
    .filter((index) => index >= 0);

  const selectedLines =
    signalIndexes.length > 0 ? selectSignalLines(lines, signalIndexes, maxLines) : lines.slice(-maxLines);

  const joined = selectedLines.join("\n");
  const text = joined.length > maxChars ? joined.slice(0, maxChars) : joined;

  return {
    text,
    truncated: lines.length > selectedLines.length || joined.length > maxChars
  };
}

function selectSignalLines(lines: string[], signalIndexes: number[], maxLines: number): string[] {
  const selected = new Set<number>();

  for (const index of signalIndexes) {
    selected.add(index);

    if (selected.size >= maxLines) {
      break;
    }
  }

  return Array.from(selected)
    .sort((left, right) => left - right)
    .map((index) => lines[index]);
}
