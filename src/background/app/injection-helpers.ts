// @ts-nocheck
import { buildSiteInjectionResult, normalizeResultCode } from "../../shared/prompts";

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

function splitSelectorList(selectorGroup) {
  const source = typeof selectorGroup === "string" ? selectorGroup.trim() : "";
  if (!source) {
    return [];
  }

  const parts = [];
  let current = "";
  let bracketDepth = 0;
  let parenDepth = 0;
  let quote = null;
  let escaping = false;

  for (const character of source) {
    current += character;

    if (escaping) {
      escaping = false;
      continue;
    }

    if (character === "\\") {
      escaping = true;
      continue;
    }

    if (quote) {
      if (character === quote) {
        quote = null;
      }
      continue;
    }

    if (character === "'" || character === "\"") {
      quote = character;
      continue;
    }

    if (character === "[") {
      bracketDepth += 1;
      continue;
    }

    if (character === "]") {
      bracketDepth = Math.max(0, bracketDepth - 1);
      continue;
    }

    if (character === "(") {
      parenDepth += 1;
      continue;
    }

    if (character === ")") {
      parenDepth = Math.max(0, parenDepth - 1);
      continue;
    }

    if (character === "," && bracketDepth === 0 && parenDepth === 0) {
      current = current.slice(0, -1);
      const normalized = current.trim();
      if (normalized) {
        parts.push(normalized);
      }
      current = "";
    }
  }

  const trailing = current.trim();
  if (trailing) {
    parts.push(trailing);
  }

  return parts;
}

export function normalizeSelectorEntries(selectors = []) {
  return (Array.isArray(selectors) ? selectors : [])
    .filter((selector) => typeof selector === "string" && selector.trim())
    .flatMap((selector) => splitSelectorList(selector))
    .filter((selector, index, entries) => entries.indexOf(selector) === index);
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
