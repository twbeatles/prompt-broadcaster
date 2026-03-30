import { logError } from "./dom";

export async function sendRuntimeMessage(message: unknown): Promise<unknown> {
  try {
    return await chrome.runtime.sendMessage(message as object);
  } catch (error) {
    const action = typeof message === "object" && message && "action" in (message as Record<string, unknown>)
      ? String((message as Record<string, unknown>).action)
      : "unknown";
    logError(`Runtime message failed: ${action}`, error);
    return null;
  }
}

export async function copyPromptToClipboard(prompt: string): Promise<boolean> {
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(prompt);
      return true;
    }
  } catch (error) {
    logError("navigator.clipboard.writeText failed", error);
  }

  try {
    const helper = document.createElement("textarea");
    helper.value = prompt;
    helper.setAttribute("readonly", "true");
    Object.assign(helper.style, {
      position: "fixed",
      top: "-9999px",
      left: "-9999px",
      opacity: "0",
    });

    document.body.appendChild(helper);
    helper.focus();
    helper.select();
    const copied = document.execCommand("copy");
    helper.remove();
    return copied;
  } catch (error) {
    logError("execCommand copy fallback failed", error);
    return false;
  }
}
