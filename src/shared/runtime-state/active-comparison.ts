import { SESSION_RUNTIME_KEYS } from "./constants";
import { readStorage, removeStorageKeys, writeStorage } from "./storage";
import type { ActiveComparisonContext } from "../types/models";

const ACTIVE_COMPARISON_CONTEXT_TTL_MS = 30 * 60 * 1000;

function normalizeActiveComparisonContext(
  value: unknown,
): ActiveComparisonContext | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }

  const source = value as Record<string, unknown>;
  const historyId = Math.max(0, Math.round(Number(source.historyId)));
  const serviceId =
    typeof source.serviceId === "string" && source.serviceId.trim()
      ? source.serviceId.trim()
      : "";
  const updatedAt =
    typeof source.updatedAt === "string" && Number.isFinite(Date.parse(source.updatedAt))
      ? new Date(source.updatedAt).toISOString()
      : new Date().toISOString();

  if (!historyId || !serviceId) {
    return null;
  }

  return {
    historyId,
    serviceId,
    source: "options-modal",
    updatedAt,
  };
}

function isExpired(context: ActiveComparisonContext): boolean {
  const updatedAt = Date.parse(context.updatedAt);
  return !Number.isFinite(updatedAt) || Date.now() - updatedAt > ACTIVE_COMPARISON_CONTEXT_TTL_MS;
}

export async function getActiveComparisonContext(): Promise<ActiveComparisonContext | null> {
  const value = await readStorage("session", SESSION_RUNTIME_KEYS.activeComparisonContext, null);
  const context = normalizeActiveComparisonContext(value);
  if (!context || isExpired(context)) {
    await setActiveComparisonContext(null);
    return null;
  }

  return context;
}

export async function setActiveComparisonContext(
  context: Partial<ActiveComparisonContext> | null,
): Promise<ActiveComparisonContext | null> {
  const normalized = normalizeActiveComparisonContext(
    context
      ? {
          ...context,
          source: "options-modal",
          updatedAt: new Date().toISOString(),
        }
      : null,
  );

  if (!normalized) {
    await removeStorageKeys("session", [SESSION_RUNTIME_KEYS.activeComparisonContext]);
    return null;
  }

  await writeStorage("session", SESSION_RUNTIME_KEYS.activeComparisonContext, normalized);
  return normalized;
}
