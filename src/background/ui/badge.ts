import {
  BADGE_CLEAR_ALARM,
  BADGE_CLEAR_DELAY_MS,
} from "../app/constants";
import type { LastBroadcastSummary } from "../../shared/types/models";

export interface BadgeController {
  clearBadge: () => Promise<void>;
  applyBadgeForBroadcast: (summary: LastBroadcastSummary | null) => Promise<void>;
}

export function createBadgeController(): BadgeController {
  async function clearBadge(): Promise<void> {
    try {
      await chrome.action.setBadgeText({ text: "" });
    } catch (error) {
      console.error("[AI Prompt Broadcaster] Failed to clear badge.", error);
    }
  }

  async function applyBadgeForBroadcast(
    summary: LastBroadcastSummary | null,
  ): Promise<void> {
    try {
      if (!summary || summary.status === "idle") {
        await clearBadge();
        return;
      }

      if (summary.status === "sending") {
        await chrome.action.setBadgeBackgroundColor({ color: "#d97706" });
        await chrome.action.setBadgeText({ text: "..." });
        return;
      }

      if (summary.status === "failed" || summary.status === "partial") {
        await chrome.action.setBadgeBackgroundColor({ color: "#b53b3b" });
        await chrome.action.setBadgeText({ text: "!" });
        return;
      }

      await chrome.action.setBadgeBackgroundColor({ color: "#1f8f5f" });
      await chrome.action.setBadgeText({ text: "✓" });
      chrome.alarms.create(BADGE_CLEAR_ALARM, {
        when: Date.now() + BADGE_CLEAR_DELAY_MS,
      });
    } catch (error) {
      console.error("[AI Prompt Broadcaster] Failed to apply badge state.", error);
    }
  }

  return {
    clearBadge,
    applyBadgeForBroadcast,
  };
}
