function normalizeText(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

export function buildSelectorAlertSignature(report: {
  siteId?: unknown;
  missing?: Array<{ field?: unknown; selector?: unknown }>;
} | null | undefined): string {
  const siteId = normalizeText(report?.siteId) || "unknown";
  const missingEntries = (Array.isArray(report?.missing) ? report.missing : [])
    .map((entry) => `${normalizeText(entry?.field)}:${normalizeText(entry?.selector)}`)
    .filter((entry) => entry !== ":")
    .sort();

  return [siteId, ...missingEntries].join("|");
}
