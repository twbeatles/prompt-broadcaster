// @ts-nocheck
const TEMPLATE_VARIABLE_PATTERN = /{{\s*([^{}]+?)\s*}}/g;

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

const SYSTEM_TEMPLATE_DEFINITIONS = Object.freeze({
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

const SYSTEM_TEMPLATE_ALIAS_MAP = new Map(
  Object.entries(SYSTEM_TEMPLATE_DEFINITIONS).flatMap(([canonicalName, definition]) =>
    definition.aliases.map((alias) => [alias.toLowerCase(), canonicalName])
  )
);

const SYSTEM_TEMPLATE_KEYS = new Set(Object.keys(SYSTEM_TEMPLATE_DEFINITIONS));
const WEEKDAY_LOCALES = Object.freeze({
  ko: "ko-KR",
  en: "en-US",
});

function pad2(value) {
  return String(value).padStart(2, "0");
}

function normalizeLocale(locale) {
  return typeof locale === "string" && locale.toLowerCase().startsWith("ko") ? "ko" : "en";
}

export function normalizeTemplateVariableName(value) {
  return typeof value === "string" ? value.trim() : "";
}

export function canonicalizeTemplateVariableName(value) {
  const normalizedValue = normalizeTemplateVariableName(value);
  if (!normalizedValue) {
    return "";
  }

  return SYSTEM_TEMPLATE_ALIAS_MAP.get(normalizedValue.toLowerCase()) ?? normalizedValue;
}

export function isSystemTemplateVariable(name) {
  return SYSTEM_TEMPLATE_KEYS.has(canonicalizeTemplateVariableName(name));
}

export function getTemplateVariableDisplayName(name, locale = "en") {
  const canonicalName = canonicalizeTemplateVariableName(name);
  if (!SYSTEM_TEMPLATE_KEYS.has(canonicalName)) {
    return normalizeTemplateVariableName(name);
  }

  const normalizedLocale = normalizeLocale(locale);
  return SYSTEM_TEMPLATE_DEFINITIONS[canonicalName].labels[normalizedLocale];
}

function normalizeTemplateValueRecord(values = {}) {
  if (!values || typeof values !== "object" || Array.isArray(values)) {
    return {};
  }

  return Object.fromEntries(
    Object.entries(values).map(([key, value]) => [
      canonicalizeTemplateVariableName(key),
      value,
    ])
  );
}

export function detectTemplateVariables(template) {
  const source = typeof template === "string" ? template : "";
  const seen = new Set();
  const variables = [];

  for (const match of source.matchAll(TEMPLATE_VARIABLE_PATTERN)) {
    const canonicalName = canonicalizeTemplateVariableName(match[1]);

    if (!canonicalName || seen.has(canonicalName)) {
      continue;
    }

    seen.add(canonicalName);
    variables.push({
      name: canonicalName,
      kind: SYSTEM_TEMPLATE_KEYS.has(canonicalName) ? "system" : "user",
    });
  }

  return variables;
}

export function getUserTemplateVariables(template) {
  return detectTemplateVariables(template).filter((variable) => variable.kind === "user");
}

export function hasTemplateVariables(template) {
  return detectTemplateVariables(template).length > 0;
}

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

  // url, title, selection, counter are injected externally via options.extra
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

/**
 * Returns the set of system variable names that require async resolution
 * (url, title, selection, counter) so callers know to fetch them separately.
 */
export function getAsyncSystemVariableNames() {
  return new Set([
    SYSTEM_TEMPLATE_VARIABLES.url,
    SYSTEM_TEMPLATE_VARIABLES.title,
    SYSTEM_TEMPLATE_VARIABLES.selection,
    SYSTEM_TEMPLATE_VARIABLES.counter,
  ]);
}

export function renderTemplatePrompt(template, values = {}) {
  const source = typeof template === "string" ? template : "";
  const normalizedValues = normalizeTemplateValueRecord(values);

  return source.replace(TEMPLATE_VARIABLE_PATTERN, (_match, rawName) => {
    const normalizedName = normalizeTemplateVariableName(rawName);
    const canonicalName = canonicalizeTemplateVariableName(rawName);

    if (!normalizedName) {
      return "";
    }

    if (Object.prototype.hasOwnProperty.call(normalizedValues, canonicalName)) {
      return String(normalizedValues[canonicalName] ?? "");
    }

    if (Object.prototype.hasOwnProperty.call(normalizedValues, normalizedName)) {
      return String(normalizedValues[normalizedName] ?? "");
    }

    return `{{${normalizedName}}}`;
  });
}

export function findMissingTemplateValues(template, values = {}) {
  const normalizedValues = normalizeTemplateValueRecord(values);

  return getUserTemplateVariables(template)
    .map((variable) => variable.name)
    .filter((name) => !String(normalizedValues[name] ?? "").trim());
}
