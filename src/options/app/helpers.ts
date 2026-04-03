// @ts-nocheck
import { AI_SITES } from "../../config/sites";
import { getTargetSnapshotSiteIds } from "../../shared/broadcast/target-snapshots";
import { escapeHTML } from "../../shared/security";
import { isKorean, locale, t } from "./i18n";

export function buildImportSummaryText(summary, { short = false } = {}) {
  const acceptedCount = summary?.customSites?.acceptedIds?.length ?? 0;
  const rejectedCount = summary?.customSites?.rejected?.length ?? 0;
  const rewrittenCount = summary?.customSites?.rewrittenIds?.length ?? 0;
  const deniedCount = (summary?.customSites?.rejected ?? []).filter(
    (entry) => entry?.reason === "permission_denied"
  ).length;
  const overrideAdjustedCount = summary?.builtInSiteOverrides?.adjustedIds?.length ?? 0;
  const overrideDroppedCount = summary?.builtInSiteOverrides?.droppedIds?.length ?? 0;
  const stateDroppedCount = summary?.builtInSiteStates?.droppedIds?.length ?? 0;

  if (isKorean) {
    const parts = [
      `가져오기 완료: 커스텀 서비스 ${acceptedCount}개 적용`,
      rejectedCount > 0 ? `건너뜀 ${rejectedCount}개` : "",
      rewrittenCount > 0 ? `ID 재작성 ${rewrittenCount}개` : "",
      deniedCount > 0 ? `권한 거부 ${deniedCount}개` : "",
    ].filter(Boolean);

    if (!short && overrideAdjustedCount + overrideDroppedCount + stateDroppedCount > 0) {
      parts.push(
        `기본 서비스 보정 ${overrideAdjustedCount + overrideDroppedCount + stateDroppedCount}개`
      );
    }

    return parts.join(", ");
  }

  const parts = [
    `Import complete: ${acceptedCount} custom service(s) applied`,
    rejectedCount > 0 ? `${rejectedCount} skipped` : "",
    rewrittenCount > 0 ? `${rewrittenCount} id rewrite(s)` : "",
    deniedCount > 0 ? `${deniedCount} permission denial(s)` : "",
  ].filter(Boolean);

  if (!short && overrideAdjustedCount + overrideDroppedCount + stateDroppedCount > 0) {
    parts.push(
      `${overrideAdjustedCount + overrideDroppedCount + stateDroppedCount} built-in adjustment(s)`
    );
  }

  return parts.join(", ");
}

export function formatDateTime(value) {
  try {
    return new Intl.DateTimeFormat(locale, {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    }).format(new Date(value));
  } catch (_error) {
    return value;
  }
}

export function formatShortDate(value) {
  try {
    return new Intl.DateTimeFormat(locale, {
      month: "numeric",
      day: "numeric",
    }).format(new Date(value));
  } catch (_error) {
    return value;
  }
}

export function previewText(text, maxLength = 60) {
  const collapsed = String(text ?? "").replace(/\s+/g, " ").trim();
  return collapsed.length <= maxLength ? collapsed || "-" : `${collapsed.slice(0, maxLength)}...`;
}

export function getSiteLabel(siteId, runtimeSites = []) {
  return runtimeSites.find((site) => site.id === siteId)?.name
    ?? AI_SITES.find((site) => site.id === siteId)?.name
    ?? siteId;
}

export function getRequestedServices(entry) {
  const snapshotSiteIds = getTargetSnapshotSiteIds(entry);
  if (snapshotSiteIds.length > 0) {
    return snapshotSiteIds;
  }

  const siteResultKeys = Object.keys(entry.siteResults ?? {});
  return siteResultKeys.length > 0 ? siteResultKeys : entry.sentTo ?? [];
}

export function getSubmittedServices(entry) {
  if (Array.isArray(entry?.submittedSiteIds) && entry.submittedSiteIds.length > 0) {
    return entry.submittedSiteIds;
  }

  return entry.sentTo ?? [];
}

export function getStatusInfo(status) {
  switch (status) {
    case "submitted":
      return { label: t.statuses.submitted, className: "success" };
    case "partial":
      return { label: t.statuses.partial, className: "partial" };
    case "failed":
      return { label: t.statuses.failed, className: "failed" };
    default:
      return { label: status || t.statuses.unknown, className: "" };
  }
}

export function buildBadgeMarkup(siteId, runtimeSites = []) {
  return `<span class="badge">${escapeHTML(getSiteLabel(siteId, runtimeSites))}</span>`;
}

export function createEmptyState(message) {
  return `<div class="empty-state">${escapeHTML(message)}</div>`;
}

export function buildImportReportMarkup(summary) {
  if (!summary) {
    return "";
  }

  const rejectedRows = (summary.customSites?.rejected ?? []).map((entry) => {
    const origins = Array.isArray(entry?.origins) && entry.origins.length > 0
      ? `<div class="helper">${escapeHTML(entry.origins.join(", "))}</div>`
      : "";
    const errors = Array.isArray(entry?.errors) && entry.errors.length > 0
      ? `<div class="helper">${escapeHTML(entry.errors.join(" "))}</div>`
      : "";
    return `
      <div class="settings-control">
        <strong>${escapeHTML(entry?.name ?? entry?.id ?? "-")}</strong>
        <div>${escapeHTML(t.settings.importRejectReason(entry?.reason ?? "unknown"))}</div>
        ${origins}
        ${errors}
      </div>
    `;
  }).join("");

  return `
    <div class="settings-control">
      <strong>${escapeHTML(t.settings.importReportVersion)}</strong>
      <div>${escapeHTML(`v${summary.version} (from v${summary.migratedFromVersion})`)}</div>
    </div>
    <div class="settings-control">
      <strong>${escapeHTML(t.settings.importReportAccepted)}</strong>
      <div>${escapeHTML(summary.customSites?.acceptedNames?.join(", ") || "-")}</div>
    </div>
    <div class="settings-control">
      <strong>${escapeHTML(t.settings.importReportRewritten)}</strong>
      <div>${escapeHTML(summary.customSites?.rewrittenIds?.join(", ") || "-")}</div>
    </div>
    <div class="settings-control">
      <strong>${escapeHTML(t.settings.importReportBuiltins)}</strong>
      <div>${escapeHTML([
        ...(summary.builtInSiteOverrides?.adjustedIds ?? []),
        ...(summary.builtInSiteOverrides?.droppedIds ?? []),
        ...(summary.builtInSiteStates?.droppedIds ?? []),
      ].join(", ") || "-")}</div>
    </div>
    <div class="settings-control">
      <strong>${escapeHTML(t.settings.importReportRejected)}</strong>
      ${rejectedRows || `<div class="helper">${escapeHTML(t.settings.importReportRejectedEmpty)}</div>`}
    </div>
  `;
}
