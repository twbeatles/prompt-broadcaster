import {
  detectTemplateVariables,
  findMissingTemplateValues,
  renderTemplatePrompt,
} from "../template";

interface PromptTemplateTarget {
  promptTemplate?: string;
  promptOverride?: string;
  resolvedPrompt?: string;
}

export function detectTemplateVariablesForTargets(targets: PromptTemplateTarget[] = []) {
  const seen = new Set();
  const variables: Array<{ name: string; kind: string }> = [];

  targets.forEach((target) => {
    detectTemplateVariables(target?.promptTemplate ?? "").forEach((variable) => {
      if (seen.has(variable.name)) {
        return;
      }

      seen.add(variable.name);
      variables.push(variable);
    });
  });

  return variables;
}

export function findMissingTemplateValuesForTargets(
  targets: PromptTemplateTarget[] = [],
  userValues: Record<string, string> = {}
) {
  return Array.from(
    new Set(
      targets.flatMap((target) =>
        findMissingTemplateValues(target?.promptTemplate ?? "", userValues)
      )
    )
  );
}

export function resolveBroadcastTargets<T extends PromptTemplateTarget>(
  targets: T[] = [],
  values: Record<string, string> = {}
) {
  return targets.map((target) => ({
    ...target,
    resolvedPrompt: renderTemplatePrompt(target?.promptTemplate ?? "", values),
  }));
}

export function pickBroadcastTargetPrompt(target: PromptTemplateTarget | null | undefined, fallbackPrompt = "") {
  if (typeof target?.resolvedPrompt === "string") {
    return target.resolvedPrompt;
  }

  if (typeof target?.promptOverride === "string" && target.promptOverride.trim()) {
    return target.promptOverride.trim();
  }

  return String(fallbackPrompt ?? "");
}
