import {
  buildSiteInjectionResult,
  normalizeResultCode,
} from "../../shared/prompts";
import { normalizeSelectorEntries } from "../../shared/sites";
import type {
  RuntimeInjectionSiteConfig,
  SiteInjectionResult,
  StrategyStats,
} from "../../shared/types/models";

export { normalizeSelectorEntries };

type StrategyCounter = {
  success?: number;
  fail?: number;
} | undefined;

export function scaleTimeout(value: unknown, multiplier = 1): number {
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

export function buildSiteResult(
  code: unknown,
  overrides: Partial<SiteInjectionResult> = {},
): SiteInjectionResult {
  return buildSiteInjectionResult(code, overrides);
}

export function getSiteResultCode(result: unknown) {
  const source = result as Partial<SiteInjectionResult> | string | null | undefined;
  return normalizeResultCode(
    typeof source === "string" ? source : source?.code ?? source,
  );
}

function getStrategySortScore(counter: StrategyCounter): {
  total: number;
  hitRate: number;
  success: number;
  fail: number;
} {
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

export function buildPreferredStrategyOrder(
  siteId: string,
  strategyStats: StrategyStats,
): string[] {
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

export function buildInjectionConfig(
  site: Partial<RuntimeInjectionSiteConfig> | null | undefined,
  runtimeOverrides: Partial<RuntimeInjectionSiteConfig> = {},
): RuntimeInjectionSiteConfig {
  const verifiedAuthState = site?.verifiedAuthState || undefined;

  return {
    id: site?.id ?? "",
    name: site?.name ?? "",
    url: site?.url ?? "",
    hostname: site?.hostname ?? "",
    hostnameAliases: Array.isArray(site?.hostnameAliases) ? site.hostnameAliases : [],
    supportedRoutes: Array.isArray(site?.supportedRoutes) ? site.supportedRoutes : [],
    inputSelector: site?.inputSelector ?? "",
    fallbackSelectors: Array.isArray(site?.fallbackSelectors) ? site.fallbackSelectors : [],
    inputType: site?.inputType ?? "textarea",
    submitSelector: site?.submitSelector ?? "",
    submitMethod: site?.submitMethod ?? "enter",
    selectorCheckMode: site?.selectorCheckMode ?? "input-and-submit",
    waitMs: Number.isFinite(Number(site?.waitMs)) ? Number(site?.waitMs) : 0,
    fallback: site?.fallback !== false,
    authSelectors: Array.isArray(site?.authSelectors) ? site.authSelectors : [],
    lastVerified: site?.lastVerified ?? "",
    verifiedAt: site?.verifiedAt ?? "",
    verifiedRoute: site?.verifiedRoute ?? "",
    verifiedAuthState,
    verifiedLocale: site?.verifiedLocale ?? "",
    verifiedVersion: site?.verifiedVersion ?? "",
    enabled: site?.enabled ?? true,
    color: site?.color ?? "",
    icon: site?.icon ?? "",
    isBuiltIn: Boolean(site?.isBuiltIn),
    isCustom: Boolean(site?.isCustom),
    deletable: Boolean(site?.deletable),
    editable: Boolean(site?.editable),
    permissionPatterns: Array.isArray(site?.permissionPatterns)
      ? site.permissionPatterns
      : [],
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
