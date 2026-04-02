import { LOCAL_RUNTIME_KEYS } from "./constants";
import { readStorage, writeStorage } from "./storage";
import { safeObject } from "../prompts";
import type { InjectionStrategyAttempt, StrategyStats } from "../types/models";

function normalizeCounterValue(value: unknown) {
  return Math.max(0, Math.round(Number(value) || 0));
}

function normalizeStrategyStats(value: unknown): StrategyStats {
  const root = safeObject(value);
  return Object.fromEntries(
    Object.entries(root).map(([siteId, siteValue]) => {
      const siteStats = safeObject(siteValue);
      const normalizedSiteStats = Object.fromEntries(
        Object.entries(siteStats)
          .map(([strategyName, counts]) => {
            const normalizedCounts = safeObject(counts);
            return [
              String(strategyName).trim(),
              {
                success: normalizeCounterValue(normalizedCounts.success),
                fail: normalizeCounterValue(normalizedCounts.fail),
              },
            ];
          })
          .filter(([strategyName]) => strategyName)
      );

      return [String(siteId).trim(), normalizedSiteStats];
    }).filter(([siteId]) => siteId)
  );
}

export async function getStrategyStats(): Promise<StrategyStats> {
  const rawValue = await readStorage("local", LOCAL_RUNTIME_KEYS.strategyStats, {});
  return normalizeStrategyStats(rawValue);
}

export async function setStrategyStats(value: unknown): Promise<StrategyStats> {
  const normalized = normalizeStrategyStats(value);
  await writeStorage("local", LOCAL_RUNTIME_KEYS.strategyStats, normalized);
  return normalized;
}

export async function recordStrategyAttempts(
  siteId: string,
  attempts: InjectionStrategyAttempt[] | null | undefined
): Promise<StrategyStats> {
  const normalizedSiteId = typeof siteId === "string" ? siteId.trim() : "";
  if (!normalizedSiteId || !Array.isArray(attempts) || attempts.length === 0) {
    return getStrategyStats();
  }

  const current = await getStrategyStats();
  const siteStats = { ...(current[normalizedSiteId] ?? {}) };

  attempts.forEach((attempt) => {
    const name = typeof attempt?.name === "string" ? attempt.name.trim() : "";
    if (!name) {
      return;
    }

    const currentCounts = siteStats[name] ?? { success: 0, fail: 0 };
    siteStats[name] = {
      success: currentCounts.success + (attempt.success ? 1 : 0),
      fail: currentCounts.fail + (attempt.success ? 0 : 1),
    };
  });

  const nextStats = {
    ...current,
    [normalizedSiteId]: siteStats,
  };

  await setStrategyStats(nextStats);
  return nextStats;
}
