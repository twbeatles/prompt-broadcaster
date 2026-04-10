import assert from "node:assert/strict";
import path from "node:path";
import process from "node:process";
import { chromium } from "playwright";
import {
  injectorPath,
  isHeaded,
  palettePath,
  selectorCheckerPath,
} from "./qa-smoke/config.mjs";
import { createChromeMock } from "./qa-smoke/chrome-mock.mjs";
import { ensureFileExists, loadBundledModule } from "./qa-smoke/bundle-loader.mjs";
import {
  configureSelectorChecker,
  getFixtureState,
  getRuntimeMessages,
  installHarness,
  loadInjector,
  loadPalette,
  openFixture,
  runInjector,
  runSelectorChecker,
  waitForRuntimeMessage,
} from "./qa-smoke/playwright-harness.mjs";

function sortStrings(values) {
  return [...values].sort();
}

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function main() {
  await Promise.all([
    ensureFileExists(injectorPath),
    ensureFileExists(palettePath),
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

  await runStep("selector checker ignores conditional submit when conditional mode is used", async () => {
    await openFixture(page, "selector-check-conditional-submit.html");
    await configureSelectorChecker(page, {
      id: "selector-conditional-submit",
      name: "Conditional Submit Fixture",
      inputSelector: "#editor",
      inputType: "contenteditable",
      submitSelector: "button[aria-label*='제출' i]",
      submitMethod: "click",
      selectorCheckMode: "input-and-conditional-submit",
      waitMs: 0,
      authSelectors: [],
    });
    await runSelectorChecker(page);

    const report = await waitForRuntimeMessage(
      page,
      (message) => message?.action === "selector-check:report",
    );

    assert.equal(report.status, "ok");
    assert.equal(report.siteId, "selector-conditional-submit");
  });

  await runStep("selector checker accepts textarea-first Grok variants", async () => {
    await openFixture(page, "grok-textarea-conditional-submit.html");
    await configureSelectorChecker(page, {
      id: "selector-grok-textarea",
      name: "Grok Fixture",
      inputSelector: "textarea[aria-label*='grok' i], textarea[placeholder*='help' i], textarea",
      fallbackSelectors: [
        "div.tiptap.ProseMirror[contenteditable='true']",
        "div.ProseMirror[contenteditable='true'][translate='no']",
      ],
      inputType: "textarea",
      submitSelector: "button[aria-label*='제출' i]",
      submitMethod: "click",
      selectorCheckMode: "input-and-conditional-submit",
      waitMs: 0,
      authSelectors: ["a[href*='/sign-in']"],
    });
    await runSelectorChecker(page);

    const report = await waitForRuntimeMessage(
      page,
      (message) => message?.action === "selector-check:report",
    );

    assert.equal(report.status, "ok");
    assert.equal(report.siteId, "selector-grok-textarea");
  });

  await runStep("selector checker does not treat soft-gated pages as auth-only", async () => {
    await openFixture(page, "soft-gated-auth-modal.html");
    await configureSelectorChecker(page, {
      id: "selector-soft-gated",
      name: "Soft Gated Fixture",
      inputSelector: "#ask-input[data-lexical-editor='true'][role='textbox'], #ask-input[contenteditable='true'][role='textbox']",
      fallbackSelectors: ["div[contenteditable='true'][role='textbox']"],
      inputType: "contenteditable",
      submitSelector: "button[aria-label*='보내기' i], button[aria-label*='submit' i]",
      submitMethod: "click",
      selectorCheckMode: "input-and-conditional-submit",
      waitMs: 0,
      authSelectors: ["button[data-testid='login-button']", "input[type='email']"],
    });
    await runSelectorChecker(page);

    const report = await waitForRuntimeMessage(
      page,
      (message) => message?.action === "selector-check:report",
    );

    assert.equal(report.status, "ok");
    assert.equal(report.siteId, "selector-soft-gated");
  });

  await runStep("quick palette filters favorites and executes the active result", async () => {
    await openFixture(page, "textarea-click.html");
    await page.evaluate(() => {
      window.__apbMessages = [];
      window.__apbMessageResponder = async (message) => {
        if (message?.action === "quickPalette:getState") {
          return {
            ok: true,
            favorites: [
              {
                id: "fav-alpha",
                title: "Alpha Plan",
                preview: "Launch checklist",
                mode: "single",
                tags: ["launch"],
                folder: "Work",
              },
              {
                id: "fav-beta",
                title: "Beta Chain",
                preview: "Review and summarize",
                mode: "chain",
                tags: ["review"],
                folder: "Ops",
              },
            ],
          };
        }

        if (message?.action === "quickPalette:execute") {
          return { ok: true, favoriteId: message.favoriteId };
        }

        return { ok: true };
      };
    });
    await loadPalette(page);
    await page.evaluate(() => window.__apbDispatchRuntimeMessage({ action: "quickPalette:toggle" }));

    await page.waitForFunction(() => {
      const host = document.getElementById("apb-quick-palette-root");
      return Boolean(host?.shadowRoot?.querySelector(".search"));
    });

    await page.evaluate(() => {
      const root = document.getElementById("apb-quick-palette-root").shadowRoot;
      const input = root.querySelector(".search");
      input.value = "beta";
      input.dispatchEvent(new Event("input", { bubbles: true, composed: true }));
    });

    const filteredCount = await page.evaluate(() => {
      const root = document.getElementById("apb-quick-palette-root").shadowRoot;
      return root.querySelectorAll("[data-favorite-id]").length;
    });
    assert.equal(filteredCount, 1);

    await page.evaluate(() => {
      const root = document.getElementById("apb-quick-palette-root").shadowRoot;
      root.querySelector(".search").dispatchEvent(
        new KeyboardEvent("keydown", { key: "Enter", bubbles: true, composed: true }),
      );
    });

    await page.waitForFunction(() => !document.getElementById("apb-quick-palette-root"));
    const messages = await getRuntimeMessages(page);
    assert.ok(messages.some((message) => message?.action === "quickPalette:getState"));
    assert.ok(messages.some((message) => message?.action === "quickPalette:execute" && message.favoriteId === "fav-beta"));
  });

  await browser.close();

  await runStep("runtime router trusts only internal extension senders", async () => {
    const listeners = [];
    const chromeMock = {
      runtime: {
        id: "ext-1",
        onMessage: {
          addListener(listener) {
            listeners.push(listener);
          },
        },
      },
    };
    const module = await loadBundledModule("src/background/messages/router.ts", chromeMock);
    let syncCalls = 0;
    let asyncCalls = 0;

    module.registerRuntimeMessageRouter({
      ping: {
        sync: true,
        run: () => {
          syncCalls += 1;
          return { ok: true, type: "sync" };
        },
      },
      asyncPing: {
        run: async () => {
          asyncCalls += 1;
          return { ok: true, type: "async" };
        },
      },
    });

    assert.equal(listeners.length, 1);
    const listener = listeners[0];

    let blockedCalled = false;
    assert.equal(
      listener({ action: "ping" }, { id: "foreign-extension" }, () => {
        blockedCalled = true;
      }),
      false,
    );
    assert.equal(syncCalls, 0);
    assert.equal(blockedCalled, false);

    let popupResponse = null;
    assert.equal(
      listener({ action: "ping" }, { id: "ext-1" }, (payload) => {
        popupResponse = payload;
      }),
      false,
    );
    assert.equal(syncCalls, 1);
    assert.deepEqual(popupResponse, { ok: true, type: "sync" });

    let contentResponse = null;
    assert.equal(
      listener({ action: "ping" }, { tab: { id: 42 } }, (payload) => {
        contentResponse = payload;
      }),
      false,
    );
    assert.equal(syncCalls, 2);
    assert.deepEqual(contentResponse, { ok: true, type: "sync" });

    assert.equal(
      listener({ action: "asyncPing" }, { id: "ext-1" }, () => {
        throw new Error("port closed");
      }),
      true,
    );
    await delay(20);
    assert.equal(asyncCalls, 1);
  });

  await runStep("runtime messaging helper falls back on timeout and closed ports", async () => {
    const chromeMock = {
      runtime: {
        lastError: null,
        sendMessage() {},
      },
    };
    const module = await loadBundledModule("src/shared/chrome/messaging.ts", chromeMock);

    const timeoutFallback = { ok: false, reason: "timeout" };
    assert.deepEqual(
      await module.sendRuntimeMessageWithTimeout({ action: "ping" }, 20, timeoutFallback),
      timeoutFallback,
    );

    chromeMock.runtime.sendMessage = (_message, callback) => {
      chromeMock.runtime.lastError = {
        message: "The message port closed before a response was received.",
      };
      callback(undefined);
      chromeMock.runtime.lastError = null;
    };
    const portFallback = { ok: false, reason: "closed" };
    assert.deepEqual(
      await module.sendRuntimeMessageWithTimeout({ action: "ping" }, 20, portFallback),
      portFallback,
    );

    chromeMock.runtime.sendMessage = (_message, callback) => {
      callback({ ok: true, handled: true });
    };
    assert.deepEqual(
      await module.sendRuntimeMessageWithTimeout({ action: "ping" }, 20, null),
      { ok: true, handled: true },
    );
  });

  await runStep("selector wait observer limits watched attributes", async () => {
    const previousGlobals = {
      document: globalThis.document,
      window: globalThis.window,
      performance: globalThis.performance,
      MutationObserver: globalThis.MutationObserver,
      NodeFilter: globalThis.NodeFilter,
    };
    const observedOptions = [];

    try {
      globalThis.document = {
        documentElement: {},
        querySelectorAll() {
          return [];
        },
        createTreeWalker() {
          return {
            currentNode: null,
            nextNode() {
              return null;
            },
          };
        },
      };
      globalThis.window = {
        setTimeout,
        clearTimeout,
        setInterval,
        clearInterval,
        getComputedStyle() {
          return {
            display: "block",
            visibility: "visible",
          };
        },
      };
      globalThis.performance = { now: () => Date.now() };
      globalThis.NodeFilter = { SHOW_ELEMENT: 1 };
      globalThis.MutationObserver = class {
        observe(_target, options) {
          observedOptions.push(options);
        }

        disconnect() {}
      };

      const module = await loadBundledModule("src/content/injector/selectors.ts", createChromeMock());
      assert.equal(await module.waitForElement(["#delayed"], 5), null);
      assert.deepEqual(observedOptions[0]?.attributeFilter, [
        "class",
        "id",
        "style",
        "disabled",
        "aria-disabled",
      ]);
    } finally {
      Object.assign(globalThis, previousGlobals);
    }
  });

  await runStep("selection helper avoids duplicate listener registration", async () => {
    const previousGlobals = {
      document: globalThis.document,
      window: globalThis.window,
      selectionLoaded: globalThis.__aiPromptBroadcasterSelectionScriptLoaded,
    };
    let documentListenerCount = 0;
    let windowListenerCount = 0;
    let runtimeListenerCount = 0;
    let runtimeSendCount = 0;
    const chromeMock = {
      runtime: {
        lastError: null,
        sendMessage(_message, callback) {
          runtimeSendCount += 1;
          callback?.({ ok: true });
        },
        onMessage: {
          addListener() {
            runtimeListenerCount += 1;
          },
        },
      },
    };

    try {
      delete globalThis.__aiPromptBroadcasterSelectionScriptLoaded;
      globalThis.document = {
        addEventListener() {
          documentListenerCount += 1;
        },
      };
      globalThis.window = {
        addEventListener() {
          windowListenerCount += 1;
        },
        setTimeout(handler) {
          handler();
          return 1;
        },
        clearTimeout() {},
        getSelection() {
          return {
            toString() {
              return "selected text";
            },
          };
        },
      };

      await loadBundledModule("src/content/selection/helper.ts", chromeMock);
      await loadBundledModule("src/content/selection/helper.ts", chromeMock);

      assert.equal(runtimeListenerCount, 1);
      assert.equal(documentListenerCount, 3);
      assert.equal(windowListenerCount, 1);
      assert.equal(runtimeSendCount, 1);
    } finally {
      globalThis.document = previousGlobals.document;
      globalThis.window = previousGlobals.window;
      if (previousGlobals.selectionLoaded === undefined) {
        delete globalThis.__aiPromptBroadcasterSelectionScriptLoaded;
      } else {
        globalThis.__aiPromptBroadcasterSelectionScriptLoaded = previousGlobals.selectionLoaded;
      }
    }
  });

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

  await runStep("site helpers derive verification metadata and submit requirements", async () => {
    const module = await loadBundledModule("src/shared/sites/index.ts", createChromeMock());

    assert.equal(
      module.buildSubmitRequirement({
        submitMethod: "click",
        submitSelector: "button[type='submit']",
        selectorCheckMode: "input-and-conditional-submit",
      }),
      "conditional",
    );
    assert.equal(module.shouldRequireVisibleSubmitSurface("conditional"), false);
    assert.equal(module.shouldProbeSubmitAfterInput("conditional"), true);

    const normalizedSite = module.normalizeCustomSite({
      id: "verified-site",
      name: "Verified Site",
      url: "https://verified.example.com/",
      inputSelector: "#prompt",
      inputType: "textarea",
      submitMethod: "enter",
      lastVerified: "2026-03",
      verifiedAt: "2026-04-10",
      verifiedRoute: "/compose",
      verifiedAuthState: "soft-gated",
      verifiedLocale: "ko-KR",
      verifiedVersion: "verified-site-apr-2026",
    });

    assert.equal(normalizedSite.lastVerified, "2026-04");
    assert.equal(normalizedSite.verifiedAt, "2026-04-10");
    assert.equal(normalizedSite.verifiedRoute, "/compose");
    assert.equal(normalizedSite.verifiedAuthState, "soft-gated");
    assert.equal(normalizedSite.verifiedLocale, "ko-KR");
    assert.equal(normalizedSite.verifiedVersion, "verified-site-apr-2026");
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
          id: "alias-invalid",
          name: "Alias Invalid",
          url: "https://alias-invalid.example.com/",
          hostnameAliases: [" https://alias-invalid.example.com/ "],
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
    assert.equal(result.importSummary.customSites.rejected.length, 4);
    assert.deepEqual(sortStrings(result.importSummary.customSites.deniedOrigins), [
      "https://alias-missing.example.com/*",
      "https://denied.example.com/*",
    ]);
    assert.equal(result.importSummary.customSites.rewrittenIds.length, 2);
    assert.deepEqual(
      result.importSummary.customSites.rejected.find((entry) => entry.id === "alias-invalid"),
      {
        id: "alias-invalid",
        name: "Alias Invalid",
        reason: "validation_failed",
        errors: ["Hostname alias line 1 must not include leading or trailing whitespace."],
      },
    );
    assert.deepEqual(Object.keys(result.builtInSiteStates), ["chatgpt"]);
    assert.deepEqual(Object.keys(result.builtInSiteOverrides), ["chatgpt"]);
    assert.equal(result.builtInSiteOverrides.chatgpt.inputSelector, "#override");
    assert.equal(result.builtInSiteOverrides.chatgpt.inputType, "contenteditable");
    assert.equal(
      result.builtInSiteOverrides.chatgpt.selectorCheckMode,
      "input-and-conditional-submit",
    );
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
    assert.equal(exported.version, 7);
    assert.equal(exported.broadcastCounter, 1);
    assert.deepEqual(exported.settings, module.DEFAULT_SETTINGS);
    assert.deepEqual(exported.settings.siteOrder, []);

    await module.setBroadcastCounter(9);
    const legacyImport = await module.importPromptData(JSON.stringify({
      version: 2,
      settings: { historyLimit: 50 },
    }));
    assert.equal(legacyImport.broadcastCounter, 0);
    assert.equal(await module.getBroadcastCounter(), 0);
    assert.equal(legacyImport.importSummary.version, 7);
    assert.equal(legacyImport.importSummary.migratedFromVersion, 2);
    assert.equal(legacyImport.settings.waitMsMultiplier, 1);
    assert.equal(legacyImport.settings.historySort, "latest");
    assert.equal(legacyImport.settings.favoriteSort, "recentUsed");
    assert.deepEqual(legacyImport.settings.siteOrder, []);

    const modernImport = await module.importPromptData(JSON.stringify({
      version: 4,
      broadcastCounter: 4,
      favorites: [
        {
          id: "fav-1",
          title: "Alpha Plan",
          text: "Prompt comparison notes",
          createdAt: "2026-04-01T00:00:00.000Z",
          favoritedAt: "2026-04-01T00:00:00.000Z",
        },
      ],
      history: [
        {
          id: 101,
          text: "Legacy result mapping",
          createdAt: "2026-04-01T00:00:00.000Z",
          siteResults: {
            chatgpt: "submitted",
            claude: "selector_failed",
          },
        },
      ],
      settings: { historyLimit: 50 },
    }));
    assert.equal(modernImport.broadcastCounter, 4);
    assert.equal(await module.getBroadcastCounter(), 4);
    assert.equal(modernImport.importSummary.version, 7);
    assert.equal(modernImport.importSummary.migratedFromVersion, 4);
    assert.equal(modernImport.settings.waitMsMultiplier, 1);
    assert.equal(modernImport.settings.historySort, "latest");
    assert.equal(modernImport.settings.favoriteSort, "recentUsed");
    assert.deepEqual(modernImport.settings.siteOrder, []);
    assert.equal(modernImport.history[0].siteResults.chatgpt.code, "submitted");
    assert.equal(modernImport.history[0].siteResults.claude.code, "selector_timeout");
    assert.deepEqual(modernImport.history[0].submittedSiteIds, ["chatgpt"]);
    assert.deepEqual(modernImport.history[0].failedSiteIds, ["claude"]);
    assert.equal(modernImport.history[0].originFavoriteId ?? null, null);
    assert.equal(modernImport.history[0].chainRunId ?? null, null);
    assert.equal(modernImport.history[0].chainStepIndex ?? null, null);
    assert.equal(modernImport.history[0].chainStepCount ?? null, null);
    assert.deepEqual(modernImport.history[0].targetSnapshots, [
      {
        siteId: "chatgpt",
        resolvedPrompt: "Legacy result mapping",
        targetMode: "default",
        targetTabId: null,
      },
      {
        siteId: "claude",
        resolvedPrompt: "Legacy result mapping",
        targetMode: "default",
        targetTabId: null,
      },
    ]);
    assert.equal(modernImport.favorites[0].usageCount, 0);
    assert.equal(modernImport.favorites[0].lastUsedAt, null);
    assert.equal(modernImport.favorites[0].mode, "single");
    assert.deepEqual(modernImport.favorites[0].steps, []);
    assert.equal(modernImport.favorites[0].scheduleEnabled, false);
    assert.equal(modernImport.favorites[0].scheduledAt, null);
    assert.equal(modernImport.favorites[0].scheduleRepeat, "none");

    const v7VerificationImport = await module.importPromptData(JSON.stringify({
      version: 7,
      builtInSiteOverrides: {
        chatgpt: {
          verifiedAt: "2026-04-10",
          verifiedRoute: "/",
          verifiedAuthState: "logged-out",
          verifiedLocale: "ko-KR",
          verifiedVersion: "chatgpt-web-apr-2026",
        },
      },
    }));
    assert.equal(v7VerificationImport.importSummary.version, 7);
    assert.equal(v7VerificationImport.importSummary.migratedFromVersion, 7);
    assert.equal(v7VerificationImport.builtInSiteOverrides.chatgpt.lastVerified, "2026-04");
    assert.equal(v7VerificationImport.builtInSiteOverrides.chatgpt.verifiedAt, "2026-04-10");
    assert.equal(v7VerificationImport.builtInSiteOverrides.chatgpt.verifiedRoute, "/");
    assert.equal(v7VerificationImport.builtInSiteOverrides.chatgpt.verifiedAuthState, "logged-out");
    assert.equal(v7VerificationImport.builtInSiteOverrides.chatgpt.verifiedLocale, "ko-KR");
    assert.equal(v7VerificationImport.builtInSiteOverrides.chatgpt.verifiedVersion, "chatgpt-web-apr-2026");

    const legacyVerificationImport = await module.importPromptData(JSON.stringify({
      version: 6,
      customSites: [
        {
          id: "legacy-verification",
          name: "Legacy Verification",
          url: "https://legacy-verification.example.com/",
          inputSelector: "#prompt",
          inputType: "textarea",
          submitMethod: "enter",
          lastVerified: "2026-03",
        },
      ],
    }));
    assert.equal(legacyVerificationImport.importSummary.version, 7);
    assert.equal(legacyVerificationImport.importSummary.migratedFromVersion, 6);
    assert.equal(legacyVerificationImport.customSites[0].lastVerified, "2026-03");
    assert.equal(legacyVerificationImport.customSites[0].verifiedAt ?? "", "");

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

  await runStep("broadcast target snapshots preserve resend routing and safe tab fallback", async () => {
    const module = await loadBundledModule("src/shared/broadcast/target-snapshots.ts", createChromeMock());

    assert.deepEqual(
      module.buildQueueTargetSnapshots([
        {
          site: { id: "chatgpt" },
          resolvedPrompt: "Resolved ChatGPT prompt",
        },
        {
          site: { id: "claude" },
          resolvedPrompt: "Resolved Claude prompt",
          targetTabId: 77,
        },
        {
          site: { id: "gemini" },
          resolvedPrompt: "Resolved Gemini prompt",
          forceNewTab: true,
        },
      ], "Fallback prompt"),
      [
        {
          siteId: "chatgpt",
          resolvedPrompt: "Resolved ChatGPT prompt",
          targetMode: "default",
          targetTabId: null,
        },
        {
          siteId: "claude",
          resolvedPrompt: "Resolved Claude prompt",
          targetMode: "tab",
          targetTabId: 77,
        },
        {
          siteId: "gemini",
          resolvedPrompt: "Resolved Gemini prompt",
          targetMode: "new",
          targetTabId: null,
        },
      ],
    );

    assert.deepEqual(
      module.buildBroadcastTargetMessageFromSnapshot(
        {
          siteId: "claude",
          resolvedPrompt: "Resolved Claude prompt",
          targetMode: "tab",
          targetTabId: 77,
        },
        [
          {
            siteId: "claude",
            siteName: "Claude",
            tabId: 77,
            title: "Claude chat",
            url: "https://claude.ai/chat",
            active: true,
            status: "complete",
            windowId: 1,
          },
        ],
      ),
      {
        id: "claude",
        resolvedPrompt: "Resolved Claude prompt",
        tabId: 77,
      },
    );

    assert.deepEqual(
      module.buildBroadcastTargetMessageFromSnapshot({
        siteId: "claude",
        resolvedPrompt: "Resolved Claude prompt",
        targetMode: "tab",
        targetTabId: 77,
      }),
      {
        id: "claude",
        resolvedPrompt: "Resolved Claude prompt",
      },
    );

    assert.deepEqual(
      module.buildBroadcastTargetMessageFromSnapshot({
        siteId: "gemini",
        resolvedPrompt: "Resolved Gemini prompt",
        targetMode: "new",
        targetTabId: null,
      }),
      {
        id: "gemini",
        resolvedPrompt: "Resolved Gemini prompt",
        reuseExistingTab: false,
        target: "new",
      },
    );
  });

  await runStep("template resolution includes per-site override variables and resolves prompts", async () => {
    const module = await loadBundledModule("src/shared/broadcast/resolution.ts", createChromeMock());
    const targets = [
      {
        id: "chatgpt",
        promptTemplate: "Base prompt for {{topic}} on {{date}}",
      },
      {
        id: "claude",
        promptTemplate: "Override for {{audience}} with {{selection}}",
      },
    ];

    const variables = module.detectTemplateVariablesForTargets(targets);
    assert.deepEqual(
      variables.map((variable) => variable.name),
      ["topic", "date", "audience", "selection"],
    );
    assert.deepEqual(
      module.findMissingTemplateValuesForTargets(targets, { topic: "Launch" }),
      ["audience"],
    );

    const resolved = module.resolveBroadcastTargets(targets, {
      topic: "Launch",
      date: "2026-04-01",
      audience: "QA",
      selection: "Selected text",
    });
    assert.equal(resolved[0].resolvedPrompt, "Base prompt for Launch on 2026-04-01");
    assert.equal(resolved[1].resolvedPrompt, "Override for QA with Selected text");
  });

  await runStep("resolved prompt precedence preserves retry payload", async () => {
    const module = await loadBundledModule("src/shared/broadcast/resolution.ts", createChromeMock());

    assert.equal(
      module.pickBroadcastTargetPrompt(
        {
          promptOverride: "Override prompt that should not win",
          resolvedPrompt: "Rendered retry prompt",
        },
        "Base prompt",
      ),
      "Rendered retry prompt",
    );
    assert.equal(
      module.pickBroadcastTargetPrompt(
        {
          resolvedPrompt: "",
          promptOverride: "Override prompt that should not win",
        },
        "Base prompt",
      ),
      "",
    );
  });

  await runStep("prompt state keeps draft handoff and last sent prompt separate", async () => {
    const chromeMock = createChromeMock();
    const module = await loadBundledModule("src/shared/prompt-state.ts", chromeMock);

    await chromeMock.storage.local.set({
      lastPrompt: "legacy draft",
    });
    assert.equal(await module.getComposeDraftPrompt(), "legacy draft");

    await module.setComposeDraftPrompt("draft from composer");
    await module.setLastSentPrompt("resolved send payload");
    assert.equal(await module.getComposeDraftPrompt(), "draft from composer");
    assert.equal(await module.getLastSentPrompt(), "resolved send payload");

    const storedIntent = await module.setPopupPromptIntent("popup handoff");
    assert.equal(storedIntent.prompt, "popup handoff");
    assert.equal((await module.getPopupPromptIntent())?.prompt, "popup handoff");

    const consumedIntent = await module.consumePopupPromptIntent();
    assert.equal(consumedIntent?.prompt, "popup handoff");
    assert.equal(await module.getPopupPromptIntent(), null);
  });

  await runStep("favorite run job helpers dedupe active runs only", async () => {
    const module = await loadBundledModule("src/shared/runtime-state/favorite-run-jobs.ts", createChromeMock());

    const runningJob = module.normalizeFavoriteRunJobRecord({
      jobId: "job-running",
      favoriteId: "fav-1",
      status: "running",
      mode: "chain",
      stepCount: 2,
      completedSteps: 1,
      currentStepIndex: 1,
      createdAt: "2026-04-03T00:00:00.000Z",
      updatedAt: "2026-04-03T00:00:09.000Z",
    });
    const recentCompletedJob = module.normalizeFavoriteRunJobRecord({
      jobId: "job-complete",
      favoriteId: "fav-2",
      status: "completed",
      mode: "single",
      stepCount: 1,
      completedSteps: 1,
      currentStepIndex: 0,
      createdAt: "2026-04-03T00:00:00.000Z",
      updatedAt: "2026-04-03T00:00:06.000Z",
    });

    assert.equal(
      module.findFavoriteRunDedupedJob([runningJob], "fav-1")?.jobId,
      "job-running",
    );
    assert.equal(
      module.findFavoriteRunDedupedJob([recentCompletedJob], "fav-2"),
      null,
    );
  });

  await runStep("favorite workflow uses default targets for empty chain step overrides", async () => {
    const chromeMock = createChromeMock();
    const module = await loadBundledModule("src/background/popup/favorites-workflow.ts", chromeMock);
    let queuedSiteRefs = [];

    await chromeMock.storage.local.set({
      promptFavorites: [{
        id: "fav-chain",
        title: "Chain favorite",
        text: "First step",
        sentTo: ["claude"],
        createdAt: "2026-04-03T00:00:00.000Z",
        favoritedAt: "2026-04-03T00:00:00.000Z",
        templateDefaults: {},
        tags: [],
        folder: "",
        pinned: false,
        usageCount: 0,
        lastUsedAt: null,
        mode: "chain",
        steps: [{
          id: "step-1",
          text: "First step",
          delayMs: 0,
          targetSiteIds: [],
        }],
        scheduleEnabled: false,
        scheduledAt: null,
        scheduleRepeat: "none",
      }],
      promptHistory: [],
      templateVariableCache: {},
      broadcastCounter: 0,
    });

    const workflow = module.createFavoriteWorkflow({
      getBroadcastTriggerLabel: (trigger) => trigger ?? "popup",
      getI18nMessage: () => "",
      rememberNormalTab: async () => null,
      getPreferredNormalActiveTab: async () => null,
      isInjectableTabUrl: () => true,
      getSelectedTextFromTab: async () => "",
      openPopupWithPrompt: async () => {},
      nowIso: () => "2026-04-03T00:00:00.000Z",
      buildChainRunId: () => "chain-1",
      queueBroadcastRequest: async (_prompt, siteRefs) => {
        queuedSiteRefs = siteRefs;
        return {
          ok: true,
          broadcastId: "broadcast-1",
        };
      },
    });

    const queuedResponse = await workflow.handleFavoriteRunMessage({
      favoriteId: "fav-chain",
      trigger: "popup",
      allowPopupFallback: false,
    }, {});
    assert.equal(queuedResponse?.ok, true);

    const queuedJob = chromeMock.__getStorage().session.favoriteRunJobs?.[0];
    assert.deepEqual(queuedJob.steps?.[0]?.targetSiteIds, ["claude"]);

    await workflow.handleFavoriteRunJobAlarm(`apb-favorite-job:${queuedJob.jobId}`);
    assert.deepEqual(queuedSiteRefs, [{ id: "claude" }]);
  });

  await runStep("favorite workflow dedupes concurrent queue requests for the same favorite", async () => {
    const chromeMock = createChromeMock();
    const module = await loadBundledModule("src/background/popup/favorites-workflow.ts", chromeMock);
    const nowIso = "2026-04-03T00:00:00.000Z";

    await chromeMock.storage.local.set({
      promptFavorites: [{
        id: "fav-dedupe",
        title: "Deduped favorite",
        text: "Run once",
        sentTo: ["claude"],
        createdAt: nowIso,
        favoritedAt: nowIso,
        templateDefaults: {},
        tags: [],
        folder: "",
        pinned: false,
        usageCount: 0,
        lastUsedAt: null,
        mode: "single",
        steps: [],
        scheduleEnabled: false,
        scheduledAt: null,
        scheduleRepeat: "none",
      }],
      templateVariableCache: {},
      broadcastCounter: 0,
    });

    const workflow = module.createFavoriteWorkflow({
      getBroadcastTriggerLabel: (trigger) => trigger ?? "popup",
      getI18nMessage: () => "",
      rememberNormalTab: async () => null,
      getPreferredNormalActiveTab: async () => null,
      isInjectableTabUrl: () => true,
      getSelectedTextFromTab: async () => "",
      openPopupWithPrompt: async () => {},
      nowIso: () => nowIso,
      buildChainRunId: () => "chain-dedupe",
      queueBroadcastRequest: async () => ({ ok: true, broadcastId: "broadcast-dedupe" }),
    });

    const responses = await Promise.all([
      workflow.handleFavoriteRunMessage({
        favoriteId: "fav-dedupe",
        trigger: "popup",
        allowPopupFallback: false,
      }, {}),
      workflow.handleFavoriteRunMessage({
        favoriteId: "fav-dedupe",
        trigger: "popup",
        allowPopupFallback: false,
      }, {}),
    ]);

    const jobs = chromeMock.__getStorage().session.favoriteRunJobs ?? [];
    assert.equal(jobs.length, 1);
    assert.equal(responses.filter((response) => response?.deduped).length, 1);
    assert.equal(responses.filter((response) => response?.ok).length, 2);
  });

  await runStep("favorite workflow serializes counter variables across concurrent alarms", async () => {
    const chromeMock = createChromeMock();
    const module = await loadBundledModule("src/background/popup/favorites-workflow.ts", chromeMock);
    const nowIso = "2026-04-03T00:00:00.000Z";
    const queuedPrompts = [];
    let broadcastIndex = 0;

    await chromeMock.storage.local.set({
      promptFavorites: [
        {
          id: "fav-counter-a",
          title: "Counter A",
          text: "Counter {{counter}}",
          sentTo: ["chatgpt"],
          createdAt: nowIso,
          favoritedAt: nowIso,
          templateDefaults: {},
          tags: [],
          folder: "",
          pinned: false,
          usageCount: 0,
          lastUsedAt: null,
          mode: "single",
          steps: [],
          scheduleEnabled: false,
          scheduledAt: null,
          scheduleRepeat: "none",
        },
        {
          id: "fav-counter-b",
          title: "Counter B",
          text: "Counter {{counter}}",
          sentTo: ["claude"],
          createdAt: nowIso,
          favoritedAt: nowIso,
          templateDefaults: {},
          tags: [],
          folder: "",
          pinned: false,
          usageCount: 0,
          lastUsedAt: null,
          mode: "single",
          steps: [],
          scheduleEnabled: false,
          scheduledAt: null,
          scheduleRepeat: "none",
        },
      ],
      templateVariableCache: {},
      broadcastCounter: 0,
    });

    const workflow = module.createFavoriteWorkflow({
      getBroadcastTriggerLabel: (trigger) => trigger ?? "popup",
      getI18nMessage: () => "",
      rememberNormalTab: async () => null,
      getPreferredNormalActiveTab: async () => null,
      isInjectableTabUrl: () => true,
      getSelectedTextFromTab: async () => "",
      openPopupWithPrompt: async () => {},
      nowIso: () => nowIso,
      buildChainRunId: () => `chain-${Date.now()}`,
      queueBroadcastRequest: async (prompt) => {
        queuedPrompts.push(prompt);
        const currentCounter = chromeMock.__getStorage().local.broadcastCounter ?? 0;
        await chromeMock.storage.local.set({
          broadcastCounter: currentCounter + 1,
        });
        broadcastIndex += 1;
        return {
          ok: true,
          broadcastId: `broadcast-${broadcastIndex}`,
        };
      },
    });

    await Promise.all([
      workflow.handleFavoriteRunMessage({
        favoriteId: "fav-counter-a",
        trigger: "popup",
        allowPopupFallback: false,
      }, {}),
      workflow.handleFavoriteRunMessage({
        favoriteId: "fav-counter-b",
        trigger: "popup",
        allowPopupFallback: false,
      }, {}),
    ]);

    const jobs = chromeMock.__getStorage().session.favoriteRunJobs ?? [];
    await Promise.all(
      jobs.map((job) => workflow.handleFavoriteRunJobAlarm(`apb-favorite-job:${job.jobId}`)),
    );

    assert.deepEqual(sortStrings(queuedPrompts), ["Counter 1", "Counter 2"]);
    assert.equal(chromeMock.__getStorage().local.broadcastCounter, 2);
  });

  await runStep("favorite workflow stops chains after non-submitted broadcasts", async () => {
    const chromeMock = createChromeMock();
    const module = await loadBundledModule("src/background/popup/favorites-workflow.ts", chromeMock);
    const nowIso = new Date().toISOString();
    let broadcastCount = 0;
    let alarmCreateCount = 0;
    const originalAlarmCreate = chromeMock.alarms.create.bind(chromeMock.alarms);
    chromeMock.alarms.create = (...args) => {
      alarmCreateCount += 1;
      return originalAlarmCreate(...args);
    };

    await chromeMock.storage.local.set({
      promptFavorites: [{
        id: "fav-chain-stop",
        title: "Chain stop",
        text: "Step 1",
        sentTo: ["chatgpt"],
        createdAt: nowIso,
        favoritedAt: nowIso,
        templateDefaults: {},
        tags: [],
        folder: "",
        pinned: false,
        usageCount: 0,
        lastUsedAt: null,
        mode: "chain",
        steps: [
          {
            id: "step-1",
            text: "Step 1",
            delayMs: 0,
            targetSiteIds: ["chatgpt"],
          },
          {
            id: "step-2",
            text: "Step 2",
            delayMs: 0,
            targetSiteIds: ["claude"],
          },
        ],
        scheduleEnabled: false,
        scheduledAt: null,
        scheduleRepeat: "none",
      }],
      templateVariableCache: {},
      broadcastCounter: 0,
    });

    const workflow = module.createFavoriteWorkflow({
      getBroadcastTriggerLabel: (trigger) => trigger ?? "popup",
      getI18nMessage: () => "",
      rememberNormalTab: async () => null,
      getPreferredNormalActiveTab: async () => null,
      isInjectableTabUrl: () => true,
      getSelectedTextFromTab: async () => "",
      openPopupWithPrompt: async () => {},
      nowIso: () => nowIso,
      buildChainRunId: () => "chain-stop",
      queueBroadcastRequest: async () => {
        broadcastCount += 1;
        return {
          ok: true,
          broadcastId: `broadcast-${broadcastCount}`,
        };
      },
    });

    await workflow.handleFavoriteRunMessage({
      favoriteId: "fav-chain-stop",
      trigger: "popup",
      allowPopupFallback: false,
    }, {});

    const queuedJob = chromeMock.__getStorage().session.favoriteRunJobs?.[0];
    await workflow.handleFavoriteRunJobAlarm(`apb-favorite-job:${queuedJob.jobId}`);
    await workflow.handleFavoriteBroadcastCompletion({
      broadcastId: "broadcast-1",
      status: "failed",
    });

    const storedJob = chromeMock.__getStorage().session.favoriteRunJobs?.[0];
    assert.equal(storedJob.status, "failed");
    assert.equal(storedJob.completedSteps, 1);
    assert.equal(broadcastCount, 1);
    assert.equal(alarmCreateCount, 1);
  });

  await runStep("favorite workflow accepts prepared clipboard context", async () => {
    const chromeMock = createChromeMock();
    const module = await loadBundledModule("src/background/popup/favorites-workflow.ts", chromeMock);

    await chromeMock.storage.local.set({
      promptFavorites: [{
        id: "fav-clipboard",
        title: "Clipboard favorite",
        text: "Use {{clipboard}}",
        sentTo: ["chatgpt"],
        createdAt: "2026-04-03T00:00:00.000Z",
        favoritedAt: "2026-04-03T00:00:00.000Z",
        templateDefaults: {},
        tags: [],
        folder: "",
        pinned: false,
        usageCount: 0,
        lastUsedAt: null,
        mode: "single",
        steps: [],
        scheduleEnabled: false,
        scheduledAt: null,
        scheduleRepeat: "none",
      }],
      templateVariableCache: {},
      broadcastCounter: 0,
    });

    const workflow = module.createFavoriteWorkflow({
      getBroadcastTriggerLabel: (trigger) => trigger ?? "popup",
      getI18nMessage: () => "",
      rememberNormalTab: async () => null,
      getPreferredNormalActiveTab: async () => null,
      isInjectableTabUrl: () => true,
      getSelectedTextFromTab: async () => "",
      openPopupWithPrompt: async () => {},
      nowIso: () => "2026-04-03T00:00:00.000Z",
      buildChainRunId: () => "chain-clipboard",
      queueBroadcastRequest: async () => ({ ok: true, broadcastId: "broadcast-clipboard" }),
    });

    const blocked = await workflow.handleFavoriteRunMessage({
      favoriteId: "fav-clipboard",
      trigger: "popup",
      allowPopupFallback: false,
    }, {});
    assert.equal(blocked?.ok, false);
    assert.equal(blocked?.reason, "clipboard_unavailable");

    const queued = await workflow.handleFavoriteRunMessage({
      favoriteId: "fav-clipboard",
      trigger: "popup",
      allowPopupFallback: false,
      preparedExecutionContext: {
        clipboard: "captured clipboard",
      },
    }, {});
    assert.equal(queued?.ok, true);

    const queuedJob = chromeMock.__getStorage().session.favoriteRunJobs?.[0];
    assert.equal(queuedJob.executionContext?.clipboard, "captured clipboard");
  });

  await runStep("favorite workflow records failed history when queueing a job fails before broadcast creation", async () => {
    const chromeMock = createChromeMock();
    const module = await loadBundledModule("src/background/popup/favorites-workflow.ts", chromeMock);
    const nowIso = new Date().toISOString();

    await chromeMock.storage.local.set({
      promptFavorites: [{
        id: "fav-fail",
        title: "Failure favorite",
        text: "Broken step",
        sentTo: ["claude"],
        createdAt: nowIso,
        favoritedAt: nowIso,
        templateDefaults: {},
        tags: [],
        folder: "",
        pinned: false,
        usageCount: 0,
        lastUsedAt: null,
        mode: "single",
        steps: [],
        scheduleEnabled: false,
        scheduledAt: null,
        scheduleRepeat: "none",
      }],
      promptHistory: [],
      templateVariableCache: {},
      broadcastCounter: 0,
    });

    const workflow = module.createFavoriteWorkflow({
      getBroadcastTriggerLabel: (trigger) => trigger ?? "popup",
      getI18nMessage: () => "",
      rememberNormalTab: async () => null,
      getPreferredNormalActiveTab: async () => null,
      isInjectableTabUrl: () => true,
      getSelectedTextFromTab: async () => "",
      openPopupWithPrompt: async () => {},
      nowIso: () => nowIso,
      buildChainRunId: () => "chain-fail",
      queueBroadcastRequest: async () => ({
        ok: false,
        error: "Queue exploded",
      }),
    });

    const queued = await workflow.handleFavoriteRunMessage({
      favoriteId: "fav-fail",
      trigger: "popup",
      allowPopupFallback: false,
    }, {});
    assert.equal(queued?.ok, true);

    const queuedJob = chromeMock.__getStorage().session.favoriteRunJobs?.[0];
    await workflow.handleFavoriteRunJobAlarm(`apb-favorite-job:${queuedJob.jobId}`);

    const storage = chromeMock.__getStorage();
    assert.equal(storage.session.favoriteRunJobs?.[0]?.status, "failed");
    assert.equal(storage.session.favoriteRunJobs?.[0]?.message, "Queue exploded");
    assert.equal(storage.local.promptHistory?.[0]?.status, "failed");
    assert.equal(storage.local.promptHistory?.[0]?.originFavoriteId, "fav-fail");
    assert.deepEqual(storage.local.promptHistory?.[0]?.requestedSiteIds, ["claude"]);
    assert.deepEqual(storage.local.promptHistory?.[0]?.failedSiteIds, ["claude"]);
  });

  await runStep("csv export helper escapes formulas safely", async () => {
    const module = await loadBundledModule("src/shared/export/csv.ts", createChromeMock());

    assert.equal(
      module.buildCsvLine([
        "=SUM(A1:A2)",
        "+1",
        "-2",
        "@cmd",
        "plain",
        'quote " test',
      ]),
      "\"'=SUM(A1:A2)\",\"'+1\",\"'-2\",\"'@cmd\",\"plain\",\"quote \"\" test\"",
    );
  });

  await runStep("pending broadcast state keeps accumulated site results during sequential completions", async () => {
    const module = await loadBundledModule("src/shared/broadcast/state.ts", createChromeMock());
    const initial = {
      id: "broadcast-1",
      prompt: "Launch prompt",
      siteIds: ["chatgpt", "claude"],
      total: 2,
      completed: 0,
      submittedSiteIds: [],
      failedSiteIds: [],
      siteResults: {},
      startedAt: "2026-04-01T00:00:00.000Z",
      status: "sending",
      openedTabIds: [55],
    };

    const first = module.applyPendingBroadcastSiteResult(
      initial,
      "chatgpt",
      { code: "submitted", strategy: "execCommand" },
      "2026-04-01T00:01:00.000Z",
    );
    assert.deepEqual(first.nextRecord.siteResults.chatgpt, {
      code: "submitted",
      strategy: "execCommand",
    });
    assert.equal(first.nextRecord.completed, 1);
    assert.notStrictEqual(first.nextRecord.openedTabIds, initial.openedTabIds);
    assert.deepEqual(first.nextRecord.openedTabIds, [55]);

    const duplicate = module.applyPendingBroadcastSiteResult(
      first.nextRecord,
      "chatgpt",
      "submit_failed",
      "2026-04-01T00:01:30.000Z",
    );
    assert.equal(duplicate.nextRecord.siteResults.chatgpt.code, "submitted");
    assert.equal(duplicate.nextRecord.completed, 1);

    const final = module.applyPendingBroadcastSiteResult(
      first.nextRecord,
      "claude",
      "submit_failed",
      "2026-04-01T00:02:00.000Z",
    );
    assert.equal(final.nextRecord, null);
    assert.equal(final.completedRecord.siteResults.chatgpt.code, "submitted");
    assert.equal(final.completedRecord.siteResults.claude.code, "submit_failed");
    assert.equal(final.summary.status, "partial");
  });

  await runStep("strategy stats accumulate attempt outcomes", async () => {
    const module = await loadBundledModule("src/shared/runtime-state/index.ts", createChromeMock());

    const first = await module.recordStrategyAttempts("claude", [
      { name: "execCommand", success: false },
      { name: "paste", success: true },
    ]);
    assert.deepEqual(first.claude, {
      execCommand: { success: 0, fail: 1 },
      paste: { success: 1, fail: 0 },
    });

    const second = await module.recordStrategyAttempts("claude", [
      { name: "paste", success: true },
    ]);
    assert.deepEqual(second.claude, {
      execCommand: { success: 0, fail: 1 },
      paste: { success: 2, fail: 0 },
    });
  });

  await runStep("site order sorting normalizes saved ids and appends new sites", async () => {
    const orderModule = await loadBundledModule("src/shared/sites/order.ts", createChromeMock());
    const promptsModule = await loadBundledModule("src/shared/prompts/index.ts", createChromeMock());

    assert.deepEqual(
      orderModule.sortSitesByOrder(
        [
          { id: "chatgpt", name: "ChatGPT" },
          { id: "claude", name: "Claude" },
          { id: "gemini", name: "Gemini" },
        ],
        ["claude", "", "unknown", "claude"],
      ).map((site) => site.id),
      ["claude", "chatgpt", "gemini"],
    );
    assert.deepEqual(
      promptsModule.normalizeSettings({
        siteOrder: ["claude", "", "claude", "custom-site"],
      }).siteOrder,
      ["claude", "custom-site"],
    );
  });

  await runStep("import migration tolerates null partial v3 and v4 payloads", async () => {
    const module = await loadBundledModule("src/shared/stores/prompt-store.ts", createChromeMock());

    const v3Import = await module.importPromptData(JSON.stringify({
      version: 3,
      settings: {
        historyLimit: null,
        siteOrder: ["claude", "", "claude", "custom-1"],
        reuseExistingTabs: null,
      },
      history: null,
      favorites: null,
      templateVariableCache: null,
      customSites: null,
      builtInSiteStates: null,
      builtInSiteOverrides: null,
    }));
    assert.equal(v3Import.importSummary.migratedFromVersion, 3);
    assert.equal(v3Import.settings.historyLimit, 10);
    assert.equal(v3Import.settings.reuseExistingTabs, true);
    assert.deepEqual(v3Import.settings.siteOrder, ["claude", "custom-1"]);
    assert.deepEqual(v3Import.history, []);
    assert.deepEqual(v3Import.favorites, []);

    const v4Import = await module.importPromptData(JSON.stringify({
      version: 4,
      settings: null,
      history: [{
        id: 1,
        text: "Legacy",
        createdAt: "2026-04-01T00:00:00.000Z",
        siteResults: null,
      }],
      favorites: [{
        id: "fav-v4",
        text: "Legacy favorite",
        createdAt: "2026-04-01T00:00:00.000Z",
        favoritedAt: "2026-04-01T00:00:00.000Z",
      }],
    }));
    assert.equal(v4Import.importSummary.migratedFromVersion, 4);
    assert.deepEqual(v4Import.settings.siteOrder, []);
    assert.equal(v4Import.history[0].text, "Legacy");
    assert.equal(v4Import.favorites[0].id, "fav-v4");
  });

  await runStep("scheduled run summary ignores manual runs and preserves failure details", async () => {
    const module = await loadBundledModule("src/options/features/schedule-summary.ts", createChromeMock());
    const summary = module.buildScheduledFavoriteRunSummary([
      {
        originFavoriteId: "fav-1",
        trigger: "options",
        createdAt: "2026-04-04T12:00:00.000Z",
        status: "submitted",
        siteResults: {
          chatgpt: { code: "submitted" },
        },
      },
      {
        originFavoriteId: "fav-1",
        trigger: "scheduled",
        createdAt: "2026-04-03T12:00:00.000Z",
        status: "failed",
        failedSiteIds: ["claude"],
        siteResults: {
          claude: {
            code: "submit_failed",
            message: "Composer button stayed disabled",
          },
        },
      },
    ], "fav-1");

    assert.equal(summary.createdAt, "2026-04-03T12:00:00.000Z");
    assert.equal(summary.status, "failed");
    assert.equal(summary.representativeCode, "submit_failed");
    assert.equal(summary.representativeMessage, "Composer button stayed disabled");
  });

  await runStep("dashboard metrics include heatmap trends failures and strategy summary", async () => {
    const module = await loadBundledModule("src/options/features/dashboard-metrics.ts", createChromeMock());
    const metrics = module.buildDashboardMetrics(
      [
        {
          text: "Prompt A",
          createdAt: "2026-04-09T10:15:00.000Z",
          requestedSiteIds: ["chatgpt"],
          submittedSiteIds: ["chatgpt"],
          siteResults: {
            chatgpt: { code: "submitted" },
          },
          status: "submitted",
        },
        {
          text: "Prompt B",
          createdAt: "2026-04-08T09:00:00.000Z",
          requestedSiteIds: ["chatgpt", "claude"],
          submittedSiteIds: ["chatgpt"],
          failedSiteIds: ["claude"],
          siteResults: {
            chatgpt: { code: "submitted" },
            claude: { code: "submit_failed", message: "Button disabled" },
          },
          status: "partial",
        },
        {
          text: "Prompt C",
          createdAt: "2026-04-07T08:30:00.000Z",
          requestedSiteIds: ["claude"],
          submittedSiteIds: [],
          failedSiteIds: ["claude"],
          siteResults: {},
          status: "failed",
        },
      ],
      [
        { id: "chatgpt", name: "ChatGPT" },
        { id: "claude", name: "Claude" },
      ],
      {
        chatgpt: {
          execCommand: { success: 2, fail: 1 },
        },
        claude: {
          paste: { success: 1, fail: 3 },
        },
      },
      new Date("2026-04-09T12:00:00.000Z"),
    );

    assert.equal(metrics.totalTransmissions, 3);
    assert.ok(metrics.donutItems.some((item) => item.label === "ChatGPT" && item.count === 2));
    assert.ok(metrics.heatmap.maxCount >= 1);
    assert.ok(metrics.serviceTrendItems.some((item) => item.id === "chatgpt"));
    assert.ok(metrics.failureReasonItems.some((item) => item.code === "submit_failed" && item.count === 1));
    assert.ok(metrics.failureReasonItems.some((item) => item.code === "unexpected_error" && item.count === 1));
    assert.ok(metrics.strategySummaryItems.some((item) => item.siteId === "chatgpt" && item.bestStrategy === "execCommand"));
  });

  await runStep("reusable tab preflight excludes auth settings and invalid composer surfaces", async () => {
    const module = await loadBundledModule("src/shared/sites/reuse-preflight.ts", createChromeMock());

    assert.deepEqual(
      module.evaluateReusableTabSnapshot({
        pathname: "/auth/login",
        hasPromptSurface: true,
      }),
      { ok: false, reason: "auth_path" },
    );
    assert.deepEqual(
      module.evaluateReusableTabSnapshot({
        pathname: "/settings/profile",
        hasPromptSurface: true,
      }),
      { ok: false, reason: "settings_path" },
    );
    assert.deepEqual(
      module.evaluateReusableTabSnapshot({
        pathname: "/chat",
        hasPromptSurface: false,
        hasAuthSurface: false,
      }),
      { ok: false, reason: "missing_input" },
    );
    assert.deepEqual(
      module.evaluateReusableTabSnapshot({
        pathname: "/chat",
        hasPromptSurface: true,
        hasSubmitSurface: false,
        submitRequirement: "required",
      }),
      { ok: false, reason: "missing_submit" },
    );
    assert.deepEqual(
      module.evaluateReusableTabSnapshot({
        pathname: "/chat",
        hasPromptSurface: true,
        hasSubmitSurface: false,
        submitRequirement: "conditional",
      }),
      { ok: true },
    );
    assert.deepEqual(
      module.evaluateReusableTabSnapshot({
        pathname: "/chat",
        hasPromptSurface: true,
        hasSubmitSurface: true,
        submitRequirement: "required",
      }),
      { ok: true },
    );
  });

  await runStep("reset helper clears local and session runtime state", async () => {
    const chromeMock = createChromeMock();
    const module = await loadBundledModule("src/shared/runtime-state/reset.ts", chromeMock);

    await chromeMock.storage.local.set({
      composeDraftPrompt: "draft",
      lastSentPrompt: "last sent",
      lastPrompt: "draft",
      promptHistory: [{ id: 1 }],
      promptFavorites: [{ id: "fav-1" }],
      templateVariableCache: { topic: "Launch" },
      appSettings: {
        historyLimit: 75,
        autoClosePopup: true,
        desktopNotifications: false,
        reuseExistingTabs: false,
        waitMsMultiplier: 2.5,
        historySort: "oldest",
        favoriteSort: "title",
      },
      broadcastCounter: 9,
      failedSelectors: [{ serviceId: "chatgpt" }],
      strategyStats: {
        chatgpt: {
          execCommand: { success: 3, fail: 1 },
        },
      },
      onboardingCompleted: true,
      customSites: [{ id: "custom-site" }],
      builtInSiteStates: { chatgpt: { enabled: false } },
      builtInSiteOverrides: { chatgpt: { inputSelector: "#composer" } },
    });
    await chromeMock.storage.session.set({
      pendingUiToasts: [{ message: "queued" }],
      lastBroadcast: { broadcastId: "broadcast-1" },
      pendingInjections: { 1: { broadcastId: "broadcast-1" } },
      pendingBroadcasts: { "broadcast-1": { id: "broadcast-1" } },
      selectorAlerts: { signature: 1 },
      popupFavoriteIntent: { type: "run", favoriteId: "fav-1" },
      popupPromptIntent: { prompt: "handoff prompt", createdAt: "2026-04-03T00:00:00.000Z" },
      favoriteRunJobs: [{ jobId: "job-1", favoriteId: "fav-1" }],
    });
    chromeMock.alarms.create("badge-clear", { when: 123 });

    await module.resetPersistedExtensionState({
      additionalSessionKeys: ["pendingInjections", "pendingBroadcasts", "selectorAlerts"],
      clearAlarmName: "badge-clear",
    });

    const storage = chromeMock.__getStorage();
    assert.equal(storage.local.composeDraftPrompt, undefined);
    assert.equal(storage.local.lastSentPrompt, undefined);
    assert.equal(storage.local.lastPrompt, undefined);
    assert.deepEqual(storage.local.promptHistory, []);
    assert.deepEqual(storage.local.promptFavorites, []);
    assert.deepEqual(storage.local.templateVariableCache, {});
    assert.deepEqual(storage.local.appSettings, {
      historyLimit: 50,
      autoClosePopup: false,
      desktopNotifications: true,
      reuseExistingTabs: true,
      waitMsMultiplier: 1,
      historySort: "latest",
      favoriteSort: "recentUsed",
      siteOrder: [],
    });
    assert.equal(storage.local.broadcastCounter, 0);
    assert.deepEqual(storage.local.failedSelectors, []);
    assert.deepEqual(storage.local.strategyStats, {});
    assert.equal(storage.local.onboardingCompleted, false);
    assert.deepEqual(storage.local.customSites, []);
    assert.deepEqual(storage.local.builtInSiteStates, {});
    assert.deepEqual(storage.local.builtInSiteOverrides, {});
    assert.deepEqual(storage.session.pendingUiToasts, []);
    assert.equal(storage.session.lastBroadcast, null);
    assert.equal(storage.session.pendingInjections, undefined);
    assert.equal(storage.session.pendingBroadcasts, undefined);
    assert.equal(storage.session.selectorAlerts, undefined);
    assert.equal(storage.session.popupFavoriteIntent, undefined);
    assert.equal(storage.session.popupPromptIntent, undefined);
    assert.equal(storage.session.favoriteRunJobs, undefined);
    assert.deepEqual(chromeMock.__getAlarms(), {});
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

