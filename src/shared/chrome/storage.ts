export async function getLocalValue<T>(key: string, fallbackValue: T): Promise<T> {
  const result = await chrome.storage.local.get(key);
  return (result[key] as T | undefined) ?? fallbackValue;
}

export async function setLocalValue<T>(key: string, value: T): Promise<void> {
  await chrome.storage.local.set({ [key]: value });
}

export async function getSessionValue<T>(key: string, fallbackValue: T): Promise<T> {
  const result = await chrome.storage.session.get(key);
  return (result[key] as T | undefined) ?? fallbackValue;
}

export async function setSessionValue<T>(key: string, value: T): Promise<void> {
  await chrome.storage.session.set({ [key]: value });
}
