import {
  buildFavoriteEntry,
  ensureUniqueStringId,
  getPromptFavorites,
  normalizeSiteIdList,
  saveTemplatePack,
  setPromptFavorites,
  setServiceGroups,
} from "../../shared/prompts";
import type {
  ServiceGroupsUpdateMessage,
  ServiceGroupsUpdateResponse,
  TemplatePackExportMessage,
  TemplatePackImportMessage,
  TemplatePackTransferResponse,
} from "../../shared/types/messages";
import type { FavoritePrompt } from "../../shared/types/models";

export interface TemplatePackHandlersDeps {
  nowIso: () => string;
}

export function createTemplatePackHandlers(deps: TemplatePackHandlersDeps) {
  const { nowIso } = deps;

  function stripFavoriteSensitiveDefaults(
    favorite: FavoritePrompt,
    includeSensitiveDefaults: boolean,
  ): FavoritePrompt {
    if (includeSensitiveDefaults) {
      return favorite;
    }

    return {
      ...favorite,
      templateDefaults: {},
      steps: favorite.steps.map((step) => ({
        ...step,
        templateDefaults: {},
      })),
    };
  }

  async function handleTemplatePackExport(
    message: TemplatePackExportMessage,
  ): Promise<TemplatePackTransferResponse> {
    const favorites = await getPromptFavorites();
    const selectedIds = normalizeSiteIdList(message?.favoriteIds);
    const includeSensitiveDefaults = message?.includeSensitiveDefaults !== false;
    const selectedFavorites = (selectedIds.length > 0
      ? favorites.filter((favorite) => selectedIds.includes(favorite.id))
      : favorites
    ).map((favorite) => stripFavoriteSensitiveDefaults(favorite, includeSensitiveDefaults));

    const pack = await saveTemplatePack({
      title: message?.title || `Template Pack ${new Date().toLocaleDateString()}`,
      description: "",
      favoriteIds: selectedFavorites.map((favorite) => favorite.id),
      templates: selectedFavorites,
      includeSensitiveDefaults,
    });

    return {
      ok: true,
      pack,
    };
  }

  async function handleTemplatePackImport(
    message: TemplatePackImportMessage,
  ): Promise<TemplatePackTransferResponse> {
    const pack = await saveTemplatePack(message?.pack ?? {});
    const currentFavorites = await getPromptFavorites();
    const importedFavoriteIds: string[] = [];
    const skippedFavoriteIds: string[] = [];
    const nextFavorites = [...currentFavorites];

    for (const template of pack.templates) {
      const normalizedTemplate = buildFavoriteEntry(template);
      const exactDuplicate = nextFavorites.find((favorite) =>
        favorite.title === normalizedTemplate.title &&
        favorite.text === normalizedTemplate.text,
      );
      if (exactDuplicate) {
        skippedFavoriteIds.push(normalizedTemplate.id);
        continue;
      }

      const importedFavorite = {
        ...normalizedTemplate,
        id: ensureUniqueStringId(nextFavorites, normalizedTemplate.id),
        favoritedAt: nowIso(),
        createdAt: normalizedTemplate.createdAt || nowIso(),
        usageCount: 0,
        lastUsedAt: null,
      };
      nextFavorites.unshift(importedFavorite);
      importedFavoriteIds.push(importedFavorite.id);
    }

    if (importedFavoriteIds.length > 0) {
      await setPromptFavorites(nextFavorites);
    }

    return {
      ok: true,
      pack,
      importedFavoriteIds,
      skippedFavoriteIds,
    };
  }

  async function handleServiceGroupsUpdate(
    message: ServiceGroupsUpdateMessage,
  ): Promise<ServiceGroupsUpdateResponse> {
    const groups = await setServiceGroups(message?.groups ?? []);
    return {
      ok: true,
      groups,
    };
  }

  return {
    stripFavoriteSensitiveDefaults,
    handleTemplatePackExport,
    handleTemplatePackImport,
    handleServiceGroupsUpdate,
  };
}
