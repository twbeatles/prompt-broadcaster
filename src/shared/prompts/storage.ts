export async function readLocal<T>(key: string, fallbackValue: T): Promise<T> {
  const result = await chrome.storage.local.get(key);
  return (result[key] ?? fallbackValue) as T;
}

export async function writeLocal<T>(key: string, value: T): Promise<void> {
  await chrome.storage.local.set({ [key]: value });
}

export function isStorageQuotaError(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error ?? "");
  return /quota|QUOTA_BYTES|exceed/i.test(message);
}
