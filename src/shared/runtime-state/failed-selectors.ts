import { LOCAL_RUNTIME_KEYS } from "./constants";
import {
  normalizeArray,
  normalizeFailedSelectorEntry,
  safeText,
} from "./normalizers";
import { readStorage, writeStorage } from "./storage";
import type { FailedSelectorRecord } from "../types/models";

export async function getFailedSelectors(): Promise<FailedSelectorRecord[]> {
  const rawValue = await readStorage("local", LOCAL_RUNTIME_KEYS.failedSelectors, []);
  return normalizeArray(rawValue)
    .map((entry) => normalizeFailedSelectorEntry(entry))
    .filter((entry) => entry.serviceId);
}

export async function setFailedSelectors(entries: unknown[]): Promise<FailedSelectorRecord[]> {
  const normalized = normalizeArray(entries)
    .map((entry) => normalizeFailedSelectorEntry(entry))
    .filter((entry) => entry.serviceId);
  await writeStorage("local", LOCAL_RUNTIME_KEYS.failedSelectors, normalized);
  return normalized;
}

export async function markFailedSelector(
  serviceId: unknown,
  selector = "",
  source = "injector"
): Promise<FailedSelectorRecord[]> {
  const normalizedServiceId = safeText(serviceId);
  if (!normalizedServiceId) {
    return [];
  }

  const current = await getFailedSelectors();
  const next = [
    {
      serviceId: normalizedServiceId,
      selector: safeText(selector),
      source: safeText(source),
      timestamp: new Date().toISOString(),
    },
    ...current.filter((entry) => entry.serviceId !== normalizedServiceId),
  ];

  return setFailedSelectors(next);
}

export async function clearFailedSelector(serviceId: unknown): Promise<FailedSelectorRecord[]> {
  const normalizedServiceId = safeText(serviceId);
  const current = await getFailedSelectors();
  const next = current.filter((entry) => entry.serviceId !== normalizedServiceId);
  await setFailedSelectors(next);
  return next;
}
