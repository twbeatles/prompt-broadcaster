import {
  getAllowedSiteHostnames,
  getSitePermissionPatterns,
  isInjectableTabUrl,
  isSameSiteOrigin,
} from "./site-origin";
import { createSiteLookup } from "./site-lookup";
import { createTabReuse } from "./tab-reuse";
import { createTargetResolution } from "./target-resolution";
import type {
  BackgroundTabTargetResolverDeps,
  PreferredInjectableNormalTabResult,
  ResolvedBroadcastTarget,
} from "./types";

export type {
  BackgroundTabTargetResolverDeps,
  PreferredInjectableNormalTabResult,
  ResolvedBroadcastTarget,
} from "./types";

export function createBackgroundTabTargetResolver(
  deps: BackgroundTabTargetResolverDeps,
) {
  const lookup = createSiteLookup(deps);
  const resolution = createTargetResolution({
    ...deps,
    cacheRuntimeSites: lookup.cacheRuntimeSites,
  });
  const reuse = createTabReuse({
    ...deps,
    buildSelectedTabUnavailableMessage:
      resolution.buildSelectedTabUnavailableMessage,
  });

  return {
    getSiteById: lookup.getSiteById,
    getSiteForUrl: lookup.getSiteForUrl,
    resolveSelectedTargets: resolution.resolveSelectedTargets,
    buildSelectedTabUnavailableMessage:
      resolution.buildSelectedTabUnavailableMessage,
    isInjectableTabUrl,
    getAllowedSiteHostnames,
    getSitePermissionPatterns,
    isSameSiteOrigin,
    isReusableTabForSite: reuse.isReusableTabForSite,
    isCustomSitePermissionGranted: reuse.isCustomSitePermissionGranted,
    findReusableTabsForSites: reuse.findReusableTabsForSites,
    getExplicitReusableTabForTarget: reuse.getExplicitReusableTabForTarget,
    getPreferredInjectableNormalTab: reuse.getPreferredInjectableNormalTab,
  };
}
