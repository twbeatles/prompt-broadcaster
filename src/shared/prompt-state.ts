import type { PopupPromptIntent } from "./types/models";

export const LOCAL_PROMPT_STATE_KEYS = Object.freeze({
  composeDraftPrompt: "composeDraftPrompt",
  lastSentPrompt: "lastSentPrompt",
  legacyLastPrompt: "lastPrompt",
});

export const SESSION_PROMPT_STATE_KEYS = Object.freeze({
  popupPromptIntent: "popupPromptIntent",
});

function normalizePrompt(value: unknown): string {
  return typeof value === "string" ? value : "";
}

function normalizePopupPromptIntent(value: unknown): PopupPromptIntent | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }

  const source = value as Record<string, unknown>;
  const prompt = normalizePrompt(source.prompt);
  const createdAt =
    typeof source.createdAt === "string" && Number.isFinite(Date.parse(source.createdAt))
      ? new Date(source.createdAt).toISOString()
      : new Date().toISOString();

  return {
    prompt,
    createdAt,
  };
}

export async function getComposeDraftPrompt(): Promise<string> {
  const result = await chrome.storage.local.get([
    LOCAL_PROMPT_STATE_KEYS.composeDraftPrompt,
    LOCAL_PROMPT_STATE_KEYS.legacyLastPrompt,
  ]);

  if (typeof result[LOCAL_PROMPT_STATE_KEYS.composeDraftPrompt] === "string") {
    return normalizePrompt(result[LOCAL_PROMPT_STATE_KEYS.composeDraftPrompt]);
  }

  return normalizePrompt(result[LOCAL_PROMPT_STATE_KEYS.legacyLastPrompt]);
}

export async function setComposeDraftPrompt(prompt: string): Promise<void> {
  await chrome.storage.local.set({
    [LOCAL_PROMPT_STATE_KEYS.composeDraftPrompt]: normalizePrompt(prompt),
  });
}

export async function getLastSentPrompt(): Promise<string> {
  const result = await chrome.storage.local.get(LOCAL_PROMPT_STATE_KEYS.lastSentPrompt);
  return normalizePrompt(result[LOCAL_PROMPT_STATE_KEYS.lastSentPrompt]);
}

export async function setLastSentPrompt(prompt: string): Promise<void> {
  await chrome.storage.local.set({
    [LOCAL_PROMPT_STATE_KEYS.lastSentPrompt]: normalizePrompt(prompt),
  });
}

export async function getPopupPromptIntent(): Promise<PopupPromptIntent | null> {
  const result = await chrome.storage.session.get(SESSION_PROMPT_STATE_KEYS.popupPromptIntent);
  return normalizePopupPromptIntent(result[SESSION_PROMPT_STATE_KEYS.popupPromptIntent]);
}

export async function setPopupPromptIntent(
  value: PopupPromptIntent | string | null
): Promise<PopupPromptIntent | null> {
  const normalized = normalizePopupPromptIntent(
    typeof value === "string"
      ? {
          prompt: value,
          createdAt: new Date().toISOString(),
        }
      : value
  );

  if (!normalized) {
    await chrome.storage.session.remove([SESSION_PROMPT_STATE_KEYS.popupPromptIntent]);
    return null;
  }

  await chrome.storage.session.set({
    [SESSION_PROMPT_STATE_KEYS.popupPromptIntent]: normalized,
  });
  return normalized;
}

export async function consumePopupPromptIntent(): Promise<PopupPromptIntent | null> {
  const current = await getPopupPromptIntent();
  await setPopupPromptIntent(null);
  return current;
}
