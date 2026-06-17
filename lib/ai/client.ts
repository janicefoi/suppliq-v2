/**
 * Thin HTTP client for the SUPPLIQ Python AI service.
 *
 * All requests go through this module so that:
 *  - The AI_SERVICE_URL is a single env var
 *  - Timeouts are enforced uniformly (10 s)
 *  - Network / connection errors are surfaced as `unavailable: true`
 *    so callers can degrade gracefully instead of throwing
 */

const BASE_URL = process.env.AI_SERVICE_URL ?? "http://localhost:8000";
const TIMEOUT_MS = 10_000;

export type AiResult<T> =
  | { ok: true; data: T }
  | { ok: false; error: string; unavailable: boolean };

async function request<T>(
  method: "GET" | "POST",
  path: string,
  options?: { params?: Record<string, string>; body?: unknown }
): Promise<AiResult<T>> {
  try {
    const url = new URL(path, BASE_URL);
    if (options?.params) {
      for (const [k, v] of Object.entries(options.params)) {
        url.searchParams.set(k, v);
      }
    }

    const res = await fetch(url.toString(), {
      method,
      headers: { "Content-Type": "application/json" },
      body: options?.body !== undefined ? JSON.stringify(options.body) : undefined,
      cache: "no-store",
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });

    if (!res.ok) {
      const msg = await res.text().catch(() => `HTTP ${res.status}`);
      return { ok: false, error: msg, unavailable: false };
    }

    const data: T = await res.json();
    return { ok: true, data };
  } catch (err) {
    const isNetwork =
      err instanceof TypeError ||
      (err instanceof Error &&
        (err.name === "TimeoutError" || err.name === "AbortError" || err.name === "FetchError"));
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Unknown error",
      unavailable: isNetwork,
    };
  }
}

export const ai = {
  get: <T>(path: string, params?: Record<string, string>) =>
    request<T>("GET", path, { params }),
  post: <T>(path: string, body: unknown) =>
    request<T>("POST", path, { body }),
};
