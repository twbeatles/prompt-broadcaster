const uiLanguage = chrome.i18n.getUILanguage().toLowerCase();
export const isKorean = uiLanguage === "ko" || uiLanguage.startsWith("ko-");
export const locale = isKorean ? "ko-KR" : "en-US";

export function msg(key: string | undefined, substitutions?: string | string[]): string {
  if (!key) {
    return "";
  }

  return chrome.i18n.getMessage(key, substitutions) || "";
}

export function applyI18n(root: ParentNode = document): void {
  root.querySelectorAll<HTMLElement>("[data-i18n]").forEach((element) => {
    const value = msg(element.dataset.i18n);
    if (value) {
      element.textContent = value;
    }
  });

  root.querySelectorAll<HTMLElement>("[data-i18n-placeholder]").forEach((element) => {
    const value = msg(element.dataset.i18nPlaceholder);
    if (value) {
      element.setAttribute("placeholder", value);
    }
  });

  root.querySelectorAll<HTMLElement>("[data-i18n-title]").forEach((element) => {
    const value = msg(element.dataset.i18nTitle);
    if (value) {
      element.setAttribute("title", value);
    }
  });

  root.querySelectorAll<HTMLElement>("[data-i18n-aria-label]").forEach((element) => {
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
    bestStrategyLabel: msg("options_chart_best_strategy_label") || "Best strategy",
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
    pageInfo: (current: number, total: number) => msg("options_page_info", [String(current), String(total)]),
    exportSuccess: msg("options_settings_export_success"),
    exportFailed: msg("options_settings_export_failed"),
    selectAllLabel: msg("options_history_select_all") || "Select page",
    deleteSelected: msg("options_history_delete_selected") || "Delete selected",
    deleteFiltered: msg("options_history_delete_filtered") || "Delete filtered",
    deleteOlderThan: (days: number) => msg("options_history_delete_older_than", [String(days)]) || `Delete older than ${days}d`,
    deleteSelectedConfirm: msg("options_history_delete_selected_confirm") || "Delete the selected history items?",
    deleteFilteredConfirm: (count: number) => msg("options_history_delete_filtered_confirm", [String(count)]) || `Delete ${count} filtered history item(s)?`,
    deleteOlderConfirm: (days: number) => msg("options_history_delete_older_confirm", [String(days)]) || `Delete items older than ${days} days?`,
    deleteSuccess: msg("options_history_delete_success") || "History deleted.",
    openDetails: msg("options_history_open_details") || "Open details",
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
    healthDesc:
      msg("options_services_health_desc") ||
      "Track recent selector failures, auth gates, strategy hints, and verification metadata.",
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
    groupDesc:
      msg("options_service_groups_desc") ||
      "Create reusable target groups for popup favorites and experiment runs.",
    groupNamePlaceholder: msg("options_service_groups_name_placeholder") || "Group name",
    groupSave: msg("options_service_groups_save") || "Save group from checked services",
    groupEmpty: msg("options_service_groups_empty") || "No service groups yet.",
    groupNoServices: msg("options_service_groups_no_services") || "No services",
    groupCheckServices: msg("options_service_groups_check_services") || "Check services",
    groupDelete: msg("options_service_groups_delete") || "Delete",
    groupUseInGroup: msg("options_service_groups_use_in_group") || "Use in group",
    groupNeedsService:
      msg("options_service_groups_needs_service") || "Check at least one service for the group.",
    groupSaved: msg("options_service_groups_saved") || "Service group saved.",
    groupDeleted: msg("options_service_groups_deleted") || "Service group deleted.",
    retryNoFailed:
      msg("options_services_retry_no_failed") || "No failed history item found for this service.",
    retryQueued: msg("options_services_retry_queued") || "Retry queued for failed service.",
    retryFailed: msg("options_services_retry_failed") || "Retry failed.",
    selectorCheckHint:
      msg("options_services_selector_check_hint") ||
      "Open the service tab, then use the popup test action after login.",
    healthRefreshFailed:
      msg("options_services_health_refresh_failed") || "Service health refresh failed.",
  },
  experiments: {
    nav: msg("options_nav_experiments") || "Experiments",
    title: msg("options_experiments_title") || "Prompt Experiments",
    desc:
      msg("options_experiments_desc") ||
      "Preview and run variant x service x variable-set experiments through the normal broadcast history flow.",
    draft: msg("options_experiments_draft") || "Experiment draft",
    titlePlaceholder: msg("options_experiments_title_placeholder") || "Experiment title",
    variantsPlaceholder:
      msg("options_experiments_variants_placeholder") ||
      "One variant per block. Separate variants with a line containing ---",
    variablesPlaceholder:
      msg("options_experiments_variables_placeholder") ||
      'Variable sets as JSON array, e.g. [{"topic":"selectors"}]',
    preview: msg("options_experiments_preview") || "Preview",
    save: msg("options_experiments_save") || "Save",
    runSaved: msg("options_experiments_run_saved") || "Run saved experiment",
    load: msg("options_experiments_load") || "Load",
    run: msg("options_experiments_run") || "Run",
    delete: msg("options_experiments_delete") || "Delete",
    deleteSuccess: msg("options_experiments_delete_success") || "Experiment deleted.",
    empty: msg("options_experiments_empty") || "No saved experiments yet.",
    previewEmpty:
      msg("options_experiments_preview_empty") ||
      "Add variants and target services to preview combinations.",
    noTargetServices: msg("options_experiments_no_target_services") || "No target services",
    invalidVariables:
      msg("options_experiments_invalid_variables") ||
      "Variables JSON is invalid. Using an empty variable set.",
    needsVariantAndTarget:
      msg("options_experiments_needs_variant_target") ||
      "Experiment needs at least one variant and one target service.",
    saveSuccess: msg("options_experiments_save_success") || "Experiment saved.",
    saveFailed: msg("options_experiments_save_failed") || "Experiment save failed.",
    runFailed: msg("options_experiments_run_failed") || "Experiment run failed.",
    notFound: msg("options_experiments_not_found") || "Experiment not found.",
    queued: (count: number) =>
      msg("options_experiments_queued", [String(count)]) ||
      `Experiment queued: ${count} broadcasts.`,
    summary: (variants: number, variableSets: number, services: number, runs: number, broadcasts: number) =>
      msg("options_experiments_summary", [
        String(variants),
        String(variableSets),
        String(services),
        String(runs),
        String(broadcasts),
      ]) ||
      `${variants} variants · ${variableSets} variable sets · ${services} services · ${runs} runs · ${broadcasts} broadcasts`,
    runStats: (broadcasts: number, serviceSends: number, softLimit: number, hardLimit: number) =>
      msg("options_experiments_run_stats", [
        String(broadcasts),
        String(serviceSends),
        String(softLimit),
        String(hardLimit),
      ]) ||
      `${broadcasts} broadcasts, ${serviceSends} service sends. Confirmation starts above ${softLimit}; ${hardLimit} is the hard limit.`,
    confirmLarge: (broadcasts: number, serviceSends: number, softLimit: number) =>
      msg("options_experiments_confirm_large", [
        String(broadcasts),
        String(serviceSends),
        String(softLimit),
      ]) ||
      `Queue ${broadcasts} broadcasts (${serviceSends} service sends)? Runs above ${softLimit} need confirmation.`,
    hardLimit: (broadcasts: number, hardLimit: number) =>
      msg("options_experiments_hard_limit", [String(broadcasts), String(hardLimit)]) ||
      `This experiment has ${broadcasts} broadcasts. Split it into batches of ${hardLimit} or fewer.`,
  },
  comparison: {
    title: msg("options_comparison_title") || "Compare",
    ratingPlaceholder: msg("options_comparison_rating_placeholder") || "Rating",
    textPlaceholder:
      msg("options_comparison_text_placeholder") ||
      "Paste an AI response here, or select response text on a service tab and use the context menu.",
    saveNote: msg("options_comparison_save_note") || "Save note",
    captureNow: msg("options_comparison_capture_now") || "Capture now",
    saveSuccess: msg("options_comparison_save_success") || "Comparison note saved.",
    saveFailed: msg("options_comparison_save_failed") || "Comparison note save failed.",
    captureSuccess: msg("options_comparison_capture_success") || "Response captured.",
    captureNotFound: msg("options_comparison_capture_not_found") || "No visible assistant response was found.",
    captureFailed: msg("options_comparison_capture_failed") || "Capture failed.",
    deleteSuccess: msg("options_comparison_delete_success") || "Comparison note deleted.",
    empty: msg("options_comparison_empty") || "No saved comparison notes yet.",
    delete: msg("options_comparison_delete") || "Delete",
  },
  settings: {
    historyLimitValue: (count: number) => msg("options_settings_history_limit_value", [String(count)]),
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
      (value: number) => msg("options_settings_wait_multiplier_value", [String(Number(value).toFixed(1))]) || `${Number(value).toFixed(1)}x`,
    reuseTabsTitle:
      msg("options_settings_reuse_tabs_title") || "Reuse current-window AI tabs",
    reuseTabsDesc:
      msg("options_settings_reuse_tabs_desc") || "When enabled, matching open AI tabs are reused before opening a new one.",
    autoCaptureTitle:
      msg("options_settings_auto_capture") || "Save AI responses automatically",
    autoCaptureDesc:
      msg("options_settings_auto_capture_desc") || "After a send completes, save visible AI responses locally in history.",
    importReportTitle: msg("options_import_report_title") || "Import Details",
    importReportDesc: msg("options_import_report_desc") || "Review the imported items and any rejections.",
    importReportVersion: msg("options_import_report_version") || "Version",
    importReportAccepted: msg("options_import_report_accepted") || "Accepted services",
    importReportRewritten: msg("options_import_report_rewritten") || "Rewritten IDs",
    importReportBuiltins: msg("options_import_report_builtins") || "Built-in adjustments",
    importReportRejected: msg("options_import_report_rejected") || "Rejected services",
    importReportRejectedEmpty: msg("options_import_report_rejected_empty") || "No rejected services.",
    importRejectReason: (reason: string) => msg(`popup_import_reject_${reason}`) || reason,
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
    templatePacksTitle: msg("options_template_packs_title") || "Template packs",
    templatePacksDesc:
      msg("options_template_packs_desc") ||
      "Export/import favorites as reusable local packs. Sensitive template defaults are included unless unchecked.",
    templatePackSensitive:
      msg("options_template_pack_sensitive") || "Include template defaults",
    templatePackExport:
      msg("options_template_pack_export") || "Export current favorites as pack",
    templatePackImport: msg("options_template_pack_import") || "Import pack JSON",
    templatePackEmpty: msg("options_template_pack_empty") || "No template packs yet.",
    templatePackDownload: msg("options_template_pack_download") || "Download",
    templatePackDefaultsIncluded:
      msg("options_template_pack_defaults_included") || "included",
    templatePackDefaultsRemoved:
      msg("options_template_pack_defaults_removed") || "removed",
    templatePackExported:
      msg("options_template_pack_exported") || "Template pack exported.",
    templatePackExportFailed:
      msg("options_template_pack_export_failed") || "Template pack export failed.",
    templatePackImportFailed:
      msg("options_template_pack_import_failed") || "Template pack import failed.",
    templatePackImported: (imported: number, skipped: number) =>
      msg("options_template_pack_imported", [String(imported), String(skipped)]) ||
      `Imported ${imported}, skipped ${skipped} duplicates.`,
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
    quickPalette: msg("options_shortcut_quick_palette") || "Quick palette",
    unassigned: msg("options_shortcut_unassigned"),
    loadFailed: msg("options_shortcut_load_failed"),
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
    never: msg("options_schedules_never") || "Never",
  },
};
