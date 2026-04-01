import {
  SYSTEM_TEMPLATE_ALIAS_MAP,
  SYSTEM_TEMPLATE_DEFINITIONS,
  SYSTEM_TEMPLATE_KEYS,
} from "./constants";

export function pad2(value: number | string) {
  return String(value).padStart(2, "0");
}

export function normalizeLocale(locale: unknown) {
  return typeof locale === "string" && locale.toLowerCase().startsWith("ko") ? "ko" : "en";
}

export function normalizeTemplateVariableName(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

export function canonicalizeTemplateVariableName(value: unknown) {
  const normalizedValue = normalizeTemplateVariableName(value);
  if (!normalizedValue) {
    return "";
  }

  return SYSTEM_TEMPLATE_ALIAS_MAP.get(normalizedValue.toLowerCase()) ?? normalizedValue;
}

export function isSystemTemplateVariable(name: unknown) {
  return SYSTEM_TEMPLATE_KEYS.has(canonicalizeTemplateVariableName(name));
}

export function getTemplateVariableDisplayName(name: unknown, locale = "en") {
  const canonicalName = canonicalizeTemplateVariableName(name);
  if (!SYSTEM_TEMPLATE_KEYS.has(canonicalName)) {
    return normalizeTemplateVariableName(name);
  }

  const normalizedLocale = normalizeLocale(locale);
  return SYSTEM_TEMPLATE_DEFINITIONS[canonicalName].labels[normalizedLocale];
}

export function normalizeTemplateValueRecord(values: unknown = {}) {
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
