import type { RuntimeSite } from "../../../../shared/types/models";

export function isInjectableTabUrl(urlString: string): boolean {
  try {
    const url = new URL(urlString);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch (_error) {
    return false;
  }
}

export function getAllowedSiteHostnames(
  site: Partial<RuntimeSite> | null | undefined,
): Set<string> {
  const siteUrl = typeof site?.url === "string" ? site.url : "";
  return new Set(
    [
      site?.hostname,
      ...(Array.isArray(site?.hostnameAliases) ? site.hostnameAliases : []),
      isInjectableTabUrl(siteUrl) ? new URL(siteUrl).hostname : "",
    ]
      .filter(
        (entry): entry is string =>
          typeof entry === "string" && entry.trim().length > 0,
      )
      .map((entry) => entry.trim().toLowerCase()),
  );
}

export function getSitePermissionPatterns(
  site: Partial<RuntimeSite> | null | undefined,
): string[] {
  return Array.isArray(site?.permissionPatterns)
    ? site.permissionPatterns.filter(
        (pattern) => typeof pattern === "string" && pattern.trim(),
      )
    : [];
}

export function isSameSiteOrigin(tabUrl: string, site: RuntimeSite): boolean {
  try {
    const hostname = new URL(tabUrl).hostname.toLowerCase();
    return getAllowedSiteHostnames(site).has(hostname);
  } catch (error) {
    console.error("[AI Prompt Broadcaster] Failed to compare site origin.", {
      tabUrl,
      site,
      error,
    });
    return false;
  }
}

export function normalizeTargetTabId(value: unknown): number | null {
  const numericValue = Number(value);
  return Number.isFinite(numericValue) ? numericValue : null;
}

export function scoreReusableTabForSite(tab: chrome.tabs.Tab, site: RuntimeSite): number {
  const tabUrl = typeof tab?.url === "string" ? tab.url : "";
  const siteUrl = typeof site?.url === "string" ? site.url : "";
  const exactUrlMatch = Boolean(siteUrl && tabUrl.startsWith(siteUrl));
  const activePenalty = tab?.active ? 10 : 0;
  return (exactUrlMatch ? 0 : 5) + activePenalty;
}
