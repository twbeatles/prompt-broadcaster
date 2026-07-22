/** Site-level alert key — avoids re-notifying when only missing-field strings differ. */
export const SELECTOR_ALERT_PROMOTE_THRESHOLD = 3;

/** Injector desktop notifications: at most once per site within this window. */
export const SELECTOR_NOTIFY_COOLDOWN_MS = 60 * 60 * 1000;

function normalizeText(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

/**
 * Stable per-service signature used for pending promotion and desktop-notification
 * de-dupe. Intentionally ignores individual missing selector strings so minor
 * report variations do not reset the strike counter or fire extra alerts.
 */
export function buildSelectorAlertSignature(report: {
  siteId?: unknown;
  missing?: Array<{ field?: unknown; selector?: unknown }>;
} | null | undefined): string {
  return normalizeText(report?.siteId) || "unknown";
}

export function shouldAllowSelectorNotification(
  lastNotifiedAt: unknown,
  nowMs = Date.now(),
  cooldownMs = SELECTOR_NOTIFY_COOLDOWN_MS
): boolean {
  const last = Number(lastNotifiedAt);
  if (!Number.isFinite(last) || last <= 0) {
    return true;
  }

  return nowMs - last >= Math.max(0, Number(cooldownMs) || 0);
}
