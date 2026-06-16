import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { rateLimit, clientKey } from "@/lib/rate-limit";

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

describe("rateLimit", () => {
  it("allows up to the limit then blocks", () => {
    const key = `t:${Math.random()}`;
    expect(rateLimit(key, 3, 1000).ok).toBe(true);  // 1
    expect(rateLimit(key, 3, 1000).ok).toBe(true);  // 2
    expect(rateLimit(key, 3, 1000).ok).toBe(true);  // 3
    const blocked = rateLimit(key, 3, 1000);        // 4
    expect(blocked.ok).toBe(false);
    expect(blocked.retryAfterSeconds).toBeGreaterThan(0);
  });

  it("resets after the window elapses", () => {
    const key = `t:${Math.random()}`;
    rateLimit(key, 1, 1000);
    expect(rateLimit(key, 1, 1000).ok).toBe(false);
    vi.advanceTimersByTime(1001);
    expect(rateLimit(key, 1, 1000).ok).toBe(true);
  });

  it("tracks keys independently", () => {
    const a = `a:${Math.random()}`, b = `b:${Math.random()}`;
    rateLimit(a, 1, 1000);
    expect(rateLimit(a, 1, 1000).ok).toBe(false);
    expect(rateLimit(b, 1, 1000).ok).toBe(true); // independent bucket
  });

  it("reports decreasing remaining", () => {
    const key = `t:${Math.random()}`;
    expect(rateLimit(key, 3, 1000).remaining).toBe(2);
    expect(rateLimit(key, 3, 1000).remaining).toBe(1);
    expect(rateLimit(key, 3, 1000).remaining).toBe(0);
  });
});

describe("clientKey", () => {
  it("prefers first x-forwarded-for entry", () => {
    const req = new Request("http://x", { headers: { "x-forwarded-for": "1.2.3.4, 5.6.7.8" } });
    expect(clientKey(req)).toBe("1.2.3.4");
  });
  it("falls back to x-real-ip then unknown", () => {
    expect(clientKey(new Request("http://x", { headers: { "x-real-ip": "9.9.9.9" } }))).toBe("9.9.9.9");
    expect(clientKey(new Request("http://x"))).toBe("unknown");
  });
});
