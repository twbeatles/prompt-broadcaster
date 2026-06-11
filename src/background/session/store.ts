import {
  PENDING_BROADCASTS_KEY,
  PENDING_INJECTIONS_KEY,
  PENDING_SELECTOR_CHECKS_KEY,
  SELECTOR_ALERTS_KEY,
} from "../app/constants";
import {
  clearPendingSelectorChecksForService,
  registerPendingSelectorCheck,
} from "../app/selector-pending";
import type { BackgroundSessionState } from "../../shared/types/background";
import type {
  PendingBroadcastRecord,
  PendingInjectionRecord,
  PendingSelectorCheckRecord,
} from "../../shared/types/models";

function clonePlainValue<T>(value: T): T {
  return value ? JSON.parse(JSON.stringify(value)) as T : value;
}

type PendingInjectionUpdater =
  | PendingInjectionRecord
  | null
  | ((
    current: PendingInjectionRecord | null,
  ) => PendingInjectionRecord | null);

export function createBackgroundSessionStore() {
  const sessionState: BackgroundSessionState = {
    loaded: false,
    pendingInjections: {},
    pendingBroadcasts: {},
    pendingSelectorChecks: {},
    selectorAlerts: {},
  };
  let mutationChain: Promise<void> = Promise.resolve();

  async function ensureLoaded(): Promise<void> {
    if (sessionState.loaded) {
      return;
    }

    try {
      const result = await chrome.storage.session.get([
        PENDING_INJECTIONS_KEY,
        PENDING_BROADCASTS_KEY,
        PENDING_SELECTOR_CHECKS_KEY,
        SELECTOR_ALERTS_KEY,
      ]);
      sessionState.pendingInjections = clonePlainValue(
        (result[PENDING_INJECTIONS_KEY] ?? {}) as Record<string, PendingInjectionRecord>,
      ) ?? {};
      sessionState.pendingBroadcasts = clonePlainValue(
        (result[PENDING_BROADCASTS_KEY] ?? {}) as Record<string, PendingBroadcastRecord>,
      ) ?? {};
      sessionState.pendingSelectorChecks = clonePlainValue(
        (result[PENDING_SELECTOR_CHECKS_KEY] ?? {}) as Record<string, PendingSelectorCheckRecord>,
      ) ?? {};
      sessionState.selectorAlerts = clonePlainValue(
        (result[SELECTOR_ALERTS_KEY] ?? {}) as Record<string, number>,
      ) ?? {};
    } catch (error) {
      console.error("[AI Prompt Broadcaster] Failed to initialize session-state cache.", error);
      sessionState.pendingInjections = {};
      sessionState.pendingBroadcasts = {};
      sessionState.pendingSelectorChecks = {};
      sessionState.selectorAlerts = {};
    }

    sessionState.loaded = true;
  }

  async function persist(): Promise<void> {
    await chrome.storage.session.set({
      [PENDING_INJECTIONS_KEY]: sessionState.pendingInjections,
      [PENDING_BROADCASTS_KEY]: sessionState.pendingBroadcasts,
      [PENDING_SELECTOR_CHECKS_KEY]: sessionState.pendingSelectorChecks,
      [SELECTOR_ALERTS_KEY]: sessionState.selectorAlerts,
    });
  }

  function mutate<TResult>(
    mutator: (state: BackgroundSessionState) => Promise<TResult> | TResult,
  ): Promise<TResult> {
    const runMutation = async (): Promise<TResult> => {
      await ensureLoaded();
      const result = await mutator(sessionState);
      await persist();
      return result;
    };

    const resultPromise = mutationChain.then(runMutation, runMutation);
    mutationChain = resultPromise.then(() => undefined, () => undefined);
    return resultPromise;
  }

  async function waitForIdle(): Promise<void> {
    await mutationChain;
  }

  async function getPendingInjections(): Promise<Record<string, PendingInjectionRecord>> {
    await ensureLoaded();
    return clonePlainValue(sessionState.pendingInjections) ?? {};
  }

  function setPendingInjections(
    value: Record<string, PendingInjectionRecord>,
  ): Promise<Record<string, PendingInjectionRecord>> {
    return mutate((state) => {
      state.pendingInjections = clonePlainValue(value) ?? {};
      return clonePlainValue(state.pendingInjections) ?? {};
    });
  }

  async function getPendingBroadcasts(): Promise<Record<string, PendingBroadcastRecord>> {
    await ensureLoaded();
    return clonePlainValue(sessionState.pendingBroadcasts) ?? {};
  }

  function setPendingBroadcasts(
    value: Record<string, PendingBroadcastRecord>,
  ): Promise<Record<string, PendingBroadcastRecord>> {
    return mutate((state) => {
      state.pendingBroadcasts = clonePlainValue(value) ?? {};
      return clonePlainValue(state.pendingBroadcasts) ?? {};
    });
  }

  async function getSelectorAlerts(): Promise<Record<string, number>> {
    await ensureLoaded();
    return clonePlainValue(sessionState.selectorAlerts) ?? {};
  }

  function setSelectorAlerts(
    value: Record<string, number>,
  ): Promise<Record<string, number>> {
    return mutate((state) => {
      state.selectorAlerts = clonePlainValue(value) ?? {};
      return clonePlainValue(state.selectorAlerts) ?? {};
    });
  }

  function clearPendingSelectorChecksForSiteId(
    serviceId: string,
  ): Promise<Record<string, PendingSelectorCheckRecord>> {
    if (!(typeof serviceId === "string" && serviceId.trim())) {
      return Promise.resolve({});
    }

    return mutate((state) => {
      state.pendingSelectorChecks = clearPendingSelectorChecksForService(
        state.pendingSelectorChecks,
        serviceId,
      );
      return clonePlainValue(state.pendingSelectorChecks) ?? {};
    });
  }

  function registerPendingSelectorCheckReport(report: {
    siteId?: unknown;
    missing?: Array<{ field?: unknown; selector?: unknown }>;
  }) {
    return mutate((state) => {
      const result = registerPendingSelectorCheck(
        state.pendingSelectorChecks,
        report,
      );
      state.pendingSelectorChecks = result.next;
      return clonePlainValue(result) ?? result;
    });
  }

  function updatePendingInjection(
    tabId: number,
    updater: PendingInjectionUpdater,
  ): Promise<PendingInjectionRecord | null> {
    return mutate((state) => {
      const pending = state.pendingInjections ?? {};
      const current = pending[String(tabId)];
      const nextValue = typeof updater === "function"
        ? updater(clonePlainValue(current) ?? null)
        : updater;

      if (nextValue) {
        pending[String(tabId)] = nextValue;
      } else {
        delete pending[String(tabId)];
      }

      state.pendingInjections = pending;
      return clonePlainValue(nextValue) ?? null;
    });
  }

  function addPendingInjection(
    tabId: number,
    payload: Partial<PendingInjectionRecord>,
  ): Promise<PendingInjectionRecord | null> {
    return updatePendingInjection(tabId, {
      ...payload,
      tabId,
      createdAt: Number(payload.createdAt) || Date.now(),
      startedAt: Number(payload.startedAt) || undefined,
      injected: Boolean(payload.injected),
      status: payload.status || "pending",
      closeOnCancel: payload.closeOnCancel !== false,
    } as PendingInjectionRecord);
  }

  async function removePendingInjection(tabId: number): Promise<void> {
    await updatePendingInjection(tabId, null);
  }

  return {
    mutate,
    waitForIdle,
    getPendingInjections,
    setPendingInjections,
    getPendingBroadcasts,
    setPendingBroadcasts,
    getSelectorAlerts,
    setSelectorAlerts,
    clearPendingSelectorChecksForSiteId,
    registerPendingSelectorCheckReport,
    updatePendingInjection,
    addPendingInjection,
    removePendingInjection,
  };
}
