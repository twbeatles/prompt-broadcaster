// @ts-nocheck
const uiLanguage = chrome.i18n.getUILanguage().toLowerCase();
export const isKorean = uiLanguage === "ko" || uiLanguage.startsWith("ko-");
export const locale = isKorean ? "ko-KR" : "en-US";

export function msg(key, substitutions) {
  return chrome.i18n.getMessage(key, substitutions) || "";
}

export function applyI18n(root = document) {
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

export const t = {
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
    charSuffix: msg("options_card_char_suffix"),
  },
  charts: {
    noUsage: msg("options_chart_no_usage"),
    noDaily: msg("options_chart_no_daily"),
    totalSent: msg("options_chart_total_sent"),
    donutAria: msg("options_chart_donut_aria"),
    barAria: msg("options_chart_bar_aria"),
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
    deleteSuccess: msg("options_history_delete_success") || "History deleted.",
  },
  services: {
    inputType: msg("options_service_input_type"),
    waitTime: msg("options_service_wait_time"),
    requestCount: msg("options_service_request_count"),
    successRate: msg("options_service_success_rate"),
    lastUsed: msg("options_service_last_used"),
    defaultColor: msg("options_service_default_color"),
    none: msg("options_value_none"),
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
    waitMultiplierTitle:
      msg("options_settings_wait_multiplier_title") || "Wait multiplier",
    waitMultiplierValue:
      (value) => msg("options_settings_wait_multiplier_value", [String(Number(value).toFixed(1))]) || `${Number(value).toFixed(1)}x`,
    reuseTabsTitle:
      msg("options_settings_reuse_tabs_title") || "Reuse current-window AI tabs",
    reuseTabsDesc:
      msg("options_settings_reuse_tabs_desc") || "When enabled, matching open AI tabs are reused before opening a new one.",
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
      unexpected_error: msg("result_code_unexpected_error") || "Unexpected error",
    },
  },
  statuses: {
    submitted: msg("options_status_complete"),
    partial: msg("options_status_partial"),
    failed: msg("options_status_failed"),
    unknown: msg("options_status_unknown"),
  },
  shortcuts: {
    openPopup: msg("options_shortcut_open_popup"),
    captureSelected: msg("options_shortcut_capture_selected"),
    unassigned: msg("options_shortcut_unassigned"),
    loadFailed: msg("options_shortcut_load_failed"),
  },
};
