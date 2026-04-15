import {
  buildBroadcastTargetMessageFromSnapshot,
  ensureBroadcastTargetSnapshots,
} from "../../shared/broadcast/target-snapshots";
import type { OpenSiteTab, PromptHistoryItem, RuntimeSite } from "../../shared/types/models";
import type { PopupOverlayController, PopupState } from "../../shared/types/popup";
import { popupDom } from "../app/dom";
import { escapeAttribute, escapeHtml } from "../app/helpers";
import { t } from "../app/i18n";
import { buildImportReportMarkup, getHistorySelectedSiteIds } from "../app/list-markup";
import { state } from "../app/state";

const {
  resendModal,
  resendModalTitle,
  resendModalDesc,
  resendModalSites,
  resendModalClose,
  resendModalCancel,
  resendModalConfirm,
  importReportModal,
  importReportModalTitle,
  importReportModalDesc,
  importReportBody,
  importReportModalClose,
  importReportModalConfirm,
} = popupDom.modals;

interface PopupHistoryModalsDeps {
  getEnabledSites: () => Array<{ id: string }>;
  runtimeSites: () => RuntimeSite[];
  openSiteTabs: () => OpenSiteTab[];
  setStatus: (text: string, type?: string) => void;
  sendResolvedPrompt: (
    prompt: string,
    targets: Array<{
      id: string;
      tabId?: number;
      reuseExistingTab?: boolean;
      target?: string;
      promptOverride?: string;
      resolvedPrompt?: string;
    }>,
  ) => Promise<void>;
  openOverlay: PopupOverlayController["openOverlay"];
  closeOverlay: PopupOverlayController["closeOverlay"];
}

export function createPopupHistoryModals(deps: PopupHistoryModalsDeps) {
  function hideResendModal() {
    state.pendingResendHistory = null;
    deps.closeOverlay(resendModal);
  }

  function openResendModal(historyItem: PromptHistoryItem): void {
    state.pendingResendHistory = historyItem;
    resendModalTitle.textContent = t.resendModalTitle;
    resendModalDesc.textContent = t.resendModalDesc;
    resendModalCancel.textContent = t.resendModalCancel;
    resendModalConfirm.textContent = t.resendModalConfirm;

    const requestedSiteIds = getHistorySelectedSiteIds(historyItem);
    const availableSiteIds = new Set(deps.getEnabledSites().map((site) => site.id));

    resendModalSites.innerHTML = requestedSiteIds.map((siteId) => {
      const site = deps.runtimeSites().find((entry) => entry.id === siteId);
      const disabled = !availableSiteIds.has(siteId);
      return `
        <label class="checkbox-row">
          <input type="checkbox" value="${escapeAttribute(siteId)}" data-resend-site="${escapeAttribute(siteId)}" ${disabled ? "disabled" : "checked"} />
          <span>${escapeHtml(site?.name ?? siteId)}${disabled ? ` (${escapeHtml(t.resendSiteUnavailable)})` : ""}</span>
        </label>
      `;
    }).join("");

    deps.openOverlay(
      resendModal,
      resendModalSites.querySelector<HTMLInputElement>("input:not([disabled])"),
    );
  }

  async function confirmResendModal() {
    const historyItem = state.pendingResendHistory;
    if (!historyItem) {
      return;
    }

    const selectedSiteIds = Array.from(
      resendModalSites.querySelectorAll<HTMLInputElement>("[data-resend-site]:checked"),
    )
      .map((checkbox) => checkbox.value)
      .filter(Boolean);

    if (selectedSiteIds.length === 0) {
      deps.setStatus(t.warnNoSite, "error");
      return;
    }

    const selectedTargets = ensureBroadcastTargetSnapshots(
      historyItem.targetSnapshots,
      historyItem.requestedSiteIds,
      historyItem.text,
    )
      .filter((snapshot) => selectedSiteIds.includes(snapshot.siteId))
      .map((snapshot) =>
        buildBroadcastTargetMessageFromSnapshot(snapshot, deps.openSiteTabs()))
      .filter((target): target is {
        id: string;
        tabId?: number;
        reuseExistingTab?: boolean;
        target?: string;
        promptOverride?: string;
        resolvedPrompt?: string;
      } => typeof target.id === "string" && target.id.trim().length > 0);

    hideResendModal();
    await deps.sendResolvedPrompt(historyItem.text, selectedTargets);
  }

  function openImportReportModal(summary: PopupState["pendingImportSummary"]): void {
    state.pendingImportSummary = summary;
    importReportModalTitle.textContent = t.importReportTitle;
    importReportModalDesc.textContent = t.importReportDesc;
    importReportModalConfirm.textContent = t.importReportClose;
    importReportBody.innerHTML = buildImportReportMarkup(summary);
    deps.openOverlay(importReportModal, importReportModalClose);
  }

  function hideImportReportModal() {
    state.pendingImportSummary = null;
    deps.closeOverlay(importReportModal);
  }

  function bindHistoryModalEvents(
    getErrorMessage: (error: unknown) => string,
  ): void {
    resendModalClose.addEventListener("click", hideResendModal);
    resendModalCancel.addEventListener("click", hideResendModal);
    resendModal.addEventListener("click", (event) => {
      if (event.target === resendModal) {
        hideResendModal();
      }
    });
    resendModalConfirm.addEventListener("click", () => {
      void confirmResendModal().catch((error) => {
        console.error("[AI Prompt Broadcaster] Resend modal confirm failed.", error);
        deps.setStatus(t.error(getErrorMessage(error)), "error");
      });
    });

    importReportModalClose.addEventListener("click", hideImportReportModal);
    importReportModalConfirm.addEventListener("click", hideImportReportModal);
    importReportModal.addEventListener("click", (event) => {
      if (event.target === importReportModal) {
        hideImportReportModal();
      }
    });
  }

  return {
    hideResendModal,
    openResendModal,
    openImportReportModal,
    hideImportReportModal,
    bindHistoryModalEvents,
  };
}
