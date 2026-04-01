// @ts-nocheck
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
  exportPromptData,
  getAppSettings,
  getPromptFavorites,
  getPromptHistory,
  getTemplateVariableCache,
  importPromptData,
  updateFavoriteTitle,
  updateFavoriteMeta,
  updateAppSettings,
  updateTemplateVariableCache,
} from "../../shared/prompts";
import {
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
} from "./i18n";
import { SITE_EMOJI, state } from "./state";

const extTitle = document.getElementById("ext-title");
const extDesc = document.getElementById("ext-desc");
const tabButtons = [...document.querySelectorAll(".tab-button")];
const panels = [...document.querySelectorAll(".tab-panel")];
const promptInput = document.getElementById("prompt-input");
const promptCounter = document.getElementById("prompt-counter");
const clearPromptBtn = document.getElementById("clear-prompt-btn");
const templateSummary = document.getElementById("template-summary");
const templateSummaryLabel = document.getElementById("template-summary-label");
const templateChipList = document.getElementById("template-chip-list");
const sitesLabel = document.getElementById("sites-label");
const sitesContainer = document.getElementById("sites-container");
const toggleAllBtn = document.getElementById("toggle-all");
const saveFavoriteBtn = document.getElementById("save-favorite-btn");
const cancelSendBtn = document.getElementById("cancel-send-btn");
const sendBtn = document.getElementById("send-btn");
const statusMsg = document.getElementById("status-message");
const historySearchInput = document.getElementById("history-search");
const favoritesSearchInput = document.getElementById("favorites-search");
const historyList = document.getElementById("history-list");
const favoritesList = document.getElementById("favorites-list");
const settingsTitle = document.getElementById("settings-title");
const settingsDesc = document.getElementById("settings-desc");
const reuseExistingTabsToggle = document.getElementById("reuse-existing-tabs-toggle");
const reuseExistingTabsLabel = document.getElementById("reuse-existing-tabs-label");
const reuseExistingTabsDesc = document.getElementById("reuse-existing-tabs-desc");
const openOptionsBtn = document.getElementById("open-options-btn");
const clearHistoryBtn = document.getElementById("clear-history-btn");
const exportJsonBtn = document.getElementById("export-json-btn");
const importJsonBtn = document.getElementById("import-json-btn");
const importJsonInput = document.getElementById("import-json-input");
const serviceManagementTitle = document.getElementById("service-management-title");
const serviceManagementDesc = document.getElementById("service-management-desc");
const addServiceBtn = document.getElementById("add-service-btn");
const resetSitesBtn = document.getElementById("reset-sites-btn");
const managedSitesList = document.getElementById("managed-sites-list");
const serviceEditor = document.getElementById("service-editor");
const serviceEditorTitle = document.getElementById("service-editor-title");
const serviceEditorDesc = document.getElementById("service-editor-desc");
const serviceNameLabel = document.getElementById("service-name-label");
const serviceNameInput = document.getElementById("service-name-input");
const serviceUrlLabel = document.getElementById("service-url-label");
const serviceUrlInput = document.getElementById("service-url-input");
const serviceInputSelectorLabel = document.getElementById("service-input-selector-label");
const serviceInputSelectorInput = document.getElementById("service-input-selector-input");
const testSelectorBtn = document.getElementById("test-selector-btn");
const serviceInputTypeLabel = document.getElementById("service-input-type-label");
const serviceSubmitSelectorLabel = document.getElementById("service-submit-selector-label");
const serviceSubmitSelectorInput = document.getElementById("service-submit-selector-input");
const serviceSubmitMethodLabel = document.getElementById("service-submit-method-label");
const serviceSubmitMethodSelect = document.getElementById("service-submit-method-select");
const serviceAdvancedTitle = document.getElementById("service-advanced-title");
const serviceFallbackSelectorsLabel = document.getElementById("service-fallback-selectors-label");
const serviceFallbackSelectorsInput = document.getElementById("service-fallback-selectors-input");
const serviceAuthSelectorsLabel = document.getElementById("service-auth-selectors-label");
const serviceAuthSelectorsInput = document.getElementById("service-auth-selectors-input");
const serviceHostnameAliasesLabel = document.getElementById("service-hostname-aliases-label");
const serviceHostnameAliasesInput = document.getElementById("service-hostname-aliases-input");
const serviceLastVerifiedLabel = document.getElementById("service-last-verified-label");
const serviceLastVerifiedInput = document.getElementById("service-last-verified-input");
const serviceVerifiedVersionLabel = document.getElementById("service-verified-version-label");
const serviceVerifiedVersionInput = document.getElementById("service-verified-version-input");
const serviceWaitLabel = document.getElementById("service-wait-label");
const serviceWaitRange = document.getElementById("service-wait-range");
const serviceWaitValue = document.getElementById("service-wait-value");
const serviceColorLabel = document.getElementById("service-color-label");
const serviceColorInput = document.getElementById("service-color-input");
const serviceIconLabel = document.getElementById("service-icon-label");
const serviceIconInput = document.getElementById("service-icon-input");
const serviceEnabledLabel = document.getElementById("service-enabled-label");
const serviceEnabledInput = document.getElementById("service-enabled-input");
const serviceTestResult = document.getElementById("service-test-result");
const serviceEditorError = document.getElementById("service-editor-error");
const serviceEditorCancel = document.getElementById("service-editor-cancel");
const serviceEditorSave = document.getElementById("service-editor-save");
const toastHost = document.getElementById("toast-host");

const templateModal = document.getElementById("template-modal");
const templateModalTitle = document.getElementById("template-modal-title");
const templateModalDesc = document.getElementById("template-modal-desc");
const templateModalClose = document.getElementById("template-modal-close");
const templateModalSystemInfo = document.getElementById("template-modal-system-info");
const templateFields = document.getElementById("template-fields");
const templatePreviewLabel = document.getElementById("template-preview-label");
const templatePreview = document.getElementById("template-preview");
const templateModalError = document.getElementById("template-modal-error");
const templateModalCancel = document.getElementById("template-modal-cancel");
const templateModalConfirm = document.getElementById("template-modal-confirm");

const favoriteModal = document.getElementById("favorite-modal");
const favoriteModalTitle = document.getElementById("favorite-modal-title");
const favoriteModalDesc = document.getElementById("favorite-modal-desc");
const favoriteModalClose = document.getElementById("favorite-modal-close");
const favoriteTitleLabel = document.getElementById("favorite-title-label");
const favoriteTitleInput = document.getElementById("favorite-title-input");
const favoriteSaveDefaultsRow = document.getElementById("favorite-save-defaults-row");
const favoriteSaveDefaults = document.getElementById("favorite-save-defaults");
const favoriteSaveDefaultsLabel = document.getElementById("favorite-save-defaults-label");
const favoriteDefaultFieldsWrap = document.getElementById("favorite-default-fields-wrap");
const favoriteDefaultFieldsLabel = document.getElementById("favorite-default-fields-label");
const favoriteDefaultFields = document.getElementById("favorite-default-fields");
const favoriteModalError = document.getElementById("favorite-modal-error");
const favoriteModalCancel = document.getElementById("favorite-modal-cancel");
const favoriteModalConfirm = document.getElementById("favorite-modal-confirm");

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

function escapeAttribute(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function getSiteIcon(site) {
  if (site?.icon) {
    return site.icon;
  }

  return SITE_EMOJI[site?.id] ?? site?.name?.slice(0, 2)?.toUpperCase() ?? "AI";
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

function previewText(text, maxLength = 50) {
  const collapsed = String(text).replace(/\s+/g, " ").trim();
  if (collapsed.length <= maxLength) {
    return collapsed || "-";
  }

  return `${collapsed.slice(0, maxLength)}...`;
}

function formatDate(isoString) {
  try {
    return new Intl.DateTimeFormat(isKorean ? "ko-KR" : "en-US", {
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    }).format(new Date(isoString));
  } catch (_error) {
    return isoString;
  }
}

function normalizeSiteIdList(value) {
  if (!Array.isArray(value)) {
    return [];
  }

  return Array.from(
    new Set(
      value
        .filter((entry) => typeof entry === "string" && entry.trim())
        .map((entry) => entry.trim())
    )
  );
}

function getHistorySelectedSiteIds(item) {
  return normalizeSiteIdList(
    Array.isArray(item?.requestedSiteIds) && item.requestedSiteIds.length > 0
      ? item.requestedSiteIds
      : item?.sentTo
  );
}

function getTemplateDisplayName(name) {
  return getTemplateVariableDisplayName(name, uiLanguage);
}

function joinMultilineValues(values) {
  return Array.isArray(values) ? values.join("\n") : "";
}

function splitMultilineValues(value) {
  return String(value ?? "")
    .split(/\r?\n/g)
    .map((entry) => entry.trim())
    .filter(Boolean);
}

function renderServiceBadges(siteIds = []) {
  return siteIds
    .map((siteId) => {
      const site = state.runtimeSites.find((entry) => entry.id === siteId);
      const label = getSiteIcon(site) ?? siteId.slice(0, 2).toUpperCase();
      return `<span class="service-badge">${escapeHtml(label)}</span>`;
    })
    .join("");
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
    checkbox.closest(".site-card")?.classList.toggle("checked", shouldCheck);
  });

  syncToggleAllLabel();
}

function switchTab(tabId) {
  state.activeTab = tabId;

  tabButtons.forEach((button) => {
    button.classList.toggle("active", button.dataset.tab === tabId);
  });

  panels.forEach((panel) => {
    panel.classList.toggle("active", panel.dataset.panel === tabId);
  });

  state.openMenuKey = null;
  renderLists();
}

function buildEmptyState(message) {
  return `
    <div class="empty-state">
      <div>${escapeHtml(message)}</div>
      <button class="empty-action" type="button" data-switch-tab="compose">${escapeHtml(t.emptyActionCompose)}</button>
    </div>
  `;
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

function buildHistoryItemMarkup(item) {
  const menuKey = `history:${item.id}`;

  return `
    <article class="prompt-item" data-history-id="${item.id}">
      <button class="prompt-main" type="button" data-load-history="${item.id}">
        <div class="prompt-preview">${escapeHtml(previewText(item.text))}</div>
        <div class="prompt-meta">
          <div class="service-icons">${renderServiceBadges(getHistorySelectedSiteIds(item))}</div>
          <span>${escapeHtml(formatDate(item.createdAt))}</span>
        </div>
      </button>
      <div class="prompt-actions">
        <button class="menu-button" type="button" aria-label="${escapeAttribute(t.menuMore)}" data-toggle-menu="${escapeAttribute(menuKey)}">...</button>
        <div class="item-menu ${state.openMenuKey === menuKey ? "open" : ""}">
          <button class="menu-item" type="button" data-action="favorite" data-history-id="${item.id}">${escapeHtml(t.addFavorite)}</button>
          <button class="menu-item danger" type="button" data-action="delete-history" data-history-id="${item.id}">${escapeHtml(t.delete)}</button>
        </div>
      </div>
    </article>
  `;
}

function buildFavoriteTagsMarkup(item) {
  const tags = Array.isArray(item.tags) ? item.tags : [];
  const folder = typeof item.folder === "string" && item.folder.trim() ? item.folder.trim() : "";
  const pinIcon = item.pinned ? `<span class="fav-pin-icon" title="${escapeHtml(msg("popup_favorite_pinned") || "Pinned")}">📌</span>` : "";
  const folderBadge = folder ? `<span class="fav-folder-badge" data-filter-folder="${escapeAttribute(folder)}">📁 ${escapeHtml(folder)}</span>` : "";
  const tagChips = tags.map(
    (tag) => `<span class="fav-tag-chip" data-filter-tag="${escapeAttribute(tag)}">#${escapeHtml(tag)}</span>`
  ).join("");

  if (!pinIcon && !folderBadge && !tagChips) return "";
  return `<div class="fav-meta-row">${pinIcon}${folderBadge}${tagChips}</div>`;
}

function buildFavoriteItemMarkup(item) {
  const menuKey = `favorite:${item.id}`;
  const safeFavoriteId = escapeAttribute(item.id);
  const pinLabel = item.pinned
    ? (msg("popup_favorite_unpin") || "Unpin")
    : (msg("popup_favorite_pin") || "Pin");

  return `
    <article class="prompt-item${item.pinned ? " pinned-item" : ""}" data-favorite-id="${safeFavoriteId}">
      <div class="favorite-title-row">
        <span class="favorite-star">${escapeHtml(t.favoriteStar)}</span>
        <input
          class="favorite-title-input"
          type="text"
          data-favorite-title="${safeFavoriteId}"
          value="${escapeAttribute(item.title)}"
          placeholder="${escapeAttribute(t.titlePlaceholder)}"
        />
      </div>
      ${buildFavoriteTagsMarkup(item)}
      <button class="prompt-main" type="button" data-load-favorite="${safeFavoriteId}">
        <div class="prompt-preview">${escapeHtml(previewText(item.text))}</div>
        <div class="prompt-meta">
          <div class="service-icons">${renderServiceBadges(item.sentTo)}</div>
          <span>${escapeHtml(formatDate(item.createdAt))}</span>
        </div>
      </button>
      <div class="prompt-actions">
        <button class="menu-button" type="button" aria-label="${escapeAttribute(t.menuMore)}" data-toggle-menu="${escapeAttribute(menuKey)}">...</button>
        <div class="item-menu ${state.openMenuKey === menuKey ? "open" : ""}">
          <button class="menu-item" type="button" data-action="edit-favorite-tags" data-favorite-id="${safeFavoriteId}">${escapeHtml(msg("popup_favorite_edit_tags") || "Edit tags & folder")}</button>
          <button class="menu-item" type="button" data-action="toggle-pin-favorite" data-favorite-id="${safeFavoriteId}">${escapeHtml(pinLabel)}</button>
          <button class="menu-item danger" type="button" data-action="delete-favorite" data-favorite-id="${safeFavoriteId}">${escapeHtml(t.delete)}</button>
        </div>
      </div>
    </article>
  `;
}

function renderHistoryList() {
  const items = filterItems(state.history, state.historySearch);

  if (items.length === 0) {
    historyList.innerHTML = buildEmptyState(
      state.historySearch ? t.noSearchResults : t.historyEmpty
    );
    return;
  }

  historyList.innerHTML = items.map((item) => buildHistoryItemMarkup(item)).join("");
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
  // Pinned items first
  return [...filtered].sort((a, b) => {
    if (a.pinned && !b.pinned) return -1;
    if (!a.pinned && b.pinned) return 1;
    return 0;
  });
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

  favoritesList.innerHTML = items.map((item) => buildFavoriteItemMarkup(item)).join("");
}

function renderLists() {
  renderHistoryList();
  renderFavoritesList();
}

function currentPromptVariables() {
  return detectTemplateVariables(promptInput.value);
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
}

function buildBroadcastTargets(siteIds = []) {
  return normalizeSiteIdList(siteIds).map((siteId) => {
    const targetSelection = state.siteTargetSelections?.[siteId];
    const promptOverride =
      typeof state.sitePromptOverrides?.[siteId] === "string" &&
      state.sitePromptOverrides[siteId].trim()
        ? state.sitePromptOverrides[siteId].trim()
        : undefined;

    if (typeof targetSelection === "number") {
      return { id: siteId, tabId: targetSelection, ...(promptOverride ? { promptOverride } : {}) };
    }

    if (targetSelection === "new") {
      return { id: siteId, reuseExistingTab: false, target: "new", ...(promptOverride ? { promptOverride } : {}) };
    }

    return { id: siteId, ...(promptOverride ? { promptOverride } : {}) };
  });
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

function setLoadedTemplateContext(item) {
  state.loadedTemplateDefaults =
    item && item.templateDefaults && typeof item.templateDefaults === "object"
      ? { ...item.templateDefaults }
      : {};
  state.loadedFavoriteTitle = typeof item?.title === "string" ? item.title : "";
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
    if (status === "submitted") {
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

function addRetryButton(siteId, finalPrompt) {
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
        prompt: finalPrompt,
        sites: buildBroadcastTargets([siteId]),
      });
      if (response?.ok) {
        setSiteCardState(siteId, "sent");
      } else {
        setSiteCardState(siteId, "failed");
        addRetryButton(siteId, finalPrompt);
      }
    } catch (_error) {
      setSiteCardState(siteId, "failed");
      addRetryButton(siteId, finalPrompt);
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

async function sendResolvedPrompt(finalPrompt, sites) {
  if (state.isSending) {
    return;
  }

  const siteIds = normalizeSiteIdList(
    sites.map((site) => (typeof site === "string" ? site : site?.id))
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
      prompt: finalPrompt,
      sites: buildBroadcastTargets(siteIds),
    });

    if (response?.ok) {
      if (Array.isArray(response.failedTabSiteIds)) {
        response.failedTabSiteIds.forEach((siteId) => {
          setSiteCardState(siteId, "failed");
          addRetryButton(siteId, finalPrompt);
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
        addRetryButton(siteId, finalPrompt);
      });
      setStatus(t.error(response?.error ?? getUnknownErrorText()), "error");
    }
  } catch (error) {
    console.error("[AI Prompt Broadcaster] Broadcast send failed.", error);
    siteIds.forEach((siteId) => setSiteCardState(siteId, "failed"));
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
  templateModal.hidden = true;
  templateModalError.hidden = true;
  templateModalError.textContent = "";
}

function hideFavoriteModal() {
  state.pendingFavoriteSave = null;
  favoriteModal.hidden = true;
  favoriteModalError.hidden = true;
  favoriteModalError.textContent = "";
  favoriteTitleInput.value = "";
  favoriteSaveDefaults.checked = false;
  favoriteSaveDefaultsRow.hidden = true;
  favoriteDefaultFieldsWrap.hidden = true;
  favoriteDefaultFields.innerHTML = "";
}

function dismissFavoriteModal(event) {
  event?.preventDefault?.();
  event?.stopPropagation?.();
  hideFavoriteModal();
}

function resetTransientModals() {
  hideTemplateModal();
  hideFavoriteModal();
}

function setTemplateModalError(message = "") {
  templateModalError.hidden = !message;
  templateModalError.textContent = message;
}

function setFavoriteModalError(message = "") {
  favoriteModalError.hidden = !message;
  favoriteModalError.textContent = message;
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
  templateModal.hidden = false;
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

  const finalPrompt = renderTemplatePrompt(modalState.prompt, previewState.values);
  hideTemplateModal();
  await sendResolvedPrompt(finalPrompt, modalState.sites);
}

function buildTemplateSendPreviewStateV2() {
  const modalState = state.pendingTemplateSend;
  if (!modalState) {
    return null;
  }

  const values = mergeTemplateSources(modalState.systemValues, modalState.userValues);
  const preview = renderTemplatePrompt(modalState.prompt, values);
  const missingUserValues = findMissingTemplateValues(modalState.prompt, modalState.userValues);
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

async function openTemplateModalV2(prompt, sites) {
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
    sites,
    variables,
    userValues,
    systemValues,
  };

  renderTemplateModalV2();
  templateModal.hidden = false;
}

function renderFavoriteDefaultFields() {
  const modalState = state.pendingFavoriteSave;
  if (!modalState) {
    favoriteDefaultFieldsWrap.hidden = true;
    favoriteDefaultFields.innerHTML = "";
    return;
  }

  const showDefaults = modalState.variables.length > 0 && modalState.saveDefaults;
  favoriteDefaultFieldsWrap.hidden = !showDefaults;

  if (!showDefaults) {
    favoriteDefaultFields.innerHTML = "";
    return;
  }

  favoriteDefaultFields.innerHTML = modalState.variables
    .map((variable) => {
      const value = modalState.defaultValues[variable.name] ?? "";
      return `
        <label class="field-stack">
          <span>${escapeHtml(variable.name)}</span>
          <input
            class="search-input"
            type="text"
            data-favorite-default-input="${escapeAttribute(variable.name)}"
            value="${escapeAttribute(value)}"
            placeholder="${escapeAttribute(t.templateFieldPlaceholder(variable.name))}"
          />
        </label>
      `;
    })
    .join("");
}

function renderFavoriteModal() {
  const modalState = state.pendingFavoriteSave;
  if (!modalState) {
    return;
  }

  favoriteModalTitle.textContent = t.favoriteModalTitle;
  favoriteModalDesc.textContent = t.favoriteModalDesc;
  favoriteModalCancel.textContent = t.favoriteModalCancel;
  favoriteModalConfirm.textContent = t.favoriteModalConfirm;
  favoriteTitleLabel.textContent = t.favoriteTitleLabel;
  favoriteSaveDefaultsLabel.textContent = t.favoriteSaveDefaultsLabel;
  favoriteDefaultFieldsLabel.textContent = t.favoriteDefaultsLabel;
  favoriteTitleInput.value = modalState.title;
  favoriteSaveDefaults.checked = modalState.saveDefaults;
  favoriteSaveDefaultsRow.hidden = modalState.variables.length === 0;
  renderFavoriteDefaultFields();
}

async function openFavoriteModal() {
  clearStatus();
  const prompt = promptInput.value.trim();

  if (!prompt) {
    setStatus(t.warnEmpty, "error");
    promptInput.focus();
    return;
  }

  const variables = detectTemplateVariables(prompt).filter((variable) => variable.kind === "user");
  const baseDefaults = mergeTemplateSources(
    state.templateVariableCache,
    state.loadedTemplateDefaults
  );

  state.pendingFavoriteSave = {
    prompt,
    sites: checkedSiteIds(),
    variables,
    title: state.loadedFavoriteTitle,
    saveDefaults: variables.length > 0,
    defaultValues: Object.fromEntries(
      variables.map((variable) => [variable.name, baseDefaults[variable.name] ?? ""])
    ),
  };

  setFavoriteModalError("");
  renderFavoriteModal();
  favoriteModal.hidden = false;
  window.requestAnimationFrame(() => {
    favoriteTitleInput.focus();
    favoriteTitleInput.select();
  });
}

async function confirmFavoriteSave() {
  const modalState = state.pendingFavoriteSave;
  if (!modalState) {
    return;
  }

  const title = favoriteTitleInput.value.trim();
  modalState.title = title;
  modalState.saveDefaults = favoriteSaveDefaults.checked;

  const templateDefaults = modalState.saveDefaults
    ? compactVariableValues(modalState.defaultValues)
    : {};

  if (modalState.saveDefaults) {
    await updateTemplateVariableCache(templateDefaults);
    state.templateVariableCache = mergeTemplateSources(state.templateVariableCache, templateDefaults);
  }

  await createFavoritePrompt({
    title,
    text: modalState.prompt,
    sentTo: modalState.sites,
    templateDefaults,
  });

  await refreshStoredData();
  hideFavoriteModal();
  setStatus(t.favoriteSaved, "success");
  showAppToast(t.favoriteSaved, "success", 2200);
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
      syncToggleAllLabel();
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
    const item = state.favorites.find((f) => f.id === favoriteId);
    if (item) {
      await updateFavoriteMeta(favoriteId, { pinned: !item.pinned });
      state.favorites = await getPromptFavorites();
      state.openMenuKey = null;
      renderFavoritesList();
    }
    return;
  }

  if (action === "edit-favorite-tags") {
    const item = state.favorites.find((f) => f.id === favoriteId);
    if (!item) return;
    state.openMenuKey = null;
    openFavoriteTagsModal(item);
    return;
  }
}

function openFavoriteTagsModal(item) {
  let modal = document.getElementById("favorite-tags-modal");
  if (!modal) {
    modal = document.createElement("div");
    modal.id = "favorite-tags-modal";
    modal.className = "modal-overlay";
    modal.innerHTML = `
      <div class="modal-card" role="dialog" aria-modal="true">
        <div class="modal-header">
          <h2>${escapeHtml(msg("popup_favorite_edit_tags") || "Edit tags & folder")}</h2>
          <button class="icon-button" type="button" id="fav-tags-modal-close">×</button>
        </div>
        <div class="modal-fields">
          <label class="field-stack">
            <span>${escapeHtml(msg("popup_favorite_tags_label") || "Tags (comma-separated)")}</span>
            <input id="fav-tags-input" class="search-input" type="text" placeholder="${escapeHtml(msg("popup_favorite_tags_placeholder") || "coding, translation, summary")}" />
          </label>
          <label class="field-stack">
            <span>${escapeHtml(msg("popup_favorite_folder_label") || "Folder")}</span>
            <input id="fav-folder-input" class="search-input" type="text" placeholder="${escapeHtml(msg("popup_favorite_folder_placeholder") || "Work / Development")}" />
          </label>
        </div>
        <div class="modal-actions">
          <button class="ghost-button" type="button" id="fav-tags-modal-cancel">${escapeHtml(msg("popup_template_cancel") || "Cancel")}</button>
          <button class="primary-button" type="button" id="fav-tags-modal-save">${escapeHtml(msg("popup_favorite_modal_confirm") || "Save")}</button>
        </div>
      </div>
    `;
    document.body.appendChild(modal);

    const closeModal = () => { modal.hidden = true; };
    document.getElementById("fav-tags-modal-close").addEventListener("click", closeModal);
    document.getElementById("fav-tags-modal-cancel").addEventListener("click", closeModal);
    document.getElementById("fav-tags-modal-save").addEventListener("click", async () => {
      const rawTags = document.getElementById("fav-tags-input").value;
      const folder = document.getElementById("fav-folder-input").value.trim();
      const tags = rawTags.split(",").map((t) => t.trim()).filter(Boolean);
      const favoriteId = modal.dataset.favoriteId;
      await updateFavoriteMeta(favoriteId, { tags, folder });
      state.favorites = await getPromptFavorites();
      renderFavoritesList();
      closeModal();
    });
  }

  modal.dataset.favoriteId = item.id;
  document.getElementById("fav-tags-input").value = (item.tags ?? []).join(", ");
  document.getElementById("fav-folder-input").value = item.folder ?? "";
  modal.hidden = false;
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
  await openTemplateModalV2(prompt, selectedSiteIds);
}

function bindGlobalEvents() {
  tabButtons.forEach((button) => {
    button.addEventListener("click", () => switchTab(button.dataset.tab));
  });

  clearPromptBtn.addEventListener("click", () => {
    promptInput.value = "";
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

  favoritesSearchInput.addEventListener("input", (event) => {
    state.favoritesSearch = event.target.value;
    renderFavoritesList();
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

  favoriteModalClose.addEventListener("click", dismissFavoriteModal);
  favoriteModalCancel.addEventListener("click", dismissFavoriteModal);
  favoriteModal.addEventListener("click", (event) => {
    const target = event.target instanceof Element ? event.target : null;
    const dismissButton = target?.closest("[data-dismiss-favorite-modal]");
    if (dismissButton || target === favoriteModal) {
      dismissFavoriteModal(event);
    }
  });
  favoriteModal.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && !favoriteModal.hidden) {
      dismissFavoriteModal(event);
    }
  });
  favoriteSaveDefaults.addEventListener("change", () => {
    if (!state.pendingFavoriteSave) {
      return;
    }

    state.pendingFavoriteSave.saveDefaults = favoriteSaveDefaults.checked;
    renderFavoriteDefaultFields();
  });
  favoriteDefaultFields.addEventListener("input", (event) => {
    const input = event.target.closest("[data-favorite-default-input]");
    if (!input || !state.pendingFavoriteSave) {
      return;
    }

    state.pendingFavoriteSave.defaultValues[input.dataset.favoriteDefaultInput] = input.value;
  });
  favoriteModalConfirm.addEventListener("click", () => {
    void confirmFavoriteSave().catch((error) => {
      console.error("[AI Prompt Broadcaster] Favorite save failed.", error);
      setFavoriteModalError(t.error(error?.message ?? getUnknownErrorText()));
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
    syncToggleAllLabel();
    await loadStoredData();
    await chrome.runtime.sendMessage({ action: "popupOpened" }).catch(() => null);
    applyLastBroadcastState(await getLastBroadcast(), { silentToast: false });
    await flushPendingSessionToasts();
    promptInput.focus();
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
