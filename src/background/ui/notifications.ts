import { getAppSettings } from "../../shared/prompts";
import {
  buildSelectorAlertSignature,
  shouldAllowSelectorNotification,
  SELECTOR_NOTIFY_COOLDOWN_MS,
} from "../app/selector-alerts";
import { NOTIFICATION_ICON_PATH } from "../app/constants";
import type { LastBroadcastSummary } from "../../shared/types/models";
import type { BackgroundSessionState } from "../../shared/types/background";

export interface NotificationServiceDeps {
  getI18nMessage: (key: string, substitutions?: string[]) => string;
  queueBackgroundStateMutation: <TResult>(
    mutator: (state: BackgroundSessionState) => Promise<TResult> | TResult,
  ) => Promise<TResult>;
  getSiteById: (siteId: string) => Promise<{ name?: string } | null | undefined>;
}

export interface NotificationService {
  maybeCreateSelectorNotification: (
    report: {
      siteId: string;
      siteName: string;
      pageUrl: string;
      missing: Array<{ field: string; selector: string }>;
    },
    options?: {
      source?: "selector-checker" | "injector";
      cooldownMs?: number;
    },
  ) => Promise<void>;
  maybeCreateBroadcastNotification: (
    summary: LastBroadcastSummary,
  ) => Promise<void>;
}

export function createNotificationService(
  deps: NotificationServiceDeps,
): NotificationService {
  async function maybeCreateSelectorNotification(
    report: {
      siteId: string;
      siteName: string;
      pageUrl: string;
      missing: Array<{ field: string; selector: string }>;
    },
    options: {
      source?: "selector-checker" | "injector";
      cooldownMs?: number;
    } = {},
  ): Promise<void> {
    try {
      // Proactive page visits should only surface a popup badge after promotion —
      // desktop notifications are reserved for real inject failures.
      if (options.source === "selector-checker") {
        return;
      }

      const settings = await getAppSettings();
      if (!settings.desktopNotifications) {
        return;
      }

      const signature = buildSelectorAlertSignature(report);
      const cooldownMs =
        Number.isFinite(Number(options.cooldownMs)) && Number(options.cooldownMs) >= 0
          ? Number(options.cooldownMs)
          : SELECTOR_NOTIFY_COOLDOWN_MS;
      const nowMs = Date.now();

      const shouldNotify = await deps.queueBackgroundStateMutation((state) => {
        const selectorAlerts = state.selectorAlerts ?? {};
        const lastNotifiedAt = selectorAlerts[signature];
        if (!shouldAllowSelectorNotification(lastNotifiedAt, nowMs, cooldownMs)) {
          return false;
        }

        selectorAlerts[signature] = nowMs;
        state.selectorAlerts = selectorAlerts;
        return true;
      });

      if (!shouldNotify) {
        return;
      }

      await chrome.notifications.create(`selector-changed-${report.siteId}`, {
        type: "basic",
        iconUrl: chrome.runtime.getURL(NOTIFICATION_ICON_PATH),
        title:
          deps.getI18nMessage("notification_selector_title", [report.siteName]) ||
          `${report.siteName} input check needed`,
        message:
          deps.getI18nMessage("notification_selector_message", [report.siteName]) ||
          `${report.siteName} input box was not found. Complete login or security checks, then try again.`,
      });
    } catch (error) {
      console.error("[AI Prompt Broadcaster] Failed to create selector notification.", {
        report,
        error,
      });
    }
  }

  async function maybeCreateBroadcastNotification(
    summary: LastBroadcastSummary,
  ): Promise<void> {
    try {
      const settings = await getAppSettings();
      if (!settings.desktopNotifications) {
        return;
      }

      const successCount = (summary.submittedSiteIds ?? []).length;
      const failedSiteIds = [...(summary.failedSiteIds ?? [])];
      const failedCount = failedSiteIds.length;
      const failedNames = (
        await Promise.all(
          failedSiteIds.map(
            async (siteId) => (await deps.getSiteById(siteId))?.name ?? siteId,
          ),
        )
      ).filter(Boolean);

      let title =
        deps.getI18nMessage("notification_broadcast_title_success") || "AI Broadcaster";
      let message = "";

      if (summary.status === "failed") {
        title =
          deps.getI18nMessage("notification_broadcast_title_failed") || "AI Broadcaster";
        message =
          deps.getI18nMessage("notification_broadcast_message_failed") ||
          "Broadcast failed. Check each tab for details.";
      } else if (summary.status === "partial") {
        title =
          deps.getI18nMessage("notification_broadcast_title_partial") || "AI Broadcaster";
        message =
          deps.getI18nMessage("notification_broadcast_message_partial_named", [
            String(successCount),
            String(failedCount),
            failedNames.join(", "),
          ]) ||
          `${successCount} succeeded, ${failedCount} failed (${failedNames.join(", ")})`;
      } else {
        title =
          deps.getI18nMessage("notification_broadcast_title_success") || "AI Broadcaster";
        message =
          deps.getI18nMessage("notification_broadcast_message_success_named", [
            String(successCount),
          ]) || `${successCount} service(s) completed`;
      }

      await chrome.notifications.create(`broadcast-complete-${Date.now()}`, {
        type: "basic",
        iconUrl: chrome.runtime.getURL(NOTIFICATION_ICON_PATH),
        title,
        message,
      });
    } catch (error) {
      console.error(
        "[AI Prompt Broadcaster] Failed to create broadcast notification.",
        error,
      );
    }
  }

  return {
    maybeCreateSelectorNotification,
    maybeCreateBroadcastNotification,
  };
}
