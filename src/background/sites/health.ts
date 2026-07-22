import { getStoredPromptHistory } from "../../shared/prompts";
import { getFailedSelectors, getStrategyStats } from "../../shared/runtime-state";
import { getRuntimeSites } from "../../shared/sites";
import type { ServiceHealthGetResponse } from "../../shared/types/messages";
import type { ServiceHealthSnapshot } from "../../shared/types/models";

export async function handleServiceHealthGet(): Promise<ServiceHealthGetResponse> {
  const [sites, history, failedSelectors, strategyStats] = await Promise.all([
    getRuntimeSites(),
    getStoredPromptHistory(),
    getFailedSelectors(),
    getStrategyStats(),
  ]);
  const failedSelectorBySite = new Map(
    failedSelectors.map((entry) => [entry.serviceId, entry]),
  );

  const snapshots: ServiceHealthSnapshot[] = sites.map((site) => {
    let lastSuccessAt: string | null = null;
    let lastFailureAt: string | null = null;
    let lastFailureCode: ServiceHealthSnapshot["lastFailureCode"] = null;
    let successCount = 0;
    let failureCount = 0;

    for (const item of history) {
      const result = item.siteResults?.[site.id];
      if (!result && !item.requestedSiteIds?.includes(site.id)) {
        continue;
      }

      if (result?.code === "submitted" || item.submittedSiteIds?.includes(site.id)) {
        successCount += 1;
        if (!lastSuccessAt) {
          lastSuccessAt = item.createdAt;
        }
        continue;
      }

      failureCount += 1;
      if (!lastFailureAt) {
        lastFailureAt = item.createdAt;
        lastFailureCode = result?.code ?? "unexpected_error";
      }
    }

    const siteStrategyStats = strategyStats[site.id] ?? {};
    const preferredStrategy =
      Object.entries(siteStrategyStats)
        .sort(([, left], [, right]) =>
          (right.success - right.fail) - (left.success - left.fail),
        )[0]?.[0] ?? null;

    return {
      serviceId: site.id,
      serviceName: site.name,
      enabled: site.enabled,
      lastSuccessAt,
      lastFailureAt,
      lastFailureCode,
      selectorWarning: failedSelectorBySite.get(site.id) ?? null,
      preferredStrategy,
      successCount,
      failureCount,
      verification: {
        lastVerified: site.lastVerified,
        verifiedAt: site.verifiedAt,
        verifiedRoute: site.verifiedRoute,
        verifiedAuthState: site.verifiedAuthState,
        verifiedLocale: site.verifiedLocale,
        verifiedVersion: site.verifiedVersion,
      },
    };
  });

  return {
    ok: true,
    snapshots,
  };
}
