import { normalizeSiteIdList, safeText } from "../prompts/normalizers";
import type {
  BroadcastTargetMode,
  BroadcastTargetSnapshot,
  OpenSiteTab,
} from "../types/models";
import type { BroadcastSiteTargetMessage } from "../types/messages";

interface SnapshotInput {
  site?: { id?: string | null } | null;
  siteId?: string | null;
  targetTabId?: number | null;
  forceNewTab?: boolean;
  resolvedPrompt?: string | null;
}

function normalizeTargetMode(value: unknown): BroadcastTargetMode {
  if (value === "new" || value === "tab") {
    return value;
  }

  return "default";
}

function normalizeTargetTabId(value: unknown): number | null {
  if (value === null || value === undefined || value === "") {
    return null;
  }

  const numericValue = Number(value);
  return Number.isFinite(numericValue) ? numericValue : null;
}

export function buildBroadcastTargetSnapshot(
  value: Partial<BroadcastTargetSnapshot> | null | undefined
): BroadcastTargetSnapshot | null {
  const siteId = safeText(value?.siteId).trim();
  if (!siteId) {
    return null;
  }

  return {
    siteId,
    resolvedPrompt: safeText(value?.resolvedPrompt),
    targetMode: normalizeTargetMode(value?.targetMode),
    targetTabId: normalizeTargetTabId(value?.targetTabId),
  };
}

export function normalizeBroadcastTargetSnapshots(
  value: unknown
): BroadcastTargetSnapshot[] {
  if (!Array.isArray(value)) {
    return [];
  }

  const seenSiteIds = new Set<string>();
  const snapshots: BroadcastTargetSnapshot[] = [];

  value.forEach((entry) => {
    const snapshot = buildBroadcastTargetSnapshot(
      entry && typeof entry === "object" && !Array.isArray(entry)
        ? {
            siteId: safeText((entry as Record<string, unknown>).siteId),
            resolvedPrompt: safeText((entry as Record<string, unknown>).resolvedPrompt),
            targetMode: (entry as Record<string, unknown>).targetMode as BroadcastTargetMode,
            targetTabId: normalizeTargetTabId((entry as Record<string, unknown>).targetTabId),
          }
        : null
    );

    if (!snapshot || seenSiteIds.has(snapshot.siteId)) {
      return;
    }

    seenSiteIds.add(snapshot.siteId);
    snapshots.push(snapshot);
  });

  return snapshots;
}

export function buildFallbackTargetSnapshots(
  siteIds: unknown,
  prompt: unknown
): BroadcastTargetSnapshot[] {
  return normalizeSiteIdList(siteIds).map((siteId) => ({
    siteId,
    resolvedPrompt: safeText(prompt),
    targetMode: "default",
    targetTabId: null,
  }));
}

export function ensureBroadcastTargetSnapshots(
  snapshots: unknown,
  siteIds: unknown,
  prompt: unknown
): BroadcastTargetSnapshot[] {
  const normalized = normalizeBroadcastTargetSnapshots(snapshots);
  if (normalized.length > 0) {
    return normalized;
  }

  return buildFallbackTargetSnapshots(siteIds, prompt);
}

export function buildQueueTargetSnapshots(
  targets: SnapshotInput[],
  fallbackPrompt: string
): BroadcastTargetSnapshot[] {
  return (Array.isArray(targets) ? targets : [])
    .map((target) => {
      const siteId = safeText(target?.site?.id ?? target?.siteId).trim();
      if (!siteId) {
        return null;
      }

      const targetTabId = normalizeTargetTabId(target?.targetTabId);
      const targetMode: BroadcastTargetMode = targetTabId
        ? "tab"
        : target?.forceNewTab
          ? "new"
          : "default";

      return {
        siteId,
        resolvedPrompt: safeText(target?.resolvedPrompt ?? fallbackPrompt),
        targetMode,
        targetTabId,
      } satisfies BroadcastTargetSnapshot;
    })
    .filter((snapshot): snapshot is BroadcastTargetSnapshot => Boolean(snapshot));
}

export function getTargetSnapshotSiteIds(entry: {
  targetSnapshots?: unknown;
  requestedSiteIds?: unknown;
  sentTo?: unknown;
  text?: unknown;
} | null | undefined): string[] {
  const snapshots = ensureBroadcastTargetSnapshots(
    entry?.targetSnapshots,
    entry?.requestedSiteIds ?? entry?.sentTo,
    entry?.text
  );
  return snapshots.map((snapshot) => snapshot.siteId);
}

export function buildBroadcastTargetMessageFromSnapshot(
  snapshot: BroadcastTargetSnapshot,
  openTabs: OpenSiteTab[] = []
): BroadcastSiteTargetMessage {
  const siteId = safeText(snapshot.siteId).trim();
  const payload: BroadcastSiteTargetMessage = {
    id: siteId,
    resolvedPrompt: safeText(snapshot.resolvedPrompt),
  };

  if (snapshot.targetMode === "new") {
    payload.reuseExistingTab = false;
    payload.target = "new";
    return payload;
  }

  if (snapshot.targetMode === "tab" && snapshot.targetTabId) {
    const matchingTab = openTabs.find(
      (tab) => tab.siteId === siteId && Number(tab.tabId) === Number(snapshot.targetTabId)
    );
    if (matchingTab?.tabId) {
      payload.tabId = matchingTab.tabId;
    }
  }

  return payload;
}
