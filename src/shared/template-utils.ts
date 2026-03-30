// @ts-nocheck
const TEMPLATE_VARIABLE_PATTERN = /{{\s*([^{}]+?)\s*}}/g;

export const SYSTEM_TEMPLATE_VARIABLES = Object.freeze({
  date: "date",
  time: "time",
  weekday: "weekday",
  clipboard: "clipboard",
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

  return {
    [SYSTEM_TEMPLATE_VARIABLES.date]: [
      date.getFullYear(),
      pad2(date.getMonth() + 1),
      pad2(date.getDate()),
    ].join("-"),
    [SYSTEM_TEMPLATE_VARIABLES.time]: `${pad2(date.getHours())}:${pad2(date.getMinutes())}`,
    [SYSTEM_TEMPLATE_VARIABLES.weekday]: new Intl.DateTimeFormat(WEEKDAY_LOCALES[locale], {
      weekday: locale === "ko" ? "short" : "long",
    }).format(date),
  };
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
