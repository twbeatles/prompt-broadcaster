import {
  getFavoriteRunJobById,
  updateFavoriteRunJobs,
} from "../../../../shared/runtime-state";
import type { FavoriteRunJobRecord } from "../../../../shared/types/models";
import { replaceFavoriteRunJob } from "../../../favorites/jobs";

export async function mutateFavoriteRunJob(
  jobId: string,
  updater: (job: FavoriteRunJobRecord) => FavoriteRunJobRecord,
) {
  return updateFavoriteRunJobs((jobs) => {
    const existing = getFavoriteRunJobById(jobs, jobId);
    if (!existing) {
      return jobs;
    }

    return replaceFavoriteRunJob(jobs, updater(existing));
  });
}
