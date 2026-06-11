export const COMPARISON_CAPTURE_SELECTORS: Record<string, string[]> = {
  chatgpt: [
    '[data-message-author-role="assistant"]',
    'article [data-message-author-role="assistant"]',
  ],
  gemini: [
    "message-content",
    ".model-response-text",
    '[data-response-index] message-content',
  ],
  claude: [
    '[data-testid="conversation-turn-assistant"]',
    '[data-testid*="assistant" i]',
    ".font-claude-message",
  ],
  grok: [
    '[data-testid*="message" i] [class*="markdown" i]',
    '[data-testid*="answer" i]',
  ],
  perplexity: [
    '[data-testid*="answer" i]',
    '[data-testid*="thread-answer" i]',
    "main .prose",
  ],
};

export const AUTO_RESPONSE_CAPTURE_TIMEOUT_MS = 45_000;
export const AUTO_RESPONSE_CAPTURE_INTERVAL_MS = 3_000;
export const AUTO_RESPONSE_CAPTURE_MIN_LENGTH = 20;
export const AUTO_RESPONSE_CAPTURE_MEANINGFUL_DELTA = 40;

export function normalizeCapturedResponseText(value: string): string {
  return String(value || "").replace(/\s+/g, " ").trim();
}

export function isPromptEcho(responseText: string, promptText: string): boolean {
  const response = normalizeCapturedResponseText(responseText).toLowerCase();
  const prompt = normalizeCapturedResponseText(promptText).toLowerCase();
  return Boolean(prompt) && (response === prompt || response.startsWith(prompt));
}

export function shouldUpdateAutoCapturedResponse(existingText: string, nextText: string): boolean {
  const existing = normalizeCapturedResponseText(existingText);
  const next = normalizeCapturedResponseText(nextText);
  if (!next || existing === next || existing.includes(next)) {
    return false;
  }

  if (!existing || next.includes(existing)) {
    return true;
  }

  return Math.abs(next.length - existing.length) >= AUTO_RESPONSE_CAPTURE_MEANINGFUL_DELTA;
}
