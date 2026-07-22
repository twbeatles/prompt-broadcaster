import type {
  ChainStep,
  FavoriteExecutionTrigger,
  FavoritePrompt,
  FavoriteRunExecutionContextSnapshot,
} from "../../../../shared/types/models";

export interface FavoriteWorkflowEntryPointDeps {
  getBroadcastTriggerLabel: (trigger: unknown) => FavoriteExecutionTrigger;
  openPopupWithPrompt: (prompt?: string) => Promise<void>;
  nowIso: () => string;
  buildChainRunId: () => string;
  getWorkflowMessage: (
    key: string,
    substitutions?: string[],
    fallback?: string,
  ) => string;
  previewFavoriteText: (favorite: FavoritePrompt) => string;
  getFavoriteExecutionSteps: (favorite: FavoritePrompt) => ChainStep[];
  detectFavoriteExecutionBlockers: (
    favorite: FavoritePrompt,
    executionContext: FavoriteRunExecutionContextSnapshot,
    templateVariableCache: Record<string, string>,
    trigger: FavoriteExecutionTrigger,
    options?: { hasPreparedClipboardValue?: boolean },
  ) => {
    ok: boolean;
    reason?: string;
    message?: string;
    defaults?: Record<string, string>;
    steps?: ChainStep[];
    failingStepIndex?: number | null;
    failingStepText?: string;
    failingStepTargetSiteIds?: string[];
  };
  createEmptyExecutionContext: () => FavoriteRunExecutionContextSnapshot;
  normalizePreparedExecutionContext: (
    input?: Partial<FavoriteRunExecutionContextSnapshot>,
  ) => {
    context: Partial<FavoriteRunExecutionContextSnapshot>;
    hasClipboardValue: boolean;
  };
  mergeExecutionContext: (
    base: FavoriteRunExecutionContextSnapshot,
    extra: Partial<FavoriteRunExecutionContextSnapshot>,
  ) => FavoriteRunExecutionContextSnapshot;
  getExecutionTabContextFromSender: (
    sender?: chrome.runtime.MessageSender,
  ) => Promise<FavoriteRunExecutionContextSnapshot>;
  queueFavoriteRunJob: (
    favorite: FavoritePrompt,
    trigger: FavoriteExecutionTrigger,
    executionContext: FavoriteRunExecutionContextSnapshot,
    steps: ChainStep[],
    defaults: Record<string, string>,
  ) => Promise<{
    ok: boolean;
    deduped: boolean;
    jobId: string;
    message: string;
  } | {
    ok: false;
    deduped: false;
    jobId: string;
    message: string;
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
}
