import {
  getFavoriteRunJobById,
  getFavoriteRunJobs,
} from "../../../../shared/runtime-state";
import type { FavoriteRunJobRecord } from "../../../../shared/types/models";
import {
  buildFavoriteJobAlarmName,
  FAVORITE_JOB_ALARM_PREFIX,
  parseFavoriteJobIdFromAlarmName,
  scheduleFavoriteJobAlarm,
} from "../../../favorites/jobs";
import { mutateFavoriteRunJob } from "./job-mutation";
import type { FavoriteWorkflowRunJobDeps } from "./types";

export interface FavoriteRunJobMaintenanceCollaborators {
  runFavoriteJob: (jobId: string) => Promise<void>;
  appendFavoriteRunJobFailureHistory: (
    job: FavoriteRunJobRecord,
    stepIndex: number,
    message: string,
  ) => Promise<void>;
}

export interface FavoriteRunJobMaintenanceDeps
  extends Pick<FavoriteWorkflowRunJobDeps, "nowIso" | "getWorkflowMessage">,
    FavoriteRunJobMaintenanceCollaborators {}

export function createFavoriteRunJobMaintenance(
  deps: FavoriteRunJobMaintenanceDeps,
) {
  async function reconcileFavoriteRunJobs() {
    const [jobs, alarms] = await Promise.all([
      getFavoriteRunJobs(),
      chrome.alarms.getAll().catch(() => []),
    ]);
    const existingAlarmNames = new Set(alarms.map((alarm) => alarm.name));
    const desiredAlarmNames = new Set<string>();

    await Promise.all(
      jobs.map(async (job) => {
        if (
          (job.status !== "queued" && job.status !== "running") ||
          job.currentBroadcastId
        ) {
          return;
        }

        const alarmName = buildFavoriteJobAlarmName(job.jobId);
        if (!alarmName) {
          return;
        }

        desiredAlarmNames.add(alarmName);
        if (!existingAlarmNames.has(alarmName)) {
          await scheduleFavoriteJobAlarm(job.jobId);
        }
      }),
    );

    await Promise.all(
      alarms
        .filter((alarm) => alarm.name.startsWith(FAVORITE_JOB_ALARM_PREFIX))
        .filter((alarm) => !desiredAlarmNames.has(alarm.name))
        .map((alarm) => chrome.alarms.clear(alarm.name).catch(() => false)),
    );
  }

  async function handleFavoriteRunJobAlarm(alarmName: string) {
    const jobId = parseFavoriteJobIdFromAlarmName(alarmName);
    if (!jobId) {
      return;
    }

    try {
      await deps.runFavoriteJob(jobId);
    } catch (error) {
      console.error("[AI Prompt Broadcaster] Favorite alarm worker failed.", error);
      const jobs = await getFavoriteRunJobs();
      const job = getFavoriteRunJobById(jobs, jobId);
      if (!job) {
        return;
      }

      const stepIndex = job.currentStepIndex ?? job.completedSteps;
      const errorMessage =
        error instanceof Error && error.message
          ? error.message
          : deps.getWorkflowMessage(
              "favorite_run_error_start_failed",
              [],
              "Favorite execution could not start.",
            );

      await mutateFavoriteRunJob(jobId, (current) => ({
        ...current,
        status: "failed",
        currentBroadcastId: null,
        message: errorMessage,
        updatedAt: deps.nowIso(),
      }));

      if (typeof stepIndex === "number") {
        await deps.appendFavoriteRunJobFailureHistory(job, stepIndex, errorMessage);
      }
    }
  }

  return {
    reconcileFavoriteRunJobs,
    handleFavoriteRunJobAlarm,
  };
}
