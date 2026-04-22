import { getFavoriteRunJobs } from "../../../../shared/runtime-state";
import { isLastBroadcastSummary } from "../../../compose/send-flow";
import { state } from "../../state";
import type { PopupEventDeps } from "./deps";

export function bindRuntimeEvents(deps: PopupEventDeps) {
  chrome.tabs.onCreated.addListener(() => {
    deps.runtime.scheduleOpenSiteTabsRefresh();
  });

  chrome.tabs.onRemoved.addListener(() => {
    deps.runtime.scheduleOpenSiteTabsRefresh();
  });

  chrome.tabs.onUpdated.addListener((_tabId, changeInfo) => {
    if (
      changeInfo.status
      || typeof changeInfo.title === "string"
      || typeof changeInfo.url === "string"
    ) {
      deps.runtime.scheduleOpenSiteTabsRefresh();
    }
  });

  chrome.tabs.onActivated.addListener(() => {
    deps.runtime.scheduleOpenSiteTabsRefresh();
  });

  chrome.storage.onChanged.addListener((changes, areaName) => {
    if (areaName === "session") {
      if (changes.lastBroadcast) {
        const nextLastBroadcast = changes.lastBroadcast.newValue;
        deps.runtime.applyLastBroadcastState(
          isLastBroadcastSummary(nextLastBroadcast) ? nextLastBroadcast : null,
        );
      }

      if (changes.pendingUiToasts) {
        void deps.storage.flushPendingSessionToasts();
      }

      if (changes.favoriteRunJobs) {
        void getFavoriteRunJobs()
          .then((favoriteJobs) => {
            state.favoriteJobs = favoriteJobs;
            deps.lists.renderFavoritesList();
          })
          .catch((error) => {
            console.error(
              "[AI Prompt Broadcaster] Failed to refresh favorite jobs.",
              error,
            );
          });
      }

      return;
    }

    if (areaName !== "local") {
      return;
    }

    if (
      changes.promptHistory
      || changes.promptFavorites
      || changes.templateVariableCache
      || changes.appSettings
      || changes.customSites
      || changes.builtInSiteStates
      || changes.builtInSiteOverrides
      || changes.failedSelectors
    ) {
      void deps.storage.loadStoredData().catch((error) => {
        console.error("[AI Prompt Broadcaster] Storage change refresh failed.", error);
      });
    }
  });
}
