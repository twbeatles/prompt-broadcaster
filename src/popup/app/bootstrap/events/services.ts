import { resetSiteSettings, setRuntimeSiteEnabled } from "../../../../shared/sites";
import { popupDom } from "../../dom";
import { t } from "../../i18n";
import { state } from "../../state";
import { getEventElement } from "../helpers";
import type { PopupEventDeps } from "./deps";

const {
  addServiceBtn,
  resetSitesBtn,
  managedSitesList,
  serviceEditor,
  testSelectorBtn,
  serviceWaitRange,
  serviceWaitValue,
  serviceUrlInput,
  serviceHostnameAliasesInput,
  serviceEditorCancel,
  serviceEditorSave,
} = popupDom.serviceManagement;

export function bindServiceEvents(deps: PopupEventDeps) {
  addServiceBtn.addEventListener("click", () => {
    deps.services.resetServiceEditorForm();
    deps.services.populateServiceEditor(null);
  });

  resetSitesBtn.addEventListener("click", () => {
    deps.status.showConfirmToast(t.resetServicesConfirm, async () => {
      try {
        await resetSiteSettings();
        await deps.storage.refreshStoredData();
        deps.services.hideServiceEditor();
        deps.status.setStatus(t.serviceResetDone, "success");
        deps.status.showAppToast(t.serviceResetDone, "success", 2200);
      } catch (error) {
        console.error(
          "[AI Prompt Broadcaster] Failed to reset service settings.",
          error,
        );
        const errorMessage = t.error(deps.status.getErrorMessage(error));
        deps.status.setStatus(errorMessage, "error");
        deps.status.showAppToast(errorMessage, "error", 4000);
      }
    });
  });

  managedSitesList.addEventListener("click", (event) => {
    const actionButton = getEventElement(event.target)?.closest<HTMLElement>(
      "[data-action][data-site-id]",
    );
    if (!actionButton) {
      return;
    }

    const { action, siteId } = actionButton.dataset;
    if (!siteId) {
      return;
    }

    if (action === "edit-service") {
      const site = state.runtimeSites.find((entry) => entry.id === siteId) ?? null;
      if (site) {
        deps.services.populateServiceEditor(site);
      }
      return;
    }

    if (action === "delete-service") {
      void deps.services.deleteManagedSite(siteId);
    }
  });

  managedSitesList.addEventListener("change", (event) => {
    const toggle = getEventElement(event.target)?.closest<HTMLInputElement>(
      "[data-action='toggle-service'][data-site-id]",
    );
    const siteId = toggle?.dataset.siteId;
    if (!toggle || !siteId) {
      return;
    }

    void setRuntimeSiteEnabled(siteId, toggle.checked)
      .then(() => deps.storage.refreshStoredData())
      .catch((error) => {
        console.error("[AI Prompt Broadcaster] Failed to toggle site state.", error);
        deps.status.setStatus(t.error(deps.status.getErrorMessage(error)), "error");
      });
  });

  testSelectorBtn.addEventListener("click", () => {
    void deps.services.testSelectorOnActiveTab();
  });

  serviceWaitRange.addEventListener("input", () => {
    serviceWaitValue.textContent = `${serviceWaitRange.value}ms`;
  });

  serviceUrlInput.addEventListener("input", () => {
    if (!serviceEditor.hidden) {
      deps.services.renderServicePermissionPreview();
    }
  });

  serviceHostnameAliasesInput.addEventListener("input", () => {
    if (!serviceEditor.hidden) {
      deps.services.renderServicePermissionPreview();
    }
  });

  serviceEditorCancel.addEventListener("click", deps.services.hideServiceEditor);
  serviceEditorSave.addEventListener("click", () => {
    void deps.services.saveServiceEditorDraft();
  });
}
