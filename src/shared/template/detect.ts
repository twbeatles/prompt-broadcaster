// @ts-nocheck
import { SYSTEM_TEMPLATE_KEYS, TEMPLATE_VARIABLE_PATTERN } from "./constants";
import { canonicalizeTemplateVariableName } from "./normalize";

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
