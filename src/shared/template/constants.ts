// @ts-nocheck
export const TEMPLATE_VARIABLE_PATTERN = /{{\s*([^{}]+?)\s*}}/g;

export const SYSTEM_TEMPLATE_VARIABLES = Object.freeze({
  date: "date",
  time: "time",
  weekday: "weekday",
  clipboard: "clipboard",
  url: "url",
  title: "title",
  selection: "selection",
  counter: "counter",
  random: "random",
});

export const SYSTEM_TEMPLATE_DEFINITIONS = Object.freeze({
  [SYSTEM_TEMPLATE_VARIABLES.date]: {
    aliases: ["date", "날짜"],
    labels: { ko: "날짜", en: "date" },
  },
  [SYSTEM_TEMPLATE_VARIABLES.time]: {
    aliases: ["time", "시간"],
    labels: { ko: "시간", en: "time" },
  },
  [SYSTEM_TEMPLATE_VARIABLES.weekday]: {
    aliases: ["weekday", "요일"],
    labels: { ko: "요일", en: "weekday" },
  },
  [SYSTEM_TEMPLATE_VARIABLES.clipboard]: {
    aliases: ["clipboard", "클립보드"],
    labels: { ko: "클립보드", en: "clipboard" },
  },
  [SYSTEM_TEMPLATE_VARIABLES.url]: {
    aliases: ["url", "주소"],
    labels: { ko: "현재 탭 URL", en: "current tab URL" },
  },
  [SYSTEM_TEMPLATE_VARIABLES.title]: {
    aliases: ["title", "제목"],
    labels: { ko: "현재 탭 제목", en: "current tab title" },
  },
  [SYSTEM_TEMPLATE_VARIABLES.selection]: {
    aliases: ["selection", "선택"],
    labels: { ko: "선택한 텍스트", en: "selected text" },
  },
  [SYSTEM_TEMPLATE_VARIABLES.counter]: {
    aliases: ["counter", "카운터"],
    labels: { ko: "카운터", en: "counter" },
  },
  [SYSTEM_TEMPLATE_VARIABLES.random]: {
    aliases: ["random", "랜덤"],
    labels: { ko: "랜덤 숫자", en: "random number" },
  },
});

export const SYSTEM_TEMPLATE_ALIAS_MAP = new Map(
  Object.entries(SYSTEM_TEMPLATE_DEFINITIONS).flatMap(([canonicalName, definition]) =>
    definition.aliases.map((alias) => [alias.toLowerCase(), canonicalName])
  )
);

export const SYSTEM_TEMPLATE_KEYS = new Set(Object.keys(SYSTEM_TEMPLATE_DEFINITIONS));

export const WEEKDAY_LOCALES = Object.freeze({
  ko: "ko-KR",
  en: "en-US",
});
