import {
  buildSubmitRequirement,
  shouldRequireVisibleSubmitSurface,
} from "../../../../shared/sites";
import { evaluateReusableTabSnapshot } from "../../../../shared/sites/reuse-preflight";
import type { BroadcastSiteTargetMessage } from "../../../../shared/types/messages";
import type {
  PendingInjectionRecord,
  ReusableTabSurfaceSnapshot,
  RuntimeSite,
} from "../../../../shared/types/models";
import {
  buildInjectionConfig,
  normalizeSelectorEntries,
} from "../../injection-helpers";
import type {
  BackgroundTabTargetResolverDeps,
  PreferredInjectableNormalTabResult,
  ResolvedBroadcastTarget,
} from "./types";
import {
  getAllowedSiteHostnames,
  getSitePermissionPatterns,
  isInjectableTabUrl,
  isSameSiteOrigin,
  normalizeTargetTabId,
  scoreReusableTabForSite,
} from "./site-origin";

export type {
  BackgroundTabTargetResolverDeps,
  PreferredInjectableNormalTabResult,
  ResolvedBroadcastTarget,
} from "./types";

export function createBackgroundTabTargetResolver(
  deps: BackgroundTabTargetResolverDeps,
) {
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

  async function resolveSelectedTargets(
    siteRefs: Array<string | BroadcastSiteTargetMessage>,
  ): Promise<ResolvedBroadcastTarget[]> {
    const runtimeSites = await deps.getRuntimeSites();
    cacheRuntimeSites(runtimeSites);
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

  async function runReusableTabPreflight(
    tabId: number,
    site: RuntimeSite,
  ): Promise<boolean> {
    try {
      const inputSelectors = normalizeSelectorEntries([
        site?.inputSelector,
        ...(Array.isArray(site?.fallbackSelectors) ? site.fallbackSelectors : []),
      ]);
      const authSelectors = normalizeSelectorEntries(site?.authSelectors);
      const submitRequirement = buildSubmitRequirement(site);
      const submitSelectors = shouldRequireVisibleSubmitSurface(submitRequirement)
        ? normalizeSelectorEntries([site?.submitSelector])
        : [];

      const [result] = await chrome.scripting.executeScript({
        target: { tabId },
        func: ({ nextInputSelectors, nextAuthSelectors, nextSubmitSelectors }) => {
          function isElementVisible(element: Element): boolean {
            if (
              !(element instanceof HTMLElement) &&
              !(element instanceof SVGElement)
            ) {
              return true;
            }

            const style = window.getComputedStyle(element);
            if (
              (element instanceof HTMLElement && element.hidden) ||
              element.getAttribute("hidden") !== null ||
              element.getAttribute("aria-hidden") === "true" ||
              style.display === "none" ||
              style.visibility === "hidden" ||
              style.visibility === "collapse"
            ) {
              return false;
            }

            return element.getClientRects().length > 0;
          }

          function isEditableElement(element: Element): boolean {
            if (
              element instanceof HTMLTextAreaElement ||
              element instanceof HTMLInputElement
            ) {
              return !element.readOnly;
            }

            return element instanceof HTMLElement
              ? element.isContentEditable
              : false;
          }

          function collectElementsDeep(
            selector: string,
            root: Document | ShadowRoot,
            matches: Element[],
            seen: Set<Element>,
          ): void {
            if (typeof root.querySelectorAll === "function") {
              for (const element of Array.from(root.querySelectorAll(selector))) {
                if (!seen.has(element)) {
                  seen.add(element);
                  matches.push(element);
                }
              }
            }

            const walker = document.createTreeWalker(root, NodeFilter.SHOW_ELEMENT);
            let current: Node | null = walker.currentNode;
            while (current) {
              if (current instanceof Element && current.shadowRoot) {
                collectElementsDeep(selector, current.shadowRoot, matches, seen);
              }
              current = walker.nextNode();
            }
          }

          function findDeep(
            selectors: string[],
            { editableOnly = false }: { editableOnly?: boolean } = {},
          ): boolean {
            for (const selector of selectors) {
              try {
                const matches: Element[] = [];
                collectElementsDeep(selector, document, matches, new Set());
                const match = matches.find(
                  (element) =>
                    isElementVisible(element) &&
                    (!editableOnly || isEditableElement(element)),
                );
                if (match) {
                  return true;
                }
              } catch (_error) {
                // Ignore invalid or stale selectors during lightweight preflight.
              }
            }

            return false;
          }

          return {
            pathname: window.location.pathname,
            hasPromptSurface: findDeep(nextInputSelectors, { editableOnly: true }),
            hasAuthSurface: findDeep(nextAuthSelectors),
            hasSubmitSurface:
              nextSubmitSelectors.length === 0
                ? true
                : findDeep(nextSubmitSelectors),
          };
        },
        args: [
          {
            nextInputSelectors: inputSelectors,
            nextAuthSelectors: authSelectors,
            nextSubmitSelectors: submitSelectors,
          },
        ],
      });

      const snapshot = (result?.result ?? {}) as ReusableTabSurfaceSnapshot;
      return evaluateReusableTabSnapshot({
        pathname: snapshot.pathname,
        supportedRoutes: Array.isArray(site?.supportedRoutes)
          ? site.supportedRoutes
          : [],
        hasPromptSurface: snapshot.hasPromptSurface,
        hasAuthSurface: snapshot.hasAuthSurface,
        hasSubmitSurface: snapshot.hasSubmitSurface,
        submitRequirement,
      }).ok === true;
    } catch (_error) {
      return false;
    }
  }

  async function isReusableTabForSite(
    tab: chrome.tabs.Tab,
    site: RuntimeSite,
  ): Promise<boolean> {
    const tabId = tab.id;
    const tabUrl = typeof tab.url === "string" ? tab.url : "";
    if (typeof tabId !== "number" || !isInjectableTabUrl(tabUrl)) {
      return false;
    }

    if (!isSameSiteOrigin(tabUrl, site)) {
      return false;
    }

    return runReusableTabPreflight(tabId, site);
  }

  async function isCustomSitePermissionGranted(
    site: RuntimeSite,
  ): Promise<boolean> {
    const permissionPatterns = getSitePermissionPatterns(site);
    if (!site?.isCustom || permissionPatterns.length === 0) {
      return true;
    }

    try {
      return await chrome.permissions.contains({
        origins: permissionPatterns,
      });
    } catch (error) {
      console.error(
        "[AI Prompt Broadcaster] Failed to check custom site permission.",
        {
          siteId: site?.id,
          error,
        },
      );
      return false;
    }
  }

  async function findReusableTabsForSites(
    sites: RuntimeSite[],
    options: { windowId?: number | null; excludeTabId?: number | null } = {},
  ): Promise<Map<string, chrome.tabs.Tab>> {
    const windowId = Number(options?.windowId);
    if (!Number.isFinite(windowId)) {
      return new Map();
    }

    try {
      const [tabs, pendingInjections] = await Promise.all([
        chrome.tabs.query({ windowId }),
        deps.getPendingInjections(),
      ]);

      const excludedTabIds = new Set(
        Object.keys(pendingInjections)
          .map((tabId) => Number(tabId))
          .filter((tabId) => Number.isFinite(tabId)),
      );

      if (Number.isFinite(Number(options?.excludeTabId))) {
        excludedTabIds.add(Number(options.excludeTabId));
      }

      const reusableTabsBySiteId = new Map<string, chrome.tabs.Tab>();
      const usedTabIds = new Set<number>();

      for (const site of Array.isArray(sites) ? sites : []) {
        const candidates = tabs
          .filter((tab) => {
            const candidateId = tab.id;
            const candidateUrl = typeof tab.url === "string" ? tab.url : "";
            if (
              typeof candidateId !== "number" ||
              usedTabIds.has(candidateId) ||
              excludedTabIds.has(candidateId)
            ) {
              return false;
            }

            if (!isInjectableTabUrl(candidateUrl)) {
              return false;
            }

            return isSameSiteOrigin(candidateUrl, site);
          })
          .sort(
            (left, right) =>
              scoreReusableTabForSite(left, site) -
              scoreReusableTabForSite(right, site),
          );

        for (const candidate of candidates) {
          if (!(await isReusableTabForSite(candidate, site))) {
            continue;
          }

          reusableTabsBySiteId.set(site.id, candidate);
          if (typeof candidate.id === "number") {
            usedTabIds.add(candidate.id);
          }
          break;
        }
      }

      return reusableTabsBySiteId;
    } catch (error) {
      console.error("[AI Prompt Broadcaster] Failed to discover reusable AI tabs.", {
        windowId,
        error,
      });
      return new Map();
    }
  }

  async function getExplicitReusableTabForTarget(
    target: ResolvedBroadcastTarget,
  ): Promise<{
    requested: boolean;
    tab: chrome.tabs.Tab | null;
    message?: string;
  }> {
    if (!target?.requireExplicitTab) {
      return {
        requested: false,
        tab: null,
      };
    }

    const targetTabId = Number(target?.targetTabId);
    if (!Number.isFinite(targetTabId)) {
      return {
        requested: true,
        tab: null,
        message: buildSelectedTabUnavailableMessage(target.site?.name ?? "", null),
      };
    }

    try {
      const tab = await chrome.tabs.get(targetTabId);
      if (!tab?.id || !isInjectableTabUrl(tab?.url ?? "")) {
        return {
          requested: true,
          tab: null,
          message: buildSelectedTabUnavailableMessage(
            target.site?.name ?? "",
            targetTabId,
          ),
        };
      }

      return (await isReusableTabForSite(tab, target.site))
        ? {
            requested: true,
            tab,
          }
        : {
            requested: true,
            tab: null,
            message: buildSelectedTabUnavailableMessage(
              target.site?.name ?? "",
              targetTabId,
            ),
          };
    } catch (_error) {
      return {
        requested: true,
        tab: null,
        message: buildSelectedTabUnavailableMessage(
          target.site?.name ?? "",
          targetTabId,
        ),
      };
    }
  }

  async function getPreferredInjectableNormalTab(): Promise<PreferredInjectableNormalTabResult> {
    const tab = await deps.getPreferredNormalActiveTab();
    if (!tab?.id) {
      return {
        ok: false,
        reason: "no_tab",
      };
    }

    const tabUrl = typeof tab.url === "string" ? tab.url : "";
    if (!isInjectableTabUrl(tabUrl)) {
      return {
        ok: false,
        reason: "invalid_tab",
        tab,
      };
    }

    return {
      ok: true,
      tab,
    };
  }

  return {
    getSiteById,
    getSiteForUrl,
    resolveSelectedTargets,
    buildSelectedTabUnavailableMessage,
    isInjectableTabUrl,
    getAllowedSiteHostnames,
    getSitePermissionPatterns,
    isSameSiteOrigin,
    isReusableTabForSite,
    isCustomSitePermissionGranted,
    findReusableTabsForSites,
    getExplicitReusableTabForTarget,
    getPreferredInjectableNormalTab,
  };
}
