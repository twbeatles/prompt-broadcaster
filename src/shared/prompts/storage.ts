export async function readLocal<T>(key: string, fallbackValue: T): Promise<T> {
  const result = await chrome.storage.local.get(key);
  return (result[key] ?? fallbackValue) as T;
}

export async function writeLocal<T>(key: string, value: T): Promise<void> {
  await chrome.storage.local.set({ [key]: value });
}
