export const uiLanguage = chrome.i18n.getUILanguage().toLowerCase();
export const isKorean = uiLanguage === "ko" || uiLanguage.startsWith("ko-");

export function msg(
  key: string,
  substitutions: string | string[] | undefined = undefined,
): string {
  return chrome.i18n.getMessage(key, substitutions) || "";
}

export function applyI18n(root: ParentNode = document): void {
  root.querySelectorAll<HTMLElement>("[data-i18n]").forEach((element) => {
    const key = element.dataset.i18n;
    const value = key ? msg(key) : "";
    if (value) {
      element.textContent = value;
    }
  });

  root
    .querySelectorAll<HTMLElement>("[data-i18n-placeholder]")
    .forEach((element) => {
      const key = element.dataset.i18nPlaceholder;
      const value = key ? msg(key) : "";
      if (value) {
        element.setAttribute("placeholder", value);
      }
    });

  root
    .querySelectorAll<HTMLElement>("[data-i18n-aria-label]")
    .forEach((element) => {
      const key = element.dataset.i18nAriaLabel;
      const value = key ? msg(key) : "";
      if (value) {
        element.setAttribute("aria-label", value);
      }
    });
}
