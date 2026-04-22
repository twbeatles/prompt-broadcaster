import { detectTemplateVariables } from "../../../shared/template";
import type {
  FavoritePrompt,
  TemplateVariableDescriptor,
} from "../../../shared/types/models";

export function compactVariableValues(
  values: Record<string, string>,
): Record<string, string> {
  return Object.fromEntries(
    Object.entries(values ?? {})
      .map(([name, value]) => [String(name), String(value ?? "")])
      .filter(([, value]) => value.trim()),
  );
}

export function mergeTemplateSources(
  ...sources: Array<Record<string, string> | undefined | null>
): Record<string, string> {
  return Object.assign({}, ...sources.filter(Boolean));
}

export function getFavoriteTemplateSources(favorite: FavoritePrompt): string[] {
  if (
    favorite?.mode === "chain" &&
    Array.isArray(favorite.steps) &&
    favorite.steps.length > 0
  ) {
    return favorite.steps
      .map((step) => String(step?.text ?? ""))
      .filter((text) => text.trim());
  }

  return [String(favorite?.text ?? "")];
}

export function detectFavoriteTemplateVariables(
  favorite: FavoritePrompt,
): TemplateVariableDescriptor[] {
  const seen = new Set<string>();

  return getFavoriteTemplateSources(favorite)
    .flatMap((template) => detectTemplateVariables(template))
    .filter((variable) => {
      if (seen.has(variable.name)) {
        return false;
      }

      seen.add(variable.name);
      return true;
    });
}
