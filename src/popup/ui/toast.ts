// @ts-nocheck
const STYLE_ID = "apb-toast-styles";
const MAX_TOASTS = 3;

let toastRoot = null;
let toastIdCounter = 0;
const toastMap = new Map();

function ensureStyles() {
  if (document.getElementById(STYLE_ID)) {
    return;
  }

  const style = document.createElement("style");
  style.id = STYLE_ID;
  style.textContent = `
    .apb-toast-host {
      display: flex;
      flex-direction: column;
      gap: 8px;
      width: 100%;
    }

    .apb-toast {
      display: grid;
      grid-template-columns: auto 1fr auto;
      align-items: start;
      gap: 10px;
      padding: 12px 14px;
      border-radius: 14px;
      border: 1px solid transparent;
      color: #fff;
      box-shadow: 0 12px 28px rgba(15, 23, 42, 0.18);
      animation: apb-toast-slide-up 180ms ease;
      cursor: pointer;
    }

    .apb-toast.success { background: #1f8f5f; }
    .apb-toast.error { background: #b53b3b; }
    .apb-toast.warning { background: #c28111; color: #201a15; }
    .apb-toast.info { background: #2c6db8; }
    .apb-toast.removing {
      opacity: 0;
      transform: translateY(6px);
      transition: opacity 140ms ease, transform 140ms ease;
    }

    .apb-toast-icon {
      font-size: 14px;
      line-height: 1.2;
      padding-top: 1px;
    }

    .apb-toast-body {
      display: grid;
      gap: 8px;
      min-width: 0;
    }

    .apb-toast-message {
      font-size: 12px;
      line-height: 1.5;
      word-break: break-word;
    }

    .apb-toast-actions {
      display: flex;
      gap: 8px;
      flex-wrap: wrap;
    }

    .apb-toast-action,
    .apb-toast-close {
      border: 1px solid rgba(255, 255, 255, 0.24);
      background: rgba(255, 255, 255, 0.14);
      color: inherit;
      border-radius: 999px;
      padding: 6px 10px;
      cursor: pointer;
      font: inherit;
      font-size: 11px;
      line-height: 1.2;
    }

    .apb-toast.warning .apb-toast-action,
    .apb-toast.warning .apb-toast-close {
      border-color: rgba(32, 26, 21, 0.16);
      background: rgba(255, 255, 255, 0.3);
    }

    .apb-toast-close {
      padding: 4px 8px;
      background: transparent;
      border-color: transparent;
      font-size: 14px;
    }

    @keyframes apb-toast-slide-up {
      from {
        opacity: 0;
        transform: translateY(8px);
      }
      to {
        opacity: 1;
        transform: translateY(0);
      }
    }
  `;

  document.head.appendChild(style);
}

function getIcon(type) {
  switch (type) {
    case "success":
      return "✅";
    case "error":
      return "❌";
    case "warning":
      return "⚠️";
    default:
      return "ℹ️";
  }
}

function normalizeAction(action = {}) {
  return {
    id: action.id || `toast-action-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    label: action.label || "OK",
    variant: action.variant || "default",
    onClick: typeof action.onClick === "function" ? action.onClick : null,
  };
}

function normalizeToastInput(input, type, duration) {
  if (input && typeof input === "object" && !Array.isArray(input)) {
    return {
      id: input.id || `toast-${Date.now()}-${toastIdCounter += 1}`,
      message: String(input.message ?? ""),
      type: input.type || "info",
      duration: Number.isFinite(Number(input.duration)) ? Number(input.duration) : 3000,
      actions: Array.isArray(input.actions) ? input.actions.map((action) => normalizeAction(action)) : [],
    };
  }

  return {
    id: `toast-${Date.now()}-${toastIdCounter += 1}`,
    message: String(input ?? ""),
    type: type || "info",
    duration: Number.isFinite(Number(duration)) ? Number(duration) : 3000,
    actions: [],
  };
}

function ensureToastRoot() {
  if (toastRoot) {
    return toastRoot;
  }

  toastRoot = document.getElementById("toast-host");
  if (!toastRoot) {
    toastRoot = document.createElement("div");
    toastRoot.id = "toast-host";
    document.body.appendChild(toastRoot);
  }

  toastRoot.classList.add("apb-toast-host");
  return toastRoot;
}

function removeToastElement(id) {
  const entry = toastMap.get(id);
  if (!entry) {
    return;
  }

  if (entry.timer) {
    window.clearTimeout(entry.timer);
  }

  entry.element.classList.add("removing");
  window.setTimeout(() => {
    entry.element.remove();
  }, 140);
  toastMap.delete(id);
}

function trimToMax() {
  const entries = [...toastMap.values()];
  while (entries.length > MAX_TOASTS) {
    const first = entries.shift();
    if (!first) {
      break;
    }
    removeToastElement(first.id);
  }
}

export function initToastRoot(container) {
  ensureStyles();
  toastRoot = container || document.getElementById("toast-host") || null;
  return ensureToastRoot();
}

export function showToast(input, type = "info", duration = 3000) {
  ensureStyles();
  const root = ensureToastRoot();
  const toast = normalizeToastInput(input, type, duration);
  const element = document.createElement("div");
  element.className = `apb-toast ${toast.type}`;
  element.dataset.toastId = toast.id;

  const icon = document.createElement("span");
  icon.className = "apb-toast-icon";
  icon.textContent = getIcon(toast.type);

  const body = document.createElement("div");
  body.className = "apb-toast-body";

  const message = document.createElement("div");
  message.className = "apb-toast-message";
  message.textContent = toast.message;
  body.appendChild(message);

  if (toast.actions.length > 0) {
    const actions = document.createElement("div");
    actions.className = "apb-toast-actions";

    toast.actions.forEach((action) => {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "apb-toast-action";
      button.textContent = action.label;
      button.addEventListener("click", (event) => {
        event.preventDefault();
        event.stopPropagation();
        action.onClick?.();
        hideToast(toast.id);
      });
      actions.appendChild(button);
    });

    body.appendChild(actions);
  }

  const closeButton = document.createElement("button");
  closeButton.type = "button";
  closeButton.className = "apb-toast-close";
  closeButton.textContent = "×";
  closeButton.addEventListener("click", (event) => {
    event.preventDefault();
    event.stopPropagation();
    hideToast(toast.id);
  });

  element.append(icon, body, closeButton);
  element.addEventListener("click", () => {
    hideToast(toast.id);
  });

  root.appendChild(element);

  const entry = {
    id: toast.id,
    element,
    timer: null,
  };

  if (toast.duration >= 0) {
    entry.timer = window.setTimeout(() => {
      hideToast(toast.id);
    }, toast.duration);
  }

  toastMap.set(toast.id, entry);
  trimToMax();
  return toast.id;
}

export function hideToast(id) {
  removeToastElement(id);
}

export function clearAllToasts() {
  [...toastMap.keys()].forEach((id) => {
    removeToastElement(id);
  });
}
