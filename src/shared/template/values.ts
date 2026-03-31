// @ts-nocheck
import {
  SYSTEM_TEMPLATE_VARIABLES,
  WEEKDAY_LOCALES,
} from "./constants";
import { normalizeLocale, pad2 } from "./normalize";

export function buildSystemTemplateValues(now = new Date(), options = {}) {
  const date = now instanceof Date ? now : new Date();
  const locale = normalizeLocale(options?.locale);

  const values = {
    [SYSTEM_TEMPLATE_VARIABLES.date]: [
      date.getFullYear(),
      pad2(date.getMonth() + 1),
      pad2(date.getDate()),
    ].join("-"),
    [SYSTEM_TEMPLATE_VARIABLES.time]: `${pad2(date.getHours())}:${pad2(date.getMinutes())}`,
    [SYSTEM_TEMPLATE_VARIABLES.weekday]: new Intl.DateTimeFormat(WEEKDAY_LOCALES[locale], {
      weekday: locale === "ko" ? "short" : "long",
    }).format(date),
    [SYSTEM_TEMPLATE_VARIABLES.random]: String(Math.floor(Math.random() * 1000) + 1),
  };

  if (options?.extra && typeof options.extra === "object") {
    if (typeof options.extra.url === "string") {
      values[SYSTEM_TEMPLATE_VARIABLES.url] = options.extra.url;
    }
    if (typeof options.extra.title === "string") {
      values[SYSTEM_TEMPLATE_VARIABLES.title] = options.extra.title;
    }
    if (typeof options.extra.selection === "string") {
      values[SYSTEM_TEMPLATE_VARIABLES.selection] = options.extra.selection;
    }
    if (typeof options.extra.counter === "string" || typeof options.extra.counter === "number") {
      values[SYSTEM_TEMPLATE_VARIABLES.counter] = String(options.extra.counter);
    }
  }

  return values;
}

export function getAsyncSystemVariableNames() {
  return new Set([
    SYSTEM_TEMPLATE_VARIABLES.url,
    SYSTEM_TEMPLATE_VARIABLES.title,
    SYSTEM_TEMPLATE_VARIABLES.selection,
    SYSTEM_TEMPLATE_VARIABLES.counter,
  ]);
}
