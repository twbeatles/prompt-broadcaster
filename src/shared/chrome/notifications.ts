export async function createNotification(
  notificationId: string,
  options: chrome.notifications.NotificationCreateOptions,
): Promise<string> {
  return await new Promise((resolve, reject) => {
    try {
      chrome.notifications.create(notificationId, options, (createdId) => {
        resolve(createdId);
      });
    } catch (error) {
      reject(error);
    }
  });
}
