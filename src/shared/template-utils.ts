// @ts-nocheck
const TEMPLATE_VARIABLE_PATTERN = /{{\s*([^{}]+?)\s*}}/g;

export const SYSTEM_TEMPLATE_VARIABLES = Object.freeze({
  date: "날짜",
  time: "시간",
  weekday: "요일",
  clipboard: "클립보드",
});

const SYSTEM_VARIABLE_NAMES = new Set(Object.values(SYSTEM_TEMPLATE_VARIABLES));
const KOREAN_WEEKDAYS = ["일", "월", "화", "수", "목", "금", "토"];

function pad2(value) {
  return String(value).padStart(2, "0");
}

export function normalizeTemplateVariableName(value) {
  return typeof value === "string" ? value.trim() : "";
}

export function isSystemTemplateVariable(name) {
  return SYSTEM_VARIABLE_NAMES.has(normalizeTemplateVariableName(name));
}

export function detectTemplateVariables(template) {
  const source = typeof template === "string" ? template : "";
  const seen = new Set();
  const variables = [];

  for (const match of source.matchAll(TEMPLATE_VARIABLE_PATTERN)) {
    const name = normalizeTemplateVariableName(match[1]);

    if (!name || seen.has(name)) {
      continue;
    }

    seen.add(name);
    variables.push({
      name,
      kind: isSystemTemplateVariable(name) ? "system" : "user",
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

export function buildSystemTemplateValues(now = new Date()) {
  const date = now instanceof Date ? now : new Date();

  return {
    [SYSTEM_TEMPLATE_VARIABLES.date]: [
      date.getFullYear(),
      pad2(date.getMonth() + 1),
      pad2(date.getDate()),
    ].join("-"),
    [SYSTEM_TEMPLATE_VARIABLES.time]: `${pad2(date.getHours())}:${pad2(date.getMinutes())}`,
    [SYSTEM_TEMPLATE_VARIABLES.weekday]: KOREAN_WEEKDAYS[date.getDay()] ?? "",
  };
}

export function renderTemplatePrompt(template, values = {}) {
  const source = typeof template === "string" ? template : "";

  return source.replace(TEMPLATE_VARIABLE_PATTERN, (_match, rawName) => {
    const name = normalizeTemplateVariableName(rawName);

    if (!name) {
      return "";
    }

    return Object.prototype.hasOwnProperty.call(values, name)
      ? String(values[name] ?? "")
      : `{{${name}}}`;
  });
}

export function findMissingTemplateValues(template, values = {}) {
  return getUserTemplateVariables(template)
    .map((variable) => variable.name)
    .filter((name) => !String(values[name] ?? "").trim());
}
