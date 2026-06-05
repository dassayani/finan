import { beforeEach, describe, expect, it, vi } from "vitest";
import { fetchWithTimeoutAndRetry } from "@/lib/network";

describe("fetchWithTimeoutAndRetry", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("retries on transient 5xx and eventually succeeds", async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(new Response("err", { status: 503 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ ok: true }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }));

    vi.stubGlobal("fetch", fetchMock);

    const res = await fetchWithTimeoutAndRetry("http://localhost/test", {}, {
      retries: 2,
      baseDelayMs: 1,
      timeoutMs: 1000,
    });

    expect(res.status).toBe(200);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("does not retry for 4xx non-retriable responses", async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response("bad", { status: 400 }));
    vi.stubGlobal("fetch", fetchMock);

    const res = await fetchWithTimeoutAndRetry("http://localhost/test", {}, {
      retries: 3,
      baseDelayMs: 1,
      timeoutMs: 1000,
    });

    expect(res.status).toBe(400);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("fails after timeout retries are exhausted", async () => {
    const fetchMock = vi.fn(async (_input: RequestInfo | URL, init?: RequestInit) => {
      if (init?.signal) {
        await new Promise((_resolve, reject) => {
          init.signal?.addEventListener("abort", () => {
            reject(new Error("aborted"));
          });
        });
      }
      throw new Error("should not reach");
    });

    vi.stubGlobal("fetch", fetchMock);

    await expect(fetchWithTimeoutAndRetry("http://localhost/test", {}, {
      retries: 1,
      baseDelayMs: 1,
      timeoutMs: 5,
    })).rejects.toThrow(/aborted/i);

    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
});
