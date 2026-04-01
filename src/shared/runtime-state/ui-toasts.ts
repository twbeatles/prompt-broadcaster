import { SESSION_RUNTIME_KEYS } from "./constants";
import { normalizeArray, normalizeUiToast } from "./normalizers";
import { readStorage, writeStorage } from "./storage";
import type { UiToast } from "../types/models";

export async function getPendingUiToasts(): Promise<UiToast[]> {
  const rawValue = await readStorage("session", SESSION_RUNTIME_KEYS.pendingUiToasts, []);
  return normalizeArray(rawValue).map((entry) => normalizeUiToast(entry));
}

export async function setPendingUiToasts(entries: unknown[]): Promise<UiToast[]> {
  const normalized = normalizeArray(entries).map((entry) => normalizeUiToast(entry));
  await writeStorage("session", SESSION_RUNTIME_KEYS.pendingUiToasts, normalized);
  return normalized;
}

export async function enqueueUiToast(entry: unknown): Promise<UiToast[]> {
  const current = await getPendingUiToasts();
  const next = [...current, normalizeUiToast(entry)].slice(-20);
  await setPendingUiToasts(next);
  return next;
}

export async function drainPendingUiToasts(): Promise<UiToast[]> {
  const current = await getPendingUiToasts();
  await setPendingUiToasts([]);
  return current;
}
