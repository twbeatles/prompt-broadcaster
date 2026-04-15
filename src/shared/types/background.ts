import type {
  PendingBroadcastRecord,
  PendingInjectionRecord,
  PendingSelectorCheckRecord,
} from "./models";

export interface BackgroundSessionState {
  loaded: boolean;
  pendingInjections: Record<string, PendingInjectionRecord>;
  pendingBroadcasts: Record<string, PendingBroadcastRecord>;
  pendingSelectorChecks: Record<string, PendingSelectorCheckRecord>;
  selectorAlerts: Record<string, number>;
}

export interface BackgroundBroadcastWaiter<TSummary = unknown> {
  promise: Promise<TSummary | null>;
  resolve: (summary: TSummary | null) => void;
}

export interface BackgroundMutationQueue<TResult = unknown> {
  run: (
    mutator: (state: BackgroundSessionState) => Promise<TResult> | TResult,
  ) => Promise<TResult>;
  waitForIdle: () => Promise<void>;
}

export interface BroadcastExecutionContext {
  originTabId: number | null;
  originWindowId: number | null;
  focusedTabId: number | null;
  focusedWindowId: number | null;
}

export interface BackgroundAppContext<TResult = unknown> {
  session: BackgroundSessionState;
  mutationQueue: BackgroundMutationQueue<TResult>;
  execution: BroadcastExecutionContext | null;
}
