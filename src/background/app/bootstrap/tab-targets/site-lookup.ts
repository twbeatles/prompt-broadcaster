import type { RuntimeSite } from "../../../../shared/types/models";
import { getAllowedSiteHostnames } from "./site-origin";
import type { BackgroundTabTargetResolverDeps } from "./types";

export interface SiteLookupDeps
  extends Pick<BackgroundTabTargetResolverDeps, "getRuntimeSites"> {}

export function createSiteLookup(deps: SiteLookupDeps) {
  let runtimeSiteLookupCache: Map<string, RuntimeSite> | null = null;

  function cacheRuntimeSites(sites: RuntimeSite[]): Map<string, RuntimeSite> {
    runtimeSiteLookupCache = new Map(
      (Array.isArray(sites) ? sites : [])
        .filter((site) => typeof site?.id === "string" && site.id.trim())
        .map((site) => [site.id.trim(), site]),
    );
    return runtimeSiteLookupCache ?? new Map<string, RuntimeSite>();
  }

  async function getRuntimeSiteLookup(
    forceRefresh = false,
  ): Promise<Map<string, RuntimeSite>> {
    if (!runtimeSiteLookupCache || forceRefresh) {
      try {
        cacheRuntimeSites(await deps.getRuntimeSites());
      } catch (_error) {
        runtimeSiteLookupCache = new Map();
      }
    }

    return runtimeSiteLookupCache ?? new Map<string, RuntimeSite>();
  }

  async function getSiteById(siteId: string): Promise<RuntimeSite | null> {
    const siteLookup = await getRuntimeSiteLookup();
    return siteLookup.get(siteId) ?? null;
  }

  async function getSiteForUrl(urlString: string): Promise<RuntimeSite | null> {
    try {
      const url = new URL(urlString);
      const sites = [...(await getRuntimeSiteLookup()).values()];
      const normalizedHostname = url.hostname.toLowerCase();

      return (
        sites.find((site) => getAllowedSiteHostnames(site).has(normalizedHostname)) ??
        null
      );
    } catch (error) {
      console.error("[AI Prompt Broadcaster] Failed to resolve site for URL.", {
        urlString,
        error,
      });
      return null;
    }
  }

  return {
    cacheRuntimeSites,
    getRuntimeSiteLookup,
    getSiteById,
    getSiteForUrl,
  };
}
