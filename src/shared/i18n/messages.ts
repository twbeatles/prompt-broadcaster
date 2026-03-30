export function getUiLanguage(): string {
  return chrome.i18n.getUILanguage().toLowerCase();
}

export function isKoreanUi(): boolean {
  const language = getUiLanguage();
  return language === "ko" || language.startsWith("ko-");
}

export function getMessage(key: string, substitutions?: string | string[]): string {
  return chrome.i18n.getMessage(key, substitutions as never) || "";
}
