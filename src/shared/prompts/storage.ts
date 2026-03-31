// @ts-nocheck
export async function readLocal(key, fallbackValue) {
  const result = await chrome.storage.local.get(key);
  return result[key] ?? fallbackValue;
}

export async function writeLocal(key, value) {
  await chrome.storage.local.set({ [key]: value });
}
