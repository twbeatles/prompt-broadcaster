// @ts-nocheck
import {
  detectTemplateVariablesForTargets as detectBroadcastTemplateVariables,
  findMissingTemplateValuesForTargets as findMissingBroadcastTemplateValues,
  resolveBroadcastTargets,
} from "../../shared/broadcast/resolution";
import {
  SYSTEM_TEMPLATE_VARIABLES,
  buildSystemTemplateValues,
  detectTemplateVariables,
  findMissingTemplateValues,
  getTemplateVariableDisplayName,
  renderTemplatePrompt,
} from "../../shared/template";
import {
  addFavoriteFromHistory,
  clearPromptHistory,
  createFavoritePrompt,
  deleteFavoriteItem,
  deletePromptHistoryItem,
  duplicateFavoriteItem,
  exportPromptData,
  getAppSettings,
  getPromptFavorites,
  getPromptHistory,
  getTemplateVariableCache,
  importPromptData,
  markFavoriteUsed,
  normalizeResultCode,
  updateFavoriteTitle,
  updateFavoriteMeta,
  updateFavoritePrompt,
  updateAppSettings,
  updateTemplateVariableCache,
} from "../../shared/prompts";
import {
  consumePopupFavoriteIntent,
  drainPendingUiToasts,
  getFailedSelectors,
  getLastBroadcast,
} from "../../shared/runtime-state";
import {
  buildSitePermissionPatterns,
  deleteCustomSite,
  getRuntimeSites,
  resetSiteSettings,
  saveBuiltInSiteOverride,
  saveCustomSite,
  setRuntimeSiteEnabled,
  validateSiteDraft,
} from "../../shared/sites";
import { matchesFavoriteSearch } from "../../shared/prompts/search";
import { clearAllToasts, initToastRoot, showToast } from "../ui/toast";
import {
  applyI18n,
  buildImportSummaryText,
  buildServiceTestResultMessage,
  getUnknownErrorText,
  isKorean,
  msg,
  t,
  uiLanguage,
} from "./i18n";
import { state } from "./state";
import { popupDom } from "./dom";
import {
  compareDateValues,
  escapeAttribute,
  escapeHtml,
  formatDate,
  getSiteIcon,
  isTextEditingTarget,
  joinMultilineValues,
  normalizeSiteIdList,
  previewText,
  splitMultilineValues,
} from "./helpers";
import {
  buildEmptyState,
  buildFavoriteItemMarkup,
  buildHistoryItemMarkup,
  buildImportReportMarkup,
  getHistorySelectedSiteIds,
  renderServiceBadges,
} from "./list-markup";
import {
  getFavoriteSortOptions,
  getHistorySortOptions,
  sortFavoriteItemsForDisplay,
  sortHistoryItemsForDisplay,
} from "./sorting";
import { createFavoriteEditorFeature } from "../features/favorite-editor";

const { extTitle, extDesc } = popupDom.header;
const { tabButtons, panels } = popupDom.tabs;
const {
  promptInput,
  promptCounter,
  clearPromptBtn,
  templateSummary,
  templateSummaryLabel,
  templateChipList,
  sitesLabel,
  sitesContainer,
  toggleAllBtn,
  saveFavoriteBtn,
  cancelSendBtn,
  sendBtn,
  statusMsg,
} = popupDom.compose;
const { historySearchInput, historySortSelect, historyList } = popupDom.history;
const { favoritesSearchInput, favoritesSortSelect, favoritesList } = popupDom.favorites;
const {
  settingsTitle,
  settingsDesc,
  reuseExistingTabsToggle,
  reuseExistingTabsLabel,
  reuseExistingTabsDesc,
  openOptionsBtn,
  clearHistoryBtn,
  exportJsonBtn,
  importJsonBtn,
  importJsonInput,
  waitMultiplierLabel,
  waitMultiplierRange,
  waitMultiplierValue,
} = popupDom.settings;
const {
  serviceManagementTitle,
  serviceManagementDesc,
  addServiceBtn,
  resetSitesBtn,
  managedSitesList,
  serviceEditor,
  serviceEditorTitle,
  serviceEditorDesc,
  serviceNameLabel,
  serviceNameInput,
  serviceUrlLabel,
  serviceUrlInput,
  serviceInputSelectorLabel,
  serviceInputSelectorInput,
  testSelectorBtn,
  serviceInputTypeLabel,
  serviceSubmitSelectorLabel,
  serviceSubmitSelectorInput,
  serviceSubmitMethodLabel,
  serviceSubmitMethodSelect,
  serviceAdvancedTitle,
  serviceFallbackSelectorsLabel,
  serviceFallbackSelectorsInput,
  serviceAuthSelectorsLabel,
  serviceAuthSelectorsInput,
  serviceHostnameAliasesLabel,
  serviceHostnameAliasesInput,
  serviceLastVerifiedLabel,
  serviceLastVerifiedInput,
  serviceVerifiedVersionLabel,
  serviceVerifiedVersionInput,
  serviceWaitLabel,
  serviceWaitRange,
  serviceWaitValue,
  serviceColorLabel,
  serviceColorInput,
  serviceIconLabel,
  serviceIconInput,
  serviceEnabledLabel,
  serviceEnabledInput,
  serviceTestResult,
  serviceEditorError,
  serviceEditorCancel,
  serviceEditorSave,
} = popupDom.serviceManagement;
const {
  templateModal,
  templateModalTitle,
  templateModalDesc,
  templateModalClose,
  templateModalSystemInfo,
  templateFields,
  templatePreviewLabel,
  templatePreview,
  templateModalError,
  templateModalCancel,
  templateModalConfirm,
  favoriteModal,
  favoriteModalTitle,
  favoriteModalDesc,
  favoriteModalClose,
  favoriteTitleLabel,
  favoriteTitleInput,
  favoriteModeLabel,
  favoriteModeSelect,
  favoriteTargetsLabel,
  favoriteTargetsList,
  favoriteTagsLabel,
  favoriteTagsInput,
  favoriteFolderLabel,
  favoriteFolderInput,
  favoritePinnedInput,
  favoritePinnedLabel,
  favoriteScheduleEnabledRow,
  favoriteScheduleEnabled,
  favoriteScheduleEnabledLabel,
  favoriteScheduleFields,
  favoriteScheduledAtLabel,
  favoriteScheduledAtInput,
  favoriteScheduleRepeatLabel,
  favoriteScheduleRepeatSelect,
  favoriteSaveDefaultsRow,
  favoriteSaveDefaults,
  favoriteSaveDefaultsLabel,
  favoriteDefaultFieldsWrap,
  favoriteDefaultFieldsLabel,
  favoriteDefaultFields,
  favoriteChainWrap,
  favoriteChainTitle,
  favoriteChainDesc,
  favoriteChainList,
  favoriteChainAddStep,
  favoriteModalError,
  favoriteModalCancel,
  favoriteModalRun,
  favoriteModalConfirm,
  resendModal,
  resendModalTitle,
  resendModalDesc,
  resendModalSites,
  resendModalClose,
  resendModalCancel,
  resendModalConfirm,
  importReportModal,
  importReportModalTitle,
  importReportModalDesc,
  importReportBody,
  importReportModalClose,
  importReportModalConfirm,
} = popupDom.modals;
const { toastHost } = popupDom;

function setStatus(text, type = "") {
  statusMsg.textContent = text;
  statusMsg.className = type;
}

function clearStatus() {
  setStatus("");
}

function showAppToast(input, type = "info", duration = 3000) {
  return showToast(input, type, duration);
}

function showConfirmToast(message, onConfirm) {
  showAppToast({
    message,
    type: "warning",
    duration: -1,
    actions: [
      {
        label: t.toastConfirm,
        onClick: () => {
          void onConfirm();
        },
      },
    ],
  });
}

function setSendingState(isSending) {
  state.isSending = Boolean(isSending);
  sendBtn.disabled = state.isSending;
  sendBtn.classList.toggle("loading", state.isSending);
  cancelSendBtn.hidden = !state.isSending;
  cancelSendBtn.disabled = !state.isSending;
  cancelSendBtn.textContent = t.stopSending;
}

function clearSendSafetyTimer() {
  if (state.sendSafetyTimer) {
    window.clearTimeout(state.sendSafetyTimer);
    state.sendSafetyTimer = null;
  }
}

function armSendSafetyTimer() {
  clearSendSafetyTimer();
  state.sendSafetyTimer = window.setTimeout(() => {
    state.sendSafetyTimer = null;
    if (state.lastBroadcast?.status !== "sending") {
      setSendingState(false);
    }
  }, 2000);
}

function buildBroadcastToastSignature(summary) {
  return [
    summary?.broadcastId ?? "",
    summary?.status ?? "",
    summary?.finishedAt ?? "",
    (summary?.failedSiteIds ?? []).join(","),
  ].join("|");
}

function getEnabledSites() {
  return state.runtimeSites.filter((site) => site.enabled);
}

function getRuntimeSiteLabel(siteId) {
  return state.runtimeSites.find((site) => site.id === siteId)?.name ?? siteId;
}

function getSiteSelectorIssueUrl(site) {
  const siteLabel = site?.name ?? site?.id ?? "";
  return `https://github.com/search?q=repo:twbeatles/prompt-broadcaster+${encodeURIComponent(siteLabel)}+selector&type=issues`;
}

function getSiteLastVerifiedStatus(site) {
  const lastVerified = site?.lastVerified ? String(site.lastVerified).trim() : "";
  if (!lastVerified) {
    return "";
  }

  const parsedDate = Date.parse(`${lastVerified}-01`);
  if (!Number.isFinite(parsedDate)) {
    return "";
  }

  const daysSince = Math.floor((Date.now() - parsedDate) / 86400000);
  if (daysSince <= 0) {
    return "";
  }

  return (msg("popup_selector_days_since") || `~${daysSince}d since last verified`).replace("$DAYS$", String(daysSince));
}

function getOpenSiteTabs(siteId) {
  return state.openSiteTabs.filter((tab) => tab.siteId === siteId);
}

function getDefaultTargetModeLabel() {
  return state.settings.reuseExistingTabs ? t.openTabsDefaultReuse : t.openTabsDefaultNew;
}

function getDefaultSiteTargetSelection() {
  return "default";
}

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

function getFocusableElements(root) {
  return [...root.querySelectorAll(
    "button:not([disabled]), [href], input:not([disabled]):not([type='hidden']), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex='-1'])"
  )].filter((element) => !element.hidden && element.getAttribute("aria-hidden") !== "true");
}

function openOverlay(overlay, initialFocus = null) {
  if (!overlay) {
    return;
  }

  state.lastFocusedElement = document.activeElement instanceof HTMLElement ? document.activeElement : null;
  overlay.hidden = false;
  state.openModalId = overlay.id;

  window.requestAnimationFrame(() => {
    const fallbackTarget = getFocusableElements(overlay)[0] ?? overlay.querySelector(".modal-card");
    (initialFocus ?? fallbackTarget)?.focus?.();
  });
}

function closeOverlay(overlay) {
  if (!overlay) {
    return;
  }

  overlay.hidden = true;
  if (state.openModalId === overlay.id) {
    state.openModalId = null;
  }
  if (state.lastFocusedElement?.focus) {
    state.lastFocusedElement.focus();
  }
  state.lastFocusedElement = null;
}

function getOpenOverlay() {
  return [importReportModal, resendModal, favoriteModal, templateModal].find((overlay) => overlay && !overlay.hidden) ?? null;
}

function closeActiveOverlayOrMenu() {
  const overlay = getOpenOverlay();
  if (overlay === importReportModal) {
    closeOverlay(importReportModal);
    return true;
  }
  if (overlay === resendModal) {
    closeOverlay(resendModal);
    state.pendingResendHistory = null;
    return true;
  }
  if (overlay === favoriteModal) {
    hideFavoriteModal();
    return true;
  }
  if (overlay === templateModal) {
    hideTemplateModal();
    return true;
  }
  if (state.openMenuKey) {
    state.openMenuKey = null;
    renderLists();
    return true;
  }
  return false;
}

function trapModalFocus(event) {
  if (event.key !== "Tab") {
    return;
  }

  const overlay = getOpenOverlay();
  if (!overlay) {
    return;
  }

  const focusable = getFocusableElements(overlay);
  if (focusable.length === 0) {
    event.preventDefault();
    return;
  }

  const currentIndex = focusable.indexOf(document.activeElement);
  const nextIndex = event.shiftKey
    ? (currentIndex <= 0 ? focusable.length - 1 : currentIndex - 1)
    : (currentIndex === -1 || currentIndex >= focusable.length - 1 ? 0 : currentIndex + 1);

  event.preventDefault();
  focusable[nextIndex]?.focus?.();
}

function syncSiteTargetSelections() {
  const enabledSiteIds = new Set(getEnabledSites().map((site) => site.id));
  const nextSelections = {};

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

function updatePromptCounter() {
  const limit = Number(promptInput.maxLength) || 2000;
  promptCounter.textContent = t.promptCounter(promptInput.value.length, limit);
}

function autoResizePromptInput() {
  promptInput.style.height = "auto";
  const nextHeight = Math.max(100, Math.min(promptInput.scrollHeight, 300));
  promptInput.style.height = `${nextHeight}px`;
}

function applyDynamicPromptPlaceholder() {
  const placeholderVariants = isKorean
    ? [
        t.placeholder,
        "{{언어}}로 {{주제}}를 설명해줘",
        "선택한 텍스트를 여러 AI에 동시에 비교해줘",
      ]
    : [
        t.placeholder,
        "Write a blog post about {{topic}} in {{language}}.",
        "Summarize the selected text for all services.",
      ];
  const nextPlaceholder =
    placeholderVariants[Math.floor(Math.random() * placeholderVariants.length)] || t.placeholder;
  promptInput.setAttribute("placeholder", nextPlaceholder);
}

function getTemplateDisplayName(name) {
  return getTemplateVariableDisplayName(name, uiLanguage);
}

function allCheckboxes() {
  return [...sitesContainer.querySelectorAll("input[type='checkbox']")];
}

function checkedSiteIds() {
  return allCheckboxes()
    .filter((checkbox) => checkbox.checked)
    .map((checkbox) => checkbox.value);
}

function syncToggleAllLabel() {
  const checkboxes = allCheckboxes();
  const allChecked = checkboxes.length > 0 && checkboxes.every((checkbox) => checkbox.checked);
  toggleAllBtn.textContent = allChecked ? t.deselectAll : t.selectAll;
}

function applySiteSelection(sentTo) {
  const selected = new Set(normalizeSiteIdList(sentTo));

  allCheckboxes().forEach((checkbox) => {
    const shouldCheck = selected.size === 0 ? checkbox.checked : selected.has(checkbox.value);
    checkbox.checked = shouldCheck;
    const card = checkbox.closest(".site-card");
    card?.classList.toggle("checked", shouldCheck);
    card?.setAttribute("aria-selected", String(shouldCheck));
  });

  syncToggleAllLabel();
}

function switchTab(tabId) {
  state.activeTab = tabId;

  tabButtons.forEach((button) => {
    const active = button.dataset.tab === tabId;
    button.classList.toggle("active", active);
    button.setAttribute("aria-selected", String(active));
    button.tabIndex = active ? 0 : -1;
  });

  panels.forEach((panel) => {
    const active = panel.dataset.panel === tabId;
    panel.classList.toggle("active", active);
    panel.hidden = !active;
  });

  state.openMenuKey = null;
  renderLists();
}

function filterItems(items, query) {
  const normalizedQuery = query.trim().toLowerCase();
  if (!normalizedQuery) {
    return items;
  }

  return items.filter((item) =>
    String(item.text).toLowerCase().includes(normalizedQuery)
  );
}


function renderHistoryList() {
  const items = sortHistoryItemsForDisplay(
    filterItems(state.history, state.historySearch),
    state.settings.historySort
  );

  if (items.length === 0) {
    historyList.innerHTML = buildEmptyState(
      state.historySearch ? t.noSearchResults : t.historyEmpty
    );
    return;
  }

  historyList.innerHTML = items
    .map((item) => buildHistoryItemMarkup(item, {
      openMenuKey: state.openMenuKey,
      runtimeSites: state.runtimeSites,
    }))
    .join("");
}

function getUniqueFavoriteTags() {
  const tagSet = new Set();
  state.favorites.forEach((item) => {
    (item.tags ?? []).forEach((tag) => tagSet.add(tag));
  });
  return [...tagSet].sort();
}

function getUniqueFavoriteFolders() {
  const folderSet = new Set();
  state.favorites.forEach((item) => {
    if (item.folder && item.folder.trim()) folderSet.add(item.folder.trim());
  });
  return [...folderSet].sort();
}

function renderFavoritesFilterBar() {
  const tags = getUniqueFavoriteTags();
  const folders = getUniqueFavoriteFolders();

  if (tags.length === 0 && folders.length === 0) {
    const existing = document.getElementById("favorites-filter-bar");
    if (existing) existing.remove();
    return;
  }

  let bar = document.getElementById("favorites-filter-bar");
  if (!bar) {
    bar = document.createElement("div");
    bar.id = "favorites-filter-bar";
    bar.className = "favorites-filter-bar";
    favoritesList.parentElement?.insertBefore(bar, favoritesList);
  }

  const allLabel = msg("popup_favorite_filter_all") || "All";
  const activeTag = state.favoritesTagFilter;
  const activeFolder = state.favoritesFolderFilter;

  bar.innerHTML = `
    <div class="filter-chips">
      <button class="filter-chip${!activeTag && !activeFolder ? " active" : ""}" data-filter-all="favorites">${escapeHtml(allLabel)}</button>
      ${folders.map((f) => `<button class="filter-chip folder-chip${activeFolder === f ? " active" : ""}" data-filter-folder="${escapeAttribute(f)}">📁 ${escapeHtml(f)}</button>`).join("")}
      ${tags.map((tag) => `<button class="filter-chip tag-chip${activeTag === tag ? " active" : ""}" data-filter-tag="${escapeAttribute(tag)}">#${escapeHtml(tag)}</button>`).join("")}
    </div>
  `;
}

function filterFavoriteItems(items) {
  let filtered = items.filter((item) => matchesFavoriteSearch(item, state.favoritesSearch));
  if (state.favoritesTagFilter) {
    filtered = filtered.filter((item) => (item.tags ?? []).includes(state.favoritesTagFilter));
  }
  if (state.favoritesFolderFilter) {
    filtered = filtered.filter((item) => (item.folder ?? "").trim() === state.favoritesFolderFilter);
  }
  return sortFavoriteItemsForDisplay(filtered, state.settings.favoriteSort);
}

function renderFavoritesList() {
  renderFavoritesFilterBar();
  const items = filterFavoriteItems(state.favorites);

  if (items.length === 0) {
    favoritesList.innerHTML = buildEmptyState(
      state.favoritesSearch || state.favoritesTagFilter || state.favoritesFolderFilter
        ? t.noSearchResults
        : t.favoritesEmpty
    );
    return;
  }

  favoritesList.innerHTML = items
    .map((item) => buildFavoriteItemMarkup(item, {
      openMenuKey: state.openMenuKey,
      runtimeSites: state.runtimeSites,
    }))
    .join("");
}

function renderLists() {
  renderHistoryList();
  renderFavoritesList();
}

function currentPromptVariables() {
  const checkedTargets = buildComposerBroadcastTargets(checkedSiteIds(), promptInput.value);
  if (checkedTargets.length === 0) {
    return detectTemplateVariables(promptInput.value);
  }

  return detectTemplateVariablesForTargets(checkedTargets);
}

function renderTemplateSummary() {
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

function compactVariableValues(values) {
  return Object.fromEntries(
    Object.entries(values ?? {})
      .map(([name, value]) => [String(name), String(value ?? "")])
      .filter(([, value]) => value.trim())
  );
}

function mergeTemplateSources(...sources) {
  return Object.assign({}, ...sources.filter(Boolean));
}

function normalizeOpenSiteTab(entry) {
  const tabId = Number(entry?.tabId);
  if (!Number.isFinite(tabId) || typeof entry?.siteId !== "string" || !entry.siteId.trim()) {
    return null;
  }

  return {
    siteId: entry.siteId.trim(),
    tabId,
    title: typeof entry?.title === "string" ? entry.title : "",
    url: typeof entry?.url === "string" ? entry.url : "",
    active: Boolean(entry?.active),
    status: typeof entry?.status === "string" ? entry.status : "",
    windowId: Number.isFinite(Number(entry?.windowId)) ? Number(entry.windowId) : null,
  };
}

async function refreshOpenSiteTabs() {
  try {
    const response = await chrome.runtime.sendMessage({ action: "getOpenAiTabs" }).catch(() => null);
    const tabs = Array.isArray(response?.tabs)
      ? response.tabs.map((entry) => normalizeOpenSiteTab(entry)).filter(Boolean)
      : [];

    state.openTabsWindowId = Number.isFinite(Number(response?.windowId))
      ? Number(response.windowId)
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

function scheduleOpenSiteTabsRefresh(delayMs = 180) {
  if (state.openTabsRefreshTimer) {
    window.clearTimeout(state.openTabsRefreshTimer);
  }

  state.openTabsRefreshTimer = window.setTimeout(() => {
    state.openTabsRefreshTimer = null;
    void refreshOpenSiteTabs()
      .then(() => renderSiteCheckboxesPanel())
      .catch((error) => {
        console.error("[AI Prompt Broadcaster] Scheduled AI tab refresh failed.", error);
      });
  }, delayMs);
}

function applySettingsToControls() {
  reuseExistingTabsToggle.checked = Boolean(state.settings.reuseExistingTabs);
  reuseExistingTabsLabel.textContent = t.reuseTabsLabel;
  reuseExistingTabsDesc.textContent = state.settings.reuseExistingTabs
    ? t.reuseTabsDescEnabled
    : t.reuseTabsDescDisabled;
  waitMultiplierLabel.textContent = t.waitMultiplierLabel;
  waitMultiplierRange.value = String(state.settings.waitMsMultiplier);
  waitMultiplierValue.textContent = t.waitMultiplierValue(state.settings.waitMsMultiplier);
  renderSortControls();
}

function buildComposerBroadcastTargets(siteIds = [], basePrompt = promptInput.value) {
  return normalizeSiteIdList(siteIds).map((siteId) => {
    const targetSelection = state.siteTargetSelections?.[siteId];
    const promptOverride =
      typeof state.sitePromptOverrides?.[siteId] === "string" &&
      state.sitePromptOverrides[siteId].trim()
        ? state.sitePromptOverrides[siteId]
        : "";
    const target = {
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

function buildRuntimeBroadcastTargets(targets = []) {
  return (Array.isArray(targets) ? targets : [])
    .filter((target) => target && typeof target.id === "string" && target.id.trim())
    .map((target) => {
      const payload = { id: target.id };

      if (typeof target.tabId === "number") {
        payload.tabId = target.tabId;
      } else if (target.target === "new" || target.reuseExistingTab === false) {
        payload.reuseExistingTab = false;
        payload.target = "new";
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

function detectTemplateVariablesForTargets(targets = []) {
  return detectBroadcastTemplateVariables(targets);
}

function findMissingTemplateValuesForTargets(targets = [], userValues = {}) {
  return findMissingBroadcastTemplateValues(targets, userValues);
}

function buildResolvedBroadcastTargets(targets = [], values = {}) {
  return resolveBroadcastTargets(targets, values);
}

function buildTemplatePreviewText(targets = [], values = {}) {
  const resolvedTargets = buildResolvedBroadcastTargets(targets, values);
  const uniquePrompts = Array.from(
    new Set(
      resolvedTargets
        .map((target) => target.resolvedPrompt)
        .filter((prompt) => typeof prompt === "string")
    )
  );

  if (uniquePrompts.length <= 1) {
    return uniquePrompts[0] ?? "";
  }

  return resolvedTargets
    .map((target) => `[${getRuntimeSiteLabel(target.id)}]\n${target.resolvedPrompt}`)
    .join("\n\n---\n\n");
}

async function loadStoredData() {
  try {
    const [history, favorites, variableCache, runtimeSites, promptResult, failedSelectors, settings] = await Promise.all([
      getPromptHistory(),
      getPromptFavorites(),
      getTemplateVariableCache(),
      getRuntimeSites(),
      chrome.storage.local.get(["lastPrompt"]),
      getFailedSelectors(),
      getAppSettings(),
    ]);

    state.history = history;
    state.favorites = favorites;
    state.templateVariableCache = variableCache;
    state.runtimeSites = runtimeSites;
    state.failedSelectors = new Map(failedSelectors.map((entry) => [entry.serviceId, entry]));
    state.settings = settings;

    await refreshOpenSiteTabs();

    if (typeof promptResult.lastPrompt === "string" && !promptInput.value.trim()) {
      promptInput.value = promptResult.lastPrompt;
    }

    applySettingsToControls();
    renderSiteCheckboxesPanel();
    renderManagedSites();
    updatePromptCounter();
    autoResizePromptInput();
    renderTemplateSummary();
    renderLists();
  } catch (error) {
    console.error("[AI Prompt Broadcaster] Failed to load stored data.", error);
    throw error;
  }
}

async function refreshStoredData() {
  try {
    const [history, favorites, variableCache, runtimeSites, failedSelectors, settings] = await Promise.all([
      getPromptHistory(),
      getPromptFavorites(),
      getTemplateVariableCache(),
      getRuntimeSites(),
      getFailedSelectors(),
      getAppSettings(),
    ]);

    state.history = history;
    state.favorites = favorites;
    state.templateVariableCache = variableCache;
    state.runtimeSites = runtimeSites;
    state.failedSelectors = new Map(failedSelectors.map((entry) => [entry.serviceId, entry]));
    state.settings = settings;
    await refreshOpenSiteTabs();
    applySettingsToControls();
    renderSiteCheckboxesPanel();
    renderManagedSites();
    renderLists();
  } catch (error) {
    console.error("[AI Prompt Broadcaster] Failed to refresh stored data.", error);
    throw error;
  }
}

const {
  getFavoriteById,
  setFavoriteModalError,
  hideFavoriteModal,
  dismissFavoriteModal,
  openFavoriteModal,
  openFavoriteEditor,
  runFavoriteItem,
  runFavoriteFromEditor,
  bindFavoriteEditorEvents,
} = createFavoriteEditorFeature({
  checkedSiteIds,
  getEnabledSites,
  getRuntimeSiteLabel,
  refreshStoredData,
  setStatus,
  showAppToast,
  getUnknownErrorText,
  openOverlay,
  closeOverlay,
});

async function maybeHandlePopupFavoriteIntent() {
  const intent = await consumePopupFavoriteIntent().catch(() => null);
  if (!intent?.favoriteId) {
    return;
  }

  const favorite = getFavoriteById(intent.favoriteId);
  if (!favorite) {
    return;
  }

  openFavoriteEditor(favorite, {
    reason: intent.type === "run" ? intent.reason || t.favoriteRunNeedsEditor : "",
  });
}

function setLoadedTemplateContext(item) {
  state.loadedTemplateDefaults =
    item && item.templateDefaults && typeof item.templateDefaults === "object"
      ? { ...item.templateDefaults }
      : {};
  state.loadedFavoriteTitle = typeof item?.title === "string" ? item.title : "";
  state.loadedFavoriteId = typeof item?.id === "string" ? item.id : "";
}

function loadPromptIntoComposer(item) {
  promptInput.value = item.text;
  applySiteSelection(getHistorySelectedSiteIds(item));
  setLoadedTemplateContext(item);
  renderTemplateSummary();
  switchTab("compose");
  promptInput.focus();
  setStatus(t.importedLoad, "success");
  showAppToast(t.importedLoad, "info", 2200);
}

function setCardStatesFromBroadcast(summary) {
  document.querySelectorAll(".site-card.sent, .site-card.failed, .site-card.sending").forEach((card) => {
    card.classList.remove("sending", "sent", "failed");
    card.querySelector(".retry-btn")?.remove();
  });

  if (!summary?.siteIds?.length) {
    return;
  }

  summary.siteIds.forEach((siteId) => {
    const status = summary.siteResults?.[siteId];
    const code = normalizeResultCode(status?.code ?? status);
    if (code === "submitted") {
      setSiteCardState(siteId, "sent");
      return;
    }

    if (status) {
      setSiteCardState(siteId, "failed");
      return;
    }

    if (summary.status === "sending") {
      setSiteCardState(siteId, "sending");
    }
  });
}

function applyLastBroadcastState(summary, { silentToast = false } = {}) {
  state.lastBroadcast = summary;

  if (!summary) {
    clearSendSafetyTimer();
    setSendingState(false);
    clearStatus();
    return;
  }

  setCardStatesFromBroadcast(summary);

  if (summary.status === "sending") {
    setStatus(t.sending(summary.total || summary.siteIds?.length || 0));
    setSendingState(true);
    const signature = buildBroadcastToastSignature(summary);
    if (!silentToast && state.lastBroadcastToastSignature !== signature) {
      showAppToast(t.restoredBroadcastSending, "info", 2600);
      state.lastBroadcastToastSignature = signature;
    }
    return;
  }

  clearSendSafetyTimer();
  setSendingState(false);

  const finishedAtMs = Date.parse(summary.finishedAt || "");
  const isRecent = Number.isFinite(finishedAtMs) && Date.now() - finishedAtMs <= 5 * 60 * 1000;
  const signature = buildBroadcastToastSignature(summary);
  const successCount = (summary.submittedSiteIds ?? []).length;
  const failedCount = (summary.failedSiteIds ?? []).length;

  if (summary.status === "submitted") {
    setStatus(t.sent(successCount || summary.total || summary.siteIds?.length || 0), "success");
  } else {
    const doneMessage = (msg("popup_broadcast_restored_done", [String(successCount), String(failedCount)]) ||
      `Last broadcast: ${successCount} success, ${failedCount} failed`);
    setStatus(doneMessage, failedCount > 0 ? "warning" : "success");
  }

  if (!silentToast && isRecent && state.lastBroadcastToastSignature !== signature) {
    const message = (msg("popup_broadcast_restored_done", [String(successCount), String(failedCount)]) ||
      `Last broadcast: ${successCount} success, ${failedCount} failed`);

    showAppToast(
      {
        message,
        type: failedCount > 0 ? "warning" : "info",
        duration: failedCount > 0 ? -1 : 4000,
      }
    );
    state.lastBroadcastToastSignature = signature;
  }
}

async function cancelCurrentBroadcast() {
  const broadcastId = state.lastBroadcast?.status === "sending"
    ? state.lastBroadcast.broadcastId
    : "";

  if (!broadcastId) {
    setSendingState(false);
    clearSendSafetyTimer();
    return;
  }

  cancelSendBtn.disabled = true;

  try {
    const response = await chrome.runtime.sendMessage({
      action: "cancelBroadcast",
      broadcastId,
    });

    if (!response?.ok) {
      throw new Error(response?.error ?? getUnknownErrorText());
    }

    applyLastBroadcastState(response.summary ?? await getLastBroadcast(), { silentToast: true });
    setStatus(t.broadcastCancelled, "warning");
    showAppToast(t.broadcastCancelled, "warning", 2600);
  } catch (error) {
    console.error("[AI Prompt Broadcaster] Failed to cancel broadcast.", error);
    setStatus(t.error(error?.message ?? getUnknownErrorText()), "error");
    showAppToast(t.error(error?.message ?? getUnknownErrorText()), "error", 4000);
    if (state.lastBroadcast?.status === "sending") {
      cancelSendBtn.disabled = false;
    }
  }
}

async function flushPendingSessionToasts() {
  const pendingToasts = await drainPendingUiToasts();
  pendingToasts.forEach((toast) => {
    showAppToast(toast);
  });
}

function getSiteCardElement(siteId) {
  return sitesContainer.querySelector(`[data-site-id="${CSS.escape(siteId)}"]`);
}

function setSiteCardState(siteId, cardState) {
  const card = getSiteCardElement(siteId);
  if (!card) {
    return;
  }
  card.classList.remove("sending", "sent", "failed");
  const retryBtn = card.querySelector(".retry-btn");
  if (retryBtn) {
    retryBtn.remove();
  }
  if (cardState) {
    card.classList.add(cardState);
  }
}

function addRetryButton(target, mainPrompt) {
  const siteId = target?.id;
  const card = getSiteCardElement(siteId);
  if (!card) {
    return;
  }
  const retryBtn = document.createElement("button");
  retryBtn.type = "button";
  retryBtn.className = "retry-btn";
  retryBtn.textContent = "Retry";
  retryBtn.addEventListener("click", async (event) => {
    event.preventDefault();
    event.stopPropagation();
    const site = state.runtimeSites.find((s) => s.id === siteId);
    if (!site) {
      return;
    }
    retryBtn.disabled = true;
    setSiteCardState(siteId, "sending");
    try {
      await refreshOpenSiteTabs();
      const response = await chrome.runtime.sendMessage({
        action: "broadcast",
        prompt: mainPrompt,
        sites: buildRuntimeBroadcastTargets([target]),
      });
      const failedIds = Array.isArray(response?.failedTabSiteIds) ? response.failedTabSiteIds : [];
      if (response?.ok && !failedIds.includes(siteId)) {
        setSiteCardState(siteId, "sent");
      } else {
        setSiteCardState(siteId, "failed");
        addRetryButton(target, mainPrompt);
      }
    } catch (_error) {
      setSiteCardState(siteId, "failed");
      addRetryButton(target, mainPrompt);
    }
  });
  card.appendChild(retryBtn);
}

function triggerRipple(button, event) {
  const rect = button.getBoundingClientRect();
  const size = Math.max(rect.width, rect.height);
  const x = event.clientX - rect.left - size / 2;
  const y = event.clientY - rect.top - size / 2;
  const ripple = document.createElement("span");
  ripple.className = "ripple";
  ripple.style.cssText = `width:${size}px;height:${size}px;left:${x}px;top:${y}px;`;
  button.appendChild(ripple);
  ripple.addEventListener("animationend", () => ripple.remove(), { once: true });
}

async function sendResolvedPrompt(mainPrompt, targets) {
  if (state.isSending) {
    return;
  }

  const siteIds = normalizeSiteIdList(
    (Array.isArray(targets) ? targets : []).map((target) => target?.id)
  );

  setSendingState(true);
  armSendSafetyTimer();

  siteIds.forEach((siteId) => setSiteCardState(siteId, "sending"));

  setStatus(t.sending(siteIds.length));

  try {
    await refreshOpenSiteTabs();
    await chrome.storage.local.set({ lastPrompt: promptInput.value });
    clearAllToasts();

    const response = await chrome.runtime.sendMessage({
      action: "broadcast",
      prompt: mainPrompt,
      sites: buildRuntimeBroadcastTargets(targets),
    });

    if (response?.ok) {
      if (Array.isArray(response.failedTabSiteIds)) {
        response.failedTabSiteIds.forEach((siteId) => {
          setSiteCardState(siteId, "failed");
          const failedTarget = targets.find((target) => target.id === siteId);
          if (failedTarget) {
            addRetryButton(failedTarget, mainPrompt);
          }
        });
      }

      setStatus(t.sending(response.createdSiteCount ?? siteIds.length), "warning");
      showAppToast(t.toastSendSuccess(response.createdSiteCount ?? siteIds.length), "success", 2200);

      if (state.settings.autoClosePopup) {
        window.close();
      }
    } else {
      siteIds.forEach((siteId) => {
        setSiteCardState(siteId, "failed");
        const failedTarget = targets.find((target) => target.id === siteId);
        if (failedTarget) {
          addRetryButton(failedTarget, mainPrompt);
        }
      });
      setStatus(t.error(response?.error ?? getUnknownErrorText()), "error");
    }
  } catch (error) {
    console.error("[AI Prompt Broadcaster] Broadcast send failed.", error);
    siteIds.forEach((siteId) => {
      setSiteCardState(siteId, "failed");
      const failedTarget = targets.find((target) => target.id === siteId);
      if (failedTarget) {
        addRetryButton(failedTarget, mainPrompt);
      }
    });
    setStatus(t.error(error?.message ?? getUnknownErrorText()), "error");
    showAppToast(t.error(error?.message ?? getUnknownErrorText()), "error", 4000);
    setSendingState(false);
    clearSendSafetyTimer();
  } finally {
    if (state.lastBroadcast?.status !== "sending") {
      setSendingState(false);
    }
  }
}

function hideTemplateModal() {
  state.pendingTemplateSend = null;
  closeOverlay(templateModal);
  templateModalError.hidden = true;
  templateModalError.textContent = "";
}

function hideResendModal() {
  state.pendingResendHistory = null;
  closeOverlay(resendModal);
}

function openResendModal(historyItem) {
  state.pendingResendHistory = historyItem;
  resendModalTitle.textContent = t.resendModalTitle;
  resendModalDesc.textContent = t.resendModalDesc;
  resendModalCancel.textContent = t.resendModalCancel;
  resendModalConfirm.textContent = t.resendModalConfirm;

  const requestedSiteIds = getHistorySelectedSiteIds(historyItem);
  const availableSiteIds = new Set(getEnabledSites().map((site) => site.id));

  resendModalSites.innerHTML = requestedSiteIds.map((siteId) => {
    const site = state.runtimeSites.find((entry) => entry.id === siteId);
    const disabled = !availableSiteIds.has(siteId);
    return `
      <label class="checkbox-row">
        <input type="checkbox" value="${escapeAttribute(siteId)}" data-resend-site="${escapeAttribute(siteId)}" ${disabled ? "disabled" : "checked"} />
        <span>${escapeHtml(site?.name ?? siteId)}${disabled ? ` (${escapeHtml(t.resendSiteUnavailable)})` : ""}</span>
      </label>
    `;
  }).join("");

  openOverlay(resendModal, resendModalSites.querySelector("input:not([disabled])"));
}

async function confirmResendModal() {
  const historyItem = state.pendingResendHistory;
  if (!historyItem) {
    return;
  }

  const selectedSiteIds = [...resendModalSites.querySelectorAll("[data-resend-site]:checked")]
    .map((checkbox) => checkbox.value)
    .filter(Boolean);

  if (selectedSiteIds.length === 0) {
    setStatus(t.warnNoSite, "error");
    return;
  }

  hideResendModal();
  await sendResolvedPrompt(historyItem.text, selectedSiteIds.map((siteId) => ({ id: siteId })));
}

function openImportReportModal(summary) {
  state.pendingImportSummary = summary;
  importReportModalTitle.textContent = t.importReportTitle;
  importReportModalDesc.textContent = t.importReportDesc;
  importReportModalConfirm.textContent = t.importReportClose;
  importReportBody.innerHTML = buildImportReportMarkup(summary);
  openOverlay(importReportModal, importReportModalClose);
}

function hideImportReportModal() {
  state.pendingImportSummary = null;
  closeOverlay(importReportModal);
}

function getPromptButtonsForActiveTab() {
  if (state.activeTab === "history") {
    return [...historyList.querySelectorAll("[data-load-history]")];
  }

  if (state.activeTab === "favorites") {
    return [...favoritesList.querySelectorAll("[data-load-favorite], [data-edit-favorite]")];
  }

  return [];
}

function focusAdjacentPromptButton(direction) {
  const buttons = getPromptButtonsForActiveTab();
  if (buttons.length === 0) {
    return;
  }

  const currentIndex = buttons.findIndex((button) => button === document.activeElement);
  const nextIndex = currentIndex === -1
    ? (direction > 0 ? 0 : buttons.length - 1)
    : (currentIndex + direction + buttons.length) % buttons.length;
  buttons[nextIndex]?.focus?.();
}

async function handleGlobalShortcut(event) {
  if (event.defaultPrevented) {
    return;
  }

  const shortcutKey = event.key.toLowerCase();
  const hasPrimaryModifier = event.ctrlKey || event.metaKey;

  if (event.key === "Escape") {
    if (closeActiveOverlayOrMenu()) {
      event.preventDefault();
    }
    return;
  }

  if (getOpenOverlay()) {
    return;
  }

  if (hasPrimaryModifier && event.shiftKey && event.key === "Enter") {
    event.preventDefault();
    await cancelCurrentBroadcast();
    return;
  }

  if (hasPrimaryModifier && !event.shiftKey && event.key === "Enter") {
    event.preventDefault();
    await handleSend();
    return;
  }

  if (hasPrimaryModifier && !event.shiftKey && ["1", "2", "3", "4"].includes(shortcutKey)) {
    event.preventDefault();
    switchTab(["compose", "history", "favorites", "settings"][Number(shortcutKey) - 1]);
    return;
  }

  if (hasPrimaryModifier && !event.shiftKey && shortcutKey === "a" && state.activeTab === "compose" && !isTextEditingTarget(event.target)) {
    event.preventDefault();
    toggleAllBtn.click();
    return;
  }

  if ((event.key === "ArrowDown" || event.key === "ArrowUp") && !isTextEditingTarget(event.target)) {
    if (state.activeTab === "history" || state.activeTab === "favorites") {
      event.preventDefault();
      focusAdjacentPromptButton(event.key === "ArrowDown" ? 1 : -1);
    }
  }
}

function resetTransientModals() {
  hideTemplateModal();
  hideFavoriteModal();
  hideResendModal();
  hideImportReportModal();
}

function setTemplateModalError(message = "") {
  templateModalError.hidden = !message;
  templateModalError.textContent = message;
}

async function ensureClipboardReadPermission() {
  try {
    if (!chrome.permissions?.contains || !chrome.permissions?.request) {
      return false;
    }

    const permission = { permissions: ["clipboardRead"] };
    const alreadyGranted = await chrome.permissions.contains(permission);

    if (alreadyGranted) {
      return true;
    }

    return await chrome.permissions.request(permission);
  } catch (error) {
    console.error("[AI Prompt Broadcaster] Failed to request clipboardRead permission.", error);
    return false;
  }
}

async function resolveAsyncTemplateVariables(variables) {
  const needsTabContext = variables.some(
    (v) =>
      v.name === SYSTEM_TEMPLATE_VARIABLES.url ||
      v.name === SYSTEM_TEMPLATE_VARIABLES.title ||
      v.name === SYSTEM_TEMPLATE_VARIABLES.selection
  );
  const needsCounter = variables.some((v) => v.name === SYSTEM_TEMPLATE_VARIABLES.counter);

  const extra = {};

  if (needsTabContext) {
    try {
      const response = await chrome.runtime.sendMessage({ action: "getActiveTabContext" }).catch(() => null);
      if (response?.ok) {
        extra.url = response.url ?? "";
        extra.title = response.title ?? "";
        extra.selection = response.selection ?? "";
      }
    } catch (_error) {
      // fall through with empty values
    }
  }

  if (needsCounter) {
    try {
      const response = await chrome.runtime.sendMessage({ action: "getBroadcastCounter" }).catch(() => null);
      extra.counter = response?.counter != null ? String(Number(response.counter) + 1) : "1";
    } catch (_error) {
      extra.counter = "1";
    }
  }

  return extra;
}

async function readClipboardTemplateValue() {
  try {
    const hasPermission = await ensureClipboardReadPermission();
    if (!hasPermission) {
      return {
        ok: false,
        text: "",
        error: "clipboardRead permission was not granted.",
      };
    }

    if (!navigator.clipboard?.readText) {
      return {
        ok: false,
        text: "",
        error: "Clipboard API is not available in this context.",
      };
    }

    const text = await navigator.clipboard.readText();
    return { ok: true, text };
  } catch (error) {
    console.error("[AI Prompt Broadcaster] Failed to read clipboard for template variable.", error);
    return {
      ok: false,
      text: "",
      error: error?.message ?? String(error),
    };
  }
}

async function maybeMarkLoadedFavoriteAsUsed() {
  if (!state.loadedFavoriteId) {
    return;
  }

  try {
    await markFavoriteUsed(state.loadedFavoriteId);
    state.favorites = await getPromptFavorites();
  } catch (error) {
    console.error("[AI Prompt Broadcaster] Failed to update favorite usage.", error);
  }
}

function buildTemplateSendPreviewState() {
  const modalState = state.pendingTemplateSend;
  if (!modalState) {
    return null;
  }

  const values = mergeTemplateSources(modalState.systemValues, modalState.userValues);
  const preview = renderTemplatePrompt(modalState.prompt, values);
  const missingUserValues = findMissingTemplateValues(modalState.prompt, modalState.userValues);
  const clipboardRequired = modalState.variables.some((variable) => variable.name === "클립보드");
  const clipboardMissing = clipboardRequired && !String(modalState.systemValues["클립보드"] ?? "").length;

  return {
    values,
    preview,
    missingUserValues,
    clipboardMissing,
  };
}

function renderTemplateModal() {
  const modalState = state.pendingTemplateSend;
  if (!modalState) {
    return;
  }

  templateModalTitle.textContent = t.templateModalTitle;
  templateModalDesc.textContent = t.templateModalDesc;
  templatePreviewLabel.textContent = t.templatePreviewLabel;
  templateModalCancel.textContent = t.templateModalCancel;
  templateModalConfirm.textContent = t.templateModalConfirm;

  const automaticVariables = modalState.variables.filter((variable) => variable.kind === "system");
  if (automaticVariables.length > 0) {
    const labels = automaticVariables.map((variable) => `{{${variable.name}}}`).join(", ");
    const notices = [t.templateSystemNotice, labels];

    if (automaticVariables.some((variable) => variable.name === "클립보드")) {
      notices.push(t.templateClipboardNotice);
    }

    templateModalSystemInfo.hidden = false;
    templateModalSystemInfo.textContent = notices.join(" · ");
  } else {
    templateModalSystemInfo.hidden = true;
    templateModalSystemInfo.textContent = "";
  }

  const userVariables = modalState.variables.filter((variable) => variable.kind === "user");
  templateFields.innerHTML = userVariables
    .map((variable) => {
      const value = modalState.userValues[variable.name] ?? "";
      return `
        <label class="field-stack">
          <span>${escapeHtml(t.templateFieldLabel(variable.name))}</span>
          <input
            class="search-input"
            type="text"
            data-template-input="${escapeAttribute(variable.name)}"
            value="${escapeAttribute(value)}"
            placeholder="${escapeAttribute(t.templateFieldPlaceholder(variable.name))}"
          />
        </label>
      `;
    })
    .join("");

  const previewState = buildTemplateSendPreviewState();
  const errorMessage = previewState?.clipboardMissing
    ? t.templateClipboardError
    : previewState && previewState.missingUserValues.length > 0
      ? t.templateMissingValues
      : "";

  templatePreview.textContent = previewState?.preview ?? modalState.prompt;
  setTemplateModalError(errorMessage);
  templateModalConfirm.disabled = Boolean(errorMessage);
}

async function openTemplateModal(prompt, sites) {
  const variables = detectTemplateVariables(prompt);

  if (variables.length === 0) {
    await sendResolvedPrompt(prompt, sites);
    return;
  }

  const baseDefaults = mergeTemplateSources(
    state.templateVariableCache,
    state.loadedTemplateDefaults
  );

  const userValues = Object.fromEntries(
    variables
      .filter((variable) => variable.kind === "user")
      .map((variable) => [variable.name, baseDefaults[variable.name] ?? ""])
  );

  const systemValues = buildSystemTemplateValues(new Date());
  if (variables.some((variable) => variable.name === "클립보드")) {
    const clipboardResult = await readClipboardTemplateValue();
    if (clipboardResult.ok) {
      systemValues["클립보드"] = clipboardResult.text;
    }
  }

  state.pendingTemplateSend = {
    prompt,
    sites,
    variables,
    userValues,
    systemValues,
  };

  renderTemplateModal();
  openOverlay(templateModal, templateFields.querySelector("input") ?? templateModalConfirm);
}

async function confirmTemplateModalSend() {
  const modalState = state.pendingTemplateSend;
  if (!modalState) {
    return;
  }

  renderTemplateModalV2();
  const previewState = buildTemplateSendPreviewStateV2();

  if (!previewState || previewState.missingUserValues.length > 0 || previewState.clipboardMissing) {
    return;
  }

  const cachedValues = compactVariableValues(modalState.userValues);
  await updateTemplateVariableCache(cachedValues);
  state.templateVariableCache = mergeTemplateSources(state.templateVariableCache, cachedValues);

  const resolvedTargets = buildResolvedBroadcastTargets(modalState.targets, previewState.values);
  hideTemplateModal();
  await maybeMarkLoadedFavoriteAsUsed();
  await sendResolvedPrompt(modalState.prompt, resolvedTargets);
}

function buildTemplateSendPreviewStateV2() {
  const modalState = state.pendingTemplateSend;
  if (!modalState) {
    return null;
  }

  const values = mergeTemplateSources(modalState.systemValues, modalState.userValues);
  const preview = buildTemplatePreviewText(modalState.targets, values);
  const missingUserValues = findMissingTemplateValuesForTargets(
    modalState.targets,
    modalState.userValues
  );
  const clipboardRequired = modalState.variables.some(
    (variable) => variable.name === SYSTEM_TEMPLATE_VARIABLES.clipboard
  );
  const clipboardMissing =
    clipboardRequired && !String(modalState.systemValues[SYSTEM_TEMPLATE_VARIABLES.clipboard] ?? "").length;

  return {
    values,
    preview,
    missingUserValues,
    clipboardMissing,
  };
}

function renderTemplateModalV2() {
  const modalState = state.pendingTemplateSend;
  if (!modalState) {
    return;
  }

  templateModalTitle.textContent = t.templateModalTitle;
  templateModalDesc.textContent = t.templateModalDesc;
  templatePreviewLabel.textContent = t.templatePreviewLabel;
  templateModalCancel.textContent = t.templateModalCancel;
  templateModalConfirm.textContent = t.templateModalConfirm;

  const automaticVariables = modalState.variables.filter((variable) => variable.kind === "system");
  if (automaticVariables.length > 0) {
    const labels = automaticVariables
      .map((variable) => `{{${getTemplateDisplayName(variable.name)}}}`)
      .join(", ");
    const notices = [t.templateSystemNotice, labels];

    if (automaticVariables.some((variable) => variable.name === SYSTEM_TEMPLATE_VARIABLES.clipboard)) {
      notices.push(t.templateClipboardNotice);
    }

    templateModalSystemInfo.hidden = false;
    templateModalSystemInfo.textContent = notices.join(" · ");
  } else {
    templateModalSystemInfo.hidden = true;
    templateModalSystemInfo.textContent = "";
  }

  const userVariables = modalState.variables.filter((variable) => variable.kind === "user");
  templateFields.innerHTML = userVariables
    .map((variable) => {
      const value = modalState.userValues[variable.name] ?? "";
      return `
        <label class="field-stack">
          <span>${escapeHtml(t.templateFieldLabel(variable.name))}</span>
          <input
            class="search-input"
            type="text"
            data-template-input="${escapeAttribute(variable.name)}"
            value="${escapeAttribute(value)}"
            placeholder="${escapeAttribute(t.templateFieldPlaceholder(variable.name))}"
          />
        </label>
      `;
    })
    .join("");

  const previewState = buildTemplateSendPreviewStateV2();
  const errorMessage = previewState?.clipboardMissing
    ? t.templateClipboardError
    : previewState && previewState.missingUserValues.length > 0
      ? t.templateMissingValues
      : "";

  templatePreview.textContent = previewState?.preview ?? modalState.prompt;
  setTemplateModalError(errorMessage);
  templateModalConfirm.disabled = Boolean(errorMessage);
}

async function openTemplateModalV2(prompt, targets) {
  const variables = detectTemplateVariablesForTargets(targets);

  if (variables.length === 0) {
    await maybeMarkLoadedFavoriteAsUsed();
    await sendResolvedPrompt(prompt, buildResolvedBroadcastTargets(targets));
    return;
  }

  const baseDefaults = mergeTemplateSources(
    state.templateVariableCache,
    state.loadedTemplateDefaults
  );

  const userValues = Object.fromEntries(
    variables
      .filter((variable) => variable.kind === "user")
      .map((variable) => [variable.name, baseDefaults[variable.name] ?? ""])
  );

  // Resolve async system variables (url, title, selection, counter)
  const asyncExtra = await resolveAsyncTemplateVariables(variables);

  const systemValues = buildSystemTemplateValues(new Date(), {
    locale: isKorean ? "ko" : "en",
    extra: asyncExtra,
  });

  if (variables.some((variable) => variable.name === SYSTEM_TEMPLATE_VARIABLES.clipboard)) {
    const clipboardResult = await readClipboardTemplateValue();
    if (clipboardResult.ok) {
      systemValues[SYSTEM_TEMPLATE_VARIABLES.clipboard] = clipboardResult.text;
    }
  }

  state.pendingTemplateSend = {
    prompt,
    targets,
    variables,
    userValues,
    systemValues,
  };

  renderTemplateModalV2();
  openOverlay(templateModal, templateFields.querySelector("input") ?? templateModalConfirm);
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
  serviceLastVerifiedLabel.textContent = t.serviceFieldLastVerified;
  serviceVerifiedVersionLabel.textContent = t.serviceFieldVerifiedVersion;
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
    button.textContent = t.tabs[button.dataset.tab];
  });

  applyDynamicPromptPlaceholder();
  updatePromptCounter();
}

function renderSiteCheckboxes() {
  const previousSelection = new Set(checkedSiteIds());
  sitesContainer.innerHTML = "";

  getEnabledSites().forEach((site) => {
    const card = document.createElement("label");
    card.className = "site-card checked";
    card.htmlFor = `site-${site.id}`;
    card.style.setProperty("--site-color", site.color || "#c24f2e");

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
    siteName.textContent = `${getRuntimeSiteLabel(site.id)}`;

    const selectorWarning = state.failedSelectors.get(site.id);
    if (selectorWarning) {
      card.classList.add("selector-warning");
      card.title = t.selectorWarningTooltip;
    }

    checkbox.addEventListener("change", () => {
      card.classList.toggle("checked", checkbox.checked);
      syncToggleAllLabel();
      renderTemplateSummary();
    });

    const siteStatus = document.createElement("span");
    siteStatus.className = "site-status";
    siteStatus.setAttribute("aria-hidden", "true");

    const warningIcon = document.createElement("span");
    warningIcon.className = "site-warning";
    warningIcon.setAttribute("aria-hidden", "true");
    warningIcon.textContent = selectorWarning ? "⚠" : "";

    card.classList.toggle("checked", checkbox.checked);
    card.append(checkbox, siteIcon, siteName, warningIcon, siteStatus);
    sitesContainer.appendChild(card);
  });

  syncToggleAllLabel();
  setCardStatesFromBroadcast(state.lastBroadcast);
}

function renderSiteCheckboxesPanel() {
  const previousSelection = new Set(checkedSiteIds());
  sitesContainer.innerHTML = "";

  getEnabledSites().forEach((site) => {
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
    siteName.textContent = `${getRuntimeSiteLabel(site.id)}`;

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
        `${getRuntimeSiteLabel(site.id)} ${checkbox.checked ? t.ariaSelected : t.ariaNotSelected}`
      );
      syncToggleAllLabel();
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
      `${getRuntimeSiteLabel(site.id)} ${checkbox.checked ? t.ariaSelected : t.ariaNotSelected}`
    );
    card.appendChild(mainRow);

    const openTabs = getOpenSiteTabs(site.id);
    const selectedTarget = state.siteTargetSelections?.[site.id] ?? getDefaultSiteTargetSelection();

    if (openTabs.length > 0) {
      const tabsWrap = document.createElement("div");
      tabsWrap.className = "site-tabs";

      const tabsHead = document.createElement("div");
      tabsHead.className = "site-tabs-head";
      tabsHead.textContent = t.openTabsTitle(openTabs.length);

      const tabsList = document.createElement("div");
      tabsList.className = "site-tabs-list";
      const radioName = `site-target-${site.id}`;

      const appendTargetOption = (choiceValue, title, detail, pillText = "") => {
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
          syncToggleAllLabel();
        });

        tabsList.appendChild(option);
      };

      appendTargetOption(
        "default",
        t.openTabsUseDefault,
        t.openTabsUseDefaultDetail(getDefaultTargetModeLabel())
      );
      appendTargetOption(
        "new",
        t.openTabsAlwaysNew,
        t.openTabsAlwaysNewDetail
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
          pillText
        );
      });

      tabsWrap.append(tabsHead, tabsList);
      card.appendChild(tabsWrap);
    }

    // Per-service prompt override toggle
    const overrideToggleRow = document.createElement("div");
    overrideToggleRow.className = "site-override-toggle-row";

    const overrideToggle = document.createElement("button");
    const hasOverride = Boolean(state.sitePromptOverrides?.[site.id]?.trim());
    overrideToggle.className = `ghost-button small-button site-override-toggle${hasOverride ? " active" : ""}`;
    overrideToggle.type = "button";
    overrideToggle.dataset.siteOverrideToggle = site.id;
    overrideToggle.title = msg("popup_override_prompt_label") || "Custom prompt for this service";
    overrideToggle.textContent = hasOverride ? "✎ " + (msg("popup_override_active") || "Custom") : "✎";

    const overrideWrap = document.createElement("div");
    overrideWrap.className = "site-override-wrap";
    overrideWrap.hidden = !hasOverride;

    const overrideTextarea = document.createElement("textarea");
    overrideTextarea.className = "site-override-textarea";
    overrideTextarea.rows = 3;
    overrideTextarea.placeholder = msg("popup_override_prompt_placeholder") || "Override prompt for this service only…";
    overrideTextarea.value = state.sitePromptOverrides?.[site.id] ?? "";
    overrideTextarea.dataset.siteOverrideInput = site.id;

    overrideTextarea.addEventListener("input", () => {
      state.sitePromptOverrides[site.id] = overrideTextarea.value;
      const nowActive = Boolean(overrideTextarea.value.trim());
      overrideToggle.classList.toggle("active", nowActive);
      overrideToggle.textContent = nowActive ? "✎ " + (msg("popup_override_active") || "Custom") : "✎";
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

  syncToggleAllLabel();
  setCardStatesFromBroadcast(state.lastBroadcast);
}

function setServiceEditorError(message = "") {
  serviceEditorError.hidden = !message;
  serviceEditorError.textContent = message;
}

function setServiceTestResult(message = "", isError = false) {
  serviceTestResult.hidden = !message;
  serviceTestResult.textContent = message;
  serviceTestResult.style.background = isError
    ? "rgba(181, 59, 59, 0.12)"
    : "rgba(255, 196, 0, 0.12)";
  serviceTestResult.style.color = isError ? "var(--danger)" : "var(--text)";
}

function resetServiceEditorForm() {
  serviceNameInput.value = "";
  serviceUrlInput.value = "";
  serviceInputSelectorInput.value = "";
  document.querySelector("input[name='service-input-type'][value='textarea']").checked = true;
  serviceSubmitSelectorInput.value = "";
  serviceSubmitMethodSelect.value = "click";
  serviceFallbackSelectorsInput.value = "";
  serviceAuthSelectorsInput.value = "";
  serviceHostnameAliasesInput.value = "";
  serviceHostnameAliasesInput.disabled = false;
  serviceLastVerifiedInput.value = "";
  serviceVerifiedVersionInput.value = "";
  serviceWaitRange.value = "2000";
  serviceWaitValue.textContent = "2000ms";
  serviceColorInput.value = "#c24f2e";
  serviceIconInput.value = "AI";
  serviceEnabledInput.checked = true;
  serviceUrlInput.disabled = false;
  state.serviceEditor = null;
  setServiceEditorError("");
  setServiceTestResult("");
}

function hideServiceEditor() {
  serviceEditor.hidden = true;
  resetServiceEditorForm();
}

function populateServiceEditor(site) {
  state.serviceEditor = {
    mode: site ? "edit" : "add",
    siteId: site?.id ?? "",
    isBuiltIn: Boolean(site?.isBuiltIn),
    selectorCheckMode: site?.selectorCheckMode ?? "input-and-submit",
  };

  serviceEditorTitle.textContent =
    state.serviceEditor.mode === "edit" ? t.serviceEditorEditTitle : t.serviceEditorAddTitle;
  serviceNameInput.value = site?.name ?? "";
  serviceUrlInput.value = site?.url ?? "";
  serviceInputSelectorInput.value = site?.inputSelector ?? "";
  const inputTypeOption = document.querySelector(
    `input[name='service-input-type'][value='${site?.inputType ?? "textarea"}']`
  );
  if (inputTypeOption) {
    inputTypeOption.checked = true;
  }
  serviceSubmitSelectorInput.value = site?.submitSelector ?? "";
  serviceSubmitMethodSelect.value = site?.submitMethod ?? "click";
  serviceFallbackSelectorsInput.value = joinMultilineValues(site?.fallbackSelectors);
  serviceAuthSelectorsInput.value = joinMultilineValues(site?.authSelectors);
  serviceHostnameAliasesInput.value = joinMultilineValues(site?.hostnameAliases);
  serviceHostnameAliasesInput.disabled = Boolean(site?.isBuiltIn);
  serviceLastVerifiedInput.value = site?.lastVerified ?? "";
  serviceVerifiedVersionInput.value = site?.verifiedVersion ?? "";
  serviceWaitRange.value = String(site?.waitMs ?? 2000);
  serviceWaitValue.textContent = `${site?.waitMs ?? 2000}ms`;
  serviceColorInput.value = site?.color ?? "#c24f2e";
  serviceIconInput.value = site?.icon ?? "AI";
  serviceEnabledInput.checked = site?.enabled ?? true;
  serviceUrlInput.disabled = Boolean(site?.isBuiltIn);
  setServiceEditorError("");
  setServiceTestResult("");
  serviceEditor.hidden = false;
}

function buildManagedSiteMarkup(site) {
  const chips = [
    `<span class="managed-site-chip">${escapeHtml(site.isBuiltIn ? t.serviceBuiltInBadge : t.serviceCustomBadge)}</span>`,
    `<span class="managed-site-chip">${escapeHtml(site.inputType)}</span>`,
    `<span class="managed-site-chip">${escapeHtml(`${site.waitMs}ms`)}</span>`,
  ];
  const selectorWarning = state.failedSelectors.get(site.id);
  const lastVerifiedStatus = getSiteLastVerifiedStatus(site);
  const selectorWarningMarkup = selectorWarning
    ? `
      <div class="selector-report-row">
        <span class="selector-days-since">${escapeHtml(lastVerifiedStatus || (msg("popup_selector_warning_desc") || "Selector may have changed."))}</span>
        <a
          class="ghost-button small-button selector-report-link"
          href="${escapeAttribute(getSiteSelectorIssueUrl(site))}"
          target="_blank"
          rel="noopener noreferrer"
          title="${escapeAttribute(msg("popup_selector_report_tooltip") || "Open GitHub Issues")}"
        >${escapeHtml(msg("popup_selector_report_btn") || "Report")}</a>
      </div>
    `
    : "";

  if (!site.enabled) {
    chips.push(`<span class="managed-site-chip">${escapeHtml(t.serviceDisabledLabel)}</span>`);
  }

  return `
    <article class="managed-site-card" data-managed-site-id="${escapeAttribute(site.id)}">
      <div class="managed-site-head">
        <div class="managed-site-title">
          <span class="site-icon" style="--site-color:${escapeAttribute(site.color)}">${escapeHtml(getSiteIcon(site))}</span>
          <div class="managed-site-name-wrap">
            <span class="managed-site-name">${escapeHtml(site.name)}</span>
            <span class="managed-site-url">${escapeHtml(site.url)}</span>
          </div>
        </div>
        <label class="toggle-switch">
          <input type="checkbox" data-action="toggle-service" data-site-id="${escapeAttribute(site.id)}" ${site.enabled ? "checked" : ""} />
          <span>${escapeHtml(t.serviceFieldEnabled)}</span>
        </label>
      </div>
      <div class="managed-site-meta">${chips.join("")}</div>
      ${selectorWarningMarkup}
      <div class="managed-site-actions">
        <button class="ghost-button" type="button" data-action="edit-service" data-site-id="${escapeAttribute(site.id)}">${escapeHtml(t.serviceEdit)}</button>
        ${site.deletable ? `<button class="ghost-button danger-button" type="button" data-action="delete-service" data-site-id="${escapeAttribute(site.id)}">${escapeHtml(t.serviceDelete)}</button>` : ""}
      </div>
    </article>
  `;
}

function renderManagedSites() {
  if (state.runtimeSites.length === 0) {
    managedSitesList.innerHTML = `<div class="managed-site-empty">${escapeHtml(t.serviceEmptyList)}</div>`;
    return;
  }

  managedSitesList.innerHTML = state.runtimeSites
    .map((site) => buildManagedSiteMarkup(site))
    .join("");
}

function readServiceEditorDraft() {
  const selectedInputType = document.querySelector("input[name='service-input-type']:checked");

  return {
    id: state.serviceEditor?.siteId ?? "",
    name: serviceNameInput.value.trim(),
    url: serviceUrlInput.value.trim(),
    inputSelector: serviceInputSelectorInput.value.trim(),
    inputType: selectedInputType?.value ?? "textarea",
    submitSelector: serviceSubmitSelectorInput.value.trim(),
    submitMethod: serviceSubmitMethodSelect.value,
    selectorCheckMode: state.serviceEditor?.selectorCheckMode ?? "input-and-submit",
    fallbackSelectors: splitMultilineValues(serviceFallbackSelectorsInput.value),
    authSelectors: splitMultilineValues(serviceAuthSelectorsInput.value),
    hostnameAliases: splitMultilineValues(serviceHostnameAliasesInput.value),
    lastVerified: serviceLastVerifiedInput.value.trim(),
    verifiedVersion: serviceVerifiedVersionInput.value.trim(),
    waitMs: Number(serviceWaitRange.value),
    color: serviceColorInput.value,
    icon: serviceIconInput.value.trim(),
    enabled: serviceEnabledInput.checked,
  };
}

async function ensureSiteOriginPermission(url, hostnameAliases = []) {
  try {
    const patterns = buildSitePermissionPatterns(url, hostnameAliases);
    if (patterns.length === 0) {
      return false;
    }

    const permission = { origins: patterns };
    const alreadyGranted = await chrome.permissions.contains(permission);
    if (alreadyGranted) {
      return true;
    }

    return await chrome.permissions.request(permission);
  } catch (error) {
    console.error("[AI Prompt Broadcaster] Failed to request site host permission.", error);
    return false;
  }
}

async function testSelectorOnActiveTab() {
  if (!serviceInputSelectorInput.value.trim()) {
    setServiceTestResult(t.serviceTestNoSelector, true);
    return;
  }

  try {
    const response = await chrome.runtime.sendMessage({
      action: "service-test:run",
      draft: readServiceEditorDraft(),
      isBuiltIn: Boolean(state.serviceEditor?.isBuiltIn),
    });
    const result = buildServiceTestResultMessage(response);
    setServiceTestResult(result.message, result.isError);
  } catch (error) {
    console.error("[AI Prompt Broadcaster] Selector test failed.", error);
    setServiceTestResult(t.serviceTestError(error?.message ?? getUnknownErrorText()), true);
  }
}

async function saveServiceEditorDraft() {
  const draft = readServiceEditorDraft();
  const isBuiltIn = Boolean(state.serviceEditor?.isBuiltIn);
  const validation = validateSiteDraft(draft, { isBuiltIn });

  if (!validation.valid) {
    setServiceEditorError(validation.errors.join(" "));
    return;
  }

  if (!isBuiltIn) {
    const granted = await ensureSiteOriginPermission(draft.url, draft.hostnameAliases);
    if (!granted) {
      setServiceEditorError(t.servicePermissionDenied);
      return;
    }
  }

  try {
    if (isBuiltIn) {
      await saveBuiltInSiteOverride(state.serviceEditor.siteId, draft);
      await setRuntimeSiteEnabled(state.serviceEditor.siteId, draft.enabled);
    } else {
      await saveCustomSite(draft);
    }

    await refreshStoredData();
    hideServiceEditor();
    setStatus(t.serviceSaved, "success");
    showAppToast(t.serviceSaved, "success", 2200);
  } catch (error) {
    console.error("[AI Prompt Broadcaster] Failed to save service settings.", error);
    setServiceEditorError(error?.message ?? t.serviceValidationError);
  }
}

async function deleteManagedSite(siteId) {
  try {
    await deleteCustomSite(siteId);
    await refreshStoredData();
    setStatus(t.serviceDeleted, "success");
    showAppToast(t.serviceDeleted, "info", 2200);
  } catch (error) {
    console.error("[AI Prompt Broadcaster] Failed to delete custom site.", error);
    setStatus(t.error(error?.message ?? getUnknownErrorText()), "error");
  }
}

function setFavoriteTitleInState(favoriteId, title) {
  state.favorites = state.favorites.map((item) =>
    String(item.id) === String(favoriteId)
      ? { ...item, title }
      : item
  );
}

function scheduleFavoriteTitleSave(favoriteId, title, immediate = false) {
  const timer = state.favoriteSaveTimers.get(favoriteId);
  if (timer) {
    window.clearTimeout(timer);
  }

  setFavoriteTitleInState(favoriteId, title);

  const runSave = async () => {
    try {
      await updateFavoriteTitle(favoriteId, title);
      setStatus(t.titleSaved, "success");
      showAppToast(t.titleSaved, "success", 1500);
    } catch (error) {
      console.error("[AI Prompt Broadcaster] Failed to save favorite title.", error);
      setStatus(t.error(error?.message ?? getUnknownErrorText()), "error");
    }
  };

  if (immediate) {
    state.favoriteSaveTimers.delete(favoriteId);
    void runSave();
    return;
  }

  const nextTimer = window.setTimeout(() => {
    state.favoriteSaveTimers.delete(favoriteId);
    void runSave();
  }, 300);

  state.favoriteSaveTimers.set(favoriteId, nextTimer);
}

async function handleHistoryAction(action, historyId) {
  const item = state.history.find((entry) => Number(entry.id) === Number(historyId));
  if (!item) {
    return;
  }

  if (action === "favorite") {
    await addFavoriteFromHistory(item);
    state.favorites = await getPromptFavorites();
    state.openMenuKey = null;
    renderFavoritesList();
    renderHistoryList();
    setStatus(t.favoriteAdded, "success");
    showAppToast(t.favoriteAdded, "success", 2200);
    return;
  }

  if (action === "resend-history") {
    state.openMenuKey = null;
    renderHistoryList();
    openResendModal(item);
    return;
  }

  if (action === "delete-history") {
    await deletePromptHistoryItem(historyId);
    state.history = await getPromptHistory();
    state.openMenuKey = null;
    renderHistoryList();
    setStatus(t.historyDeleted, "success");
    showAppToast(t.toastHistoryDeleted, "info", 2200);
  }
}

async function handleFavoriteAction(action, favoriteId) {
  const item = getFavoriteById(favoriteId);

  if (action === "delete-favorite") {
    await deleteFavoriteItem(favoriteId);
    state.favorites = await getPromptFavorites();
    state.openMenuKey = null;
    renderFavoritesList();
    setStatus(t.favoriteDeleted, "success");
    showAppToast(t.favoriteDeleted, "info", 2200);
    return;
  }

  if (action === "toggle-pin-favorite") {
    if (item) {
      await updateFavoriteMeta(favoriteId, { pinned: !item.pinned });
      state.favorites = await getPromptFavorites();
      state.openMenuKey = null;
      renderFavoritesList();
    }
    return;
  }

  if (action === "edit-favorite") {
    if (!item) {
      return;
    }
    state.openMenuKey = null;
    renderFavoritesList();
    openFavoriteEditor(item);
    return;
  }

  if (action === "duplicate-favorite") {
    await duplicateFavoriteItem(favoriteId, t.favoriteDuplicatePrefix);
    state.favorites = await getPromptFavorites();
    state.openMenuKey = null;
    renderFavoritesList();
    setStatus(t.favoriteDuplicated, "success");
    showAppToast(t.favoriteDuplicated, "success", 2200);
    return;
  }

  if (action === "run-favorite") {
    if (!item) {
      return;
    }

    await runFavoriteItem(item);
    renderFavoritesList();
  }
}

async function handleSend() {
  if (state.isSending) {
    return;
  }

  clearStatus();
  const prompt = promptInput.value.trim();

  if (!prompt) {
    setStatus(t.warnEmpty, "error");
    showAppToast(t.toastPromptEmpty, "warning", 2000);
    promptInput.focus();
    return;
  }

  const selectedSiteIds = checkedSiteIds();
  if (selectedSiteIds.length === 0) {
    setStatus(t.warnNoSite, "error");
    showAppToast(t.toastNoService, "warning", 2000);
    return;
  }

  const composerTargets = buildComposerBroadcastTargets(selectedSiteIds, prompt);
  const selectedSites = state.runtimeSites.filter((site) => selectedSiteIds.includes(site.id));

  for (const site of selectedSites) {
    if (!site.isCustom) {
      continue;
    }

    const granted = await ensureSiteOriginPermission(site.url, site.hostnameAliases);
    if (!granted) {
      setStatus(t.servicePermissionDenied, "error");
      showAppToast(t.servicePermissionDenied, "error", 4000);
      return;
    }
  }

  await chrome.storage.local.set({ lastPrompt: prompt });
  await openTemplateModalV2(prompt, composerTargets);
}

function bindGlobalEvents() {
  tabButtons.forEach((button) => {
    button.addEventListener("click", () => switchTab(button.dataset.tab));
  });

  clearPromptBtn.addEventListener("click", () => {
    promptInput.value = "";
    state.loadedFavoriteId = "";
    state.loadedFavoriteTitle = "";
    state.loadedTemplateDefaults = {};
    updatePromptCounter();
    autoResizePromptInput();
    renderTemplateSummary();
    clearStatus();
    promptInput.focus();
  });

  toggleAllBtn.addEventListener("click", () => {
    const checkboxes = allCheckboxes();
    const shouldCheckAll = !checkboxes.every((checkbox) => checkbox.checked);

    checkboxes.forEach((checkbox) => {
      checkbox.checked = shouldCheckAll;
      checkbox.closest(".site-card")?.classList.toggle("checked", shouldCheckAll);
    });

    syncToggleAllLabel();
    renderTemplateSummary();
  });

  saveFavoriteBtn.addEventListener("click", () => {
    void openFavoriteModal().catch((error) => {
      console.error("[AI Prompt Broadcaster] Failed to open favorite modal.", error);
      setStatus(t.error(error?.message ?? getUnknownErrorText()), "error");
    });
  });

  cancelSendBtn.addEventListener("click", () => {
    void cancelCurrentBroadcast();
  });

  sendBtn.addEventListener("click", (event) => {
    triggerRipple(sendBtn, event);
    void handleSend().catch((error) => {
      console.error("[AI Prompt Broadcaster] Send flow failed.", error);
      setStatus(t.error(error?.message ?? getUnknownErrorText()), "error");
    });
  });

  promptInput.addEventListener("input", () => {
    updatePromptCounter();
    autoResizePromptInput();
    renderTemplateSummary();
    document.querySelectorAll(".site-card.sent, .site-card.failed, .site-card.sending").forEach((card) => {
      card.classList.remove("sending", "sent", "failed");
      card.querySelector(".retry-btn")?.remove();
    });
  });

  promptInput.addEventListener("keydown", (event) => {
    if (event.key === "Enter" && (event.ctrlKey || event.metaKey)) {
      event.preventDefault();
      void handleSend().catch((error) => {
        console.error("[AI Prompt Broadcaster] Keyboard send failed.", error);
        setStatus(t.error(error?.message ?? getUnknownErrorText()), "error");
      });
    }
  });

  historySearchInput.addEventListener("input", (event) => {
    state.historySearch = event.target.value;
    renderHistoryList();
  });

  historySortSelect.addEventListener("change", (event) => {
    const nextValue = event.target.value;
    state.settings = {
      ...state.settings,
      historySort: nextValue,
    };
    renderHistoryList();
    void updateAppSettings({ historySort: nextValue }).catch((error) => {
      console.error("[AI Prompt Broadcaster] Failed to save history sort.", error);
      setStatus(t.error(error?.message ?? getUnknownErrorText()), "error");
    });
  });

  favoritesSearchInput.addEventListener("input", (event) => {
    state.favoritesSearch = event.target.value;
    renderFavoritesList();
  });

  favoritesSortSelect.addEventListener("change", (event) => {
    const nextValue = event.target.value;
    state.settings = {
      ...state.settings,
      favoriteSort: nextValue,
    };
    renderFavoritesList();
    void updateAppSettings({ favoriteSort: nextValue }).catch((error) => {
      console.error("[AI Prompt Broadcaster] Failed to save favorite sort.", error);
      setStatus(t.error(error?.message ?? getUnknownErrorText()), "error");
    });
  });

  // Favorites filter bar — tag/folder chip clicks (event delegation via parent panel)
  document.querySelector("[data-panel='favorites']")?.addEventListener("click", (event) => {
    const chip = event.target.closest("[data-filter-tag],[data-filter-folder],[data-filter-all]");
    if (!chip) return;
    if (chip.dataset.filterAll === "favorites") {
      state.favoritesTagFilter = "";
      state.favoritesFolderFilter = "";
    } else if (chip.dataset.filterTag !== undefined) {
      state.favoritesTagFilter = state.favoritesTagFilter === chip.dataset.filterTag ? "" : chip.dataset.filterTag;
      state.favoritesFolderFilter = "";
    } else if (chip.dataset.filterFolder !== undefined) {
      state.favoritesFolderFilter = state.favoritesFolderFilter === chip.dataset.filterFolder ? "" : chip.dataset.filterFolder;
      state.favoritesTagFilter = "";
    }
    renderFavoritesList();
  });

  historyList.addEventListener("click", (event) => {
    const switchButton = event.target.closest("[data-switch-tab='compose']");
    if (switchButton) {
      switchTab("compose");
      return;
    }

    const loadButton = event.target.closest("[data-load-history]");
    if (loadButton) {
      const item = state.history.find(
        (entry) => Number(entry.id) === Number(loadButton.dataset.loadHistory)
      );
      if (item) {
        loadPromptIntoComposer({ ...item, templateDefaults: {}, title: "" });
      }
      return;
    }

    const menuToggle = event.target.closest("[data-toggle-menu]");
    if (menuToggle) {
      const menuKey = menuToggle.dataset.toggleMenu;
      state.openMenuKey = state.openMenuKey === menuKey ? null : menuKey;
      renderHistoryList();
      return;
    }

    const actionButton = event.target.closest("[data-action][data-history-id]");
    if (actionButton) {
      void handleHistoryAction(
        actionButton.dataset.action,
        actionButton.dataset.historyId
      ).catch((error) => {
        console.error("[AI Prompt Broadcaster] History action failed.", error);
        setStatus(t.error(error?.message ?? getUnknownErrorText()), "error");
      });
    }
  });

  historyList.addEventListener("contextmenu", (event) => {
    const item = event.target.closest("[data-history-id]");
    if (!item) {
      return;
    }

    event.preventDefault();
    state.openMenuKey = `history:${item.dataset.historyId}`;
    renderHistoryList();
  });

  favoritesList.addEventListener("click", (event) => {
    const switchButton = event.target.closest("[data-switch-tab='compose']");
    if (switchButton) {
      switchTab("compose");
      return;
    }

    const loadButton = event.target.closest("[data-load-favorite]");
    if (loadButton) {
      const item = state.favorites.find(
        (entry) => String(entry.id) === String(loadButton.dataset.loadFavorite)
      );
      if (item) {
        loadPromptIntoComposer(item);
      }
      return;
    }

    const editButton = event.target.closest("[data-edit-favorite]");
    if (editButton) {
      const item = state.favorites.find(
        (entry) => String(entry.id) === String(editButton.dataset.editFavorite)
      );
      if (item) {
        state.openMenuKey = null;
        renderFavoritesList();
        openFavoriteEditor(item);
      }
      return;
    }

    const menuToggle = event.target.closest("[data-toggle-menu]");
    if (menuToggle) {
      const menuKey = menuToggle.dataset.toggleMenu;
      state.openMenuKey = state.openMenuKey === menuKey ? null : menuKey;
      renderFavoritesList();
      return;
    }

    const actionButton = event.target.closest("[data-action][data-favorite-id]");
    if (actionButton) {
      void handleFavoriteAction(
        actionButton.dataset.action,
        actionButton.dataset.favoriteId
      ).catch((error) => {
        console.error("[AI Prompt Broadcaster] Favorite action failed.", error);
        setStatus(t.error(error?.message ?? getUnknownErrorText()), "error");
      });
    }
  });

  favoritesList.addEventListener("contextmenu", (event) => {
    const item = event.target.closest("[data-favorite-id]");
    if (!item) {
      return;
    }

    event.preventDefault();
    state.openMenuKey = `favorite:${item.dataset.favoriteId}`;
    renderFavoritesList();
  });

  favoritesList.addEventListener("input", (event) => {
    const input = event.target.closest("[data-favorite-title]");
    if (!input) {
      return;
    }

    scheduleFavoriteTitleSave(input.dataset.favoriteTitle, input.value, false);
  });

  favoritesList.addEventListener("blur", (event) => {
    const input = event.target.closest("[data-favorite-title]");
    if (!input) {
      return;
    }

    scheduleFavoriteTitleSave(input.dataset.favoriteTitle, input.value, true);
  }, true);

  document.addEventListener("click", (event) => {
    if (!state.openMenuKey) {
      return;
    }

    const insideMenu = event.target.closest(".prompt-actions");
    if (!insideMenu) {
      state.openMenuKey = null;
      renderLists();
    }
  });

  clearHistoryBtn.addEventListener("click", async () => {
    showConfirmToast(t.clearHistoryConfirm, async () => {
      try {
        await clearPromptHistory();
        state.history = [];
        renderHistoryList();
        setStatus(t.historyCleared, "success");
        showAppToast(t.historyCleared, "info", 2200);
      } catch (error) {
        console.error("[AI Prompt Broadcaster] Failed to clear history.", error);
        setStatus(t.error(error?.message ?? getUnknownErrorText()), "error");
        showAppToast(t.error(error?.message ?? getUnknownErrorText()), "error", 4000);
      }
    });
  });

  reuseExistingTabsToggle.addEventListener("change", (event) => {
    const nextValue = Boolean(event.target.checked);
    state.settings = {
      ...state.settings,
      reuseExistingTabs: nextValue,
    };
    applySettingsToControls();
    renderSiteCheckboxesPanel();

    void updateAppSettings({ reuseExistingTabs: nextValue }).catch((error) => {
      console.error("[AI Prompt Broadcaster] Failed to save tab reuse setting.", error);
      setStatus(t.error(error?.message ?? getUnknownErrorText()), "error");
      showAppToast(t.error(error?.message ?? getUnknownErrorText()), "error", 3200);
    });
  });

  waitMultiplierRange.addEventListener("input", (event) => {
    waitMultiplierValue.textContent = t.waitMultiplierValue(Number(event.target.value));
  });

  waitMultiplierRange.addEventListener("change", (event) => {
    const nextValue = Number(event.target.value);
    state.settings = {
      ...state.settings,
      waitMsMultiplier: nextValue,
    };
    applySettingsToControls();
    void updateAppSettings({ waitMsMultiplier: nextValue }).catch((error) => {
      console.error("[AI Prompt Broadcaster] Failed to save wait multiplier.", error);
      setStatus(t.error(error?.message ?? getUnknownErrorText()), "error");
      showAppToast(t.error(error?.message ?? getUnknownErrorText()), "error", 3200);
    });
  });

  openOptionsBtn.addEventListener("click", () => {
    void chrome.runtime.openOptionsPage().catch((error) => {
      console.error("[AI Prompt Broadcaster] Failed to open options page.", error);
      setStatus(t.error(error?.message ?? getUnknownErrorText()), "error");
    });
  });

  exportJsonBtn.addEventListener("click", async () => {
    try {
      const payload = await exportPromptData();
      const blob = new Blob([JSON.stringify(payload, null, 2)], {
        type: "application/json",
      });
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = `ai-prompt-broadcaster-${new Date()
        .toISOString()
        .replace(/[:.]/g, "-")}.json`;
      anchor.click();
      URL.revokeObjectURL(url);
      setStatus(t.exportSuccess, "success");
    } catch (error) {
      console.error("[AI Prompt Broadcaster] JSON export failed.", error);
      setStatus(t.error(error?.message ?? getUnknownErrorText()), "error");
    }
  });

  importJsonBtn.addEventListener("click", () => {
    importJsonInput.click();
  });

  importJsonInput.addEventListener("change", async (event) => {
    const file = event.target.files?.[0];
    if (!file) {
      return;
    }

    try {
      const text = await file.text();
      const result = await importPromptData(text);
      await refreshStoredData();
      setStatus(buildImportSummaryText(result.importSummary), "success");
      showAppToast(buildImportSummaryText(result.importSummary, { short: true }), "success", 2600);
      openImportReportModal(result.importSummary);
    } catch (error) {
      setStatus(t.importFailed, "error");
      console.error("[AI Prompt Broadcaster] JSON import failed.", error);
    } finally {
      importJsonInput.value = "";
    }
  });

  addServiceBtn.addEventListener("click", () => {
    resetServiceEditorForm();
    populateServiceEditor(null);
  });

  resetSitesBtn.addEventListener("click", () => {
    showConfirmToast(t.resetServicesConfirm, async () => {
      try {
        await resetSiteSettings();
        await refreshStoredData();
        hideServiceEditor();
        setStatus(t.serviceResetDone, "success");
        showAppToast(t.serviceResetDone, "success", 2200);
      } catch (error) {
        console.error("[AI Prompt Broadcaster] Failed to reset service settings.", error);
        setStatus(t.error(error?.message ?? getUnknownErrorText()), "error");
        showAppToast(t.error(error?.message ?? getUnknownErrorText()), "error", 4000);
      }
    });
  });

  managedSitesList.addEventListener("click", (event) => {
    const actionButton = event.target.closest("[data-action][data-site-id]");
    if (!actionButton) {
      return;
    }

    const { action, siteId } = actionButton.dataset;
    if (!siteId) {
      return;
    }

    if (action === "edit-service") {
      const site = state.runtimeSites.find((entry) => entry.id === siteId);
      if (site) {
        populateServiceEditor(site);
      }
      return;
    }

    if (action === "delete-service") {
      void deleteManagedSite(siteId);
    }
  });

  managedSitesList.addEventListener("change", (event) => {
    const toggle = event.target.closest("[data-action='toggle-service'][data-site-id]");
    if (!toggle) {
      return;
    }

    void setRuntimeSiteEnabled(toggle.dataset.siteId, toggle.checked)
      .then(() => refreshStoredData())
      .catch((error) => {
        console.error("[AI Prompt Broadcaster] Failed to toggle site state.", error);
        setStatus(t.error(error?.message ?? getUnknownErrorText()), "error");
      });
  });

  testSelectorBtn.addEventListener("click", () => {
    void testSelectorOnActiveTab();
  });

  serviceWaitRange.addEventListener("input", () => {
    serviceWaitValue.textContent = `${serviceWaitRange.value}ms`;
  });

  serviceEditorCancel.addEventListener("click", hideServiceEditor);
  serviceEditorSave.addEventListener("click", () => {
    void saveServiceEditorDraft();
  });

  templateModalClose.addEventListener("click", hideTemplateModal);
  templateModalCancel.addEventListener("click", hideTemplateModal);
  templateModal.addEventListener("click", (event) => {
    if (event.target === templateModal) {
      hideTemplateModal();
    }
  });
  templateFields.addEventListener("input", (event) => {
    const input = event.target.closest("[data-template-input]");
    if (!input || !state.pendingTemplateSend) {
      return;
    }

    state.pendingTemplateSend.userValues[input.dataset.templateInput] = input.value;
    renderTemplateModalV2();
  });
  templateModalConfirm.addEventListener("click", () => {
    void confirmTemplateModalSend().catch((error) => {
      console.error("[AI Prompt Broadcaster] Template modal confirm failed.", error);
      setTemplateModalError(t.error(error?.message ?? getUnknownErrorText()));
    });
  });
  bindFavoriteEditorEvents();

  resendModalClose.addEventListener("click", hideResendModal);
  resendModalCancel.addEventListener("click", hideResendModal);
  resendModal.addEventListener("click", (event) => {
    if (event.target === resendModal) {
      hideResendModal();
    }
  });
  resendModalConfirm.addEventListener("click", () => {
    void confirmResendModal().catch((error) => {
      console.error("[AI Prompt Broadcaster] Resend modal confirm failed.", error);
      setStatus(t.error(error?.message ?? getUnknownErrorText()), "error");
    });
  });

  importReportModalClose.addEventListener("click", hideImportReportModal);
  importReportModalConfirm.addEventListener("click", hideImportReportModal);
  importReportModal.addEventListener("click", (event) => {
    if (event.target === importReportModal) {
      hideImportReportModal();
    }
  });

  document.addEventListener("keydown", (event) => {
    trapModalFocus(event);
    void handleGlobalShortcut(event).catch((error) => {
      console.error("[AI Prompt Broadcaster] Failed to handle popup shortcut.", error);
    });
  });

  chrome.tabs.onCreated.addListener(() => {
    scheduleOpenSiteTabsRefresh();
  });

  chrome.tabs.onRemoved.addListener(() => {
    scheduleOpenSiteTabsRefresh();
  });

  chrome.tabs.onUpdated.addListener((_tabId, changeInfo) => {
    if (changeInfo.status || typeof changeInfo.title === "string" || typeof changeInfo.url === "string") {
      scheduleOpenSiteTabsRefresh();
    }
  });

  chrome.tabs.onActivated.addListener(() => {
    scheduleOpenSiteTabsRefresh();
  });

  chrome.storage.onChanged.addListener((changes, areaName) => {
    if (areaName === "session") {
      if (changes.lastBroadcast) {
        applyLastBroadcastState(changes.lastBroadcast.newValue ?? null);
      }

      if (changes.pendingUiToasts) {
        void flushPendingSessionToasts();
      }

      return;
    }

    if (areaName !== "local") {
      return;
    }

    if (
      changes.promptHistory ||
      changes.promptFavorites ||
      changes.lastPrompt ||
      changes.templateVariableCache ||
      changes.appSettings ||
      changes.customSites ||
      changes.builtInSiteStates ||
      changes.builtInSiteOverrides ||
      changes.failedSelectors
    ) {
      void loadStoredData().catch((error) => {
        console.error("[AI Prompt Broadcaster] Storage change refresh failed.", error);
      });
    }
  });
}

async function init() {
  try {
    applyI18n();
    document.documentElement.lang = isKorean ? "ko" : "en";
    resetTransientModals();
    initToastRoot(toastHost);
    renderTabLabels();
    bindGlobalEvents();
    switchTab(state.activeTab);
    syncToggleAllLabel();
    await loadStoredData();
    await maybeHandlePopupFavoriteIntent();
    await chrome.runtime.sendMessage({ action: "popupOpened" }).catch(() => null);
    applyLastBroadcastState(await getLastBroadcast(), { silentToast: false });
    await flushPendingSessionToasts();
    if (!getOpenOverlay()) {
      promptInput.focus();
    }
  } catch (error) {
    console.error("[AI Prompt Broadcaster] Failed to initialize popup.", error);
    setStatus(t.error(error?.message ?? getUnknownErrorText()), "error");
    showAppToast(t.error(error?.message ?? getUnknownErrorText()), "error", 4000);
  }
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", () => {
    void init();
  }, { once: true });
} else {
  void init();
}
