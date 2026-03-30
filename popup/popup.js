import {
  buildSystemTemplateValues,
  detectTemplateVariables,
  findMissingTemplateValues,
  renderTemplatePrompt,
} from "../shared/template_utils.js";
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
  updateTemplateVariableCache,
} from "../shared/prompt_store.js";
import {
  drainPendingUiToasts,
  getFailedSelectors,
  getLastBroadcast,
} from "../shared/runtime_state.js";
import {
  buildSitePermissionPattern,
  deleteCustomSite,
  getRuntimeSites,
  resetSiteSettings,
  saveBuiltInSiteOverride,
  saveCustomSite,
  setRuntimeSiteEnabled,
  validateSiteDraft,
} from "../shared/sites_store.js";
import { clearAllToasts, initToastRoot, showToast } from "./toast.js";

const uiLanguage = chrome.i18n.getUILanguage().toLowerCase();
const isKorean = uiLanguage === "ko" || uiLanguage.startsWith("ko-");

function msg(key, substitutions) {
  return chrome.i18n.getMessage(key, substitutions) || "";
}

function applyI18n(root = document) {
  root.querySelectorAll("[data-i18n]").forEach((element) => {
    const value = msg(element.dataset.i18n);
    if (value) {
      element.textContent = value;
    }
  });

  root.querySelectorAll("[data-i18n-placeholder]").forEach((element) => {
    const value = msg(element.dataset.i18nPlaceholder);
    if (value) {
      element.setAttribute("placeholder", value);
    }
  });

  root.querySelectorAll("[data-i18n-aria-label]").forEach((element) => {
    const value = msg(element.dataset.i18nAriaLabel);
    if (value) {
      element.setAttribute("aria-label", value);
    }
  });
}

const t = {
  title: msg("ext_name"),
  desc: msg("ext_description"),
  tabs: {
    compose: msg("tab_write"),
    history: msg("tab_history"),
    favorites: msg("tab_favorites"),
    settings: msg("tab_settings"),
  },
  placeholder: msg("popup_placeholder"),
  sitesLabel: msg("popup_sites_label"),
  selectAll: msg("popup_select_all"),
  deselectAll: msg("popup_deselect_all"),
  send: msg("popup_send"),
  saveFavorite: msg("popup_save_favorite"),
  sending: (count) => msg("status_sending", [String(count)]),
  sent: (count) => msg("status_success", [String(count)]),
  warnEmpty: msg("popup_warn_empty"),
  warnNoSite: msg("popup_warn_no_site"),
  error: (message) => msg("status_failed", [String(message ?? "")]),
  historySearch: msg("popup_history_search"),
  favoritesSearch: msg("popup_favorites_search"),
  historyEmpty: msg("history_empty"),
  favoritesEmpty: msg("favorites_empty"),
  addFavorite: msg("popup_add_favorite"),
  delete: msg("popup_delete"),
  favoriteAdded: msg("popup_favorite_added"),
  favoriteSaved: msg("popup_favorite_saved"),
  historyDeleted: msg("popup_history_deleted"),
  favoriteDeleted: msg("popup_favorite_deleted"),
  titlePlaceholder: msg("popup_title_placeholder"),
  titleSaved: msg("popup_title_saved"),
  settingsTitle: msg("popup_settings_title"),
  settingsDesc: msg("popup_settings_description"),
  clearHistory: msg("settings_reset"),
  openOptions: msg("popup_open_options"),
  exportJson: msg("settings_export"),
  importJson: msg("settings_import"),
  clearHistoryConfirm: msg("popup_clear_history_confirm"),
  historyCleared: msg("popup_history_cleared"),
  importSuccess: msg("popup_import_success"),
  importFailed: msg("popup_import_failed"),
  exportSuccess: msg("popup_export_success"),
  emptyActionCompose: msg("popup_empty_action_compose"),
  noSearchResults: msg("popup_no_search_results"),
  importedLoad: msg("popup_imported_load"),
  menuMore: msg("popup_menu_more"),
  favoriteStar: msg("popup_favorite_star"),
  templateSummary: (count) => msg("popup_template_summary", [String(count)]),
  templateUserKind: msg("popup_template_user_kind"),
  templateSystemKind: msg("popup_template_system_kind"),
  templateModalTitle: msg("popup_template_modal_title"),
  templateModalDesc: msg("popup_template_modal_desc"),
  templatePreviewLabel: msg("popup_template_preview_label"),
  templateModalCancel: msg("popup_template_cancel"),
  templateModalConfirm: msg("popup_template_confirm"),
  templateSystemNotice: msg("popup_template_system_notice"),
  templateClipboardNotice: msg("popup_template_clipboard_notice"),
  templateClipboardError: msg("popup_template_clipboard_error"),
  templateMissingValues: msg("popup_template_missing_values"),
  templateFieldLabel: (name) => String(name),
  templateFieldPlaceholder: (name) => msg("popup_template_field_placeholder", [String(name)]),
  favoriteModalTitle: msg("popup_favorite_modal_title"),
  favoriteModalDesc: msg("popup_favorite_modal_desc"),
  favoriteModalCancel: msg("popup_favorite_modal_cancel"),
  favoriteModalConfirm: msg("popup_favorite_modal_confirm"),
  favoriteTitleLabel: msg("popup_favorite_title_label"),
  favoriteSaveDefaultsLabel: msg("popup_favorite_save_defaults_label"),
  favoriteDefaultsLabel: msg("popup_favorite_defaults_label"),
  clearPrompt: msg("popup_clear_prompt") || "Clear",
  promptCounter: (current, limit) => `${current} / ${limit}`,
  serviceManagementTitle: msg("popup_service_management_title") || "Service Management",
  serviceManagementDesc: msg("popup_service_management_desc") || "Add, edit, enable, or disable AI targets without editing code.",
  addService: msg("popup_service_add") || "Add Service",
  resetServices: msg("popup_service_reset") || "Reset Services",
  resetServicesConfirm: msg("popup_service_reset_confirm") || "Reset built-in services and remove all custom services?",
  serviceBuiltInBadge: msg("popup_service_builtin_badge") || "Built-in",
  serviceCustomBadge: msg("popup_service_custom_badge") || "Custom",
  serviceDisabledLabel: msg("popup_service_disabled") || "Disabled",
  serviceEdit: msg("popup_service_edit") || "Edit",
  serviceDelete: msg("popup_service_delete") || "Delete",
  serviceTest: msg("popup_service_test") || "Test in Tab",
  serviceEditorAddTitle: msg("popup_service_editor_add_title") || "Add Custom Service",
  serviceEditorEditTitle: msg("popup_service_editor_edit_title") || "Edit Service",
  serviceEditorDesc: msg("popup_service_editor_desc") || "Configure selector, submit strategy, style, and launch URL.",
  serviceFieldName: msg("popup_service_field_name") || "Service Name",
  serviceFieldUrl: msg("popup_service_field_url") || "Service URL",
  serviceFieldInputSelector: msg("popup_service_field_input_selector") || "Input Selector",
  serviceFieldInputType: msg("popup_service_field_input_type") || "Input Type",
  serviceFieldSubmitSelector: msg("popup_service_field_submit_selector") || "Submit Selector",
  serviceFieldSubmitMethod: msg("popup_service_field_submit_method") || "Submit Method",
  serviceFieldWait: msg("popup_service_field_wait") || "Wait Time",
  serviceFieldColor: msg("popup_service_field_color") || "Color",
  serviceFieldIcon: msg("popup_service_field_icon") || "Icon",
  serviceFieldEnabled: msg("popup_service_field_enabled") || "Enabled",
  serviceEditorSave: msg("popup_service_editor_save") || "Save",
  serviceEditorCancel: msg("popup_service_editor_cancel") || "Cancel",
  serviceSaved: msg("popup_service_saved") || "Service settings saved.",
  serviceDeleted: msg("popup_service_deleted") || "Custom service deleted.",
  serviceResetDone: msg("popup_service_reset_done") || "Service settings were reset.",
  servicePermissionDenied: msg("popup_service_permission_denied") || "Host permission was not granted for this service URL.",
  serviceValidationError: msg("popup_service_validation_error") || "Please check the service form fields.",
  serviceTestNoTab: msg("popup_service_test_no_tab") || "No active tab is available for selector testing.",
  serviceTestNoSelector: msg("popup_service_test_no_selector") || "Enter a selector first.",
  serviceTestInvalidTab: msg("popup_service_test_invalid_tab") || "Selector testing only works on http/https tabs.",
  serviceTestSuccess: (inputType) => msg("popup_service_test_success", [String(inputType)]) || `Element found (${inputType})`,
  serviceTestFail: msg("popup_service_test_fail") || "Element not found.",
  serviceTestError: (message) => msg("popup_service_test_error", [String(message)]) || `Selector test failed: ${message}`,
  serviceEmptyList: msg("popup_service_empty_list") || "No services available.",
  selectorWarningTooltip:
    msg("popup_selector_warning_tooltip") || "Selector may have changed. Review the service config.",
  restoredBroadcastSending:
    msg("popup_broadcast_restored_sending") || "Previous broadcast is still running.",
  restoredBroadcastDone:
    msg("popup_broadcast_restored_done") || "Last broadcast: $1 success, $2 failed",
  toastConfirm: msg("common_confirm") || "Confirm",
  toastHistoryDeleted: msg("toast_history_deleted") || "History item deleted.",
  toastSettingsSaved: msg("toast_settings_saved") || "Settings saved.",
  toastSendSuccess: (count) => msg("toast_send_success", [String(count)]) || `${count} services queued.`,
  toastPromptEmpty: msg("toast_prompt_empty") || msg("popup_warn_empty") || "Please enter a prompt.",
  toastNoService: msg("toast_no_service") || "Please select at least one service.",
  toastSelectorFailed: (name) => msg("toast_selector_failed", [String(name)]) || `${name} selector was not found.`,
};

function getUnknownErrorText() {
  return msg("popup_unknown_error");
}

const SITE_EMOJI = {
  chatgpt: "GPT",
  gemini: "Gem",
  claude: "Cl",
  grok: "Gk",
};

const state = {
  activeTab: "compose",
  history: [],
  favorites: [],
  historySearch: "",
  favoritesSearch: "",
  openMenuKey: null,
  favoriteSaveTimers: new Map(),
  loadedTemplateDefaults: {},
  loadedFavoriteTitle: "",
  templateVariableCache: {},
  pendingTemplateSend: null,
  pendingFavoriteSave: null,
  runtimeSites: [],
  serviceEditor: null,
  failedSelectors: new Map(),
  lastBroadcast: null,
  lastBroadcastToastSignature: "",
  isSending: false,
  sendSafetyTimer: null,
};

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
const sendBtn = document.getElementById("send-btn");
const statusMsg = document.getElementById("status-message");
const historySearchInput = document.getElementById("history-search");
const favoritesSearchInput = document.getElementById("favorites-search");
const historyList = document.getElementById("history-list");
const favoritesList = document.getElementById("favorites-list");
const settingsTitle = document.getElementById("settings-title");
const settingsDesc = document.getElementById("settings-desc");
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

function renderServiceBadges(sentTo = []) {
  return sentTo
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
  const selected = new Set(Array.isArray(sentTo) ? sentTo : []);

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
          <div class="service-icons">${renderServiceBadges(item.sentTo)}</div>
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

function buildFavoriteItemMarkup(item) {
  const menuKey = `favorite:${item.id}`;
  const safeFavoriteId = escapeAttribute(item.id);

  return `
    <article class="prompt-item" data-favorite-id="${safeFavoriteId}">
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

function renderFavoritesList() {
  const items = filterItems(state.favorites, state.favoritesSearch);

  if (items.length === 0) {
    favoritesList.innerHTML = buildEmptyState(
      state.favoritesSearch ? t.noSearchResults : t.favoritesEmpty
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
      return `
        <span class="template-chip ${variable.kind}">
          <span>{{${escapeHtml(variable.name)}}}</span>
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

async function loadStoredData() {
  try {
    const [history, favorites, variableCache, runtimeSites, promptResult, failedSelectors] = await Promise.all([
      getPromptHistory(),
      getPromptFavorites(),
      getTemplateVariableCache(),
      getRuntimeSites(),
      chrome.storage.local.get(["lastPrompt"]),
      getFailedSelectors(),
    ]);

    state.history = history;
    state.favorites = favorites;
    state.templateVariableCache = variableCache;
    state.runtimeSites = runtimeSites;
    state.failedSelectors = new Map(failedSelectors.map((entry) => [entry.serviceId, entry]));

    if (typeof promptResult.lastPrompt === "string" && !promptInput.value.trim()) {
      promptInput.value = promptResult.lastPrompt;
    }

    renderSiteCheckboxes();
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
    const [history, favorites, variableCache, runtimeSites, failedSelectors] = await Promise.all([
      getPromptHistory(),
      getPromptFavorites(),
      getTemplateVariableCache(),
      getRuntimeSites(),
      getFailedSelectors(),
    ]);

    state.history = history;
    state.favorites = favorites;
    state.templateVariableCache = variableCache;
    state.runtimeSites = runtimeSites;
    state.failedSelectors = new Map(failedSelectors.map((entry) => [entry.serviceId, entry]));
    renderSiteCheckboxes();
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
  applySiteSelection(item.sentTo);
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

  if (!silentToast && isRecent && state.lastBroadcastToastSignature !== signature) {
    const successCount = (summary.submittedSiteIds ?? []).length;
    const failedCount = (summary.failedSiteIds ?? []).length;
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

async function flushPendingSessionToasts() {
  const pendingToasts = await drainPendingUiToasts();
  pendingToasts.forEach((toast) => {
    showAppToast(toast);
  });
}

function getSiteCardElement(siteId) {
  return sitesContainer.querySelector(`label.site-card[for="site-${CSS.escape(siteId)}"]`);
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
  retryBtn.textContent = isKorean ? "재시도" : "Retry";
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
      const response = await chrome.runtime.sendMessage({
        action: "broadcast",
        prompt: finalPrompt,
        sites: [siteId],
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

  setSendingState(true);
  armSendSafetyTimer();

  const siteIds = sites.map((s) => (typeof s === "string" ? s : s.id));
  siteIds.forEach((siteId) => setSiteCardState(siteId, "sending"));

  setStatus(t.sending(sites.length));

  try {
    await chrome.storage.local.set({ lastPrompt: promptInput.value });
    clearAllToasts();

    const response = await chrome.runtime.sendMessage({
      action: "broadcast",
      prompt: finalPrompt,
      sites,
    });

    if (response?.ok) {
      if (Array.isArray(response.failedTabSiteIds)) {
        response.failedTabSiteIds.forEach((siteId) => {
          setSiteCardState(siteId, "failed");
          addRetryButton(siteId, finalPrompt);
        });
      }

      setStatus(t.sent(response.createdSiteCount ?? sites.length), "success");
      showAppToast(t.toastSendSuccess(response.createdSiteCount ?? sites.length), "success", 2200);

      const settings = await getAppSettings();
      if (settings.autoClosePopup) {
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
  favoriteDefaultFields.innerHTML = "";
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

  renderTemplateModal();
  const previewState = buildTemplateSendPreviewState();

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
    waitMs: Number(serviceWaitRange.value),
    color: serviceColorInput.value,
    icon: serviceIconInput.value.trim(),
    enabled: serviceEnabledInput.checked,
  };
}

async function ensureSiteOriginPermission(url) {
  try {
    const pattern = buildSitePermissionPattern(url);
    if (!pattern) {
      return false;
    }

    const permission = { origins: [pattern] };
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
  const selector = serviceInputSelectorInput.value.trim();
  if (!selector) {
    setServiceTestResult(t.serviceTestNoSelector, true);
    return;
  }

  try {
    const [activeTab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!activeTab?.id) {
      setServiceTestResult(t.serviceTestNoTab, true);
      return;
    }

    const tabUrl = activeTab.url ?? "";
    if (!/^https?:/i.test(tabUrl)) {
      setServiceTestResult(t.serviceTestInvalidTab, true);
      return;
    }

    const [result] = await chrome.scripting.executeScript({
      target: { tabId: activeTab.id },
      func: (targetSelector) => {
        function findElementDeep(selector, root = document) {
          if (!selector || typeof selector !== "string") {
            return null;
          }

          if (typeof root.querySelector === "function") {
            const direct = root.querySelector(selector);
            if (direct) {
              return direct;
            }
          }

          const walker = document.createTreeWalker(root, NodeFilter.SHOW_ELEMENT);
          let current = walker.currentNode;

          while (current) {
            if (current.shadowRoot) {
              const shadowMatch = findElementDeep(selector, current.shadowRoot);
              if (shadowMatch) {
                return shadowMatch;
              }
            }
            current = walker.nextNode();
          }

          return null;
        }

        try {
          const element = findElementDeep(targetSelector);
          if (!element) {
            return { found: false };
          }

          const previousOutline = element.style.outline;
          const previousOffset = element.style.outlineOffset;
          element.style.outline = "3px solid #facc15";
          element.style.outlineOffset = "2px";
          window.setTimeout(() => {
            element.style.outline = previousOutline;
            element.style.outlineOffset = previousOffset;
          }, 1800);

          const inputType = element.isContentEditable
            ? "contenteditable"
            : element.tagName.toLowerCase() === "textarea"
              ? "textarea"
              : "input";

          return { found: true, inputType };
        } catch (error) {
          return { found: false, error: error?.message ?? String(error) };
        }
      },
      args: [selector],
    });

    if (result?.result?.found) {
      setServiceTestResult(`✅ ${t.serviceTestSuccess(result.result.inputType)}`, false);
      return;
    }

    const errorText = result?.result?.error;
    setServiceTestResult(
      errorText ? t.serviceTestError(errorText) : `❌ ${t.serviceTestFail}`,
      true
    );
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
    const granted = await ensureSiteOriginPermission(draft.url);
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
  if (action !== "delete-favorite") {
    return;
  }

  await deleteFavoriteItem(favoriteId);
  state.favorites = await getPromptFavorites();
  state.openMenuKey = null;
  renderFavoritesList();
  setStatus(t.favoriteDeleted, "success");
  showAppToast(t.favoriteDeleted, "info", 2200);
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

    const granted = await ensureSiteOriginPermission(site.url);
    if (!granted) {
      setStatus(t.servicePermissionDenied, "error");
      showAppToast(t.servicePermissionDenied, "error", 4000);
      return;
    }
  }

  await chrome.storage.local.set({ lastPrompt: prompt });
  await openTemplateModal(prompt, selectedSites);
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
      await importPromptData(text);
      await refreshStoredData();
      setStatus(t.importSuccess, "success");
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
    renderTemplateModal();
  });
  templateModalConfirm.addEventListener("click", () => {
    void confirmTemplateModalSend().catch((error) => {
      console.error("[AI Prompt Broadcaster] Template modal confirm failed.", error);
      setTemplateModalError(t.error(error?.message ?? getUnknownErrorText()));
    });
  });

  favoriteModalClose.addEventListener("click", hideFavoriteModal);
  favoriteModalCancel.addEventListener("click", hideFavoriteModal);
  favoriteModal.addEventListener("click", (event) => {
    if (event.target === favoriteModal) {
      hideFavoriteModal();
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
    initToastRoot(toastHost);
    renderTabLabels();
    bindGlobalEvents();
    syncToggleAllLabel();
    await loadStoredData();
    await chrome.runtime.sendMessage({ action: "popupOpened" }).catch(() => null);
    applyLastBroadcastState(await getLastBroadcast(), { silentToast: false });
    await flushPendingSessionToasts();
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
