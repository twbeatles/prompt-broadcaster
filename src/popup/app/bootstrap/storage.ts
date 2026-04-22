import { getAppSettings, getPromptFavorites, getPromptHistory, getTemplateVariableCache } from "../../../shared/prompts";
import { consumePopupPromptIntent, getComposeDraftPrompt, getLastSentPrompt, pickRestoredComposePrompt } from "../../../shared/prompt-state";
import { drainPendingUiToasts, getFavoriteRunJobs, getFailedSelectors } from "../../../shared/runtime-state";
import { getRuntimeSites } from "../../../shared/sites";
import { sortSitesByOrder } from "../../../shared/sites/order";
import type { PopupToastInput } from "../../../shared/types/popup";
import { popupDom } from "../dom";
import { t } from "../i18n";
import { state } from "../state";

const { promptInput } = popupDom.compose;
const {
  reuseExistingTabsToggle,
  reuseExistingTabsLabel,
  reuseExistingTabsDesc,
  waitMultiplierLabel,
  waitMultiplierRange,
  waitMultiplierValue,
} = popupDom.settings;

interface PopupStorageControllerDeps {
  refreshOpenSiteTabs: () => Promise<void>;
  renderSiteCheckboxesPanel: () => void;
  renderManagedSites: () => void;
  updatePromptCounter: () => void;
  autoResizePromptInput: () => void;
  renderTemplateSummary: () => void;
  renderLists: () => void;
  renderSortControls: () => void;
  showAppToast: (input: PopupToastInput | string, type?: string, duration?: number) => string;
}

export function createPopupStorageController(
  deps: PopupStorageControllerDeps,
) {
  let hasRestoredStoredPrompt = false;

  function applySettingsToControls() {
    reuseExistingTabsToggle.checked = Boolean(state.settings.reuseExistingTabs);
    reuseExistingTabsLabel.textContent = t.reuseTabsLabel;
    reuseExistingTabsDesc.textContent = state.settings.reuseExistingTabs
      ? t.reuseTabsDescEnabled
      : t.reuseTabsDescDisabled;
    waitMultiplierLabel.textContent = t.waitMultiplierLabel;
    waitMultiplierRange.value = String(state.settings.waitMsMultiplier);
    waitMultiplierValue.textContent = t.waitMultiplierValue(
      state.settings.waitMsMultiplier,
    );
    deps.renderSortControls();
  }

  async function loadStoredData() {
    try {
      const [
        history,
        favorites,
        variableCache,
        runtimeSites,
        promptIntent,
        composeDraftPrompt,
        lastSentPrompt,
        failedSelectors,
        favoriteJobs,
        settings,
      ] = await Promise.all([
        getPromptHistory(),
        getPromptFavorites(),
        getTemplateVariableCache(),
        getRuntimeSites(),
        consumePopupPromptIntent(),
        getComposeDraftPrompt(),
        getLastSentPrompt(),
        getFailedSelectors(),
        getFavoriteRunJobs(),
        getAppSettings(),
      ]);

      state.history = history;
      state.favorites = favorites;
      state.templateVariableCache = variableCache;
      state.runtimeSites = sortSitesByOrder(runtimeSites, settings.siteOrder);
      state.failedSelectors = new Map(
        failedSelectors.map((entry) => [entry.serviceId, entry]),
      );
      state.favoriteJobs = favoriteJobs;
      state.settings = settings;

      await deps.refreshOpenSiteTabs();

      if (!hasRestoredStoredPrompt) {
        promptInput.value = pickRestoredComposePrompt({
          currentPrompt: promptInput.value,
          popupPromptIntent: promptIntent,
          composeDraftPrompt,
          lastSentPrompt,
        });
        hasRestoredStoredPrompt = true;
      }

      applySettingsToControls();
      deps.renderSiteCheckboxesPanel();
      deps.renderManagedSites();
      deps.updatePromptCounter();
      deps.autoResizePromptInput();
      deps.renderTemplateSummary();
      deps.renderLists();
    } catch (error) {
      console.error("[AI Prompt Broadcaster] Failed to load stored data.", error);
      throw error;
    }
  }

  async function refreshStoredData() {
    try {
      const [
        history,
        favorites,
        variableCache,
        runtimeSites,
        failedSelectors,
        favoriteJobs,
        settings,
      ] = await Promise.all([
        getPromptHistory(),
        getPromptFavorites(),
        getTemplateVariableCache(),
        getRuntimeSites(),
        getFailedSelectors(),
        getFavoriteRunJobs(),
        getAppSettings(),
      ]);

      state.history = history;
      state.favorites = favorites;
      state.templateVariableCache = variableCache;
      state.runtimeSites = sortSitesByOrder(runtimeSites, settings.siteOrder);
      state.failedSelectors = new Map(
        failedSelectors.map((entry) => [entry.serviceId, entry]),
      );
      state.favoriteJobs = favoriteJobs;
      state.settings = settings;
      await deps.refreshOpenSiteTabs();
      applySettingsToControls();
      deps.renderSiteCheckboxesPanel();
      deps.renderManagedSites();
      deps.renderLists();
    } catch (error) {
      console.error("[AI Prompt Broadcaster] Failed to refresh stored data.", error);
      throw error;
    }
  }

  async function flushPendingSessionToasts(): Promise<void> {
    const pendingToasts = await drainPendingUiToasts();
    pendingToasts.forEach((toast) => {
      deps.showAppToast(toast);
    });
  }

  return {
    applySettingsToControls,
    loadStoredData,
    refreshStoredData,
    flushPendingSessionToasts,
  };
}
