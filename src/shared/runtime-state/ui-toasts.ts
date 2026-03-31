// @ts-nocheck
import { SESSION_RUNTIME_KEYS } from "./constants";
import { normalizeArray, normalizeUiToast } from "./normalizers";
import { readStorage, writeStorage } from "./storage";

export async function getPendingUiToasts() {
  const rawValue = await readStorage("session", SESSION_RUNTIME_KEYS.pendingUiToasts, []);
  return normalizeArray(rawValue).map((entry) => normalizeUiToast(entry));
}

export async function setPendingUiToasts(entries) {
  const normalized = normalizeArray(entries).map((entry) => normalizeUiToast(entry));
  await writeStorage("session", SESSION_RUNTIME_KEYS.pendingUiToasts, normalized);
  return normalized;
}

export async function enqueueUiToast(entry) {
  const current = await getPendingUiToasts();
  const next = [...current, normalizeUiToast(entry)].slice(-20);
  await setPendingUiToasts(next);
  return next;
}

export async function drainPendingUiToasts() {
  const current = await getPendingUiToasts();
  await setPendingUiToasts([]);
  return current;
}
