type StorageAreaName = "local" | "session";

function getStorageArea(area: StorageAreaName) {
  return area === "session" ? chrome.storage.session : chrome.storage.local;
}

export async function readStorage<T>(
  area: StorageAreaName,
  key: string,
  fallbackValue: T
): Promise<T> {
  const result = await getStorageArea(area).get(key);
  return (result[key] ?? fallbackValue) as T;
}

export async function writeStorage<T>(
  area: StorageAreaName,
  key: string,
  value: T
): Promise<void> {
  await getStorageArea(area).set({ [key]: value });
}

export async function removeStorageKeys(
  area: StorageAreaName,
  keys: string[]
): Promise<void> {
  if (!Array.isArray(keys) || keys.length === 0) {
    return;
  }

  await getStorageArea(area).remove(keys);
}
