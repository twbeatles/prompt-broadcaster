// @ts-nocheck
import { updateFavoritePrompt } from "../../shared/prompts";
import { getLatestFavoriteRunJobByFavoriteId } from "../../shared/runtime-state";
import { escapeHTML } from "../../shared/security";
import { optionsDom } from "../app/dom";
import { t } from "../app/i18n";
import { state } from "../app/state";
import {
  createEmptyState,
  formatDateTime,
  getStatusInfo,
  previewText,
} from "../app/helpers";
import { setStatus, showAppToast } from "../core/status";

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

function getLastFavoriteRun(favoriteId) {
  return state.history.find((entry) => String(entry.originFavoriteId ?? "") === String(favoriteId)) ?? null;
}

function buildFavoriteJobStatusMarkup(favoriteId) {
  const job = getLatestFavoriteRunJobByFavoriteId(state.favoriteJobs, favoriteId);
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
      const lastRun = getLastFavoriteRun(favorite.id);
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
              <strong>${escapeHTML(t.schedules.lastRun)}</strong>
              <div>${escapeHTML(lastRun?.createdAt ? formatDateTime(lastRun.createdAt) : t.schedules.never)}</div>
            </div>
            <div>
              <strong>${escapeHTML(t.history.tableStatus)}</strong>
              <div>${escapeHTML(lastRun ? getStatusInfo(lastRun.status).label : t.schedules.never)}</div>
            </div>
          </div>
          <div class="schedule-card-actions">
            <button class="btn" type="button" data-action="run-schedule-favorite" data-favorite-id="${escapeHTML(favorite.id)}">${escapeHTML(t.schedules.runNow)}</button>
            <button class="btn ghost" type="button" data-action="open-schedule-favorite" data-favorite-id="${escapeHTML(favorite.id)}">${escapeHTML(t.schedules.openInPopup)}</button>
          </div>
        </article>
      `;
    })
    .join("");
}

async function runFavoriteFromOptions(favoriteId) {
  const response = await chrome.runtime.sendMessage({
    action: "favorite:run",
    favoriteId,
    trigger: "options",
    allowPopupFallback: true,
  });

  if (response?.ok && response?.popupFallback) {
    setStatus(t.schedules.popupFallback, "success");
    showAppToast(t.schedules.popupFallback, "success", 2200);
    return;
  }

  if (response?.ok) {
    const message = response?.message ?? t.schedules.runQueued;
    setStatus(message, "success");
    showAppToast(message, "success", 2200);
    return;
  }

  throw new Error(response?.error ?? t.saveFailed);
}

async function openFavoriteInPopup(favoriteId) {
  const response = await chrome.runtime.sendMessage({
    action: "favorite:openEditor",
    favoriteId,
    source: "options-edit",
  });

  if (!response?.ok) {
    throw new Error(response?.error ?? t.schedules.openFailed);
  }

  setStatus(t.schedules.openInPopup, "success");
  showAppToast(t.schedules.openInPopup, "success", 2000);
}

export function bindScheduleEvents({ reloadData }) {
  schedulesList.addEventListener("change", (event) => {
    const toggle = event.target.closest("[data-schedule-enabled]");
    if (!toggle) {
      return;
    }

    void updateFavoritePrompt(toggle.dataset.scheduleEnabled, {
      scheduleEnabled: Boolean(toggle.checked),
    }).then(() => reloadData()).catch((error) => {
      console.error("[AI Prompt Broadcaster] Failed to toggle favorite schedule.", error);
      setStatus(error?.message ?? t.saveFailed, "error");
      showAppToast(error?.message ?? t.saveFailed, "error", 3000);
    });
  });

  schedulesList.addEventListener("click", (event) => {
    const actionButton = event.target.closest("[data-action][data-favorite-id]");
    if (!actionButton) {
      return;
    }

    if (actionButton.dataset.action === "run-schedule-favorite") {
      void runFavoriteFromOptions(actionButton.dataset.favoriteId).catch((error) => {
        console.error("[AI Prompt Broadcaster] Failed to run favorite from options.", error);
        setStatus(error?.message ?? t.saveFailed, "error");
        showAppToast(error?.message ?? t.saveFailed, "error", 3000);
      });
      return;
    }

    if (actionButton.dataset.action === "open-schedule-favorite") {
      void openFavoriteInPopup(actionButton.dataset.favoriteId).catch((error) => {
        console.error("[AI Prompt Broadcaster] Failed to open favorite editor from options.", error);
        setStatus(error?.message ?? t.schedules.openFailed, "error");
        showAppToast(error?.message ?? t.schedules.openFailed, "error", 3000);
      });
    }
  });
}
