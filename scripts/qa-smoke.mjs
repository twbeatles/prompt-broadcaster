import assert from "node:assert/strict";
import { access } from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { pathToFileURL } from "node:url";
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
    assert.equal(result.selector, "textarea[aria-label='Prompt composer'], div[aria-label='Prompt composer']");
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

  await browser.close();

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
