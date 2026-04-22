import { createPopupServiceEditorController } from "./controller/editor";
import { createManagedSitesController } from "./controller/managed-sites";

export type {
  PopupServicesControllerDeps,
  ServiceDraft,
} from "./controller/types";

export function createPopupServicesController(
  deps: import("./controller/types").PopupServicesControllerDeps,
) {
  const serviceEditorController = createPopupServiceEditorController({
    refreshStoredData: deps.refreshStoredData,
    getErrorMessage: deps.getErrorMessage,
    buildServiceTestResultMessage: deps.buildServiceTestResultMessage,
    sendPopupMessage: deps.sendPopupMessage,
    setStatus: deps.setStatus,
    showAppToast: deps.showAppToast,
  });
  const managedSitesController = createManagedSitesController({
    refreshStoredData: deps.refreshStoredData,
    setStatus: deps.setStatus,
    showAppToast: deps.showAppToast,
    getErrorMessage: deps.getErrorMessage,
    getSiteLastVerifiedStatus: deps.getSiteLastVerifiedStatus,
    getSiteSelectorIssueUrl: deps.getSiteSelectorIssueUrl,
  });

  return {
    ...serviceEditorController,
    ...managedSitesController,
  };
}
