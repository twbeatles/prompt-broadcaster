import { popupDom } from "../dom";
import { t } from "../i18n";
import { state } from "../state";
import type { PopupRenderingDeps } from "./types";

const { extTitle, extDesc } = popupDom.header;
const { tabButtons } = popupDom.tabs;
const {
  clearPromptBtn,
  sitesLabel,
  saveFavoriteBtn,
  sendBtn,
} = popupDom.compose;
const { historySearchInput } = popupDom.history;
const { favoritesSearchInput } = popupDom.favorites;
const {
  settingsTitle,
  settingsDesc,
  reuseExistingTabsLabel,
  reuseExistingTabsDesc,
  openOptionsBtn,
  clearHistoryBtn,
  exportJsonBtn,
  importJsonBtn,
  waitMultiplierLabel,
  waitMultiplierValue,
} = popupDom.settings;
const {
  serviceManagementTitle,
  serviceManagementDesc,
  addServiceBtn,
  resetSitesBtn,
  serviceEditorDesc,
  serviceNameLabel,
  serviceUrlLabel,
  serviceInputSelectorLabel,
  testSelectorBtn,
  serviceInputTypeLabel,
  serviceSubmitSelectorLabel,
  serviceSubmitMethodLabel,
  serviceAdvancedTitle,
  serviceFallbackSelectorsLabel,
  serviceAuthSelectorsLabel,
  serviceHostnameAliasesLabel,
  serviceSupportedRoutesLabel,
  serviceVerifiedAtLabel,
  serviceVerifiedRouteLabel,
  serviceVerifiedAuthStateLabel,
  serviceVerifiedLocaleLabel,
  serviceVerifiedVersionLabel,
  serviceVerifiedAuthStateSelect,
  serviceWaitLabel,
  serviceColorLabel,
  serviceIconLabel,
  serviceEnabledLabel,
  serviceEditorCancel,
  serviceEditorSave,
} = popupDom.serviceManagement;
const {
  resendModalTitle,
  resendModalDesc,
  resendModalCancel,
  resendModalConfirm,
  importReportModalTitle,
  importReportModalDesc,
  importReportModalConfirm,
} = popupDom.modals;

export function createTabLabelsRenderer(deps: PopupRenderingDeps) {
  function renderTabLabels() {
    extTitle.textContent = t.title;
    extDesc.textContent = t.desc;
    clearPromptBtn.textContent = t.clearPrompt;
    sitesLabel.textContent = t.sitesLabel;
    saveFavoriteBtn.textContent = t.saveFavorite;
    sendBtn.textContent = t.send;
    historySearchInput.placeholder = t.historySearch;
    favoritesSearchInput.placeholder = t.favoritesSearch;
    settingsTitle.textContent = t.settingsTitle;
    settingsDesc.textContent = t.settingsDesc;
    reuseExistingTabsLabel.textContent = t.reuseTabsLabel;
    reuseExistingTabsDesc.textContent = state.settings.reuseExistingTabs
      ? t.reuseTabsDescEnabled
      : t.reuseTabsDescDisabled;
    waitMultiplierLabel.textContent = t.waitMultiplierLabel;
    waitMultiplierValue.textContent = t.waitMultiplierValue(
      state.settings.waitMsMultiplier,
    );
    openOptionsBtn.textContent = t.openOptions;
    clearHistoryBtn.textContent = t.clearHistory;
    exportJsonBtn.textContent = t.exportJson;
    importJsonBtn.textContent = t.importJson;
    serviceManagementTitle.textContent = t.serviceManagementTitle;
    serviceManagementDesc.textContent = t.serviceManagementDesc;
    addServiceBtn.textContent = t.addService;
    resetSitesBtn.textContent = t.resetServices;
    serviceEditorDesc.textContent = t.serviceEditorDesc;
    serviceNameLabel.textContent = t.serviceFieldName;
    serviceUrlLabel.textContent = t.serviceFieldUrl;
    serviceInputSelectorLabel.textContent = t.serviceFieldInputSelector;
    testSelectorBtn.textContent = t.serviceTest;
    serviceInputTypeLabel.textContent = t.serviceFieldInputType;
    serviceSubmitSelectorLabel.textContent = t.serviceFieldSubmitSelector;
    serviceSubmitMethodLabel.textContent = t.serviceFieldSubmitMethod;
    serviceAdvancedTitle.textContent = t.serviceFieldAdvanced;
    serviceFallbackSelectorsLabel.textContent = t.serviceFieldFallbackSelectors;
    serviceAuthSelectorsLabel.textContent = t.serviceFieldAuthSelectors;
    serviceHostnameAliasesLabel.textContent = t.serviceFieldHostnameAliases;
    serviceSupportedRoutesLabel.textContent = t.serviceFieldSupportedRoutes;
    serviceVerifiedAtLabel.textContent = t.serviceFieldVerifiedAt;
    serviceVerifiedRouteLabel.textContent = t.serviceFieldVerifiedRoute;
    serviceVerifiedAuthStateLabel.textContent = t.serviceFieldVerifiedAuthState;
    serviceVerifiedLocaleLabel.textContent = t.serviceFieldVerifiedLocale;
    serviceVerifiedVersionLabel.textContent = t.serviceFieldVerifiedVersion;
    const verifiedAuthUnknownOption =
      serviceVerifiedAuthStateSelect.querySelector("option[value='']");
    const verifiedAuthLoggedInOption =
      serviceVerifiedAuthStateSelect.querySelector(
        "option[value='logged-in']",
      );
    const verifiedAuthLoggedOutOption =
      serviceVerifiedAuthStateSelect.querySelector(
        "option[value='logged-out']",
      );
    const verifiedAuthSoftGatedOption =
      serviceVerifiedAuthStateSelect.querySelector(
        "option[value='soft-gated']",
      );
    if (verifiedAuthUnknownOption) {
      verifiedAuthUnknownOption.textContent = t.serviceVerifiedAuthStateUnknown;
    }
    if (verifiedAuthLoggedInOption) {
      verifiedAuthLoggedInOption.textContent = t.serviceVerifiedAuthStateLoggedIn;
    }
    if (verifiedAuthLoggedOutOption) {
      verifiedAuthLoggedOutOption.textContent =
        t.serviceVerifiedAuthStateLoggedOut;
    }
    if (verifiedAuthSoftGatedOption) {
      verifiedAuthSoftGatedOption.textContent =
        t.serviceVerifiedAuthStateSoftGated;
    }
    serviceWaitLabel.textContent = t.serviceFieldWait;
    serviceColorLabel.textContent = t.serviceFieldColor;
    serviceIconLabel.textContent = t.serviceFieldIcon;
    serviceEnabledLabel.textContent = t.serviceFieldEnabled;
    serviceEditorCancel.textContent = t.serviceEditorCancel;
    serviceEditorSave.textContent = t.serviceEditorSave;
    resendModalTitle.textContent = t.resendModalTitle;
    resendModalDesc.textContent = t.resendModalDesc;
    resendModalCancel.textContent = t.resendModalCancel;
    resendModalConfirm.textContent = t.resendModalConfirm;
    importReportModalTitle.textContent = t.importReportTitle;
    importReportModalDesc.textContent = t.importReportDesc;
    importReportModalConfirm.textContent = t.importReportClose;

    tabButtons.forEach((button) => {
      const tabId = button.dataset.tab as typeof state.activeTab | undefined;
      button.textContent = tabId ? t.tabs[tabId] : "";
    });

    deps.applyDynamicPromptPlaceholder();
    deps.updatePromptCounter();
  }

  return {
    renderTabLabels,
  };
}
