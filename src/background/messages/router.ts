// @ts-nocheck
function respondWith(sendResponse, work, errorLabel) {
  void Promise.resolve()
    .then(work)
    .then((result) => sendResponse(result))
    .catch((error) => {
      if (errorLabel) {
        console.error(errorLabel, error);
      }
      const fallback = {
        ok: false,
        error: error?.message ?? String(error),
      };
      sendResponse(typeof work.onError === "function" ? work.onError(error, fallback) : fallback);
    });
}

export function registerRuntimeMessageRouter(handlers) {
  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    const handler = handlers[message?.action];
    if (!handler) {
      return false;
    }

    if (handler.sync) {
      sendResponse(handler.run(message, sender));
      return false;
    }

    const task = () => handler.run(message, sender);
    task.onError = handler.onError;
    respondWith(sendResponse, task, handler.errorLabel);
    return true;
  });
}
