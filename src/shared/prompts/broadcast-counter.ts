// @ts-nocheck
import { LOCAL_STORAGE_KEYS } from "./constants";
import { normalizeBroadcastCounter } from "./normalizers";
import { readLocal, writeLocal } from "./storage";

export async function getBroadcastCounter() {
  try {
    const rawValue = await readLocal(LOCAL_STORAGE_KEYS.broadcastCounter, 0);
    return normalizeBroadcastCounter(rawValue);
  } catch (_error) {
    return 0;
  }
}

export async function setBroadcastCounter(value) {
  const normalized = normalizeBroadcastCounter(value);
  await writeLocal(LOCAL_STORAGE_KEYS.broadcastCounter, normalized);
  return normalized;
}

export async function recordQueuedBroadcast(queuedSiteCount) {
  try {
    if (normalizeBroadcastCounter(queuedSiteCount) <= 0) {
      return getBroadcastCounter();
    }

    const current = await getBroadcastCounter();
    return setBroadcastCounter(current + 1);
  } catch (_error) {
    return getBroadcastCounter();
  }
}
