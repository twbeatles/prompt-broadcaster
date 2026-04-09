// @ts-nocheck
import {
  normalizeResultCode,
  normalizeSiteIdList,
  safeArray,
  safeText,
} from "../../shared/prompts";

function normalizeFavoriteId(value: unknown) {
  return safeText(value).trim();
}

function getLatestScheduledFavoriteRun(
  historyItems: Record<string, unknown>[] = [],
  favoriteId: string,
) {
  const normalizedFavoriteId = normalizeFavoriteId(favoriteId);
  if (!normalizedFavoriteId) {
    return null;
  }

  return safeArray(historyItems)
    .filter((entry) =>
      normalizeFavoriteId(entry?.originFavoriteId) === normalizedFavoriteId &&
      entry?.trigger === "scheduled"
    )
    .sort((left, right) => Date.parse(String(right?.createdAt ?? "")) - Date.parse(String(left?.createdAt ?? "")))[0] ?? null;
}

function getRepresentativeFailure(entry: Record<string, unknown>) {
  const siteResults = entry?.siteResults && typeof entry.siteResults === "object"
    ? Object.values(entry.siteResults as Record<string, { code?: string; message?: string }>)
    : [];
  const counts = new Map<string, number>();
  const messages = new Map<string, string>();

  siteResults.forEach((result) => {
    const code = normalizeResultCode(result?.code);
    if (code === "submitted") {
      return;
    }

    counts.set(code, (counts.get(code) ?? 0) + 1);

    const message = safeText(result?.message).trim();
    if (message && !messages.has(code)) {
      messages.set(code, message);
    }
  });

  if (counts.size === 0) {
    const fallbackCount = normalizeSiteIdList(entry?.failedSiteIds).length;
    if (fallbackCount <= 0 && entry?.status !== "failed" && entry?.status !== "partial") {
      return null;
    }

    return {
      code: "unexpected_error",
      count: Math.max(1, fallbackCount),
      message: "",
    };
  }

  const [code, count] = [...counts.entries()].sort((left, right) => right[1] - left[1])[0];
  return {
    code,
    count,
    message: messages.get(code) ?? "",
  };
}

export function buildScheduledFavoriteRunSummary(
  historyItems: Record<string, unknown>[] = [],
  favoriteId: string,
) {
  const latest = getLatestScheduledFavoriteRun(historyItems, favoriteId);
  if (!latest) {
    return null;
  }

  const representativeFailure = getRepresentativeFailure(latest);
  return {
    favoriteId: normalizeFavoriteId(favoriteId),
    createdAt: safeText(latest.createdAt),
    status: safeText(latest.status).trim() || "unknown",
    representativeCode: representativeFailure?.code ?? null,
    representativeMessage: representativeFailure?.message ?? "",
    representativeCount: representativeFailure?.count ?? 0,
  };
}
