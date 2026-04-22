import type { CancelBroadcastResponse } from "../../../shared/types/messages";
import type { LastBroadcastSummary } from "../../../shared/types/models";
import { msg, t } from "../../app/i18n";
import { state } from "../../app/state";
import type { PopupSendCardState, PopupSendFlowDeps } from "./types";

interface PopupBroadcastStateDeps
  extends Pick<
    PopupSendFlowDeps,
    | "buildBroadcastToastSignature"
    | "clearSendSafetyTimer"
    | "getErrorMessage"
    | "getUnknownErrorText"
    | "sendPopupMessage"
    | "setSendingState"
    | "setStatus"
    | "showAppToast"
  > {}

interface PopupBroadcastStateOptions {
  silentToast?: boolean;
}

export function createPopupBroadcastState(
  deps: PopupBroadcastStateDeps,
  cardState: Pick<PopupSendCardState, "clearSiteCardStates" | "setSiteCardState">,
) {
  function setCardStatesFromBroadcast(
    summary: LastBroadcastSummary | null,
  ): void {
    cardState.clearSiteCardStates();

    if (!summary?.siteIds?.length) {
      return;
    }

    summary.siteIds.forEach((siteId) => {
      const status = summary.siteResults?.[siteId];
      const code =
        typeof status === "string"
          ? status
          : typeof status?.code === "string"
            ? status.code
            : "";
      if (code === "submitted") {
        cardState.setSiteCardState(siteId, "sent");
        return;
      }

      if (status) {
        cardState.setSiteCardState(siteId, "failed");
        return;
      }

      if (summary.status === "sending") {
        cardState.setSiteCardState(siteId, "sending");
      }
    });
  }

  function getRestoredBroadcastMessage(
    successCount: number,
    failedCount: number,
  ): string {
    return (
      msg("popup_broadcast_restored_done", [
        String(successCount),
        String(failedCount),
      ]) || `Last broadcast: ${successCount} success, ${failedCount} failed`
    );
  }

  function applyLastBroadcastState(
    summary: LastBroadcastSummary | null,
    { silentToast = false }: PopupBroadcastStateOptions = {},
  ): void {
    state.lastBroadcast = summary;

    if (!summary) {
      deps.clearSendSafetyTimer();
      deps.setSendingState(false);
      deps.setStatus("");
      return;
    }

    setCardStatesFromBroadcast(summary);

    if (summary.status === "sending") {
      deps.setStatus(t.sending(summary.total || summary.siteIds?.length || 0));
      deps.setSendingState(true);
      const signature = deps.buildBroadcastToastSignature(summary);
      if (!silentToast && state.lastBroadcastToastSignature !== signature) {
        deps.showAppToast(t.restoredBroadcastSending, "info", 2600);
        state.lastBroadcastToastSignature = signature;
      }
      return;
    }

    deps.clearSendSafetyTimer();
    deps.setSendingState(false);

    const finishedAtMs = Date.parse(summary.finishedAt || "");
    const isRecent =
      Number.isFinite(finishedAtMs)
      && Date.now() - finishedAtMs <= 5 * 60 * 1000;
    const signature = deps.buildBroadcastToastSignature(summary);
    const successCount = (summary.submittedSiteIds ?? []).length;
    const failedCount = (summary.failedSiteIds ?? []).length;

    if (summary.status === "submitted") {
      deps.setStatus(
        t.sent(successCount || summary.total || summary.siteIds?.length || 0),
        "success",
      );
    } else {
      deps.setStatus(
        getRestoredBroadcastMessage(successCount, failedCount),
        failedCount > 0 ? "warning" : "success",
      );
    }

    if (!silentToast && isRecent && state.lastBroadcastToastSignature !== signature) {
      deps.showAppToast({
        duration: failedCount > 0 ? -1 : 4000,
        message: getRestoredBroadcastMessage(successCount, failedCount),
        type: failedCount > 0 ? "warning" : "info",
      });
      state.lastBroadcastToastSignature = signature;
    }
  }

  async function cancelCurrentBroadcast(): Promise<void> {
    const summary = state.lastBroadcast;
    if (!summary?.broadcastId || summary.status !== "sending") {
      deps.setSendingState(false);
      deps.clearSendSafetyTimer();
      return;
    }

    try {
      const response = await deps.sendPopupMessage<CancelBroadcastResponse>(
        {
          action: "cancelBroadcast",
          broadcastId: summary.broadcastId,
        },
        5000,
      );

      if (response?.ok) {
        applyLastBroadcastState(response.summary ?? summary, { silentToast: true });
        deps.setStatus(t.broadcastCancelled, "warning");
        deps.showAppToast(t.broadcastCancelled, "warning", 2600);
        return;
      }

      applyLastBroadcastState(response?.summary ?? summary, { silentToast: true });
      deps.setStatus(t.error(deps.getUnknownErrorText()), "error");
    } catch (error) {
      console.error("[AI Prompt Broadcaster] Failed to cancel broadcast.", error);
      deps.setStatus(t.error(deps.getErrorMessage(error)), "error");
    } finally {
      if (state.lastBroadcast?.status !== "sending") {
        deps.setSendingState(false);
      }
    }
  }

  return {
    applyLastBroadcastState,
    cancelCurrentBroadcast,
    setCardStatesFromBroadcast,
  };
}
