import {
  DEFAULT_FAVORITE_SORT,
  DEFAULT_HISTORY_SORT,
} from "../constants";
import type {
  BroadcastTargetMode,
  ChainFailurePolicy,
  ComparisonCaptureMode,
  FavoriteExecutionTrigger,
  FavoriteMode,
  FavoriteSort,
  HistorySort,
  ScheduleRepeat,
} from "../../types/models";

const VALID_HISTORY_SORTS = new Set<HistorySort>([
  "latest",
  "oldest",
  "mostSuccess",
  "mostFailure",
]);

const VALID_FAVORITE_SORTS = new Set<FavoriteSort>([
  "recentUsed",
  "usageCount",
  "title",
  "createdAt",
]);

const VALID_FAVORITE_MODES = new Set<FavoriteMode>(["single", "chain"]);
const VALID_CAPTURE_MODES = new Set<ComparisonCaptureMode>([
  "manual",
  "selection",
  "auto",
]);
const VALID_CHAIN_FAILURE_POLICIES = new Set<ChainFailurePolicy>([
  "stop",
  "continue",
  "retry-once",
]);
const VALID_BROADCAST_TARGET_MODES = new Set<BroadcastTargetMode>([
  "default",
  "new",
  "tab",
]);
const VALID_SCHEDULE_REPEATS = new Set<ScheduleRepeat>([
  "none",
  "daily",
  "weekday",
  "weekly",
]);
const VALID_EXECUTION_TRIGGERS = new Set<FavoriteExecutionTrigger>([
  "popup",
  "scheduled",
  "palette",
  "options",
]);

export function normalizeHistorySort(value: unknown): HistorySort {
  return VALID_HISTORY_SORTS.has(value as HistorySort)
    ? (value as HistorySort)
    : DEFAULT_HISTORY_SORT;
}

export function normalizeFavoriteSort(value: unknown): FavoriteSort {
  return VALID_FAVORITE_SORTS.has(value as FavoriteSort)
    ? (value as FavoriteSort)
    : DEFAULT_FAVORITE_SORT;
}

export function normalizeFavoriteMode(value: unknown): FavoriteMode {
  return VALID_FAVORITE_MODES.has(value as FavoriteMode)
    ? (value as FavoriteMode)
    : "single";
}

export function normalizeComparisonCaptureMode(value: unknown): ComparisonCaptureMode {
  return VALID_CAPTURE_MODES.has(value as ComparisonCaptureMode)
    ? (value as ComparisonCaptureMode)
    : "manual";
}

export function normalizeChainFailurePolicy(value: unknown): ChainFailurePolicy {
  return VALID_CHAIN_FAILURE_POLICIES.has(value as ChainFailurePolicy)
    ? (value as ChainFailurePolicy)
    : "stop";
}

export function normalizeBroadcastTargetMode(
  value: unknown,
): BroadcastTargetMode | undefined {
  return VALID_BROADCAST_TARGET_MODES.has(value as BroadcastTargetMode)
    ? (value as BroadcastTargetMode)
    : undefined;
}

export function normalizeScheduleRepeat(value: unknown): ScheduleRepeat {
  return VALID_SCHEDULE_REPEATS.has(value as ScheduleRepeat)
    ? (value as ScheduleRepeat)
    : "none";
}

export function normalizeExecutionTrigger(
  value: unknown
): FavoriteExecutionTrigger | undefined {
  return VALID_EXECUTION_TRIGGERS.has(value as FavoriteExecutionTrigger)
    ? (value as FavoriteExecutionTrigger)
    : undefined;
}
