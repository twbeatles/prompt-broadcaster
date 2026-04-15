// @ts-nocheck
import { updateAppSettings } from "../../shared/prompts";
import { optionsDom } from "../app/dom";
import { t } from "../app/i18n";
import { state } from "../app/state";
import { renderHistoryTable } from "./history";
import { setStatus, showAppToast } from "../core/status";
import { bindDangerZoneEvents } from "./settings/danger-zone";
import { bindExportImportEvents } from "./settings/export-import";
import { bindShortcutEvents, renderShortcutList } from "./settings/shortcuts";

const {
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
  waitMultiplierSettingValue,
} = optionsDom.settings;
const {
  historySelectAllLabel,
  historyDeleteSelected,
  historyDeleteFiltered,
  historyDelete7d,
  historyDelete30d,
  historyDelete90d,
} = optionsDom.history;

export function applySettingsToControls() {
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
  historyDeleteSelected.textContent = t.history.deleteSelected;
  historyDeleteFiltered.textContent = t.history.deleteFiltered;
  historyDelete7d.textContent = t.history.deleteOlderThan(7);
  historyDelete30d.textContent = t.history.deleteOlderThan(30);
  historyDelete90d.textContent = t.history.deleteOlderThan(90);
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

export { renderShortcutList };

export function bindSettingsEvents({ loadData }) {
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
      showAppToast(error?.message ?? t.saveFailed, "error", 3000);
    });
  });

  reuseTabsToggle.addEventListener("change", (event) => {
    void saveSettings({ reuseExistingTabs: event.target.checked }).catch((error) => {
      console.error("[AI Prompt Broadcaster] Failed to save tab reuse setting.", error);
      setStatus(error?.message ?? t.saveFailed, "error");
      showAppToast(error?.message ?? t.saveFailed, "error", 3000);
    });
  });

  waitMultiplierSlider.addEventListener("input", (event) => {
    waitMultiplierSettingValue.textContent = t.settings.waitMultiplierValue(event.target.value);
  });

  waitMultiplierSlider.addEventListener("change", (event) => {
    void saveSettings({ waitMsMultiplier: Number(event.target.value) }).catch((error) => {
      console.error("[AI Prompt Broadcaster] Failed to save wait multiplier.", error);
      setStatus(error?.message ?? t.saveFailed, "error");
      showAppToast(error?.message ?? t.saveFailed, "error", 3000);
    });
  });

  bindShortcutEvents();
  bindDangerZoneEvents({ loadData });
  bindExportImportEvents({ loadData });
}
