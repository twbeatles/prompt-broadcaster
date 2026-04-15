import type {
  BroadcastResponse,
  BroadcastSiteTargetMessage,
  CancelBroadcastResponse,
} from "../../shared/types/messages";
import type { LastBroadcastSummary } from "../../shared/types/models";
import type { PopupTemplateSendState, PopupToastInput } from "../../shared/types/popup";
import { clearAllToasts } from "../ui/toast";
import { normalizeSiteIdList } from "../app/helpers";
import { msg, t } from "../app/i18n";
import { state } from "../app/state";

type ComposerTarget = NonNullable<PopupTemplateSendState["targets"]>[number];

interface PopupSendFlowDeps {
  refreshOpenSiteTabs: () => Promise<void>;
  sendPopupMessage: <TResponse>(message: object, timeoutMs?: number, fallbackValue?: TResponse | null) => Promise<TResponse | null>;
  buildRuntimeBroadcastTargets: (
    targets?: Array<ComposerTarget | BroadcastSiteTargetMessage>,
  ) => Array<{
    id: string;
    tabId?: number;
    reuseExistingTab?: boolean;
    target?: string;
    promptOverride?: string;
    resolvedPrompt?: string;
  }>;
  setStatus: (text: string, type?: string) => void;
  showAppToast: (input: PopupToastInput | string, type?: string, duration?: number) => string;
  setSendingState: (isSending: boolean) => void;
  armSendSafetyTimer: () => void;
  clearSendSafetyTimer: () => void;
  buildBroadcastToastSignature: (summary: LastBroadcastSummary | null) => string;
  getUnknownErrorText: () => string;
  getErrorMessage: (error: unknown) => string;
  setLastSentPrompt: (prompt: string) => Promise<void>;
}

function hasTargetId(
  target: ComposerTarget | BroadcastSiteTargetMessage,
): target is ComposerTarget {
  return typeof target.id === "string" && target.id.trim().length > 0;
}

export function isLastBroadcastSummary(value: unknown): value is LastBroadcastSummary {
  if (!value || typeof value !== "object") {
    return false;
  }

  const candidate = value as Partial<LastBroadcastSummary>;
  return (
    typeof candidate.broadcastId === "string"
    && typeof candidate.status === "string"
    && typeof candidate.prompt === "string"
    && Array.isArray(candidate.siteIds)
  );
}

export function createPopupSendFlow(deps: PopupSendFlowDeps) {
  function getSiteCardElement(siteId: string): HTMLElement | null {
    return document.querySelector<HTMLElement>(`.site-card[data-site-id="${CSS.escape(siteId)}"]`);
  }

  function setSiteCardState(siteId: string, cardState: string): void {
    const card = getSiteCardElement(siteId);
    if (!card) {
      return;
    }

    card.classList.remove("sending", "sent", "failed");
    card.classList.add(cardState);
    card.querySelector(".retry-btn")?.remove();
  }

  function addRetryButton(target: ComposerTarget, mainPrompt: string): void {
    const siteId = target.id;
    const card = getSiteCardElement(siteId);
    if (!card || card.querySelector(".retry-btn")) {
      return;
    }

    const retryBtn = document.createElement("button");
    retryBtn.type = "button";
    retryBtn.className = "secondary-btn retry-btn";
    retryBtn.textContent = "Retry";
    retryBtn.addEventListener("click", async () => {
      retryBtn.disabled = true;
      setSiteCardState(siteId, "sending");
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
        const failedIds = Array.isArray(response?.failedTabSiteIds) ? response.failedTabSiteIds : [];
        if (response?.ok && !failedIds.includes(siteId)) {
          setSiteCardState(siteId, "sent");
        } else {
          setSiteCardState(siteId, "failed");
          addRetryButton(target, mainPrompt);
        }
      } catch {
        setSiteCardState(siteId, "failed");
        addRetryButton(target, mainPrompt);
      }
    });
    card.appendChild(retryBtn);
  }

  function triggerRipple(button: HTMLButtonElement, event: MouseEvent): void {
    const rect = button.getBoundingClientRect();
    const size = Math.max(rect.width, rect.height);
    const x = event.clientX - rect.left - size / 2;
    const y = event.clientY - rect.top - size / 2;
    const ripple = document.createElement("span");
    ripple.className = "ripple";
    ripple.style.cssText = `width:${size}px;height:${size}px;left:${x}px;top:${y}px;`;
    button.appendChild(ripple);
    ripple.addEventListener("animationend", () => ripple.remove(), { once: true });
  }

  function setCardStatesFromBroadcast(summary: LastBroadcastSummary | null): void {
    document.querySelectorAll<HTMLElement>(".site-card.sent, .site-card.failed, .site-card.sending").forEach((card) => {
      card.classList.remove("sending", "sent", "failed");
      card.querySelector(".retry-btn")?.remove();
    });

    if (!summary?.siteIds?.length) {
      return;
    }

    summary.siteIds.forEach((siteId) => {
      const status = summary.siteResults?.[siteId];
      const code = typeof status === "string"
        ? status
        : typeof status?.code === "string"
          ? status.code
          : "";
      if (code === "submitted") {
        setSiteCardState(siteId, "sent");
        return;
      }

      if (status) {
        setSiteCardState(siteId, "failed");
        return;
      }

      if (summary.status === "sending") {
        setSiteCardState(siteId, "sending");
      }
    });
  }

  function applyLastBroadcastState(
    summary: LastBroadcastSummary | null,
    { silentToast = false }: { silentToast?: boolean } = {},
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
    const isRecent = Number.isFinite(finishedAtMs) && Date.now() - finishedAtMs <= 5 * 60 * 1000;
    const signature = deps.buildBroadcastToastSignature(summary);
    const successCount = (summary.submittedSiteIds ?? []).length;
    const failedCount = (summary.failedSiteIds ?? []).length;

    if (summary.status === "submitted") {
      deps.setStatus(t.sent(successCount || summary.total || summary.siteIds?.length || 0), "success");
    } else {
      const doneMessage = (msg("popup_broadcast_restored_done", [String(successCount), String(failedCount)]) ||
        `Last broadcast: ${successCount} success, ${failedCount} failed`);
      deps.setStatus(doneMessage, failedCount > 0 ? "warning" : "success");
    }

    if (!silentToast && isRecent && state.lastBroadcastToastSignature !== signature) {
      const message = (msg("popup_broadcast_restored_done", [String(successCount), String(failedCount)]) ||
        `Last broadcast: ${successCount} success, ${failedCount} failed`);

      deps.showAppToast(
        {
          message,
          type: failedCount > 0 ? "warning" : "info",
          duration: failedCount > 0 ? -1 : 4000,
        },
      );
      state.lastBroadcastToastSignature = signature;
    }
  }

  async function cancelCurrentBroadcast() {
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

    siteIds.forEach((siteId) => setSiteCardState(siteId, "sending"));
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
          response.failedTabSiteIds.forEach((siteId) => {
            setSiteCardState(siteId, "failed");
            const failedTarget = targets.find(
              (target): target is ComposerTarget => hasTargetId(target) && target.id === siteId,
            );
            if (failedTarget) {
              addRetryButton(failedTarget, mainPrompt);
            }
          });
        }

        deps.setStatus(t.sending(response.createdSiteCount ?? siteIds.length), "warning");
        deps.showAppToast(t.toastSendSuccess(response.createdSiteCount ?? siteIds.length), "success", 2200);

        if (state.settings.autoClosePopup) {
          window.close();
        }
      } else {
        siteIds.forEach((siteId) => {
          setSiteCardState(siteId, "failed");
          const failedTarget = targets.find(
            (target): target is ComposerTarget => hasTargetId(target) && target.id === siteId,
          );
          if (failedTarget) {
            addRetryButton(failedTarget, mainPrompt);
          }
        });
        deps.setStatus(t.error(response?.error ?? deps.getUnknownErrorText()), "error");
      }
    } catch (error) {
      console.error("[AI Prompt Broadcaster] Broadcast send failed.", error);
      siteIds.forEach((siteId) => {
        setSiteCardState(siteId, "failed");
        const failedTarget = targets.find(
          (target): target is ComposerTarget => hasTargetId(target) && target.id === siteId,
        );
        if (failedTarget) {
          addRetryButton(failedTarget, mainPrompt);
        }
      });
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
    applyLastBroadcastState,
    cancelCurrentBroadcast,
    setCardStatesFromBroadcast,
    sendResolvedPrompt,
    triggerRipple,
  };
}
