import type { BackgroundSessionState } from "../../../shared/types/background";
import type {
  LastBroadcastSummary,
  PendingBroadcastRecord,
  PendingInjectionRecord,
  PromptHistoryItem,
  SiteInjectionResult,
} from "../../../shared/types/models";

export interface PendingBroadcastControllerDeps {
  getI18nMessage: (key: string, substitutions?: string[]) => string;
  nowIso: () => string;
  clonePlainValue: <T>(value: T) => T;
  getBroadcastTriggerLabel: (
    trigger: unknown,
  ) => import("../../../shared/types/models").FavoriteExecutionTrigger;
  queueBackgroundStateMutation: <TResult>(
    mutator: (state: BackgroundSessionState) => Promise<TResult> | TResult,
  ) => Promise<TResult>;
  getPendingBroadcasts: () => Promise<Record<string, PendingBroadcastRecord>>;
  getPendingInjections: () => Promise<Record<string, PendingInjectionRecord>>;
  removePendingInjection: (tabId: number) => Promise<void>;
  activeInjections: Set<number>;
  suppressedCompletedBroadcastIds: Set<string>;
  getFocusedTabContext: () => Promise<{ tabId: number | null; windowId: number | null } | null | undefined>;
  restoreFocusedTabContext: (context: {
    tabId: number | null;
    windowId: number | null;
  }) => Promise<void>;
  applyBadgeForBroadcast: (summary: LastBroadcastSummary | null) => Promise<void>;
  maybeCreateBroadcastNotification: (summary: LastBroadcastSummary) => Promise<void>;
  handleFavoriteBroadcastCompletion: (summary: LastBroadcastSummary) => Promise<void>;
  resolveBroadcastCompletionWaiter: (
    broadcastId: string,
    summary?: LastBroadcastSummary | null,
  ) => void;
  autoCaptureBroadcastResponses: (
    historyItem: PromptHistoryItem,
    completedRecord: PendingBroadcastRecord,
  ) => Promise<void>;
}
