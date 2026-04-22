import type {
  BroadcastResponse,
  BroadcastSiteTargetMessage,
} from "../../../shared/types/messages";
import { clearAllToasts } from "../../ui/toast";
import { normalizeSiteIdList } from "../../app/helpers";
import { t } from "../../app/i18n";
import { state } from "../../app/state";
import type {
  ComposerTarget,
  PopupSendCardState,
  PopupSendFlowDeps,
} from "./types";
import { hasTargetId } from "./types";

interface PopupSendExecutionDeps
  extends Pick<
    PopupSendFlowDeps,
    | "armSendSafetyTimer"
    | "buildRuntimeBroadcastTargets"
    | "clearSendSafetyTimer"
    | "getErrorMessage"
    | "getUnknownErrorText"
    | "refreshOpenSiteTabs"
    | "sendPopupMessage"
    | "setLastSentPrompt"
    | "setSendingState"
    | "setStatus"
    | "showAppToast"
  > {}

export function createPopupSendExecution(
  deps: PopupSendExecutionDeps,
  cardState: Pick<PopupSendCardState, "getSiteCardElement" | "setSiteCardState">,
) {
  function addRetryButton(target: ComposerTarget, mainPrompt: string): void {
    const siteId = target.id;
    const card = cardState.getSiteCardElement(siteId);
    if (!card || card.querySelector(".retry-btn")) {
      return;
    }

    const retryBtn = document.createElement("button");
    retryBtn.type = "button";
    retryBtn.className = "secondary-btn retry-btn";
    retryBtn.textContent = "Retry";
    retryBtn.addEventListener("click", async () => {
      retryBtn.disabled = true;
      cardState.setSiteCardState(siteId, "sending");

      try {
        await deps.refreshOpenSiteTabs();
        const response = await deps.sendPopupMessage<BroadcastResponse>(
          {
            action: "broadcast",
            prompt: mainPrompt,
            sites: deps.buildRuntimeBroadcastTargets([target]),
          },
          10000,
        );
        const failedIds = Array.isArray(response?.failedTabSiteIds)
          ? response.failedTabSiteIds
          : [];
        if (response?.ok && !failedIds.includes(siteId)) {
          cardState.setSiteCardState(siteId, "sent");
          return;
        }

        cardState.setSiteCardState(siteId, "failed");
        addRetryButton(target, mainPrompt);
      } catch {
        cardState.setSiteCardState(siteId, "failed");
        addRetryButton(target, mainPrompt);
      }
    });
    card.appendChild(retryBtn);
  }

  function markTargetsFailed(
    siteIds: string[],
    targets: Array<ComposerTarget | BroadcastSiteTargetMessage>,
    mainPrompt: string,
  ): void {
    siteIds.forEach((siteId) => {
      cardState.setSiteCardState(siteId, "failed");
      const failedTarget = targets.find(
        (target): target is ComposerTarget =>
          hasTargetId(target) && target.id === siteId,
      );
      if (failedTarget) {
        addRetryButton(failedTarget, mainPrompt);
      }
    });
  }

  async function sendResolvedPrompt(
    mainPrompt: string,
    targets: Array<ComposerTarget | BroadcastSiteTargetMessage>,
  ): Promise<void> {
    if (state.isSending) {
      return;
    }

    const siteIds = normalizeSiteIdList(
      (Array.isArray(targets) ? targets : []).map((target) => target?.id),
    );

    deps.setSendingState(true);
    deps.armSendSafetyTimer();

    siteIds.forEach((siteId) => cardState.setSiteCardState(siteId, "sending"));
    deps.setStatus(t.sending(siteIds.length));

    try {
      await deps.refreshOpenSiteTabs();
      await deps.setLastSentPrompt(mainPrompt);
      clearAllToasts();

      const response = await deps.sendPopupMessage<BroadcastResponse>(
        {
          action: "broadcast",
          prompt: mainPrompt,
          sites: deps.buildRuntimeBroadcastTargets(targets),
        },
        10000,
      );

      if (response?.ok) {
        if (Array.isArray(response.failedTabSiteIds)) {
          markTargetsFailed(response.failedTabSiteIds, targets, mainPrompt);
        }

        deps.setStatus(
          t.sending(response.createdSiteCount ?? siteIds.length),
          "warning",
        );
        deps.showAppToast(
          t.toastSendSuccess(response.createdSiteCount ?? siteIds.length),
          "success",
          2200,
        );

        if (state.settings.autoClosePopup) {
          window.close();
        }
      } else {
        markTargetsFailed(siteIds, targets, mainPrompt);
        deps.setStatus(
          t.error(response?.error ?? deps.getUnknownErrorText()),
          "error",
        );
      }
    } catch (error) {
      console.error("[AI Prompt Broadcaster] Broadcast send failed.", error);
      markTargetsFailed(siteIds, targets, mainPrompt);
      deps.setStatus(t.error(deps.getErrorMessage(error)), "error");
      deps.showAppToast(t.error(deps.getErrorMessage(error)), "error", 4000);
      deps.setSendingState(false);
      deps.clearSendSafetyTimer();
    } finally {
      if (state.lastBroadcast?.status !== "sending") {
        deps.setSendingState(false);
      }
    }
  }

  return {
    sendResolvedPrompt,
  };
}
