import assert from "node:assert/strict";
import process from "node:process";
import { createChromeMock } from "./qa-smoke/chrome-mock.mjs";
import { loadBundledModule } from "./qa-smoke/bundle-loader.mjs";

// Browser-free unit regressions for background broadcast lifecycle fixes.
// Runs on plain Node (no Playwright browser required):
//   npm run qa:unit

function clonePlainValue(value) {
  return value ? JSON.parse(JSON.stringify(value)) : value;
}

function createMemorySessionState(initial = {}) {
  const state = {
    pendingBroadcasts: {},
    pendingInjections: {},
    ...clonePlainValue(initial),
  };

  return {
    state,
    async queueBackgroundStateMutation(mutator) {
      return mutator(state);
    },
    async getPendingBroadcasts() {
      return clonePlainValue(state.pendingBroadcasts) ?? {};
    },
    async getPendingInjections() {
      return clonePlainValue(state.pendingInjections) ?? {};
    },
    async removePendingInjection(tabId) {
      delete state.pendingInjections[String(tabId)];
    },
  };
}

const results = [];

async function runStep(name, handler) {
  try {
    await handler();
    results.push({ name, ok: true });
    console.log(`PASS ${name}`);
  } catch (error) {
    results.push({ name, ok: false, error: error instanceof Error ? error.message : String(error) });
    console.error(`FAIL ${name}`);
    console.error(error);
  }
}

function buildStaleBroadcastRecord(startedAt) {
  return {
    id: "b1",
    prompt: "stale prompt",
    siteIds: ["s1", "s2"],
    total: 2,
    completed: 0,
    submittedSiteIds: [],
    failedSiteIds: [],
    siteResults: {},
    targetSnapshots: [],
    startedAt,
    status: "sending",
    originTabId: null,
    originWindowId: null,
    openedTabIds: [12],
    targetTabIdsBySiteId: { s1: 11, s2: 12 },
    originFavoriteId: null,
    chainRunId: null,
    chainStepIndex: null,
    chainStepCount: null,
    experimentRunId: null,
    trigger: "popup",
  };
}

function buildInjectionJob(tabId, siteId, closeOnCancel, createdAt, overrides = {}) {
  return {
    tabId,
    broadcastId: "b1",
    siteId,
    prompt: "stale prompt",
    site: { id: siteId, name: siteId === "s1" ? "Reused AI" : "New AI" },
    injected: false,
    status: "pending",
    createdAt,
    closeOnCancel,
    ...overrides,
  };
}

function buildTestBroadcastController(module, memory) {
  return module.createPendingBroadcastController({
    getI18nMessage: () => "",
    nowIso: () => new Date().toISOString(),
    clonePlainValue,
    getBroadcastTriggerLabel: (trigger) => trigger ?? "popup",
    queueBackgroundStateMutation: memory.queueBackgroundStateMutation,
    getPendingBroadcasts: memory.getPendingBroadcasts,
    getPendingInjections: memory.getPendingInjections,
    removePendingInjection: memory.removePendingInjection,
    activeInjections: new Set(),
    suppressedCompletedBroadcastIds: new Set(),
    getFocusedTabContext: async () => null,
    restoreFocusedTabContext: async () => undefined,
    applyBadgeForBroadcast: async () => undefined,
    maybeCreateBroadcastNotification: async () => undefined,
    handleFavoriteBroadcastCompletion: async () => undefined,
    resolveBroadcastCompletionWaiter: () => undefined,
    autoCaptureBroadcastResponses: async () => undefined,
  });
}

await runStep("reconcile keeps reused tabs on broadcast timeout", async () => {
  const chromeMock = createChromeMock();
  const removedTabIds = [];
  chromeMock.tabs = {
    async remove(tabId) {
      removedTabIds.push(Number(tabId));
    },
  };

  const module = await loadBundledModule(
    "src/background/broadcast/pending/controller.ts",
    chromeMock,
  );

  const startedAt = new Date(Date.now() - 61_000).toISOString();
  const createdAt = Date.now() - 61_000;
  const memory = createMemorySessionState({
    pendingBroadcasts: { b1: buildStaleBroadcastRecord(startedAt) },
    pendingInjections: {
      11: buildInjectionJob(11, "s1", false, createdAt),
      12: buildInjectionJob(12, "s2", true, createdAt),
    },
  });

  const controller = module.createPendingBroadcastController({
    getI18nMessage: () => "",
    nowIso: () => new Date().toISOString(),
    clonePlainValue,
    getBroadcastTriggerLabel: (trigger) => trigger ?? "popup",
    queueBackgroundStateMutation: memory.queueBackgroundStateMutation,
    getPendingBroadcasts: memory.getPendingBroadcasts,
    getPendingInjections: memory.getPendingInjections,
    removePendingInjection: memory.removePendingInjection,
    activeInjections: new Set(),
    suppressedCompletedBroadcastIds: new Set(),
    getFocusedTabContext: async () => null,
    restoreFocusedTabContext: async () => undefined,
    applyBadgeForBroadcast: async () => undefined,
    maybeCreateBroadcastNotification: async () => undefined,
    handleFavoriteBroadcastCompletion: async () => undefined,
    resolveBroadcastCompletionWaiter: () => undefined,
    autoCaptureBroadcastResponses: async () => undefined,
  });

  await controller.reconcilePendingBroadcasts();

  assert.deepEqual(removedTabIds, [12]);
  assert.deepEqual(await memory.getPendingBroadcasts(), {});
  assert.deepEqual(await memory.getPendingInjections(), {});
});

await runStep("queue skips a tab already owned by another broadcast", async () => {
  const chromeMock = createChromeMock();
  const module = await loadBundledModule(
    "src/background/broadcast/queue.ts",
    chromeMock,
  );

  const memory = createMemorySessionState({
    pendingInjections: {
      21: {
        tabId: 21,
        broadcastId: "broadcast-X",
        siteId: "siteA",
        prompt: "other prompt",
        site: { id: "siteA", name: "Site A" },
        injected: false,
        status: "pending",
        createdAt: Date.now(),
        closeOnCancel: false,
      },
    },
  });

  const resultCalls = [];
  const addedTabIds = [];
  const siteA = { id: "siteA", name: "Site A", isCustom: false, url: "https://a.example/" };
  const siteB = { id: "siteB", name: "Site B", isCustom: false, url: "https://b.example/" };

  const queue = module.createBroadcastQueue({
    getI18nMessage: () => "",
    normalizePrompt: (value) => String(value ?? ""),
    clonePlainValue,
    queueBackgroundStateMutation: memory.queueBackgroundStateMutation,
    getPendingBroadcasts: memory.getPendingBroadcasts,
    getPendingInjections: memory.getPendingInjections,
    createPendingBroadcast: async (prompt, targets, metadata = {}) => {
      const record = {
        id: "b-test",
        prompt,
        siteIds: targets.map((target) => target.site.id),
        total: targets.length,
        completed: 0,
        submittedSiteIds: [],
        failedSiteIds: [],
        siteResults: {},
        targetSnapshots: [],
        startedAt: new Date().toISOString(),
        status: "sending",
        originTabId: null,
        originWindowId: null,
        openedTabIds: [],
        targetTabIdsBySiteId: {},
        trigger: metadata.trigger ?? "popup",
      };
      memory.state.pendingBroadcasts[record.id] = record;
      return clonePlainValue(record);
    },
    registerBroadcastCompletionWaiter: async () => null,
    reconcilePendingBroadcasts: async () => undefined,
    resolveSelectedTargets: async () => [
      { site: siteA, targetTabId: 21, requireExplicitTab: true, forceNewTab: false, promptOverride: undefined, resolvedPrompt: "resolved-A" },
      { site: siteB, targetTabId: 22, requireExplicitTab: true, forceNewTab: false, promptOverride: undefined, resolvedPrompt: "resolved-B" },
    ],
    findReusableTabsForSites: async () => new Map(),
    getExplicitReusableTabForTarget: async (target) => ({
      requested: true,
      tab: { id: target.site.id === "siteA" ? 21 : 22, windowId: 1 },
    }),
    buildSelectedTabUnavailableMessage: (siteName, tabId) => `${siteName} tab ${tabId} unavailable`,
    getSitePermissionPatterns: () => [],
    isCustomSitePermissionGranted: async () => true,
    addPendingInjection: async (tabId, payload) => {
      addedTabIds.push(Number(tabId));
      memory.state.pendingInjections[String(tabId)] = payload;
      return payload;
    },
    queuePendingInjection: async () => undefined,
    recordBroadcastSiteResult: async (broadcastId, siteId, resultInput) => {
      resultCalls.push({
        broadcastId,
        siteId,
        code: resultInput?.code ?? resultInput,
        message: resultInput?.message ?? "",
      });
      return null;
    },
    closeTabQuietly: async () => undefined,
  });

  const response = await queue.queueBroadcastRequest("hello", ["siteA", "siteB"], {});

  assert.equal(response.ok, true);
  assert.equal(response.queuedSiteCount, 1);
  assert.deepEqual(response.failedTabSiteIds, ["siteA"]);
  assert.deepEqual(addedTabIds, [22]);
  assert.equal(resultCalls.length, 1);
  assert.equal(resultCalls[0].siteId, "siteA");
  assert.equal(resultCalls[0].code, "unexpected_error");
  assert.match(resultCalls[0].message, /busy/i);
  assert.equal(
    memory.state.pendingInjections["21"]?.broadcastId,
    "broadcast-X",
  );
});

await runStep("reconcile defers broadcast with actively injecting job", async () => {
  const chromeMock = createChromeMock();
  const removedTabIds = [];
  chromeMock.tabs = {
    async remove(tabId) {
      removedTabIds.push(Number(tabId));
    },
  };

  const module = await loadBundledModule(
    "src/background/broadcast/pending/controller.ts",
    chromeMock,
  );

  const startedAt = new Date(Date.now() - 61_000).toISOString();
  const memory = createMemorySessionState({
    pendingBroadcasts: { b1: buildStaleBroadcastRecord(startedAt) },
    pendingInjections: {
      11: buildInjectionJob(11, "s1", false, Date.now() - 61_000),
      12: buildInjectionJob(12, "s2", true, Date.now() - 61_000, {
        status: "injecting",
        injected: true,
        startedAt: Date.now() - 5_000,
      }),
    },
  });

  const controller = buildTestBroadcastController(module, memory);
  await controller.reconcilePendingBroadcasts();

  assert.deepEqual(removedTabIds, []);
  assert.equal(Object.keys(await memory.getPendingBroadcasts()).length, 1);
  assert.equal(Object.keys(await memory.getPendingInjections()).length, 2);
});

const failed = results.filter((result) => !result.ok);
console.log(`Unit QA: ${results.length - failed.length}/${results.length} passed.`);
if (failed.length > 0) {
  process.exitCode = 1;
}
