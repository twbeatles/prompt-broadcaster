// @ts-nocheck
function safeSendResponse(sendResponse, payload) {
  try {
    sendResponse(payload);
  } catch (_error) {
    return false;
  }

  return true;
}

function buildFallback(work, error) {
  const fallback = {
    ok: false,
    error: error?.message ?? String(error),
  };

  return typeof work.onError === "function" ? work.onError(error, fallback) : fallback;
}

function isTrustedSender(sender) {
  if (sender?.tab?.id) {
    return true;
  }

  return sender?.id === chrome.runtime.id;
}

function respondWith(sendResponse, work, errorLabel) {
  void Promise.resolve()
    .then(work)
    .then((result) => {
      safeSendResponse(sendResponse, result);
    })
    .catch((error) => {
      if (errorLabel) {
        console.error(errorLabel, error);
      }
      safeSendResponse(sendResponse, buildFallback(work, error));
    });
}

export function registerRuntimeMessageRouter(handlers) {
  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (!isTrustedSender(sender)) {
      return false;
    }

    const handler = handlers[message?.action];
    if (!handler) {
      return false;
    }

    if (handler.sync) {
      try {
        safeSendResponse(sendResponse, handler.run(message, sender));
      } catch (error) {
        if (handler.errorLabel) {
          console.error(handler.errorLabel, error);
        }
        safeSendResponse(sendResponse, buildFallback(handler, error));
      }
      return false;
    }

    const task = () => handler.run(message, sender);
    task.onError = handler.onError;
    respondWith(sendResponse, task, handler.errorLabel);
    return true;
  });
}
