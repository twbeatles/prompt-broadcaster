// @ts-nocheck
export async function readStorage(area, key, fallbackValue) {
  const result = await chrome.storage[area].get(key);
  return result[key] ?? fallbackValue;
}

export async function writeStorage(area, key, value) {
  await chrome.storage[area].set({ [key]: value });
}
