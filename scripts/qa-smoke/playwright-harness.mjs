import { createFixtureUrl } from "./bundle-loader.mjs";
import {
  injectorPath,
  palettePath,
  selectorCheckerPath,
} from "./config.mjs";

export async function installHarness(context) {
  await context.addInitScript(() => {
    window.__apbMessages = [];
    window.__apbClipboard = "";
    window.__apbMessageResponder = null;
    window.__apbMessageListeners = [];

    const runtime = {
      sendMessage: async (message, callback) => {
        window.__apbMessages.push(message);

        let response = { ok: true };
        if (typeof window.__apbMessageResponder === "function") {
          response = await window.__apbMessageResponder(message);
        }

        if (typeof callback === "function") {
          callback(response);
        }

        return response;
      },
      onMessage: {
        addListener(listener) {
          window.__apbMessageListeners.push(listener);
        },
      },
    };

    window.__apbDispatchRuntimeMessage = async (message) => {
      for (const listener of window.__apbMessageListeners) {
        const response = await new Promise((resolve) => {
          let settled = false;
          const finish = (payload) => {
            if (settled) {
              return;
            }
            settled = true;
            resolve(payload);
          };

          try {
            const result = listener(message, {}, finish);
            if (result !== true && !settled) {
              settled = true;
              resolve(undefined);
            }
          } catch (error) {
            finish({ ok: false, error: error?.message ?? String(error) });
          }
        });

        if (typeof response !== "undefined") {
          return response;
        }
      }

      return { ok: false, error: "No runtime listener handled the message." };
    };

    window.chrome = {
      ...(window.chrome ?? {}),
      runtime: {
        ...(window.chrome?.runtime ?? {}),
        ...runtime,
      },
    };

    const clipboard = {
      writeText: async (text) => {
        window.__apbClipboard = String(text ?? "");
      },
      readText: async () => window.__apbClipboard,
    };

    try {
      Object.defineProperty(navigator, "clipboard", {
        configurable: true,
        value: clipboard,
      });
    } catch (_error) {
      try {
        navigator.clipboard = clipboard;
      } catch (_clipboardError) {
        // Ignore clipboard shim failures.
      }
    }

    const execCommand = function execCommand(command, _showUi, value) {
      const activeElement = document.activeElement;

      if (command === "selectAll" || command === "copy") {
        return true;
      }

      if (command !== "insertText") {
        return false;
      }

      const nextValue = String(value ?? "");
      if (activeElement instanceof HTMLInputElement || activeElement instanceof HTMLTextAreaElement) {
        activeElement.value = nextValue;
        return true;
      }

      if (activeElement instanceof HTMLElement && activeElement.isContentEditable) {
        activeElement.textContent = nextValue;
        return true;
      }

      return false;
    };

    try {
      Object.defineProperty(Document.prototype, "execCommand", {
        configurable: true,
        writable: true,
        value: execCommand,
      });
    } catch (_error) {
      // Ignore when the browser does not allow redefining execCommand.
    }

    try {
      document.execCommand = execCommand;
    } catch (_error) {
      // Ignore when the browser does not allow setting execCommand directly.
    }
  });
}

export async function openFixture(page, relativePath) {
  await page.goto(createFixtureUrl(relativePath), { waitUntil: "load" });
  await page.evaluate(() => {
    window.__apbMessages = [];
    window.__apbClipboard = "";
    window.__apbMessageResponder = null;
  });
}

export async function loadInjector(page) {
  await page.addScriptTag({ path: injectorPath });
  await page.waitForFunction(() => typeof window.__aiPromptBroadcasterInjectPrompt === "function");
}

export async function loadPalette(page) {
  await page.addScriptTag({ path: palettePath });
  await page.waitForFunction(() => globalThis.__aiPromptBroadcasterQuickPaletteLoaded === true);
}

export async function runInjector(page, prompt, config) {
  return page.evaluate(
    async ({ nextPrompt, nextConfig }) =>
      window.__aiPromptBroadcasterInjectPrompt(nextPrompt, nextConfig),
    { nextPrompt: prompt, nextConfig: config },
  );
}

export async function getFixtureState(page) {
  return page.evaluate(() => window.fixtureState ?? {});
}

export async function getRuntimeMessages(page) {
  return page.evaluate(() => window.__apbMessages ?? []);
}

export async function waitForRuntimeMessage(page, predicate, timeoutMs = 10000) {
  const deadline = Date.now() + timeoutMs;

  while (Date.now() < deadline) {
    const messages = await getRuntimeMessages(page);
    const match = messages.find(predicate);
    if (match) {
      return match;
    }

    await page.waitForTimeout(100);
  }

  throw new Error("Timed out waiting for runtime message.");
}

export async function configureSelectorChecker(page, site) {
  await page.evaluate((runtimeSite) => {
    window.__apbMessages = [];
    window.__apbMessageResponder = (message) => {
      if (message?.action === "selector-check:init") {
        return { ok: true, site: runtimeSite };
      }

      return { ok: true };
    };
  }, site);
}

export async function runSelectorChecker(page) {
  await page.addScriptTag({ path: selectorCheckerPath });
}
