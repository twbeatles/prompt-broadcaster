const DEFAULT_RUNTIME_MESSAGE_TIMEOUT_MS = 5000;

function normalizeTimeoutMs(timeoutMs: unknown): number {
  const numericValue = Number(timeoutMs);
  if (!Number.isFinite(numericValue) || numericValue <= 0) {
    return 0;
  }

  return Math.max(0, Math.round(numericValue));
}

export function sendRuntimeMessage<T = unknown>(
  message: unknown,
  timeoutMs = 0,
  fallbackValue: T | null = null
): Promise<T | null> {
  return new Promise((resolve) => {
    let settled = false;
    let timeoutId = 0;

    const finish = (value: T | null) => {
      if (settled) {
        return;
      }

      settled = true;
      if (timeoutId) {
        globalThis.clearTimeout(timeoutId);
      }
      resolve(value ?? fallbackValue);
    };

    const normalizedTimeoutMs = normalizeTimeoutMs(timeoutMs);
    if (normalizedTimeoutMs > 0) {
      timeoutId = globalThis.setTimeout(() => finish(fallbackValue), normalizedTimeoutMs);
    }

    try {
      chrome.runtime.sendMessage(message as object, (response) => {
        if (chrome.runtime.lastError) {
          finish(fallbackValue);
          return;
        }

        finish((response ?? fallbackValue) as T | null);
      });
    } catch (_error) {
      finish(fallbackValue);
    }
  });
}

export function sendRuntimeMessageWithTimeout<T = unknown>(
  message: unknown,
  timeoutMs = DEFAULT_RUNTIME_MESSAGE_TIMEOUT_MS,
  fallbackValue: T | null = null
): Promise<T | null> {
  return sendRuntimeMessage(message, timeoutMs, fallbackValue);
}
