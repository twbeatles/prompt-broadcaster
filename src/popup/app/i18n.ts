// @ts-nocheck
export const uiLanguage = chrome.i18n.getUILanguage().toLowerCase();
export const isKorean = uiLanguage === "ko" || uiLanguage.startsWith("ko-");

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

  root.querySelectorAll("[data-i18n-aria-label]").forEach((element) => {
    const value = msg(element.dataset.i18nAriaLabel);
    if (value) {
      element.setAttribute("aria-label", value);
    }
  });
}

export const t = {
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
  stopSending: msg("popup_stop_sending") || "Stop",
  broadcastCancelled: msg("popup_broadcast_cancelled") || "Broadcast cancelled.",
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
  favoriteDuplicated: msg("popup_favorite_duplicated") || "Favorite duplicated.",
  favoriteDuplicate: msg("popup_favorite_duplicate") || "Duplicate",
  favoriteDuplicatePrefix: msg("popup_favorite_duplicate_prefix") || "[Copy]",
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
  historyResend: msg("popup_history_resend") || "Resend",
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
  favoriteModalSaveChanges: msg("popup_favorite_modal_save_changes") || "Save changes",
  favoriteEditTitle: msg("popup_favorite_edit_title") || "Edit favorite",
  favoriteEditDesc: msg("popup_favorite_edit_desc") || "Update targets, defaults, chain steps, and schedule settings.",
  favoriteTitleLabel: msg("popup_favorite_title_label"),
  favoriteModeLabel: msg("popup_favorite_mode_label") || "Favorite type",
  favoriteModeSingle: msg("popup_favorite_mode_single") || "Single prompt",
  favoriteModeChain: msg("popup_favorite_mode_chain") || "Chain",
  favoritePromptLabel: msg("popup_favorite_prompt_label") || "Prompt",
  favoriteTargetsLabel: msg("popup_favorite_targets_label") || "Default target services",
  favoriteTagsLabel: msg("popup_favorite_tags_label") || "Tags",
  favoriteFolderLabel: msg("popup_favorite_folder_label") || "Folder",
  favoritePinnedLabel: msg("popup_favorite_pinned_label") || "Pin this favorite",
  favoriteScheduleEnabledLabel: msg("popup_favorite_schedule_enabled_label") || "Enable scheduled run",
  favoriteScheduledAtLabel: msg("popup_favorite_scheduled_at_label") || "Next run time",
  favoriteScheduleRepeatLabel: msg("popup_favorite_schedule_repeat_label") || "Repeat",
  favoriteScheduleRepeatNone: msg("popup_favorite_schedule_repeat_none") || "One time",
  favoriteScheduleRepeatDaily: msg("popup_favorite_schedule_repeat_daily") || "Daily",
  favoriteScheduleRepeatWeekday: msg("popup_favorite_schedule_repeat_weekday") || "Weekdays",
  favoriteScheduleRepeatWeekly: msg("popup_favorite_schedule_repeat_weekly") || "Weekly",
  favoriteSaveDefaultsLabel: msg("popup_favorite_save_defaults_label"),
  favoriteDefaultsLabel: msg("popup_favorite_defaults_label"),
  favoriteChainTitle: msg("popup_favorite_chain_title") || "Chain steps",
  favoriteChainDesc: msg("popup_favorite_chain_desc") || "Each step runs in order and stops the chain if any step fails.",
  favoriteChainAddStep: msg("popup_favorite_chain_add_step") || "Add step",
  favoriteStepLabel: (index) => msg("popup_favorite_step_label", [String(index)]) || `Step ${index}`,
  favoriteStepMoveUp: msg("popup_favorite_step_move_up") || "Move up",
  favoriteStepMoveDown: msg("popup_favorite_step_move_down") || "Move down",
  favoriteStepPromptLabel: msg("popup_favorite_step_prompt_label") || "Prompt",
  favoriteStepDelayLabel: msg("popup_favorite_step_delay_label") || "Delay after previous step (ms)",
  favoriteStepTargetsLabel: msg("popup_favorite_step_targets_label") || "Override targets",
  favoriteStepTargetsHint: msg("popup_favorite_step_targets_hint") || "Leave empty to use the favorite default targets.",
  favoriteRunNow: msg("popup_favorite_run_now") || "Run now",
  favoriteRunQueued: msg("popup_favorite_run_queued") || "Favorite run queued.",
  favoriteRunNeedsEditor: msg("popup_favorite_run_needs_editor") || "This favorite needs more input before it can run.",
  favoriteScheduleDateRequired: msg("popup_favorite_schedule_date_required") || "Choose the next run time for this schedule.",
  favoriteChainNeedsStep: msg("popup_favorite_chain_needs_step") || "Add at least one non-empty chain step.",
  favoriteKindSingle: msg("popup_favorite_kind_single") || "Single",
  favoriteKindChain: msg("popup_favorite_kind_chain") || "Chain",
  favoriteScheduledBadge: msg("popup_favorite_scheduled_badge") || "Scheduled",
  favoriteStepCount: (count) => msg("popup_favorite_step_count", [String(count)]) || `${count} steps`,
  favoriteEdit: msg("popup_favorite_edit") || "Edit",
  clearPrompt: msg("popup_clear_prompt") || "Clear",
  promptCounter: (current) => isKorean ? `${current}자` : `${current} chars`,
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
  serviceFieldAdvanced: msg("popup_service_field_advanced") || "Advanced Settings",
  serviceFieldFallbackSelectors: msg("popup_service_field_fallback_selectors") || "Fallback Selectors",
  serviceFieldAuthSelectors: msg("popup_service_field_auth_selectors") || "Auth Selectors",
  serviceFieldHostnameAliases: msg("popup_service_field_hostname_aliases") || "Hostname Aliases",
  serviceFieldVerifiedAt: msg("popup_service_field_verified_at") || "Verified Date",
  serviceFieldVerifiedRoute: msg("popup_service_field_verified_route") || "Verified Route",
  serviceFieldVerifiedAuthState: msg("popup_service_field_verified_auth_state") || "Verified Auth State",
  serviceFieldVerifiedLocale: msg("popup_service_field_verified_locale") || "Verified Locale",
  serviceFieldVerifiedVersion: msg("popup_service_field_verified_version") || "Verified Version",
  serviceVerifiedAuthStateUnknown:
    msg("popup_service_verified_auth_state_unknown") || "Unknown",
  serviceVerifiedAuthStateLoggedIn:
    msg("popup_service_verified_auth_state_logged_in") || "logged-in",
  serviceVerifiedAuthStateLoggedOut:
    msg("popup_service_verified_auth_state_logged_out") || "logged-out",
  serviceVerifiedAuthStateSoftGated:
    msg("popup_service_verified_auth_state_soft_gated") || "soft-gated",
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
  historySortLatest: msg("popup_history_sort_latest") || "Latest",
  historySortOldest: msg("popup_history_sort_oldest") || "Oldest",
  historySortMostSuccess: msg("popup_history_sort_most_success") || "Most success",
  historySortMostFailure: msg("popup_history_sort_most_failure") || "Most failure",
  favoriteSortRecentUsed: msg("popup_favorite_sort_recent_used") || "Recent use",
  favoriteSortUsageCount: msg("popup_favorite_sort_usage_count") || "Usage count",
  favoriteSortTitle: msg("popup_favorite_sort_title") || "Title",
  favoriteSortCreatedAt: msg("popup_favorite_sort_created_at") || "Created date",
  waitMultiplierLabel: msg("popup_wait_multiplier_label") || "Wait multiplier",
  waitMultiplierValue: (value) => msg("popup_wait_multiplier_value", [String(Number(value).toFixed(1))]) || `${Number(value).toFixed(1)}x`,
  resendModalTitle: msg("popup_resend_modal_title") || "Resend History Item",
  resendModalDesc: msg("popup_resend_modal_desc") || "Choose which services to resend this prompt to.",
  resendModalCancel: msg("popup_resend_modal_cancel") || "Cancel",
  resendModalConfirm: msg("popup_resend_modal_confirm") || "Resend",
  resendSiteUnavailable: msg("popup_resend_site_unavailable") || "Unavailable",
  importReportTitle: msg("popup_import_report_title") || "Import Details",
  importReportDesc: msg("popup_import_report_desc") || "Review accepted, rewritten, and rejected items from this import.",
  importReportClose: msg("popup_import_report_close") || "Close",
  importReportVersion: msg("popup_import_report_version") || "Version",
  importReportAccepted: msg("popup_import_report_accepted") || "Accepted services",
  importReportRewritten: msg("popup_import_report_rewritten") || "Rewritten IDs",
  importReportBuiltins: msg("popup_import_report_builtins") || "Built-in adjustments",
  importReportRejected: msg("popup_import_report_rejected") || "Rejected services",
  importReportRejectedEmpty: msg("popup_import_report_rejected_empty") || "No rejected services.",
  importRejectReason: (reason) => msg(`popup_import_reject_${reason}`) || reason,
  ariaSelected: msg("popup_aria_selected") || "selected",
  ariaNotSelected: msg("popup_aria_not_selected") || "not selected",
  reuseTabsLabel:
    msg("popup_reuse_tabs_label") || "Reuse open AI tabs in the current window by default",
  reuseTabsDescEnabled:
    msg("popup_reuse_tabs_desc_enabled") || "When no tab is chosen explicitly, the broadcaster reuses a matching open AI tab before opening a new one.",
  reuseTabsDescDisabled:
    msg("popup_reuse_tabs_desc_disabled") || "When no tab is chosen explicitly, the broadcaster always opens a fresh tab.",
  openTabsTitle: (count) =>
    msg("popup_open_tabs_title", [String(count)]) || `${count} open tab${count === 1 ? "" : "s"}`,
  openTabsUseDefault:
    msg("popup_open_tabs_use_default") || "Use default behavior",
  openTabsUseDefaultDetail: (modeLabel) =>
    msg("popup_open_tabs_use_default_detail", [String(modeLabel)]) || `Current setting: ${modeLabel}`,
  openTabsDefaultReuse:
    msg("popup_open_tabs_default_reuse") || "reuse a matching tab",
  openTabsDefaultNew:
    msg("popup_open_tabs_default_new") || "open a new tab",
  openTabsAlwaysNew:
    msg("popup_open_tabs_always_new") || "Always open a new tab",
  openTabsAlwaysNewDetail:
    msg("popup_open_tabs_always_new_detail") || "Ignore matching open tabs for this service only.",
  openTabsActive:
    msg("popup_open_tabs_active") || "Active",
  openTabsReady:
    msg("popup_open_tabs_ready") || "Ready",
  openTabsLoading:
    msg("popup_open_tabs_loading") || "Loading",
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
};

export function getUnknownErrorText() {
  return msg("popup_unknown_error");
}

export function buildImportSummaryText(summary, { short = false } = {}) {
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
    const parts = [
      `가져오기 완료: 커스텀 서비스 ${acceptedCount}개 적용`,
      rejectedCount > 0 ? `건너뜀 ${rejectedCount}개` : "",
      rewrittenCount > 0 ? `ID 재작성 ${rewrittenCount}개` : "",
      deniedCount > 0 ? `권한 거부 ${deniedCount}개` : "",
    ].filter(Boolean);

    if (!short && overrideAdjustedCount + overrideDroppedCount + stateDroppedCount > 0) {
      parts.push(
        `기본 서비스 보정 ${overrideAdjustedCount + overrideDroppedCount + stateDroppedCount}개`
      );
    }

    return parts.join(", ");
  }

  const parts = [
    `Import complete: ${acceptedCount} custom service(s) applied`,
    rejectedCount > 0 ? `${rejectedCount} skipped` : "",
    rewrittenCount > 0 ? `${rewrittenCount} id rewrite(s)` : "",
    deniedCount > 0 ? `${deniedCount} permission denial(s)` : "",
  ].filter(Boolean);

  if (!short && overrideAdjustedCount + overrideDroppedCount + stateDroppedCount > 0) {
    parts.push(
      `${overrideAdjustedCount + overrideDroppedCount + stateDroppedCount} built-in adjustment(s)`
    );
  }

  return parts.join(", ");
}

export function buildServiceTestResultMessage(response) {
  if (!response?.ok) {
    if (response?.reason === "validation_failed") {
      return {
        message: response.error || t.serviceValidationError,
        isError: true,
      };
    }

    if (response?.reason === "no_tab") {
      return {
        message: t.serviceTestNoTab,
        isError: true,
      };
    }

    if (response?.reason === "invalid_tab") {
      return {
        message: t.serviceTestInvalidTab,
        isError: true,
      };
    }

    return {
      message: t.serviceTestError(response?.error ?? getUnknownErrorText()),
      isError: true,
    };
  }

  if (!response?.input?.found) {
    return {
      message: `❌ ${t.serviceTestFail}`,
      isError: true,
    };
  }

  const lines = [];
  let isError = false;

  if (response.input.typeMatches === false) {
    isError = true;
    lines.push(
      isKorean
        ? `⚠ 입력창은 찾았지만 타입이 다릅니다. 실제: ${response.input.actualType}, 기대: ${response.input.expectedType}`
        : `⚠ Input found but type mismatched. Actual: ${response.input.actualType}, expected: ${response.input.expectedType}`
    );
  } else {
    lines.push(`✅ ${t.serviceTestSuccess(response.input.actualType)}`);
  }

  if (response?.submit?.status === "ok") {
    lines.push(
      isKorean ? "✅ 전송 버튼도 확인했습니다." : "✅ Submit target was also found."
    );
  } else if (response?.submit?.status === "missing") {
    isError = true;
    lines.push(
      isKorean
        ? "❌ 임시 probe 입력 후에도 전송 버튼을 찾지 못했습니다."
        : "❌ Submit selector was not found after the temporary probe."
    );
  } else if (response?.submit?.method) {
    lines.push(
      isKorean
        ? `ℹ ${response.submit.method} 전송 방식이라 버튼 검사는 건너뛰었습니다.`
        : `ℹ Submit-button validation was skipped for ${response.submit.method} submit.`
    );
  }

  return {
    message: lines.join("\n"),
    isError,
  };
}
