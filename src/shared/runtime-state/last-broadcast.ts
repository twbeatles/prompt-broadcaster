// @ts-nocheck
import { SESSION_RUNTIME_KEYS } from "./constants";
import { normalizeLastBroadcast } from "./normalizers";
import { readStorage, writeStorage } from "./storage";

export async function getLastBroadcast() {
  const value = await readStorage("session", SESSION_RUNTIME_KEYS.lastBroadcast, null);
  return normalizeLastBroadcast(value);
}

export async function setLastBroadcast(broadcast) {
  const normalized = normalizeLastBroadcast(broadcast);
  await writeStorage("session", SESSION_RUNTIME_KEYS.lastBroadcast, normalized);
  return normalized;
}
