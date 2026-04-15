import { detectTemplateVariables, getTemplateVariableDisplayName } from "../../shared/template";
import type { OpenSiteTab, RuntimeSite, TemplateVariableDescriptor } from "../../shared/types/models";
import type { PopupState, PopupTemplateSendState } from "../../shared/types/popup";
import { popupDom } from "./dom";
import { escapeAttribute, escapeHtml, getSiteIcon, previewText } from "./helpers";
import { msg, t, uiLanguage } from "./i18n";
import { getFavoriteSortOptions, getHistorySortOptions } from "./sorting";
import { state } from "./state";

type ComposerTarget = NonNullable<PopupTemplateSendState["targets"]>[number];

const { extTitle, extDesc } = popupDom.header;
const { tabButtons } = popupDom.tabs;
const {
  promptInput,
  promptCounter,
  clearPromptBtn,
  templateSummary,
  templateSummaryLabel,
  templateChipList,
  sitesLabel,
  sitesContainer,
  saveFavoriteBtn,
  sendBtn,
} = popupDom.compose;
const { historySearchInput, historySortSelect } = popupDom.history;
const { favoritesSearchInput, favoritesSortSelect } = popupDom.favorites;
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

interface PopupRenderingDeps {
  buildComposerBroadcastTargets: (siteIds?: string[], basePrompt?: string) => ComposerTarget[];
  detectTemplateVariablesForTargets: (targets?: ComposerTarget[]) => TemplateVariableDescriptor[];
  checkedSiteIds: () => string[];
  getEnabledSites: () => RuntimeSite[];
  getRuntimeSiteLabel: (siteId: string) => string;
  getOpenSiteTabs: (siteId: string) => OpenSiteTab[];
  getDefaultTargetModeLabel: () => string;
  syncToggleAllLabel: () => void;
  setCardStatesFromBroadcast: (summary: PopupState["lastBroadcast"]) => void;
  applyDynamicPromptPlaceholder: () => void;
  updatePromptCounter: () => void;
}

export function createPopupRendering(deps: PopupRenderingDeps) {
  function renderSortControls() {
    historySortSelect.innerHTML = getHistorySortOptions()
      .map((option) => `<option value="${escapeAttribute(option.value)}">${escapeHtml(option.label)}</option>`)
      .join("");
    favoritesSortSelect.innerHTML = getFavoriteSortOptions()
      .map((option) => `<option value="${escapeAttribute(option.value)}">${escapeHtml(option.label)}</option>`)
      .join("");

    historySortSelect.value = state.settings.historySort;
    favoritesSortSelect.value = state.settings.favoriteSort;
  }

  function getTemplateDisplayName(name: string): string {
    return getTemplateVariableDisplayName(name, uiLanguage);
  }

  function currentPromptVariables(): TemplateVariableDescriptor[] {
    const checkedTargets = deps.buildComposerBroadcastTargets(
      deps.checkedSiteIds(),
      promptInput.value,
    );
    if (checkedTargets.length === 0) {
      return detectTemplateVariables(promptInput.value);
    }

    return deps.detectTemplateVariablesForTargets(checkedTargets);
  }

  function renderTemplateSummary(): void {
    const variables = currentPromptVariables();

    templateSummary.hidden = variables.length === 0;

    if (variables.length === 0) {
      templateSummaryLabel.textContent = "";
      templateChipList.innerHTML = "";
      return;
    }

    templateSummaryLabel.textContent = t.templateSummary(variables.length);
    templateChipList.innerHTML = variables
      .map((variable) => {
        const kindLabel =
          variable.kind === "system" ? t.templateSystemKind : t.templateUserKind;
        const variableLabel =
          variable.kind === "system" ? getTemplateDisplayName(variable.name) : variable.name;
        return `
          <span class="template-chip ${variable.kind}">
            <span>{{${escapeHtml(variableLabel)}}}</span>
            <span class="template-chip-kind">${escapeHtml(kindLabel)}</span>
          </span>
        `;
      })
      .join("");
  }

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
    waitMultiplierValue.textContent = t.waitMultiplierValue(state.settings.waitMsMultiplier);
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
    const verifiedAuthUnknownOption = serviceVerifiedAuthStateSelect.querySelector("option[value='']");
    const verifiedAuthLoggedInOption = serviceVerifiedAuthStateSelect.querySelector("option[value='logged-in']");
    const verifiedAuthLoggedOutOption = serviceVerifiedAuthStateSelect.querySelector("option[value='logged-out']");
    const verifiedAuthSoftGatedOption = serviceVerifiedAuthStateSelect.querySelector("option[value='soft-gated']");
    if (verifiedAuthUnknownOption) {
      verifiedAuthUnknownOption.textContent = t.serviceVerifiedAuthStateUnknown;
    }
    if (verifiedAuthLoggedInOption) {
      verifiedAuthLoggedInOption.textContent = t.serviceVerifiedAuthStateLoggedIn;
    }
    if (verifiedAuthLoggedOutOption) {
      verifiedAuthLoggedOutOption.textContent = t.serviceVerifiedAuthStateLoggedOut;
    }
    if (verifiedAuthSoftGatedOption) {
      verifiedAuthSoftGatedOption.textContent = t.serviceVerifiedAuthStateSoftGated;
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
      const tabId = button.dataset.tab as PopupState["activeTab"] | undefined;
      button.textContent = tabId ? t.tabs[tabId] : "";
    });

    deps.applyDynamicPromptPlaceholder();
    deps.updatePromptCounter();
  }

  function renderSiteCheckboxesPanel() {
    const previousSelection = new Set(deps.checkedSiteIds());
    sitesContainer.innerHTML = "";

    deps.getEnabledSites().forEach((site) => {
      const card = document.createElement("article");
      card.className = "site-card checked";
      card.dataset.siteId = site.id;
      card.style.setProperty("--site-color", site.color || "#c24f2e");
      card.setAttribute("role", "option");
      card.tabIndex = 0;

      const mainRow = document.createElement("label");
      mainRow.className = "site-card-main";
      mainRow.htmlFor = `site-${site.id}`;

      const checkbox = document.createElement("input");
      checkbox.type = "checkbox";
      checkbox.id = `site-${site.id}`;
      checkbox.value = site.id;
      checkbox.checked = previousSelection.size > 0 ? previousSelection.has(site.id) : true;

      const siteIcon = document.createElement("span");
      siteIcon.className = "site-icon";
      siteIcon.textContent = getSiteIcon(site);

      const siteName = document.createElement("span");
      siteName.className = "site-name";
      siteName.textContent = `${deps.getRuntimeSiteLabel(site.id)}`;

      const selectorWarning = state.failedSelectors.get(site.id);
      if (selectorWarning) {
        card.classList.add("selector-warning");
        card.title = t.selectorWarningTooltip;
      }

      checkbox.addEventListener("change", () => {
        card.classList.toggle("checked", checkbox.checked);
        card.setAttribute("aria-selected", String(checkbox.checked));
        card.setAttribute(
          "aria-label",
          `${deps.getRuntimeSiteLabel(site.id)} ${checkbox.checked ? t.ariaSelected : t.ariaNotSelected}`,
        );
        deps.syncToggleAllLabel();
        renderTemplateSummary();
      });

      card.addEventListener("keydown", (event) => {
        if (event.key !== " " && event.key !== "Enter") {
          return;
        }

        event.preventDefault();
        checkbox.checked = !checkbox.checked;
        checkbox.dispatchEvent(new Event("change", { bubbles: true }));
      });

      const siteStatus = document.createElement("span");
      siteStatus.className = "site-status";
      siteStatus.setAttribute("aria-hidden", "true");

      const warningIcon = document.createElement("span");
      warningIcon.className = "site-warning";
      warningIcon.setAttribute("aria-hidden", "true");
      warningIcon.textContent = selectorWarning ? "!" : "";

      mainRow.append(checkbox, siteIcon, siteName, warningIcon, siteStatus);
      card.classList.toggle("checked", checkbox.checked);
      card.setAttribute("aria-selected", String(checkbox.checked));
      card.setAttribute(
        "aria-label",
        `${deps.getRuntimeSiteLabel(site.id)} ${checkbox.checked ? t.ariaSelected : t.ariaNotSelected}`,
      );
      card.appendChild(mainRow);

      const openTabs = deps.getOpenSiteTabs(site.id);
      const selectedTarget = state.siteTargetSelections?.[site.id] ?? "default";

      if (openTabs.length > 0) {
        const tabsWrap = document.createElement("div");
        tabsWrap.className = "site-tabs";

        const tabsHead = document.createElement("div");
        tabsHead.className = "site-tabs-head";
        tabsHead.textContent = t.openTabsTitle(openTabs.length);

        const tabsList = document.createElement("div");
        tabsList.className = "site-tabs-list";
        const radioName = `site-target-${site.id}`;

        const appendTargetOption = (
          choiceValue: PopupState["siteTargetSelections"][string],
          title: string,
          detail: string,
          pillText = "",
        ): void => {
          const option = document.createElement("label");
          option.className = "site-tab-option";

          const radio = document.createElement("input");
          radio.type = "radio";
          radio.name = radioName;
          radio.value = typeof choiceValue === "number" ? `tab:${choiceValue}` : String(choiceValue);
          radio.checked = choiceValue === selectedTarget;

          const copy = document.createElement("span");
          copy.className = "site-tab-copy";

          const titleNode = document.createElement("span");
          titleNode.className = "site-tab-title";
          titleNode.textContent = title;

          const detailNode = document.createElement("span");
          detailNode.className = "site-tab-meta";
          detailNode.textContent = detail;

          copy.append(titleNode, detailNode);
          option.append(radio, copy);

          if (pillText) {
            const pill = document.createElement("span");
            pill.className = "site-tab-pill";
            pill.textContent = pillText;
            option.appendChild(pill);
          }

          radio.addEventListener("change", () => {
            if (!radio.checked) {
              return;
            }

            state.siteTargetSelections[site.id] = choiceValue;
            if (!checkbox.checked) {
              checkbox.checked = true;
              card.classList.add("checked");
            }
            deps.syncToggleAllLabel();
          });

          tabsList.appendChild(option);
        };

        appendTargetOption(
          "default",
          t.openTabsUseDefault,
          t.openTabsUseDefaultDetail(deps.getDefaultTargetModeLabel()),
        );
        appendTargetOption(
          "new",
          t.openTabsAlwaysNew,
          t.openTabsAlwaysNewDetail,
        );

        openTabs.forEach((tab) => {
          const detailText = previewText(tab.url || tab.title || "", 52);
          const pillText = tab.active
            ? t.openTabsActive
            : tab.status === "loading"
              ? t.openTabsLoading
              : t.openTabsReady;

          appendTargetOption(
            tab.tabId,
            previewText(tab.title || tab.url || `${site.name} tab`, 48),
            detailText,
            pillText,
          );
        });

        tabsWrap.append(tabsHead, tabsList);
        card.appendChild(tabsWrap);
      }

      const overrideToggleRow = document.createElement("div");
      overrideToggleRow.className = "site-override-toggle-row";

      const overrideToggle = document.createElement("button");
      const hasOverride = Boolean(state.sitePromptOverrides?.[site.id]?.trim());
      overrideToggle.className = `ghost-button small-button site-override-toggle${hasOverride ? " active" : ""}`;
      overrideToggle.type = "button";
      overrideToggle.dataset.siteOverrideToggle = site.id;
      overrideToggle.title = msg("popup_override_prompt_label") || "Custom prompt for this service";
      overrideToggle.textContent = hasOverride ? `✎ ${msg("popup_override_active") || "Custom"}` : "✎";

      const overrideWrap = document.createElement("div");
      overrideWrap.className = "site-override-wrap";
      overrideWrap.hidden = !hasOverride;

      const overrideTextarea = document.createElement("textarea");
      overrideTextarea.className = "site-override-textarea";
      overrideTextarea.rows = 3;
      overrideTextarea.placeholder =
        msg("popup_override_prompt_placeholder") || "Override prompt for this service only…";
      overrideTextarea.value = state.sitePromptOverrides?.[site.id] ?? "";
      overrideTextarea.dataset.siteOverrideInput = site.id;

      overrideTextarea.addEventListener("input", () => {
        state.sitePromptOverrides[site.id] = overrideTextarea.value;
        const nowActive = Boolean(overrideTextarea.value.trim());
        overrideToggle.classList.toggle("active", nowActive);
        overrideToggle.textContent = nowActive ? `✎ ${msg("popup_override_active") || "Custom"}` : "✎";
        renderTemplateSummary();
      });

      overrideToggle.addEventListener("click", () => {
        overrideWrap.hidden = !overrideWrap.hidden;
        if (!overrideWrap.hidden) {
          overrideTextarea.focus();
        }
      });

      overrideWrap.appendChild(overrideTextarea);
      overrideToggleRow.append(overrideToggle);
      card.append(overrideToggleRow, overrideWrap);

      sitesContainer.appendChild(card);
    });

    deps.syncToggleAllLabel();
    deps.setCardStatesFromBroadcast(state.lastBroadcast);
  }

  return {
    renderSortControls,
    renderTemplateSummary,
    renderTabLabels,
    renderSiteCheckboxesPanel,
  };
}
