// @ts-nocheck
import { buildSiteInjectionResult, normalizeResultCode } from "../../shared/prompts";
import { normalizeSelectorEntries } from "../../shared/sites";

export { normalizeSelectorEntries };

export function scaleTimeout(value, multiplier = 1) {
  const numericValue = Number(value);
  const numericMultiplier = Number(multiplier);
  if (!Number.isFinite(numericValue)) {
    return 0;
  }

  if (!Number.isFinite(numericMultiplier) || numericMultiplier <= 0) {
    return Math.max(0, Math.round(numericValue));
  }

  return Math.max(0, Math.round(numericValue * numericMultiplier));
}

export function buildSiteResult(code, overrides = {}) {
  return buildSiteInjectionResult(code, overrides);
}

export function getSiteResultCode(result) {
  return normalizeResultCode(result?.code ?? result);
}

function getStrategySortScore(counter) {
  const success = Number(counter?.success) || 0;
  const fail = Number(counter?.fail) || 0;
  const total = success + fail;
  const hitRate = total > 0 ? success / total : -1;
  return {
    total,
    hitRate,
    success,
    fail,
  };
}

export function buildPreferredStrategyOrder(siteId, strategyStats) {
  const siteStats = strategyStats?.[siteId] ?? {};
  const knownStrategies = [
    "lexicalEditorState",
    "execCommand",
    "directContenteditable",
    "paste",
    "nativeSetter",
  ];

  return [...knownStrategies].sort((left, right) => {
    const leftScore = getStrategySortScore(siteStats[left]);
    const rightScore = getStrategySortScore(siteStats[right]);

    if (leftScore.hitRate !== rightScore.hitRate) {
      return rightScore.hitRate - leftScore.hitRate;
    }

    if (leftScore.success !== rightScore.success) {
      return rightScore.success - leftScore.success;
    }

    if (leftScore.fail !== rightScore.fail) {
      return rightScore.fail - leftScore.fail;
    }

    return knownStrategies.indexOf(left) - knownStrategies.indexOf(right);
  });
}

export function buildInjectionConfig(site, runtimeOverrides = {}) {
  return {
    id: site?.id ?? "",
    name: site?.name ?? "",
    url: site?.url ?? "",
    hostname: site?.hostname ?? "",
    hostnameAliases: Array.isArray(site?.hostnameAliases) ? site.hostnameAliases : [],
    inputSelector: site?.inputSelector ?? "",
    fallbackSelectors: Array.isArray(site?.fallbackSelectors) ? site.fallbackSelectors : [],
    inputType: site?.inputType ?? "textarea",
    submitSelector: site?.submitSelector ?? "",
    submitMethod: site?.submitMethod ?? "enter",
    selectorCheckMode: site?.selectorCheckMode ?? "input-and-submit",
    waitMs: Number.isFinite(site?.waitMs) ? site.waitMs : 0,
    fallback: site?.fallback !== false,
    authSelectors: Array.isArray(site?.authSelectors) ? site.authSelectors : [],
    lastVerified: site?.lastVerified ?? "",
    verifiedAt: site?.verifiedAt ?? "",
    verifiedRoute: site?.verifiedRoute ?? "",
    verifiedAuthState: site?.verifiedAuthState ?? "",
    verifiedLocale: site?.verifiedLocale ?? "",
    verifiedVersion: site?.verifiedVersion ?? "",
    isCustom: Boolean(site?.isCustom),
    permissionPatterns: Array.isArray(site?.permissionPatterns) ? site.permissionPatterns : [],
    submitTimeoutMs: Number.isFinite(Number(runtimeOverrides?.submitTimeoutMs))
      ? Number(runtimeOverrides.submitTimeoutMs)
      : undefined,
    submitRetryCount: Number.isFinite(Number(runtimeOverrides?.submitRetryCount))
      ? Number(runtimeOverrides.submitRetryCount)
      : undefined,
    strategyOrder: Array.isArray(runtimeOverrides?.strategyOrder)
      ? runtimeOverrides.strategyOrder
      : [],
    waitMsMultiplier: Number.isFinite(Number(runtimeOverrides?.waitMsMultiplier))
      ? Number(runtimeOverrides.waitMsMultiplier)
      : undefined,
  };
}
