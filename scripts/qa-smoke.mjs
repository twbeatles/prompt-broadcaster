import assert from "node:assert/strict";
import { access } from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { pathToFileURL } from "node:url";
import { build as esbuild } from "esbuild";
import { chromium } from "playwright";

const rootDir = process.cwd();
const injectorPath = path.join(rootDir, "dist", "content", "injector.js");
const selectorCheckerPath = path.join(rootDir, "dist", "content", "selector_checker.js");
const fixturesDir = path.join(rootDir, "qa", "fixtures");
const isHeaded = process.argv.includes("--headed");

async function ensureFileExists(targetPath) {
  try {
    await access(targetPath);
  } catch (error) {
    throw new Error(`Required file is missing: ${targetPath}`);
  }
}

function createChromeMock({ grantedOrigins = [], requestGrantsMissingOrigins = true } = {}) {
  const storage = {};
  const granted = new Set(grantedOrigins);

  return {
    __getGrantedOrigins() {
      return [...granted].sort();
    },
    __getStorage() {
      return { ...storage };
    },
    storage: {
      local: {
        async get(key) {
          if (typeof key === "string") {
            return { [key]: storage[key] };
          }

          if (Array.isArray(key)) {
            return Object.fromEntries(key.map((entry) => [entry, storage[entry]]));
          }

          if (key && typeof key === "object") {
            return Object.fromEntries(
              Object.entries(key).map(([entryKey, fallbackValue]) => [
                entryKey,
                storage[entryKey] ?? fallbackValue,
              ])
            );
          }

          return { ...storage };
        },
        async set(nextValue) {
          Object.assign(storage, nextValue ?? {});
        },
        async remove(key) {
          const keys = Array.isArray(key) ? key : [key];
          keys.forEach((entry) => {
            delete storage[entry];
          });
        },
      },
    },
    permissions: {
      async contains(permission) {
        const origins = Array.isArray(permission?.origins) ? permission.origins : [];
        return origins.every((origin) => granted.has(origin));
      },
      async request(permission) {
        const origins = Array.isArray(permission?.origins) ? permission.origins : [];
        if (!requestGrantsMissingOrigins) {
          return false;
        }

        origins.forEach((origin) => granted.add(origin));
        return true;
      },
      async remove(permission) {
        const origins = Array.isArray(permission?.origins) ? permission.origins : [];
        origins.forEach((origin) => granted.delete(origin));
        return true;
      },
    },
    i18n: {
      getMessage() {
        return "";
      },
    },
  };
}

async function loadBundledModule(relativeEntryPath, chromeMock) {
  const result = await esbuild({
    entryPoints: [path.join(rootDir, relativeEntryPath)],
    bundle: true,
    format: "esm",
    platform: "browser",
    target: "chrome120",
    write: false,
    legalComments: "none",
    charset: "utf8",
  });

  globalThis.chrome = chromeMock;
  const code = result.outputFiles[0]?.text ?? "";
  return import(`data:text/javascript;base64,${Buffer.from(code).toString("base64")}`);
}

function createFixtureUrl(relativePath) {
  return pathToFileURL(path.join(fixturesDir, relativePath)).href;
}

async function installHarness(context) {
  await context.addInitScript(() => {
    window.__apbMessages = [];
    window.__apbClipboard = "";
    window.__apbMessageResponder = null;

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
        // Ignore clipboard shim failures. Injection tests do not depend on clipboard fallback.
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

async function openFixture(page, relativePath) {
  await page.goto(createFixtureUrl(relativePath), { waitUntil: "load" });
  await page.evaluate(() => {
    window.__apbMessages = [];
    window.__apbClipboard = "";
    window.__apbMessageResponder = null;
  });
}

async function loadInjector(page) {
  await page.addScriptTag({ path: injectorPath });
  await page.waitForFunction(() => typeof window.__aiPromptBroadcasterInjectPrompt === "function");
}

async function runInjector(page, prompt, config) {
  return page.evaluate(
    async ({ nextPrompt, nextConfig }) =>
      window.__aiPromptBroadcasterInjectPrompt(nextPrompt, nextConfig),
    { nextPrompt: prompt, nextConfig: config },
  );
}

async function getFixtureState(page) {
  return page.evaluate(() => window.fixtureState ?? {});
}

async function getRuntimeMessages(page) {
  return page.evaluate(() => window.__apbMessages ?? []);
}

async function waitForRuntimeMessage(page, predicate, timeoutMs = 10000) {
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

async function configureSelectorChecker(page, site) {
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

async function runSelectorChecker(page) {
  await page.addScriptTag({ path: selectorCheckerPath });
}

function sortStrings(values) {
  return [...values].sort();
}

async function main() {
  await Promise.all([
    ensureFileExists(injectorPath),
    ensureFileExists(selectorCheckerPath),
  ]);

  const browser = await chromium.launch({ headless: !isHeaded });
  const context = await browser.newContext();
  await installHarness(context);
  const page = await context.newPage();

  const results = [];

  async function runStep(name, handler) {
    try {
      await handler();
      results.push({ name, ok: true });
      console.log(`PASS ${name}`);
    } catch (error) {
      results.push({ name, ok: false, error: error instanceof Error ? error.message : String(error) });
      console.error(`FAIL ${name}`);
      console.error(error);
    }
  }

  await runStep("textarea click injection", async () => {
    await openFixture(page, "textarea-click.html");
    await loadInjector(page);

    const prompt = "Smoke prompt for textarea click";
    const result = await runInjector(page, prompt, {
      id: "fixture-textarea",
      name: "Textarea Fixture",
      inputSelector: "#prompt-box",
      inputType: "textarea",
      submitSelector: "#send-btn",
      submitMethod: "click",
      waitMs: 0,
      fallback: true,
    });
    const state = await getFixtureState(page);

    assert.equal(result.status, "submitted");
    assert.equal(result.selector, "#prompt-box");
    assert.equal(state.submittedBy, "click");
    assert.equal(state.promptValue, prompt);
  });

  await runStep("fallback selector injection", async () => {
    await openFixture(page, "textarea-fallback-click.html");
    await loadInjector(page);

    const prompt = "Fallback selector prompt";
    const result = await runInjector(page, prompt, {
      id: "fixture-fallback",
      name: "Fallback Fixture",
      inputSelector: "#missing-input",
      fallbackSelectors: ["#fallback-box"],
      inputType: "textarea",
      submitSelector: "#send-btn",
      submitMethod: "click",
      waitMs: 0,
      fallback: true,
    });
    const state = await getFixtureState(page);

    assert.equal(result.status, "submitted");
    assert.equal(result.selector, "#fallback-box");
    assert.equal(state.submittedBy, "click");
    assert.equal(state.promptValue, prompt);
  });

  await runStep("contenteditable click injection", async () => {
    await openFixture(page, "contenteditable-click.html");
    await loadInjector(page);

    const prompt = "Editable prompt";
    const result = await runInjector(page, prompt, {
      id: "fixture-editor",
      name: "Editor Fixture",
      inputSelector: "#editor",
      inputType: "contenteditable",
      submitSelector: "#send-btn",
      submitMethod: "click",
      waitMs: 0,
      fallback: true,
    });
    const state = await getFixtureState(page);
    const messages = await getRuntimeMessages(page);

    assert.equal(result.status, "submitted");
    assert.equal(state.submittedBy, "click");
    assert.equal(state.promptValue, prompt);
    assert.ok(messages.some((message) => message?.action === "injectSuccess"));
  });

  await runStep("contenteditable nearest click target preference", async () => {
    await openFixture(page, "contenteditable-nearest-click.html");
    await loadInjector(page);

    const prompt = "Nearest editor prompt";
    const result = await runInjector(page, prompt, {
      id: "fixture-editor-nearest-click",
      name: "Nearest Click Fixture",
      inputSelector: "#editor",
      inputType: "contenteditable",
      submitSelector: "button[aria-label*='send' i]",
      submitMethod: "click",
      waitMs: 0,
      fallback: true,
    });
    const state = await getFixtureState(page);

    assert.equal(result.status, "submitted");
    assert.equal(state.submittedBy, "click");
    assert.equal(state.clickedButtonId, "real-send-btn");
    assert.equal(state.promptValue, prompt);
    assert.equal(state.submitCount, 1);
  });

  await runStep("contenteditable delayed submit activation", async () => {
    await openFixture(page, "contenteditable-delayed-submit.html");
    await loadInjector(page);

    const prompt = "Delayed editor prompt";
    const startedAt = Date.now();
    const result = await runInjector(page, prompt, {
      id: "fixture-editor-delayed-submit",
      name: "Delayed Editor Fixture",
      inputSelector: "#editor",
      inputType: "contenteditable",
      submitSelector: "#send-btn",
      submitMethod: "click",
      waitMs: 0,
      fallback: true,
    });
    const state = await getFixtureState(page);

    assert.equal(result.status, "submitted");
    assert.equal(state.submittedBy, "click");
    assert.equal(state.promptValue, prompt);
    assert.equal(state.submitCount, 1);
    assert.ok(state.buttonEnabledAt >= startedAt);
  });

  await runStep("visible selector preference", async () => {
    await openFixture(page, "visibility-preference.html");
    await loadInjector(page);

    const prompt = "Visible editor prompt";
    const result = await runInjector(page, prompt, {
      id: "fixture-visible-preference",
      name: "Visibility Fixture",
      inputSelector: "textarea[aria-label='Prompt composer'], div[aria-label='Prompt composer']",
      inputType: "contenteditable",
      submitSelector: "button[aria-label='Submit']",
      submitMethod: "click",
      waitMs: 0,
      fallback: true,
    });
    const state = await getFixtureState(page);

    assert.equal(result.status, "submitted");
    assert.equal(result.selector, "div[aria-label='Prompt composer']");
    assert.equal(state.submittedBy, "click");
    assert.equal(state.promptValue, prompt);
  });

  await runStep("input enter submit", async () => {
    await openFixture(page, "keyboard-submit.html");
    await loadInjector(page);

    const prompt = "Enter submit prompt";
    const result = await runInjector(page, prompt, {
      id: "fixture-input-enter",
      name: "Input Fixture",
      inputSelector: "#single-line-input",
      inputType: "input",
      submitMethod: "enter",
      waitMs: 0,
      fallback: true,
    });
    const state = await getFixtureState(page);

    assert.equal(result.status, "submitted");
    assert.equal(state.submittedBy, "enter");
    assert.equal(state.submitTarget, "single-line-input");
    assert.equal(state.promptValue, prompt);
  });

  await runStep("textarea shift+enter submit", async () => {
    await openFixture(page, "keyboard-submit.html");
    await loadInjector(page);

    const prompt = "Shift enter prompt";
    const result = await runInjector(page, prompt, {
      id: "fixture-textarea-enter",
      name: "Textarea Keyboard Fixture",
      inputSelector: "#multi-line-input",
      inputType: "textarea",
      submitMethod: "shift+enter",
      waitMs: 0,
      fallback: true,
    });
    const state = await getFixtureState(page);

    assert.equal(result.status, "submitted");
    assert.equal(state.submittedBy, "shift+enter");
    assert.equal(state.submitTarget, "multi-line-input");
    assert.equal(state.promptValue, prompt);
  });

  await runStep("selector checker reports ok with fallback selector", async () => {
    await openFixture(page, "textarea-fallback-click.html");
    await configureSelectorChecker(page, {
      id: "selector-ok",
      name: "Selector Checker Fixture",
      inputSelector: "#missing-input",
      fallbackSelectors: ["#fallback-box"],
      inputType: "textarea",
      submitSelector: "#send-btn",
      submitMethod: "click",
      waitMs: 0,
      authSelectors: [],
    });
    await runSelectorChecker(page);

    const report = await waitForRuntimeMessage(
      page,
      (message) => message?.action === "selector-check:report",
    );

    assert.equal(report.status, "ok");
    assert.equal(report.siteId, "selector-ok");
  });

  await runStep("selector checker reports auth page", async () => {
    await openFixture(page, path.join("auth", "login.html"));
    await configureSelectorChecker(page, {
      id: "selector-auth",
      name: "Auth Fixture",
      inputSelector: "#prompt-box",
      inputType: "textarea",
      submitMethod: "click",
      submitSelector: "#send-btn",
      waitMs: 0,
      authSelectors: ["button[data-testid='login-button']"],
    });
    await runSelectorChecker(page);

    const report = await waitForRuntimeMessage(
      page,
      (message) => message?.action === "selector-check:report",
    );

    assert.equal(report.status, "auth_page");
    assert.equal(report.siteId, "selector-auth");
  });

  await runStep("selector checker ignores conditional submit when input-only mode is used", async () => {
    await openFixture(page, "selector-check-conditional-submit.html");
    await configureSelectorChecker(page, {
      id: "selector-input-only",
      name: "Conditional Submit Fixture",
      inputSelector: "#editor",
      inputType: "contenteditable",
      submitSelector: "#send-btn",
      submitMethod: "click",
      selectorCheckMode: "input-only",
      waitMs: 0,
      authSelectors: [],
    });
    await runSelectorChecker(page);

    const report = await waitForRuntimeMessage(
      page,
      (message) => message?.action === "selector-check:report",
    );

    assert.equal(report.status, "ok");
    assert.equal(report.siteId, "selector-input-only");
  });

  await browser.close();

  await runStep("custom site permission cleanup removes only unused origins", async () => {
    const chromeMock = createChromeMock({
      grantedOrigins: [
        "https://alpha.example.com/*",
        "https://beta.example.com/*",
        "https://shared.example.com/*",
        "https://unrelated.example.com/*",
      ],
    });
    const module = await loadBundledModule("src/shared/sites/index.ts", chromeMock);
    assert.deepEqual(
      module.buildSitePermissionPatterns("https://alpha.example.com:8443/", ["shared.example.com"]),
      [
        "https://alpha.example.com:8443/*",
        "https://shared.example.com/*",
      ],
    );

    await module.saveCustomSite({
      id: "alpha",
      name: "Alpha",
      url: "https://alpha.example.com/",
      hostnameAliases: ["shared.example.com"],
      inputSelector: "#alpha",
      inputType: "textarea",
      submitMethod: "enter",
    });
    await module.saveCustomSite({
      id: "beta",
      name: "Beta",
      url: "https://beta.example.com/",
      hostnameAliases: ["shared.example.com"],
      inputSelector: "#beta",
      inputType: "textarea",
      submitMethod: "enter",
    });

    await module.deleteCustomSite("alpha");
    assert.deepEqual(chromeMock.__getGrantedOrigins(), [
      "https://beta.example.com/*",
      "https://shared.example.com/*",
      "https://unrelated.example.com/*",
    ]);

    await module.resetSiteSettings();
    assert.deepEqual(chromeMock.__getGrantedOrigins(), [
      "https://unrelated.example.com/*",
    ]);
  });

  await runStep("import repair keeps valid sites and rejects invalid or unauthorized ones", async () => {
    const chromeMock = createChromeMock({
      grantedOrigins: [
        "https://allowed.example.com/*",
        "https://alias-denied.example.com/*",
        "https://alias-ok-mirror.example.com/*",
        "https://alias-ok.example.com/*",
        "https://legacy.example.com/*",
        "https://mirror.example.com/*",
        "https://second.example.com/*",
      ],
      requestGrantsMissingOrigins: false,
    });
    const module = await loadBundledModule("src/shared/stores/prompt-store.ts", chromeMock);
    await chromeMock.storage.local.set({
      customSites: [
        {
          id: "legacy",
          name: "Legacy",
          url: "https://legacy.example.com/",
          inputSelector: "#legacy",
          inputType: "textarea",
          submitMethod: "enter",
        },
      ],
    });
    const result = await module.importPromptData(JSON.stringify({
      settings: { historyLimit: 55 },
      customSites: [
        {
          id: "chatgpt",
          name: "Mirror",
          url: "https://mirror.example.com/",
          inputSelector: "#mirror-input",
          inputType: "textarea",
          submitMethod: "enter",
        },
        {
          id: "my-ai",
          name: "My AI",
          url: "https://allowed.example.com/",
          inputSelector: "#prompt",
          inputType: "textarea",
          submitMethod: "enter",
        },
        {
          id: "my-ai",
          name: "Duplicate AI",
          url: "https://second.example.com/",
          inputSelector: "#prompt",
          inputType: "textarea",
          submitMethod: "enter",
        },
        {
          id: "alias-ok",
          name: "Alias OK",
          url: "https://alias-ok.example.com/",
          hostnameAliases: ["alias-ok-mirror.example.com"],
          inputSelector: "#prompt",
          inputType: "textarea",
          submitMethod: "enter",
        },
        {
          id: "alias-denied",
          name: "Alias Denied",
          url: "https://alias-denied.example.com/",
          hostnameAliases: ["alias-missing.example.com"],
          inputSelector: "#prompt",
          inputType: "textarea",
          submitMethod: "enter",
        },
        {
          id: "bad-url",
          name: "Broken",
          url: "notaurl",
          inputSelector: "#broken",
          inputType: "textarea",
          submitMethod: "enter",
        },
        {
          id: "needs-permission",
          name: "Denied AI",
          url: "https://denied.example.com/",
          inputSelector: "#prompt",
          inputType: "textarea",
          submitMethod: "enter",
        },
      ],
      builtInSiteStates: {
        chatgpt: { enabled: false },
        unknown: { enabled: false },
      },
      builtInSiteOverrides: {
        chatgpt: {
          inputSelector: "#override",
          inputType: "invalid",
          selectorCheckMode: "bad-mode",
          submitMethod: "click",
          submitSelector: "",
        },
        unknown: {
          inputSelector: "#ignored",
        },
      },
    }));

    assert.equal(result.customSites.length, 4);
    assert.deepEqual(result.customSites.map((site) => site.id), [
      "custom-chatgpt",
      "my-ai",
      "my-ai-2",
      "alias-ok",
    ]);
    assert.equal(result.importSummary.customSites.rejected.length, 3);
    assert.deepEqual(sortStrings(result.importSummary.customSites.deniedOrigins), [
      "https://alias-missing.example.com/*",
      "https://denied.example.com/*",
    ]);
    assert.equal(result.importSummary.customSites.rewrittenIds.length, 2);
    assert.deepEqual(Object.keys(result.builtInSiteStates), ["chatgpt"]);
    assert.deepEqual(Object.keys(result.builtInSiteOverrides), ["chatgpt"]);
    assert.equal(result.builtInSiteOverrides.chatgpt.inputSelector, "#override");
    assert.equal(result.builtInSiteOverrides.chatgpt.inputType, "contenteditable");
    assert.equal(result.builtInSiteOverrides.chatgpt.selectorCheckMode, "input-and-submit");
    assert.equal(
      result.builtInSiteOverrides.chatgpt.submitSelector,
      "button[data-testid='send-button'], button[aria-label*='send' i], button[aria-label*='보내기' i]",
    );
    assert.ok(!chromeMock.__getGrantedOrigins().includes("https://legacy.example.com/*"));
  });

  await runStep("broadcast counter export import and favorite search stay consistent", async () => {
    const chromeMock = createChromeMock();
    const module = await loadBundledModule("src/shared/stores/prompt-store.ts", chromeMock);

    assert.equal(await module.getBroadcastCounter(), 0);
    assert.equal(await module.recordQueuedBroadcast(0), 0);
    assert.equal(await module.getBroadcastCounter(), 0);
    assert.equal(await module.recordQueuedBroadcast(2), 1);
    assert.equal(await module.getBroadcastCounter(), 1);

    const exported = await module.exportPromptData();
    assert.equal(exported.version, 3);
    assert.equal(exported.broadcastCounter, 1);

    await module.setBroadcastCounter(9);
    const legacyImport = await module.importPromptData(JSON.stringify({
      version: 2,
      settings: { historyLimit: 50 },
    }));
    assert.equal(legacyImport.broadcastCounter, 0);
    assert.equal(await module.getBroadcastCounter(), 0);

    const modernImport = await module.importPromptData(JSON.stringify({
      version: 3,
      broadcastCounter: 4,
      settings: { historyLimit: 50 },
    }));
    assert.equal(modernImport.broadcastCounter, 4);
    assert.equal(await module.getBroadcastCounter(), 4);

    assert.equal(
      module.matchesFavoriteSearch(
        {
          title: "Alpha Plan",
          text: "Prompt comparison notes",
          tags: ["urgent", "weekly"],
          folder: "Work",
        },
        "alpha",
      ),
      true,
    );
    assert.equal(
      module.matchesFavoriteSearch(
        {
          title: "Alpha Plan",
          text: "Prompt comparison notes",
          tags: ["urgent", "weekly"],
          folder: "Work",
        },
        "weekly",
      ),
      true,
    );
    assert.equal(
      module.matchesFavoriteSearch(
        {
          title: "Alpha Plan",
          text: "Prompt comparison notes",
          tags: ["urgent", "weekly"],
          folder: "Work",
        },
        "#urgent",
      ),
      true,
    );
    assert.equal(
      module.matchesFavoriteSearch(
        {
          title: "Alpha Plan",
          text: "Prompt comparison notes",
          tags: ["urgent", "weekly"],
          folder: "Work",
        },
        "work",
      ),
      true,
    );
    assert.equal(
      module.matchesFavoriteSearch(
        {
          title: "Alpha Plan",
          text: "Prompt comparison notes",
          tags: ["urgent", "weekly"],
          folder: "Work",
        },
        "missing",
      ),
      false,
    );
  });

  const failed = results.filter((result) => !result.ok);
  if (failed.length > 0) {
    console.error(`Smoke QA failed: ${failed.length}/${results.length} step(s) did not pass.`);
    process.exitCode = 1;
    return;
  }

  console.log(`Smoke QA passed: ${results.length}/${results.length} step(s) passed.`);
}

main().catch((error) => {
  console.error("[AI Prompt Broadcaster] Smoke QA failed to start.", error);
  process.exitCode = 1;
});
