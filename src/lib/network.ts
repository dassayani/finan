export type RetryOptions = {
  retries?: number;
  timeoutMs?: number;
  baseDelayMs?: number;
  retryOnStatuses?: number[];
};

const DEFAULT_RETRY_STATUSES = [408, 425, 429, 500, 502, 503, 504];

function wait(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function mergeSignals(signalA?: AbortSignal, signalB?: AbortSignal): AbortSignal | undefined {
  if (!signalA && !signalB) return undefined;
  if (!signalA) return signalB;
  if (!signalB) return signalA;

  const controller = new AbortController();
  const onAbort = () => controller.abort();

  if (signalA.aborted || signalB.aborted) {
    controller.abort();
  } else {
    signalA.addEventListener("abort", onAbort, { once: true });
    signalB.addEventListener("abort", onAbort, { once: true });
  }

  return controller.signal;
}

export async function fetchWithTimeoutAndRetry(
  input: RequestInfo | URL,
  init: RequestInit = {},
  options: RetryOptions = {},
): Promise<Response> {
  const retries = options.retries ?? 2;
  const timeoutMs = options.timeoutMs ?? 8000;
  const baseDelayMs = options.baseDelayMs ?? 250;
  const retryOnStatuses = options.retryOnStatuses ?? DEFAULT_RETRY_STATUSES;

  let lastError: Error | null = null;

  for (let attempt = 0; attempt <= retries; attempt += 1) {
    const timeoutController = new AbortController();
    const timeoutId = setTimeout(() => timeoutController.abort(), timeoutMs);

    try {
      const signal = mergeSignals(init.signal ?? undefined, timeoutController.signal);
      const response = await fetch(input, { ...init, signal });
      clearTimeout(timeoutId);

      const canRetryStatus = retryOnStatuses.includes(response.status);
      if (!canRetryStatus || attempt === retries) {
        return response;
      }

      await wait(baseDelayMs * (2 ** attempt));
    } catch (error) {
      clearTimeout(timeoutId);

      const err = error instanceof Error ? error : new Error(String(error));
      lastError = err;

      if (attempt === retries) {
        throw err;
      }

      await wait(baseDelayMs * (2 ** attempt));
    }
  }

  throw lastError ?? new Error("Erro de rede");
}
