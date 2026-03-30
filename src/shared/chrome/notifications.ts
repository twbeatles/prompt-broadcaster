// @ts-nocheck
export async function createNotification(
  notificationId: string,
  options: chrome.notifications.NotificationOptions,
): Promise<string> {
  return chrome.notifications.create(notificationId, options);
}
