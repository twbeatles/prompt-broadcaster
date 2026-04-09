// @ts-nocheck
import { sendRuntimeMessageWithTimeout } from "../../shared/chrome/messaging";
import {
  exportPromptData,
  importPromptData,
  updateAppSettings,
} from "../../shared/prompts";
import { optionsDom } from "../app/dom";
import { t } from "../app/i18n";
import { state } from "../app/state";
import { buildImportSummaryText } from "../app/helpers";
import { renderDashboard } from "./dashboard";
import { renderHistoryTable } from "./history";
import { renderServicesSection } from "./services";
import { openImportReportModal, setStatus, showAppToast, showConfirmToast } from "../core/status";

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
  shortcutList,
  openShortcutsBtn,
  settingsResetData,
  settingsExportJson,
  settingsImportJson,
  settingsImportJsonInput,
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

export async function renderShortcutList() {
  try {
    const commands = await chrome.commands.getAll();
    const commandMap = new Map(commands.map((command) => [command.name, command]));
    const relevantNames = ["_execute_action", "capture-selected-text", "quick-palette"];

    shortcutList.innerHTML = relevantNames
      .map((commandName) => {
        const command = commandMap.get(commandName);
        const shortcutText = command?.shortcut?.trim() || t.shortcuts.unassigned;
        return `<div>${getShortcutDisplayName(commandName)}: <strong>${shortcutText}</strong></div>`;
      })
      .join("");
  } catch (error) {
    console.error("[AI Prompt Broadcaster] Failed to load shortcuts.", error);
    shortcutList.textContent = t.shortcuts.loadFailed;
  }
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

async function resetAllData(loadData) {
  const response = await sendRuntimeMessageWithTimeout({ action: "resetAllData" }, 10000);
  if (!response?.ok) {
    throw new Error(response?.error ?? t.settings.resetFailed);
  }

  await loadData();
  state.historyPage = 1;
  setStatus(t.settings.resetSuccess, "success");
  showAppToast(t.settings.resetSuccess, "success", 1800);
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

  settingsResetData.addEventListener("click", () => {
    showConfirmToast(t.settings.resetConfirm, async () => {
      try {
        await resetAllData(loadData);
      } catch (error) {
        console.error("[AI Prompt Broadcaster] Failed to reset data.", error);
        setStatus(error?.message ?? t.settings.resetFailed, "error");
        showAppToast(error?.message ?? t.settings.resetFailed, "error", 3000);
      }
    });
  });

  openShortcutsBtn.addEventListener("click", () => {
    void chrome.tabs.create({ url: "chrome://extensions/shortcuts" }).catch((error) => {
      console.error("[AI Prompt Broadcaster] Failed to open shortcuts page.", error);
      setStatus(error?.message ?? t.settings.shortcutsOpenFailed, "error");
      showAppToast(error?.message ?? t.settings.shortcutsOpenFailed, "error", 3000);
    });
  });

  settingsExportJson.addEventListener("click", async () => {
    try {
      const payload = await exportPromptData();
      downloadBlob(
        `ai-prompt-broadcaster-${new Date().toISOString().replace(/[:.]/g, "-")}.json`,
        JSON.stringify(payload, null, 2),
        "application/json",
      );
      setStatus(t.settings.exportSuccess, "success");
      showAppToast(t.settings.exportSuccess, "success", 1800);
    } catch (error) {
      console.error("[AI Prompt Broadcaster] Failed to export JSON.", error);
      setStatus(error?.message ?? t.settings.exportFailed, "error");
      showAppToast(error?.message ?? t.settings.exportFailed, "error", 3000);
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
      await loadData();
      setStatus(buildImportSummaryText(result.importSummary), "success");
      showAppToast(buildImportSummaryText(result.importSummary, { short: true }), "success", 2600);
      openImportReportModal(result.importSummary);
    } catch (error) {
      console.error("[AI Prompt Broadcaster] Failed to import JSON.", error);
      setStatus(error?.message ?? t.settings.importFailed, "error");
      showAppToast(error?.message ?? t.settings.importFailed, "error", 3000);
    } finally {
      settingsImportJsonInput.value = "";
    }
  });
}
