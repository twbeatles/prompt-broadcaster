import { SESSION_RUNTIME_KEYS } from "./constants";
import { readStorage, removeStorageKeys, writeStorage } from "./storage";
import type { PopupFavoriteIntent } from "../types/models";

function normalizePopupFavoriteIntent(value: unknown): PopupFavoriteIntent | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }

  const source = value as Record<string, unknown>;
  const type = source.type === "run" ? "run" : source.type === "edit" ? "edit" : "";
  const favoriteId = typeof source.favoriteId === "string" ? source.favoriteId.trim() : "";

  if (!type || !favoriteId) {
    return null;
  }

  return {
    type,
    favoriteId,
    reason: typeof source.reason === "string" && source.reason.trim() ? source.reason.trim() : "",
    source:
      source.source === "popup" ||
      source.source === "scheduled" ||
      source.source === "palette" ||
      source.source === "options" ||
      source.source === "options-edit"
        ? source.source
        : undefined,
    createdAt:
      typeof source.createdAt === "string" && Number.isFinite(Date.parse(source.createdAt))
        ? new Date(source.createdAt).toISOString()
        : new Date().toISOString(),
  };
}

export async function getPopupFavoriteIntent(): Promise<PopupFavoriteIntent | null> {
  const value = await readStorage("session", SESSION_RUNTIME_KEYS.popupFavoriteIntent, null);
  return normalizePopupFavoriteIntent(value);
}

export async function setPopupFavoriteIntent(
  intent: PopupFavoriteIntent | null
): Promise<PopupFavoriteIntent | null> {
  const normalized = normalizePopupFavoriteIntent(intent);

  if (!normalized) {
    await removeStorageKeys("session", [SESSION_RUNTIME_KEYS.popupFavoriteIntent]);
    return null;
  }

  await writeStorage("session", SESSION_RUNTIME_KEYS.popupFavoriteIntent, normalized);
  return normalized;
}

export async function consumePopupFavoriteIntent(): Promise<PopupFavoriteIntent | null> {
  const current = await getPopupFavoriteIntent();
  await setPopupFavoriteIntent(null);
  return current;
}
