import { pickBroadcastTargetPrompt } from "../../shared/broadcast/resolution";
import {
  getAppSettings,
  getBroadcastCounter,
  setBroadcastCounter,
} from "../../shared/prompts";
import { enqueueUiToast } from "../../shared/runtime-state";
import { buildSiteResult } from "../app/injection-helpers";
import type { ResolvedBroadcastTarget } from "../app/bootstrap/tab-targets";
import type { BackgroundSessionState } from "../../shared/types/background";
import type {
  BroadcastMessage,
  BroadcastResponse,
  BroadcastSiteTargetMessage,
} from "../../shared/types/messages";
import type {
  LastBroadcastSummary,
  PendingBroadcastRecord,
  RuntimeSite,
  SiteInjectionResult,
} from "../../shared/types/models";

export interface BroadcastQueueDeps {
  getI18nMessage: (key: string, substitutions?: string[]) => string;
  normalizePrompt: (value: unknown) => string;
  clonePlainValue: <T>(value: T) => T;
  queueBackgroundStateMutation: <TResult>(
    mutator: (state: BackgroundSessionState) => Promise<TResult> | TResult,
  ) => Promise<TResult>;
  getPendingBroadcasts: () => Promise<Record<string, PendingBroadcastRecord>>;
  createPendingBroadcast: (
    prompt: string,
    targets: ResolvedBroadcastTarget[],
    metadata?: Record<string, unknown>,
  ) => Promise<PendingBroadcastRecord>;
  registerBroadcastCompletionWaiter: (broadcastId: string) => Promise<LastBroadcastSummary | null>;
  reconcilePendingBroadcasts: () => Promise<void>;
  resolveSelectedTargets: (
    siteRefs: Array<string | BroadcastSiteTargetMessage>,
  ) => Promise<ResolvedBroadcastTarget[]>;
  findReusableTabsForSites: (
    sites: RuntimeSite[],
    options: { windowId?: number | null; excludeTabId?: number | null },
  ) => Promise<Map<string, chrome.tabs.Tab>>;
  getExplicitReusableTabForTarget: (target: ResolvedBroadcastTarget) => Promise<{
    requested: boolean;
    tab: chrome.tabs.Tab | null;
    message?: string;
  }>;
  buildSelectedTabUnavailableMessage: (
    siteName: string,
    tabId?: number | null | undefined,
  ) => string;
  getSitePermissionPatterns: (site: RuntimeSite) => string[];
  isCustomSitePermissionGranted: (site: RuntimeSite) => Promise<boolean>;
  addPendingInjection: (
    tabId: number,
    payload: Record<string, unknown>,
  ) => Promise<unknown>;
  queuePendingInjection: (tabId: number, tab: chrome.tabs.Tab) => Promise<void>;
  recordBroadcastSiteResult: (
    broadcastId: string,
    siteId: string,
    resultInput: string | SiteInjectionResult,
  ) => Promise<LastBroadcastSummary | null>;
  closeTabQuietly: (tabId: number) => Promise<void>;
}

export function createBroadcastQueue(deps: BroadcastQueueDeps) {
  const {
    getI18nMessage,
    normalizePrompt,
    clonePlainValue,
    queueBackgroundStateMutation,
    getPendingBroadcasts,
    createPendingBroadcast,
    registerBroadcastCompletionWaiter,
    reconcilePendingBroadcasts,
    resolveSelectedTargets,
    findReusableTabsForSites,
    getExplicitReusableTabForTarget,
    buildSelectedTabUnavailableMessage,
    getSitePermissionPatterns,
    isCustomSitePermissionGranted,
    addPendingInjection,
    queuePendingInjection,
    recordBroadcastSiteResult,
    closeTabQuietly,
  } = deps;

  async function queueResolvedBroadcastRequest(
    prompt: string,
    selectedTargets: ResolvedBroadcastTarget[],
    metadata: Record<string, unknown> = {},
  ): Promise<BroadcastResponse> {
    const selectedSites = selectedTargets.map((target) => target.site);
    let queuedSiteCount = 0;

    const broadcast = await createPendingBroadcast(prompt, selectedTargets, metadata);
    registerBroadcastCompletionWaiter(broadcast.id);
    const settings = await getAppSettings();
    const createdTabSiteIds: string[] = [];
    const reusedTabSiteIds: string[] = [];
    const failedTabSiteIds: string[] = [];
    const reusableTabsBySiteId = settings.reuseExistingTabs
      ? await findReusableTabsForSites(selectedSites, {
          windowId: broadcast.originWindowId,
          excludeTabId: broadcast.originTabId,
        })
      : new Map();

    for (const target of selectedTargets) {
      const site = target.site;

      try {
        const pendingBeforeCreate = await getPendingBroadcasts();
        if (!pendingBeforeCreate[broadcast.id]) {
          continue;
        }

        if (site.isCustom && getSitePermissionPatterns(site).length > 0) {
          const granted = await isCustomSitePermissionGranted(site);
          if (!granted) {
            failedTabSiteIds.push(site.id);
            await recordBroadcastSiteResult(broadcast.id, site.id, "permission_denied");
            await enqueueUiToast({
              message:
                getI18nMessage("toast_service_permission_denied", [site.name]) ||
                `${site.name} host permission was not granted.`,
              type: "error",
              duration: 5000,
            });
            continue;
          }
        }

        const explicitTab = await getExplicitReusableTabForTarget(target);
        if (explicitTab.requested && !explicitTab.tab) {
          failedTabSiteIds.push(site.id);
          await recordBroadcastSiteResult(broadcast.id, site.id, buildSiteResult("tab_closed", {
            message: explicitTab.message ?? buildSelectedTabUnavailableMessage(site.name, target.targetTabId),
          }));
          continue;
        }

        const reusableTab =
          explicitTab.tab ??
          (
            !target.forceNewTab && settings.reuseExistingTabs
              ? reusableTabsBySiteId.get(site.id) ?? null
              : null
          );
        const targetTab =
          reusableTab ??
          await chrome.tabs.create({
            url: site.url,
            active: false,
          });

        if (!targetTab?.id) {
          throw new Error("Tab was queued without a valid id.");
        }

        const pendingAfterCreate = await getPendingBroadcasts();
        if (!pendingAfterCreate[broadcast.id]) {
          if (!reusableTab) {
            await closeTabQuietly(targetTab.id);
          }
          continue;
        }

        await addPendingInjection(targetTab.id, {
          broadcastId: broadcast.id,
          siteId: site.id,
          prompt: pickBroadcastTargetPrompt(target, prompt),
          site,
          injected: false,
          status: "pending",
          createdAt: Date.now(),
          closeOnCancel: !reusableTab,
        });

        await queueBackgroundStateMutation((state) => {
          const record = state.pendingBroadcasts[broadcast.id];
          if (!record) {
            return null;
          }

          record.targetTabIdsBySiteId = {
            ...(record.targetTabIdsBySiteId ?? {}),
            [site.id]: targetTab.id,
          };

          if (!reusableTab) {
            record.openedTabIds = Array.from(
              new Set([...(Array.isArray(record.openedTabIds) ? record.openedTabIds : []), targetTab.id])
            );
          }

          state.pendingBroadcasts[broadcast.id] = record;
          return clonePlainValue(record.targetTabIdsBySiteId);
        });

        queuedSiteCount += 1;

        if (reusableTab) {
          reusedTabSiteIds.push(site.id);
        } else {
          createdTabSiteIds.push(site.id);
        }

        void queuePendingInjection(targetTab.id, targetTab);
      } catch (error) {
        console.error("[AI Prompt Broadcaster] Failed to create broadcast tab.", {
          site,
          error,
        });
        failedTabSiteIds.push(site.id);
        await recordBroadcastSiteResult(broadcast.id, site.id, "tab_create_failed");
      }
    }

    if (queuedSiteCount > 0) {
      await queueBackgroundStateMutation(async () => {
        const currentCounter = await getBroadcastCounter();
        await setBroadcastCounter(currentCounter + 1);
        return currentCounter + 1;
      });
    }

    return {
      ok: queuedSiteCount > 0,
      createdSiteCount: queuedSiteCount,
      queuedSiteCount,
      requestedSiteCount: selectedSites.length,
      createdTabSiteIds,
      reusedTabSiteIds,
      failedTabSiteIds,
      broadcastId: broadcast.id,
      error: queuedSiteCount > 0 ? undefined : "No tabs could be queued.",
    };
  }

  async function queueBroadcastRequest(
    prompt: string,
    siteRefs: Array<string | BroadcastSiteTargetMessage>,
    metadata: Record<string, unknown> = {},
  ): Promise<BroadcastResponse> {
    await reconcilePendingBroadcasts();

    const normalizedPrompt = normalizePrompt(prompt).trim();
    const selectedTargets = await resolveSelectedTargets(siteRefs);
    const selectedSites = selectedTargets.map((target) => target.site);

    if (!normalizedPrompt) {
      throw new Error("Prompt is required.");
    }

    if (selectedSites.length === 0) {
      throw new Error("At least one target site is required.");
    }

    return queueResolvedBroadcastRequest(normalizedPrompt, selectedTargets, metadata);
  }

  async function handleBroadcastMessage(message: BroadcastMessage): Promise<BroadcastResponse> {
    return queueBroadcastRequest(message?.prompt, message?.sites, {
      trigger: "popup",
    });
  }

  return {
    queueResolvedBroadcastRequest,
    queueBroadcastRequest,
    handleBroadcastMessage,
  };
}
