// @ts-nocheck
import { t } from "../../app/i18n";
import { state } from "../../app/state";
import { setStatus, showAppToast } from "../../core/status";
import {
  deleteServiceGroup,
  saveCheckedServiceGroup,
  selectServiceGroup,
} from "./groups";
import {
  refreshServiceHealth,
  retryFailedService,
} from "./health";
import { saveSiteOrder, saveSiteWaitMs } from "./ordering";
import {
  serviceGroupSaveBtn,
  serviceGroupsList,
  servicesGrid,
  servicesHealthCenter,
  servicesOpenManagerBtn,
  servicesRefreshHealthBtn,
} from "./dom";

export function bindServiceEvents() {
  servicesOpenManagerBtn.addEventListener("click", () => {
    const popupUrl = chrome.runtime.getURL("popup/popup.html#settings");
    void chrome.windows.create({
      url: popupUrl,
      type: "popup",
      width: 480,
      height: 760,
      focused: true,
    }).catch(async (error) => {
      console.error("[AI Prompt Broadcaster] Failed to open popup manager window.", error);
      try {
        await chrome.tabs.create({ url: popupUrl });
      } catch (fallbackError) {
        console.error("[AI Prompt Broadcaster] Failed to open popup manager tab.", fallbackError);
        setStatus(t.services.openManagerFailed, "error");
        showAppToast(t.services.openManagerFailed, "error", 3000);
      }
    });
  });

  servicesRefreshHealthBtn?.addEventListener("click", () => {
    void refreshServiceHealth().catch((error) => {
      console.error("[AI Prompt Broadcaster] Failed to refresh service health.", error);
      showAppToast(error?.message || t.services.healthRefreshFailed, "error", 3000);
    });
  });

  serviceGroupSaveBtn?.addEventListener("click", () => {
    void saveCheckedServiceGroup().catch((error) => {
      console.error("[AI Prompt Broadcaster] Failed to save service group.", error);
      showAppToast(error?.message || "Service group save failed.", "error", 3000);
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
        showAppToast(error?.message || t.services.retryFailed, "error", 3000);
      });
      return;
    }

    if (button.dataset.healthAction === "selector") {
      void chrome.tabs.create({ url: site.url, active: true });
      showAppToast(t.services.selectorCheckHint, "info", 3000);
      return;
    }

    void chrome.tabs.create({ url: site.url, active: true });
  });

  serviceGroupsList?.addEventListener("click", (event) => {
    const selectButton = event.target.closest("[data-group-select]");
    const deleteButton = event.target.closest("[data-group-delete]");

    if (selectButton) {
      selectServiceGroup(selectButton.dataset.groupSelect);
      return;
    }

    if (deleteButton) {
      void deleteServiceGroup(deleteButton.dataset.groupDelete);
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
      showAppToast(error?.message ?? t.saveFailed, "error", 3000);
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
      showAppToast(error?.message ?? t.saveFailed, "error", 3000);
    });
  });
}
