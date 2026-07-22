import type {
  ChainStep,
  FavoriteExecutionTrigger,
  FavoritePrompt,
  FavoriteRunExecutionContextSnapshot,
  FavoriteRunJobRecord,
} from "../../../../shared/types/models";

export interface FavoriteWorkflowRunJobDeps {
  nowIso: () => string;
  buildChainRunId: () => string;
  previewFavoriteText: (favorite: FavoritePrompt | null | undefined) => string;
  buildFavoriteStepPrompt: (
    step: ChainStep,
    defaults: Record<string, string>,
    executionContext: FavoriteRunExecutionContextSnapshot,
  ) => Promise<string>;
  queueBroadcastRequest: (
    prompt: string,
    siteRefs: Array<{ id: string; target?: "new" | "tab" }>,
    metadata?: Record<string, unknown>,
  ) => Promise<{
    ok?: boolean;
    error?: string;
    broadcastId?: string;
  }>;
  createFavoriteFailureHistory: (details: {
    favoriteId?: string | null;
    requestedSiteIds?: string[];
    message?: string;
    text?: string;
    chainRunId?: string | null;
    chainStepIndex?: number | null;
    chainStepCount?: number | null;
    trigger?: FavoriteExecutionTrigger;
  }) => Promise<void>;
  getWorkflowMessage: (
    key: string,
    substitutions?: string[],
    fallback?: string,
  ) => string;
  getQueuedMessage: () => string;
  getCompletedMessage: () => string;
  getDedupedMessage: () => string;
  getFailedMessage: () => string;
  getSkippedActiveMessage: () => string;
  getWaitingStepMessage: (stepIndex: number, stepCount: number) => string;
  getQueuedStepMessage: (stepIndex: number, stepCount: number) => string;
  getFavoriteRunProgressMessage: (job: FavoriteRunJobRecord) => string;
}
