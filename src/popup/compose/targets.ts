import {
  detectTemplateVariablesForTargets as detectBroadcastTemplateVariables,
  findMissingTemplateValuesForTargets as findMissingBroadcastTemplateValues,
  resolveBroadcastTargets,
} from "../../shared/broadcast/resolution";
import { t } from "../app/i18n";
import { state } from "../app/state";
import type {
  BroadcastSiteTargetMessage,
  GetOpenAiTabsResponse,
} from "../../shared/types/messages";
import type {
  OpenSiteTab,
  TemplateVariableDescriptor,
} from "../../shared/types/models";
import type { PopupState, PopupTemplateSendState } from "../../shared/types/popup";

type ComposerTarget = NonNullable<PopupTemplateSendState["targets"]>[number];

interface PopupTargetsDeps {
  getEnabledSites: () => Array<{ id: string }>;
  getRuntimeSiteLabel: (siteId: string) => string;
  sendPopupMessage: (
    message: { action: "getOpenAiTabs" },
    timeoutMs?: number,
  ) => Promise<GetOpenAiTabsResponse | null>;
  renderSiteCheckboxesPanel: () => void;
}

function hasTargetId(
  target: ComposerTarget | BroadcastSiteTargetMessage,
): target is ComposerTarget {
  return typeof target.id === "string" && target.id.trim().length > 0;
}

function normalizeOpenSiteTab(entry: unknown): OpenSiteTab | null {
  const source = (entry ?? {}) as Record<string, unknown>;
  const tabId = Number(source.tabId);
  if (!Number.isFinite(tabId) || typeof source.siteId !== "string" || !source.siteId.trim()) {
    return null;
  }

  return {
    siteId: source.siteId.trim(),
    siteName: typeof source.siteName === "string" ? source.siteName : "",
    tabId,
    title: typeof source.title === "string" ? source.title : "",
    url: typeof source.url === "string" ? source.url : "",
    active: Boolean(source.active),
    status: typeof source.status === "string" ? source.status : "",
    windowId: Number.isFinite(Number(source.windowId)) ? Number(source.windowId) : null,
  };
}

export function createPopupTargetsController(deps: PopupTargetsDeps) {
  function getOpenSiteTabs(siteId: string): OpenSiteTab[] {
    return state.openSiteTabs.filter((tab) => tab.siteId === siteId);
  }

  function getDefaultTargetModeLabel(): string {
    return state.settings.reuseExistingTabs ? t.openTabsDefaultReuse : t.openTabsDefaultNew;
  }

  function getDefaultSiteTargetSelection(): "default" {
    return "default";
  }

  function syncSiteTargetSelections(): void {
    const enabledSiteIds = new Set(deps.getEnabledSites().map((site) => site.id));
    const nextSelections: PopupState["siteTargetSelections"] = {};

    enabledSiteIds.forEach((siteId) => {
      const currentSelection = state.siteTargetSelections?.[siteId];
      const availableTabIds = new Set(getOpenSiteTabs(siteId).map((tab) => Number(tab.tabId)));

      if (typeof currentSelection === "number" && availableTabIds.has(currentSelection)) {
        nextSelections[siteId] = currentSelection;
        return;
      }

      if (currentSelection === "new" || currentSelection === "default") {
        nextSelections[siteId] = currentSelection;
        return;
      }

      nextSelections[siteId] = getDefaultSiteTargetSelection();
    });

    state.siteTargetSelections = nextSelections;
  }

  async function refreshOpenSiteTabs(): Promise<void> {
    try {
      const response = await deps.sendPopupMessage({ action: "getOpenAiTabs" }, 5000);
      const tabs = Array.isArray(response?.tabs)
        ? response.tabs
          .map((entry) => normalizeOpenSiteTab(entry))
          .filter((entry): entry is OpenSiteTab => Boolean(entry))
        : [];

      state.openTabsWindowId = Number.isFinite(Number(response?.windowId))
        ? Number(response?.windowId)
        : null;
      state.openSiteTabs = tabs;
      syncSiteTargetSelections();
    } catch (error) {
      console.error("[AI Prompt Broadcaster] Failed to refresh open AI tabs.", error);
      state.openTabsWindowId = null;
      state.openSiteTabs = [];
      syncSiteTargetSelections();
    }
  }

  function scheduleOpenSiteTabsRefresh(delayMs = 180): void {
    if (state.openTabsRefreshTimer) {
      window.clearTimeout(state.openTabsRefreshTimer);
    }

    state.openTabsRefreshTimer = window.setTimeout(() => {
      state.openTabsRefreshTimer = null;
      void refreshOpenSiteTabs()
        .then(() => deps.renderSiteCheckboxesPanel())
        .catch((error) => {
          console.error("[AI Prompt Broadcaster] Scheduled AI tab refresh failed.", error);
        });
    }, delayMs);
  }

  function buildComposerBroadcastTargets(
    siteIds: string[] = [],
    basePrompt = "",
  ): ComposerTarget[] {
    return siteIds.map((siteId) => {
      const targetSelection = state.siteTargetSelections?.[siteId];
      const promptOverride =
        typeof state.sitePromptOverrides?.[siteId] === "string"
        && state.sitePromptOverrides[siteId].trim()
          ? state.sitePromptOverrides[siteId]
          : "";
      const target: ComposerTarget = {
        id: siteId,
        promptTemplate: promptOverride.trim() ? promptOverride : String(basePrompt ?? ""),
      };

      if (typeof targetSelection === "number") {
        return { ...target, tabId: targetSelection };
      }

      if (targetSelection === "new") {
        return { ...target, reuseExistingTab: false, target: "new" };
      }

      return target;
    });
  }

  function buildRuntimeBroadcastTargets(
    targets: Array<ComposerTarget | BroadcastSiteTargetMessage> = [],
  ): Array<{
    id: string;
    tabId?: number;
    reuseExistingTab?: boolean;
    target?: "new" | "tab";
    promptOverride?: string;
    resolvedPrompt?: string;
  }> {
    return (Array.isArray(targets) ? targets : [])
      .filter(hasTargetId)
      .map((target) => {
        const payload: ComposerTarget = { id: target.id };

        if (typeof target.tabId === "number") {
          payload.tabId = target.tabId;
          payload.target = "tab";
        } else if (target.target === "new" || target.reuseExistingTab === false) {
          payload.reuseExistingTab = false;
          payload.target = "new";
        } else if (target.target === "tab") {
          payload.target = "tab";
        }

        if (typeof target.promptOverride === "string" && target.promptOverride.trim()) {
          payload.promptOverride = target.promptOverride;
        }

        if (typeof target.resolvedPrompt === "string") {
          payload.resolvedPrompt = target.resolvedPrompt;
        }

        return payload;
      });
  }

  function detectTemplateVariablesForTargets(
    targets: ComposerTarget[] = [],
  ): TemplateVariableDescriptor[] {
    return detectBroadcastTemplateVariables(targets) as TemplateVariableDescriptor[];
  }

  function findMissingTemplateValuesForTargets(
    targets: ComposerTarget[] = [],
    userValues: Record<string, string> = {},
  ): string[] {
    return findMissingBroadcastTemplateValues(targets, userValues);
  }

  function buildResolvedBroadcastTargets(
    targets: ComposerTarget[] = [],
    values: Record<string, string> = {},
  ): ComposerTarget[] {
    return resolveBroadcastTargets(targets, values) as ComposerTarget[];
  }

  function buildTemplatePreviewText(
    targets: ComposerTarget[] = [],
    values: Record<string, string> = {},
  ): string {
    const resolvedTargets = buildResolvedBroadcastTargets(targets, values);
    const uniquePrompts = Array.from(
      new Set(
        resolvedTargets
          .map((target) => target.resolvedPrompt)
          .filter((prompt) => typeof prompt === "string"),
      ),
    );

    if (uniquePrompts.length <= 1) {
      return uniquePrompts[0] ?? "";
    }

    return resolvedTargets
      .map((target) => `[${deps.getRuntimeSiteLabel(target.id)}]\n${target.resolvedPrompt}`)
      .join("\n\n---\n\n");
  }

  return {
    getOpenSiteTabs,
    getDefaultTargetModeLabel,
    syncSiteTargetSelections,
    refreshOpenSiteTabs,
    scheduleOpenSiteTabsRefresh,
    buildComposerBroadcastTargets,
    buildRuntimeBroadcastTargets,
    detectTemplateVariablesForTargets,
    findMissingTemplateValuesForTargets,
    buildResolvedBroadcastTargets,
    buildTemplatePreviewText,
  };
}
