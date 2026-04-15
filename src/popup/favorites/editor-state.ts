import { detectTemplateVariables } from "../../shared/template";
import type {
  FavoritePrompt,
  TemplateVariableDescriptor,
} from "../../shared/types/models";
import type {
  PopupFavoriteEditorState,
  PopupFavoriteEditorStepDraft,
} from "../../shared/types/popup";
import { normalizeSiteIdList } from "../app/helpers";
import { state } from "../app/state";
import type { FavoriteEditorSeed } from "./editor-types";

export function compactVariableValues(values: Record<string, string>): Record<string, string> {
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

export function createFavoriteEditorStep(
  text = "",
  targetSiteIds: string[] = [],
  delayMs = 0,
  preferredId = "",
): PopupFavoriteEditorStepDraft {
  return {
    id:
      typeof preferredId === "string" && preferredId.trim()
        ? preferredId.trim()
        : `step-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    text: String(text ?? ""),
    delayMs: Math.max(0, Math.round(Number(delayMs) || 0)),
    targetSiteIds: normalizeSiteIdList(targetSiteIds),
  };
}

export function toLocalDateTimeInputValue(isoString = ""): string {
  const time = Date.parse(String(isoString ?? ""));
  if (!Number.isFinite(time)) {
    return "";
  }

  const date = new Date(time);
  const pad = (value: number): string => String(value).padStart(2, "0");
  return [
    date.getFullYear(),
    pad(date.getMonth() + 1),
    pad(date.getDate()),
  ].join("-") + `T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

export function toIsoDateTime(value = ""): string | null {
  const trimmed = String(value ?? "").trim();
  if (!trimmed) {
    return null;
  }

  const parsed = Date.parse(trimmed);
  return Number.isFinite(parsed) ? new Date(parsed).toISOString() : null;
}

export function getFirstNonEmptyStepText(
  steps: PopupFavoriteEditorStepDraft[] = [],
): string {
  return steps.find((step) => step.text.trim())?.text ?? "";
}

export function collectFavoriteEditorVariables(
  modalState: PopupFavoriteEditorState,
): TemplateVariableDescriptor[] {
  const templates = modalState.mode === "chain"
    ? modalState.steps.map((step) => step.text)
    : [modalState.prompt];
  const seen = new Set<string>();

  return templates
    .flatMap((template) => detectTemplateVariables(template))
    .filter((variable) => variable.kind === "user")
    .filter((variable) => {
      if (seen.has(variable.name)) {
        return false;
      }

      seen.add(variable.name);
      return true;
    });
}

export function syncFavoriteEditorVariables(modalState: PopupFavoriteEditorState): void {
  const variables = collectFavoriteEditorVariables(modalState);
  const nextDefaults: Record<string, string> = {};

  variables.forEach((variable) => {
    nextDefaults[variable.name] = modalState.defaultValues?.[variable.name] ?? "";
  });

  modalState.variables = variables;
  modalState.defaultValues = nextDefaults;
  if (variables.length === 0) {
    modalState.saveDefaults = false;
  }
}

export function buildFavoriteEditorStateFromItem(
  item: FavoriteEditorSeed | null | undefined,
): PopupFavoriteEditorState {
  const baseDefaults = mergeTemplateSources(
    state.templateVariableCache,
    item?.templateDefaults ?? {},
  );
  const mode = item?.mode === "chain" ? "chain" : "single";
  const steps = mode === "chain" && Array.isArray(item?.steps) && item.steps.length > 0
    ? item.steps.map((step) =>
      createFavoriteEditorStep(step.text, step.targetSiteIds, step.delayMs, step.id))
    : mode === "chain"
      ? [createFavoriteEditorStep(item?.text ?? "", [], 0)]
      : [];
  const draftState: PopupFavoriteEditorState = {
    favoriteId: item?.id ?? null,
    prompt: item?.text ?? "",
    sites: normalizeSiteIdList(item?.sentTo),
    variables: [],
    title: item?.title ?? "",
    saveDefaults: Boolean(
      item?.templateDefaults && Object.keys(item.templateDefaults).length > 0,
    ),
    defaultValues: { ...baseDefaults },
    tags: Array.isArray(item?.tags) ? [...item.tags] : [],
    folder: item?.folder ?? "",
    pinned: Boolean(item?.pinned),
    mode,
    steps,
    scheduleEnabled: Boolean(item?.scheduleEnabled),
    scheduledAt: item?.scheduledAt ?? null,
    scheduleRepeat: item?.scheduleRepeat ?? "none",
  };

  syncFavoriteEditorVariables(draftState);
  return draftState;
}

export function getFavoriteById(favoriteId: string): FavoritePrompt | null {
  return state.favorites.find((entry) => String(entry.id) === String(favoriteId)) ?? null;
}
