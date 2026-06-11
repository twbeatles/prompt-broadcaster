import type { FavoriteExecutionTrigger } from "../../../shared/types/models";

export function getI18nMessage(key: string, substitutions?: string[]): string {
  return chrome.i18n.getMessage(key, substitutions) || "";
}

export function nowIso(): string {
  return new Date().toISOString();
}

export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, Number.isFinite(ms) ? ms : 0);
  });
}

export function clonePlainValue<T>(value: T): T {
  return value ? JSON.parse(JSON.stringify(value)) : value;
}

export function normalizePrompt(value: unknown): string {
  return typeof value === "string" ? value : "";
}

export function buildChainRunId(): string {
  return typeof crypto?.randomUUID === "function"
    ? crypto.randomUUID()
    : `chain-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

export function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

export function getBroadcastTriggerLabel(trigger: unknown): FavoriteExecutionTrigger {
  const normalized = typeof trigger === "string" ? trigger.trim() : "";
  return normalized === "scheduled"
    || normalized === "palette"
    || normalized === "options"
    ? normalized
    : "popup";
}
