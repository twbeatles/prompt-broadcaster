import { setLastBroadcast } from "../../../shared/runtime-state";
import type {
  LastBroadcastSummary,
  PendingBroadcastRecord,
} from "../../../shared/types/models";
import type { PendingBroadcastControllerDeps } from "./types";

export interface BroadcastSupportDeps
  extends Pick<
    PendingBroadcastControllerDeps,
    "applyBadgeForBroadcast" | "restoreFocusedTabContext"
  > {}

export async function closeTabQuietly(tabId: number): Promise<void> {
  try {
    await chrome.tabs.remove(tabId);
  } catch (_error) {
    // Ignore already-closed tabs.
  }
}

export function getBroadcastAgeMs(
  record: PendingBroadcastRecord | null | undefined,
): number {
  const startedAtMs = Date.parse(record?.startedAt ?? "");
  return Number.isFinite(startedAtMs) ? Date.now() - startedAtMs : 0;
}

export function createBroadcastSupport(deps: BroadcastSupportDeps) {
  async function syncLastBroadcast(
    summary: LastBroadcastSummary | null,
  ): Promise<void> {
    await setLastBroadcast(summary);
    await deps.applyBadgeForBroadcast(summary);
  }

  async function restoreBroadcastFocus(
    record: PendingBroadcastRecord | null | undefined,
  ): Promise<void> {
    if (!record) {
      return;
    }

    await deps.restoreFocusedTabContext({
      tabId: Number.isFinite(Number(record.originTabId)) ? Number(record.originTabId) : null,
      windowId: Number.isFinite(Number(record.originWindowId)) ? Number(record.originWindowId) : null,
    });
  }

  return {
    syncLastBroadcast,
    restoreBroadcastFocus,
  };
}
