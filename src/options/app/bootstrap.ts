// @ts-nocheck
import { initToastRoot } from "../../popup/ui/toast";
import { applyI18n, isKorean, t } from "./i18n";
import { state } from "./state";
import { optionsDom } from "./dom";
import { loadData } from "../core/data";
import { bindModalKeyboardEvents } from "../core/modal";
import { bindNavigationEvents, switchSection } from "../core/navigation";
import { bindStatusEvents, setStatus, showAppToast } from "../core/status";
import { bindHistoryEvents } from "../features/history";
import { bindScheduleEvents } from "../features/schedules";
import { bindServiceEvents } from "../features/services";
import { bindSettingsEvents, renderShortcutList } from "../features/settings";

const { toastHost } = optionsDom;

function bindEvents() {
  bindModalKeyboardEvents();
  bindNavigationEvents();
  bindHistoryEvents();
  bindScheduleEvents({ reloadData: loadData });
  bindSettingsEvents({ loadData });
  bindServiceEvents();
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

    if (
      changes.promptHistory ||
      changes.promptFavorites ||
      changes.appSettings ||
      changes.templateVariableCache ||
      changes.customSites ||
      changes.builtInSiteStates ||
      changes.builtInSiteOverrides
    ) {
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
    showAppToast(error?.message ?? t.initFailed, "error", 3000);
  }
}

void init();
