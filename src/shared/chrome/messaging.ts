import type {
  RuntimeAction,
  RuntimeMessage,
  RuntimeMessageOf,
  RuntimeResponseOf,
} from "../types/messages";

const DEFAULT_RUNTIME_MESSAGE_TIMEOUT_MS = 5000;

function normalizeTimeoutMs(timeoutMs: unknown): number {
  const numericValue = Number(timeoutMs);
  if (!Number.isFinite(numericValue) || numericValue <= 0) {
    return 0;
  }

  return Math.max(0, Math.round(numericValue));
}

export function sendRuntimeMessage<TAction extends RuntimeAction>(
  message: RuntimeMessageOf<TAction>,
  timeoutMs?: number,
  fallbackValue?: RuntimeResponseOf<TAction> | null,
): Promise<RuntimeResponseOf<TAction> | null>;
export function sendRuntimeMessage<TResponse = unknown>(
  message: RuntimeMessage | Record<string, unknown>,
  timeoutMs?: number,
  fallbackValue?: TResponse | null,
): Promise<TResponse | null>;
export function sendRuntimeMessage<TResponse = unknown>(
  message: RuntimeMessage | Record<string, unknown>,
  timeoutMs = 0,
  fallbackValue: TResponse | null = null,
): Promise<TResponse | null> {
  return new Promise((resolve) => {
    let settled = false;
    let timeoutId = 0;

    const finish = (value: TResponse | null) => {
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

        finish((response ?? fallbackValue) as TResponse | null);
      });
    } catch (_error) {
      finish(fallbackValue);
    }
  });
}

export function sendRuntimeMessageWithTimeout<TAction extends RuntimeAction>(
  message: RuntimeMessageOf<TAction>,
  timeoutMs?: number,
  fallbackValue?: RuntimeResponseOf<TAction> | null,
): Promise<RuntimeResponseOf<TAction> | null>;
export function sendRuntimeMessageWithTimeout<TResponse = unknown>(
  message: RuntimeMessage | Record<string, unknown>,
  timeoutMs?: number,
  fallbackValue?: TResponse | null,
): Promise<TResponse | null>;
export function sendRuntimeMessageWithTimeout<TResponse = unknown>(
  message: RuntimeMessage | Record<string, unknown>,
  timeoutMs = DEFAULT_RUNTIME_MESSAGE_TIMEOUT_MS,
  fallbackValue: TResponse | null = null,
): Promise<TResponse | null> {
  return sendRuntimeMessage(message, timeoutMs, fallbackValue);
}
