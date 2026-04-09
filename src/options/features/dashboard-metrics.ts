import { getLocalDateKey, getRelativeLocalDateKey } from "../../shared/date-utils";
import { normalizeResultCode } from "../../shared/prompts";
import type { StrategyStats } from "../../shared/types/models";

function isDefined<T>(value: T | null | undefined): value is T {
  return value !== null && value !== undefined;
}

function normalizeSiteIds(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return Array.from(
    new Set(
      value
        .filter((entry) => typeof entry === "string" && entry.trim())
        .map((entry) => entry.trim())
    )
  );
}

function getRequestedSiteIds(entry: Record<string, unknown>): string[] {
  const requestedSiteIds = normalizeSiteIds(entry?.requestedSiteIds);
  if (requestedSiteIds.length > 0) {
    return requestedSiteIds;
  }

  const siteResultKeys = normalizeSiteIds(Object.keys((entry?.siteResults ?? {}) as Record<string, unknown>));
  if (siteResultKeys.length > 0) {
    return siteResultKeys;
  }

  return normalizeSiteIds(entry?.sentTo);
}

function getSubmittedSiteIds(entry: Record<string, unknown>): string[] {
  const submittedSiteIds = normalizeSiteIds(entry?.submittedSiteIds);
  if (submittedSiteIds.length > 0) {
    return submittedSiteIds;
  }

  return normalizeSiteIds(entry?.sentTo);
}

function getSiteLabel(siteId: string, runtimeSites: Array<{ id?: string; name?: string }> = []) {
  return runtimeSites.find((site) => site?.id === siteId)?.name ?? siteId;
}

function getStartOfCurrentWeek(now = new Date()) {
  const result = new Date(now);
  const offset = (result.getDay() + 6) % 7;
  result.setHours(0, 0, 0, 0);
  result.setDate(result.getDate() - offset);
  return result;
}

function createHeatmapRows() {
  return Array.from({ length: 7 }, (_, dayIndex) => ({
    dayIndex,
    counts: Array.from({ length: 24 }, () => 0),
    total: 0,
  }));
}

function getHeatmapDayIndex(date: Date) {
  return (date.getDay() + 6) % 7;
}

export function buildDashboardMetrics(
  historyItems: Record<string, unknown>[] = [],
  runtimeSites: Array<{ id?: string; name?: string }> = [],
  strategyStats: StrategyStats = {},
  now = new Date()
) {
  const history = Array.isArray(historyItems) ? historyItems : [];
  const serviceCounts = new Map<string, number>();
  const serviceSuccessCounts = new Map<string, number>();
  const dailyKeys = Array.from({ length: 7 }, (_, index) => getRelativeLocalDateKey(index - 6, now));
  const dailyCounts = dailyKeys.map((dateKey) => ({ key: dateKey, count: 0 }));
  const heatmapRows = createHeatmapRows();
  const failureReasonCounts = new Map<string, number>();
  let totalPromptLength = 0;

  history.forEach((entry) => {
    const requestedSiteIds = getRequestedSiteIds(entry);
    const submittedSiteIds = new Set(getSubmittedSiteIds(entry));
    const siteResults = entry?.siteResults && typeof entry.siteResults === "object"
      ? (entry.siteResults as Record<string, { code?: string }>)
      : {};
    const createdAt = new Date(String(entry?.createdAt ?? ""));
    const localDateKey = getLocalDateKey(createdAt);

    totalPromptLength += String(entry?.text ?? "").length;

    requestedSiteIds.forEach((siteId) => {
      serviceCounts.set(siteId, (serviceCounts.get(siteId) ?? 0) + 1);
      if (submittedSiteIds.has(siteId)) {
        serviceSuccessCounts.set(siteId, (serviceSuccessCounts.get(siteId) ?? 0) + 1);
      }
    });

    if (localDateKey) {
      const dailyEntry = dailyCounts.find((item) => item.key === localDateKey);
      if (dailyEntry) {
        dailyEntry.count += 1;
      }
    }

    if (Number.isFinite(createdAt.getTime())) {
      const dayIndex = getHeatmapDayIndex(createdAt);
      const hour = createdAt.getHours();
      heatmapRows[dayIndex].counts[hour] += 1;
      heatmapRows[dayIndex].total += 1;
    }

    const failedSiteIds = normalizeSiteIds(entry?.failedSiteIds);
    const siteResultValues = Object.values(siteResults);
    if (siteResultValues.length === 0 && failedSiteIds.length > 0) {
      failedSiteIds.forEach(() => {
        failureReasonCounts.set("unexpected_error", (failureReasonCounts.get("unexpected_error") ?? 0) + 1);
      });
    } else {
      siteResultValues.forEach((result) => {
        const code = normalizeResultCode(result?.code);
        if (code === "submitted") {
          return;
        }

        failureReasonCounts.set(code, (failureReasonCounts.get(code) ?? 0) + 1);
      });
    }
  });

  const mostUsed = [...serviceCounts.entries()].sort((left, right) => right[1] - left[1])[0];
  const weekStart = getStartOfCurrentWeek(now);
  const weekCount = history.filter((entry) => new Date(String(entry?.createdAt ?? "")).getTime() >= weekStart.getTime()).length;
  const averagePromptLength = history.length > 0 ? Math.round(totalPromptLength / history.length) : 0;
  const donutItems = [...serviceCounts.entries()]
    .sort((left, right) => right[1] - left[1])
    .map(([siteId, count]) => ({
      id: siteId,
      label: getSiteLabel(siteId, runtimeSites),
      count,
    }));
  const heatmapMax = Math.max(...heatmapRows.flatMap((row) => row.counts), 0);

  const serviceTrendItems = [...serviceCounts.entries()]
    .sort((left, right) => right[1] - left[1])
    .slice(0, 5)
    .map(([siteId, requestCount]) => {
      const dailySeries = dailyKeys.map((key) => ({
        key,
        requests: 0,
        successes: 0,
        successRate: 0,
      }));

      history.forEach((entry) => {
        const requestedSiteIds = getRequestedSiteIds(entry);
        if (!requestedSiteIds.includes(siteId)) {
          return;
        }

        const dailyPoint = dailySeries.find((item) => item.key === getLocalDateKey(String(entry?.createdAt ?? "")));
        if (!dailyPoint) {
          return;
        }

        dailyPoint.requests += 1;
        if (getSubmittedSiteIds(entry).includes(siteId)) {
          dailyPoint.successes += 1;
        }
      });

      dailySeries.forEach((point) => {
        point.successRate = point.requests > 0 ? Math.round((point.successes / point.requests) * 100) : 0;
      });

      const successCount = serviceSuccessCounts.get(siteId) ?? 0;
      return {
        id: siteId,
        label: getSiteLabel(siteId, runtimeSites),
        requestCount,
        successCount,
        successRate: requestCount > 0 ? Math.round((successCount / requestCount) * 100) : 0,
        dailySeries,
      };
    });

  const failureReasonItems = [...failureReasonCounts.entries()]
    .sort((left, right) => right[1] - left[1])
    .map(([code, count]) => ({ code, count }));

  const strategySummaryItems = Object.entries(strategyStats ?? {})
    .map(([siteId, siteStats]) => {
      const strategies = Object.entries(siteStats ?? {})
        .map(([strategyName, counts]) => {
          const success = Math.max(0, Math.round(Number(counts?.success) || 0));
          const fail = Math.max(0, Math.round(Number(counts?.fail) || 0));
          const attempts = success + fail;
          return {
            strategyName,
            success,
            fail,
            attempts,
            successRate: attempts > 0 ? Math.round((success / attempts) * 100) : 0,
          };
        })
        .filter((strategy) => strategy.attempts > 0)
        .sort((left, right) => {
          if (right.successRate !== left.successRate) {
            return right.successRate - left.successRate;
          }

          return right.attempts - left.attempts;
        });

      const totalAttempts = strategies.reduce((sum, strategy) => sum + strategy.attempts, 0);
      if (totalAttempts <= 0) {
        return null;
      }

      return {
        siteId,
        label: getSiteLabel(siteId, runtimeSites),
        totalAttempts,
        bestStrategy: strategies[0]?.strategyName ?? "",
        bestSuccessRate: strategies[0]?.successRate ?? 0,
      };
    })
    .filter(isDefined)
    .sort((left, right) => right.totalAttempts - left.totalAttempts);

  return {
    totalTransmissions: history.length,
    mostUsedService: mostUsed ? getSiteLabel(mostUsed[0], runtimeSites) : "-",
    weekCount,
    averagePromptLength,
    donutItems,
    dailyCounts,
    heatmap: {
      rows: heatmapRows,
      maxCount: heatmapMax,
    },
    serviceTrendItems,
    failureReasonItems,
    strategySummaryItems,
  };
}
