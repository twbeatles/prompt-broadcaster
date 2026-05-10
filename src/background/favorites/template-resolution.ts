import { getBroadcastCounter, normalizeSiteIdList } from "../../shared/prompts";
import {
  SYSTEM_TEMPLATE_VARIABLES,
  buildSystemTemplateValues,
  detectTemplateVariables,
  renderTemplatePrompt,
} from "../../shared/template";
import type {
  ChainStep,
  FavoriteExecutionTrigger,
  FavoritePrompt,
  FavoriteRunExecutionContextSnapshot,
} from "../../shared/types/models";

const SCHEDULED_VARIABLE_BLOCKLIST = new Set([
  SYSTEM_TEMPLATE_VARIABLES.url,
  SYSTEM_TEMPLATE_VARIABLES.title,
  SYSTEM_TEMPLATE_VARIABLES.selection,
  SYSTEM_TEMPLATE_VARIABLES.clipboard,
]);

export interface FavoriteExecutionValidationResult {
  ok: boolean;
  steps?: ChainStep[];
  defaults?: Record<string, string>;
  reason?: string;
  message?: string;
  failingStepIndex?: number | null;
  failingStepText?: string;
  failingStepTargetSiteIds?: string[];
}

interface FavoriteTemplateResolutionDeps {
  getWorkflowMessage: (key: string, substitutions?: string[], fallback?: string) => string;
}

export function createFavoriteTemplateResolutionTools(
  deps: FavoriteTemplateResolutionDeps,
) {
  const { getWorkflowMessage } = deps;

  function getFavoriteExecutionSteps(favorite: FavoritePrompt | null | undefined): ChainStep[] {
    const favoriteTargetSiteIds = normalizeSiteIdList(favorite?.sentTo);

    if (favorite?.mode === "chain" && Array.isArray(favorite.steps) && favorite.steps.length > 0) {
      return favorite.steps
        .filter((step) => typeof step?.text === "string" && step.text.trim())
        .map((step, index) => ({
          id:
            typeof step.id === "string" && step.id.trim()
              ? step.id.trim()
              : `step-${index + 1}`,
          text: step.text,
          delayMs: Math.max(0, Math.round(Number(step.delayMs) || 0)),
          failurePolicy: step.failurePolicy ?? "stop",
          targetMode: step.targetMode,
          templateDefaults: step.templateDefaults ?? {},
          targetSiteIds: (() => {
            const stepTargets = normalizeSiteIdList(step.targetSiteIds);
            return stepTargets.length > 0 ? stepTargets : favoriteTargetSiteIds;
          })(),
        }));
    }

    const text = typeof favorite?.text === "string" ? favorite.text : "";
    return [{
      id: `${favorite?.id ?? "favorite"}-single`,
      text,
      delayMs: 0,
      targetSiteIds: favoriteTargetSiteIds,
      failurePolicy: "stop",
      templateDefaults: {},
    }];
  }

  function getFavoriteTargetSiteIds(step: ChainStep) {
    return normalizeSiteIdList(step?.targetSiteIds);
  }

  function previewFavoriteText(favorite: FavoritePrompt | null | undefined) {
    const source = favorite?.mode === "chain"
      ? getFavoriteExecutionSteps(favorite)[0]?.text ?? favorite?.text ?? ""
      : favorite?.text ?? "";
    const collapsed = String(source ?? "").replace(/\s+/g, " ").trim();
    return collapsed.length > 80 ? `${collapsed.slice(0, 80)}...` : collapsed;
  }

  function buildFavoriteUserDefaults(
    templateVariableCache: Record<string, string>,
    favorite: FavoritePrompt | null | undefined,
  ) {
    return {
      ...(templateVariableCache ?? {}),
      ...((favorite?.templateDefaults && typeof favorite.templateDefaults === "object")
        ? favorite.templateDefaults
        : {}),
    };
  }

  function detectFavoriteExecutionBlockers(
    favorite: FavoritePrompt | null | undefined,
    executionContext: FavoriteRunExecutionContextSnapshot,
    templateVariableCache: Record<string, string>,
    trigger: FavoriteExecutionTrigger,
    options: {
      hasPreparedClipboardValue?: boolean;
    } = {},
  ): FavoriteExecutionValidationResult {
    const steps = getFavoriteExecutionSteps(favorite);
    const defaults = buildFavoriteUserDefaults(templateVariableCache, favorite);
    const scheduled = trigger === "scheduled";
    const contextAvailable = Boolean(
      executionContext.tabId !== null ||
      executionContext.windowId !== null ||
      executionContext.url ||
      executionContext.title ||
      executionContext.selection,
    );

    for (const [stepIndex, step] of steps.entries()) {
      const targetSiteIds = getFavoriteTargetSiteIds(step);
      if (targetSiteIds.length === 0) {
        return {
          ok: false,
          reason: "missing_targets",
          message: getWorkflowMessage(
            "favorite_run_error_missing_targets",
            [],
            "Favorite does not have any target services.",
          ),
          failingStepIndex: stepIndex,
          failingStepText: step.text,
          failingStepTargetSiteIds: targetSiteIds,
        };
      }

      const variables = detectTemplateVariables(step.text);
      const missingUserValues = variables
        .filter((variable) => variable.kind === "user")
        .map((variable) => variable.name)
        .filter((name) => !String(defaults[name] ?? "").trim());

      if (missingUserValues.length > 0) {
        return {
          ok: false,
          reason: "missing_template_values",
          message: getWorkflowMessage(
            "favorite_run_error_missing_template_values",
            [missingUserValues.join(", ")],
            `Missing template values: ${missingUserValues.join(", ")}`,
          ),
          failingStepIndex: stepIndex,
          failingStepText: step.text,
          failingStepTargetSiteIds: targetSiteIds,
        };
      }

      const systemVariables = variables
        .filter((variable) => variable.kind === "system")
        .map((variable) => variable.name);

      if (scheduled) {
        const blocked = systemVariables.filter((name) =>
          SCHEDULED_VARIABLE_BLOCKLIST.has(name as typeof SYSTEM_TEMPLATE_VARIABLES.url),
        );
        if (blocked.length > 0) {
          return {
            ok: false,
            reason: "scheduled_unsupported_variable",
            message: getWorkflowMessage(
              "favorite_run_error_scheduled_unsupported_variable",
              [blocked.join(", ")],
              `Scheduled favorites cannot resolve ${blocked.join(", ")}.`,
            ),
            failingStepIndex: stepIndex,
            failingStepText: step.text,
            failingStepTargetSiteIds: targetSiteIds,
          };
        }
      } else {
        if (
          systemVariables.includes(SYSTEM_TEMPLATE_VARIABLES.clipboard) &&
          !options.hasPreparedClipboardValue
        ) {
          return {
            ok: false,
            reason: "clipboard_unavailable",
            message: getWorkflowMessage(
              "favorite_run_error_clipboard_popup_required",
              [],
              "Clipboard-backed favorites need popup input.",
            ),
            failingStepIndex: stepIndex,
            failingStepText: step.text,
            failingStepTargetSiteIds: targetSiteIds,
          };
        }

        const needsTabContext = systemVariables.some((name) =>
          name === SYSTEM_TEMPLATE_VARIABLES.url ||
          name === SYSTEM_TEMPLATE_VARIABLES.title ||
          name === SYSTEM_TEMPLATE_VARIABLES.selection,
        );

        if (needsTabContext && !contextAvailable) {
          return {
            ok: false,
            reason: "tab_context_unavailable",
            message: getWorkflowMessage(
              "favorite_run_error_tab_context_unavailable",
              [],
              "Current tab context is unavailable for this favorite.",
            ),
            failingStepIndex: stepIndex,
            failingStepText: step.text,
            failingStepTargetSiteIds: targetSiteIds,
          };
        }
      }
    }

    return {
      ok: true,
      steps,
      defaults,
    };
  }

  async function buildFavoriteStepPrompt(
    step: ChainStep,
    templateDefaults: Record<string, string>,
    executionContext: FavoriteRunExecutionContextSnapshot,
  ) {
    const counter = await getBroadcastCounter().catch(() => 0);
    const values = {
      ...(templateDefaults ?? {}),
      ...(step.templateDefaults ?? {}),
      ...buildSystemTemplateValues(new Date(), {
        extra: {
          url: executionContext.url ?? "",
          title: executionContext.title ?? "",
          selection: executionContext.selection ?? "",
          counter: String(Number(counter) + 1 || 1),
        },
      }),
      [SYSTEM_TEMPLATE_VARIABLES.clipboard]: executionContext.clipboard ?? "",
    };

    return renderTemplatePrompt(step.text, values);
  }

  return {
    getFavoriteExecutionSteps,
    getFavoriteTargetSiteIds,
    previewFavoriteText,
    detectFavoriteExecutionBlockers,
    buildFavoriteStepPrompt,
  };
}
