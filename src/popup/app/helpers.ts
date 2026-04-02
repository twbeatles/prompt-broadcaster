// @ts-nocheck
import { isKorean } from "./i18n";
import { SITE_EMOJI } from "./state";

export function escapeAttribute(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

export function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export function getSiteIcon(site) {
  if (site?.icon) {
    return site.icon;
  }

  return SITE_EMOJI[site?.id] ?? site?.name?.slice(0, 2)?.toUpperCase() ?? "AI";
}

export function isTextEditingTarget(target) {
  if (!target || !(target instanceof Element)) {
    return false;
  }

  return (
    target instanceof HTMLInputElement ||
    target instanceof HTMLTextAreaElement ||
    target instanceof HTMLSelectElement ||
    target.isContentEditable
  );
}

export function compareDateValues(leftValue, rightValue) {
  const leftTime = Date.parse(String(leftValue ?? "")) || 0;
  const rightTime = Date.parse(String(rightValue ?? "")) || 0;
  return rightTime - leftTime;
}

export function previewText(text, maxLength = 50) {
  const collapsed = String(text).replace(/\s+/g, " ").trim();
  if (collapsed.length <= maxLength) {
    return collapsed || "-";
  }

  return `${collapsed.slice(0, maxLength)}...`;
}

export function formatDate(isoString) {
  try {
    return new Intl.DateTimeFormat(isKorean ? "ko-KR" : "en-US", {
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    }).format(new Date(isoString));
  } catch (_error) {
    return isoString;
  }
}

export function normalizeSiteIdList(value) {
  if (!Array.isArray(value)) {
    return [];
  }

  return Array.from(
    new Set(
      value
        .filter((entry) => typeof entry === "string" && entry.trim())
        .map((entry) => entry.trim())
    )
  );
}

export function joinMultilineValues(values) {
  return Array.isArray(values) ? values.join("\n") : "";
}

export function splitMultilineValues(value) {
  return String(value ?? "")
    .split(/\r?\n/g)
    .map((entry) => entry.trim())
    .filter(Boolean);
}
