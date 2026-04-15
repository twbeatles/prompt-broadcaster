import type { FavoriteRunJobRecord } from "../../shared/types/models";

const FAVORITE_JOB_ALARM_PREFIX = "apb-favorite-job:";
const FAVORITE_JOB_INITIAL_DELAY_MS = 50;
let favoriteExecutionChain = Promise.resolve();

export function createFavoriteRunJobId() {
  return typeof crypto?.randomUUID === "function"
    ? crypto.randomUUID()
    : `favorite-job-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

export function buildFavoriteJobAlarmName(jobId: string) {
  const normalizedJobId = typeof jobId === "string" ? jobId.trim() : "";
  return normalizedJobId ? `${FAVORITE_JOB_ALARM_PREFIX}${normalizedJobId}` : "";
}

export function parseFavoriteJobIdFromAlarmName(alarmName: string) {
  const normalizedAlarmName = typeof alarmName === "string" ? alarmName.trim() : "";
  return normalizedAlarmName.startsWith(FAVORITE_JOB_ALARM_PREFIX)
    ? normalizedAlarmName.slice(FAVORITE_JOB_ALARM_PREFIX.length)
    : "";
}

export async function scheduleFavoriteJobAlarm(
  jobId: string,
  delayMs = FAVORITE_JOB_INITIAL_DELAY_MS,
) {
  const alarmName = buildFavoriteJobAlarmName(jobId);
  if (!alarmName) {
    return;
  }

  chrome.alarms.create(alarmName, {
    when: Date.now() + Math.max(FAVORITE_JOB_INITIAL_DELAY_MS, Math.round(Number(delayMs) || 0)),
  });
}

export function replaceFavoriteRunJob(
  jobs: FavoriteRunJobRecord[],
  nextJob: FavoriteRunJobRecord,
): FavoriteRunJobRecord[] {
  const nextJobs = jobs.filter((job) => job.jobId !== nextJob.jobId);
  nextJobs.unshift(nextJob);
  return nextJobs;
}

export function queueFavoriteExecution<T>(task: () => Promise<T>): Promise<T> {
  const resultPromise = favoriteExecutionChain.then(task, task);
  favoriteExecutionChain = resultPromise.then(() => undefined, () => undefined);
  return resultPromise;
}

export { FAVORITE_JOB_ALARM_PREFIX };
