import { deriveHostname, normalizeHostname, safeText } from "./core";
import type { PlainRecord } from "./types";

export function createCustomSiteId(name: unknown): string {
  const slug = safeText(name)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 32);

  return `custom-${slug || Date.now()}-${Date.now().toString(36).slice(-4)}`;
}

export function createImportedCustomSiteIdBase(
  site: PlainRecord | null | undefined,
  index = 0,
): string {
  const seed = [
    safeText(site?.id),
    safeText(site?.name),
    normalizeHostname(site?.hostname || deriveHostname(site?.url)),
    `site-${index + 1}`,
  ].find(Boolean);

  const slug = safeText(seed)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 32);

  return `custom-${slug || `site-${index + 1}`}`;
}

export function ensureUniqueImportedSiteId(
  baseId: unknown,
  usedIds: Set<string>,
): string {
  let candidate = safeText(baseId) || "custom-site";
  let suffix = 2;

  while (usedIds.has(candidate)) {
    candidate = `${safeText(baseId)}-${suffix}`;
    suffix += 1;
  }

  usedIds.add(candidate);
  return candidate;
}
