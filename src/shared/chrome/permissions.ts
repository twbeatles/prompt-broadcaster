export async function containsPermissions(permissions: chrome.permissions.Permissions): Promise<boolean> {
  return chrome.permissions.contains(permissions);
}

export async function requestPermissions(permissions: chrome.permissions.Permissions): Promise<boolean> {
  return chrome.permissions.request(permissions);
}
