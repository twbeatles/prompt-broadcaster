import { LOCAL_RUNTIME_KEYS } from "./constants";
import { normalizeBoolean } from "./normalizers";
import { readStorage, writeStorage } from "./storage";

export async function getOnboardingCompleted(): Promise<boolean> {
  const value = await readStorage("local", LOCAL_RUNTIME_KEYS.onboardingCompleted, false);
  return normalizeBoolean(value, false);
}

export async function setOnboardingCompleted(completed: unknown): Promise<boolean> {
  const normalized = normalizeBoolean(completed, false);
  await writeStorage("local", LOCAL_RUNTIME_KEYS.onboardingCompleted, normalized);
  return normalized;
}
