import { SESSION_RUNTIME_KEYS } from "./constants";
import {
  normalizeArray,
  normalizePendingSelectorCheckEntry,
} from "./normalizers";
import { readStorage, writeStorage } from "./storage";
import type { PendingSelectorCheckRecord } from "../types/models";

export async function getPendingSelectorChecks(): Promise<PendingSelectorCheckRecord[]> {
  const rawValue = await readStorage(
    "session",
    SESSION_RUNTIME_KEYS.pendingSelectorChecks,
    []
  );

  return normalizeArray(rawValue)
    .map((entry) => normalizePendingSelectorCheckEntry(entry))
    .filter((entry): entry is PendingSelectorCheckRecord => Boolean(entry));
}

export async function setPendingSelectorChecks(
  entries: unknown[]
): Promise<PendingSelectorCheckRecord[]> {
  const normalized = normalizeArray(entries)
    .map((entry) => normalizePendingSelectorCheckEntry(entry))
    .filter((entry): entry is PendingSelectorCheckRecord => Boolean(entry));
  await writeStorage(
    "session",
    SESSION_RUNTIME_KEYS.pendingSelectorChecks,
    normalized
  );
  return normalized;
}
