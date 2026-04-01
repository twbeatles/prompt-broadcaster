import { TEMPLATE_VARIABLE_PATTERN } from "./constants";
import {
  canonicalizeTemplateVariableName,
  normalizeTemplateValueRecord,
  normalizeTemplateVariableName,
} from "./normalize";
import { getUserTemplateVariables } from "./detect";

export function renderTemplatePrompt(
  template: unknown,
  values: Record<string, unknown> = {}
) {
  const source = typeof template === "string" ? template : "";
  const normalizedValues = normalizeTemplateValueRecord(values);

  return source.replace(TEMPLATE_VARIABLE_PATTERN, (_match: string, rawName: string) => {
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

export function findMissingTemplateValues(
  template: unknown,
  values: Record<string, unknown> = {}
) {
  const normalizedValues = normalizeTemplateValueRecord(values);

  return getUserTemplateVariables(template)
    .map((variable) => variable.name)
    .filter((name) => !String(normalizedValues[name] ?? "").trim());
}
