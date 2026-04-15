import type {
  RuntimeAction,
  RuntimeMessage,
  RuntimeMessageOf,
  RuntimeResponseOf,
} from "../../shared/types/messages";

type MaybePromise<T> = Promise<T> | T;

interface RuntimeErrorFallback {
  ok: false;
  error: string;
}

export interface RuntimeHandler<TAction extends RuntimeAction> {
  sync?: boolean;
  run: (
    message: RuntimeMessageOf<TAction>,
    sender: chrome.runtime.MessageSender,
  ) => MaybePromise<RuntimeResponseOf<TAction>>;
  errorLabel?: string;
  onError?: (
    error: unknown,
    fallback: RuntimeErrorFallback,
  ) => RuntimeResponseOf<TAction>;
}

export type RuntimeHandlerMap = {
  [TAction in RuntimeAction]?: RuntimeHandler<TAction>;
};

function safeSendResponse(
  sendResponse: (response?: unknown) => void,
  payload: unknown,
): boolean {
  try {
    sendResponse(payload);
  } catch (_error) {
    return false;
  }

  return true;
}

function buildFallback<TAction extends RuntimeAction>(
  work: RuntimeHandler<TAction>,
  error: unknown,
): RuntimeResponseOf<TAction> {
  const fallback: RuntimeErrorFallback = {
    ok: false,
    error: error instanceof Error ? error.message : String(error),
  };

  return typeof work.onError === "function"
    ? work.onError(error, fallback)
    : (fallback as RuntimeResponseOf<TAction>);
}

function isTrustedSender(sender: chrome.runtime.MessageSender): boolean {
  if (sender?.tab?.id) {
    return true;
  }

  return sender?.id === chrome.runtime.id;
}

function respondWith<TAction extends RuntimeAction>(
  sendResponse: (response?: unknown) => void,
  work: RuntimeHandler<TAction>,
  task: () => MaybePromise<RuntimeResponseOf<TAction>>,
): void {
  void Promise.resolve()
    .then(task)
    .then((result) => {
      safeSendResponse(sendResponse, result);
    })
    .catch((error) => {
      if (work.errorLabel) {
        console.error(work.errorLabel, error);
      }
      safeSendResponse(sendResponse, buildFallback(work, error));
    });
}

export function registerRuntimeMessageRouter(
  handlers: RuntimeHandlerMap,
): void {
  chrome.runtime.onMessage.addListener(
    (
      message: RuntimeMessage,
      sender,
      sendResponse,
    ): boolean => {
      if (!isTrustedSender(sender)) {
        return false;
      }

      const action = message?.action as RuntimeAction | undefined;
      if (!action) {
        return false;
      }

      const handler = handlers[action] as RuntimeHandler<RuntimeAction> | undefined;
      if (!handler) {
        return false;
      }

      if (handler.sync) {
        try {
          safeSendResponse(
            sendResponse,
            handler.run(
              message as RuntimeMessageOf<RuntimeAction>,
              sender,
            ),
          );
        } catch (error) {
          if (handler.errorLabel) {
            console.error(handler.errorLabel, error);
          }
          safeSendResponse(sendResponse, buildFallback(handler, error));
        }
        return false;
      }

      respondWith(
        sendResponse,
        handler,
        () => handler.run(message as RuntimeMessageOf<RuntimeAction>, sender),
      );
      return true;
    },
  );
}
