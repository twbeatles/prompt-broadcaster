// src/popup/ui/toast.ts
var STYLE_ID = "apb-toast-styles";
var MAX_TOASTS = 3;
var toastRoot = null;
var toastIdCounter = 0;
var toastMap = /* @__PURE__ */ new Map();
function ensureStyles() {
  if (document.getElementById(STYLE_ID)) {
    return;
  }
  const style = document.createElement("style");
  style.id = STYLE_ID;
  style.textContent = `
    .apb-toast-host {
      display: flex;
      flex-direction: column;
      gap: 8px;
      width: 100%;
    }

    .apb-toast {
      display: grid;
      grid-template-columns: auto 1fr auto;
      align-items: start;
      gap: 10px;
      padding: 12px 14px;
      border-radius: 14px;
      border: 1px solid transparent;
      color: #fff;
      box-shadow: 0 12px 28px rgba(15, 23, 42, 0.18);
      animation: apb-toast-slide-up 180ms ease;
      cursor: pointer;
    }

    .apb-toast.success { background: #1f8f5f; }
    .apb-toast.error { background: #b53b3b; }
    .apb-toast.warning { background: #c28111; color: #201a15; }
    .apb-toast.info { background: #2c6db8; }
    .apb-toast.removing {
      opacity: 0;
      transform: translateY(6px);
      transition: opacity 140ms ease, transform 140ms ease;
    }

    .apb-toast-icon {
      font-size: 14px;
      line-height: 1.2;
      padding-top: 1px;
    }

    .apb-toast-body {
      display: grid;
      gap: 8px;
      min-width: 0;
    }

    .apb-toast-message {
      font-size: 12px;
      line-height: 1.5;
      word-break: break-word;
    }

    .apb-toast-actions {
      display: flex;
      gap: 8px;
      flex-wrap: wrap;
    }

    .apb-toast-action,
    .apb-toast-close {
      border: 1px solid rgba(255, 255, 255, 0.24);
      background: rgba(255, 255, 255, 0.14);
      color: inherit;
      border-radius: 999px;
      padding: 6px 10px;
      cursor: pointer;
      font: inherit;
      font-size: 11px;
      line-height: 1.2;
    }

    .apb-toast.warning .apb-toast-action,
    .apb-toast.warning .apb-toast-close {
      border-color: rgba(32, 26, 21, 0.16);
      background: rgba(255, 255, 255, 0.3);
    }

    .apb-toast-close {
      padding: 4px 8px;
      background: transparent;
      border-color: transparent;
      font-size: 14px;
    }

    @keyframes apb-toast-slide-up {
      from {
        opacity: 0;
        transform: translateY(8px);
      }
      to {
        opacity: 1;
        transform: translateY(0);
      }
    }
  `;
  document.head.appendChild(style);
}
function getIcon(type) {
  switch (type) {
    case "success":
      return "✅";
    case "error":
      return "❌";
    case "warning":
      return "⚠️";
    default:
      return "ℹ️";
  }
}
function normalizeAction(action = {}) {
  return {
    id: action.id || `toast-action-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    label: action.label || "OK",
    variant: action.variant || "default",
    onClick: typeof action.onClick === "function" ? action.onClick : null
  };
}
function normalizeToastInput(input, type, duration) {
  if (input && typeof input === "object" && !Array.isArray(input)) {
    return {
      id: input.id || `toast-${Date.now()}-${toastIdCounter += 1}`,
      message: String(input.message ?? ""),
      type: input.type || "info",
      duration: Number.isFinite(Number(input.duration)) ? Number(input.duration) : 3e3,
      actions: Array.isArray(input.actions) ? input.actions.map((action) => normalizeAction(action)) : []
    };
  }
  return {
    id: `toast-${Date.now()}-${toastIdCounter += 1}`,
    message: String(input ?? ""),
    type: type || "info",
    duration: Number.isFinite(Number(duration)) ? Number(duration) : 3e3,
    actions: []
  };
}
function ensureToastRoot() {
  if (toastRoot) {
    return toastRoot;
  }
  toastRoot = document.getElementById("toast-host");
  if (!toastRoot) {
    toastRoot = document.createElement("div");
    toastRoot.id = "toast-host";
    document.body.appendChild(toastRoot);
  }
  toastRoot.classList.add("apb-toast-host");
  return toastRoot;
}
function removeToastElement(id) {
  const entry = toastMap.get(id);
  if (!entry) {
    return;
  }
  if (entry.timer) {
    window.clearTimeout(entry.timer);
  }
  entry.element.classList.add("removing");
  window.setTimeout(() => {
    entry.element.remove();
  }, 140);
  toastMap.delete(id);
}
function trimToMax() {
  const entries = [...toastMap.values()];
  while (entries.length > MAX_TOASTS) {
    const first = entries.shift();
    if (!first) {
      break;
    }
    removeToastElement(first.id);
  }
}
function initToastRoot(container) {
  ensureStyles();
  toastRoot = container || document.getElementById("toast-host") || null;
  return ensureToastRoot();
}
function showToast(input, type = "info", duration = 3e3) {
  ensureStyles();
  const root = ensureToastRoot();
  const toast = normalizeToastInput(input, type, duration);
  const element = document.createElement("div");
  element.className = `apb-toast ${toast.type}`;
  element.dataset.toastId = toast.id;
  const icon = document.createElement("span");
  icon.className = "apb-toast-icon";
  icon.textContent = getIcon(toast.type);
  const body = document.createElement("div");
  body.className = "apb-toast-body";
  const message = document.createElement("div");
  message.className = "apb-toast-message";
  message.textContent = toast.message;
  body.appendChild(message);
  if (toast.actions.length > 0) {
    const actions = document.createElement("div");
    actions.className = "apb-toast-actions";
    toast.actions.forEach((action) => {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "apb-toast-action";
      button.textContent = action.label;
      button.addEventListener("click", (event) => {
        event.preventDefault();
        event.stopPropagation();
        action.onClick?.();
        hideToast(toast.id);
      });
      actions.appendChild(button);
    });
    body.appendChild(actions);
  }
  const closeButton = document.createElement("button");
  closeButton.type = "button";
  closeButton.className = "apb-toast-close";
  closeButton.textContent = "×";
  closeButton.addEventListener("click", (event) => {
    event.preventDefault();
    event.stopPropagation();
    hideToast(toast.id);
  });
  element.append(icon, body, closeButton);
  element.addEventListener("click", () => {
    hideToast(toast.id);
  });
  root.appendChild(element);
  const entry = {
    id: toast.id,
    element,
    timer: null
  };
  if (toast.duration >= 0) {
    entry.timer = window.setTimeout(() => {
      hideToast(toast.id);
    }, toast.duration);
  }
  toastMap.set(toast.id, entry);
  trimToMax();
  return toast.id;
}
function hideToast(id) {
  removeToastElement(id);
}

// src/options/app/i18n.ts
var uiLanguage = chrome.i18n.getUILanguage().toLowerCase();
var isKorean = uiLanguage === "ko" || uiLanguage.startsWith("ko-");
var locale = isKorean ? "ko-KR" : "en-US";
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
  root.querySelectorAll("[data-i18n-title]").forEach((element) => {
    const value = msg(element.dataset.i18nTitle);
    if (value) {
      element.setAttribute("title", value);
    }
  });
  root.querySelectorAll("[data-i18n-aria-label]").forEach((element) => {
    const value = msg(element.dataset.i18nAriaLabel);
    if (value) {
      element.setAttribute("aria-label", value);
    }
  });
}
var t = {
  pageTitle: msg("options_page_title"),
  statusSaved: msg("options_settings_saved"),
  saveFailed: msg("options_settings_save_failed"),
  dataRefreshFailed: msg("options_data_refresh_failed"),
  initFailed: msg("options_init_failed"),
  commonClose: msg("common_close"),
  cards: {
    totalTransmissions: msg("options_card_total_transmissions"),
    mostUsedService: msg("options_card_most_used_service"),
    weekCount: msg("options_card_week_count"),
    averagePromptLength: msg("options_card_average_prompt_length"),
    charSuffix: msg("options_card_char_suffix")
  },
  charts: {
    noUsage: msg("options_chart_no_usage"),
    noDaily: msg("options_chart_no_daily"),
    totalSent: msg("options_chart_total_sent"),
    donutAria: msg("options_chart_donut_aria"),
    barAria: msg("options_chart_bar_aria")
  },
  history: {
    emptyFiltered: msg("options_history_empty_filtered"),
    tableSelect: msg("options_table_select") || "Select",
    tableDate: msg("options_table_date"),
    tablePrompt: msg("options_table_prompt"),
    tableServices: msg("options_table_services"),
    tableStatus: msg("options_table_status"),
    allServices: msg("options_filter_all_services"),
    pageInfo: (current, total) => msg("options_page_info", [String(current), String(total)]),
    exportSuccess: msg("options_settings_export_success"),
    exportFailed: msg("options_settings_export_failed"),
    selectAllLabel: msg("options_history_select_all") || "Select page",
    deleteSelected: msg("options_history_delete_selected") || "Delete selected",
    deleteFiltered: msg("options_history_delete_filtered") || "Delete filtered",
    deleteOlderThan: (days) => msg("options_history_delete_older_than", [String(days)]) || `Delete older than ${days}d`,
    deleteSelectedConfirm: msg("options_history_delete_selected_confirm") || "Delete the selected history items?",
    deleteFilteredConfirm: (count) => msg("options_history_delete_filtered_confirm", [String(count)]) || `Delete ${count} filtered history item(s)?`,
    deleteOlderConfirm: (days) => msg("options_history_delete_older_confirm", [String(days)]) || `Delete items older than ${days} days?`,
    deleteSuccess: msg("options_history_delete_success") || "History deleted."
  },
  services: {
    inputType: msg("options_service_input_type"),
    waitTime: msg("options_service_wait_time"),
    requestCount: msg("options_service_request_count"),
    successRate: msg("options_service_success_rate"),
    lastUsed: msg("options_service_last_used"),
    defaultColor: msg("options_service_default_color"),
    none: msg("options_value_none")
  },
  settings: {
    historyLimitValue: (count) => msg("options_settings_history_limit_value", [String(count)]),
    resetConfirm: msg("options_settings_reset_confirm"),
    resetSuccess: msg("options_settings_reset_success"),
    resetFailed: msg("options_settings_reset_failed"),
    exportSuccess: msg("options_settings_export_success"),
    exportFailed: msg("options_settings_export_failed"),
    importSuccess: msg("options_settings_import_success"),
    importFailed: msg("options_settings_import_failed"),
    shortcutsOpenFailed: msg("options_settings_shortcuts_open_failed"),
    waitSaved: msg("options_wait_saved") || "Wait time saved.",
    waitMultiplierTitle: msg("options_settings_wait_multiplier_title") || "Wait multiplier",
    waitMultiplierValue: (value) => msg("options_settings_wait_multiplier_value", [String(Number(value).toFixed(1))]) || `${Number(value).toFixed(1)}x`,
    reuseTabsTitle: msg("options_settings_reuse_tabs_title") || "Reuse current-window AI tabs",
    reuseTabsDesc: msg("options_settings_reuse_tabs_desc") || "When enabled, matching open AI tabs are reused before opening a new one.",
    importReportTitle: msg("options_import_report_title") || "Import Details",
    importReportDesc: msg("options_import_report_desc") || "Review the imported items and any rejections.",
    importReportVersion: msg("options_import_report_version") || "Version",
    importReportAccepted: msg("options_import_report_accepted") || "Accepted services",
    importReportRewritten: msg("options_import_report_rewritten") || "Rewritten IDs",
    importReportBuiltins: msg("options_import_report_builtins") || "Built-in adjustments",
    importReportRejected: msg("options_import_report_rejected") || "Rejected services",
    importReportRejectedEmpty: msg("options_import_report_rejected_empty") || "No rejected services.",
    importRejectReason: (reason) => msg(`popup_import_reject_${reason}`) || reason,
    resultCodeLabels: {
      submitted: msg("result_code_submitted") || "Submitted",
      selector_timeout: msg("result_code_selector_timeout") || "Selector timeout",
      auth_required: msg("result_code_auth_required") || "Login required",
      submit_failed: msg("result_code_submit_failed") || "Submit failed",
      strategy_exhausted: msg("result_code_strategy_exhausted") || "Injection failed",
      permission_denied: msg("result_code_permission_denied") || "Permission denied",
      tab_create_failed: msg("result_code_tab_create_failed") || "Tab open failed",
      tab_closed: msg("result_code_tab_closed") || "Tab closed",
      injection_timeout: msg("result_code_injection_timeout") || "Injection timeout",
      cancelled: msg("result_code_cancelled") || "Cancelled",
      unexpected_error: msg("result_code_unexpected_error") || "Unexpected error"
    }
  },
  statuses: {
    submitted: msg("options_status_complete"),
    partial: msg("options_status_partial"),
    failed: msg("options_status_failed"),
    unknown: msg("options_status_unknown")
  },
  shortcuts: {
    openPopup: msg("options_shortcut_open_popup"),
    captureSelected: msg("options_shortcut_capture_selected"),
    quickPalette: msg("options_shortcut_quick_palette") || "Quick palette",
    unassigned: msg("options_shortcut_unassigned"),
    loadFailed: msg("options_shortcut_load_failed")
  },
  schedules: {
    title: msg("options_schedules_title") || "Schedules",
    desc: msg("options_schedules_desc") || "Manage scheduled favorites and run them manually.",
    empty: msg("options_schedules_empty") || "No scheduled favorites yet.",
    nextRun: msg("options_schedules_next_run") || "Next run",
    repeat: msg("options_schedules_repeat") || "Repeat",
    enabled: msg("options_schedules_enabled") || "Enabled",
    lastRun: msg("options_schedules_last_run") || "Last run",
    runNow: msg("options_schedules_run_now") || "Run now",
    openInPopup: msg("options_schedules_open_in_popup") || "Open in popup",
    runQueued: msg("options_schedules_run_queued") || "Favorite run queued.",
    popupFallback: msg("options_schedules_popup_fallback") || "Popup opened to finish required inputs.",
    openFailed: msg("options_schedules_open_failed") || "Failed to open the popup editor.",
    repeatNone: msg("options_schedules_repeat_none") || "One time",
    repeatDaily: msg("options_schedules_repeat_daily") || "Daily",
    repeatWeekday: msg("options_schedules_repeat_weekday") || "Weekdays",
    repeatWeekly: msg("options_schedules_repeat_weekly") || "Weekly",
    never: msg("options_schedules_never") || "Never"
  }
};

// src/shared/prompts/constants.ts
var LOCAL_STORAGE_KEYS = Object.freeze({
  history: "promptHistory",
  favorites: "promptFavorites",
  templateVariableCache: "templateVariableCache",
  settings: "appSettings",
  broadcastCounter: "broadcastCounter"
});
var DEFAULT_HISTORY_LIMIT = 50;
var MIN_HISTORY_LIMIT = 10;
var MAX_HISTORY_LIMIT = 200;
var MIN_WAIT_MS_MULTIPLIER = 0.5;
var MAX_WAIT_MS_MULTIPLIER = 3;
var DEFAULT_WAIT_MS_MULTIPLIER = 1;
var DEFAULT_HISTORY_SORT = "latest";
var DEFAULT_FAVORITE_SORT = "recentUsed";
var DEFAULT_SETTINGS = Object.freeze({
  historyLimit: DEFAULT_HISTORY_LIMIT,
  autoClosePopup: false,
  desktopNotifications: true,
  reuseExistingTabs: true,
  waitMsMultiplier: DEFAULT_WAIT_MS_MULTIPLIER,
  historySort: DEFAULT_HISTORY_SORT,
  favoriteSort: DEFAULT_FAVORITE_SORT
});

// src/shared/prompts/normalizers.ts
var VALID_HISTORY_SORTS = /* @__PURE__ */ new Set([
  "latest",
  "oldest",
  "mostSuccess",
  "mostFailure"
]);
var VALID_FAVORITE_SORTS = /* @__PURE__ */ new Set([
  "recentUsed",
  "usageCount",
  "title",
  "createdAt"
]);
var VALID_FAVORITE_MODES = /* @__PURE__ */ new Set(["single", "chain"]);
var VALID_SCHEDULE_REPEATS = /* @__PURE__ */ new Set([
  "none",
  "daily",
  "weekday",
  "weekly"
]);
var VALID_EXECUTION_TRIGGERS = /* @__PURE__ */ new Set([
  "popup",
  "scheduled",
  "palette",
  "options"
]);
var VALID_RESULT_CODES = /* @__PURE__ */ new Set([
  "submitted",
  "selector_timeout",
  "auth_required",
  "submit_failed",
  "strategy_exhausted",
  "permission_denied",
  "tab_create_failed",
  "tab_closed",
  "injection_timeout",
  "cancelled",
  "unexpected_error"
]);
function safeText(value) {
  return typeof value === "string" ? value : "";
}
function safeArray(value) {
  return Array.isArray(value) ? value : [];
}
function safeObject(value) {
  return value && typeof value === "object" && !Array.isArray(value) ? value : {};
}
function normalizeSentTo(sentTo) {
  return Array.from(
    new Set(
      safeArray(sentTo).flatMap(
        (entry) => typeof entry === "string" && entry.trim() ? [entry.trim()] : []
      )
    )
  );
}
function normalizeSiteIdList(value) {
  return normalizeSentTo(value);
}
function normalizeIsoDate(value, fallback = (/* @__PURE__ */ new Date()).toISOString()) {
  if (typeof value !== "string") {
    return fallback;
  }
  const time = Date.parse(value);
  return Number.isFinite(time) ? new Date(time).toISOString() : fallback;
}
function normalizeNullableIsoDate(value) {
  if (typeof value !== "string" || !value.trim()) {
    return null;
  }
  const time = Date.parse(value);
  return Number.isFinite(time) ? new Date(time).toISOString() : null;
}
function normalizeTemplateDefaults(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return {};
  }
  return Object.fromEntries(
    Object.entries(value).map(([key, entryValue]) => [safeText(key).trim(), safeText(entryValue)]).filter(([key]) => key)
  );
}
function normalizeBoolean(value, fallback = false) {
  return typeof value === "boolean" ? value : fallback;
}
function normalizeHistoryLimit(value) {
  const numericValue = Number(value);
  if (!Number.isFinite(numericValue)) {
    return DEFAULT_HISTORY_LIMIT;
  }
  return Math.min(
    MAX_HISTORY_LIMIT,
    Math.max(MIN_HISTORY_LIMIT, Math.round(numericValue))
  );
}
function normalizeBroadcastCounter(value) {
  const numericValue = Number(value);
  if (!Number.isFinite(numericValue)) {
    return 0;
  }
  return Math.max(0, Math.round(numericValue));
}
function normalizeWaitMsMultiplier(value) {
  const numericValue = Number(value);
  if (!Number.isFinite(numericValue)) {
    return DEFAULT_WAIT_MS_MULTIPLIER;
  }
  const clamped = Math.min(
    MAX_WAIT_MS_MULTIPLIER,
    Math.max(MIN_WAIT_MS_MULTIPLIER, numericValue)
  );
  return Math.round(clamped * 10) / 10;
}
function normalizeHistorySort(value) {
  return VALID_HISTORY_SORTS.has(value) ? value : DEFAULT_HISTORY_SORT;
}
function normalizeFavoriteSort(value) {
  return VALID_FAVORITE_SORTS.has(value) ? value : DEFAULT_FAVORITE_SORT;
}
function normalizeFavoriteMode(value) {
  return VALID_FAVORITE_MODES.has(value) ? value : "single";
}
function normalizeScheduleRepeat(value) {
  return VALID_SCHEDULE_REPEATS.has(value) ? value : "none";
}
function normalizeExecutionTrigger(value) {
  return VALID_EXECUTION_TRIGGERS.has(value) ? value : void 0;
}
function normalizeSettings(value) {
  const settings = safeObject(value);
  return {
    historyLimit: normalizeHistoryLimit(settings.historyLimit),
    autoClosePopup: normalizeBoolean(
      settings.autoClosePopup,
      DEFAULT_SETTINGS.autoClosePopup
    ),
    desktopNotifications: normalizeBoolean(
      settings.desktopNotifications,
      DEFAULT_SETTINGS.desktopNotifications
    ),
    reuseExistingTabs: normalizeBoolean(
      settings.reuseExistingTabs,
      DEFAULT_SETTINGS.reuseExistingTabs
    ),
    waitMsMultiplier: normalizeWaitMsMultiplier(settings.waitMsMultiplier),
    historySort: normalizeHistorySort(settings.historySort),
    favoriteSort: normalizeFavoriteSort(settings.favoriteSort)
  };
}
function normalizeStatus(value) {
  return typeof value === "string" && value.trim() ? value.trim() : "submitted";
}
function normalizeResultCode(value) {
  const normalized = safeText(value).trim();
  if (VALID_RESULT_CODES.has(normalized)) {
    return normalized;
  }
  switch (normalized) {
    case "submitted":
      return "submitted";
    case "selector_failed":
      return "selector_timeout";
    case "login_required":
    case "redirected_or_login_required":
      return "auth_required";
    case "submit_failed":
      return "submit_failed";
    case "fallback_required":
      return "strategy_exhausted";
    case "permission_denied":
      return "permission_denied";
    case "tab_create_failed":
      return "tab_create_failed";
    case "tab_closed":
      return "tab_closed";
    case "injection_timeout":
    case "broadcast_stale":
      return "injection_timeout";
    case "cancelled":
    case "reset":
      return "cancelled";
    case "failed":
    case "injection_failed":
    default:
      return "unexpected_error";
  }
}
function buildSiteInjectionResult(code, overrides = {}) {
  const normalizedCode = normalizeResultCode(code);
  const result = {
    code: normalizedCode
  };
  if (typeof overrides.message === "string" && overrides.message.trim()) {
    result.message = overrides.message.trim();
  }
  if (typeof overrides.strategy === "string" && overrides.strategy.trim()) {
    result.strategy = overrides.strategy.trim();
  }
  if (Number.isFinite(Number(overrides.elapsedMs))) {
    result.elapsedMs = Number(overrides.elapsedMs);
  }
  if (Array.isArray(overrides.attempts) && overrides.attempts.length > 0) {
    result.attempts = overrides.attempts.map((attempt) => ({
      name: safeText(attempt?.name).trim(),
      success: Boolean(attempt?.success)
    })).filter((attempt) => attempt.name);
  }
  return result;
}
function normalizeSiteInjectionResult(value) {
  if (typeof value === "string") {
    return buildSiteInjectionResult(value);
  }
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return buildSiteInjectionResult("unexpected_error");
  }
  const source = value;
  return buildSiteInjectionResult(source.code ?? source.status, {
    message: safeText(source.message).trim(),
    strategy: safeText(source.strategy).trim(),
    elapsedMs: Number.isFinite(Number(source.elapsedMs)) ? Number(source.elapsedMs) : void 0,
    attempts: Array.isArray(source.attempts) ? source.attempts : void 0
  });
}
function normalizeSiteResultsRecord(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return {};
  }
  return Object.fromEntries(
    Object.entries(value).map(([siteId, result]) => [safeText(siteId).trim(), normalizeSiteInjectionResult(result)]).filter(([siteId]) => Boolean(siteId))
  );
}
function sortByDateDesc(items, field = "createdAt") {
  return [...items].sort((left, right) => {
    const leftRecord = left;
    const rightRecord = right;
    const leftTime = Date.parse(String(leftRecord[field] ?? "")) || 0;
    const rightTime = Date.parse(String(rightRecord[field] ?? "")) || 0;
    return rightTime - leftTime;
  });
}
function ensureUniqueNumericId(items, preferredId) {
  let candidate = Number.isFinite(preferredId) ? preferredId : Date.now();
  const usedIds = new Set(items.map((item) => Number(item.id)));
  while (usedIds.has(candidate)) {
    candidate += 1;
  }
  return candidate;
}
function ensureUniqueStringId(items, preferredId) {
  let candidate = typeof preferredId === "string" && preferredId.trim() ? preferredId.trim() : `fav-${Date.now()}`;
  const usedIds = new Set(items.map((item) => String(item.id)));
  while (usedIds.has(candidate)) {
    candidate = `${candidate}-1`;
  }
  return candidate;
}
function normalizeTags(value) {
  if (!Array.isArray(value)) {
    return [];
  }
  return Array.from(
    new Set(
      value.map((tag) => safeText(tag).trim()).filter((tag) => tag.length > 0 && tag.length <= 30)
    )
  ).slice(0, 10);
}
function createChainStepId(preferredId, fallbackIndex = 0) {
  const trimmedId = safeText(preferredId).trim();
  return trimmedId || `step-${Date.now()}-${fallbackIndex}`;
}
function normalizeDelayMs(value) {
  const numericValue = Number(value);
  if (!Number.isFinite(numericValue)) {
    return 0;
  }
  return Math.max(0, Math.round(numericValue));
}
function normalizeChainStep(value, fallback = {}, index = 0) {
  const source = safeObject(value);
  const fallbackTargets = Array.isArray(fallback.targetSiteIds) ? fallback.targetSiteIds : [];
  return {
    id: createChainStepId(source.id ?? fallback.id, index),
    text: safeText(source.text ?? fallback.text),
    delayMs: normalizeDelayMs(source.delayMs ?? fallback.delayMs),
    targetSiteIds: normalizeSiteIdList(
      Array.isArray(source.targetSiteIds) ? source.targetSiteIds : fallbackTargets
    )
  };
}
function normalizeChainSteps(value, fallback = {}) {
  const source = safeArray(value).map((entry, index) => normalizeChainStep(entry, fallback, index)).filter((entry) => entry.text.trim());
  if (source.length > 0) {
    return source;
  }
  if (safeText(fallback.text).trim()) {
    return [normalizeChainStep(fallback, fallback, 0)];
  }
  return [];
}

// src/shared/prompts/storage.ts
async function readLocal(key, fallbackValue) {
  const result = await chrome.storage.local.get(key);
  return result[key] ?? fallbackValue;
}
async function writeLocal(key, value) {
  await chrome.storage.local.set({ [key]: value });
}

// src/shared/prompts/broadcast-counter.ts
async function getBroadcastCounter() {
  try {
    const rawValue = await readLocal(LOCAL_STORAGE_KEYS.broadcastCounter, 0);
    return normalizeBroadcastCounter(rawValue);
  } catch (_error) {
    return 0;
  }
}
async function setBroadcastCounter(value) {
  const normalized = normalizeBroadcastCounter(value);
  await writeLocal(LOCAL_STORAGE_KEYS.broadcastCounter, normalized);
  return normalized;
}

// src/shared/prompts/favorites-store.ts
function buildFavoriteEntry(entry) {
  const text = safeText(entry?.text);
  const sentTo = normalizeSentTo(entry?.sentTo);
  const createdAt = normalizeIsoDate(entry?.createdAt);
  const favoritedAt = normalizeIsoDate(entry?.favoritedAt, createdAt);
  const usageCount = Math.max(0, Math.round(Number(entry?.usageCount) || 0));
  const mode = normalizeFavoriteMode(entry?.mode);
  const steps = mode === "chain" ? normalizeChainSteps(entry?.steps, {
    text,
    delayMs: 0,
    targetSiteIds: sentTo
  }) : [];
  return {
    id: typeof entry?.id === "string" && entry.id.trim() ? entry.id.trim() : `fav-${Date.now()}`,
    sourceHistoryId: entry?.sourceHistoryId === null || entry?.sourceHistoryId === void 0 ? null : Number(entry.sourceHistoryId),
    title: safeText(entry?.title),
    text,
    sentTo,
    createdAt,
    favoritedAt,
    templateDefaults: normalizeTemplateDefaults(entry?.templateDefaults),
    tags: normalizeTags(entry?.tags),
    folder: safeText(entry?.folder).slice(0, 50),
    pinned: normalizeBoolean(entry?.pinned, false),
    usageCount,
    lastUsedAt: normalizeNullableIsoDate(entry?.lastUsedAt),
    mode,
    steps,
    scheduleEnabled: normalizeBoolean(entry?.scheduleEnabled, false),
    scheduledAt: normalizeNullableIsoDate(entry?.scheduledAt),
    scheduleRepeat: normalizeScheduleRepeat(entry?.scheduleRepeat)
  };
}
async function getPromptFavorites() {
  const rawFavorites = await readLocal(LOCAL_STORAGE_KEYS.favorites, []);
  return sortByDateDesc(
    safeArray(rawFavorites).map((item) => buildFavoriteEntry(item)),
    "favoritedAt"
  );
}
async function setPromptFavorites(favoriteItems) {
  const normalized = sortByDateDesc(
    safeArray(favoriteItems).map((item) => buildFavoriteEntry(item)),
    "favoritedAt"
  );
  await writeLocal(LOCAL_STORAGE_KEYS.favorites, normalized);
  return normalized;
}
async function updateFavoritePrompt(favoriteId, patch = {}) {
  const favorites = await getPromptFavorites();
  const nextFavorites = favorites.map((item) => {
    if (String(item.id) !== String(favoriteId)) {
      return item;
    }
    return buildFavoriteEntry({
      ...item,
      ...patch ?? {},
      id: item.id,
      sourceHistoryId: item.sourceHistoryId
    });
  });
  await setPromptFavorites(nextFavorites);
  return nextFavorites.find((item) => String(item.id) === String(favoriteId)) ?? null;
}

// src/shared/prompts/settings-store.ts
async function getAppSettings() {
  const rawSettings = await readLocal(LOCAL_STORAGE_KEYS.settings, DEFAULT_SETTINGS);
  return normalizeSettings(rawSettings);
}
async function setAppSettings(settings) {
  const normalized = normalizeSettings(settings);
  await writeLocal(LOCAL_STORAGE_KEYS.settings, normalized);
  return normalized;
}
async function updateAppSettings(partialSettings) {
  const current = await getAppSettings();
  return setAppSettings({
    ...current,
    ...partialSettings ?? {}
  });
}
async function getHistoryLimit() {
  const settings = await getAppSettings();
  return settings.historyLimit;
}

// src/shared/prompts/history-store.ts
function asHistoryRecord(entry) {
  return entry && typeof entry === "object" && !Array.isArray(entry) ? entry : {};
}
function buildHistoryEntry(entry) {
  const source = asHistoryRecord(entry);
  const numericId = Number(source.id);
  const createdAt = normalizeIsoDate(source.createdAt);
  const siteResults = normalizeSiteResultsRecord(source.siteResults);
  const siteResultKeys = normalizeSiteIdList(Object.keys(siteResults));
  const derivedSubmittedSiteIds = siteResultKeys.filter(
    (siteId) => normalizeResultCode(siteResults[siteId]?.code) === "submitted"
  );
  const submittedSiteIds = normalizeSiteIdList(
    Array.isArray(source.submittedSiteIds) ? source.submittedSiteIds : Array.isArray(source.sentTo) ? source.sentTo : derivedSubmittedSiteIds
  );
  const failedSiteIds = normalizeSiteIdList(
    Array.isArray(source.failedSiteIds) ? source.failedSiteIds : siteResultKeys.filter((siteId) => normalizeResultCode(siteResults[siteId]?.code) !== "submitted")
  );
  const requestedSiteIds = normalizeSiteIdList(
    Array.isArray(source.requestedSiteIds) ? source.requestedSiteIds : siteResultKeys.length > 0 ? siteResultKeys : submittedSiteIds
  );
  return {
    id: Number.isFinite(numericId) ? numericId : Date.now(),
    text: safeText(source.text),
    requestedSiteIds,
    submittedSiteIds,
    failedSiteIds,
    sentTo: submittedSiteIds,
    createdAt,
    status: normalizeStatus(source.status),
    siteResults,
    originFavoriteId: source.originFavoriteId === null || source.originFavoriteId === void 0 ? null : safeText(source.originFavoriteId).trim() || null,
    chainRunId: source.chainRunId === null || source.chainRunId === void 0 ? null : safeText(source.chainRunId).trim() || null,
    chainStepIndex: source.chainStepIndex === null || source.chainStepIndex === void 0 ? null : Number.isFinite(Number(source.chainStepIndex)) ? Math.max(0, Math.round(Number(source.chainStepIndex))) : null,
    chainStepCount: source.chainStepCount === null || source.chainStepCount === void 0 ? null : Number.isFinite(Number(source.chainStepCount)) ? Math.max(0, Math.round(Number(source.chainStepCount))) : null,
    trigger: normalizeExecutionTrigger(source.trigger)
  };
}
async function getPromptHistory() {
  const historyLimit = await getHistoryLimit();
  const rawHistory = await readLocal(LOCAL_STORAGE_KEYS.history, []);
  return sortByDateDesc(
    safeArray(rawHistory).map((item) => buildHistoryEntry(item))
  ).slice(0, historyLimit);
}
async function setPromptHistory(historyItems) {
  const historyLimit = await getHistoryLimit();
  const normalized = sortByDateDesc(
    safeArray(historyItems).map((item) => buildHistoryEntry(item))
  ).slice(0, historyLimit);
  await writeLocal(LOCAL_STORAGE_KEYS.history, normalized);
  return normalized;
}
async function deletePromptHistoryItemsByIds(historyIds) {
  const selectedIds = new Set(
    safeArray(historyIds).map((historyId) => Number(historyId)).filter((historyId) => Number.isFinite(historyId))
  );
  const history = await getPromptHistory();
  const nextHistory = history.filter((item) => !selectedIds.has(Number(item.id)));
  await setPromptHistory(nextHistory);
  return nextHistory;
}
async function deletePromptHistoryItemsBeforeDate(dateValue) {
  const cutoffDate = typeof dateValue === "string" || dateValue instanceof Date ? new Date(dateValue) : /* @__PURE__ */ new Date("");
  if (!Number.isFinite(cutoffDate.getTime())) {
    return getPromptHistory();
  }
  const cutoffTime = cutoffDate.getTime();
  const history = await getPromptHistory();
  const nextHistory = history.filter((item) => {
    const itemTime = Date.parse(item.createdAt);
    return !Number.isFinite(itemTime) || itemTime >= cutoffTime;
  });
  await setPromptHistory(nextHistory);
  return nextHistory;
}

// src/config/sites/builtins.ts
var AI_SITES = Object.freeze([
  {
    id: "chatgpt",
    name: "ChatGPT",
    url: "https://chatgpt.com/",
    hostname: "chatgpt.com",
    inputSelector: "#prompt-textarea, div#prompt-textarea[contenteditable='true'], textarea[aria-label*='chatgpt' i], textarea[aria-label*='채팅' i]",
    fallbackSelectors: [
      "#prompt-textarea",
      "div#prompt-textarea[contenteditable='true']",
      "textarea[aria-label*='chatgpt' i]",
      "textarea[aria-label*='채팅' i]",
      "textarea.wcDTda_fallbackTextarea",
      "div[contenteditable='true'][data-id='root']",
      "main div[contenteditable='true']"
    ],
    inputType: "contenteditable",
    submitSelector: "button[data-testid='send-button'], button[aria-label*='send' i], button[aria-label*='보내기' i]",
    submitMethod: "click",
    selectorCheckMode: "input-and-submit",
    waitMs: 2e3,
    fallback: true,
    lastVerified: "2026-03",
    verifiedVersion: "web-ui-mar-2026",
    authSelectors: [
      "form[action*='/auth']",
      "input[name='email']",
      "input[name='username']"
    ]
  },
  {
    id: "gemini",
    name: "Gemini",
    url: "https://gemini.google.com/app",
    hostname: "gemini.google.com",
    inputSelector: "div[contenteditable='true'][role='textbox'], div.ql-editor.textarea.new-input-ui[contenteditable='true'], div.ql-editor[contenteditable='true'][role='textbox']",
    fallbackSelectors: [
      "div[contenteditable='true'][role='textbox']",
      "div.ql-editor.textarea.new-input-ui[contenteditable='true']",
      "div.ql-editor[contenteditable='true'][role='textbox']",
      "textarea, div[contenteditable='true']"
    ],
    inputType: "contenteditable",
    submitSelector: "button.send-button, button[aria-label*='send' i], button[aria-label*='보내기' i]",
    submitMethod: "click",
    selectorCheckMode: "input-and-submit",
    waitMs: 2500,
    fallback: true,
    lastVerified: "2026-04",
    verifiedVersion: "gemini-app-apr-2026",
    authSelectors: [
      "input[type='email']",
      "input[type='password']"
    ]
  },
  {
    id: "claude",
    name: "Claude",
    url: "https://claude.ai/new",
    hostname: "claude.ai",
    inputSelector: "div[contenteditable='true'][role='textbox'], div[contenteditable='true'][aria-label*='Claude' i], div[contenteditable='true'][aria-label*='prompt' i]",
    fallbackSelectors: [
      "div[contenteditable='true'][role='textbox']",
      "div[contenteditable='true'][aria-label*='Claude' i]",
      "div[contenteditable='true'][aria-label*='prompt' i]",
      "div[contenteditable='true']",
      "textarea"
    ],
    inputType: "contenteditable",
    submitSelector: "button[aria-label='Send message'], button[aria-label*='send' i], button[aria-label*='submit' i], button[aria-label*='보내' i], button[aria-label*='전송' i]",
    submitMethod: "click",
    selectorCheckMode: "input-and-submit",
    waitMs: 1500,
    fallback: true,
    lastVerified: "2026-04",
    verifiedVersion: "claude-web-apr-2026",
    authSelectors: [
      "input#email",
      "input[type='email']",
      "input[type='password']",
      "form[action*='login']"
    ]
  },
  {
    id: "grok",
    name: "Grok",
    url: "https://grok.com/",
    hostname: "grok.com",
    inputSelector: "div.tiptap.ProseMirror[contenteditable='true'], div.ProseMirror[contenteditable='true'][translate='no'], div.ProseMirror[contenteditable='true']",
    fallbackSelectors: [
      "div.tiptap.ProseMirror[contenteditable='true']",
      "div.ProseMirror[contenteditable='true'][translate='no']",
      "div.ProseMirror[contenteditable='true']",
      "textarea[aria-label*='grok' i]",
      "textarea[placeholder*='help' i]",
      "textarea"
    ],
    inputType: "contenteditable",
    submitSelector: "button[aria-label*='submit' i], button[aria-label*='제출' i]",
    submitMethod: "click",
    selectorCheckMode: "input-and-submit",
    waitMs: 2e3,
    fallback: true,
    lastVerified: "2026-03",
    verifiedVersion: "grok-web-mar-2026",
    authSelectors: [
      "input[autocomplete='username']",
      "input[type='password']"
    ]
  },
  {
    id: "perplexity",
    name: "Perplexity",
    url: "https://www.perplexity.ai/",
    hostname: "www.perplexity.ai",
    hostnameAliases: ["perplexity.ai"],
    inputSelector: "#ask-input[data-lexical-editor='true'][role='textbox']",
    fallbackSelectors: [
      "div#ask-input[data-lexical-editor='true'][role='textbox']",
      "div#ask-input[contenteditable='true'][role='textbox']",
      "#ask-input[contenteditable='true']",
      "div[contenteditable='true'][role='textbox']",
      "textarea[placeholder*='Ask'][data-testid='search-input']",
      "textarea[placeholder*='Ask']",
      "textarea[placeholder*='질문']",
      "textarea"
    ],
    inputType: "contenteditable",
    submitSelector: "button[aria-label*='Submit'][type='submit'], button[type='submit'][aria-label*='검색'], button[aria-label*='submit' i], button[aria-label*='제출' i]",
    submitMethod: "click",
    selectorCheckMode: "input-only",
    waitMs: 2e3,
    fallback: true,
    lastVerified: "2026-03",
    verifiedVersion: "perplexity-web-mar-2026",
    authSelectors: [
      "input[type='email']",
      "input[type='password']",
      "button[data-testid='login-button']"
    ]
  }
]);

// src/shared/sites/constants.ts
var SITE_STORAGE_KEYS = Object.freeze({
  customSites: "customSites",
  builtInSiteStates: "builtInSiteStates",
  builtInSiteOverrides: "builtInSiteOverrides"
});
var VALID_INPUT_TYPES = /* @__PURE__ */ new Set(["textarea", "contenteditable", "input"]);
var VALID_SUBMIT_METHODS = /* @__PURE__ */ new Set(["click", "enter", "shift+enter"]);
var VALID_SELECTOR_CHECK_MODES = /* @__PURE__ */ new Set(["input-and-submit", "input-only"]);
var BUILT_IN_SITE_IDS = new Set(
  AI_SITES.map((site) => String(site?.id ?? "")).filter(Boolean)
);
var BUILT_IN_SITE_STYLE_MAP = Object.freeze({
  chatgpt: { color: "#10a37f", icon: "GPT" },
  gemini: { color: "#4285f4", icon: "Gem" },
  claude: { color: "#d97706", icon: "Cl" },
  grok: { color: "#000000", icon: "Gk" },
  perplexity: { color: "#20808d", icon: "Px" }
});

// src/shared/sites/normalizers.ts
function safeText2(value) {
  return typeof value === "string" ? value.trim() : "";
}
function normalizeBoolean2(value, fallback = true) {
  return typeof value === "boolean" ? value : fallback;
}
function normalizeWaitMs(value, fallback = 2e3) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) {
    return fallback;
  }
  return Math.min(8e3, Math.max(500, Math.round(numeric)));
}
function normalizeColor(value, fallback = "#c24f2e") {
  const color = safeText2(value);
  return /^#[0-9a-fA-F]{6}$/.test(color) ? color : fallback;
}
function normalizeIcon(value, fallback = "AI") {
  const icon = safeText2(value);
  return icon ? Array.from(icon).slice(0, 2).join("") : fallback;
}
function normalizeInputType(value, fallback = "textarea") {
  const inputType = safeText2(value);
  return VALID_INPUT_TYPES.has(inputType) ? inputType : fallback;
}
function normalizeSubmitMethod(value, fallback = "click") {
  const submitMethod = safeText2(value);
  return VALID_SUBMIT_METHODS.has(submitMethod) ? submitMethod : fallback;
}
function normalizeSelectorCheckMode(value, fallback = "input-and-submit") {
  const selectorCheckMode = safeText2(value);
  return VALID_SELECTOR_CHECK_MODES.has(selectorCheckMode) ? selectorCheckMode : fallback;
}
function normalizeHostname(value) {
  const input = safeText2(value).replace(/\/+$/g, "");
  if (!input) {
    return "";
  }
  try {
    return new URL(input).hostname.toLowerCase();
  } catch (_error) {
    return input.toLowerCase();
  }
}
function normalizeStringList(value) {
  if (Array.isArray(value)) {
    return value.map((entry) => safeText2(entry)).filter(Boolean);
  }
  if (typeof value === "string") {
    return value.split(/\r?\n/g).map((entry) => safeText2(entry)).filter(Boolean);
  }
  return [];
}
function normalizeHostnameAliases(value, primaryHostname = "") {
  const normalizedPrimaryHostname = normalizeHostname(primaryHostname);
  return Array.from(
    new Set(
      normalizeStringList(value).map((entry) => normalizeHostname(entry)).filter((entry) => entry && entry !== normalizedPrimaryHostname)
    )
  );
}
function deriveHostname(url) {
  try {
    return new URL(url).hostname;
  } catch (_error) {
    return "";
  }
}
function normalizeOriginHost(value) {
  const input = safeText2(value).replace(/\/+$/g, "");
  if (!input) {
    return "";
  }
  try {
    const parsed = new URL(input);
    if (parsed.host) {
      return parsed.host.toLowerCase();
    }
  } catch (_error) {
  }
  try {
    return new URL(`https://${input}`).host.toLowerCase();
  } catch (_nestedError) {
    return input.toLowerCase();
  }
}
function buildOriginPatterns(url, hostnameAliases = []) {
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
      return [];
    }
    const primaryHost = normalizeOriginHost(parsed.host);
    const primaryHostname = normalizeHostname(parsed.hostname);
    const normalizedAliases = Array.from(
      new Set(
        normalizeStringList(hostnameAliases).map((entry) => normalizeOriginHost(entry)).filter((entry) => entry && entry !== primaryHost && entry !== primaryHostname)
      )
    );
    return Array.from(
      new Set(
        [primaryHost, ...normalizedAliases].filter(Boolean).map((host) => `${parsed.protocol}//${host}/*`)
      )
    );
  } catch (_error) {
    return [];
  }
}
function createCustomSiteId(name) {
  const slug = safeText2(name).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 32);
  return `custom-${slug || Date.now()}-${Date.now().toString(36).slice(-4)}`;
}
function createImportedCustomSiteIdBase(site, index = 0) {
  const seed = [
    safeText2(site?.id),
    safeText2(site?.name),
    normalizeHostname(site?.hostname || deriveHostname(site?.url)),
    `site-${index + 1}`
  ].find(Boolean);
  const slug = safeText2(seed).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 32);
  return `custom-${slug || `site-${index + 1}`}`;
}
function ensureUniqueImportedSiteId(baseId, usedIds) {
  let candidate = safeText2(baseId) || "custom-site";
  let suffix = 2;
  while (usedIds.has(candidate)) {
    candidate = `${baseId}-${suffix}`;
    suffix += 1;
  }
  usedIds.add(candidate);
  return candidate;
}
function isPlainObject(value) {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}
function stringifyComparable(value) {
  try {
    return JSON.stringify(value ?? null);
  } catch (_error) {
    return "";
  }
}
var PERPLEXITY_PRIMARY_INPUT_SELECTOR = "#ask-input[data-lexical-editor='true'][role='textbox']";
var PERPLEXITY_SELECTOR_FALLBACKS = [
  "div#ask-input[data-lexical-editor='true'][role='textbox']",
  "div#ask-input[contenteditable='true'][role='textbox']",
  "#ask-input[contenteditable='true']",
  "div[contenteditable='true'][role='textbox']"
];
function normalizeSelectorArray(value) {
  return Array.isArray(value) ? value.filter((entry) => typeof entry === "string" && entry.trim()).map((entry) => entry.trim()) : [];
}
function normalizePerplexitySelectors(site = {}) {
  if (safeText2(site?.id) !== "perplexity") {
    return {
      inputSelector: safeText2(site?.inputSelector),
      fallbackSelectors: normalizeSelectorArray(site?.fallbackSelectors)
    };
  }
  const overrideInputSelector = safeText2(site?.inputSelector);
  const fallbackSelectors = normalizeSelectorArray(site?.fallbackSelectors);
  const mergedFallbackSelectors = Array.from(
    new Set(
      [
        overrideInputSelector && overrideInputSelector !== PERPLEXITY_PRIMARY_INPUT_SELECTOR ? overrideInputSelector : "",
        ...fallbackSelectors,
        ...PERPLEXITY_SELECTOR_FALLBACKS
      ].filter(Boolean)
    )
  );
  return {
    inputSelector: PERPLEXITY_PRIMARY_INPUT_SELECTOR,
    fallbackSelectors: mergedFallbackSelectors
  };
}
function buildBaseSiteRecord(site, builtInMeta = {}) {
  const style = BUILT_IN_SITE_STYLE_MAP[site.id] ?? {};
  const url = safeText2(site.url);
  const hostname = normalizeHostname(site.hostname || deriveHostname(url));
  const hostnameAliases = normalizeHostnameAliases(site.hostnameAliases, hostname);
  const normalizedSelectors = normalizePerplexitySelectors(site);
  return {
    id: safeText2(site.id),
    name: safeText2(site.name) || "AI Service",
    url,
    hostname,
    hostnameAliases,
    inputSelector: normalizedSelectors.inputSelector,
    inputType: normalizeInputType(site.inputType, "textarea"),
    submitSelector: safeText2(site.submitSelector),
    submitMethod: normalizeSubmitMethod(site.submitMethod, "click"),
    selectorCheckMode: normalizeSelectorCheckMode(site.selectorCheckMode, "input-and-submit"),
    waitMs: normalizeWaitMs(site.waitMs, 2e3),
    fallbackSelectors: normalizedSelectors.fallbackSelectors,
    fallback: normalizeBoolean2(site.fallback, true),
    authSelectors: Array.isArray(site.authSelectors) ? site.authSelectors.filter((entry) => typeof entry === "string" && entry.trim()) : [],
    lastVerified: safeText2(site.lastVerified),
    verifiedVersion: safeText2(site.verifiedVersion),
    enabled: normalizeBoolean2(site.enabled, true),
    color: normalizeColor(site.color, style.color ?? "#c24f2e"),
    icon: normalizeIcon(site.icon, style.icon ?? "AI"),
    isBuiltIn: Boolean(builtInMeta.isBuiltIn),
    isCustom: Boolean(builtInMeta.isCustom),
    deletable: Boolean(builtInMeta.isCustom),
    editable: true,
    permissionPatterns: buildOriginPatterns(url, hostnameAliases)
  };
}
function sanitizeBuiltInOverride(override = {}, originalSite = {}) {
  const submitMethod = normalizeSubmitMethod(override.submitMethod, originalSite.submitMethod);
  const submitSelector = submitMethod === "click" ? safeText2(override.submitSelector) || safeText2(originalSite.submitSelector) : safeText2(override.submitSelector);
  return {
    name: safeText2(override.name) || originalSite.name,
    inputSelector: safeText2(override.inputSelector) || originalSite.inputSelector,
    inputType: normalizeInputType(override.inputType, originalSite.inputType),
    submitSelector,
    submitMethod,
    selectorCheckMode: normalizeSelectorCheckMode(
      override.selectorCheckMode,
      originalSite.selectorCheckMode || "input-and-submit"
    ),
    waitMs: normalizeWaitMs(override.waitMs, originalSite.waitMs),
    fallbackSelectors: Array.isArray(override.fallbackSelectors) ? override.fallbackSelectors.filter((entry) => typeof entry === "string" && entry.trim()) : Array.isArray(originalSite.fallbackSelectors) ? [...originalSite.fallbackSelectors] : [],
    authSelectors: Array.isArray(override.authSelectors) ? override.authSelectors.filter((entry) => typeof entry === "string" && entry.trim()) : Array.isArray(originalSite.authSelectors) ? [...originalSite.authSelectors] : [],
    lastVerified: safeText2(override.lastVerified) || safeText2(originalSite.lastVerified),
    verifiedVersion: safeText2(override.verifiedVersion) || safeText2(originalSite.verifiedVersion),
    color: normalizeColor(
      override.color,
      BUILT_IN_SITE_STYLE_MAP[originalSite.id]?.color ?? "#c24f2e"
    ),
    icon: normalizeIcon(
      override.icon,
      BUILT_IN_SITE_STYLE_MAP[originalSite.id]?.icon ?? originalSite.name
    )
  };
}
function normalizeCustomSite(site) {
  const url = safeText2(site?.url);
  const hostname = normalizeHostname(site?.hostname || deriveHostname(url));
  return buildBaseSiteRecord(
    {
      id: safeText2(site?.id) || createCustomSiteId(site?.name),
      name: safeText2(site?.name) || "Custom AI",
      url,
      hostname,
      hostnameAliases: normalizeHostnameAliases(site?.hostnameAliases, hostname),
      inputSelector: safeText2(site?.inputSelector),
      inputType: normalizeInputType(site?.inputType, "textarea"),
      submitSelector: safeText2(site?.submitSelector),
      submitMethod: normalizeSubmitMethod(site?.submitMethod, "click"),
      selectorCheckMode: normalizeSelectorCheckMode(
        site?.selectorCheckMode,
        "input-and-submit"
      ),
      waitMs: normalizeWaitMs(site?.waitMs, 2e3),
      fallbackSelectors: normalizeStringList(site?.fallbackSelectors),
      fallback: normalizeBoolean2(site?.fallback, true),
      authSelectors: normalizeStringList(site?.authSelectors),
      lastVerified: safeText2(site?.lastVerified),
      verifiedVersion: safeText2(site?.verifiedVersion),
      enabled: normalizeBoolean2(site?.enabled, true),
      color: normalizeColor(site?.color, "#c24f2e"),
      icon: normalizeIcon(site?.icon, "AI")
    },
    { isCustom: true }
  );
}

// src/shared/security.ts
function escapeHTML(str) {
  if (typeof str !== "string") return "";
  const div = document.createElement("div");
  div.appendChild(document.createTextNode(str));
  return div.innerHTML;
}
function isValidURL(string) {
  try {
    const url = new URL(string);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch (_) {
    return false;
  }
}

// src/shared/sites/validation.ts
function validateSiteDraft(draft, { isBuiltIn = false } = {}) {
  const errors = [];
  const name = safeText2(draft?.name);
  const url = safeText2(draft?.url);
  const inputSelector = safeText2(draft?.inputSelector);
  if (!name) {
    errors.push("Service name is required.");
  }
  if (!isBuiltIn && !url) {
    errors.push("Service URL is required.");
  }
  if (url && !isValidURL(url)) {
    errors.push("Service URL must be a valid http or https URL.");
  }
  if (!inputSelector) {
    errors.push("Input selector is required.");
  }
  if (!VALID_INPUT_TYPES.has(safeText2(draft?.inputType))) {
    errors.push("Input type is invalid.");
  }
  if (!VALID_SUBMIT_METHODS.has(safeText2(draft?.submitMethod))) {
    errors.push("Submit method is invalid.");
  }
  const selectorCheckMode = safeText2(draft?.selectorCheckMode);
  if (selectorCheckMode && !VALID_SELECTOR_CHECK_MODES.has(selectorCheckMode)) {
    errors.push("Selector check mode is invalid.");
  }
  if (safeText2(draft?.submitMethod) === "click" && !safeText2(draft?.submitSelector)) {
    errors.push("Submit selector is required when using click submit.");
  }
  return {
    valid: errors.length === 0,
    errors
  };
}

// src/shared/sites/import-repair.ts
function detectBuiltInOverrideAdjustment(rawEntry, sanitized, source) {
  if (!isPlainObject(rawEntry)) {
    return true;
  }
  const allowedKeys = /* @__PURE__ */ new Set([
    "name",
    "inputSelector",
    "inputType",
    "submitSelector",
    "submitMethod",
    "selectorCheckMode",
    "waitMs",
    "fallbackSelectors",
    "authSelectors",
    "lastVerified",
    "verifiedVersion",
    "color",
    "icon"
  ]);
  if (Object.keys(rawEntry).some((key) => !allowedKeys.has(key))) {
    return true;
  }
  const simpleComparisons = [
    ["name", safeText2(rawEntry.name), sanitized.name],
    ["inputSelector", safeText2(rawEntry.inputSelector), sanitized.inputSelector],
    ["inputType", safeText2(rawEntry.inputType), sanitized.inputType],
    ["submitSelector", safeText2(rawEntry.submitSelector), sanitized.submitSelector],
    ["submitMethod", safeText2(rawEntry.submitMethod), sanitized.submitMethod],
    ["selectorCheckMode", safeText2(rawEntry.selectorCheckMode), sanitized.selectorCheckMode],
    ["lastVerified", safeText2(rawEntry.lastVerified), sanitized.lastVerified],
    ["verifiedVersion", safeText2(rawEntry.verifiedVersion), sanitized.verifiedVersion],
    ["color", safeText2(rawEntry.color), sanitized.color],
    ["icon", safeText2(rawEntry.icon), sanitized.icon]
  ];
  for (const [key, rawValue, sanitizedValue] of simpleComparisons) {
    if (Object.prototype.hasOwnProperty.call(rawEntry, key) && rawValue !== sanitizedValue) {
      return true;
    }
  }
  if (Object.prototype.hasOwnProperty.call(rawEntry, "waitMs") && normalizeWaitMs(rawEntry.waitMs, source.waitMs) !== sanitized.waitMs) {
    return true;
  }
  if (Array.isArray(rawEntry.fallbackSelectors) && stringifyComparable(rawEntry.fallbackSelectors.filter((entry) => typeof entry === "string" && entry.trim())) !== stringifyComparable(sanitized.fallbackSelectors)) {
    return true;
  }
  if (Array.isArray(rawEntry.authSelectors) && stringifyComparable(rawEntry.authSelectors.filter((entry) => typeof entry === "string" && entry.trim())) !== stringifyComparable(sanitized.authSelectors)) {
    return true;
  }
  return false;
}
function repairImportedBuiltInStates(value) {
  if (!isPlainObject(value)) {
    return {
      normalized: {},
      appliedIds: [],
      droppedIds: []
    };
  }
  const normalized = {};
  const appliedIds = [];
  const droppedIds = [];
  for (const [key, entry] of Object.entries(value)) {
    if (!BUILT_IN_SITE_IDS.has(key)) {
      droppedIds.push(key);
      continue;
    }
    normalized[key] = { enabled: normalizeBoolean2(entry?.enabled, true) };
    appliedIds.push(key);
  }
  return {
    normalized,
    appliedIds,
    droppedIds
  };
}
function repairImportedBuiltInOverrides(value) {
  if (!isPlainObject(value)) {
    return {
      normalized: {},
      appliedIds: [],
      droppedIds: [],
      adjustedIds: []
    };
  }
  const normalized = {};
  const appliedIds = [];
  const droppedIds = [];
  const adjustedIds = [];
  for (const [key, entry] of Object.entries(value)) {
    const source = AI_SITES.find((site) => site.id === key);
    if (!source) {
      droppedIds.push(key);
      continue;
    }
    const sanitized = sanitizeBuiltInOverride(entry, source);
    const mergedDraft = {
      ...source,
      ...sanitized
    };
    const validation = validateSiteDraft(mergedDraft, { isBuiltIn: true });
    const finalOverride = validation.valid ? sanitized : sanitizeBuiltInOverride({}, source);
    normalized[key] = finalOverride;
    appliedIds.push(key);
    if (!validation.valid || detectBuiltInOverrideAdjustment(entry, finalOverride, source)) {
      adjustedIds.push(key);
    }
  }
  return {
    normalized,
    appliedIds,
    droppedIds,
    adjustedIds
  };
}
function repairImportedCustomSites(rawSites) {
  const repairedSites = [];
  const rejectedSites = [];
  const rewrittenIds = [];
  const usedIds = new Set(BUILT_IN_SITE_IDS);
  for (const [index, rawSite] of (Array.isArray(rawSites) ? rawSites : []).entries()) {
    const normalized = normalizeCustomSite(rawSite);
    const validation = validateSiteDraft(normalized);
    if (!validation.valid) {
      rejectedSites.push({
        id: safeText2(rawSite?.id) || normalized.id,
        name: normalized.name,
        reason: "validation_failed",
        errors: validation.errors
      });
      continue;
    }
    const requestedId = safeText2(rawSite?.id) || "";
    let finalId = requestedId;
    if (!finalId) {
      finalId = ensureUniqueImportedSiteId(
        createImportedCustomSiteIdBase(
          {
            ...rawSite,
            name: normalized.name,
            hostname: normalized.hostname,
            url: normalized.url
          },
          index
        ),
        usedIds
      );
    } else if (usedIds.has(finalId)) {
      const collisionBase = BUILT_IN_SITE_IDS.has(finalId) ? createImportedCustomSiteIdBase(
        {
          ...rawSite,
          name: normalized.name,
          hostname: normalized.hostname,
          url: normalized.url
        },
        index
      ) : finalId;
      finalId = ensureUniqueImportedSiteId(collisionBase, usedIds);
    } else {
      usedIds.add(finalId);
    }
    if (finalId !== normalized.id || requestedId && finalId !== requestedId) {
      rewrittenIds.push({
        from: requestedId || normalized.id,
        to: finalId,
        name: normalized.name
      });
    }
    repairedSites.push({
      ...normalized,
      id: finalId
    });
  }
  return {
    repairedSites,
    rejectedSites,
    rewrittenIds
  };
}

// src/shared/sites/storage.ts
async function readLocal2(key, fallbackValue) {
  const result = await chrome.storage.local.get(key);
  return result[key] ?? fallbackValue;
}
async function writeLocal2(key, value) {
  await chrome.storage.local.set({ [key]: value });
}
async function getCustomSites() {
  const rawSites = await readLocal2(SITE_STORAGE_KEYS.customSites, []);
  return Array.isArray(rawSites) ? rawSites.map((site) => normalizeCustomSite(site)) : [];
}
async function setCustomSites(sites) {
  const normalized = Array.isArray(sites) ? sites.map((site) => normalizeCustomSite(site)) : [];
  await writeLocal2(SITE_STORAGE_KEYS.customSites, normalized);
  return normalized;
}
async function getBuiltInSiteStates() {
  const rawStates = await readLocal2(SITE_STORAGE_KEYS.builtInSiteStates, {});
  return repairImportedBuiltInStates(rawStates).normalized;
}
async function setBuiltInSiteStates(states) {
  const normalized = repairImportedBuiltInStates(states).normalized;
  await writeLocal2(SITE_STORAGE_KEYS.builtInSiteStates, normalized);
  return normalized;
}
async function getBuiltInSiteOverrides() {
  const rawOverrides = await readLocal2(SITE_STORAGE_KEYS.builtInSiteOverrides, {});
  return repairImportedBuiltInOverrides(rawOverrides).normalized;
}
async function setBuiltInSiteOverrides(overrides) {
  const normalized = repairImportedBuiltInOverrides(overrides).normalized;
  await writeLocal2(SITE_STORAGE_KEYS.builtInSiteOverrides, normalized);
  return normalized;
}

// src/shared/sites/runtime-sites.ts
function getCustomSitePermissionPatterns(site) {
  return Array.isArray(site?.permissionPatterns) ? site.permissionPatterns.filter((pattern) => typeof pattern === "string" && pattern.trim()) : [];
}
function collectCustomSitePermissionPatterns(sites = []) {
  return new Set(
    (Array.isArray(sites) ? sites : []).flatMap((site) => getCustomSitePermissionPatterns(site)).filter(Boolean)
  );
}
async function cleanupUnusedCustomSitePermissions(previousSites = [], nextSites = []) {
  const nextOrigins = collectCustomSitePermissionPatterns(nextSites);
  const removableOrigins = [...collectCustomSitePermissionPatterns(previousSites)].filter(
    (origin) => !nextOrigins.has(origin)
  );
  if (removableOrigins.length === 0 || !chrome.permissions?.remove) {
    return [];
  }
  try {
    const removed = await chrome.permissions.remove({ origins: removableOrigins });
    return removed ? removableOrigins : [];
  } catch (_error) {
    return [];
  }
}
async function getRuntimeSites() {
  const [customSites, builtInStates, builtInOverrides] = await Promise.all([
    getCustomSites(),
    getBuiltInSiteStates(),
    getBuiltInSiteOverrides()
  ]);
  const builtInSites = AI_SITES.map((site) => {
    const override = builtInOverrides[site.id] ?? {};
    const state2 = builtInStates[site.id] ?? {};
    return buildBaseSiteRecord(
      {
        ...site,
        ...override,
        enabled: normalizeBoolean2(state2.enabled, true)
      },
      { isBuiltIn: true }
    );
  });
  return [...builtInSites, ...customSites];
}
async function findRuntimeSiteById(siteId) {
  const sites = await getRuntimeSites();
  return sites.find((site) => site.id === siteId) ?? null;
}
async function saveCustomSite(siteDraft) {
  const customSites = await getCustomSites();
  const nextSite = normalizeCustomSite(siteDraft);
  const nextSites = [...customSites];
  const index = nextSites.findIndex((site) => site.id === nextSite.id);
  if (index >= 0) {
    nextSites[index] = nextSite;
  } else {
    nextSites.unshift(nextSite);
  }
  await setCustomSites(nextSites);
  await cleanupUnusedCustomSitePermissions(customSites, nextSites);
  return nextSite;
}
async function saveBuiltInSiteOverride(siteId, overrideDraft) {
  const source = AI_SITES.find((site) => site.id === siteId);
  if (!source) {
    throw new Error("Built-in site not found.");
  }
  const overrides = await getBuiltInSiteOverrides();
  overrides[siteId] = sanitizeBuiltInOverride(
    overrideDraft ?? {},
    source
  );
  await setBuiltInSiteOverrides(overrides);
  return overrides[siteId];
}
async function updateRuntimeSite(siteId, partialDraft = {}) {
  const runtimeSite = await findRuntimeSiteById(siteId);
  if (!runtimeSite) {
    throw new Error("Runtime site not found.");
  }
  const nextDraft = {
    ...runtimeSite,
    ...partialDraft ?? {}
  };
  if (runtimeSite.isBuiltIn) {
    await saveBuiltInSiteOverride(siteId, nextDraft);
    if (typeof partialDraft.enabled === "boolean") {
      await setRuntimeSiteEnabled(siteId, partialDraft.enabled);
    }
    return findRuntimeSiteById(siteId);
  }
  await saveCustomSite(nextDraft);
  return findRuntimeSiteById(siteId);
}
async function setRuntimeSiteEnabled(siteId, enabled) {
  const builtInSite = AI_SITES.find((site) => site.id === siteId);
  if (builtInSite) {
    const states = await getBuiltInSiteStates();
    states[siteId] = { enabled: Boolean(enabled) };
    await setBuiltInSiteStates(states);
    return;
  }
  const customSites = await getCustomSites();
  const nextSites = customSites.map(
    (site) => site.id === siteId ? { ...site, enabled: Boolean(enabled) } : site
  );
  await setCustomSites(nextSites);
}

// src/shared/prompts/template-cache-store.ts
async function getTemplateVariableCache() {
  const rawCache = await readLocal(LOCAL_STORAGE_KEYS.templateVariableCache, {});
  return normalizeTemplateDefaults(rawCache);
}
async function setTemplateVariableCache(cache) {
  const normalized = normalizeTemplateDefaults(cache);
  await writeLocal(LOCAL_STORAGE_KEYS.templateVariableCache, normalized);
  return normalized;
}

// src/shared/prompts/import-export.ts
var CURRENT_EXPORT_VERSION = 5;
async function containsOriginPermission(originPattern) {
  try {
    if (!chrome.permissions?.contains || !originPattern) {
      return false;
    }
    return await chrome.permissions.contains({
      origins: [originPattern]
    });
  } catch (_error) {
    return false;
  }
}
async function findMissingOriginPermissions(originPatterns = []) {
  const missingOrigins = [];
  for (const originPattern of Array.isArray(originPatterns) ? originPatterns : []) {
    if (!originPattern) {
      continue;
    }
    if (!await containsOriginPermission(originPattern)) {
      missingOrigins.push(originPattern);
    }
  }
  return missingOrigins;
}
async function repairImportedCustomSitesWithPermissions(rawSites) {
  const repaired = repairImportedCustomSites(rawSites);
  const requestedOrigins = /* @__PURE__ */ new Set();
  const deniedOrigins = /* @__PURE__ */ new Set();
  const blockedOrigins = /* @__PURE__ */ new Set();
  const acceptedSites = [];
  const permissionDeniedSites = [];
  for (const site of repaired.repairedSites) {
    const permissionPatterns = Array.isArray(site?.permissionPatterns) ? site.permissionPatterns.filter((pattern) => typeof pattern === "string" && pattern.trim()) : [];
    permissionPatterns.forEach((origin) => requestedOrigins.add(origin));
    const blockedForSite = permissionPatterns.filter((origin) => blockedOrigins.has(origin));
    if (blockedForSite.length > 0) {
      blockedForSite.forEach((origin) => deniedOrigins.add(origin));
      permissionDeniedSites.push({
        id: site.id,
        name: site.name,
        reason: "permission_denied",
        origins: blockedForSite
      });
      continue;
    }
    const missingOrigins = await findMissingOriginPermissions(permissionPatterns);
    if (missingOrigins.length === 0) {
      acceptedSites.push(site);
      continue;
    }
    try {
      const granted = chrome.permissions?.request ? await chrome.permissions.request({ origins: missingOrigins }) : false;
      if (granted) {
        acceptedSites.push(site);
        continue;
      }
    } catch (_error) {
    }
    missingOrigins.forEach((origin) => {
      blockedOrigins.add(origin);
      deniedOrigins.add(origin);
    });
    permissionDeniedSites.push({
      id: site.id,
      name: site.name,
      reason: "permission_denied",
      origins: missingOrigins
    });
  }
  return {
    acceptedSites,
    rejectedSites: [...repaired.rejectedSites, ...permissionDeniedSites],
    rewrittenIds: repaired.rewrittenIds,
    deniedOrigins: [...deniedOrigins],
    requestedOrigins: [...requestedOrigins]
  };
}
function normalizeImportVersion(value) {
  const version = Number(value);
  if (!Number.isFinite(version) || version <= 0) {
    return 1;
  }
  return Math.max(1, Math.floor(version));
}
function migrateV1ToV2(payload) {
  return {
    ...payload,
    version: 2,
    broadcastCounter: payload.broadcastCounter ?? 0
  };
}
function migrateV2ToV3(payload) {
  return {
    ...payload,
    version: 3,
    builtInSiteStates: payload.builtInSiteStates ?? {},
    builtInSiteOverrides: payload.builtInSiteOverrides ?? {}
  };
}
function migrateV3ToV4(payload) {
  return {
    ...payload,
    version: 4,
    settings: normalizeSettings(payload.settings ?? DEFAULT_SETTINGS),
    history: safeArray(payload.history).map((entry) => buildHistoryEntry(entry)),
    favorites: safeArray(payload.favorites).map((entry) => buildFavoriteEntry(entry))
  };
}
function migrateV4ToV5(payload) {
  return {
    ...payload,
    version: 5,
    history: safeArray(payload.history).map((entry) => buildHistoryEntry(entry)),
    favorites: safeArray(payload.favorites).map((entry) => buildFavoriteEntry(entry))
  };
}
function migrateImportData(rawValue) {
  let payload = safeObject(rawValue);
  const sourceVersion = normalizeImportVersion(payload.version);
  let workingVersion = sourceVersion;
  if (workingVersion < 2) {
    payload = migrateV1ToV2(payload);
    workingVersion = 2;
  }
  if (workingVersion < 3) {
    payload = migrateV2ToV3(payload);
    workingVersion = 3;
  }
  if (workingVersion < 4) {
    payload = migrateV3ToV4(payload);
    workingVersion = 4;
  }
  if (workingVersion < 5) {
    payload = migrateV4ToV5(payload);
    workingVersion = 5;
  }
  return {
    migrated: payload,
    sourceVersion,
    targetVersion: CURRENT_EXPORT_VERSION
  };
}
async function exportPromptData() {
  const [
    broadcastCounter,
    history,
    favorites,
    templateVariableCache,
    settings,
    customSites,
    builtInSiteStates,
    builtInSiteOverrides
  ] = await Promise.all([
    getBroadcastCounter(),
    getPromptHistory(),
    getPromptFavorites(),
    getTemplateVariableCache(),
    getAppSettings(),
    getCustomSites(),
    getBuiltInSiteStates(),
    getBuiltInSiteOverrides()
  ]);
  return {
    exportedAt: (/* @__PURE__ */ new Date()).toISOString(),
    version: CURRENT_EXPORT_VERSION,
    broadcastCounter,
    history,
    favorites,
    templateVariableCache,
    settings,
    customSites,
    builtInSiteStates,
    builtInSiteOverrides
  };
}
async function importPromptData(jsonString) {
  const parsed = JSON.parse(jsonString);
  const { migrated, sourceVersion, targetVersion } = migrateImportData(parsed);
  const previousCustomSites = await getCustomSites();
  const history = safeArray(migrated?.history).map((item) => buildHistoryEntry(item));
  const favorites = safeArray(migrated?.favorites).map(
    (item) => buildFavoriteEntry(item)
  );
  const importedBroadcastCounter = normalizeBroadcastCounter(migrated?.broadcastCounter);
  const templateVariableCache = normalizeTemplateDefaults(migrated?.templateVariableCache);
  const importedSettings = normalizeSettings(migrated?.settings ?? DEFAULT_SETTINGS);
  const importedCustomSites = safeArray(migrated?.customSites);
  const importedBuiltInSiteStates = safeObject(migrated?.builtInSiteStates);
  const importedBuiltInSiteOverrides = safeObject(migrated?.builtInSiteOverrides);
  const historyLimit = importedSettings.historyLimit;
  const normalizedHistory = [];
  for (const item of sortByDateDesc(history).slice(0, historyLimit)) {
    normalizedHistory.push({
      ...item,
      id: ensureUniqueNumericId(normalizedHistory, Number(item.id))
    });
  }
  const normalizedFavorites = [];
  for (const item of sortByDateDesc(favorites, "favoritedAt")) {
    normalizedFavorites.push({
      ...item,
      id: ensureUniqueStringId(normalizedFavorites, String(item.id))
    });
  }
  const customSiteImport = await repairImportedCustomSitesWithPermissions(importedCustomSites);
  const builtInStateImport = repairImportedBuiltInStates(importedBuiltInSiteStates);
  const builtInOverrideImport = repairImportedBuiltInOverrides(importedBuiltInSiteOverrides);
  await setAppSettings(importedSettings);
  await Promise.all([
    setBroadcastCounter(importedBroadcastCounter),
    setPromptFavorites(normalizedFavorites),
    setTemplateVariableCache(templateVariableCache),
    setCustomSites(customSiteImport.acceptedSites),
    setBuiltInSiteStates(builtInStateImport.normalized),
    setBuiltInSiteOverrides(builtInOverrideImport.normalized)
  ]);
  await cleanupUnusedCustomSitePermissions(previousCustomSites, customSiteImport.acceptedSites);
  await setPromptHistory(normalizedHistory);
  return {
    broadcastCounter: importedBroadcastCounter,
    history: normalizedHistory,
    favorites: normalizedFavorites,
    templateVariableCache,
    settings: importedSettings,
    customSites: customSiteImport.acceptedSites,
    builtInSiteStates: builtInStateImport.normalized,
    builtInSiteOverrides: builtInOverrideImport.normalized,
    importSummary: {
      version: targetVersion,
      migratedFromVersion: sourceVersion,
      customSites: {
        importedCount: importedCustomSites.length,
        acceptedIds: customSiteImport.acceptedSites.map((site) => site.id),
        acceptedNames: customSiteImport.acceptedSites.map((site) => site.name),
        rejected: customSiteImport.rejectedSites,
        rewrittenIds: customSiteImport.rewrittenIds,
        deniedOrigins: customSiteImport.deniedOrigins
      },
      builtInSiteStates: {
        appliedIds: builtInStateImport.appliedIds,
        droppedIds: builtInStateImport.droppedIds
      },
      builtInSiteOverrides: {
        appliedIds: builtInOverrideImport.appliedIds,
        droppedIds: builtInOverrideImport.droppedIds,
        adjustedIds: builtInOverrideImport.adjustedIds
      }
    }
  };
}

// src/options/app/state.ts
var state = {
  history: [],
  favorites: [],
  runtimeSites: [],
  settings: { ...DEFAULT_SETTINGS },
  activeSection: "dashboard",
  historyPage: 1,
  selectedHistoryIds: /* @__PURE__ */ new Set(),
  pendingImportSummary: null,
  filters: {
    service: "all",
    dateFrom: "",
    dateTo: ""
  }
};

// src/options/app/dom.ts
var optionsDom = {
  navigation: {
    navButtons: [...document.querySelectorAll(".nav-button")],
    pageSections: [...document.querySelectorAll(".page-section")],
    pageStatus: document.getElementById("page-status")
  },
  dashboard: {
    dashboardCards: document.getElementById("dashboard-cards"),
    serviceDonut: document.getElementById("service-donut"),
    dailyBarChart: document.getElementById("daily-bar-chart")
  },
  history: {
    historyServiceFilter: document.getElementById("history-service-filter"),
    historyDateFrom: document.getElementById("history-date-from"),
    historyDateTo: document.getElementById("history-date-to"),
    historyExportCsv: document.getElementById("history-export-csv"),
    historyTableWrap: document.getElementById("history-table-wrap"),
    historySelectAll: document.getElementById("history-select-all"),
    historySelectAllLabel: document.getElementById("history-select-all-label"),
    historyDeleteSelected: document.getElementById("history-delete-selected"),
    historyDeleteFiltered: document.getElementById("history-delete-filtered"),
    historyDelete7d: document.getElementById("history-delete-7d"),
    historyDelete30d: document.getElementById("history-delete-30d"),
    historyDelete90d: document.getElementById("history-delete-90d"),
    historyPrevPage: document.getElementById("history-prev-page"),
    historyNextPage: document.getElementById("history-next-page"),
    historyPageInfo: document.getElementById("history-page-info")
  },
  schedules: {
    schedulesList: document.getElementById("schedules-list")
  },
  services: {
    servicesGrid: document.getElementById("services-grid")
  },
  settings: {
    historyLimitSlider: document.getElementById("history-limit-slider"),
    historyLimitValue: document.getElementById("history-limit-value"),
    autoCloseToggle: document.getElementById("auto-close-toggle"),
    desktopNotificationToggle: document.getElementById("desktop-notification-toggle"),
    reuseTabsToggle: document.getElementById("reuse-tabs-toggle"),
    reuseTabsSettingTitle: document.getElementById("reuse-tabs-setting-title"),
    reuseTabsSettingDesc: document.getElementById("reuse-tabs-setting-desc"),
    waitMultiplierSettingTitle: document.getElementById("wait-multiplier-setting-title"),
    waitMultiplierSlider: document.getElementById("wait-multiplier-slider"),
    waitMultiplierSettingValue: document.getElementById("wait-multiplier-setting-value"),
    shortcutList: document.getElementById("shortcut-list"),
    openShortcutsBtn: document.getElementById("open-shortcuts-btn"),
    settingsResetData: document.getElementById("settings-reset-data"),
    settingsExportJson: document.getElementById("settings-export-json"),
    settingsImportJson: document.getElementById("settings-import-json"),
    settingsImportJsonInput: document.getElementById("settings-import-json-input")
  },
  modals: {
    historyModal: document.getElementById("history-modal"),
    historyModalClose: document.getElementById("history-modal-close"),
    historyModalMeta: document.getElementById("history-modal-meta"),
    historyModalServices: document.getElementById("history-modal-services"),
    historyModalText: document.getElementById("history-modal-text"),
    importReportModal: document.getElementById("import-report-modal"),
    importReportModalClose: document.getElementById("import-report-modal-close"),
    importReportModalTitle: document.getElementById("import-report-modal-title"),
    importReportModalDesc: document.getElementById("import-report-modal-desc"),
    importReportBody: document.getElementById("import-report-body")
  },
  toastHost: document.getElementById("toast-host")
};

// src/options/ui/charts.ts
var CHART_COLORS = ["#c24f2e", "#f2a446", "#2a9d8f", "#457b9d", "#7b61ff", "#bc6c25"];
function createEmptyState(message) {
  return `<div class="empty-state">${message}</div>`;
}
function polarToCartesian(cx, cy, radius, angle) {
  const radian = (angle - 90) * Math.PI / 180;
  return {
    x: cx + radius * Math.cos(radian),
    y: cy + radius * Math.sin(radian)
  };
}
function createDonutSlicePath(cx, cy, outerRadius, innerRadius, startAngle, endAngle) {
  const outerStart = polarToCartesian(cx, cy, outerRadius, endAngle);
  const outerEnd = polarToCartesian(cx, cy, outerRadius, startAngle);
  const innerStart = polarToCartesian(cx, cy, innerRadius, startAngle);
  const innerEnd = polarToCartesian(cx, cy, innerRadius, endAngle);
  const largeArcFlag = endAngle - startAngle > 180 ? 1 : 0;
  return [
    `M ${outerStart.x} ${outerStart.y}`,
    `A ${outerRadius} ${outerRadius} 0 ${largeArcFlag} 0 ${outerEnd.x} ${outerEnd.y}`,
    `L ${innerStart.x} ${innerStart.y}`,
    `A ${innerRadius} ${innerRadius} 0 ${largeArcFlag} 1 ${innerEnd.x} ${innerEnd.y}`,
    "Z"
  ].join(" ");
}
function buildDonutMarkup(items, labels) {
  if (items.length === 0) {
    return createEmptyState(labels.noUsage);
  }
  let currentAngle = 0;
  const total = items.reduce((sum, item) => sum + item.count, 0);
  const segments = items.map((item, index) => {
    const angleSize = item.count / total * 360;
    const path = createDonutSlicePath(110, 110, 86, 48, currentAngle, currentAngle + angleSize);
    const color = CHART_COLORS[index % CHART_COLORS.length];
    currentAngle += angleSize;
    return { ...item, path, color };
  });
  return `
    <div class="chart-box">
      <svg class="chart-svg" viewBox="0 0 220 220" role="img" aria-label="${labels.donutAria}">
        ${segments.map((segment) => `<path d="${segment.path}" fill="${segment.color}"></path>`).join("")}
        <text x="110" y="102" text-anchor="middle" font-size="14" fill="currentColor">${labels.totalSent}</text>
        <text x="110" y="126" text-anchor="middle" font-size="28" font-weight="700" fill="currentColor">${total}</text>
      </svg>
      <div class="legend">
        ${segments.map(
    (segment) => `
              <div class="legend-row">
                <span class="legend-label">
                  <span class="swatch" style="background:${segment.color}"></span>
                  <span>${segment.label}</span>
                </span>
                <span>${Math.round(segment.count / total * 100)}%</span>
              </div>
            `
  ).join("")}
      </div>
    </div>
  `;
}
function buildBarChartMarkup(items, labels) {
  if (items.length === 0) {
    return createEmptyState(labels.noDaily);
  }
  const maxValue = Math.max(...items.map((item) => item.count), 1);
  const barWidth = 38;
  const gap = 12;
  const chartHeight = 180;
  const bars = items.map((item, index) => {
    const height = item.count / maxValue * 120;
    const x = 20 + index * (barWidth + gap);
    const y = 24 + (120 - height);
    return `
        <rect x="${x}" y="${y}" width="${barWidth}" height="${height}" rx="10" fill="${CHART_COLORS[index % CHART_COLORS.length]}"></rect>
        <text x="${x + barWidth / 2}" y="164" text-anchor="middle" font-size="12" fill="currentColor">${item.label}</text>
        <text x="${x + barWidth / 2}" y="${y - 6}" text-anchor="middle" font-size="12" fill="currentColor">${item.count}</text>
      `;
  }).join("");
  return `
    <svg class="chart-svg" viewBox="0 0 380 ${chartHeight}" role="img" aria-label="${labels.barAria}">
      ${bars}
    </svg>
  `;
}

// src/options/app/helpers.ts
function buildImportSummaryText(summary, { short = false } = {}) {
  const acceptedCount = summary?.customSites?.acceptedIds?.length ?? 0;
  const rejectedCount = summary?.customSites?.rejected?.length ?? 0;
  const rewrittenCount = summary?.customSites?.rewrittenIds?.length ?? 0;
  const deniedCount = (summary?.customSites?.rejected ?? []).filter(
    (entry) => entry?.reason === "permission_denied"
  ).length;
  const overrideAdjustedCount = summary?.builtInSiteOverrides?.adjustedIds?.length ?? 0;
  const overrideDroppedCount = summary?.builtInSiteOverrides?.droppedIds?.length ?? 0;
  const stateDroppedCount = summary?.builtInSiteStates?.droppedIds?.length ?? 0;
  if (isKorean) {
    const parts2 = [
      `가져오기 완료: 커스텀 서비스 ${acceptedCount}개 적용`,
      rejectedCount > 0 ? `건너뜀 ${rejectedCount}개` : "",
      rewrittenCount > 0 ? `ID 재작성 ${rewrittenCount}개` : "",
      deniedCount > 0 ? `권한 거부 ${deniedCount}개` : ""
    ].filter(Boolean);
    if (!short && overrideAdjustedCount + overrideDroppedCount + stateDroppedCount > 0) {
      parts2.push(
        `기본 서비스 보정 ${overrideAdjustedCount + overrideDroppedCount + stateDroppedCount}개`
      );
    }
    return parts2.join(", ");
  }
  const parts = [
    `Import complete: ${acceptedCount} custom service(s) applied`,
    rejectedCount > 0 ? `${rejectedCount} skipped` : "",
    rewrittenCount > 0 ? `${rewrittenCount} id rewrite(s)` : "",
    deniedCount > 0 ? `${deniedCount} permission denial(s)` : ""
  ].filter(Boolean);
  if (!short && overrideAdjustedCount + overrideDroppedCount + stateDroppedCount > 0) {
    parts.push(
      `${overrideAdjustedCount + overrideDroppedCount + stateDroppedCount} built-in adjustment(s)`
    );
  }
  return parts.join(", ");
}
function formatDateTime(value) {
  try {
    return new Intl.DateTimeFormat(locale, {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit"
    }).format(new Date(value));
  } catch (_error) {
    return value;
  }
}
function formatShortDate(value) {
  try {
    return new Intl.DateTimeFormat(locale, {
      month: "numeric",
      day: "numeric"
    }).format(new Date(value));
  } catch (_error) {
    return value;
  }
}
function previewText(text, maxLength = 60) {
  const collapsed = String(text ?? "").replace(/\s+/g, " ").trim();
  return collapsed.length <= maxLength ? collapsed || "-" : `${collapsed.slice(0, maxLength)}...`;
}
function getSiteLabel(siteId, runtimeSites = []) {
  return runtimeSites.find((site) => site.id === siteId)?.name ?? AI_SITES.find((site) => site.id === siteId)?.name ?? siteId;
}
function getRequestedServices(entry) {
  const siteResultKeys = Object.keys(entry.siteResults ?? {});
  if (Array.isArray(entry?.requestedSiteIds) && entry.requestedSiteIds.length > 0) {
    return entry.requestedSiteIds;
  }
  return siteResultKeys.length > 0 ? siteResultKeys : entry.sentTo ?? [];
}
function getSubmittedServices(entry) {
  if (Array.isArray(entry?.submittedSiteIds) && entry.submittedSiteIds.length > 0) {
    return entry.submittedSiteIds;
  }
  return entry.sentTo ?? [];
}
function getStatusInfo(status) {
  switch (status) {
    case "submitted":
      return { label: t.statuses.submitted, className: "success" };
    case "partial":
      return { label: t.statuses.partial, className: "partial" };
    case "failed":
      return { label: t.statuses.failed, className: "failed" };
    default:
      return { label: status || t.statuses.unknown, className: "" };
  }
}
function buildBadgeMarkup(siteId, runtimeSites = []) {
  return `<span class="badge">${escapeHTML(getSiteLabel(siteId, runtimeSites))}</span>`;
}
function createEmptyState2(message) {
  return `<div class="empty-state">${escapeHTML(message)}</div>`;
}
function buildImportReportMarkup(summary) {
  if (!summary) {
    return "";
  }
  const rejectedRows = (summary.customSites?.rejected ?? []).map((entry) => {
    const origins = Array.isArray(entry?.origins) && entry.origins.length > 0 ? `<div class="helper">${escapeHTML(entry.origins.join(", "))}</div>` : "";
    return `
      <div class="settings-control">
        <strong>${escapeHTML(entry?.name ?? entry?.id ?? "-")}</strong>
        <div>${escapeHTML(t.settings.importRejectReason(entry?.reason ?? "unknown"))}</div>
        ${origins}
      </div>
    `;
  }).join("");
  return `
    <div class="settings-control">
      <strong>${escapeHTML(t.settings.importReportVersion)}</strong>
      <div>${escapeHTML(`v${summary.version} (from v${summary.migratedFromVersion})`)}</div>
    </div>
    <div class="settings-control">
      <strong>${escapeHTML(t.settings.importReportAccepted)}</strong>
      <div>${escapeHTML(summary.customSites?.acceptedNames?.join(", ") || "-")}</div>
    </div>
    <div class="settings-control">
      <strong>${escapeHTML(t.settings.importReportRewritten)}</strong>
      <div>${escapeHTML(summary.customSites?.rewrittenIds?.join(", ") || "-")}</div>
    </div>
    <div class="settings-control">
      <strong>${escapeHTML(t.settings.importReportBuiltins)}</strong>
      <div>${escapeHTML([
    ...summary.builtInSiteOverrides?.adjustedIds ?? [],
    ...summary.builtInSiteOverrides?.droppedIds ?? [],
    ...summary.builtInSiteStates?.droppedIds ?? []
  ].join(", ") || "-")}</div>
    </div>
    <div class="settings-control">
      <strong>${escapeHTML(t.settings.importReportRejected)}</strong>
      ${rejectedRows || `<div class="helper">${escapeHTML(t.settings.importReportRejectedEmpty)}</div>`}
    </div>
  `;
}

// src/options/features/dashboard.ts
var { dashboardCards, serviceDonut, dailyBarChart } = optionsDom.dashboard;
function getStartOfCurrentWeek() {
  const now = /* @__PURE__ */ new Date();
  const result = new Date(now);
  const offset = (result.getDay() + 6) % 7;
  result.setHours(0, 0, 0, 0);
  result.setDate(result.getDate() - offset);
  return result;
}
function buildDashboardMetrics(history = state.history) {
  const serviceCounts = /* @__PURE__ */ new Map();
  let totalPromptLength = 0;
  history.forEach((entry) => {
    totalPromptLength += entry.text.length;
    getRequestedServices(entry).forEach((siteId) => {
      serviceCounts.set(siteId, (serviceCounts.get(siteId) ?? 0) + 1);
    });
  });
  const mostUsed = [...serviceCounts.entries()].sort((left, right) => right[1] - left[1])[0];
  const weekStart = getStartOfCurrentWeek();
  const weekCount = history.filter((entry) => new Date(entry.createdAt) >= weekStart).length;
  const averagePromptLength = history.length > 0 ? Math.round(totalPromptLength / history.length) : 0;
  const donutItems = [...serviceCounts.entries()].sort((left, right) => right[1] - left[1]).map(([siteId, count]) => ({
    id: siteId,
    label: getSiteLabel(siteId, state.runtimeSites),
    count
  }));
  const dailyCounts = [];
  for (let index = 6; index >= 0; index -= 1) {
    const date = /* @__PURE__ */ new Date();
    date.setHours(0, 0, 0, 0);
    date.setDate(date.getDate() - index);
    const dateKey = date.toISOString().slice(0, 10);
    dailyCounts.push({
      key: dateKey,
      label: formatShortDate(date),
      count: history.filter((entry) => entry.createdAt.slice(0, 10) === dateKey).length
    });
  }
  return {
    totalTransmissions: history.length,
    mostUsedService: mostUsed ? getSiteLabel(mostUsed[0], state.runtimeSites) : "-",
    weekCount,
    averagePromptLength,
    donutItems,
    dailyCounts
  };
}
function renderDashboard() {
  const metrics = buildDashboardMetrics(state.history);
  const cards = [
    { label: t.cards.totalTransmissions, value: metrics.totalTransmissions },
    { label: t.cards.mostUsedService, value: metrics.mostUsedService },
    { label: t.cards.weekCount, value: metrics.weekCount },
    { label: t.cards.averagePromptLength, value: `${metrics.averagePromptLength} ${t.cards.charSuffix}` }
  ];
  dashboardCards.innerHTML = cards.map(
    (card) => `
        <article class="card">
          <div class="card-label">${escapeHTML(card.label)}</div>
          <div class="card-value">${escapeHTML(String(card.value))}</div>
        </article>
      `
  ).join("");
  serviceDonut.innerHTML = buildDonutMarkup(metrics.donutItems, {
    noUsage: t.charts.noUsage,
    totalSent: t.charts.totalSent,
    donutAria: t.charts.donutAria
  });
  dailyBarChart.innerHTML = buildBarChartMarkup(metrics.dailyCounts, {
    noDaily: t.charts.noDaily,
    barAria: t.charts.barAria
  });
}

// src/shared/export/csv.ts
function normalizeCsvCellValue(value) {
  const text = String(value ?? "");
  return /^[=+\-@]/.test(text) ? `'${text}` : text;
}
function escapeCsvCell(value) {
  const normalized = normalizeCsvCellValue(value).replace(/"/g, '""');
  return `"${normalized}"`;
}
function buildCsvLine(values) {
  return (Array.isArray(values) ? values : []).map((value) => escapeCsvCell(value)).join(",");
}

// src/options/core/status.ts
var { pageStatus } = optionsDom.navigation;
var {
  importReportModal,
  importReportModalClose,
  importReportModalTitle,
  importReportModalDesc,
  importReportBody
} = optionsDom.modals;
function setStatus(text, type = "") {
  pageStatus.textContent = text;
  pageStatus.className = `status-line ${type}`.trim();
}
function showAppToast(input, type = "info", duration = 3e3) {
  return showToast(input, type, duration);
}
function showConfirmToast(message, onConfirm) {
  showAppToast({
    message,
    type: "warning",
    duration: -1,
    actions: [
      {
        label: msg("common_confirm") || "Confirm",
        onClick: () => {
          void onConfirm();
        }
      }
    ]
  });
}
function openImportReportModal(summary) {
  state.pendingImportSummary = summary;
  importReportModalTitle.textContent = t.settings.importReportTitle;
  importReportModalDesc.textContent = t.settings.importReportDesc;
  importReportBody.innerHTML = buildImportReportMarkup(summary);
  importReportModal.hidden = false;
}
function closeImportReportModal() {
  state.pendingImportSummary = null;
  importReportModal.hidden = true;
}
function bindStatusEvents() {
  importReportModalClose.addEventListener("click", closeImportReportModal);
  importReportModal.addEventListener("click", (event) => {
    if (event.target === importReportModal) {
      closeImportReportModal();
    }
  });
}

// src/options/features/schedules.ts
var { schedulesList } = optionsDom.schedules;
function getScheduleRepeatLabel(repeat) {
  switch (repeat) {
    case "daily":
      return t.schedules.repeatDaily;
    case "weekday":
      return t.schedules.repeatWeekday;
    case "weekly":
      return t.schedules.repeatWeekly;
    case "none":
    default:
      return t.schedules.repeatNone;
  }
}
function getLastFavoriteRun(favoriteId) {
  return state.history.find((entry) => String(entry.originFavoriteId ?? "") === String(favoriteId)) ?? null;
}
function renderSchedulesSection() {
  const scheduledFavorites = [...state.favorites].filter((favorite) => favorite?.scheduleEnabled || favorite?.scheduledAt).sort((left, right) => {
    const leftTime = Date.parse(String(left?.scheduledAt ?? "")) || Number.MAX_SAFE_INTEGER;
    const rightTime = Date.parse(String(right?.scheduledAt ?? "")) || Number.MAX_SAFE_INTEGER;
    return leftTime - rightTime;
  });
  if (scheduledFavorites.length === 0) {
    schedulesList.innerHTML = createEmptyState2(t.schedules.empty);
    return;
  }
  schedulesList.innerHTML = scheduledFavorites.map((favorite) => {
    const lastRun = getLastFavoriteRun(favorite.id);
    return `
        <article class="settings-control schedule-card" data-schedule-favorite-id="${escapeHTML(favorite.id)}">
          <div class="schedule-card-head">
            <div>
              <h3>${escapeHTML(favorite.title || previewText(favorite.text, 42))}</h3>
              <p>${escapeHTML(previewText(favorite.text, 88))}</p>
            </div>
            <label class="checkbox-inline" for="schedule-enabled-${escapeHTML(favorite.id)}">
              <input
                id="schedule-enabled-${escapeHTML(favorite.id)}"
                type="checkbox"
                data-schedule-enabled="${escapeHTML(favorite.id)}"
                ${favorite.scheduleEnabled ? "checked" : ""}
              />
              <span>${escapeHTML(t.schedules.enabled)}</span>
            </label>
          </div>
          <div class="schedule-meta-grid">
            <div>
              <strong>${escapeHTML(t.schedules.nextRun)}</strong>
              <div>${escapeHTML(favorite.scheduledAt ? formatDateTime(favorite.scheduledAt) : t.schedules.never)}</div>
            </div>
            <div>
              <strong>${escapeHTML(t.schedules.repeat)}</strong>
              <div>${escapeHTML(getScheduleRepeatLabel(favorite.scheduleRepeat))}</div>
            </div>
            <div>
              <strong>${escapeHTML(t.schedules.lastRun)}</strong>
              <div>${escapeHTML(lastRun?.createdAt ? formatDateTime(lastRun.createdAt) : t.schedules.never)}</div>
            </div>
            <div>
              <strong>${escapeHTML(t.history.tableStatus)}</strong>
              <div>${escapeHTML(lastRun ? getStatusInfo(lastRun.status).label : t.schedules.never)}</div>
            </div>
          </div>
          <div class="schedule-card-actions">
            <button class="btn" type="button" data-action="run-schedule-favorite" data-favorite-id="${escapeHTML(favorite.id)}">${escapeHTML(t.schedules.runNow)}</button>
            <button class="btn ghost" type="button" data-action="open-schedule-favorite" data-favorite-id="${escapeHTML(favorite.id)}">${escapeHTML(t.schedules.openInPopup)}</button>
          </div>
        </article>
      `;
  }).join("");
}
async function runFavoriteFromOptions(favoriteId) {
  const response = await chrome.runtime.sendMessage({
    action: "favorite:run",
    favoriteId,
    trigger: "options",
    allowPopupFallback: true
  });
  if (response?.ok && response?.popupFallback) {
    setStatus(t.schedules.popupFallback, "success");
    showAppToast(t.schedules.popupFallback, "success", 2200);
    return;
  }
  if (response?.ok) {
    setStatus(t.schedules.runQueued, "success");
    showAppToast(t.schedules.runQueued, "success", 2200);
    return;
  }
  throw new Error(response?.error ?? t.saveFailed);
}
async function openFavoriteInPopup(favoriteId) {
  const response = await chrome.runtime.sendMessage({
    action: "favorite:openEditor",
    favoriteId,
    source: "options-edit"
  });
  if (!response?.ok) {
    throw new Error(response?.error ?? t.schedules.openFailed);
  }
  setStatus(t.schedules.openInPopup, "success");
  showAppToast(t.schedules.openInPopup, "success", 2e3);
}
function bindScheduleEvents({ reloadData }) {
  schedulesList.addEventListener("change", (event) => {
    const toggle = event.target.closest("[data-schedule-enabled]");
    if (!toggle) {
      return;
    }
    void updateFavoritePrompt(toggle.dataset.scheduleEnabled, {
      scheduleEnabled: Boolean(toggle.checked)
    }).then(() => reloadData()).catch((error) => {
      console.error("[AI Prompt Broadcaster] Failed to toggle favorite schedule.", error);
      setStatus(error?.message ?? t.saveFailed, "error");
      showAppToast(error?.message ?? t.saveFailed, "error", 3e3);
    });
  });
  schedulesList.addEventListener("click", (event) => {
    const actionButton = event.target.closest("[data-action][data-favorite-id]");
    if (!actionButton) {
      return;
    }
    if (actionButton.dataset.action === "run-schedule-favorite") {
      void runFavoriteFromOptions(actionButton.dataset.favoriteId).catch((error) => {
        console.error("[AI Prompt Broadcaster] Failed to run favorite from options.", error);
        setStatus(error?.message ?? t.saveFailed, "error");
        showAppToast(error?.message ?? t.saveFailed, "error", 3e3);
      });
      return;
    }
    if (actionButton.dataset.action === "open-schedule-favorite") {
      void openFavoriteInPopup(actionButton.dataset.favoriteId).catch((error) => {
        console.error("[AI Prompt Broadcaster] Failed to open favorite editor from options.", error);
        setStatus(error?.message ?? t.schedules.openFailed, "error");
        showAppToast(error?.message ?? t.schedules.openFailed, "error", 3e3);
      });
    }
  });
}

// src/options/core/service-filter.ts
var { historyServiceFilter } = optionsDom.history;
function renderServiceFilterOptions() {
  historyServiceFilter.innerHTML = [
    `<option value="all">${escapeHTML(t.history.allServices)}</option>`,
    ...state.runtimeSites.map((site) => `<option value="${site.id}">${escapeHTML(site.name)}</option>`)
  ].join("");
  historyServiceFilter.value = state.filters.service;
}

// src/options/features/services.ts
var { servicesGrid } = optionsDom.services;
function renderServicesSection() {
  servicesGrid.innerHTML = state.runtimeSites.map((site, index) => {
    const requestedEntries = state.history.filter((entry) => getRequestedServices(entry).includes(site.id));
    const successCount = state.history.filter((entry) => getSubmittedServices(entry).includes(site.id)).length;
    const requestCount = requestedEntries.length;
    const successRate = requestCount > 0 ? Math.round(successCount / requestCount * 100) : 0;
    const lastUsed = requestedEntries[0]?.createdAt ? formatDateTime(requestedEntries[0].createdAt) : t.services.none;
    return `
      <article class="panel service-card">
        <div class="section-head">
          <h2>${escapeHTML(site.name)}</h2>
          <p>${escapeHTML(site.url)}</p>
        </div>
        <div class="metric-grid">
          <div>${escapeHTML(t.services.inputType)}</div><div>${escapeHTML(site.inputType)}</div>
          <div>${escapeHTML(t.services.waitTime)}</div><div>${escapeHTML(`${site.waitMs}ms`)}</div>
          <div>${escapeHTML(t.services.requestCount)}</div><div>${requestCount}</div>
          <div>${escapeHTML(t.services.successRate)}</div><div>${successRate}%</div>
          <div>${escapeHTML(t.services.lastUsed)}</div><div>${escapeHTML(lastUsed)}</div>
          <div>${escapeHTML(t.services.defaultColor)}</div><div><span class="swatch" style="background:${escapeHTML(site.color || CHART_COLORS[index % CHART_COLORS.length])}"></span></div>
        </div>
        <label class="settings-control" for="wait-range-${escapeHTML(site.id)}">
          <strong>${escapeHTML(t.services.waitTime)}</strong>
          <input
            id="wait-range-${escapeHTML(site.id)}"
            type="range"
            min="500"
            max="8000"
            step="100"
            value="${site.waitMs}"
            data-waitms-site-id="${escapeHTML(site.id)}"
          />
          <span class="helper" data-waitms-value="${escapeHTML(site.id)}">${escapeHTML(`${site.waitMs}ms`)}</span>
        </label>
      </article>
    `;
  }).join("");
}
async function saveSiteWaitMs(siteId, waitMs) {
  await updateRuntimeSite(siteId, { waitMs: Number(waitMs) });
  state.runtimeSites = await getRuntimeSites();
  renderServiceFilterOptions();
  renderServicesSection();
  showAppToast(t.settings.waitSaved, "success", 1600);
}
function bindServiceEvents() {
  servicesGrid.addEventListener("input", (event) => {
    const slider = event.target.closest("[data-waitms-site-id]");
    if (!slider) {
      return;
    }
    const valueLabel = servicesGrid.querySelector(`[data-waitms-value="${CSS.escape(slider.dataset.waitmsSiteId)}"]`);
    if (valueLabel) {
      valueLabel.textContent = `${slider.value}ms`;
    }
  });
  servicesGrid.addEventListener("change", (event) => {
    const slider = event.target.closest("[data-waitms-site-id]");
    if (!slider) {
      return;
    }
    void saveSiteWaitMs(slider.dataset.waitmsSiteId, slider.value).catch((error) => {
      console.error("[AI Prompt Broadcaster] Failed to save waitMs.", error);
      setStatus(error?.message ?? t.saveFailed, "error");
      showAppToast(error?.message ?? t.saveFailed, "error", 3e3);
    });
  });
}

// src/options/features/history.ts
var PAGE_SIZE = 10;
var {
  historyServiceFilter: historyServiceFilter2,
  historyDateFrom,
  historyDateTo,
  historyExportCsv,
  historyTableWrap,
  historySelectAll,
  historyDeleteSelected,
  historyDeleteFiltered,
  historyDelete7d,
  historyDelete30d,
  historyDelete90d,
  historyPrevPage,
  historyNextPage,
  historyPageInfo
} = optionsDom.history;
var {
  historyModal,
  historyModalClose,
  historyModalMeta,
  historyModalServices,
  historyModalText
} = optionsDom.modals;
function filteredHistory() {
  return state.history.filter((entry) => {
    const requestedServices = getRequestedServices(entry);
    const matchesService = state.filters.service === "all" || requestedServices.includes(state.filters.service);
    const dateKey = entry.createdAt.slice(0, 10);
    const matchesFrom = !state.filters.dateFrom || dateKey >= state.filters.dateFrom;
    const matchesTo = !state.filters.dateTo || dateKey <= state.filters.dateTo;
    return matchesService && matchesFrom && matchesTo;
  });
}
function syncHistorySelectionState() {
  const availableIds = new Set(state.history.map((entry) => Number(entry.id)));
  state.selectedHistoryIds = new Set(
    [...state.selectedHistoryIds].filter((historyId) => availableIds.has(Number(historyId)))
  );
}
function renderHistoryTable() {
  syncHistorySelectionState();
  const history = filteredHistory();
  const pageCount = Math.max(1, Math.ceil(history.length / PAGE_SIZE));
  state.historyPage = Math.min(state.historyPage, pageCount);
  const startIndex = (state.historyPage - 1) * PAGE_SIZE;
  const currentPageRows = history.slice(startIndex, startIndex + PAGE_SIZE);
  const currentPageIds = currentPageRows.map((entry) => Number(entry.id));
  const allCurrentPageSelected = currentPageIds.length > 0 && currentPageIds.every((historyId) => state.selectedHistoryIds.has(historyId));
  if (currentPageRows.length === 0) {
    historyTableWrap.innerHTML = createEmptyState2(t.history.emptyFiltered);
  } else {
    historyTableWrap.innerHTML = `
      <table>
        <thead>
          <tr>
            <th>${escapeHTML(t.history.tableSelect)}</th>
            <th>${escapeHTML(t.history.tableDate)}</th>
            <th>${escapeHTML(t.history.tablePrompt)}</th>
            <th>${escapeHTML(t.history.tableServices)}</th>
            <th>${escapeHTML(t.history.tableStatus)}</th>
          </tr>
        </thead>
        <tbody>
          ${currentPageRows.map((entry) => {
      const status = getStatusInfo(entry.status);
      return `
                <tr class="table-row-button" data-history-id="${entry.id}">
                  <td><input type="checkbox" data-history-select="${entry.id}" ${state.selectedHistoryIds.has(Number(entry.id)) ? "checked" : ""} /></td>
                  <td>${escapeHTML(formatDateTime(entry.createdAt))}</td>
                  <td>${escapeHTML(previewText(entry.text))}</td>
                  <td><div class="service-badges">${getRequestedServices(entry).map((siteId) => buildBadgeMarkup(siteId, state.runtimeSites)).join("")}</div></td>
                  <td><span class="status-pill ${status.className}">${escapeHTML(status.label)}</span></td>
                </tr>
              `;
    }).join("")}
        </tbody>
      </table>
    `;
  }
  historyPageInfo.textContent = t.history.pageInfo(state.historyPage, pageCount);
  historyPrevPage.disabled = state.historyPage <= 1;
  historyNextPage.disabled = state.historyPage >= pageCount;
  historySelectAll.checked = allCurrentPageSelected;
  historyDeleteSelected.disabled = state.selectedHistoryIds.size === 0;
  historyDeleteFiltered.disabled = history.length === 0;
}
function downloadBlob(filename, content, type) {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}
function exportFilteredHistoryAsCsv() {
  const rows = filteredHistory();
  const header = [
    t.history.tableDate,
    t.history.tableStatus,
    t.history.tableServices,
    t.history.tablePrompt
  ];
  const lines = rows.map((entry) => buildCsvLine([
    entry.createdAt,
    entry.status,
    getRequestedServices(entry).join("|"),
    entry.text
  ]));
  downloadBlob(
    `ai-prompt-broadcaster-history-${(/* @__PURE__ */ new Date()).toISOString().replace(/[:.]/g, "-")}.csv`,
    [buildCsvLine(header), ...lines].join("\n"),
    "text/csv;charset=utf-8"
  );
  setStatus(t.history.exportSuccess, "success");
  showAppToast(t.history.exportSuccess, "success", 1800);
}
async function refreshHistoryAfterMutation() {
  state.history = await getPromptHistory();
  syncHistorySelectionState();
  renderDashboard();
  renderHistoryTable();
  renderSchedulesSection();
  renderServicesSection();
}
async function deleteSelectedHistoryRows(historyIds) {
  await deletePromptHistoryItemsByIds(historyIds);
  historyIds.forEach((historyId) => state.selectedHistoryIds.delete(Number(historyId)));
  await refreshHistoryAfterMutation();
  setStatus(t.history.deleteSuccess, "success");
  showAppToast(t.history.deleteSuccess, "success", 1800);
}
async function deleteHistoryOlderThanDays(days) {
  const cutoff = /* @__PURE__ */ new Date();
  cutoff.setHours(0, 0, 0, 0);
  cutoff.setDate(cutoff.getDate() - days);
  await deletePromptHistoryItemsBeforeDate(cutoff);
  state.selectedHistoryIds.clear();
  await refreshHistoryAfterMutation();
  setStatus(t.history.deleteSuccess, "success");
  showAppToast(t.history.deleteSuccess, "success", 1800);
}
function buildResultComparisonMarkup(entry) {
  const requested = getRequestedServices(entry);
  const submitted = new Set(Array.isArray(entry.submittedSiteIds) ? entry.submittedSiteIds : entry.sentTo ?? []);
  const failed = new Set(Array.isArray(entry.failedSiteIds) ? entry.failedSiteIds : []);
  const siteResults = entry.siteResults ?? {};
  if (requested.length === 0) {
    return "";
  }
  const siteRows = requested.map((siteId) => {
    const site = state.runtimeSites.find((siteEntry) => siteEntry.id === siteId);
    const name = site?.name ?? siteId;
    const color = site?.color ?? "#888";
    const icon = site?.icon ?? siteId.slice(0, 2).toUpperCase();
    const result = siteResults[siteId];
    const rawStatus = normalizeResultCode(result?.code ?? (submitted.has(siteId) ? "submitted" : failed.has(siteId) ? "unexpected_error" : "unknown"));
    const isOk = rawStatus === "submitted";
    const isFailed = rawStatus !== "submitted" && rawStatus !== "unknown";
    const statusEmoji = isOk ? "✅" : isFailed ? "❌" : "⏳";
    const statusLabel = isOk ? msg("options_status_complete") || "Completed" : isFailed ? t.settings.resultCodeLabels[rawStatus] || rawStatus.replace(/_/g, " ") : msg("options_status_unknown") || "Unknown";
    const siteUrl = site?.url ?? "#";
    return `
      <div class="result-compare-row">
        <div class="result-compare-icon" style="background:${color};color:#fff;">${escapeHTML(icon)}</div>
        <div class="result-compare-body">
          <div class="result-compare-name">${escapeHTML(name)}</div>
          <div class="result-compare-status ${isOk ? "ok" : isFailed ? "fail" : "unknown"}">${statusEmoji} ${escapeHTML(statusLabel)}</div>
        </div>
        ${isOk ? `<a class="ghost-button small-button" href="${escapeHTML(siteUrl)}" target="_blank" rel="noopener noreferrer">${msg("options_result_open_tab") || "Open"}</a>` : ""}
      </div>
    `;
  }).join("");
  return `
    <div class="result-comparison">
      <h3 class="result-comparison-title">${escapeHTML(msg("options_result_comparison_title") || "Service results")}</h3>
      ${siteRows}
    </div>
  `;
}
function openHistoryModal(historyId) {
  const entry = state.history.find((item) => Number(item.id) === Number(historyId));
  if (!entry) {
    return;
  }
  const status = getStatusInfo(entry.status);
  historyModalMeta.textContent = `${formatDateTime(entry.createdAt)} · ${status.label}`;
  historyModalServices.innerHTML = getRequestedServices(entry).map((siteId) => buildBadgeMarkup(siteId, state.runtimeSites)).join("");
  historyModalText.textContent = entry.text;
  let comparisonEl = document.getElementById("history-modal-comparison");
  if (!comparisonEl) {
    comparisonEl = document.createElement("div");
    comparisonEl.id = "history-modal-comparison";
    historyModalText.parentElement?.appendChild(comparisonEl);
  }
  comparisonEl.innerHTML = buildResultComparisonMarkup(entry);
  historyModal.hidden = false;
}
function closeHistoryModal() {
  historyModal.hidden = true;
}
function bindHistoryEvents() {
  historyServiceFilter2.addEventListener("change", (event) => {
    state.filters.service = event.target.value;
    state.historyPage = 1;
    renderHistoryTable();
  });
  historyDateFrom.addEventListener("change", (event) => {
    state.filters.dateFrom = event.target.value;
    state.historyPage = 1;
    renderHistoryTable();
  });
  historyDateTo.addEventListener("change", (event) => {
    state.filters.dateTo = event.target.value;
    state.historyPage = 1;
    renderHistoryTable();
  });
  historyExportCsv.addEventListener("click", exportFilteredHistoryAsCsv);
  historySelectAll.addEventListener("change", (event) => {
    const history = filteredHistory();
    const startIndex = (state.historyPage - 1) * PAGE_SIZE;
    const currentPageRows = history.slice(startIndex, startIndex + PAGE_SIZE);
    const checked = Boolean(event.target.checked);
    currentPageRows.forEach((entry) => {
      if (checked) {
        state.selectedHistoryIds.add(Number(entry.id));
      } else {
        state.selectedHistoryIds.delete(Number(entry.id));
      }
    });
    renderHistoryTable();
  });
  historyPrevPage.addEventListener("click", () => {
    state.historyPage = Math.max(1, state.historyPage - 1);
    renderHistoryTable();
  });
  historyNextPage.addEventListener("click", () => {
    state.historyPage += 1;
    renderHistoryTable();
  });
  historyTableWrap.addEventListener("click", (event) => {
    const checkbox = event.target.closest("[data-history-select]");
    if (checkbox) {
      const historyId = Number(checkbox.dataset.historySelect);
      if (checkbox.checked) {
        state.selectedHistoryIds.add(historyId);
      } else {
        state.selectedHistoryIds.delete(historyId);
      }
      renderHistoryTable();
      return;
    }
    const row = event.target.closest("[data-history-id]");
    if (row) {
      openHistoryModal(row.dataset.historyId);
    }
  });
  historyModalClose.addEventListener("click", closeHistoryModal);
  historyModal.addEventListener("click", (event) => {
    if (event.target === historyModal) {
      closeHistoryModal();
    }
  });
  historyDeleteSelected.addEventListener("click", () => {
    showConfirmToast(t.history.deleteSelectedConfirm, async () => {
      await deleteSelectedHistoryRows([...state.selectedHistoryIds]);
    });
  });
  historyDeleteFiltered.addEventListener("click", () => {
    const historyIds = filteredHistory().map((entry) => Number(entry.id));
    showConfirmToast(t.history.deleteFilteredConfirm(historyIds.length), async () => {
      await deleteSelectedHistoryRows(historyIds);
    });
  });
  historyDelete7d.addEventListener("click", () => {
    showConfirmToast(t.history.deleteOlderConfirm(7), async () => {
      await deleteHistoryOlderThanDays(7);
    });
  });
  historyDelete30d.addEventListener("click", () => {
    showConfirmToast(t.history.deleteOlderConfirm(30), async () => {
      await deleteHistoryOlderThanDays(30);
    });
  });
  historyDelete90d.addEventListener("click", () => {
    showConfirmToast(t.history.deleteOlderConfirm(90), async () => {
      await deleteHistoryOlderThanDays(90);
    });
  });
}

// src/options/features/settings.ts
var {
  historyLimitSlider,
  historyLimitValue,
  autoCloseToggle,
  desktopNotificationToggle,
  reuseTabsToggle,
  reuseTabsSettingTitle,
  reuseTabsSettingDesc,
  waitMultiplierSettingTitle,
  waitMultiplierSlider,
  waitMultiplierSettingValue,
  shortcutList,
  openShortcutsBtn,
  settingsResetData,
  settingsExportJson,
  settingsImportJson,
  settingsImportJsonInput
} = optionsDom.settings;
var {
  historySelectAllLabel,
  historyDeleteSelected: historyDeleteSelected2,
  historyDeleteFiltered: historyDeleteFiltered2,
  historyDelete7d: historyDelete7d2,
  historyDelete30d: historyDelete30d2,
  historyDelete90d: historyDelete90d2
} = optionsDom.history;
function applySettingsToControls() {
  historyLimitSlider.value = String(state.settings.historyLimit);
  historyLimitValue.textContent = t.settings.historyLimitValue(state.settings.historyLimit);
  autoCloseToggle.checked = state.settings.autoClosePopup;
  desktopNotificationToggle.checked = state.settings.desktopNotifications;
  reuseTabsToggle.checked = state.settings.reuseExistingTabs;
  reuseTabsSettingTitle.textContent = t.settings.reuseTabsTitle;
  reuseTabsSettingDesc.textContent = t.settings.reuseTabsDesc;
  waitMultiplierSettingTitle.textContent = t.settings.waitMultiplierTitle;
  waitMultiplierSlider.value = String(state.settings.waitMsMultiplier);
  waitMultiplierSettingValue.textContent = t.settings.waitMultiplierValue(state.settings.waitMsMultiplier);
  historySelectAllLabel.textContent = t.history.selectAllLabel;
  historyDeleteSelected2.textContent = t.history.deleteSelected;
  historyDeleteFiltered2.textContent = t.history.deleteFiltered;
  historyDelete7d2.textContent = t.history.deleteOlderThan(7);
  historyDelete30d2.textContent = t.history.deleteOlderThan(30);
  historyDelete90d2.textContent = t.history.deleteOlderThan(90);
}
function getShortcutDisplayName(commandName) {
  switch (commandName) {
    case "_execute_action":
      return t.shortcuts.openPopup;
    case "capture-selected-text":
      return t.shortcuts.captureSelected;
    case "quick-palette":
      return t.shortcuts.quickPalette;
    default:
      return commandName;
  }
}
async function renderShortcutList() {
  try {
    const commands = await chrome.commands.getAll();
    const commandMap = new Map(commands.map((command) => [command.name, command]));
    const relevantNames = ["_execute_action", "capture-selected-text", "quick-palette"];
    shortcutList.innerHTML = relevantNames.map((commandName) => {
      const command = commandMap.get(commandName);
      const shortcutText = command?.shortcut?.trim() || t.shortcuts.unassigned;
      return `<div>${getShortcutDisplayName(commandName)}: <strong>${shortcutText}</strong></div>`;
    }).join("");
  } catch (error) {
    console.error("[AI Prompt Broadcaster] Failed to load shortcuts.", error);
    shortcutList.textContent = t.shortcuts.loadFailed;
  }
}
async function saveSettings(partialSettings) {
  const nextSettings = await updateAppSettings(partialSettings);
  state.settings = nextSettings;
  if (typeof partialSettings.historyLimit !== "undefined") {
    await setPromptHistory(state.history);
    state.history = await getPromptHistory();
    renderDashboard();
    renderHistoryTable();
    renderServicesSection();
  }
  applySettingsToControls();
  setStatus(t.statusSaved, "success");
  showAppToast(t.statusSaved, "success", 1800);
}
async function resetAllData(loadData2) {
  const response = await chrome.runtime.sendMessage({ action: "resetAllData" });
  if (!response?.ok) {
    throw new Error(response?.error ?? t.settings.resetFailed);
  }
  await loadData2();
  state.historyPage = 1;
  setStatus(t.settings.resetSuccess, "success");
  showAppToast(t.settings.resetSuccess, "success", 1800);
}
function downloadBlob2(filename, content, type) {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}
function bindSettingsEvents({ loadData: loadData2 }) {
  historyLimitSlider.addEventListener("input", (event) => {
    historyLimitValue.textContent = t.settings.historyLimitValue(event.target.value);
  });
  historyLimitSlider.addEventListener("change", (event) => {
    void saveSettings({ historyLimit: Number(event.target.value) }).catch((error) => {
      console.error("[AI Prompt Broadcaster] Failed to save history limit.", error);
      setStatus(error?.message ?? t.saveFailed, "error");
    });
  });
  autoCloseToggle.addEventListener("change", (event) => {
    void saveSettings({ autoClosePopup: event.target.checked }).catch((error) => {
      console.error("[AI Prompt Broadcaster] Failed to save auto-close setting.", error);
      setStatus(error?.message ?? t.saveFailed, "error");
    });
  });
  desktopNotificationToggle.addEventListener("change", (event) => {
    void saveSettings({ desktopNotifications: event.target.checked }).catch((error) => {
      console.error("[AI Prompt Broadcaster] Failed to save desktop notification setting.", error);
      setStatus(error?.message ?? t.saveFailed, "error");
      showAppToast(error?.message ?? t.saveFailed, "error", 3e3);
    });
  });
  reuseTabsToggle.addEventListener("change", (event) => {
    void saveSettings({ reuseExistingTabs: event.target.checked }).catch((error) => {
      console.error("[AI Prompt Broadcaster] Failed to save tab reuse setting.", error);
      setStatus(error?.message ?? t.saveFailed, "error");
      showAppToast(error?.message ?? t.saveFailed, "error", 3e3);
    });
  });
  waitMultiplierSlider.addEventListener("input", (event) => {
    waitMultiplierSettingValue.textContent = t.settings.waitMultiplierValue(event.target.value);
  });
  waitMultiplierSlider.addEventListener("change", (event) => {
    void saveSettings({ waitMsMultiplier: Number(event.target.value) }).catch((error) => {
      console.error("[AI Prompt Broadcaster] Failed to save wait multiplier.", error);
      setStatus(error?.message ?? t.saveFailed, "error");
      showAppToast(error?.message ?? t.saveFailed, "error", 3e3);
    });
  });
  settingsResetData.addEventListener("click", () => {
    showConfirmToast(t.settings.resetConfirm, async () => {
      try {
        await resetAllData(loadData2);
      } catch (error) {
        console.error("[AI Prompt Broadcaster] Failed to reset data.", error);
        setStatus(error?.message ?? t.settings.resetFailed, "error");
        showAppToast(error?.message ?? t.settings.resetFailed, "error", 3e3);
      }
    });
  });
  openShortcutsBtn.addEventListener("click", () => {
    void chrome.tabs.create({ url: "chrome://extensions/shortcuts" }).catch((error) => {
      console.error("[AI Prompt Broadcaster] Failed to open shortcuts page.", error);
      setStatus(error?.message ?? t.settings.shortcutsOpenFailed, "error");
      showAppToast(error?.message ?? t.settings.shortcutsOpenFailed, "error", 3e3);
    });
  });
  settingsExportJson.addEventListener("click", async () => {
    try {
      const payload = await exportPromptData();
      downloadBlob2(
        `ai-prompt-broadcaster-${(/* @__PURE__ */ new Date()).toISOString().replace(/[:.]/g, "-")}.json`,
        JSON.stringify(payload, null, 2),
        "application/json"
      );
      setStatus(t.settings.exportSuccess, "success");
      showAppToast(t.settings.exportSuccess, "success", 1800);
    } catch (error) {
      console.error("[AI Prompt Broadcaster] Failed to export JSON.", error);
      setStatus(error?.message ?? t.settings.exportFailed, "error");
      showAppToast(error?.message ?? t.settings.exportFailed, "error", 3e3);
    }
  });
  settingsImportJson.addEventListener("click", () => {
    settingsImportJsonInput.click();
  });
  settingsImportJsonInput.addEventListener("change", async (event) => {
    const file = event.target.files?.[0];
    if (!file) {
      return;
    }
    try {
      const text = await file.text();
      const result = await importPromptData(text);
      await loadData2();
      setStatus(buildImportSummaryText(result.importSummary), "success");
      showAppToast(buildImportSummaryText(result.importSummary, { short: true }), "success", 2600);
      openImportReportModal(result.importSummary);
    } catch (error) {
      console.error("[AI Prompt Broadcaster] Failed to import JSON.", error);
      setStatus(error?.message ?? t.settings.importFailed, "error");
      showAppToast(error?.message ?? t.settings.importFailed, "error", 3e3);
    } finally {
      settingsImportJsonInput.value = "";
    }
  });
}

// src/options/core/data.ts
async function loadData() {
  const [history, favorites, settings, runtimeSites] = await Promise.all([
    getPromptHistory(),
    getPromptFavorites(),
    getAppSettings(),
    getRuntimeSites()
  ]);
  state.history = history;
  state.favorites = favorites;
  state.selectedHistoryIds.clear();
  state.runtimeSites = runtimeSites;
  state.settings = settings;
  renderServiceFilterOptions();
  renderDashboard();
  renderHistoryTable();
  renderSchedulesSection();
  renderServicesSection();
  applySettingsToControls();
}

// src/options/core/navigation.ts
var { navButtons, pageSections } = optionsDom.navigation;
function switchSection(sectionId) {
  state.activeSection = sectionId;
  navButtons.forEach((button) => {
    const active = button.dataset.section === sectionId;
    button.classList.toggle("active", active);
    button.setAttribute("aria-selected", String(active));
    button.tabIndex = active ? 0 : -1;
  });
  pageSections.forEach((section) => {
    const active = section.id === `section-${sectionId}`;
    section.classList.toggle("active", active);
    section.hidden = !active;
  });
}
function bindNavigationEvents() {
  navButtons.forEach((button) => {
    button.addEventListener("click", () => switchSection(button.dataset.section));
  });
}

// src/options/app/bootstrap.ts
var { toastHost } = optionsDom;
function bindEvents() {
  bindNavigationEvents();
  bindHistoryEvents();
  bindScheduleEvents({ reloadData: loadData });
  bindSettingsEvents({ loadData });
  bindServiceEvents();
  bindStatusEvents();
  chrome.storage.onChanged.addListener((changes, areaName) => {
    if (areaName !== "local") {
      return;
    }
    if (changes.promptHistory || changes.promptFavorites || changes.appSettings || changes.templateVariableCache || changes.customSites || changes.builtInSiteStates || changes.builtInSiteOverrides) {
      void loadData().catch((error) => {
        console.error("[AI Prompt Broadcaster] Failed to refresh options page.", error);
        setStatus(error?.message ?? t.dataRefreshFailed, "error");
      });
    }
  });
  window.addEventListener("focus", () => {
    void renderShortcutList();
  });
}
async function init() {
  try {
    applyI18n();
    document.documentElement.lang = isKorean ? "ko" : "en";
    document.title = t.pageTitle || document.title;
    initToastRoot(toastHost);
    bindEvents();
    switchSection(state.activeSection);
    await renderShortcutList();
    await loadData();
  } catch (error) {
    console.error("[AI Prompt Broadcaster] Failed to initialize options page.", error);
    setStatus(error?.message ?? t.initFailed, "error");
    showAppToast(error?.message ?? t.initFailed, "error", 3e3);
  }
}
void init();
