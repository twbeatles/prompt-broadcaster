import { LOCAL_STORAGE_KEYS } from "./constants";
import { normalizeTemplateDefaults } from "./normalizers";
import { readLocal, writeLocal } from "./storage";

export async function getTemplateVariableCache(): Promise<Record<string, string>> {
  const rawCache = await readLocal(LOCAL_STORAGE_KEYS.templateVariableCache, {});
  return normalizeTemplateDefaults(rawCache);
}

export async function setTemplateVariableCache(cache: unknown): Promise<Record<string, string>> {
  const normalized = normalizeTemplateDefaults(cache);
  await writeLocal(LOCAL_STORAGE_KEYS.templateVariableCache, normalized);
  return normalized;
}

export async function updateTemplateVariableCache(
  partialCache: unknown
): Promise<Record<string, string>> {
  const current = await getTemplateVariableCache();
  const next = {
    ...current,
    ...normalizeTemplateDefaults(partialCache),
  };

  await setTemplateVariableCache(next);
  return next;
}
