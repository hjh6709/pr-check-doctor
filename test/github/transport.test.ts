import { describe, expect, it, vi } from "vitest";
import { fetchWithRetry } from "../../src/github/transport.js";

function fakeResponse(status: number, headers: Record<string, string> = {}): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    statusText: "status text",
    headers: {
      get: (name: string) => headers[name.toLowerCase()] ?? null
    }
  } as unknown as Response;
}

describe("fetchWithRetry", () => {
  it("returns the response on the first success", async () => {
    const attempt = vi.fn().mockResolvedValue(fakeResponse(200));

    const response = await fetchWithRetry(attempt);

    expect(response.status).toBe(200);
    expect(attempt).toHaveBeenCalledTimes(1);
  });

  it("retries on a network error then succeeds", async () => {
    const attempt = vi
      .fn()
      .mockRejectedValueOnce(new Error("network down"))
      .mockResolvedValueOnce(fakeResponse(200));

    const response = await fetchWithRetry(attempt);

    expect(response.status).toBe(200);
    expect(attempt).toHaveBeenCalledTimes(2);
  });

  it("retries on 503 then succeeds", async () => {
    const attempt = vi
      .fn()
      .mockResolvedValueOnce(fakeResponse(503))
      .mockResolvedValueOnce(fakeResponse(200));

    const response = await fetchWithRetry(attempt);

    expect(response.status).toBe(200);
    expect(attempt).toHaveBeenCalledTimes(2);
  });

  it("retries a rate-limited 403 then succeeds", async () => {
    const attempt = vi
      .fn()
      .mockResolvedValueOnce(fakeResponse(403, { "x-ratelimit-remaining": "0" }))
      .mockResolvedValueOnce(fakeResponse(200));

    const response = await fetchWithRetry(attempt);

    expect(response.status).toBe(200);
    expect(attempt).toHaveBeenCalledTimes(2);
  });

  it("does not retry a permission 403", async () => {
    const attempt = vi.fn().mockResolvedValue(fakeResponse(403));

    const response = await fetchWithRetry(attempt);

    expect(response.status).toBe(403);
    expect(attempt).toHaveBeenCalledTimes(1);
  });

  it("gives up after 3 attempts and returns the last failing response", async () => {
    vi.useFakeTimers();
    try {
      const attempt = vi.fn().mockResolvedValue(fakeResponse(503));

      const resultPromise = fetchWithRetry(attempt);
      await vi.runAllTimersAsync();
      const response = await resultPromise;

      expect(response.status).toBe(503);
      expect(attempt).toHaveBeenCalledTimes(3);
    } finally {
      vi.useRealTimers();
    }
  });

  it("throws the last network error after exhausting attempts", async () => {
    vi.useFakeTimers();
    try {
      const attempt = vi.fn().mockRejectedValue(new Error("network down"));

      const resultPromise = fetchWithRetry(attempt);
      const assertion = expect(resultPromise).rejects.toThrow("network down");
      await vi.runAllTimersAsync();
      await assertion;

      expect(attempt).toHaveBeenCalledTimes(3);
    } finally {
      vi.useRealTimers();
    }
  });

  it("waits according to a Retry-After header instead of the default backoff", async () => {
    vi.useFakeTimers();
    try {
      const attempt = vi
        .fn()
        .mockResolvedValueOnce(fakeResponse(429, { "retry-after": "0" }))
        .mockResolvedValueOnce(fakeResponse(200));

      const resultPromise = fetchWithRetry(attempt);
      await vi.runAllTimersAsync();
      const response = await resultPromise;

      expect(response.status).toBe(200);
      expect(attempt).toHaveBeenCalledTimes(2);
    } finally {
      vi.useRealTimers();
    }
  });
});
