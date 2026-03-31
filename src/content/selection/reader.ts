// @ts-nocheck
export function logSelectionError(context, error) {
  console.error(`[AI Prompt Broadcaster] ${context}`, error);
}

export function getSelectionText() {
  try {
    return window.getSelection()?.toString().trim() ?? "";
  } catch (error) {
    logSelectionError("Failed to read window selection.", error);
    return "";
  }
}
