// @ts-nocheck
import {
  getActiveFavoriteRunJobByFavoriteId,
  getLatestFavoriteRunJobByFavoriteId,
} from "../../../shared/runtime-state";
import { escapeHTML } from "../../../shared/security";
import { optionsDom } from "../../app/dom";
import { t } from "../../app/i18n";
import { state } from "../../app/state";
import {
  createEmptyState,
  formatDateTime,
  getStatusInfo,
  previewText,
} from "../../app/helpers";
import { buildScheduledFavoriteRunSummary } from "../schedule-summary";

const { schedulesList } = optionsDom.schedules;

function getScheduleRepeatLabel(repeat) {
  switch (repeat) {
    case "daily":
      return t.schedules.repeatDaily;
    case "weekday":
      return t.schedules.repeatWeekday;
    case "weekly":
      return t.schedules.repeatWeekly;
    case "none":
    default:
      return t.schedules.repeatNone;
  }
}

function buildScheduledRunDetailMarkup(summary) {
  if (!summary?.representativeCode && !summary?.representativeMessage) {
    return "";
  }

  const codeLabel = summary?.representativeCode
    ? (t.settings.resultCodeLabels[summary.representativeCode] || summary.representativeCode)
    : "";
  const detailText = summary?.representativeMessage
    ? `${codeLabel ? `${codeLabel}: ` : ""}${summary.representativeMessage}`
    : codeLabel;

  if (!detailText) {
    return "";
  }

  return `
    <div class="schedule-result-detail">
      <strong>${escapeHTML(t.schedules.failureDetail)}</strong>
      <div>${escapeHTML(detailText)}</div>
    </div>
  `;
}

function buildFavoriteJobStatusMarkup(favoriteId) {
  const job =
    getActiveFavoriteRunJobByFavoriteId(state.favoriteJobs, favoriteId)
    || getLatestFavoriteRunJobByFavoriteId(state.favoriteJobs, favoriteId);
  if (!job?.jobId) {
    return "";
  }

  const statusLabel =
    job.status === "queued"
      ? (chrome.i18n.getMessage("favorite_job_status_queued") || "Queued")
      : job.status === "running"
        ? (chrome.i18n.getMessage("favorite_job_status_running") || "Running")
        : job.status === "completed"
          ? (chrome.i18n.getMessage("favorite_job_status_completed") || "Done")
          : job.status === "failed"
            ? (chrome.i18n.getMessage("favorite_job_status_failed") || "Failed")
            : (chrome.i18n.getMessage("favorite_job_status_skipped") || "Skipped");
  const detail = job.stepCount > 1 ? `${Math.min(job.completedSteps, job.stepCount)}/${job.stepCount}` : "";

  return `
    <div class="schedule-job-status">
      <span class="status-pill ${escapeHTML(job.status)}">${escapeHTML(statusLabel)}</span>
      ${detail ? `<span>${escapeHTML(detail)}</span>` : ""}
    </div>
  `;
}

export function renderSchedulesSection() {
  const scheduledFavorites = [...state.favorites]
    .filter((favorite) => favorite?.scheduleEnabled || favorite?.scheduledAt)
    .sort((left, right) => {
      const leftTime = Date.parse(String(left?.scheduledAt ?? "")) || Number.MAX_SAFE_INTEGER;
      const rightTime = Date.parse(String(right?.scheduledAt ?? "")) || Number.MAX_SAFE_INTEGER;
      return leftTime - rightTime;
    });

  if (scheduledFavorites.length === 0) {
    schedulesList.innerHTML = createEmptyState(t.schedules.empty);
    return;
  }

  schedulesList.innerHTML = scheduledFavorites
    .map((favorite) => {
      const scheduledRunSummary = buildScheduledFavoriteRunSummary(state.history, favorite.id);
      return `
        <article class="settings-control schedule-card" data-schedule-favorite-id="${escapeHTML(favorite.id)}">
          <div class="schedule-card-head">
            <div>
              <h3>${escapeHTML(favorite.title || previewText(favorite.text, 42))}</h3>
              <p>${escapeHTML(previewText(favorite.text, 88))}</p>
              ${buildFavoriteJobStatusMarkup(favorite.id)}
            </div>
            <label class="checkbox-inline" for="schedule-enabled-${escapeHTML(favorite.id)}">
              <input
                id="schedule-enabled-${escapeHTML(favorite.id)}"
                type="checkbox"
                data-schedule-enabled="${escapeHTML(favorite.id)}"
                ${favorite.scheduleEnabled ? "checked" : ""}
              />
              <span>${escapeHTML(t.schedules.enabled)}</span>
            </label>
          </div>
          <div class="schedule-meta-grid">
            <div>
              <strong>${escapeHTML(t.schedules.nextRun)}</strong>
              <div>${escapeHTML(favorite.scheduledAt ? formatDateTime(favorite.scheduledAt) : t.schedules.never)}</div>
            </div>
            <div>
              <strong>${escapeHTML(t.schedules.repeat)}</strong>
              <div>${escapeHTML(getScheduleRepeatLabel(favorite.scheduleRepeat))}</div>
            </div>
            <div>
              <strong>${escapeHTML(t.schedules.lastScheduledRun)}</strong>
              <div>${escapeHTML(scheduledRunSummary?.createdAt ? formatDateTime(scheduledRunSummary.createdAt) : t.schedules.never)}</div>
            </div>
            <div>
              <strong>${escapeHTML(t.schedules.scheduledResult)}</strong>
              <div>${escapeHTML(scheduledRunSummary ? getStatusInfo(scheduledRunSummary.status).label : t.schedules.never)}</div>
            </div>
          </div>
          ${buildScheduledRunDetailMarkup(scheduledRunSummary)}
          <div class="schedule-card-actions">
            <button class="btn" type="button" data-action="run-schedule-favorite" data-favorite-id="${escapeHTML(favorite.id)}">${escapeHTML(t.schedules.runNow)}</button>
            <button class="btn ghost" type="button" data-action="open-schedule-favorite" data-favorite-id="${escapeHTML(favorite.id)}">${escapeHTML(t.schedules.openInPopup)}</button>
          </div>
        </article>
      `;
    })
    .join("");
}
