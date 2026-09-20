import type { BroadcastSiteTargetMessage } from "../../../../shared/types/messages";
import type { RuntimeSite } from "../../../../shared/types/models";
import { buildInjectionConfig } from "../../injection-helpers";
import { normalizeTargetTabId } from "./site-origin";
import type {
  BackgroundTabTargetResolverDeps,
  ResolvedBroadcastTarget,
} from "./types";

export interface TargetResolutionDeps
  extends Pick<BackgroundTabTargetResolverDeps, "getI18nMessage" | "getRuntimeSites"> {
  cacheRuntimeSites: (sites: RuntimeSite[]) => Map<string, RuntimeSite>;
}

export function createTargetResolution(deps: TargetResolutionDeps) {
  function buildSelectedTabUnavailableMessage(
    siteName: string,
    tabId: number | null,
  ): string {
    const label = siteName || "AI service";
    if (Number.isFinite(Number(tabId))) {
      return (
        deps.getI18nMessage("toast_selected_tab_unavailable", [
          label,
          String(tabId),
        ]) || `${label} selected tab #${String(tabId)} is unavailable.`
      );
    }

    return (
      deps.getI18nMessage("toast_selected_tab_unavailable", [label]) ||
      `${label} selected tab is unavailable.`
    );
  }

  async function resolveSelectedTargets(
    siteRefs: Array<string | BroadcastSiteTargetMessage>,
  ): Promise<ResolvedBroadcastTarget[]> {
    const runtimeSites = await deps.getRuntimeSites();
    deps.cacheRuntimeSites(runtimeSites);
    const resolvedTargets: ResolvedBroadcastTarget[] = [];
    const seenIds = new Set<string>();

    for (const siteRef of Array.isArray(siteRefs) ? siteRefs : []) {
      let resolvedSite = null;
      let targetTabId = null;
      let requireExplicitTab = false;
      let forceNewTab = false;
      let promptOverride: string | undefined;
      let resolvedPrompt: string | undefined;

      if (typeof siteRef === "string") {
        resolvedSite =
          runtimeSites.find((site) => site.id === siteRef) ?? null;
      } else if (siteRef && typeof siteRef === "object") {
        if (typeof siteRef.id === "string") {
          resolvedSite =
            runtimeSites.find((site) => site.id === siteRef.id) ??
            buildInjectionConfig(siteRef);
        } else {
          resolvedSite = buildInjectionConfig(siteRef);
        }

        targetTabId = normalizeTargetTabId(siteRef.tabId);
        requireExplicitTab = siteRef.target === "tab" || targetTabId !== null;
        forceNewTab =
          siteRef.reuseExistingTab === false ||
          siteRef.openInNewTab === true ||
          siteRef.target === "new";
        promptOverride =
          typeof siteRef.promptOverride === "string" && siteRef.promptOverride.trim()
            ? siteRef.promptOverride.trim()
            : undefined;
        resolvedPrompt =
          typeof siteRef.resolvedPrompt === "string"
            ? siteRef.resolvedPrompt
            : undefined;
      }

      if (!resolvedSite || !resolvedSite.id || seenIds.has(resolvedSite.id)) {
        continue;
      }

      seenIds.add(resolvedSite.id);
      resolvedTargets.push({
        site: buildInjectionConfig(resolvedSite),
        targetTabId,
        requireExplicitTab,
        forceNewTab,
        promptOverride,
        resolvedPrompt,
      });
    }

    return resolvedTargets;
  }

  return {
    buildSelectedTabUnavailableMessage,
    resolveSelectedTargets,
  };
}
