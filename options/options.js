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
  if (!key) {
    return "";
  }
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
    noHeatmap: msg("options_chart_no_heatmap") || "No activity heatmap yet.",
    noTrend: msg("options_chart_no_trend") || "No service trend yet.",
    noFailure: msg("options_chart_no_failure") || "No failure reasons recorded.",
    noStrategy: msg("options_chart_no_strategy") || "No strategy attempts recorded.",
    totalSent: msg("options_chart_total_sent"),
    donutAria: msg("options_chart_donut_aria"),
    barAria: msg("options_chart_bar_aria"),
    heatmapAria: msg("options_chart_heatmap_aria") || "Activity heatmap",
    hourLabel: msg("options_chart_hour_label") || "Hour",
    requestsLabel: msg("options_chart_requests_label") || "requests",
    attemptsLabel: msg("options_chart_attempts_label") || "attempts",
    bestStrategyLabel: msg("options_chart_best_strategy_label") || "Best strategy"
  },
  history: {
    emptyFiltered: msg("options_history_empty_filtered"),
    tableSelect: msg("options_table_select") || "Select",
    tableDate: msg("options_table_date"),
    tablePrompt: msg("options_table_prompt"),
    tableServices: msg("options_table_services"),
    tableStatus: msg("options_table_status"),
    tableActions: msg("options_table_actions") || "Actions",
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
    deleteSuccess: msg("options_history_delete_success") || "History deleted.",
    openDetails: msg("options_history_open_details") || "Open details"
  },
  services: {
    inputType: msg("options_service_input_type"),
    waitTime: msg("options_service_wait_time"),
    requestCount: msg("options_service_request_count"),
    successRate: msg("options_service_success_rate"),
    lastUsed: msg("options_service_last_used"),
    defaultColor: msg("options_service_default_color"),
    none: msg("options_value_none"),
    moveUp: msg("options_service_move_up") || "Move up",
    moveDown: msg("options_service_move_down") || "Move down",
    orderSaved: msg("options_service_order_saved") || "Service order saved.",
    openManagerFailed: msg("options_services_open_failed") || "Failed to open the popup manager.",
    healthTitle: msg("options_services_health_title") || "Selector Health Center",
    healthDesc: msg("options_services_health_desc") || "Track recent selector failures, auth gates, strategy hints, and verification metadata.",
    healthRefresh: msg("options_services_health_refresh") || "Refresh health",
    healthEmpty: msg("options_services_health_empty") || "No service health snapshot yet.",
    healthWarning: msg("options_services_health_warning") || "Selector warning",
    healthHealthy: msg("options_services_health_healthy") || "Healthy",
    healthNoRecentRun: msg("options_services_health_no_recent_run") || "No recent run",
    healthLogin: msg("options_services_health_login") || "Login",
    healthRetry: msg("options_services_health_retry") || "Retry failed",
    healthSelectorCheck: msg("options_services_health_selector_check") || "Selector check",
    healthNewTab: msg("options_services_health_new_tab") || "New tab",
    groupTitle: msg("options_service_groups_title") || "Service Groups",
    groupDesc: msg("options_service_groups_desc") || "Create reusable target groups for popup favorites and experiment runs.",
    groupNamePlaceholder: msg("options_service_groups_name_placeholder") || "Group name",
    groupSave: msg("options_service_groups_save") || "Save group from checked services",
    groupEmpty: msg("options_service_groups_empty") || "No service groups yet.",
    groupNoServices: msg("options_service_groups_no_services") || "No services",
    groupCheckServices: msg("options_service_groups_check_services") || "Check services",
    groupDelete: msg("options_service_groups_delete") || "Delete",
    groupUseInGroup: msg("options_service_groups_use_in_group") || "Use in group",
    groupNeedsService: msg("options_service_groups_needs_service") || "Check at least one service for the group.",
    groupSaved: msg("options_service_groups_saved") || "Service group saved.",
    groupDeleted: msg("options_service_groups_deleted") || "Service group deleted.",
    retryNoFailed: msg("options_services_retry_no_failed") || "No failed history item found for this service.",
    retryQueued: msg("options_services_retry_queued") || "Retry queued for failed service.",
    retryFailed: msg("options_services_retry_failed") || "Retry failed.",
    selectorCheckHint: msg("options_services_selector_check_hint") || "Open the service tab, then use the popup test action after login.",
    healthRefreshFailed: msg("options_services_health_refresh_failed") || "Service health refresh failed."
  },
  experiments: {
    nav: msg("options_nav_experiments") || "Experiments",
    title: msg("options_experiments_title") || "Prompt Experiments",
    desc: msg("options_experiments_desc") || "Preview and run variant x service x variable-set experiments through the normal broadcast history flow.",
    draft: msg("options_experiments_draft") || "Experiment draft",
    titlePlaceholder: msg("options_experiments_title_placeholder") || "Experiment title",
    variantsPlaceholder: msg("options_experiments_variants_placeholder") || "One variant per block. Separate variants with a line containing ---",
    variablesPlaceholder: msg("options_experiments_variables_placeholder") || 'Variable sets as JSON array, e.g. [{"topic":"selectors"}]',
    preview: msg("options_experiments_preview") || "Preview",
    save: msg("options_experiments_save") || "Save",
    runSaved: msg("options_experiments_run_saved") || "Run saved experiment",
    load: msg("options_experiments_load") || "Load",
    run: msg("options_experiments_run") || "Run",
    delete: msg("options_experiments_delete") || "Delete",
    deleteSuccess: msg("options_experiments_delete_success") || "Experiment deleted.",
    empty: msg("options_experiments_empty") || "No saved experiments yet.",
    previewEmpty: msg("options_experiments_preview_empty") || "Add variants and target services to preview combinations.",
    noTargetServices: msg("options_experiments_no_target_services") || "No target services",
    invalidVariables: msg("options_experiments_invalid_variables") || "Variables JSON is invalid. Using an empty variable set.",
    needsVariantAndTarget: msg("options_experiments_needs_variant_target") || "Experiment needs at least one variant and one target service.",
    saveSuccess: msg("options_experiments_save_success") || "Experiment saved.",
    saveFailed: msg("options_experiments_save_failed") || "Experiment save failed.",
    runFailed: msg("options_experiments_run_failed") || "Experiment run failed.",
    notFound: msg("options_experiments_not_found") || "Experiment not found.",
    queued: (count) => msg("options_experiments_queued", [String(count)]) || `Experiment queued: ${count} broadcasts.`,
    summary: (variants, variableSets, services, runs, broadcasts) => msg("options_experiments_summary", [
      String(variants),
      String(variableSets),
      String(services),
      String(runs),
      String(broadcasts)
    ]) || `${variants} variants · ${variableSets} variable sets · ${services} services · ${runs} runs · ${broadcasts} broadcasts`,
    runStats: (broadcasts, serviceSends, softLimit, hardLimit) => msg("options_experiments_run_stats", [
      String(broadcasts),
      String(serviceSends),
      String(softLimit),
      String(hardLimit)
    ]) || `${broadcasts} broadcasts, ${serviceSends} service sends. Confirmation starts above ${softLimit}; ${hardLimit} is the hard limit.`,
    confirmLarge: (broadcasts, serviceSends, softLimit) => msg("options_experiments_confirm_large", [
      String(broadcasts),
      String(serviceSends),
      String(softLimit)
    ]) || `Queue ${broadcasts} broadcasts (${serviceSends} service sends)? Runs above ${softLimit} need confirmation.`,
    hardLimit: (broadcasts, hardLimit) => msg("options_experiments_hard_limit", [String(broadcasts), String(hardLimit)]) || `This experiment has ${broadcasts} broadcasts. Split it into batches of ${hardLimit} or fewer.`
  },
  comparison: {
    title: msg("options_comparison_title") || "Compare",
    ratingPlaceholder: msg("options_comparison_rating_placeholder") || "Rating",
    textPlaceholder: msg("options_comparison_text_placeholder") || "Paste an AI response here, or select response text on a service tab and use the context menu.",
    saveNote: msg("options_comparison_save_note") || "Save note",
    captureNow: msg("options_comparison_capture_now") || "Capture now",
    saveSuccess: msg("options_comparison_save_success") || "Comparison note saved.",
    saveFailed: msg("options_comparison_save_failed") || "Comparison note save failed.",
    captureSuccess: msg("options_comparison_capture_success") || "Response captured.",
    captureNotFound: msg("options_comparison_capture_not_found") || "No visible assistant response was found.",
    captureFailed: msg("options_comparison_capture_failed") || "Capture failed.",
    deleteSuccess: msg("options_comparison_delete_success") || "Comparison note deleted.",
    empty: msg("options_comparison_empty") || "No saved comparison notes yet.",
    delete: msg("options_comparison_delete") || "Delete"
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
    },
    templatePacksTitle: msg("options_template_packs_title") || "Template packs",
    templatePacksDesc: msg("options_template_packs_desc") || "Export/import favorites as reusable local packs. Sensitive template defaults are included unless unchecked.",
    templatePackSensitive: msg("options_template_pack_sensitive") || "Include template defaults",
    templatePackExport: msg("options_template_pack_export") || "Export current favorites as pack",
    templatePackImport: msg("options_template_pack_import") || "Import pack JSON",
    templatePackEmpty: msg("options_template_pack_empty") || "No template packs yet.",
    templatePackDownload: msg("options_template_pack_download") || "Download",
    templatePackDefaultsIncluded: msg("options_template_pack_defaults_included") || "included",
    templatePackDefaultsRemoved: msg("options_template_pack_defaults_removed") || "removed",
    templatePackExported: msg("options_template_pack_exported") || "Template pack exported.",
    templatePackExportFailed: msg("options_template_pack_export_failed") || "Template pack export failed.",
    templatePackImportFailed: msg("options_template_pack_import_failed") || "Template pack import failed.",
    templatePackImported: (imported, skipped) => msg("options_template_pack_imported", [String(imported), String(skipped)]) || `Imported ${imported}, skipped ${skipped} duplicates.`
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
    lastScheduledRun: msg("options_schedules_last_scheduled_run") || "Last scheduled run",
    scheduledResult: msg("options_schedules_scheduled_result") || "Scheduled result",
    failureDetail: msg("options_schedules_failure_detail") || "Failure detail",
    runNow: msg("options_schedules_run_now") || "Run now",
    openInPopup: msg("options_schedules_open_in_popup") || "Edit in popup",
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
  broadcastCounter: "broadcastCounter",
  comparisonNotes: "comparisonNotes",
  promptExperiments: "promptExperiments",
  templatePacks: "templatePacks",
  serviceGroups: "serviceGroups"
});
var DEFAULT_HISTORY_LIMIT = 50;
var MIN_HISTORY_LIMIT = 10;
var MAX_HISTORY_LIMIT = 200;
var MIN_WAIT_MS_MULTIPLIER = 0.5;
var MAX_WAIT_MS_MULTIPLIER = 3;
var DEFAULT_WAIT_MS_MULTIPLIER = 1;
var DEFAULT_HISTORY_SORT = "latest";
var DEFAULT_FAVORITE_SORT = "recentUsed";
var EXPERIMENT_SOFT_BROADCAST_LIMIT = 10;
var EXPERIMENT_HARD_BROADCAST_LIMIT = 30;
var DEFAULT_SETTINGS = Object.freeze({
  historyLimit: DEFAULT_HISTORY_LIMIT,
  autoClosePopup: false,
  desktopNotifications: true,
  reuseExistingTabs: true,
  waitMsMultiplier: DEFAULT_WAIT_MS_MULTIPLIER,
  historySort: DEFAULT_HISTORY_SORT,
  favoriteSort: DEFAULT_FAVORITE_SORT,
  siteOrder: []
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
var VALID_CAPTURE_MODES = /* @__PURE__ */ new Set([
  "manual",
  "selection",
  "auto"
]);
var VALID_CHAIN_FAILURE_POLICIES = /* @__PURE__ */ new Set([
  "stop",
  "continue",
  "retry-once"
]);
var VALID_BROADCAST_TARGET_MODES = /* @__PURE__ */ new Set([
  "default",
  "new",
  "tab"
]);
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
function normalizeComparisonCaptureMode(value) {
  return VALID_CAPTURE_MODES.has(value) ? value : "manual";
}
function normalizeChainFailurePolicy(value) {
  return VALID_CHAIN_FAILURE_POLICIES.has(value) ? value : "stop";
}
function normalizeBroadcastTargetMode(value) {
  return VALID_BROADCAST_TARGET_MODES.has(value) ? value : void 0;
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
    favoriteSort: normalizeFavoriteSort(settings.favoriteSort),
    siteOrder: normalizeSiteIdList(settings.siteOrder)
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
function createStorageItemId(prefix, preferredId, fallbackIndex = 0) {
  const trimmedId = safeText(preferredId).trim();
  if (trimmedId) {
    return trimmedId;
  }
  const safePrefix = safeText(prefix).trim() || "item";
  return `${safePrefix}-${Date.now()}-${fallbackIndex}`;
}
function normalizeComparisonNote(value, fallback = {}, index = 0) {
  const source = safeObject(value);
  const now = (/* @__PURE__ */ new Date()).toISOString();
  const createdAt = normalizeIsoDate(source.createdAt ?? fallback.createdAt, now);
  const ratingValue = Number(source.rating ?? fallback.rating);
  const rating = Number.isFinite(ratingValue) ? Math.min(5, Math.max(1, Math.round(ratingValue))) : null;
  return {
    id: createStorageItemId("note", source.id ?? fallback.id, index),
    historyId: Number.isFinite(Number(source.historyId ?? fallback.historyId)) ? Math.max(0, Math.round(Number(source.historyId ?? fallback.historyId))) : 0,
    serviceId: safeText(source.serviceId ?? fallback.serviceId).trim(),
    responseText: safeText(source.responseText ?? fallback.responseText),
    captureMode: normalizeComparisonCaptureMode(
      source.captureMode ?? fallback.captureMode
    ),
    rating,
    tags: normalizeTags(source.tags ?? fallback.tags),
    createdAt,
    updatedAt: normalizeIsoDate(source.updatedAt ?? fallback.updatedAt, createdAt)
  };
}
function normalizePromptExperimentVariant(value, fallback = {}, index = 0) {
  const source = safeObject(value);
  return {
    id: createStorageItemId("variant", source.id ?? fallback.id, index),
    title: safeText(source.title ?? fallback.title).trim() || `Variant ${index + 1}`,
    text: safeText(source.text ?? fallback.text)
  };
}
function normalizePromptExperimentVariableSet(value, fallback = {}, index = 0) {
  const source = safeObject(value);
  return {
    id: createStorageItemId("vars", source.id ?? fallback.id, index),
    title: safeText(source.title ?? fallback.title).trim() || `Variables ${index + 1}`,
    values: normalizeTemplateDefaults(source.values ?? fallback.values)
  };
}
function normalizePromptExperimentRunRecord(value, fallback = {}, index = 0) {
  const source = safeObject(value);
  return {
    id: createStorageItemId("run", source.id ?? fallback.id, index),
    createdAt: normalizeIsoDate(source.createdAt ?? fallback.createdAt),
    variantId: safeText(source.variantId ?? fallback.variantId).trim(),
    variableSetId: safeText(source.variableSetId ?? fallback.variableSetId).trim(),
    targetSiteIds: normalizeSiteIdList(source.targetSiteIds ?? fallback.targetSiteIds),
    broadcastIds: normalizeSiteIdList(source.broadcastIds ?? fallback.broadcastIds)
  };
}
function normalizePromptExperiment(value, fallback = {}, index = 0) {
  const source = safeObject(value);
  const now = (/* @__PURE__ */ new Date()).toISOString();
  const createdAt = normalizeIsoDate(source.createdAt ?? fallback.createdAt, now);
  const variants = safeArray(source.variants ?? fallback.variants).map((entry, variantIndex) => normalizePromptExperimentVariant(entry, {}, variantIndex)).filter((variant) => variant.text.trim());
  const variableSets = safeArray(source.variableSets ?? fallback.variableSets).map((entry, setIndex) => normalizePromptExperimentVariableSet(entry, {}, setIndex));
  const normalizedVariableSets = variableSets.length > 0 ? variableSets : [normalizePromptExperimentVariableSet({ title: "Default", values: {} }, {}, 0)];
  return {
    id: createStorageItemId("experiment", source.id ?? fallback.id, index),
    title: safeText(source.title ?? fallback.title).trim() || `Experiment ${index + 1}`,
    description: safeText(source.description ?? fallback.description),
    variants,
    targetSiteIds: normalizeSiteIdList(source.targetSiteIds ?? fallback.targetSiteIds),
    variableSets: normalizedVariableSets,
    runs: safeArray(source.runs ?? fallback.runs).map(
      (entry, runIndex) => normalizePromptExperimentRunRecord(entry, {}, runIndex)
    ),
    createdAt,
    updatedAt: normalizeIsoDate(source.updatedAt ?? fallback.updatedAt, createdAt)
  };
}
function normalizeTemplatePack(value, fallback = {}, index = 0) {
  const source = safeObject(value);
  const now = (/* @__PURE__ */ new Date()).toISOString();
  const createdAt = normalizeIsoDate(source.createdAt ?? fallback.createdAt, now);
  return {
    id: createStorageItemId("pack", source.id ?? fallback.id, index),
    title: safeText(source.title ?? fallback.title).trim() || `Template Pack ${index + 1}`,
    description: safeText(source.description ?? fallback.description),
    favoriteIds: normalizeSiteIdList(source.favoriteIds ?? fallback.favoriteIds),
    templates: safeArray(source.templates ?? fallback.templates),
    includeSensitiveDefaults: normalizeBoolean(
      source.includeSensitiveDefaults ?? fallback.includeSensitiveDefaults,
      true
    ),
    createdAt,
    updatedAt: normalizeIsoDate(source.updatedAt ?? fallback.updatedAt, createdAt)
  };
}
function normalizeServiceGroup(value, fallback = {}, index = 0) {
  const source = safeObject(value);
  const now = (/* @__PURE__ */ new Date()).toISOString();
  const createdAt = normalizeIsoDate(source.createdAt ?? fallback.createdAt, now);
  const sortOrder = Number(source.sortOrder ?? fallback.sortOrder ?? index);
  return {
    id: createStorageItemId("group", source.id ?? fallback.id, index),
    title: safeText(source.title ?? fallback.title).trim() || `Group ${index + 1}`,
    serviceIds: normalizeSiteIdList(source.serviceIds ?? fallback.serviceIds),
    sortOrder: Number.isFinite(sortOrder) ? Math.max(0, Math.round(sortOrder)) : index,
    createdAt,
    updatedAt: normalizeIsoDate(source.updatedAt ?? fallback.updatedAt, createdAt)
  };
}
function normalizeScheduleContextSnapshot(value) {
  const source = safeObject(value);
  const hasMeaningfulValue = Boolean(
    source.enabled || safeText(source.url).trim() || safeText(source.title).trim() || safeText(source.selection).trim() || safeText(source.capturedAt).trim()
  );
  if (!hasMeaningfulValue) {
    return null;
  }
  return {
    enabled: normalizeBoolean(source.enabled, false),
    url: safeText(source.url),
    title: safeText(source.title),
    selection: safeText(source.selection),
    capturedAt: normalizeNullableIsoDate(source.capturedAt)
  };
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
    ),
    failurePolicy: normalizeChainFailurePolicy(
      source.failurePolicy ?? fallback.failurePolicy
    ),
    targetMode: normalizeBroadcastTargetMode(source.targetMode ?? fallback.targetMode),
    templateDefaults: normalizeTemplateDefaults(
      source.templateDefaults ?? fallback.templateDefaults
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

// src/shared/prompts/favorites-store.ts
function buildFavoriteEntry(entry) {
  const source = entry ?? {};
  const text = safeText(source?.text);
  const sentTo = normalizeSentTo(source?.sentTo);
  const createdAt = normalizeIsoDate(source?.createdAt);
  const favoritedAt = normalizeIsoDate(source?.favoritedAt, createdAt);
  const usageCount = Math.max(0, Math.round(Number(source?.usageCount) || 0));
  const mode = normalizeFavoriteMode(source?.mode);
  const steps = mode === "chain" ? normalizeChainSteps(source?.steps, {
    text,
    delayMs: 0,
    targetSiteIds: sentTo
  }) : [];
  return {
    id: typeof source?.id === "string" && source.id.trim() ? source.id.trim() : `fav-${Date.now()}`,
    sourceHistoryId: source?.sourceHistoryId === null || source?.sourceHistoryId === void 0 ? null : Number(source.sourceHistoryId),
    title: safeText(source?.title),
    text,
    sentTo,
    createdAt,
    favoritedAt,
    templateDefaults: normalizeTemplateDefaults(source?.templateDefaults),
    tags: normalizeTags(source?.tags),
    folder: safeText(source?.folder).slice(0, 50),
    pinned: normalizeBoolean(source?.pinned, false),
    usageCount,
    lastUsedAt: normalizeNullableIsoDate(source?.lastUsedAt),
    mode,
    steps,
    scheduleEnabled: normalizeBoolean(source?.scheduleEnabled, false),
    scheduledAt: normalizeNullableIsoDate(source?.scheduledAt),
    scheduleRepeat: normalizeScheduleRepeat(source?.scheduleRepeat),
    scheduleContextSnapshot: normalizeScheduleContextSnapshot(source?.scheduleContextSnapshot)
  };
}
async function getPromptFavorites() {
  const rawFavorites = await readLocal(
    LOCAL_STORAGE_KEYS.favorites,
    []
  );
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

// src/shared/prompts/advanced-store.ts
function normalizeTemplatePackEntry(value, fallback = {}, index = 0) {
  const pack = normalizeTemplatePack(value, fallback, index);
  return {
    ...pack,
    templates: safeArray(pack.templates).map((entry) => buildFavoriteEntry(entry))
  };
}
async function getComparisonNotes() {
  const rawValue = await readLocal(
    LOCAL_STORAGE_KEYS.comparisonNotes,
    []
  );
  return sortByDateDesc(
    safeArray(rawValue).map(
      (entry, index) => normalizeComparisonNote(entry, {}, index)
    ),
    "updatedAt"
  ).filter((entry) => entry.historyId > 0 && entry.serviceId && entry.responseText.trim());
}
async function getPromptExperiments() {
  const rawValue = await readLocal(
    LOCAL_STORAGE_KEYS.promptExperiments,
    []
  );
  return sortByDateDesc(
    safeArray(rawValue).map(
      (entry, index) => normalizePromptExperiment(entry, {}, index)
    ),
    "updatedAt"
  );
}
async function getTemplatePacks() {
  const rawValue = await readLocal(
    LOCAL_STORAGE_KEYS.templatePacks,
    []
  );
  return sortByDateDesc(
    safeArray(rawValue).map(
      (entry, index) => normalizeTemplatePackEntry(entry, {}, index)
    ),
    "updatedAt"
  );
}
async function getServiceGroups() {
  const rawValue = await readLocal(
    LOCAL_STORAGE_KEYS.serviceGroups,
    []
  );
  return safeArray(rawValue).map((entry, index) => normalizeServiceGroup(entry, {}, index)).sort((left, right) => left.sortOrder - right.sortOrder || left.title.localeCompare(right.title));
}
async function setServiceGroups(value) {
  const normalized = safeArray(value).map((entry, index) => normalizeServiceGroup(entry, {}, index)).sort((left, right) => left.sortOrder - right.sortOrder || left.title.localeCompare(right.title));
  await writeLocal(LOCAL_STORAGE_KEYS.serviceGroups, normalized);
  return normalized;
}

// src/shared/broadcast/target-snapshots.ts
function normalizeTargetMode(value) {
  if (value === "new" || value === "tab") {
    return value;
  }
  return "default";
}
function normalizeTargetTabId(value) {
  if (value === null || value === void 0 || value === "") {
    return null;
  }
  const numericValue = Number(value);
  return Number.isFinite(numericValue) ? numericValue : null;
}
function buildBroadcastTargetSnapshot(value) {
  const siteId = safeText(value?.siteId).trim();
  if (!siteId) {
    return null;
  }
  return {
    siteId,
    resolvedPrompt: safeText(value?.resolvedPrompt),
    targetMode: normalizeTargetMode(value?.targetMode),
    targetTabId: normalizeTargetTabId(value?.targetTabId)
  };
}
function normalizeBroadcastTargetSnapshots(value) {
  if (!Array.isArray(value)) {
    return [];
  }
  const seenSiteIds = /* @__PURE__ */ new Set();
  const snapshots = [];
  value.forEach((entry) => {
    const snapshot = buildBroadcastTargetSnapshot(
      entry && typeof entry === "object" && !Array.isArray(entry) ? {
        siteId: safeText(entry.siteId),
        resolvedPrompt: safeText(entry.resolvedPrompt),
        targetMode: entry.targetMode,
        targetTabId: normalizeTargetTabId(entry.targetTabId)
      } : null
    );
    if (!snapshot || seenSiteIds.has(snapshot.siteId)) {
      return;
    }
    seenSiteIds.add(snapshot.siteId);
    snapshots.push(snapshot);
  });
  return snapshots;
}
function buildFallbackTargetSnapshots(siteIds, prompt) {
  return normalizeSiteIdList(siteIds).map((siteId) => ({
    siteId,
    resolvedPrompt: safeText(prompt),
    targetMode: "default",
    targetTabId: null
  }));
}
function ensureBroadcastTargetSnapshots(snapshots, siteIds, prompt) {
  const normalized = normalizeBroadcastTargetSnapshots(snapshots);
  if (normalized.length > 0) {
    return normalized;
  }
  return buildFallbackTargetSnapshots(siteIds, prompt);
}
function getTargetSnapshotSiteIds(entry) {
  const snapshots = ensureBroadcastTargetSnapshots(
    entry?.targetSnapshots,
    entry?.requestedSiteIds ?? entry?.sentTo,
    entry?.text
  );
  return snapshots.map((snapshot) => snapshot.siteId);
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
    targetSnapshots: ensureBroadcastTargetSnapshots(
      source.targetSnapshots,
      requestedSiteIds,
      source.text
    ),
    originFavoriteId: source.originFavoriteId === null || source.originFavoriteId === void 0 ? null : safeText(source.originFavoriteId).trim() || null,
    chainRunId: source.chainRunId === null || source.chainRunId === void 0 ? null : safeText(source.chainRunId).trim() || null,
    chainStepIndex: source.chainStepIndex === null || source.chainStepIndex === void 0 ? null : Number.isFinite(Number(source.chainStepIndex)) ? Math.max(0, Math.round(Number(source.chainStepIndex))) : null,
    chainStepCount: source.chainStepCount === null || source.chainStepCount === void 0 ? null : Number.isFinite(Number(source.chainStepCount)) ? Math.max(0, Math.round(Number(source.chainStepCount))) : null,
    experimentRunId: source.experimentRunId === null || source.experimentRunId === void 0 ? null : safeText(source.experimentRunId).trim() || null,
    trigger: normalizeExecutionTrigger(source.trigger)
  };
}
async function getStoredPromptHistory() {
  const rawHistory = await readLocal(LOCAL_STORAGE_KEYS.history, []);
  return sortByDateDesc(
    safeArray(rawHistory).map((item) => buildHistoryEntry(item))
  );
}
function applyHistoryVisibleLimit(historyItems, historyLimit) {
  const normalizedLimit = Number.isFinite(Number(historyLimit)) ? Math.max(1, Math.round(Number(historyLimit))) : 50;
  return safeArray(historyItems).slice(0, normalizedLimit);
}
async function setPromptHistory(historyItems) {
  const normalized = sortByDateDesc(
    safeArray(historyItems).map((item) => buildHistoryEntry(item))
  );
  await writeLocal(LOCAL_STORAGE_KEYS.history, normalized);
  return normalized;
}
async function deletePromptHistoryItemsByIds(historyIds) {
  const selectedIds = new Set(
    safeArray(historyIds).map((historyId) => Number(historyId)).filter((historyId) => Number.isFinite(historyId))
  );
  const history = await getStoredPromptHistory();
  const nextHistory = history.filter((item) => !selectedIds.has(Number(item.id)));
  await setPromptHistory(nextHistory);
  return nextHistory;
}
async function deletePromptHistoryItemsBeforeDate(dateValue) {
  const cutoffDate = typeof dateValue === "string" || dateValue instanceof Date ? new Date(dateValue) : /* @__PURE__ */ new Date("");
  if (!Number.isFinite(cutoffDate.getTime())) {
    return getStoredPromptHistory();
  }
  const cutoffTime = cutoffDate.getTime();
  const history = await getStoredPromptHistory();
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
    supportedRoutes: [],
    inputSelector: "#prompt-textarea, div#prompt-textarea[contenteditable='true'], textarea[aria-label*='chatgpt' i], textarea[aria-label*='채팅' i], textarea[placeholder*='ask' i]",
    fallbackSelectors: [
      "#prompt-textarea",
      "div#prompt-textarea[contenteditable='true']",
      "textarea[aria-label*='chatgpt' i]",
      "textarea[aria-label*='채팅' i]",
      "textarea[placeholder*='ask' i]",
      "textarea.wcDTda_fallbackTextarea",
      "div.ProseMirror[contenteditable='true']",
      "div[contenteditable='true'][data-id='root']",
      "main div[contenteditable='true']"
    ],
    inputType: "contenteditable",
    submitSelector: "button[data-testid='send-button'], button[aria-label*='send' i], button[aria-label*='보내기' i]",
    submitMethod: "click",
    selectorCheckMode: "input-and-conditional-submit",
    waitMs: 2e3,
    fallback: true,
    lastVerified: "2026-05",
    verifiedAt: "2026-05-10",
    verifiedRoute: "/",
    verifiedAuthState: "logged-out",
    verifiedLocale: "ko",
    verifiedVersion: "chatgpt-web-may-2026",
    authSelectors: [
      "form[action*='/auth']",
      "input[name='email']",
      "input[name='username']",
      "a[href*='cloudflare.com']",
      "#challenge-running",
      ".cf-browser-verification",
      ".cf-challenge",
      ".cf-turnstile",
      "iframe[src*='challenges.cloudflare.com']"
    ]
  },
  {
    id: "gemini",
    name: "Gemini",
    url: "https://gemini.google.com/app",
    hostname: "gemini.google.com",
    supportedRoutes: ["/app"],
    inputSelector: "div[contenteditable='true'][role='textbox'], div[aria-label*='Gemini' i][contenteditable='true'][role='textbox'], div.ql-editor.textarea.new-input-ui[contenteditable='true'], div.ql-editor[contenteditable='true'][role='textbox']",
    fallbackSelectors: [
      "div[contenteditable='true'][role='textbox']",
      "div[aria-label*='Gemini' i][contenteditable='true'][role='textbox']",
      "div.ql-editor.textarea.new-input-ui[contenteditable='true']",
      "div.ql-editor[contenteditable='true'][role='textbox']",
      "textarea, div[contenteditable='true']"
    ],
    inputType: "contenteditable",
    submitSelector: "button.send-button, button[aria-label*='send' i], button[aria-label*='보내기' i], button[aria-label*='메시지 보내기' i], button[type='submit']",
    submitMethod: "click",
    selectorCheckMode: "input-and-conditional-submit",
    waitMs: 2500,
    fallback: true,
    lastVerified: "2026-05",
    verifiedAt: "2026-05-10",
    verifiedRoute: "/app",
    verifiedAuthState: "logged-out",
    verifiedLocale: "ko",
    verifiedVersion: "gemini-app-may-2026",
    authSelectors: [
      "a[href*='accounts.google.com/ServiceLogin']",
      "a[aria-label*='로그인']",
      "a[aria-label*='sign in' i]",
      "input[type='email']",
      "input[type='password']"
    ]
  },
  {
    id: "claude",
    name: "Claude",
    url: "https://claude.ai/new",
    hostname: "claude.ai",
    supportedRoutes: ["/new"],
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
    selectorCheckMode: "input-and-conditional-submit",
    waitMs: 1500,
    fallback: true,
    lastVerified: "2026-05",
    verifiedAt: "2026-05-10",
    verifiedRoute: "/new",
    verifiedAuthState: "logged-out",
    verifiedLocale: "en-US",
    verifiedVersion: "claude-web-may-2026",
    authSelectors: [
      "input#email",
      "input[type='email']",
      "input[type='password']",
      "form[action*='login']",
      "a[href*='cloudflare.com']",
      "#challenge-running",
      ".cf-browser-verification",
      ".cf-challenge",
      ".cf-turnstile",
      "iframe[src*='challenges.cloudflare.com']"
    ]
  },
  {
    id: "grok",
    name: "Grok",
    url: "https://grok.com/",
    hostname: "grok.com",
    supportedRoutes: [],
    inputSelector: "textarea[aria-label*='grok' i], textarea[placeholder*='help' i], textarea[placeholder*='무엇' i], textarea",
    fallbackSelectors: [
      "textarea[aria-label*='grok' i]",
      "textarea[placeholder*='help' i]",
      "textarea[placeholder*='무엇' i]",
      "textarea",
      "div.tiptap.ProseMirror[contenteditable='true']",
      "div.ProseMirror[contenteditable='true'][translate='no']",
      "div.ProseMirror[contenteditable='true']"
    ],
    inputType: "textarea",
    submitSelector: "button[data-testid='chat-submit'], button[type='submit'][aria-label*='submit' i], button[type='submit'][aria-label*='제출' i], button[aria-label*='submit' i], button[aria-label*='제출' i]",
    submitMethod: "click",
    selectorCheckMode: "input-and-conditional-submit",
    waitMs: 3e3,
    fallback: true,
    lastVerified: "2026-05",
    verifiedAt: "2026-05-10",
    verifiedRoute: "/",
    verifiedAuthState: "logged-out",
    verifiedLocale: "ko",
    verifiedVersion: "grok-web-may-2026",
    authSelectors: [
      "input[autocomplete='username']",
      "input[type='password']",
      "a[href*='/sign-in']",
      "a[href*='/login']"
    ]
  },
  {
    id: "perplexity",
    name: "Perplexity",
    url: "https://www.perplexity.ai/",
    hostname: "www.perplexity.ai",
    hostnameAliases: ["perplexity.ai"],
    supportedRoutes: [],
    inputSelector: "#ask-input[data-lexical-editor='true'][role='textbox']",
    fallbackSelectors: [
      "div#ask-input[data-lexical-editor='true'][role='textbox']",
      "div#ask-input[contenteditable='true'][role='textbox']",
      "#ask-input[contenteditable='true']",
      "div[contenteditable='true'][role='textbox']",
      "textarea[aria-label*='Ask' i]",
      "textarea[placeholder*='Ask'][data-testid='search-input']",
      "textarea[placeholder*='Ask']",
      "textarea[placeholder*='질문']",
      "textarea"
    ],
    inputType: "contenteditable",
    submitSelector: "button[aria-label*='Submit'][type='submit'], button[type='submit'][aria-label*='검색'], button[aria-label*='submit' i], button[aria-label*='제출' i]",
    submitMethod: "click",
    selectorCheckMode: "input-and-conditional-submit",
    waitMs: 2e3,
    fallback: true,
    lastVerified: "2026-05",
    verifiedAt: "2026-05-10",
    verifiedRoute: "/",
    verifiedAuthState: "soft-gated",
    verifiedLocale: "en-US",
    verifiedVersion: "perplexity-web-may-2026",
    authSelectors: [
      "input[type='email']",
      "input[type='password']",
      "button[data-testid='login-button']",
      "a[href*='cloudflare.com']",
      "#challenge-running",
      ".cf-browser-verification",
      ".cf-challenge",
      ".cf-turnstile",
      "iframe[src*='challenges.cloudflare.com']"
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
var VALID_SELECTOR_CHECK_MODES = /* @__PURE__ */ new Set([
  "input-and-submit",
  "input-and-conditional-submit",
  "input-only"
]);
var VALID_VERIFIED_AUTH_STATES = /* @__PURE__ */ new Set([
  "logged-in",
  "logged-out",
  "soft-gated"
]);
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

// src/shared/sites/normalizers/core.ts
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
    return new URL(String(url ?? "")).hostname;
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
    const parsed = new URL(String(url ?? ""));
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
      return [];
    }
    const primaryHost = normalizeOriginHost(parsed.host);
    const primaryHostname = normalizeHostname(parsed.hostname);
    const normalizedAliases = Array.from(
      new Set(
        normalizeStringList(hostnameAliases).map((entry) => normalizeOriginHost(entry)).filter(
          (entry) => entry && entry !== primaryHost && entry !== primaryHostname
        )
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

// src/shared/sites/normalizers/ids.ts
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
    candidate = `${safeText2(baseId)}-${suffix}`;
    suffix += 1;
  }
  usedIds.add(candidate);
  return candidate;
}

// src/shared/sites/verification.ts
var ISO_MONTH_PATTERN = /^\d{4}-(0[1-9]|1[0-2])$/;
var ISO_DATE_PATTERN = /^\d{4}-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/;
function normalizeText(value) {
  return typeof value === "string" ? value.trim() : "";
}
function hasOwnKey(value, key) {
  return Boolean(value) && typeof value === "object" && Object.prototype.hasOwnProperty.call(value, key);
}
function resolveTextField(primary, fallback, key) {
  if (hasOwnKey(primary, key)) {
    return normalizeText(primary[key]);
  }
  return normalizeText(fallback[key]);
}
function normalizeLegacyLastVerified(value) {
  const normalized = normalizeText(value);
  return ISO_MONTH_PATTERN.test(normalized) ? normalized : "";
}
function normalizeVerifiedAt(value) {
  const normalized = normalizeText(value);
  return ISO_DATE_PATTERN.test(normalized) ? normalized : "";
}
function normalizeVerifiedAuthState(value) {
  const normalized = normalizeText(value);
  return VALID_VERIFIED_AUTH_STATES.has(normalized) ? normalized : "";
}
function deriveLegacyLastVerified(verifiedAt) {
  return normalizeVerifiedAt(verifiedAt).slice(0, 7);
}
function buildVerificationMetadata(primaryValue, fallbackValue = {}) {
  const primary = primaryValue && typeof primaryValue === "object" && !Array.isArray(primaryValue) ? primaryValue : {};
  const fallback = fallbackValue && typeof fallbackValue === "object" && !Array.isArray(fallbackValue) ? fallbackValue : {};
  const primaryHasVerifiedAt = hasOwnKey(primary, "verifiedAt");
  const primaryVerifiedAt = normalizeVerifiedAt(primary.verifiedAt);
  const fallbackVerifiedAt = normalizeVerifiedAt(fallback.verifiedAt);
  const verifiedAt = primaryHasVerifiedAt ? primaryVerifiedAt : primaryVerifiedAt || fallbackVerifiedAt;
  const lastVerified = verifiedAt ? deriveLegacyLastVerified(verifiedAt) : primaryHasVerifiedAt ? "" : normalizeLegacyLastVerified(primary.lastVerified) || normalizeLegacyLastVerified(fallback.lastVerified);
  return {
    lastVerified,
    verifiedAt,
    verifiedRoute: resolveTextField(primary, fallback, "verifiedRoute"),
    verifiedAuthState: hasOwnKey(primary, "verifiedAuthState") ? normalizeVerifiedAuthState(primary.verifiedAuthState) : normalizeVerifiedAuthState(primary.verifiedAuthState) || normalizeVerifiedAuthState(fallback.verifiedAuthState),
    verifiedLocale: resolveTextField(primary, fallback, "verifiedLocale"),
    verifiedVersion: resolveTextField(primary, fallback, "verifiedVersion")
  };
}

// src/shared/sites/selector-utils.ts
var AUTH_PATH_SEGMENTS = Object.freeze([
  "/login",
  "/logout",
  "/sign-in",
  "/signin",
  "/auth"
]);
var SETTINGS_PATH_SEGMENTS = Object.freeze([
  "/settings",
  "/preferences",
  "/account",
  "/billing"
]);
function normalizePathname(pathname) {
  return typeof pathname === "string" ? pathname.trim().toLowerCase() : "";
}
function normalizeRoutePrefix(value) {
  const normalized = normalizePathname(value);
  if (!normalized) {
    return "";
  }
  const basePath = normalized.split("#")[0]?.split("?")[0] ?? "";
  if (!basePath.startsWith("/")) {
    return "";
  }
  const trimmed = basePath.replace(/\/+$/g, "");
  return trimmed || "/";
}
function normalizeSupportedRoutes(value) {
  const rawEntries = Array.isArray(value) ? value : typeof value === "string" ? value.split(/\r?\n/g) : [];
  return Array.from(
    new Set(
      rawEntries.map((entry) => normalizeRoutePrefix(entry)).filter(Boolean)
    )
  );
}
function getConfiguredSupportedRoutes(site) {
  const explicitRoutes = normalizeSupportedRoutes(site?.supportedRoutes);
  if (explicitRoutes.length > 0) {
    return explicitRoutes;
  }
  const fallbackRoute = normalizeRoutePrefix(site?.verifiedRoute);
  return fallbackRoute && fallbackRoute !== "/" ? [fallbackRoute] : [];
}

// src/shared/sites/normalizers/site-records.ts
var BUILT_IN_SITE_STYLE_LOOKUP = BUILT_IN_SITE_STYLE_MAP;
var PERPLEXITY_PRIMARY_INPUT_SELECTOR = "#ask-input[data-lexical-editor='true'][role='textbox']";
var PERPLEXITY_SELECTOR_FALLBACKS = [
  "div#ask-input[data-lexical-editor='true'][role='textbox']",
  "div#ask-input[contenteditable='true'][role='textbox']",
  "#ask-input[contenteditable='true']",
  "div[contenteditable='true'][role='textbox']"
];
function normalizeSelectorArray(value) {
  return Array.isArray(value) ? value.filter(
    (entry) => typeof entry === "string" && Boolean(entry.trim())
  ).map((entry) => entry.trim()) : [];
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
function normalizeTrimmedStringArray(value) {
  return Array.isArray(value) ? value.filter(
    (entry) => typeof entry === "string" && Boolean(entry.trim())
  ) : [];
}
function buildBaseSiteRecord(site, builtInMeta = {}) {
  const style = BUILT_IN_SITE_STYLE_LOOKUP[safeText2(site.id)] ?? {};
  const url = safeText2(site.url);
  const hostname = normalizeHostname(site.hostname || deriveHostname(url));
  const hostnameAliases = normalizeHostnameAliases(site.hostnameAliases, hostname);
  const normalizedSelectors = normalizePerplexitySelectors(site);
  const verification = buildVerificationMetadata(site);
  const supportedRoutes = getConfiguredSupportedRoutes(site);
  const verifiedAuthState = verification.verifiedAuthState || void 0;
  return {
    id: safeText2(site.id),
    name: safeText2(site.name) || "AI Service",
    url,
    hostname,
    hostnameAliases,
    supportedRoutes,
    inputSelector: normalizedSelectors.inputSelector,
    inputType: normalizeInputType(site.inputType, "textarea"),
    submitSelector: safeText2(site.submitSelector),
    submitMethod: normalizeSubmitMethod(site.submitMethod, "click"),
    selectorCheckMode: normalizeSelectorCheckMode(
      site.selectorCheckMode,
      "input-and-submit"
    ),
    waitMs: normalizeWaitMs(site.waitMs, 2e3),
    fallbackSelectors: normalizedSelectors.fallbackSelectors,
    fallback: normalizeBoolean2(site.fallback, true),
    authSelectors: normalizeTrimmedStringArray(site.authSelectors),
    lastVerified: verification.lastVerified,
    verifiedAt: verification.verifiedAt,
    verifiedRoute: verification.verifiedRoute,
    verifiedAuthState,
    verifiedLocale: verification.verifiedLocale,
    verifiedVersion: verification.verifiedVersion,
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
  const submitMethod = normalizeSubmitMethod(
    override.submitMethod,
    normalizeSubmitMethod(originalSite.submitMethod, "click")
  );
  const submitSelector = submitMethod === "click" ? safeText2(override.submitSelector) || safeText2(originalSite.submitSelector) : safeText2(override.submitSelector);
  const verification = buildVerificationMetadata(override, originalSite);
  const supportedRoutes = Object.prototype.hasOwnProperty.call(
    override ?? {},
    "supportedRoutes"
  ) ? normalizeSupportedRoutes(override.supportedRoutes) : getConfiguredSupportedRoutes(originalSite);
  const verifiedAuthState = verification.verifiedAuthState || void 0;
  return {
    name: safeText2(override.name) || safeText2(originalSite.name),
    supportedRoutes,
    inputSelector: safeText2(override.inputSelector) || safeText2(originalSite.inputSelector),
    inputType: normalizeInputType(
      override.inputType,
      normalizeInputType(originalSite.inputType, "textarea")
    ),
    submitSelector,
    submitMethod,
    selectorCheckMode: normalizeSelectorCheckMode(
      override.selectorCheckMode,
      normalizeSelectorCheckMode(
        originalSite.selectorCheckMode,
        "input-and-submit"
      )
    ),
    waitMs: normalizeWaitMs(
      override.waitMs,
      normalizeWaitMs(originalSite.waitMs, 2e3)
    ),
    fallbackSelectors: Array.isArray(override.fallbackSelectors) ? normalizeTrimmedStringArray(override.fallbackSelectors) : Array.isArray(originalSite.fallbackSelectors) ? normalizeTrimmedStringArray(originalSite.fallbackSelectors) : [],
    authSelectors: Array.isArray(override.authSelectors) ? normalizeTrimmedStringArray(override.authSelectors) : Array.isArray(originalSite.authSelectors) ? normalizeTrimmedStringArray(originalSite.authSelectors) : [],
    lastVerified: verification.lastVerified,
    verifiedAt: verification.verifiedAt,
    verifiedRoute: verification.verifiedRoute,
    verifiedAuthState,
    verifiedLocale: verification.verifiedLocale,
    verifiedVersion: verification.verifiedVersion,
    color: normalizeColor(
      override.color,
      BUILT_IN_SITE_STYLE_LOOKUP[safeText2(originalSite.id)]?.color ?? "#c24f2e"
    ),
    icon: normalizeIcon(
      override.icon,
      BUILT_IN_SITE_STYLE_LOOKUP[safeText2(originalSite.id)]?.icon ?? safeText2(originalSite.name)
    )
  };
}
function normalizeCustomSite(site) {
  const source = isPlainObject(site) ? site : {};
  const url = safeText2(source?.url);
  const hostname = normalizeHostname(source?.hostname || deriveHostname(url));
  const verificationFields = {};
  if (Object.prototype.hasOwnProperty.call(source, "lastVerified")) {
    verificationFields.lastVerified = safeText2(source?.lastVerified);
  }
  if (Object.prototype.hasOwnProperty.call(source, "verifiedAt")) {
    verificationFields.verifiedAt = safeText2(source?.verifiedAt);
  }
  if (Object.prototype.hasOwnProperty.call(source, "verifiedRoute")) {
    verificationFields.verifiedRoute = safeText2(source?.verifiedRoute);
  }
  if (Object.prototype.hasOwnProperty.call(source, "verifiedAuthState")) {
    verificationFields.verifiedAuthState = safeText2(source?.verifiedAuthState);
  }
  if (Object.prototype.hasOwnProperty.call(source, "verifiedLocale")) {
    verificationFields.verifiedLocale = safeText2(source?.verifiedLocale);
  }
  if (Object.prototype.hasOwnProperty.call(source, "verifiedVersion")) {
    verificationFields.verifiedVersion = safeText2(source?.verifiedVersion);
  }
  return buildBaseSiteRecord(
    {
      id: safeText2(source?.id) || createCustomSiteId(source?.name),
      name: safeText2(source?.name) || "Custom AI",
      url,
      hostname,
      hostnameAliases: normalizeHostnameAliases(source?.hostnameAliases, hostname),
      supportedRoutes: Object.prototype.hasOwnProperty.call(
        source,
        "supportedRoutes"
      ) ? source?.supportedRoutes : void 0,
      inputSelector: safeText2(source?.inputSelector),
      inputType: normalizeInputType(source?.inputType, "textarea"),
      submitSelector: safeText2(source?.submitSelector),
      submitMethod: normalizeSubmitMethod(source?.submitMethod, "click"),
      selectorCheckMode: normalizeSelectorCheckMode(
        source?.selectorCheckMode,
        "input-and-submit"
      ),
      waitMs: normalizeWaitMs(source?.waitMs, 2e3),
      fallbackSelectors: normalizeStringList(source?.fallbackSelectors),
      fallback: normalizeBoolean2(source?.fallback, true),
      authSelectors: normalizeStringList(source?.authSelectors),
      ...verificationFields,
      enabled: normalizeBoolean2(source?.enabled, true),
      color: normalizeColor(source?.color, "#c24f2e"),
      icon: normalizeIcon(source?.icon, "AI")
    },
    { isCustom: true }
  );
}

// src/shared/sites/hostname-aliases.ts
function validateBareHostPort(value) {
  const hostPortPattern = /^(?<host>[a-z0-9.-]+)(?::(?<port>\d{1,5}))?$/i;
  const match = value.match(hostPortPattern);
  if (!match?.groups?.host) {
    return "";
  }
  const host = match.groups.host.toLowerCase();
  const port = match.groups.port;
  if (host.startsWith(".") || host.endsWith(".") || host.includes("..") || !/[a-z]/i.test(host)) {
    return "";
  }
  if (port) {
    const numericPort = Number(port);
    if (!Number.isInteger(numericPort) || numericPort <= 0 || numericPort > 65535) {
      return "";
    }
    return `${host}:${numericPort}`;
  }
  return host;
}
function normalizeHostnameAliasEntry(value) {
  const input = safeText2(value);
  if (!input) {
    return "";
  }
  try {
    const parsed = new URL(input);
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
      return "";
    }
    return parsed.host.toLowerCase();
  } catch (_error) {
    return validateBareHostPort(input);
  }
}
function validateHostnameAliases(value) {
  const entries = Array.isArray(value) ? value : [];
  const errors = [];
  const normalizedHosts = /* @__PURE__ */ new Set();
  entries.forEach((entry, index) => {
    const rawInput = typeof entry === "string" ? entry : "";
    const rawValue = safeText2(entry);
    if (!rawValue) {
      return;
    }
    if (rawInput && rawInput !== rawInput.trim()) {
      errors.push(`Hostname alias line ${index + 1} must not include leading or trailing whitespace.`);
      return;
    }
    const normalized = normalizeHostnameAliasEntry(rawValue);
    if (!normalized) {
      errors.push(`Hostname alias line ${index + 1} must be a host[:port] or http/https URL.`);
      return;
    }
    normalizedHosts.add(normalized);
  });
  return {
    valid: errors.length === 0,
    normalizedHosts: [...normalizedHosts],
    errors
  };
}

// src/shared/sites/permissions.ts
function normalizeOriginPatterns(originPatterns) {
  return Array.from(
    new Set(
      (Array.isArray(originPatterns) ? originPatterns : []).filter((pattern) => typeof pattern === "string" && pattern.trim().length > 0).map((pattern) => pattern.trim())
    )
  );
}
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
  const normalizedOriginPatterns = normalizeOriginPatterns(originPatterns);
  const missingOrigins = [];
  for (const originPattern of normalizedOriginPatterns) {
    if (!await containsOriginPermission(originPattern)) {
      missingOrigins.push(originPattern);
    }
  }
  return missingOrigins;
}
async function requestOriginPermissions(originPatterns = []) {
  const requestedOrigins = normalizeOriginPatterns(originPatterns);
  if (requestedOrigins.length === 0) {
    return {
      granted: true,
      requestedOrigins: [],
      deniedOrigins: []
    };
  }
  const missingBeforeRequest = await findMissingOriginPermissions(requestedOrigins);
  if (missingBeforeRequest.length > 0) {
    try {
      const granted = chrome.permissions?.request ? await chrome.permissions.request({ origins: missingBeforeRequest }) : false;
      if (!granted) {
        const deniedOrigins2 = await findMissingOriginPermissions(requestedOrigins);
        return {
          granted: deniedOrigins2.length === 0,
          requestedOrigins,
          deniedOrigins: deniedOrigins2
        };
      }
    } catch (_error) {
      const deniedOrigins2 = await findMissingOriginPermissions(requestedOrigins);
      return {
        granted: deniedOrigins2.length === 0,
        requestedOrigins,
        deniedOrigins: deniedOrigins2
      };
    }
  }
  const deniedOrigins = await findMissingOriginPermissions(requestedOrigins);
  return {
    granted: deniedOrigins.length === 0,
    requestedOrigins,
    deniedOrigins
  };
}

// src/shared/security.ts
function escapeHTML(str) {
  if (typeof str !== "string") {
    return "";
  }
  const div = document.createElement("div");
  div.appendChild(document.createTextNode(str));
  return div.innerHTML;
}
function isValidURL(value) {
  try {
    const url = new URL(value);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch (_error) {
    return false;
  }
}

// src/shared/sites/validation.ts
function pushFieldError(fieldErrors, field, message) {
  if (!message) {
    return;
  }
  const current = fieldErrors[field] ?? [];
  current.push(message);
  fieldErrors[field] = current;
}
function validateSiteDraft(draft, { isBuiltIn = false } = {}) {
  const errors = [];
  const fieldErrors = {};
  const name = safeText2(draft?.name);
  const url = safeText2(draft?.url);
  const inputSelector = safeText2(draft?.inputSelector);
  if (!name) {
    pushFieldError(fieldErrors, "name", "Service name is required.");
  }
  if (!isBuiltIn && !url) {
    pushFieldError(fieldErrors, "url", "Service URL is required.");
  }
  if (url && !isValidURL(url)) {
    pushFieldError(fieldErrors, "url", "Service URL must be a valid http or https URL.");
  }
  if (!inputSelector) {
    pushFieldError(fieldErrors, "inputSelector", "Input selector is required.");
  }
  if (!VALID_INPUT_TYPES.has(safeText2(draft?.inputType))) {
    pushFieldError(fieldErrors, "inputType", "Input type is invalid.");
  }
  if (!VALID_SUBMIT_METHODS.has(safeText2(draft?.submitMethod))) {
    pushFieldError(fieldErrors, "submitMethod", "Submit method is invalid.");
  }
  const selectorCheckMode = safeText2(draft?.selectorCheckMode);
  if (selectorCheckMode && !VALID_SELECTOR_CHECK_MODES.has(selectorCheckMode)) {
    pushFieldError(fieldErrors, "selectorCheckMode", "Selector check mode is invalid.");
  }
  const verifiedAt = safeText2(draft?.verifiedAt);
  if (verifiedAt && normalizeVerifiedAt(verifiedAt) !== verifiedAt) {
    pushFieldError(fieldErrors, "verifiedAt", "Verified date must use YYYY-MM-DD.");
  }
  const verifiedAuthState = safeText2(draft?.verifiedAuthState);
  if (verifiedAuthState && !VALID_VERIFIED_AUTH_STATES.has(verifiedAuthState)) {
    pushFieldError(fieldErrors, "verifiedAuthState", "Verified auth state is invalid.");
  }
  if (safeText2(draft?.submitMethod) === "click" && !safeText2(draft?.submitSelector)) {
    pushFieldError(fieldErrors, "submitSelector", "Submit selector is required when using click submit.");
  }
  const aliasValidation = validateHostnameAliases(draft?.hostnameAliases);
  aliasValidation.errors.forEach((message) => pushFieldError(fieldErrors, "hostnameAliases", message));
  const rawSupportedRoutes = Array.isArray(draft?.supportedRoutes) ? draft.supportedRoutes : typeof draft?.supportedRoutes === "string" ? draft.supportedRoutes.split(/\r?\n/g) : [];
  const invalidSupportedRoutes = rawSupportedRoutes.map((entry) => safeText2(entry).trim()).filter(Boolean).filter((route) => !route.startsWith("/") || route.includes("?") || route.includes("#"));
  if (invalidSupportedRoutes.length > 0) {
    pushFieldError(
      fieldErrors,
      "supportedRoutes",
      "Supported routes must use path prefixes that start with / and must not include query strings or hashes."
    );
  }
  Object.values(fieldErrors).forEach((messages) => {
    (messages ?? []).forEach((message) => {
      errors.push(message);
    });
  });
  return {
    valid: errors.length === 0,
    errors,
    fieldErrors
  };
}

// src/shared/sites/import-repair.ts
function asPlainRecord(value) {
  return value && typeof value === "object" && !Array.isArray(value) ? value : {};
}
function detectBuiltInOverrideAdjustment(rawEntry, sanitized, source) {
  const rawRecord = asPlainRecord(rawEntry);
  if (!isPlainObject(rawRecord)) {
    return true;
  }
  const allowedKeys = /* @__PURE__ */ new Set([
    "name",
    "supportedRoutes",
    "inputSelector",
    "inputType",
    "submitSelector",
    "submitMethod",
    "selectorCheckMode",
    "waitMs",
    "fallbackSelectors",
    "authSelectors",
    "lastVerified",
    "verifiedAt",
    "verifiedRoute",
    "verifiedAuthState",
    "verifiedLocale",
    "verifiedVersion",
    "color",
    "icon"
  ]);
  if (Object.keys(rawRecord).some((key) => !allowedKeys.has(key))) {
    return true;
  }
  const simpleComparisons = [
    ["name", safeText2(rawRecord.name), sanitized.name],
    ["supportedRoutes", stringifyComparable(normalizeSupportedRoutes(rawRecord.supportedRoutes)), stringifyComparable(sanitized.supportedRoutes)],
    ["inputSelector", safeText2(rawRecord.inputSelector), sanitized.inputSelector],
    ["inputType", safeText2(rawRecord.inputType), sanitized.inputType],
    ["submitSelector", safeText2(rawRecord.submitSelector), sanitized.submitSelector],
    ["submitMethod", safeText2(rawRecord.submitMethod), sanitized.submitMethod],
    ["selectorCheckMode", safeText2(rawRecord.selectorCheckMode), sanitized.selectorCheckMode],
    ["lastVerified", safeText2(rawRecord.lastVerified), sanitized.lastVerified],
    ["verifiedAt", safeText2(rawRecord.verifiedAt), sanitized.verifiedAt],
    ["verifiedRoute", safeText2(rawRecord.verifiedRoute), sanitized.verifiedRoute],
    ["verifiedAuthState", safeText2(rawRecord.verifiedAuthState), sanitized.verifiedAuthState],
    ["verifiedLocale", safeText2(rawRecord.verifiedLocale), sanitized.verifiedLocale],
    ["verifiedVersion", safeText2(rawRecord.verifiedVersion), sanitized.verifiedVersion],
    ["color", safeText2(rawRecord.color), sanitized.color],
    ["icon", safeText2(rawRecord.icon), sanitized.icon]
  ];
  for (const [key, rawValue, sanitizedValue] of simpleComparisons) {
    if (Object.prototype.hasOwnProperty.call(rawRecord, key) && rawValue !== sanitizedValue) {
      return true;
    }
  }
  if (Object.prototype.hasOwnProperty.call(rawRecord, "waitMs") && normalizeWaitMs(
    rawRecord.waitMs,
    typeof source.waitMs === "number" ? source.waitMs : void 0
  ) !== sanitized.waitMs) {
    return true;
  }
  if (Array.isArray(rawRecord.fallbackSelectors) && stringifyComparable(rawRecord.fallbackSelectors.filter((entry) => typeof entry === "string" && entry.trim())) !== stringifyComparable(sanitized.fallbackSelectors)) {
    return true;
  }
  if (Array.isArray(rawRecord.authSelectors) && stringifyComparable(rawRecord.authSelectors.filter((entry) => typeof entry === "string" && entry.trim())) !== stringifyComparable(sanitized.authSelectors)) {
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
  for (const [key, entry] of Object.entries(asPlainRecord(value))) {
    if (!BUILT_IN_SITE_IDS.has(key)) {
      droppedIds.push(key);
      continue;
    }
    const entryRecord = asPlainRecord(entry);
    normalized[key] = { enabled: normalizeBoolean2(entryRecord.enabled, true) };
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
  for (const [key, entry] of Object.entries(asPlainRecord(value))) {
    const source = AI_SITES.find((site) => site.id === key);
    if (!source) {
      droppedIds.push(key);
      continue;
    }
    const sourceRecord = source;
    const entryRecord = asPlainRecord(entry);
    const sanitized = sanitizeBuiltInOverride(entryRecord, sourceRecord);
    const mergedDraft = {
      ...sourceRecord,
      ...sanitized
    };
    const validation = validateSiteDraft(mergedDraft, { isBuiltIn: true });
    const finalOverride = validation.valid ? sanitized : sanitizeBuiltInOverride({}, sourceRecord);
    normalized[key] = finalOverride;
    appliedIds.push(key);
    if (!validation.valid || detectBuiltInOverrideAdjustment(entryRecord, finalOverride, sourceRecord)) {
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
    const rawSiteRecord = asPlainRecord(rawSite);
    const validation = validateSiteDraft({
      ...normalized,
      hostnameAliases: Array.isArray(rawSiteRecord.hostnameAliases) ? rawSiteRecord.hostnameAliases : normalized.hostnameAliases
    });
    if (!validation.valid) {
      rejectedSites.push({
        id: safeText2(rawSiteRecord.id) || normalized.id,
        name: normalized.name,
        reason: "validation_failed",
        errors: validation.errors
      });
      continue;
    }
    const requestedId = safeText2(rawSiteRecord.id) || "";
    let finalId = requestedId;
    if (!finalId) {
      finalId = ensureUniqueImportedSiteId(
        createImportedCustomSiteIdBase(
          {
            ...rawSiteRecord,
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
          ...rawSiteRecord,
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

// src/shared/prompts/import-export.ts
var CURRENT_EXPORT_VERSION = 9;
function asImportPayload(value) {
  return safeObject(value);
}
function createImportSummary(targetVersion, sourceVersion, importedCustomSites, customSiteImport, builtInStateImport, builtInOverrideImport) {
  return {
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
  };
}
function createImportPermissionDeniedError(importSummary) {
  const error = new Error("Import failed.");
  return Object.assign(error, {
    code: "import_permission_denied",
    importSummary
  });
}
async function repairImportedCustomSitesWithPermissions(rawSites) {
  const repaired = repairImportedCustomSites(rawSites);
  const requestedOrigins = /* @__PURE__ */ new Set();
  const deniedOrigins = /* @__PURE__ */ new Set();
  const acceptedSites = [];
  const permissionDeniedSites = [];
  const requestedPermissionPatterns = Array.from(
    new Set(
      repaired.repairedSites.flatMap(
        (site) => Array.isArray(site?.permissionPatterns) ? site.permissionPatterns.filter((pattern) => typeof pattern === "string" && pattern.trim()) : []
      )
    )
  );
  const permissionRequestResult = await requestOriginPermissions(requestedPermissionPatterns);
  permissionRequestResult.requestedOrigins.forEach((origin) => requestedOrigins.add(origin));
  permissionRequestResult.deniedOrigins.forEach((origin) => deniedOrigins.add(origin));
  for (const site of repaired.repairedSites) {
    const permissionPatterns = Array.isArray(site?.permissionPatterns) ? site.permissionPatterns.filter((pattern) => typeof pattern === "string" && pattern.trim()) : [];
    permissionPatterns.forEach((origin) => requestedOrigins.add(origin));
    const missingOrigins = await findMissingOriginPermissions(permissionPatterns);
    if (missingOrigins.length === 0) {
      acceptedSites.push(site);
      continue;
    }
    missingOrigins.forEach((origin) => deniedOrigins.add(origin));
    permissionDeniedSites.push({
      id: safeText2(site.id) || void 0,
      name: safeText2(site.name) || "Custom AI",
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
function migrateV5ToV6(payload) {
  return {
    ...payload,
    version: 6,
    history: safeArray(payload.history).map((entry) => buildHistoryEntry(entry)),
    favorites: safeArray(payload.favorites).map((entry) => buildFavoriteEntry(entry))
  };
}
function migrateV6ToV7(payload) {
  return {
    ...payload,
    version: 7,
    history: safeArray(payload.history).map((entry) => buildHistoryEntry(entry)),
    favorites: safeArray(payload.favorites).map((entry) => buildFavoriteEntry(entry))
  };
}
function migrateV7ToV8(payload) {
  return {
    ...payload,
    version: 8,
    history: safeArray(payload.history).map((entry) => buildHistoryEntry(entry)),
    favorites: safeArray(payload.favorites).map((entry) => buildFavoriteEntry(entry))
  };
}
function migrateV8ToV9(payload) {
  return {
    ...payload,
    version: 9,
    comparisonNotes: safeArray(payload.comparisonNotes).map(
      (entry, index) => normalizeComparisonNote(entry, {}, index)
    ),
    promptExperiments: safeArray(payload.promptExperiments).map(
      (entry, index) => normalizePromptExperiment(entry, {}, index)
    ),
    templatePacks: safeArray(payload.templatePacks).map(
      (entry, index) => normalizeTemplatePack(entry, {}, index)
    ),
    serviceGroups: safeArray(payload.serviceGroups).map(
      (entry, index) => normalizeServiceGroup(entry, {}, index)
    )
  };
}
function migrateImportData(rawValue) {
  let payload = asImportPayload(rawValue);
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
  if (workingVersion < 6) {
    payload = migrateV5ToV6(payload);
    workingVersion = 6;
  }
  if (workingVersion < 7) {
    payload = migrateV6ToV7(payload);
    workingVersion = 7;
  }
  if (workingVersion < 8) {
    payload = migrateV7ToV8(payload);
    workingVersion = 8;
  }
  if (workingVersion < 9) {
    payload = migrateV8ToV9(payload);
    workingVersion = 9;
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
    builtInSiteOverrides,
    comparisonNotes,
    promptExperiments,
    templatePacks,
    serviceGroups
  ] = await Promise.all([
    getBroadcastCounter(),
    getStoredPromptHistory(),
    getPromptFavorites(),
    getTemplateVariableCache(),
    getAppSettings(),
    getCustomSites(),
    getBuiltInSiteStates(),
    getBuiltInSiteOverrides(),
    getComparisonNotes(),
    getPromptExperiments(),
    getTemplatePacks(),
    getServiceGroups()
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
    builtInSiteOverrides,
    comparisonNotes,
    promptExperiments,
    templatePacks,
    serviceGroups
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
  const importedComparisonNotes = safeArray(migrated?.comparisonNotes).map(
    (entry, index) => normalizeComparisonNote(entry, {}, index)
  );
  const importedPromptExperiments = safeArray(migrated?.promptExperiments).map(
    (entry, index) => normalizePromptExperiment(entry, {}, index)
  );
  const importedTemplatePacks = safeArray(migrated?.templatePacks).map(
    (entry, index) => normalizeTemplatePack(entry, {}, index)
  );
  const importedServiceGroups = safeArray(migrated?.serviceGroups).map(
    (entry, index) => normalizeServiceGroup(entry, {}, index)
  );
  const normalizedHistory = [];
  for (const item of sortByDateDesc(history)) {
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
  const importSummary = createImportSummary(
    targetVersion,
    sourceVersion,
    importedCustomSites,
    customSiteImport,
    builtInStateImport,
    builtInOverrideImport
  );
  if (customSiteImport.deniedOrigins.length > 0) {
    throw createImportPermissionDeniedError({
      ...importSummary,
      customSites: {
        ...importSummary.customSites,
        acceptedIds: [],
        acceptedNames: []
      }
    });
  }
  await chrome.storage.local.set({
    [LOCAL_STORAGE_KEYS.broadcastCounter]: importedBroadcastCounter,
    [LOCAL_STORAGE_KEYS.favorites]: normalizedFavorites,
    [LOCAL_STORAGE_KEYS.templateVariableCache]: templateVariableCache,
    [LOCAL_STORAGE_KEYS.settings]: importedSettings,
    [LOCAL_STORAGE_KEYS.history]: normalizedHistory,
    [SITE_STORAGE_KEYS.customSites]: customSiteImport.acceptedSites,
    [SITE_STORAGE_KEYS.builtInSiteStates]: builtInStateImport.normalized,
    [SITE_STORAGE_KEYS.builtInSiteOverrides]: builtInOverrideImport.normalized,
    [LOCAL_STORAGE_KEYS.comparisonNotes]: importedComparisonNotes,
    [LOCAL_STORAGE_KEYS.promptExperiments]: importedPromptExperiments,
    [LOCAL_STORAGE_KEYS.templatePacks]: importedTemplatePacks,
    [LOCAL_STORAGE_KEYS.serviceGroups]: importedServiceGroups
  });
  try {
    await cleanupUnusedCustomSitePermissions(previousCustomSites, customSiteImport.acceptedSites);
  } catch (cleanupError) {
    console.warn("[AI Prompt Broadcaster] Imported data was committed, but optional permission cleanup failed.", cleanupError);
  }
  return {
    broadcastCounter: importedBroadcastCounter,
    history: normalizedHistory,
    favorites: normalizedFavorites,
    templateVariableCache,
    settings: importedSettings,
    customSites: customSiteImport.acceptedSites,
    builtInSiteStates: builtInStateImport.normalized,
    builtInSiteOverrides: builtInOverrideImport.normalized,
    comparisonNotes: importedComparisonNotes,
    promptExperiments: importedPromptExperiments,
    templatePacks: importedTemplatePacks,
    serviceGroups: importedServiceGroups,
    importSummary
  };
}

// src/shared/prompts/experiment-limits.ts
function getPromptExperimentRunStats(experiment) {
  const variantCount = experiment.variants.filter((variant) => variant.text.trim()).length;
  const variableSetCount = experiment.variableSets.length > 0 ? experiment.variableSets.length : 1;
  const broadcastCount = variantCount * variableSetCount;
  const targetSiteCount = experiment.targetSiteIds.length;
  return {
    broadcastCount,
    serviceSendCount: broadcastCount * targetSiteCount,
    targetSiteCount
  };
}

// src/options/app/state.ts
var state = {
  history: [],
  favorites: [],
  favoriteJobs: [],
  strategyStats: {},
  serviceHealthSnapshots: [],
  comparisonNotes: [],
  promptExperiments: [],
  templatePacks: [],
  serviceGroups: [],
  runtimeSites: [],
  settings: { ...DEFAULT_SETTINGS },
  activeSection: "dashboard",
  activeExperimentId: null,
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
function byId(id) {
  return document.getElementById(id);
}
var optionsDom = {
  navigation: {
    navButtons: Array.from(document.querySelectorAll(".nav-button")),
    pageSections: Array.from(document.querySelectorAll(".page-section")),
    pageStatus: byId("page-status")
  },
  dashboard: {
    dashboardCards: byId("dashboard-cards"),
    onboardingChecklist: byId("onboarding-checklist"),
    serviceDonut: byId("service-donut"),
    dailyBarChart: byId("daily-bar-chart"),
    activityHeatmap: byId("activity-heatmap"),
    serviceTrend: byId("service-trend"),
    failureReasons: byId("failure-reasons"),
    strategySummary: byId("strategy-summary")
  },
  history: {
    historyServiceFilter: byId("history-service-filter"),
    historyDateFrom: byId("history-date-from"),
    historyDateTo: byId("history-date-to"),
    historyExportCsv: byId("history-export-csv"),
    historyTableWrap: byId("history-table-wrap"),
    historySelectAll: byId("history-select-all"),
    historySelectAllLabel: byId("history-select-all-label"),
    historyDeleteSelected: byId("history-delete-selected"),
    historyDeleteFiltered: byId("history-delete-filtered"),
    historyDelete7d: byId("history-delete-7d"),
    historyDelete30d: byId("history-delete-30d"),
    historyDelete90d: byId("history-delete-90d"),
    historyPrevPage: byId("history-prev-page"),
    historyNextPage: byId("history-next-page"),
    historyPageInfo: byId("history-page-info")
  },
  schedules: {
    schedulesList: byId("schedules-list")
  },
  services: {
    servicesGrid: byId("services-grid"),
    servicesHealthCenter: byId("services-health-center"),
    servicesRefreshHealthBtn: byId("services-refresh-health"),
    serviceGroupTitle: byId("service-group-title"),
    serviceGroupSaveBtn: byId("service-group-save"),
    serviceGroupsList: byId("service-groups-list"),
    servicesOpenManagerBtn: byId("services-open-manager")
  },
  experiments: {
    experimentTitle: byId("experiment-title"),
    experimentVariants: byId("experiment-variants"),
    experimentVariables: byId("experiment-variables"),
    experimentTargets: byId("experiment-targets"),
    experimentPreview: byId("experiment-preview"),
    experimentSave: byId("experiment-save"),
    experimentRun: byId("experiment-run"),
    experimentPreviewOutput: byId("experiment-preview-output"),
    experimentList: byId("experiment-list")
  },
  settings: {
    historyLimitSlider: byId("history-limit-slider"),
    historyLimitValue: byId("history-limit-value"),
    historyLimitNote: byId("history-limit-note"),
    autoCloseToggle: byId("auto-close-toggle"),
    desktopNotificationToggle: byId("desktop-notification-toggle"),
    reuseTabsToggle: byId("reuse-tabs-toggle"),
    reuseTabsSettingTitle: byId("reuse-tabs-setting-title"),
    reuseTabsSettingDesc: byId("reuse-tabs-setting-desc"),
    waitMultiplierSettingTitle: byId("wait-multiplier-setting-title"),
    waitMultiplierSlider: byId("wait-multiplier-slider"),
    waitMultiplierSettingValue: byId("wait-multiplier-setting-value"),
    shortcutList: byId("shortcut-list"),
    openShortcutsBtn: byId("open-shortcuts-btn"),
    settingsResetData: byId("settings-reset-data"),
    settingsExportJson: byId("settings-export-json"),
    settingsImportJson: byId("settings-import-json"),
    settingsImportJsonInput: byId("settings-import-json-input"),
    templatePackSensitive: byId("template-pack-sensitive"),
    templatePackExport: byId("template-pack-export"),
    templatePackImport: byId("template-pack-import"),
    templatePackImportInput: byId("template-pack-import-input"),
    templatePackList: byId("template-pack-list")
  },
  modals: {
    historyModal: byId("history-modal"),
    historyModalClose: byId("history-modal-close"),
    historyModalMeta: byId("history-modal-meta"),
    historyModalServices: byId("history-modal-services"),
    historyModalText: byId("history-modal-text"),
    historyModalComparison: byId("history-modal-comparison"),
    importReportModal: byId("import-report-modal"),
    importReportModalClose: byId("import-report-modal-close"),
    importReportModalTitle: byId("import-report-modal-title"),
    importReportModalDesc: byId("import-report-modal-desc"),
    importReportBody: byId("import-report-body")
  },
  toastHost: byId("toast-host")
};

// src/shared/chrome/messaging.ts
var DEFAULT_RUNTIME_MESSAGE_TIMEOUT_MS = 5e3;
function normalizeTimeoutMs(timeoutMs) {
  const numericValue = Number(timeoutMs);
  if (!Number.isFinite(numericValue) || numericValue <= 0) {
    return 0;
  }
  return Math.max(0, Math.round(numericValue));
}
function sendRuntimeMessage(message, timeoutMs = 0, fallbackValue = null) {
  return new Promise((resolve) => {
    let settled = false;
    let timeoutId = 0;
    const finish = (value) => {
      if (settled) {
        return;
      }
      settled = true;
      if (timeoutId) {
        globalThis.clearTimeout(timeoutId);
      }
      resolve(value ?? fallbackValue);
    };
    const normalizedTimeoutMs = normalizeTimeoutMs(timeoutMs);
    if (normalizedTimeoutMs > 0) {
      timeoutId = globalThis.setTimeout(() => finish(fallbackValue), normalizedTimeoutMs);
    }
    try {
      chrome.runtime.sendMessage(message, (response) => {
        if (chrome.runtime.lastError) {
          finish(fallbackValue);
          return;
        }
        finish(response ?? fallbackValue);
      });
    } catch (_error) {
      finish(fallbackValue);
    }
  });
}
function sendRuntimeMessageWithTimeout(message, timeoutMs = DEFAULT_RUNTIME_MESSAGE_TIMEOUT_MS, fallbackValue = null) {
  return sendRuntimeMessage(message, timeoutMs, fallbackValue);
}

// src/shared/runtime-state/constants.ts
var LOCAL_RUNTIME_KEYS = Object.freeze({
  failedSelectors: "failedSelectors",
  onboardingCompleted: "onboardingCompleted",
  strategyStats: "strategyStats"
});
var SESSION_RUNTIME_KEYS = Object.freeze({
  pendingUiToasts: "pendingUiToasts",
  lastBroadcast: "lastBroadcast",
  pendingSelectorChecks: "pendingSelectorChecks",
  popupFavoriteIntent: "popupFavoriteIntent",
  activeComparisonContext: "activeComparisonContext",
  favoriteRunJobs: "favoriteRunJobs"
});

// src/shared/runtime-state/storage.ts
function getStorageArea(area) {
  return area === "session" ? chrome.storage.session : chrome.storage.local;
}
async function readStorage(area, key, fallbackValue) {
  const result = await getStorageArea(area).get(key);
  return result[key] ?? fallbackValue;
}
async function writeStorage(area, key, value) {
  await getStorageArea(area).set({ [key]: value });
}
async function removeStorageKeys(area, keys) {
  if (!Array.isArray(keys) || keys.length === 0) {
    return;
  }
  await getStorageArea(area).remove(keys);
}

// src/shared/runtime-state/active-comparison.ts
var ACTIVE_COMPARISON_CONTEXT_TTL_MS = 30 * 60 * 1e3;
function normalizeActiveComparisonContext(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }
  const source = value;
  const historyId = Math.max(0, Math.round(Number(source.historyId)));
  const serviceId = typeof source.serviceId === "string" && source.serviceId.trim() ? source.serviceId.trim() : "";
  const updatedAt = typeof source.updatedAt === "string" && Number.isFinite(Date.parse(source.updatedAt)) ? new Date(source.updatedAt).toISOString() : (/* @__PURE__ */ new Date()).toISOString();
  if (!historyId || !serviceId) {
    return null;
  }
  return {
    historyId,
    serviceId,
    source: "options-modal",
    updatedAt
  };
}
async function setActiveComparisonContext(context) {
  const normalized = normalizeActiveComparisonContext(
    context ? {
      ...context,
      source: "options-modal",
      updatedAt: (/* @__PURE__ */ new Date()).toISOString()
    } : null
  );
  if (!normalized) {
    await removeStorageKeys("session", [SESSION_RUNTIME_KEYS.activeComparisonContext]);
    return null;
  }
  await writeStorage("session", SESSION_RUNTIME_KEYS.activeComparisonContext, normalized);
  return normalized;
}

// src/shared/runtime-state/favorite-run-jobs.ts
var TERMINAL_JOB_TTL_MS = 5 * 60 * 1e3;
var MAX_JOB_COUNT = 50;
var favoriteRunJobMutationChain = Promise.resolve();
function normalizeJobStatus(value) {
  if (value === "queued" || value === "running" || value === "completed" || value === "failed" || value === "skipped") {
    return value;
  }
  return "queued";
}
function normalizeIsoDate2(value, fallback = (/* @__PURE__ */ new Date()).toISOString()) {
  if (typeof value !== "string" || !Number.isFinite(Date.parse(value))) {
    return fallback;
  }
  return new Date(value).toISOString();
}
function normalizeExecutionContext(value) {
  const source = safeObject(value);
  const tabId = Number(source.tabId);
  const windowId = Number(source.windowId);
  return {
    tabId: Number.isFinite(tabId) ? tabId : null,
    windowId: Number.isFinite(windowId) ? windowId : null,
    url: safeText(source.url),
    title: safeText(source.title),
    selection: safeText(source.selection),
    clipboard: safeText(source.clipboard)
  };
}
function normalizeRetryCounts(value) {
  const source = safeObject(value);
  return Object.fromEntries(
    Object.entries(source).map(([key, entryValue]) => [
      safeText(key).trim(),
      Math.max(0, Math.round(Number(entryValue) || 0))
    ]).filter(([key]) => key)
  );
}
function normalizeFavoriteRunJobRecord(value) {
  const source = safeObject(value);
  const jobId = safeText(source.jobId).trim();
  const favoriteId = safeText(source.favoriteId).trim();
  if (!jobId || !favoriteId) {
    return null;
  }
  const stepCount = Math.max(0, Math.round(Number(source.stepCount) || 0));
  const completedSteps = Math.max(0, Math.round(Number(source.completedSteps) || 0));
  const currentStepIndex = Number(source.currentStepIndex);
  return {
    jobId,
    favoriteId,
    trigger: normalizeExecutionTrigger(source.trigger) ?? "popup",
    status: normalizeJobStatus(source.status),
    mode: normalizeFavoriteMode(source.mode),
    stepCount,
    completedSteps: Math.min(completedSteps, stepCount || completedSteps),
    currentStepIndex: Number.isFinite(currentStepIndex) ? Math.max(0, Math.round(currentStepIndex)) : null,
    chainRunId: safeText(source.chainRunId).trim() || null,
    currentBroadcastId: safeText(source.currentBroadcastId).trim() || null,
    message: safeText(source.message),
    createdAt: normalizeIsoDate2(source.createdAt),
    updatedAt: normalizeIsoDate2(source.updatedAt),
    favoriteTitle: safeText(source.favoriteTitle),
    steps: normalizeChainSteps(source.steps),
    templateDefaults: source.templateDefaults && typeof source.templateDefaults === "object" && !Array.isArray(source.templateDefaults) ? Object.fromEntries(
      Object.entries(source.templateDefaults).map(([key, entryValue]) => [safeText(key).trim(), safeText(entryValue)]).filter(([key]) => Boolean(key))
    ) : {},
    executionContext: normalizeExecutionContext(source.executionContext),
    stepRetryCounts: normalizeRetryCounts(source.stepRetryCounts)
  };
}
function pruneFavoriteRunJobs(jobs, nowMs = Date.now()) {
  const byId2 = /* @__PURE__ */ new Map();
  safeArray(jobs).forEach((entry) => {
    const job = normalizeFavoriteRunJobRecord(entry);
    if (!job) {
      return;
    }
    const updatedAtMs = Date.parse(job.updatedAt);
    const isTerminal = job.status === "completed" || job.status === "failed" || job.status === "skipped";
    const expired = isTerminal && Number.isFinite(updatedAtMs) && nowMs - updatedAtMs > TERMINAL_JOB_TTL_MS;
    if (expired) {
      return;
    }
    const existing = byId2.get(job.jobId);
    if (!existing || Date.parse(existing.updatedAt) < Date.parse(job.updatedAt)) {
      byId2.set(job.jobId, job);
    }
  });
  return [...byId2.values()].sort((left, right) => Date.parse(right.updatedAt) - Date.parse(left.updatedAt)).slice(0, MAX_JOB_COUNT);
}
async function getFavoriteRunJobs() {
  const rawValue = await readStorage("session", SESSION_RUNTIME_KEYS.favoriteRunJobs, []);
  return pruneFavoriteRunJobs(safeArray(rawValue));
}
function getLatestFavoriteRunJobByFavoriteId(jobs, favoriteId) {
  const normalizedFavoriteId = safeText(favoriteId).trim();
  if (!normalizedFavoriteId) {
    return null;
  }
  return [...jobs].filter((job) => safeText(job.favoriteId).trim() === normalizedFavoriteId).sort((left, right) => Date.parse(right.updatedAt) - Date.parse(left.updatedAt))[0] ?? null;
}
function getActiveFavoriteRunJobByFavoriteId(jobs, favoriteId) {
  const normalizedFavoriteId = safeText(favoriteId).trim();
  if (!normalizedFavoriteId) {
    return null;
  }
  return [...jobs].filter((job) => safeText(job.favoriteId).trim() === normalizedFavoriteId).filter((job) => job.status === "queued" || job.status === "running").sort((left, right) => Date.parse(right.updatedAt) - Date.parse(left.updatedAt))[0] ?? null;
}

// src/shared/runtime-state/strategy-stats.ts
function normalizeCounterValue(value) {
  return Math.max(0, Math.round(Number(value) || 0));
}
function normalizeStrategyStats(value) {
  const root = safeObject(value);
  return Object.fromEntries(
    Object.entries(root).map(([siteId, siteValue]) => {
      const siteStats = safeObject(siteValue);
      const normalizedSiteStats = Object.fromEntries(
        Object.entries(siteStats).map(([strategyName, counts]) => {
          const normalizedCounts = safeObject(counts);
          return [
            String(strategyName).trim(),
            {
              success: normalizeCounterValue(normalizedCounts.success),
              fail: normalizeCounterValue(normalizedCounts.fail)
            }
          ];
        }).filter(([strategyName]) => strategyName)
      );
      return [String(siteId).trim(), normalizedSiteStats];
    }).filter(([siteId]) => siteId)
  );
}
async function getStrategyStats() {
  const rawValue = await readStorage("local", LOCAL_RUNTIME_KEYS.strategyStats, {});
  return normalizeStrategyStats(rawValue);
}

// src/shared/prompt-state.ts
var LOCAL_PROMPT_STATE_KEYS = Object.freeze({
  composeDraftPrompt: "composeDraftPrompt",
  lastSentPrompt: "lastSentPrompt",
  legacyLastPrompt: "lastPrompt"
});
var SESSION_PROMPT_STATE_KEYS = Object.freeze({
  popupPromptIntent: "popupPromptIntent"
});

// src/shared/sites/order.ts
function normalizeSiteOrder(siteOrder) {
  if (!Array.isArray(siteOrder)) {
    return [];
  }
  return Array.from(
    new Set(
      siteOrder.filter((entry) => typeof entry === "string" && entry.trim()).map((entry) => entry.trim())
    )
  );
}
function sortSitesByOrder(sites = [], siteOrder) {
  const normalizedOrder = normalizeSiteOrder(siteOrder);
  if (normalizedOrder.length === 0) {
    return [...Array.isArray(sites) ? sites : []];
  }
  const siteMap = /* @__PURE__ */ new Map();
  const unorderedSites = [];
  (Array.isArray(sites) ? sites : []).forEach((site) => {
    const siteId = typeof site?.id === "string" ? site.id.trim() : "";
    if (!siteId) {
      unorderedSites.push(site);
      return;
    }
    siteMap.set(siteId, site);
  });
  const orderedSites = normalizedOrder.map((siteId) => siteMap.get(siteId)).filter((site) => Boolean(site));
  const orderedIds = new Set(orderedSites.map((site) => String(site.id).trim()));
  return [
    ...orderedSites,
    ...(Array.isArray(sites) ? sites : []).filter((site) => {
      const siteId = typeof site?.id === "string" ? site.id.trim() : "";
      return !siteId || !orderedIds.has(siteId);
    })
  ];
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
  const snapshotSiteIds = getTargetSnapshotSiteIds(entry);
  if (snapshotSiteIds.length > 0) {
    return snapshotSiteIds;
  }
  const siteResultKeys = Object.keys(entry.siteResults ?? {});
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
function createEmptyState(message) {
  return `<div class="empty-state">${escapeHTML(message)}</div>`;
}
function buildImportReportMarkup(summary) {
  if (!summary) {
    return "";
  }
  const rejectedRows = (summary.customSites?.rejected ?? []).map((entry) => {
    const origins = Array.isArray(entry?.origins) && entry.origins.length > 0 ? `<div class="helper">${escapeHTML(entry.origins.join(", "))}</div>` : "";
    const errors = Array.isArray(entry?.errors) && entry.errors.length > 0 ? `<div class="helper">${escapeHTML(entry.errors.join(" "))}</div>` : "";
    return `
      <div class="settings-control">
        <strong>${escapeHTML(entry?.name ?? entry?.id ?? "-")}</strong>
        <div>${escapeHTML(t.settings.importRejectReason(entry?.reason ?? "unknown"))}</div>
        ${origins}
        ${errors}
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

// src/options/ui/charts.ts
var CHART_COLORS = ["#c24f2e", "#f2a446", "#2a9d8f", "#457b9d", "#7b61ff", "#bc6c25"];
function createEmptyState2(message) {
  return `<div class="empty-state">${escapeHTML(message)}</div>`;
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
    return createEmptyState2(labels.noUsage);
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
      <svg class="chart-svg" viewBox="0 0 220 220" role="img" aria-label="${escapeHTML(labels.donutAria)}">
        ${segments.map((segment) => `<path d="${segment.path}" fill="${segment.color}"></path>`).join("")}
        <text x="110" y="102" text-anchor="middle" font-size="14" fill="currentColor">${escapeHTML(labels.totalSent)}</text>
        <text x="110" y="126" text-anchor="middle" font-size="28" font-weight="700" fill="currentColor">${total}</text>
      </svg>
      <div class="legend">
        ${segments.map(
    (segment) => `
              <div class="legend-row">
                <span class="legend-label">
                  <span class="swatch" style="background:${segment.color}"></span>
                  <span>${escapeHTML(segment.label)}</span>
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
    return createEmptyState2(labels.noDaily);
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
        <text x="${x + barWidth / 2}" y="164" text-anchor="middle" font-size="12" fill="currentColor">${escapeHTML(String(item.label ?? ""))}</text>
        <text x="${x + barWidth / 2}" y="${y - 6}" text-anchor="middle" font-size="12" fill="currentColor">${escapeHTML(String(item.count ?? 0))}</text>
      `;
  }).join("");
  return `
    <svg class="chart-svg" viewBox="0 0 380 ${chartHeight}" role="img" aria-label="${escapeHTML(labels.barAria)}">
      ${bars}
    </svg>
  `;
}
function buildHeatmapMarkup(rows, labels) {
  const maxCount = Math.max(...Array.isArray(rows) ? rows.flatMap((row) => row.counts ?? []) : [0], 0);
  if (!Array.isArray(rows) || rows.length === 0 || maxCount <= 0) {
    return createEmptyState2(labels.noHeatmap);
  }
  const hourHeader = Array.from({ length: 24 }, (_, hour) => `<span>${hour}</span>`).join("");
  return `
    <div class="heatmap" role="img" aria-label="${escapeHTML(labels.heatmapAria)}">
      <div class="heatmap-row heatmap-header">
        <span>${escapeHTML(labels.hourLabel)}</span>
        <div class="heatmap-cells">${hourHeader}</div>
      </div>
      ${rows.map((row) => `
        <div class="heatmap-row">
          <span>${escapeHTML(row.label)}</span>
          <div class="heatmap-cells">
            ${(row.counts ?? []).map((count) => {
    const intensity = maxCount > 0 ? Math.max(0.08, count / maxCount) : 0.08;
    return `<span class="heatmap-cell" title="${escapeHTML(`${row.label} · ${count}`)}" style="opacity:${intensity}">${count > 0 ? count : ""}</span>`;
  }).join("")}
          </div>
        </div>
      `).join("")}
    </div>
  `;
}
function buildTrendMarkup(items, labels) {
  if (!Array.isArray(items) || items.length === 0) {
    return createEmptyState2(labels.noTrend);
  }
  return `
    <div class="trend-list">
      ${items.map((item) => `
        <div class="trend-card">
          <div class="trend-head">
            <strong>${escapeHTML(item.label)}</strong>
            <span>${item.successRate}%</span>
          </div>
          <div class="trend-bars">
            ${(item.dailySeries ?? []).map((point) => `
              <span class="trend-bar-wrap" title="${escapeHTML(`${point.label}: ${point.successRate}% (${point.successes}/${point.requests})`)}">
                <span class="trend-bar" style="height:${Math.max(8, point.successRate)}%"></span>
              </span>
            `).join("")}
          </div>
          <div class="trend-meta">${escapeHTML(`${item.requestCount} ${labels.requestsLabel}`)}</div>
        </div>
      `).join("")}
    </div>
  `;
}

// src/shared/date-utils.ts
function getLocalDateKey(value) {
  const date = value instanceof Date ? new Date(value.getTime()) : new Date(value);
  if (!Number.isFinite(date.getTime())) {
    return "";
  }
  const year = String(date.getFullYear()).padStart(4, "0");
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}
function getRelativeLocalDateKey(daysFromToday = 0, now = /* @__PURE__ */ new Date()) {
  const date = now instanceof Date ? new Date(now.getTime()) : new Date(now);
  date.setHours(0, 0, 0, 0);
  date.setDate(date.getDate() + Math.trunc(daysFromToday));
  return getLocalDateKey(date);
}

// src/options/features/dashboard-metrics.ts
function isDefined(value) {
  return value !== null && value !== void 0;
}
function normalizeSiteIds(value) {
  if (!Array.isArray(value)) {
    return [];
  }
  return Array.from(
    new Set(
      value.filter((entry) => typeof entry === "string" && entry.trim()).map((entry) => entry.trim())
    )
  );
}
function getRequestedSiteIds(entry) {
  const requestedSiteIds = normalizeSiteIds(entry?.requestedSiteIds);
  if (requestedSiteIds.length > 0) {
    return requestedSiteIds;
  }
  const siteResultKeys = normalizeSiteIds(Object.keys(entry?.siteResults ?? {}));
  if (siteResultKeys.length > 0) {
    return siteResultKeys;
  }
  return normalizeSiteIds(entry?.sentTo);
}
function getSubmittedSiteIds(entry) {
  const submittedSiteIds = normalizeSiteIds(entry?.submittedSiteIds);
  if (submittedSiteIds.length > 0) {
    return submittedSiteIds;
  }
  return normalizeSiteIds(entry?.sentTo);
}
function getSiteLabel2(siteId, runtimeSites = []) {
  return runtimeSites.find((site) => site?.id === siteId)?.name ?? siteId;
}
function getStartOfCurrentWeek(now = /* @__PURE__ */ new Date()) {
  const result = new Date(now);
  const offset = (result.getDay() + 6) % 7;
  result.setHours(0, 0, 0, 0);
  result.setDate(result.getDate() - offset);
  return result;
}
function createHeatmapRows() {
  return Array.from({ length: 7 }, (_, dayIndex) => ({
    dayIndex,
    counts: Array.from({ length: 24 }, () => 0),
    total: 0
  }));
}
function getHeatmapDayIndex(date) {
  return (date.getDay() + 6) % 7;
}
function buildDashboardMetrics(historyItems = [], runtimeSites = [], strategyStats = {}, now = /* @__PURE__ */ new Date()) {
  const history = Array.isArray(historyItems) ? historyItems : [];
  const serviceCounts = /* @__PURE__ */ new Map();
  const serviceSuccessCounts = /* @__PURE__ */ new Map();
  const dailyKeys = Array.from({ length: 7 }, (_, index) => getRelativeLocalDateKey(index - 6, now));
  const dailyCounts = dailyKeys.map((dateKey) => ({ key: dateKey, count: 0 }));
  const heatmapRows = createHeatmapRows();
  const failureReasonCounts = /* @__PURE__ */ new Map();
  let totalPromptLength = 0;
  history.forEach((entry) => {
    const requestedSiteIds = getRequestedSiteIds(entry);
    const submittedSiteIds = new Set(getSubmittedSiteIds(entry));
    const siteResults = entry?.siteResults && typeof entry.siteResults === "object" ? entry.siteResults : {};
    const createdAt = new Date(String(entry?.createdAt ?? ""));
    const localDateKey = getLocalDateKey(createdAt);
    totalPromptLength += String(entry?.text ?? "").length;
    requestedSiteIds.forEach((siteId) => {
      serviceCounts.set(siteId, (serviceCounts.get(siteId) ?? 0) + 1);
      if (submittedSiteIds.has(siteId)) {
        serviceSuccessCounts.set(siteId, (serviceSuccessCounts.get(siteId) ?? 0) + 1);
      }
    });
    if (localDateKey) {
      const dailyEntry = dailyCounts.find((item) => item.key === localDateKey);
      if (dailyEntry) {
        dailyEntry.count += 1;
      }
    }
    if (Number.isFinite(createdAt.getTime())) {
      const dayIndex = getHeatmapDayIndex(createdAt);
      const hour = createdAt.getHours();
      heatmapRows[dayIndex].counts[hour] += 1;
      heatmapRows[dayIndex].total += 1;
    }
    const failedSiteIds = normalizeSiteIds(entry?.failedSiteIds);
    const siteResultValues = Object.values(siteResults);
    if (siteResultValues.length === 0 && failedSiteIds.length > 0) {
      failedSiteIds.forEach(() => {
        failureReasonCounts.set("unexpected_error", (failureReasonCounts.get("unexpected_error") ?? 0) + 1);
      });
    } else {
      siteResultValues.forEach((result) => {
        const code = normalizeResultCode(result?.code);
        if (code === "submitted") {
          return;
        }
        failureReasonCounts.set(code, (failureReasonCounts.get(code) ?? 0) + 1);
      });
    }
  });
  const mostUsed = [...serviceCounts.entries()].sort((left, right) => right[1] - left[1])[0];
  const weekStart = getStartOfCurrentWeek(now);
  const weekCount = history.filter((entry) => new Date(String(entry?.createdAt ?? "")).getTime() >= weekStart.getTime()).length;
  const averagePromptLength = history.length > 0 ? Math.round(totalPromptLength / history.length) : 0;
  const donutItems = [...serviceCounts.entries()].sort((left, right) => right[1] - left[1]).map(([siteId, count]) => ({
    id: siteId,
    label: getSiteLabel2(siteId, runtimeSites),
    count
  }));
  const heatmapMax = Math.max(...heatmapRows.flatMap((row) => row.counts), 0);
  const serviceTrendItems = [...serviceCounts.entries()].sort((left, right) => right[1] - left[1]).slice(0, 5).map(([siteId, requestCount]) => {
    const dailySeries = dailyKeys.map((key) => ({
      key,
      requests: 0,
      successes: 0,
      successRate: 0
    }));
    history.forEach((entry) => {
      const requestedSiteIds = getRequestedSiteIds(entry);
      if (!requestedSiteIds.includes(siteId)) {
        return;
      }
      const dailyPoint = dailySeries.find((item) => item.key === getLocalDateKey(String(entry?.createdAt ?? "")));
      if (!dailyPoint) {
        return;
      }
      dailyPoint.requests += 1;
      if (getSubmittedSiteIds(entry).includes(siteId)) {
        dailyPoint.successes += 1;
      }
    });
    dailySeries.forEach((point) => {
      point.successRate = point.requests > 0 ? Math.round(point.successes / point.requests * 100) : 0;
    });
    const successCount = serviceSuccessCounts.get(siteId) ?? 0;
    return {
      id: siteId,
      label: getSiteLabel2(siteId, runtimeSites),
      requestCount,
      successCount,
      successRate: requestCount > 0 ? Math.round(successCount / requestCount * 100) : 0,
      dailySeries
    };
  });
  const failureReasonItems = [...failureReasonCounts.entries()].sort((left, right) => right[1] - left[1]).map(([code, count]) => ({ code, count }));
  const strategySummaryItems = Object.entries(strategyStats ?? {}).map(([siteId, siteStats]) => {
    const strategies = Object.entries(siteStats ?? {}).map(([strategyName, counts]) => {
      const success = Math.max(0, Math.round(Number(counts?.success) || 0));
      const fail = Math.max(0, Math.round(Number(counts?.fail) || 0));
      const attempts = success + fail;
      return {
        strategyName,
        success,
        fail,
        attempts,
        successRate: attempts > 0 ? Math.round(success / attempts * 100) : 0
      };
    }).filter((strategy) => strategy.attempts > 0).sort((left, right) => {
      if (right.successRate !== left.successRate) {
        return right.successRate - left.successRate;
      }
      return right.attempts - left.attempts;
    });
    const totalAttempts = strategies.reduce((sum, strategy) => sum + strategy.attempts, 0);
    if (totalAttempts <= 0) {
      return null;
    }
    return {
      siteId,
      label: getSiteLabel2(siteId, runtimeSites),
      totalAttempts,
      bestStrategy: strategies[0]?.strategyName ?? "",
      bestSuccessRate: strategies[0]?.successRate ?? 0
    };
  }).filter(isDefined).sort((left, right) => right.totalAttempts - left.totalAttempts);
  return {
    totalTransmissions: history.length,
    mostUsedService: mostUsed ? getSiteLabel2(mostUsed[0], runtimeSites) : "-",
    weekCount,
    averagePromptLength,
    donutItems,
    dailyCounts,
    heatmap: {
      rows: heatmapRows,
      maxCount: heatmapMax
    },
    serviceTrendItems,
    failureReasonItems,
    strategySummaryItems
  };
}

// src/options/features/dashboard.ts
var {
  activityHeatmap,
  dailyBarChart,
  dashboardCards,
  failureReasons,
  onboardingChecklist,
  serviceDonut,
  serviceTrend,
  strategySummary
} = optionsDom.dashboard;
function getWeekdayLabels() {
  const formatter = new Intl.DateTimeFormat(locale, { weekday: "short" });
  const monday = /* @__PURE__ */ new Date("2026-01-05T00:00:00");
  return Array.from({ length: 7 }, (_, index) => {
    const date = new Date(monday);
    date.setDate(monday.getDate() + index);
    return formatter.format(date);
  });
}
function formatDailyLabel(dateKey) {
  return formatShortDate(`${dateKey}T00:00:00`);
}
function buildFailureReasonsMarkup(items) {
  if (!Array.isArray(items) || items.length === 0) {
    return createEmptyState2(t.charts.noFailure);
  }
  return `
    <div class="summary-list">
      ${items.slice(0, 6).map((item) => {
    const label = t.settings.resultCodeLabels[item.code] || item.code;
    return `
          <div class="summary-row">
            <div class="summary-copy">
              <strong>${escapeHTML(label)}</strong>
              <span>${escapeHTML(item.code)}</span>
            </div>
            <div class="summary-meta">${escapeHTML(String(item.count))}</div>
          </div>
        `;
  }).join("")}
    </div>
  `;
}
function buildStrategySummaryMarkup(items) {
  if (!Array.isArray(items) || items.length === 0) {
    return createEmptyState2(t.charts.noStrategy);
  }
  return `
    <div class="summary-list">
      ${items.slice(0, 6).map((item) => `
        <div class="summary-row">
          <div class="summary-copy">
            <strong>${escapeHTML(item.label)}</strong>
            <span>${escapeHTML(`${t.charts.bestStrategyLabel}: ${item.bestStrategy || "-"}`)}</span>
          </div>
          <div class="summary-meta">
            ${escapeHTML(`${item.totalAttempts} ${t.charts.attemptsLabel}`)}
            <br />
            ${escapeHTML(`${item.bestSuccessRate}%`)}
          </div>
        </div>
      `).join("")}
    </div>
  `;
}
function renderOnboardingChecklist() {
  if (!onboardingChecklist) {
    return;
  }
  const checks = [
    {
      label: "Send your first broadcast",
      done: state.history.length > 0
    },
    {
      label: "Save a reusable favorite",
      done: state.favorites.length > 0
    },
    {
      label: "Review selector health",
      done: state.serviceHealthSnapshots.some((item) => item.lastSuccessAt || item.selectorWarning)
    },
    {
      label: "Create a service group",
      done: state.serviceGroups.length > 0
    },
    {
      label: "Save a comparison note",
      done: state.comparisonNotes.length > 0
    }
  ];
  onboardingChecklist.innerHTML = checks.map((check) => `
    <label class="checkbox-inline">
      <input type="checkbox" ${check.done ? "checked" : ""} disabled />
      <span>${escapeHTML(check.label)}</span>
    </label>
  `).join("");
}
function renderDashboard() {
  const metrics = buildDashboardMetrics(
    state.history,
    state.runtimeSites,
    state.strategyStats
  );
  const cards = [
    { label: t.cards.totalTransmissions, value: metrics.totalTransmissions },
    { label: t.cards.mostUsedService, value: metrics.mostUsedService },
    { label: t.cards.weekCount, value: metrics.weekCount },
    { label: t.cards.averagePromptLength, value: `${metrics.averagePromptLength} ${t.cards.charSuffix}` },
    { label: "Comparison notes", value: state.comparisonNotes.length },
    { label: "Prompt experiments", value: state.promptExperiments.length }
  ];
  dashboardCards.innerHTML = cards.map(
    (card) => `
        <article class="card">
          <div class="card-label">${escapeHTML(card.label)}</div>
          <div class="card-value">${escapeHTML(String(card.value))}</div>
        </article>
      `
  ).join("");
  renderOnboardingChecklist();
  serviceDonut.innerHTML = buildDonutMarkup(metrics.donutItems, {
    noUsage: t.charts.noUsage,
    totalSent: t.charts.totalSent,
    donutAria: t.charts.donutAria
  });
  dailyBarChart.innerHTML = buildBarChartMarkup(
    metrics.dailyCounts.map((item) => ({
      ...item,
      label: formatDailyLabel(item.key)
    })),
    {
      noDaily: t.charts.noDaily,
      barAria: t.charts.barAria
    }
  );
  activityHeatmap.innerHTML = buildHeatmapMarkup(
    metrics.heatmap.rows.map((row) => ({
      ...row,
      label: getWeekdayLabels()[row.dayIndex] ?? `D${row.dayIndex + 1}`
    })),
    {
      noHeatmap: t.charts.noHeatmap,
      heatmapAria: t.charts.heatmapAria,
      hourLabel: t.charts.hourLabel
    }
  );
  serviceTrend.innerHTML = buildTrendMarkup(
    metrics.serviceTrendItems.map((item) => ({
      ...item,
      dailySeries: (item.dailySeries ?? []).map((point) => ({
        ...point,
        label: formatDailyLabel(point.key)
      }))
    })),
    {
      noTrend: t.charts.noTrend,
      requestsLabel: t.charts.requestsLabel
    }
  );
  failureReasons.innerHTML = buildFailureReasonsMarkup(metrics.failureReasonItems);
  strategySummary.innerHTML = buildStrategySummaryMarkup(metrics.strategySummaryItems);
}

// src/options/features/history/filtering.ts
var PAGE_SIZE = 10;
function filteredHistory() {
  return state.history.filter((entry) => {
    const requestedServices = getRequestedServices(entry);
    const matchesService = state.filters.service === "all" || requestedServices.includes(state.filters.service);
    const dateKey = getLocalDateKey(entry.createdAt);
    const matchesFrom = !state.filters.dateFrom || dateKey >= state.filters.dateFrom;
    const matchesTo = !state.filters.dateTo || dateKey <= state.filters.dateTo;
    return matchesService && matchesFrom && matchesTo;
  });
}
function getVisibleFilteredHistory() {
  return applyHistoryVisibleLimit(filteredHistory(), state.settings.historyLimit);
}
function syncHistorySelectionState() {
  const availableIds = new Set(getVisibleFilteredHistory().map((entry) => Number(entry.id)));
  state.selectedHistoryIds = new Set(
    [...state.selectedHistoryIds].filter((historyId) => availableIds.has(Number(historyId)))
  );
}

// src/options/features/history/render.ts
var {
  historyTableWrap,
  historyPageInfo,
  historyPrevPage,
  historyNextPage,
  historySelectAll,
  historyDeleteSelected,
  historyDeleteFiltered
} = optionsDom.history;
function renderHistoryTable() {
  syncHistorySelectionState();
  const filteredEntries = filteredHistory();
  const visibleHistory = getVisibleFilteredHistory();
  const pageCount = Math.max(1, Math.ceil(visibleHistory.length / PAGE_SIZE));
  state.historyPage = Math.max(1, Math.min(state.historyPage, pageCount));
  const startIndex = (state.historyPage - 1) * PAGE_SIZE;
  const currentPageRows = visibleHistory.slice(startIndex, startIndex + PAGE_SIZE);
  const currentPageIds = currentPageRows.map((entry) => Number(entry.id));
  const allCurrentPageSelected = currentPageIds.length > 0 && currentPageIds.every((historyId) => state.selectedHistoryIds.has(historyId));
  if (currentPageRows.length === 0) {
    historyTableWrap.innerHTML = createEmptyState(t.history.emptyFiltered);
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
            <th>${escapeHTML(t.history.tableActions)}</th>
          </tr>
        </thead>
        <tbody>
          ${currentPageRows.map((entry) => {
      const status = getStatusInfo(entry.status);
      return `
                <tr data-history-row="${entry.id}">
                  <td><input type="checkbox" aria-label="${escapeHTML(t.history.tableSelect)}" data-history-select="${entry.id}" ${state.selectedHistoryIds.has(Number(entry.id)) ? "checked" : ""} /></td>
                  <td>${escapeHTML(formatDateTime(entry.createdAt))}</td>
                  <td>${escapeHTML(previewText(entry.text))}</td>
                  <td><div class="service-badges">${getRequestedServices(entry).map((siteId) => buildBadgeMarkup(siteId, state.runtimeSites)).join("")}</div></td>
                  <td><span class="status-pill ${status.className}">${escapeHTML(status.label)}</span></td>
                  <td><button class="btn ghost history-detail-button" type="button" data-open-history-id="${entry.id}">${escapeHTML(t.history.openDetails)}</button></td>
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
  historyDeleteFiltered.disabled = filteredEntries.length === 0;
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

// src/options/core/modal.ts
var modalState = /* @__PURE__ */ new WeakMap();
var boundOverlays = /* @__PURE__ */ new WeakSet();
var keyboardEventsBound = false;
var activeModal = null;
function toModalOverlay(overlay) {
  if (!overlay) {
    return null;
  }
  return overlay;
}
function getModalEntry(overlay) {
  const existing = modalState.get(overlay);
  if (existing) {
    return existing;
  }
  const created = { lastFocused: null };
  modalState.set(overlay, created);
  return created;
}
function isFocusable(element) {
  if (element.hidden || element.getAttribute("aria-hidden") === "true") {
    return false;
  }
  if ("disabled" in element && typeof element.disabled === "boolean" && element.disabled) {
    return false;
  }
  return true;
}
function getFocusableElements(root) {
  return Array.from(root.querySelectorAll(
    "button, [href], input:not([type='hidden']), select, textarea, [tabindex]:not([tabindex='-1'])"
  )).filter(isFocusable);
}
function getOpenModal() {
  if (activeModal && !activeModal.hidden) {
    return activeModal;
  }
  activeModal = Array.from(document.querySelectorAll(".modal-overlay")).map((overlay) => toModalOverlay(overlay)).find((overlay) => overlay && !overlay.hidden) ?? null;
  return activeModal;
}
function openModal(overlay, initialFocus = null) {
  const modal = toModalOverlay(overlay);
  if (!modal) {
    return;
  }
  const entry = getModalEntry(modal);
  entry.lastFocused = document.activeElement instanceof HTMLElement ? document.activeElement : null;
  modal.hidden = false;
  activeModal = modal;
  window.requestAnimationFrame(() => {
    const fallbackTarget = getFocusableElements(modal)[0] ?? modal.querySelector(".modal-card");
    (initialFocus ?? fallbackTarget)?.focus?.();
  });
}
function closeModal(overlay) {
  const modal = toModalOverlay(overlay);
  if (!modal) {
    return;
  }
  const entry = getModalEntry(modal);
  modal.hidden = true;
  if (activeModal === modal) {
    activeModal = null;
  }
  entry.lastFocused?.focus?.();
  entry.lastFocused = null;
}
function registerModalCloseHandler(overlay, onClose) {
  const modal = toModalOverlay(overlay);
  if (!modal) {
    return;
  }
  const entry = getModalEntry(modal);
  entry.onClose = onClose;
  if (boundOverlays.has(modal)) {
    return;
  }
  boundOverlays.add(modal);
  modal.addEventListener("click", (event) => {
    const target = event.target instanceof Element ? event.target : null;
    if (!target) {
      return;
    }
    if (target === modal || target.closest("[data-modal-close]")) {
      event.preventDefault();
      entry.onClose?.();
    }
  });
}
function bindModalKeyboardEvents() {
  if (keyboardEventsBound) {
    return;
  }
  keyboardEventsBound = true;
  document.addEventListener("keydown", (event) => {
    const modal = getOpenModal();
    if (!modal) {
      return;
    }
    const entry = getModalEntry(modal);
    if (event.key === "Escape") {
      event.preventDefault();
      entry.onClose?.();
      return;
    }
    if (event.key !== "Tab") {
      return;
    }
    const focusable = getFocusableElements(modal);
    if (focusable.length === 0) {
      event.preventDefault();
      return;
    }
    const currentIndex = focusable.indexOf(document.activeElement);
    const nextIndex = event.shiftKey ? currentIndex <= 0 ? focusable.length - 1 : currentIndex - 1 : currentIndex === -1 || currentIndex >= focusable.length - 1 ? 0 : currentIndex + 1;
    event.preventDefault();
    focusable[nextIndex]?.focus?.();
  });
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
  openModal(importReportModal, importReportModalClose);
}
function closeImportReportModal() {
  state.pendingImportSummary = null;
  closeModal(importReportModal);
}
function bindStatusEvents() {
  registerModalCloseHandler(importReportModal, closeImportReportModal);
}

// src/options/features/history/export.ts
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

// src/options/features/history/modal.ts
var {
  historyModal,
  historyModalClose,
  historyModalMeta,
  historyModalServices,
  historyModalText
} = optionsDom.modals;
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
    const rawStatus = result?.code ? normalizeResultCode(result.code) : submitted.has(siteId) ? "submitted" : failed.has(siteId) ? "unexpected_error" : "unknown";
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
function buildCompareWorkspaceMarkup(entry) {
  const requested = getRequestedServices(entry);
  const notes = state.comparisonNotes.filter((note) => Number(note.historyId) === Number(entry.id));
  const serviceOptions = requested.map((siteId) => {
    const site = state.runtimeSites.find((siteEntry) => siteEntry.id === siteId);
    return `<option value="${escapeHTML(siteId)}">${escapeHTML(site?.name || siteId)}</option>`;
  }).join("");
  const notesMarkup = notes.length ? notes.map((note) => {
    const site = state.runtimeSites.find((siteEntry) => siteEntry.id === note.serviceId);
    return `
        <article class="compare-note">
          <div class="section-head-row">
            <div>
              <strong>${escapeHTML(site?.name || note.serviceId)}</strong>
              <div class="helper">${escapeHTML(note.captureMode)} · ${escapeHTML(formatDateTime(note.updatedAt))}${note.rating ? ` · ${note.rating}/5` : ""}</div>
            </div>
            <button class="btn danger ghost" type="button" data-comparison-delete="${escapeHTML(note.id)}">${escapeHTML(t.comparison.delete)}</button>
          </div>
          <pre class="modal-prompt">${escapeHTML(note.responseText)}</pre>
        </article>
      `;
  }).join("") : `<div class="empty-state">${escapeHTML(t.comparison.empty)}</div>`;
  return `
    <div class="compare-workspace" data-compare-history-id="${escapeHTML(String(entry.id))}">
      <h3 class="result-comparison-title">${escapeHTML(t.comparison.title)}</h3>
      <div class="filter-row">
        <select data-comparison-service>${serviceOptions}</select>
        <input data-comparison-rating type="number" min="1" max="5" placeholder="${escapeHTML(t.comparison.ratingPlaceholder)}" />
      </div>
      <textarea data-comparison-text rows="5" placeholder="${escapeHTML(t.comparison.textPlaceholder)}"></textarea>
      <div class="settings-actions">
        <button class="btn" type="button" data-comparison-save>${escapeHTML(t.comparison.saveNote)}</button>
        <button class="btn ghost" type="button" data-comparison-capture-start>${escapeHTML(t.comparison.captureNow)}</button>
      </div>
      <div class="settings-stack">${notesMarkup}</div>
    </div>
  `;
}
async function refreshComparisonNotes(historyId) {
  state.comparisonNotes = await getComparisonNotes();
  const entry = state.history.find((item) => Number(item.id) === Number(historyId));
  const comparisonEl = document.getElementById("history-modal-comparison");
  if (entry && comparisonEl) {
    comparisonEl.innerHTML = `${buildResultComparisonMarkup(entry)}${buildCompareWorkspaceMarkup(entry)}`;
    bindCompareWorkspaceEvents(comparisonEl, entry);
  }
}
function bindCompareWorkspaceEvents(comparisonEl, entry) {
  comparisonEl.onclick = (event) => {
    const target = event.target instanceof Element ? event.target : null;
    const workspace = target?.closest("[data-compare-history-id]");
    if (!workspace) {
      return;
    }
    const serviceId = workspace.querySelector("[data-comparison-service]")?.value || entry.requestedSiteIds?.[0] || "";
    const responseText = workspace.querySelector("[data-comparison-text]")?.value || "";
    const ratingValue = Number(workspace.querySelector("[data-comparison-rating]")?.value);
    if (target?.closest("[data-comparison-service]")) {
      void setActiveComparisonContext({
        historyId: Number(entry.id),
        serviceId
      });
      return;
    }
    if (target?.closest("[data-comparison-save]")) {
      void sendRuntimeMessageWithTimeout({
        action: "comparison-note:save",
        note: {
          historyId: entry.id,
          serviceId,
          responseText,
          captureMode: "manual",
          rating: Number.isFinite(ratingValue) ? ratingValue : null,
          tags: []
        }
      }, 8e3).then(async (response) => {
        if (!response?.ok) {
          throw new Error(response?.error || t.comparison.saveFailed);
        }
        showAppToast(t.comparison.saveSuccess, "success", 1600);
        await refreshComparisonNotes(entry.id);
      }).catch((error) => {
        console.error("[AI Prompt Broadcaster] Failed to save comparison note.", error);
        showAppToast(error?.message || t.comparison.saveFailed, "error", 3e3);
      });
      return;
    }
    if (target?.closest("[data-comparison-capture-start]")) {
      void setActiveComparisonContext({
        historyId: Number(entry.id),
        serviceId
      });
      void sendRuntimeMessageWithTimeout({
        action: "comparison-capture:start",
        historyId: entry.id,
        serviceId
      }, 1e4).then(async (response) => {
        if (!response?.ok) {
          throw new Error(response?.error || t.comparison.captureFailed);
        }
        showAppToast(
          response.captured ? t.comparison.captureSuccess : response.message || t.comparison.captureNotFound,
          response.captured ? "success" : "info",
          2600
        );
        await refreshComparisonNotes(entry.id);
      }).catch((error) => {
        console.error("[AI Prompt Broadcaster] Failed to start comparison capture.", error);
        showAppToast(error?.message || t.comparison.captureFailed, "error", 3e3);
      });
      return;
    }
    const deleteButton = target?.closest("[data-comparison-delete]");
    if (deleteButton) {
      void sendRuntimeMessageWithTimeout({
        action: "comparison-note:delete",
        noteId: deleteButton.dataset.comparisonDelete ?? ""
      }, 8e3).then(async (response) => {
        state.comparisonNotes = response?.notes ?? state.comparisonNotes;
        showAppToast(t.comparison.deleteSuccess, "success", 1400);
        await refreshComparisonNotes(entry.id);
      });
    }
  };
  comparisonEl.onchange = (event) => {
    const target = event.target instanceof Element ? event.target : null;
    const workspace = target?.closest("[data-compare-history-id]");
    if (!workspace || !target?.closest("[data-comparison-service]")) {
      return;
    }
    const serviceId = workspace.querySelector("[data-comparison-service]")?.value || entry.requestedSiteIds?.[0] || "";
    void setActiveComparisonContext({
      historyId: Number(entry.id),
      serviceId
    });
  };
}
function openHistoryModal(historyId) {
  const entry = state.history.find((item) => Number(item.id) === Number(historyId));
  if (!entry) {
    return;
  }
  const status = getStatusInfo(entry.status);
  if (!historyModal || !historyModalClose || !historyModalMeta || !historyModalServices || !historyModalText) {
    return;
  }
  historyModalMeta.textContent = `${formatDateTime(entry.createdAt)} · ${status.label}`;
  historyModalServices.innerHTML = getRequestedServices(entry).map((siteId) => buildBadgeMarkup(siteId, state.runtimeSites)).join("");
  historyModalText.textContent = entry.text;
  let comparisonEl = document.getElementById("history-modal-comparison");
  if (!comparisonEl) {
    comparisonEl = document.createElement("div");
    comparisonEl.id = "history-modal-comparison";
    historyModalText.parentElement?.appendChild(comparisonEl);
  }
  comparisonEl.innerHTML = `${buildResultComparisonMarkup(entry)}${buildCompareWorkspaceMarkup(entry)}`;
  bindCompareWorkspaceEvents(comparisonEl, entry);
  const defaultServiceId = getRequestedServices(entry)[0] || "";
  if (defaultServiceId) {
    void setActiveComparisonContext({
      historyId: Number(entry.id),
      serviceId: defaultServiceId
    });
  }
  openModal(historyModal, historyModalClose);
}
function closeHistoryModal() {
  void setActiveComparisonContext(null);
  if (historyModal) {
    closeModal(historyModal);
  }
}

// src/options/features/schedule-summary.ts
function normalizeFavoriteId(value) {
  return safeText(value).trim();
}
function getLatestScheduledFavoriteRun(historyItems = [], favoriteId) {
  const normalizedFavoriteId = normalizeFavoriteId(favoriteId);
  if (!normalizedFavoriteId) {
    return null;
  }
  return safeArray(historyItems).filter(
    (entry) => normalizeFavoriteId(entry?.originFavoriteId) === normalizedFavoriteId && entry?.trigger === "scheduled"
  ).sort((left, right) => Date.parse(String(right?.createdAt ?? "")) - Date.parse(String(left?.createdAt ?? "")))[0] ?? null;
}
function getRepresentativeFailure(entry) {
  const siteResults = entry?.siteResults && typeof entry.siteResults === "object" ? Object.values(entry.siteResults) : [];
  const counts = /* @__PURE__ */ new Map();
  const messages = /* @__PURE__ */ new Map();
  siteResults.forEach((result) => {
    const code2 = normalizeResultCode(result?.code);
    if (code2 === "submitted") {
      return;
    }
    counts.set(code2, (counts.get(code2) ?? 0) + 1);
    const message = safeText(result?.message).trim();
    if (message && !messages.has(code2)) {
      messages.set(code2, message);
    }
  });
  if (counts.size === 0) {
    const fallbackCount = normalizeSiteIdList(entry?.failedSiteIds).length;
    if (fallbackCount <= 0 && entry?.status !== "failed" && entry?.status !== "partial") {
      return null;
    }
    return {
      code: "unexpected_error",
      count: Math.max(1, fallbackCount),
      message: ""
    };
  }
  const [code, count] = [...counts.entries()].sort((left, right) => right[1] - left[1])[0];
  return {
    code,
    count,
    message: messages.get(code) ?? ""
  };
}
function buildScheduledFavoriteRunSummary(historyItems = [], favoriteId) {
  const latest = getLatestScheduledFavoriteRun(historyItems, favoriteId);
  if (!latest) {
    return null;
  }
  const representativeFailure = getRepresentativeFailure(latest);
  return {
    favoriteId: normalizeFavoriteId(favoriteId),
    createdAt: safeText(latest.createdAt),
    status: safeText(latest.status).trim() || "unknown",
    representativeCode: representativeFailure?.code ?? null,
    representativeMessage: representativeFailure?.message ?? "",
    representativeCount: representativeFailure?.count ?? 0
  };
}

// src/options/features/schedules/render.ts
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
function buildScheduledRunDetailMarkup(summary) {
  if (!summary?.representativeCode && !summary?.representativeMessage) {
    return "";
  }
  const codeLabel = summary?.representativeCode ? t.settings.resultCodeLabels[summary.representativeCode] || summary.representativeCode : "";
  const detailText = summary?.representativeMessage ? `${codeLabel ? `${codeLabel}: ` : ""}${summary.representativeMessage}` : codeLabel;
  if (!detailText) {
    return "";
  }
  return `
    <div class="schedule-result-detail">
      <strong>${escapeHTML(t.schedules.failureDetail)}</strong>
      <div>${escapeHTML(detailText)}</div>
    </div>
  `;
}
function buildFavoriteJobStatusMarkup(favoriteId) {
  const job = getActiveFavoriteRunJobByFavoriteId(state.favoriteJobs, favoriteId) || getLatestFavoriteRunJobByFavoriteId(state.favoriteJobs, favoriteId);
  if (!job?.jobId) {
    return "";
  }
  const statusLabel = job.status === "queued" ? chrome.i18n.getMessage("favorite_job_status_queued") || "Queued" : job.status === "running" ? chrome.i18n.getMessage("favorite_job_status_running") || "Running" : job.status === "completed" ? chrome.i18n.getMessage("favorite_job_status_completed") || "Done" : job.status === "failed" ? chrome.i18n.getMessage("favorite_job_status_failed") || "Failed" : chrome.i18n.getMessage("favorite_job_status_skipped") || "Skipped";
  const detail = job.stepCount > 1 ? `${Math.min(job.completedSteps, job.stepCount)}/${job.stepCount}` : "";
  return `
    <div class="schedule-job-status">
      <span class="status-pill ${escapeHTML(job.status)}">${escapeHTML(statusLabel)}</span>
      ${detail ? `<span>${escapeHTML(detail)}</span>` : ""}
    </div>
  `;
}
function renderSchedulesSection() {
  const scheduledFavorites = [...state.favorites].filter((favorite) => favorite?.scheduleEnabled || favorite?.scheduledAt).sort((left, right) => {
    const leftTime = Date.parse(String(left?.scheduledAt ?? "")) || Number.MAX_SAFE_INTEGER;
    const rightTime = Date.parse(String(right?.scheduledAt ?? "")) || Number.MAX_SAFE_INTEGER;
    return leftTime - rightTime;
  });
  if (scheduledFavorites.length === 0) {
    schedulesList.innerHTML = createEmptyState(t.schedules.empty);
    return;
  }
  schedulesList.innerHTML = scheduledFavorites.map((favorite) => {
    const scheduledRunSummary = buildScheduledFavoriteRunSummary(state.history, favorite.id);
    return `
        <article class="settings-control schedule-card" data-schedule-favorite-id="${escapeHTML(favorite.id)}">
          <div class="schedule-card-head">
            <div>
              <h3>${escapeHTML(favorite.title || previewText(favorite.text, 42))}</h3>
              <p>${escapeHTML(previewText(favorite.text, 88))}</p>
              ${buildFavoriteJobStatusMarkup(favorite.id)}
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
              <strong>${escapeHTML(t.schedules.lastScheduledRun)}</strong>
              <div>${escapeHTML(scheduledRunSummary?.createdAt ? formatDateTime(scheduledRunSummary.createdAt) : t.schedules.never)}</div>
            </div>
            <div>
              <strong>${escapeHTML(t.schedules.scheduledResult)}</strong>
              <div>${escapeHTML(scheduledRunSummary ? getStatusInfo(scheduledRunSummary.status).label : t.schedules.never)}</div>
            </div>
          </div>
          ${buildScheduledRunDetailMarkup(scheduledRunSummary)}
          <div class="schedule-card-actions">
            <button class="btn" type="button" data-action="run-schedule-favorite" data-favorite-id="${escapeHTML(favorite.id)}">${escapeHTML(t.schedules.runNow)}</button>
            <button class="btn ghost" type="button" data-action="open-schedule-favorite" data-favorite-id="${escapeHTML(favorite.id)}">${escapeHTML(t.schedules.openInPopup)}</button>
          </div>
        </article>
      `;
  }).join("");
}

// src/options/features/schedules/actions.ts
var { schedulesList: schedulesList2 } = optionsDom.schedules;
async function runFavoriteFromOptions(favoriteId) {
  const response = await sendRuntimeMessageWithTimeout({
    action: "favorite:run",
    favoriteId,
    trigger: "options",
    allowPopupFallback: true
  }, 5e3);
  if (response?.ok && response?.popupFallback) {
    setStatus(t.schedules.popupFallback, "success");
    showAppToast(t.schedules.popupFallback, "success", 2200);
    return;
  }
  if (response?.ok) {
    const message = response?.message ?? t.schedules.runQueued;
    setStatus(message, "success");
    showAppToast(message, "success", 2200);
    return;
  }
  throw new Error(response?.error ?? t.saveFailed);
}
async function openFavoriteInPopup(favoriteId) {
  const response = await sendRuntimeMessageWithTimeout({
    action: "favorite:openEditor",
    favoriteId,
    source: "options-edit"
  }, 5e3);
  if (!response?.ok) {
    throw new Error(response?.error ?? t.schedules.openFailed);
  }
  setStatus(t.schedules.openInPopup, "success");
  showAppToast(t.schedules.openInPopup, "success", 2e3);
}
function bindScheduleEvents({ reloadData }) {
  schedulesList2.addEventListener("change", (event) => {
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
  schedulesList2.addEventListener("click", (event) => {
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
var {
  servicesGrid,
  servicesHealthCenter,
  servicesRefreshHealthBtn,
  serviceGroupTitle,
  serviceGroupSaveBtn,
  serviceGroupsList
} = optionsDom.services;
var { servicesOpenManagerBtn } = optionsDom.services;
function getHealthStatus(snapshot) {
  if (snapshot?.selectorWarning) {
    return { label: t.services.healthWarning, tone: "danger" };
  }
  if (snapshot?.lastFailureAt && (!snapshot?.lastSuccessAt || Date.parse(snapshot.lastFailureAt) > Date.parse(snapshot.lastSuccessAt))) {
    return { label: snapshot.lastFailureCode || "Recent failure", tone: "warning" };
  }
  if (snapshot?.lastSuccessAt) {
    return { label: t.services.healthHealthy, tone: "success" };
  }
  return { label: t.services.healthNoRecentRun, tone: "muted" };
}
function renderServiceHealthCenter() {
  if (!servicesHealthCenter) {
    return;
  }
  if (!state.serviceHealthSnapshots?.length) {
    servicesHealthCenter.innerHTML = `<div class="empty-state">${escapeHTML(t.services.healthEmpty)}</div>`;
    return;
  }
  servicesHealthCenter.innerHTML = state.serviceHealthSnapshots.map((snapshot) => {
    const status = getHealthStatus(snapshot);
    const selector = snapshot.selectorWarning?.selector || "";
    const verified = snapshot.verification?.verifiedAt || snapshot.verification?.lastVerified || "";
    return `
      <article class="service-health-row" data-health-service="${escapeHTML(snapshot.serviceId)}">
        <div>
          <strong>${escapeHTML(snapshot.serviceName)}</strong>
          <div class="helper">
            ${escapeHTML(status.label)}
            ${snapshot.preferredStrategy ? ` · strategy: ${escapeHTML(snapshot.preferredStrategy)}` : ""}
            ${verified ? ` · verified: ${escapeHTML(formatDateTime(verified))}` : ""}
          </div>
          ${selector ? `<code class="inline-code">${escapeHTML(selector)}</code>` : ""}
        </div>
        <div class="settings-actions">
          <button class="btn ghost" type="button" data-health-action="login" data-service-id="${escapeHTML(snapshot.serviceId)}">${escapeHTML(t.services.healthLogin)}</button>
          <button class="btn ghost" type="button" data-health-action="retry" data-service-id="${escapeHTML(snapshot.serviceId)}">${escapeHTML(t.services.healthRetry)}</button>
          <button class="btn ghost" type="button" data-health-action="selector" data-service-id="${escapeHTML(snapshot.serviceId)}">${escapeHTML(t.services.healthSelectorCheck)}</button>
          <button class="btn ghost" type="button" data-health-action="new-tab" data-service-id="${escapeHTML(snapshot.serviceId)}">${escapeHTML(t.services.healthNewTab)}</button>
        </div>
      </article>
    `;
  }).join("");
}
function renderServiceGroups() {
  if (!serviceGroupsList) {
    return;
  }
  if (!state.serviceGroups?.length) {
    serviceGroupsList.innerHTML = `<div class="empty-state">${escapeHTML(t.services.groupEmpty)}</div>`;
    return;
  }
  serviceGroupsList.innerHTML = state.serviceGroups.map((group) => {
    const names = group.serviceIds.map((siteId) => state.runtimeSites.find((site) => site.id === siteId)?.name || siteId).join(", ");
    return `
      <article class="service-health-row">
        <div>
          <strong>${escapeHTML(group.title)}</strong>
          <div class="helper">${escapeHTML(names || t.services.groupNoServices)}</div>
        </div>
        <div class="settings-actions">
          <button class="btn ghost" type="button" data-group-select="${escapeHTML(group.id)}">${escapeHTML(t.services.groupCheckServices)}</button>
          <button class="btn danger ghost" type="button" data-group-delete="${escapeHTML(group.id)}">${escapeHTML(t.services.groupDelete)}</button>
        </div>
      </article>
    `;
  }).join("");
}
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
        <div class="settings-actions">
          <button class="btn ghost" type="button" data-move-site="${escapeHTML(site.id)}" data-direction="up" ${index === 0 ? "disabled" : ""}>${escapeHTML(t.services.moveUp)}</button>
          <button class="btn ghost" type="button" data-move-site="${escapeHTML(site.id)}" data-direction="down" ${index === state.runtimeSites.length - 1 ? "disabled" : ""}>${escapeHTML(t.services.moveDown)}</button>
        </div>
        <label class="checkbox-inline">
          <input type="checkbox" data-service-group-select="${escapeHTML(site.id)}" />
          <span>${escapeHTML(t.services.groupUseInGroup)}</span>
        </label>
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
  renderServiceHealthCenter();
  renderServiceGroups();
}
async function saveSiteWaitMs(siteId, waitMs) {
  await updateRuntimeSite(siteId, { waitMs: Number(waitMs) });
  state.runtimeSites = sortSitesByOrder(await getRuntimeSites(), state.settings.siteOrder);
  renderServiceFilterOptions();
  renderServicesSection();
  showAppToast(t.settings.waitSaved, "success", 1600);
}
async function refreshServiceHealth() {
  const response = await sendRuntimeMessageWithTimeout({ action: "service-health:get" }, 5e3, {
    ok: false,
    snapshots: []
  });
  state.serviceHealthSnapshots = response?.snapshots ?? [];
  renderServiceHealthCenter();
}
async function retryFailedService(serviceId) {
  const failedEntry = state.history.find((entry) => entry.failedSiteIds?.includes(serviceId));
  if (!failedEntry) {
    showAppToast(t.services.retryNoFailed, "warning", 2200);
    return;
  }
  const response = await sendRuntimeMessageWithTimeout({
    action: "broadcast",
    prompt: failedEntry.text,
    sites: [serviceId]
  }, 1e4);
  if (!response?.ok) {
    throw new Error(response?.error || "Retry could not be queued.");
  }
  showAppToast(t.services.retryQueued, "success", 1800);
}
async function saveCheckedServiceGroup() {
  const selectedIds = [...servicesGrid.querySelectorAll("[data-service-group-select]:checked")].map((input) => input.dataset.serviceGroupSelect).filter(Boolean);
  const title = serviceGroupTitle.value.trim() || `Group ${state.serviceGroups.length + 1}`;
  if (selectedIds.length === 0) {
    showAppToast(t.services.groupNeedsService, "warning", 2200);
    return;
  }
  const now = (/* @__PURE__ */ new Date()).toISOString();
  const existing = state.serviceGroups.find((group) => group.title === title);
  const nextGroup = {
    ...existing ?? {},
    id: existing?.id || `group-${Date.now()}`,
    title,
    serviceIds: selectedIds,
    sortOrder: existing?.sortOrder ?? state.serviceGroups.length,
    createdAt: existing?.createdAt || now,
    updatedAt: now
  };
  state.serviceGroups = await setServiceGroups([
    nextGroup,
    ...state.serviceGroups.filter((group) => group.id !== nextGroup.id)
  ]);
  renderServiceGroups();
  showAppToast(t.services.groupSaved, "success", 1600);
}
function moveRuntimeSite(siteId, direction) {
  const currentIndex = state.runtimeSites.findIndex((site) => site.id === siteId);
  if (currentIndex === -1) {
    return null;
  }
  const offset = direction === "up" ? -1 : 1;
  const nextIndex = currentIndex + offset;
  if (nextIndex < 0 || nextIndex >= state.runtimeSites.length) {
    return null;
  }
  const nextSites = [...state.runtimeSites];
  const [movedSite] = nextSites.splice(currentIndex, 1);
  nextSites.splice(nextIndex, 0, movedSite);
  return nextSites;
}
async function saveSiteOrder(siteId, direction) {
  const nextSites = moveRuntimeSite(siteId, direction);
  if (!nextSites) {
    return;
  }
  const nextSettings = await updateAppSettings({
    siteOrder: nextSites.map((site) => site.id)
  });
  state.settings = nextSettings;
  state.runtimeSites = nextSites;
  renderServiceFilterOptions();
  renderServicesSection();
  setStatus(t.services.orderSaved, "success");
  showAppToast(t.services.orderSaved, "success", 1600);
}
function bindServiceEvents() {
  servicesOpenManagerBtn.addEventListener("click", () => {
    const popupUrl = chrome.runtime.getURL("popup/popup.html#settings");
    void chrome.windows.create({
      url: popupUrl,
      type: "popup",
      width: 480,
      height: 760,
      focused: true
    }).catch(async (error) => {
      console.error("[AI Prompt Broadcaster] Failed to open popup manager window.", error);
      try {
        await chrome.tabs.create({ url: popupUrl });
      } catch (fallbackError) {
        console.error("[AI Prompt Broadcaster] Failed to open popup manager tab.", fallbackError);
        setStatus(t.services.openManagerFailed, "error");
        showAppToast(t.services.openManagerFailed, "error", 3e3);
      }
    });
  });
  servicesRefreshHealthBtn?.addEventListener("click", () => {
    void refreshServiceHealth().catch((error) => {
      console.error("[AI Prompt Broadcaster] Failed to refresh service health.", error);
      showAppToast(error?.message || t.services.healthRefreshFailed, "error", 3e3);
    });
  });
  serviceGroupSaveBtn?.addEventListener("click", () => {
    void saveCheckedServiceGroup().catch((error) => {
      console.error("[AI Prompt Broadcaster] Failed to save service group.", error);
      showAppToast(error?.message || "Service group save failed.", "error", 3e3);
    });
  });
  servicesHealthCenter?.addEventListener("click", (event) => {
    const button = event.target.closest("[data-health-action][data-service-id]");
    if (!button) {
      return;
    }
    const site = state.runtimeSites.find((entry) => entry.id === button.dataset.serviceId);
    if (!site) {
      return;
    }
    if (button.dataset.healthAction === "retry") {
      void retryFailedService(site.id).catch((error) => {
        console.error("[AI Prompt Broadcaster] Failed to retry service.", error);
        showAppToast(error?.message || t.services.retryFailed, "error", 3e3);
      });
      return;
    }
    if (button.dataset.healthAction === "selector") {
      void chrome.tabs.create({ url: site.url, active: true });
      showAppToast(t.services.selectorCheckHint, "info", 3e3);
      return;
    }
    void chrome.tabs.create({ url: site.url, active: true });
  });
  serviceGroupsList?.addEventListener("click", (event) => {
    const selectButton = event.target.closest("[data-group-select]");
    const deleteButton = event.target.closest("[data-group-delete]");
    if (selectButton) {
      const group = state.serviceGroups.find((entry) => entry.id === selectButton.dataset.groupSelect);
      const selected = new Set(group?.serviceIds ?? []);
      servicesGrid.querySelectorAll("[data-service-group-select]").forEach((input) => {
        input.checked = selected.has(input.dataset.serviceGroupSelect);
      });
      if (group && serviceGroupTitle) {
        serviceGroupTitle.value = group.title;
      }
      return;
    }
    if (deleteButton) {
      state.serviceGroups = state.serviceGroups.filter((entry) => entry.id !== deleteButton.dataset.groupDelete);
      void setServiceGroups(state.serviceGroups).then(() => {
        renderServiceGroups();
        showAppToast(t.services.groupDeleted, "success", 1600);
      });
    }
  });
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
  servicesGrid.addEventListener("click", (event) => {
    const moveButton = event.target.closest("[data-move-site][data-direction]");
    if (!moveButton) {
      return;
    }
    void saveSiteOrder(moveButton.dataset.moveSite, moveButton.dataset.direction).catch((error) => {
      console.error("[AI Prompt Broadcaster] Failed to save site order.", error);
      setStatus(error?.message ?? t.saveFailed, "error");
      showAppToast(error?.message ?? t.saveFailed, "error", 3e3);
    });
  });
}

// src/options/features/history/events.ts
var {
  historyServiceFilter: historyServiceFilter2,
  historyDateFrom,
  historyDateTo,
  historyExportCsv,
  historyTableWrap: historyTableWrap2,
  historySelectAll: historySelectAll2,
  historyDeleteSelected: historyDeleteSelected2,
  historyDeleteFiltered: historyDeleteFiltered2,
  historyDelete7d,
  historyDelete30d,
  historyDelete90d,
  historyPrevPage: historyPrevPage2,
  historyNextPage: historyNextPage2
} = optionsDom.history;
var { historyModal: historyModal2 } = optionsDom.modals;
async function refreshHistoryAfterMutation() {
  state.history = await getStoredPromptHistory();
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
  historySelectAll2.addEventListener("change", (event) => {
    const history = getVisibleFilteredHistory();
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
  historyPrevPage2.addEventListener("click", () => {
    state.historyPage = Math.max(1, state.historyPage - 1);
    renderHistoryTable();
  });
  historyNextPage2.addEventListener("click", () => {
    state.historyPage += 1;
    renderHistoryTable();
  });
  historyTableWrap2.addEventListener("click", (event) => {
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
    const detailButton = event.target.closest("[data-open-history-id]");
    if (detailButton) {
      openHistoryModal(detailButton.dataset.openHistoryId);
    }
  });
  registerModalCloseHandler(historyModal2, closeHistoryModal);
  historyDeleteSelected2.addEventListener("click", () => {
    showConfirmToast(t.history.deleteSelectedConfirm, async () => {
      await deleteSelectedHistoryRows([...state.selectedHistoryIds]);
    });
  });
  historyDeleteFiltered2.addEventListener("click", () => {
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

// src/shared/template/constants.ts
var TEMPLATE_VARIABLE_PATTERN = /{{\s*([^{}]+?)\s*}}/g;
var SYSTEM_TEMPLATE_VARIABLES = Object.freeze({
  date: "date",
  time: "time",
  weekday: "weekday",
  clipboard: "clipboard",
  url: "url",
  title: "title",
  selection: "selection",
  counter: "counter",
  random: "random"
});
var SYSTEM_TEMPLATE_DEFINITIONS = Object.freeze({
  [SYSTEM_TEMPLATE_VARIABLES.date]: {
    aliases: ["date", "날짜"],
    labels: { ko: "날짜", en: "date" }
  },
  [SYSTEM_TEMPLATE_VARIABLES.time]: {
    aliases: ["time", "시간"],
    labels: { ko: "시간", en: "time" }
  },
  [SYSTEM_TEMPLATE_VARIABLES.weekday]: {
    aliases: ["weekday", "요일"],
    labels: { ko: "요일", en: "weekday" }
  },
  [SYSTEM_TEMPLATE_VARIABLES.clipboard]: {
    aliases: ["clipboard", "클립보드"],
    labels: { ko: "클립보드", en: "clipboard" }
  },
  [SYSTEM_TEMPLATE_VARIABLES.url]: {
    aliases: ["url", "주소"],
    labels: { ko: "현재 탭 URL", en: "current tab URL" }
  },
  [SYSTEM_TEMPLATE_VARIABLES.title]: {
    aliases: ["title", "제목"],
    labels: { ko: "현재 탭 제목", en: "current tab title" }
  },
  [SYSTEM_TEMPLATE_VARIABLES.selection]: {
    aliases: ["selection", "선택"],
    labels: { ko: "선택한 텍스트", en: "selected text" }
  },
  [SYSTEM_TEMPLATE_VARIABLES.counter]: {
    aliases: ["counter", "카운터"],
    labels: { ko: "카운터", en: "counter" }
  },
  [SYSTEM_TEMPLATE_VARIABLES.random]: {
    aliases: ["random", "랜덤"],
    labels: { ko: "랜덤 숫자", en: "random number" }
  }
});
var SYSTEM_TEMPLATE_ALIAS_MAP = new Map(
  Object.entries(SYSTEM_TEMPLATE_DEFINITIONS).flatMap(
    ([canonicalName, definition]) => definition.aliases.map((alias) => [alias.toLowerCase(), canonicalName])
  )
);
var SYSTEM_TEMPLATE_KEYS = new Set(Object.keys(SYSTEM_TEMPLATE_DEFINITIONS));
var WEEKDAY_LOCALES = Object.freeze({
  ko: "ko-KR",
  en: "en-US"
});

// src/shared/template/normalize.ts
function normalizeTemplateVariableName(value) {
  return typeof value === "string" ? value.trim() : "";
}
function canonicalizeTemplateVariableName(value) {
  const normalizedValue = normalizeTemplateVariableName(value);
  if (!normalizedValue) {
    return "";
  }
  return SYSTEM_TEMPLATE_ALIAS_MAP.get(normalizedValue.toLowerCase()) ?? normalizedValue;
}
function normalizeTemplateValueRecord(values = {}) {
  if (!values || typeof values !== "object" || Array.isArray(values)) {
    return {};
  }
  return Object.fromEntries(
    Object.entries(values).map(([key, value]) => [
      canonicalizeTemplateVariableName(key),
      value
    ])
  );
}

// src/shared/template/render.ts
function renderTemplatePrompt(template, values = {}) {
  const source = typeof template === "string" ? template : "";
  const normalizedValues = normalizeTemplateValueRecord(values);
  return source.replace(TEMPLATE_VARIABLE_PATTERN, (_match, rawName) => {
    const normalizedName = normalizeTemplateVariableName(rawName);
    const canonicalName = canonicalizeTemplateVariableName(rawName);
    if (!normalizedName) {
      return "";
    }
    if (Object.prototype.hasOwnProperty.call(normalizedValues, canonicalName)) {
      return String(normalizedValues[canonicalName] ?? "");
    }
    if (Object.prototype.hasOwnProperty.call(normalizedValues, normalizedName)) {
      return String(normalizedValues[normalizedName] ?? "");
    }
    return `{{${normalizedName}}}`;
  });
}

// src/options/features/experiments.ts
var dom = optionsDom.experiments;
function parseVariantBlocks() {
  const raw = dom.experimentVariants?.value || "";
  return raw.split(/\n---+\n/g).map((text, index) => ({
    id: `variant-${index + 1}`,
    title: `Variant ${index + 1}`,
    text: text.trim()
  })).filter((variant) => variant.text);
}
function parseVariableSets() {
  const raw = dom.experimentVariables?.value.trim();
  if (!raw) {
    return [{ id: "vars-1", title: "Default", values: {} }];
  }
  try {
    const parsed = JSON.parse(raw);
    const entries = Array.isArray(parsed) ? parsed : [parsed];
    return entries.map((values, index) => ({
      id: `vars-${index + 1}`,
      title: `Variables ${index + 1}`,
      values: values && typeof values === "object" && !Array.isArray(values) ? Object.fromEntries(
        Object.entries(values).map(([key, value]) => [String(key), String(value ?? "")])
      ) : {}
    }));
  } catch (_error) {
    showAppToast(t.experiments.invalidVariables, "warning", 2600);
    return [{ id: "vars-1", title: "Default", values: {} }];
  }
}
function getSelectedTargetIds() {
  return Array.from(
    dom.experimentTargets?.querySelectorAll("[data-experiment-target]:checked") ?? []
  ).map((input) => input.dataset.experimentTarget ?? "").filter(Boolean);
}
function buildDraftExperiment(existingId = null) {
  return {
    id: existingId || state.activeExperimentId || void 0,
    title: dom.experimentTitle?.value.trim() || `Experiment ${state.promptExperiments.length + 1}`,
    description: "",
    variants: parseVariantBlocks(),
    targetSiteIds: getSelectedTargetIds(),
    variableSets: parseVariableSets()
  };
}
function buildPreviewItems(experiment) {
  return experiment.variants.flatMap(
    (variant) => experiment.variableSets.map((variableSet) => ({
      variant,
      variableSet,
      prompt: renderTemplatePrompt(variant.text, variableSet.values),
      targetSiteIds: experiment.targetSiteIds
    }))
  );
}
function getExperimentRunStats(experiment) {
  return getPromptExperimentRunStats(experiment);
}
function buildRunLimitMarkup(experiment) {
  const stats = getExperimentRunStats(experiment);
  const tone = stats.broadcastCount > EXPERIMENT_HARD_BROADCAST_LIMIT ? "error" : stats.broadcastCount > EXPERIMENT_SOFT_BROADCAST_LIMIT ? "warning" : "info";
  const label = t.experiments.runStats(
    stats.broadcastCount,
    stats.serviceSendCount,
    EXPERIMENT_SOFT_BROADCAST_LIMIT,
    EXPERIMENT_HARD_BROADCAST_LIMIT
  );
  return `<div class="helper experiment-run-limit ${tone}">${escapeHTML(label)}</div>`;
}
function renderExperimentTargets() {
  if (!dom.experimentTargets) {
    return;
  }
  const checked = new Set(getSelectedTargetIds());
  if (checked.size === 0) {
    state.runtimeSites.slice(0, 3).forEach((site) => checked.add(site.id));
  }
  dom.experimentTargets.innerHTML = state.runtimeSites.map((site) => `
    <label class="checkbox-inline">
      <input type="checkbox" data-experiment-target="${escapeHTML(site.id)}" ${checked.has(site.id) ? "checked" : ""} />
      <span>${escapeHTML(site.name)}</span>
    </label>
  `).join("");
}
function renderPreview() {
  const experiment = buildDraftExperiment();
  const items = buildPreviewItems(experiment);
  if (!dom.experimentPreviewOutput) {
    return;
  }
  dom.experimentPreviewOutput.innerHTML = items.length ? items.map((item) => `
      <article class="panel compact-panel">
        <strong>${escapeHTML(item.variant.title)} x ${escapeHTML(item.variableSet.title)}</strong>
        <div class="helper">${escapeHTML(item.targetSiteIds.join(", ") || t.experiments.noTargetServices)}</div>
        <pre class="modal-prompt">${escapeHTML(item.prompt)}</pre>
      </article>
    `).join("") : `<div class="empty-state">${escapeHTML(t.experiments.previewEmpty)}</div>`;
  if (items.length) {
    dom.experimentPreviewOutput.insertAdjacentHTML("afterbegin", buildRunLimitMarkup(experiment));
  }
}
function renderExperimentsSection() {
  if (!dom.experimentList) {
    return;
  }
  renderExperimentTargets();
  dom.experimentList.innerHTML = state.promptExperiments.length ? state.promptExperiments.map((experiment) => `
      <article class="panel compact-panel">
        <div class="section-head-row">
          <div>
            <h2>${escapeHTML(experiment.title)}</h2>
            <p>${escapeHTML(t.experiments.summary(
    experiment.variants.length,
    experiment.variableSets.length,
    experiment.targetSiteIds.length,
    experiment.runs.length,
    getExperimentRunStats(experiment).broadcastCount
  ))}</p>
          </div>
          <div class="settings-actions">
            <button class="btn ghost" type="button" data-experiment-load="${escapeHTML(experiment.id)}">${escapeHTML(t.experiments.load)}</button>
            <button class="btn primary" type="button" data-experiment-run="${escapeHTML(experiment.id)}">${escapeHTML(t.experiments.run)}</button>
            <button class="btn danger ghost" type="button" data-experiment-delete="${escapeHTML(experiment.id)}">${escapeHTML(t.experiments.delete)}</button>
          </div>
        </div>
      </article>
    `).join("") : `<div class="panel empty-state">${escapeHTML(t.experiments.empty)}</div>`;
}
async function saveDraftExperiment() {
  const draft = buildDraftExperiment();
  if (!draft.variants.length || !draft.targetSiteIds.length) {
    showAppToast(t.experiments.needsVariantAndTarget, "warning", 2600);
    return null;
  }
  const response = await sendRuntimeMessageWithTimeout({
    action: "experiment:save",
    experiment: draft
  }, 8e3);
  if (!response?.ok || !response.experiment) {
    throw new Error(response?.error || t.experiments.saveFailed);
  }
  const { experiment } = response;
  state.activeExperimentId = experiment.id;
  state.promptExperiments = [
    experiment,
    ...state.promptExperiments.filter((entry) => entry.id !== experiment.id)
  ];
  renderExperimentsSection();
  showAppToast(t.experiments.saveSuccess, "success", 1600);
  return experiment;
}
function confirmExperimentRun(experiment) {
  const stats = getExperimentRunStats(experiment);
  if (stats.broadcastCount > EXPERIMENT_HARD_BROADCAST_LIMIT) {
    showAppToast(
      t.experiments.hardLimit(stats.broadcastCount, EXPERIMENT_HARD_BROADCAST_LIMIT),
      "warning",
      4200
    );
    return false;
  }
  if (stats.broadcastCount > EXPERIMENT_SOFT_BROADCAST_LIMIT) {
    return window.confirm(
      t.experiments.confirmLarge(
        stats.broadcastCount,
        stats.serviceSendCount,
        EXPERIMENT_SOFT_BROADCAST_LIMIT
      )
    );
  }
  return true;
}
async function runExperiment(experimentId) {
  const experiment = state.promptExperiments.find((entry) => entry.id === experimentId);
  if (!experiment) {
    throw new Error(t.experiments.notFound);
  }
  const confirmedLargeRun = confirmExperimentRun(experiment);
  if (!confirmedLargeRun) {
    return;
  }
  const response = await sendRuntimeMessageWithTimeout({
    action: "experiment:run",
    experimentId,
    confirmedLargeRun
  }, 3e4);
  if (!response?.ok) {
    throw new Error(response?.error || t.experiments.runFailed);
  }
  if (response.experiment) {
    const updatedExperiment = response.experiment;
    state.promptExperiments = [
      updatedExperiment,
      ...state.promptExperiments.filter((entry) => entry.id !== updatedExperiment.id)
    ];
    renderExperimentsSection();
  }
  showAppToast(t.experiments.queued(response.queuedCount), "success", 2600);
}
function loadExperiment(experimentId) {
  const experiment = state.promptExperiments.find((entry) => entry.id === experimentId);
  if (!experiment) {
    return;
  }
  state.activeExperimentId = experiment.id;
  if (dom.experimentTitle) {
    dom.experimentTitle.value = experiment.title;
  }
  if (dom.experimentVariants) {
    dom.experimentVariants.value = experiment.variants.map((variant) => variant.text).join("\n---\n");
  }
  if (dom.experimentVariables) {
    dom.experimentVariables.value = JSON.stringify(
      experiment.variableSets.map((set) => set.values),
      null,
      2
    );
  }
  renderExperimentTargets();
  const selected = new Set(experiment.targetSiteIds);
  dom.experimentTargets?.querySelectorAll("[data-experiment-target]").forEach((input) => {
    input.checked = selected.has(input.dataset.experimentTarget ?? "");
  });
  renderPreview();
}
function bindExperimentEvents() {
  dom.experimentPreview?.addEventListener("click", renderPreview);
  dom.experimentSave?.addEventListener("click", () => {
    void saveDraftExperiment().catch((error) => {
      console.error("[AI Prompt Broadcaster] Failed to save experiment.", error);
      showAppToast(error?.message || t.experiments.saveFailed, "error", 3e3);
    });
  });
  dom.experimentRun?.addEventListener("click", () => {
    void (async () => {
      const experiment = await saveDraftExperiment();
      if (experiment) {
        await runExperiment(experiment.id);
      }
    })().catch((error) => {
      console.error("[AI Prompt Broadcaster] Failed to run experiment.", error);
      showAppToast(error?.message || t.experiments.runFailed, "error", 3e3);
    });
  });
  dom.experimentList?.addEventListener("click", (event) => {
    const target = event.target instanceof Element ? event.target : null;
    const loadButton = target?.closest("[data-experiment-load]");
    const runButton = target?.closest("[data-experiment-run]");
    const deleteButton = target?.closest("[data-experiment-delete]");
    if (loadButton) {
      loadExperiment(loadButton.dataset.experimentLoad ?? "");
      return;
    }
    if (runButton) {
      void runExperiment(runButton.dataset.experimentRun ?? "").catch((error) => {
        console.error("[AI Prompt Broadcaster] Failed to run experiment.", error);
        showAppToast(error?.message || t.experiments.runFailed, "error", 3e3);
      });
      return;
    }
    if (deleteButton) {
      void sendRuntimeMessageWithTimeout({
        action: "experiment:delete",
        experimentId: deleteButton.dataset.experimentDelete ?? ""
      }, 8e3).then((response) => {
        state.promptExperiments = response?.experiments ?? state.promptExperiments;
        renderExperimentsSection();
        showAppToast(t.experiments.deleteSuccess, "success", 1600);
      });
    }
  });
}

// src/options/features/template-packs.ts
var dom2 = optionsDom.settings;
function downloadJson(filename, payload) {
  const blob = new Blob([JSON.stringify(payload, null, 2)], {
    type: "application/json"
  });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}
function renderTemplatePacksSection() {
  if (!dom2.templatePackList) {
    return;
  }
  dom2.templatePackList.innerHTML = state.templatePacks.length ? state.templatePacks.map((pack) => `
      <article class="service-health-row">
        <div>
          <strong>${escapeHTML(pack.title)}</strong>
          <div class="helper">${pack.templates.length} templates · defaults ${pack.includeSensitiveDefaults ? escapeHTML(t.settings.templatePackDefaultsIncluded) : escapeHTML(t.settings.templatePackDefaultsRemoved)}</div>
        </div>
        <div class="settings-actions">
          <button class="btn ghost" type="button" data-pack-download="${escapeHTML(pack.id)}">${escapeHTML(t.settings.templatePackDownload)}</button>
        </div>
      </article>
    `).join("") : `<div class="empty-state">${escapeHTML(t.settings.templatePackEmpty)}</div>`;
}
async function exportTemplatePack() {
  const includeSensitiveDefaults = !(dom2.templatePackSensitive instanceof HTMLInputElement) || dom2.templatePackSensitive.checked !== false;
  const response = await sendRuntimeMessageWithTimeout({
    action: "template-pack:export",
    includeSensitiveDefaults
  }, 1e4);
  if (!response?.ok || !response.pack) {
    throw new Error(response?.error || t.settings.templatePackExportFailed);
  }
  const { pack } = response;
  state.templatePacks = [
    pack,
    ...state.templatePacks.filter((entry) => entry.id !== pack.id)
  ];
  renderTemplatePacksSection();
  downloadJson(`${pack.title.replace(/[\\/:*?"<>|]+/g, "-")}.json`, pack);
  showAppToast(t.settings.templatePackExported, "success", 1800);
}
async function importTemplatePack(file) {
  const text = await file.text();
  const pack = JSON.parse(text);
  const response = await sendRuntimeMessageWithTimeout({
    action: "template-pack:import",
    pack
  }, 1e4);
  if (!response?.ok || !response.pack) {
    throw new Error(response?.error || t.settings.templatePackImportFailed);
  }
  const { pack: importedPack } = response;
  state.templatePacks = [
    importedPack,
    ...state.templatePacks.filter((entry) => entry.id !== importedPack.id)
  ];
  renderTemplatePacksSection();
  showAppToast(
    t.settings.templatePackImported(
      response.importedFavoriteIds?.length ?? 0,
      response.skippedFavoriteIds?.length ?? 0
    ),
    "success",
    2600
  );
}
function bindTemplatePackEvents() {
  dom2.templatePackExport?.addEventListener("click", () => {
    void exportTemplatePack().catch((error) => {
      console.error("[AI Prompt Broadcaster] Failed to export template pack.", error);
      showAppToast(error?.message || t.settings.templatePackExportFailed, "error", 3e3);
    });
  });
  dom2.templatePackImport?.addEventListener("click", () => {
    dom2.templatePackImportInput?.click();
  });
  dom2.templatePackImportInput?.addEventListener("change", (event) => {
    const input = event.target instanceof HTMLInputElement ? event.target : null;
    const [file] = Array.from(input?.files ?? []);
    if (!file) {
      return;
    }
    void importTemplatePack(file).catch((error) => {
      console.error("[AI Prompt Broadcaster] Failed to import template pack.", error);
      showAppToast(error?.message || t.settings.templatePackImportFailed, "error", 3e3);
    }).finally(() => {
      if (input) {
        input.value = "";
      }
    });
  });
  dom2.templatePackList?.addEventListener("click", (event) => {
    const target = event.target instanceof Element ? event.target : null;
    const button = target?.closest("[data-pack-download]");
    if (!button) {
      return;
    }
    const pack = state.templatePacks.find((entry) => entry.id === button.dataset.packDownload);
    if (pack) {
      downloadJson(`${pack.title.replace(/[\\/:*?"<>|]+/g, "-")}.json`, pack);
    }
  });
}

// src/options/features/settings/danger-zone.ts
var { settingsResetData } = optionsDom.settings;
async function resetAllData(loadData2) {
  const response = await sendRuntimeMessageWithTimeout({ action: "resetAllData" }, 1e4);
  if (!response?.ok) {
    throw new Error(response?.error ?? t.settings.resetFailed);
  }
  await loadData2();
  state.historyPage = 1;
  setStatus(t.settings.resetSuccess, "success");
  showAppToast(t.settings.resetSuccess, "success", 1800);
}
function bindDangerZoneEvents({ loadData: loadData2 }) {
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
}

// src/options/features/settings/export-import.ts
var {
  settingsExportJson,
  settingsImportJson,
  settingsImportJsonInput
} = optionsDom.settings;
function downloadBlob2(filename, content, type) {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}
function getImportErrorSummary(error) {
  if (!error || typeof error !== "object" || !("importSummary" in error)) {
    return null;
  }
  return error.importSummary ?? null;
}
function bindExportImportEvents({ loadData: loadData2 }) {
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
      const importSummary = getImportErrorSummary(error);
      if (importSummary) {
        openImportReportModal(importSummary);
      }
      console.error("[AI Prompt Broadcaster] Failed to import JSON.", error);
      setStatus(t.settings.importFailed, "error");
      showAppToast(t.settings.importFailed, "error", 3e3);
    } finally {
      settingsImportJsonInput.value = "";
    }
  });
}

// src/options/features/settings/shortcuts.ts
var { shortcutList, openShortcutsBtn } = optionsDom.settings;
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
function bindShortcutEvents() {
  openShortcutsBtn.addEventListener("click", () => {
    void chrome.tabs.create({ url: "chrome://extensions/shortcuts" }).catch((error) => {
      console.error("[AI Prompt Broadcaster] Failed to open shortcuts page.", error);
      setStatus(error?.message ?? t.settings.shortcutsOpenFailed, "error");
      showAppToast(error?.message ?? t.settings.shortcutsOpenFailed, "error", 3e3);
    });
  });
}

// src/options/features/settings.ts
var {
  historyLimitSlider,
  historyLimitValue,
  historyLimitNote,
  autoCloseToggle,
  desktopNotificationToggle,
  reuseTabsToggle,
  reuseTabsSettingTitle,
  reuseTabsSettingDesc,
  waitMultiplierSettingTitle,
  waitMultiplierSlider,
  waitMultiplierSettingValue
} = optionsDom.settings;
var {
  historySelectAllLabel,
  historyDeleteSelected: historyDeleteSelected3,
  historyDeleteFiltered: historyDeleteFiltered3,
  historyDelete7d: historyDelete7d2,
  historyDelete30d: historyDelete30d2,
  historyDelete90d: historyDelete90d2
} = optionsDom.history;
function applySettingsToControls() {
  historyLimitSlider.value = String(state.settings.historyLimit);
  historyLimitValue.textContent = t.settings.historyLimitValue(state.settings.historyLimit);
  historyLimitNote.textContent = chrome.i18n.getMessage("options_settings_history_limit_note") || historyLimitNote.textContent;
  autoCloseToggle.checked = state.settings.autoClosePopup;
  desktopNotificationToggle.checked = state.settings.desktopNotifications;
  reuseTabsToggle.checked = state.settings.reuseExistingTabs;
  reuseTabsSettingTitle.textContent = t.settings.reuseTabsTitle;
  reuseTabsSettingDesc.textContent = t.settings.reuseTabsDesc;
  waitMultiplierSettingTitle.textContent = t.settings.waitMultiplierTitle;
  waitMultiplierSlider.value = String(state.settings.waitMsMultiplier);
  waitMultiplierSettingValue.textContent = t.settings.waitMultiplierValue(state.settings.waitMsMultiplier);
  historySelectAllLabel.textContent = t.history.selectAllLabel;
  historyDeleteSelected3.textContent = t.history.deleteSelected;
  historyDeleteFiltered3.textContent = t.history.deleteFiltered;
  historyDelete7d2.textContent = t.history.deleteOlderThan(7);
  historyDelete30d2.textContent = t.history.deleteOlderThan(30);
  historyDelete90d2.textContent = t.history.deleteOlderThan(90);
}
async function saveSettings(partialSettings) {
  const nextSettings = await updateAppSettings(partialSettings);
  state.settings = nextSettings;
  if (typeof partialSettings.historyLimit !== "undefined") {
    renderHistoryTable();
  }
  applySettingsToControls();
  setStatus(t.statusSaved, "success");
  showAppToast(t.statusSaved, "success", 1800);
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
  bindShortcutEvents();
  bindDangerZoneEvents({ loadData: loadData2 });
  bindExportImportEvents({ loadData: loadData2 });
}

// src/options/core/data.ts
async function loadData() {
  const [
    history,
    favorites,
    favoriteJobs,
    settings,
    runtimeSites,
    strategyStats,
    comparisonNotes,
    promptExperiments,
    templatePacks,
    serviceGroups,
    serviceHealth
  ] = await Promise.all([
    getStoredPromptHistory(),
    getPromptFavorites(),
    getFavoriteRunJobs(),
    getAppSettings(),
    getRuntimeSites(),
    getStrategyStats(),
    getComparisonNotes(),
    getPromptExperiments(),
    getTemplatePacks(),
    getServiceGroups(),
    sendRuntimeMessageWithTimeout({ action: "service-health:get" }, 5e3, {
      ok: false,
      snapshots: []
    })
  ]);
  state.history = history;
  state.favorites = favorites;
  state.favoriteJobs = favoriteJobs;
  state.strategyStats = strategyStats;
  state.comparisonNotes = comparisonNotes;
  state.promptExperiments = promptExperiments;
  state.templatePacks = templatePacks;
  state.serviceGroups = serviceGroups;
  state.serviceHealthSnapshots = serviceHealth?.snapshots ?? [];
  state.selectedHistoryIds.clear();
  state.runtimeSites = sortSitesByOrder(runtimeSites, settings.siteOrder);
  state.settings = settings;
  renderServiceFilterOptions();
  renderDashboard();
  renderHistoryTable();
  renderSchedulesSection();
  renderServicesSection();
  renderExperimentsSection();
  renderTemplatePacksSection();
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
  bindModalKeyboardEvents();
  bindNavigationEvents();
  bindHistoryEvents();
  bindExperimentEvents();
  bindScheduleEvents({ reloadData: loadData });
  bindSettingsEvents({ loadData });
  bindServiceEvents();
  bindTemplatePackEvents();
  bindStatusEvents();
  chrome.storage.onChanged.addListener((changes, areaName) => {
    if (areaName === "session" && changes.favoriteRunJobs) {
      void loadData().catch((error) => {
        console.error("[AI Prompt Broadcaster] Failed to refresh options page.", error);
        setStatus(error?.message ?? t.dataRefreshFailed, "error");
      });
      return;
    }
    if (areaName !== "local") {
      return;
    }
    if (changes.promptHistory || changes.promptFavorites || changes.comparisonNotes || changes.promptExperiments || changes.templatePacks || changes.serviceGroups || changes.appSettings || changes.templateVariableCache || changes.customSites || changes.builtInSiteStates || changes.builtInSiteOverrides) {
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
