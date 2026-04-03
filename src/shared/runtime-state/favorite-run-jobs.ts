import {
  normalizeChainSteps,
  normalizeExecutionTrigger,
  normalizeFavoriteMode,
  safeArray,
  safeObject,
  safeText,
} from "../prompts";
import type {
  FavoriteRunExecutionContextSnapshot,
  FavoriteRunJobRecord,
  FavoriteRunJobStatus,
} from "../types/models";
import { SESSION_RUNTIME_KEYS } from "./constants";
import { readStorage, writeStorage } from "./storage";

const TERMINAL_JOB_TTL_MS = 5 * 60 * 1000;
const MAX_JOB_COUNT = 50;
let favoriteRunJobMutationChain = Promise.resolve();

function normalizeJobStatus(value: unknown): FavoriteRunJobStatus {
  if (
    value === "queued" ||
    value === "running" ||
    value === "completed" ||
    value === "failed" ||
    value === "skipped"
  ) {
    return value;
  }

  return "queued";
}

function normalizeIsoDate(value: unknown, fallback = new Date().toISOString()): string {
  if (typeof value !== "string" || !Number.isFinite(Date.parse(value))) {
    return fallback;
  }

  return new Date(value).toISOString();
}

function normalizeExecutionContext(value: unknown): FavoriteRunExecutionContextSnapshot {
  const source = safeObject(value);
  const tabId = Number(source.tabId);
  const windowId = Number(source.windowId);

  return {
    tabId: Number.isFinite(tabId) ? tabId : null,
    windowId: Number.isFinite(windowId) ? windowId : null,
    url: safeText(source.url),
    title: safeText(source.title),
    selection: safeText(source.selection),
    clipboard: safeText(source.clipboard),
  };
}

export function normalizeFavoriteRunJobRecord(value: unknown): FavoriteRunJobRecord | null {
  const source = safeObject(value);
  const jobId = safeText(source.jobId).trim();
  const favoriteId = safeText(source.favoriteId).trim();

  if (!jobId || !favoriteId) {
    return null;
  }

  const stepCount = Math.max(0, Math.round(Number(source.stepCount) || 0));
  const completedSteps = Math.max(0, Math.round(Number(source.completedSteps) || 0));
  const currentStepIndex = Number(source.currentStepIndex);

  return {
    jobId,
    favoriteId,
    trigger: normalizeExecutionTrigger(source.trigger) ?? "popup",
    status: normalizeJobStatus(source.status),
    mode: normalizeFavoriteMode(source.mode),
    stepCount,
    completedSteps: Math.min(completedSteps, stepCount || completedSteps),
    currentStepIndex: Number.isFinite(currentStepIndex) ? Math.max(0, Math.round(currentStepIndex)) : null,
    chainRunId: safeText(source.chainRunId).trim() || null,
    currentBroadcastId: safeText(source.currentBroadcastId).trim() || null,
    message: safeText(source.message),
    createdAt: normalizeIsoDate(source.createdAt),
    updatedAt: normalizeIsoDate(source.updatedAt),
    favoriteTitle: safeText(source.favoriteTitle),
    steps: normalizeChainSteps(source.steps),
    templateDefaults:
      source.templateDefaults && typeof source.templateDefaults === "object" && !Array.isArray(source.templateDefaults)
        ? Object.fromEntries(
            Object.entries(source.templateDefaults)
              .map(([key, entryValue]) => [safeText(key).trim(), safeText(entryValue)])
              .filter(([key]) => Boolean(key))
          )
        : {},
    executionContext: normalizeExecutionContext(source.executionContext),
  };
}

export function pruneFavoriteRunJobs(
  jobs: FavoriteRunJobRecord[],
  nowMs = Date.now()
): FavoriteRunJobRecord[] {
  const byId = new Map<string, FavoriteRunJobRecord>();

  safeArray(jobs).forEach((entry) => {
    const job = normalizeFavoriteRunJobRecord(entry);
    if (!job) {
      return;
    }

    const updatedAtMs = Date.parse(job.updatedAt);
    const isTerminal = job.status === "completed" || job.status === "failed" || job.status === "skipped";
    const expired =
      isTerminal &&
      Number.isFinite(updatedAtMs) &&
      nowMs - updatedAtMs > TERMINAL_JOB_TTL_MS;

    if (expired) {
      return;
    }

    const existing = byId.get(job.jobId);
    if (!existing || Date.parse(existing.updatedAt) < Date.parse(job.updatedAt)) {
      byId.set(job.jobId, job);
    }
  });

  return [...byId.values()]
    .sort((left, right) => Date.parse(right.updatedAt) - Date.parse(left.updatedAt))
    .slice(0, MAX_JOB_COUNT);
}

export async function getFavoriteRunJobs(): Promise<FavoriteRunJobRecord[]> {
  const rawValue = await readStorage("session", SESSION_RUNTIME_KEYS.favoriteRunJobs, []);
  return pruneFavoriteRunJobs(safeArray(rawValue));
}

export async function setFavoriteRunJobs(jobs: FavoriteRunJobRecord[]): Promise<FavoriteRunJobRecord[]> {
  const normalized = pruneFavoriteRunJobs(jobs);
  await writeStorage("session", SESSION_RUNTIME_KEYS.favoriteRunJobs, normalized);
  return normalized;
}

export async function updateFavoriteRunJobs(
  mutator: (jobs: FavoriteRunJobRecord[]) => FavoriteRunJobRecord[] | Promise<FavoriteRunJobRecord[]>
): Promise<FavoriteRunJobRecord[]> {
  const runMutation = async () => {
    const current = await getFavoriteRunJobs();
    const next = await mutator(current);
    return setFavoriteRunJobs(next);
  };

  const resultPromise = favoriteRunJobMutationChain.then(runMutation, runMutation);
  favoriteRunJobMutationChain = resultPromise.then(() => undefined, () => undefined);
  return resultPromise;
}

export function getFavoriteRunJobById(
  jobs: FavoriteRunJobRecord[],
  jobId: string
): FavoriteRunJobRecord | null {
  const normalizedJobId = safeText(jobId).trim();
  if (!normalizedJobId) {
    return null;
  }

  return jobs.find((job) => job.jobId === normalizedJobId) ?? null;
}

export function getLatestFavoriteRunJobByFavoriteId(
  jobs: FavoriteRunJobRecord[],
  favoriteId: string
): FavoriteRunJobRecord | null {
  const normalizedFavoriteId = safeText(favoriteId).trim();
  if (!normalizedFavoriteId) {
    return null;
  }

  return [...jobs]
    .filter((job) => safeText(job.favoriteId).trim() === normalizedFavoriteId)
    .sort((left, right) => Date.parse(right.updatedAt) - Date.parse(left.updatedAt))[0] ?? null;
}

export function findFavoriteRunJobByBroadcastId(
  jobs: FavoriteRunJobRecord[],
  broadcastId: string
): FavoriteRunJobRecord | null {
  const normalizedBroadcastId = safeText(broadcastId).trim();
  if (!normalizedBroadcastId) {
    return null;
  }

  return jobs.find((job) => safeText(job.currentBroadcastId).trim() === normalizedBroadcastId) ?? null;
}

export function findFavoriteRunDedupedJob(
  jobs: FavoriteRunJobRecord[],
  favoriteId: string
): FavoriteRunJobRecord | null {
  const latest = getLatestFavoriteRunJobByFavoriteId(jobs, favoriteId);
  if (!latest) {
    return null;
  }

  if (latest.status === "queued" || latest.status === "running") {
    return latest;
  }

  return null;
}
