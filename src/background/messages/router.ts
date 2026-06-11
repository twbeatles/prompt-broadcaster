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
  senderPolicy?: RuntimeSenderPolicy;
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

export type RuntimeSenderPolicy = "extension" | "content" | "any";

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

function getSenderKind(
  sender: chrome.runtime.MessageSender,
): "extension" | "content" | null {
  const extensionOrigin = chrome.runtime.getURL("");
  if (sender?.id === chrome.runtime.id && sender?.url?.startsWith(extensionOrigin)) {
    return "extension";
  }

  if (Number.isFinite(sender?.tab?.id)) {
    return "content";
  }

  if (sender?.id === chrome.runtime.id) {
    return "extension";
  }

  return null;
}

function isTrustedSender(
  sender: chrome.runtime.MessageSender,
  handler: RuntimeHandler<RuntimeAction>,
): boolean {
  const senderKind = getSenderKind(sender);
  if (!senderKind) {
    return false;
  }

  const policy = handler.senderPolicy ?? "extension";
  return policy === "any" || policy === senderKind;
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
      const action = message?.action as RuntimeAction | undefined;
      if (!action) {
        return false;
      }

      const handler = handlers[action] as RuntimeHandler<RuntimeAction> | undefined;
      if (!handler) {
        return false;
      }

      if (!isTrustedSender(sender, handler)) {
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
