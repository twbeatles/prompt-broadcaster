// @ts-nocheck
import { optionsDom } from "../../app/dom";
import { t } from "../../app/i18n";
import { setStatus, showAppToast } from "../../core/status";

const { shortcutList, openShortcutsBtn } = optionsDom.settings;

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

export function bindShortcutEvents() {
  openShortcutsBtn.addEventListener("click", () => {
    void chrome.tabs.create({ url: "chrome://extensions/shortcuts" }).catch((error) => {
      console.error("[AI Prompt Broadcaster] Failed to open shortcuts page.", error);
      setStatus(error?.message ?? t.settings.shortcutsOpenFailed, "error");
      showAppToast(error?.message ?? t.settings.shortcutsOpenFailed, "error", 3000);
    });
  });
}
