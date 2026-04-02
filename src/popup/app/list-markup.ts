// @ts-nocheck
import { msg, t } from "./i18n";
import {
  escapeAttribute,
  escapeHtml,
  formatDate,
  getSiteIcon,
  normalizeSiteIdList,
  previewText,
} from "./helpers";

export function buildEmptyState(message) {
  return `
    <div class="empty-state">
      <div>${escapeHtml(message)}</div>
      <button class="empty-action" type="button" data-switch-tab="compose">${escapeHtml(t.emptyActionCompose)}</button>
    </div>
  `;
}

export function getHistorySelectedSiteIds(item) {
  return normalizeSiteIdList(
    Array.isArray(item?.requestedSiteIds) && item.requestedSiteIds.length > 0
      ? item.requestedSiteIds
      : item?.sentTo
  );
}

export function renderServiceBadges(siteIds = [], runtimeSites = []) {
  return siteIds
    .map((siteId) => {
      const site = runtimeSites.find((entry) => entry.id === siteId);
      const label = getSiteIcon(site) ?? siteId.slice(0, 2).toUpperCase();
      return `<span class="service-badge">${escapeHtml(label)}</span>`;
    })
    .join("");
}

export function buildHistoryItemMarkup(item, { openMenuKey = null, runtimeSites = [] } = {}) {
  const menuKey = `history:${item.id}`;

  return `
    <article class="prompt-item" data-history-id="${item.id}" role="listitem">
      <button class="prompt-main" type="button" data-load-history="${item.id}">
        <div class="prompt-preview">${escapeHtml(previewText(item.text))}</div>
        <div class="prompt-meta">
          <div class="service-icons">${renderServiceBadges(getHistorySelectedSiteIds(item), runtimeSites)}</div>
          <span>${escapeHtml(formatDate(item.createdAt))}</span>
        </div>
      </button>
      <div class="prompt-actions">
        <button class="menu-button" type="button" aria-haspopup="menu" aria-expanded="${openMenuKey === menuKey ? "true" : "false"}" aria-label="${escapeAttribute(t.menuMore)}" data-toggle-menu="${escapeAttribute(menuKey)}">...</button>
        <div class="item-menu ${openMenuKey === menuKey ? "open" : ""}">
          <button class="menu-item" type="button" data-action="resend-history" data-history-id="${item.id}">${escapeHtml(t.historyResend)}</button>
          <button class="menu-item" type="button" data-action="favorite" data-history-id="${item.id}">${escapeHtml(t.addFavorite)}</button>
          <button class="menu-item danger" type="button" data-action="delete-history" data-history-id="${item.id}">${escapeHtml(t.delete)}</button>
        </div>
      </div>
    </article>
  `;
}

function buildFavoriteTagsMarkup(item) {
  const tags = Array.isArray(item.tags) ? item.tags : [];
  const folder = typeof item.folder === "string" && item.folder.trim() ? item.folder.trim() : "";
  const pinIcon = item.pinned ? `<span class="fav-pin-icon" title="${escapeHtml(msg("popup_favorite_pinned") || "Pinned")}">📌</span>` : "";
  const folderBadge = folder ? `<span class="fav-folder-badge" data-filter-folder="${escapeAttribute(folder)}">📁 ${escapeHtml(folder)}</span>` : "";
  const tagChips = tags.map(
    (tag) => `<span class="fav-tag-chip" data-filter-tag="${escapeAttribute(tag)}">#${escapeHtml(tag)}</span>`
  ).join("");

  if (!pinIcon && !folderBadge && !tagChips) {
    return "";
  }

  return `<div class="fav-meta-row">${pinIcon}${folderBadge}${tagChips}</div>`;
}

export function buildFavoriteItemMarkup(item, { openMenuKey = null, runtimeSites = [] } = {}) {
  const menuKey = `favorite:${item.id}`;
  const safeFavoriteId = escapeAttribute(item.id);
  const pinLabel = item.pinned
    ? (msg("popup_favorite_unpin") || "Unpin")
    : (msg("popup_favorite_pin") || "Pin");

  return `
    <article class="prompt-item${item.pinned ? " pinned-item" : ""}" data-favorite-id="${safeFavoriteId}" role="listitem">
      <div class="favorite-title-row">
        <span class="favorite-star">${escapeHtml(t.favoriteStar)}</span>
        <input
          class="favorite-title-input"
          type="text"
          data-favorite-title="${safeFavoriteId}"
          value="${escapeAttribute(item.title)}"
          placeholder="${escapeAttribute(t.titlePlaceholder)}"
        />
      </div>
      ${buildFavoriteTagsMarkup(item)}
      <button class="prompt-main" type="button" data-load-favorite="${safeFavoriteId}">
        <div class="prompt-preview">${escapeHtml(previewText(item.text))}</div>
        <div class="prompt-meta">
          <div class="service-icons">${renderServiceBadges(item.sentTo, runtimeSites)}</div>
          <span>${escapeHtml(formatDate(item.createdAt))}</span>
        </div>
      </button>
      <div class="prompt-actions">
        <button class="menu-button" type="button" aria-haspopup="menu" aria-expanded="${openMenuKey === menuKey ? "true" : "false"}" aria-label="${escapeAttribute(t.menuMore)}" data-toggle-menu="${escapeAttribute(menuKey)}">...</button>
        <div class="item-menu ${openMenuKey === menuKey ? "open" : ""}">
          <button class="menu-item" type="button" data-action="duplicate-favorite" data-favorite-id="${safeFavoriteId}">${escapeHtml(t.favoriteDuplicate)}</button>
          <button class="menu-item" type="button" data-action="edit-favorite-tags" data-favorite-id="${safeFavoriteId}">${escapeHtml(msg("popup_favorite_edit_tags") || "Edit tags & folder")}</button>
          <button class="menu-item" type="button" data-action="toggle-pin-favorite" data-favorite-id="${safeFavoriteId}">${escapeHtml(pinLabel)}</button>
          <button class="menu-item danger" type="button" data-action="delete-favorite" data-favorite-id="${safeFavoriteId}">${escapeHtml(t.delete)}</button>
        </div>
      </div>
    </article>
  `;
}

export function buildImportReportMarkup(summary) {
  if (!summary) {
    return "";
  }

  const rejectedRows = (summary.customSites?.rejected ?? []).map((entry) => {
    const origins = Array.isArray(entry?.origins) && entry.origins.length > 0
      ? `<div class="helper-text">${escapeHtml(entry.origins.join(", "))}</div>`
      : "";
    return `
      <div class="import-report-row">
        <strong>${escapeHtml(entry?.name ?? entry?.id ?? "-")}</strong>
        <div>${escapeHtml(t.importRejectReason(entry?.reason ?? "unknown"))}</div>
        ${origins}
      </div>
    `;
  }).join("");

  return `
    <div class="import-report-grid">
      <div class="import-report-row"><strong>${escapeHtml(t.importReportVersion)}</strong><div>${escapeHtml(`v${summary.version} (from v${summary.migratedFromVersion})`)}</div></div>
      <div class="import-report-row"><strong>${escapeHtml(t.importReportAccepted)}</strong><div>${escapeHtml(String(summary.customSites?.acceptedNames?.join(", ") || "-"))}</div></div>
      <div class="import-report-row"><strong>${escapeHtml(t.importReportRewritten)}</strong><div>${escapeHtml(String(summary.customSites?.rewrittenIds?.join(", ") || "-"))}</div></div>
      <div class="import-report-row"><strong>${escapeHtml(t.importReportBuiltins)}</strong><div>${escapeHtml([
        ...(summary.builtInSiteOverrides?.adjustedIds ?? []),
        ...(summary.builtInSiteOverrides?.droppedIds ?? []),
        ...(summary.builtInSiteStates?.droppedIds ?? []),
      ].join(", ") || "-")}</div></div>
      <div class="import-report-section-title">${escapeHtml(t.importReportRejected)}</div>
      ${rejectedRows || `<div class="helper-text">${escapeHtml(t.importReportRejectedEmpty)}</div>`}
    </div>
  `;
}
