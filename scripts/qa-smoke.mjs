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
    assert.equal(exported.version, 5);
    assert.equal(exported.broadcastCounter, 1);
    assert.deepEqual(exported.settings, module.DEFAULT_SETTINGS);

    await module.setBroadcastCounter(9);
    const legacyImport = await module.importPromptData(JSON.stringify({
      version: 2,
      settings: { historyLimit: 50 },
    }));
    assert.equal(legacyImport.broadcastCounter, 0);
    assert.equal(await module.getBroadcastCounter(), 0);
    assert.equal(legacyImport.importSummary.version, 5);
    assert.equal(legacyImport.importSummary.migratedFromVersion, 2);
    assert.equal(legacyImport.settings.waitMsMultiplier, 1);
    assert.equal(legacyImport.settings.historySort, "latest");
    assert.equal(legacyImport.settings.favoriteSort, "recentUsed");

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
    assert.equal(modernImport.importSummary.version, 5);
    assert.equal(modernImport.importSummary.migratedFromVersion, 4);
    assert.equal(modernImport.settings.waitMsMultiplier, 1);
    assert.equal(modernImport.settings.historySort, "latest");
    assert.equal(modernImport.settings.favoriteSort, "recentUsed");
    assert.equal(modernImport.history[0].siteResults.chatgpt.code, "submitted");
    assert.equal(modernImport.history[0].siteResults.claude.code, "selector_timeout");
    assert.deepEqual(modernImport.history[0].submittedSiteIds, ["chatgpt"]);
    assert.deepEqual(modernImport.history[0].failedSiteIds, ["claude"]);
    assert.equal(modernImport.history[0].originFavoriteId ?? null, null);
    assert.equal(modernImport.history[0].chainRunId ?? null, null);
    assert.equal(modernImport.history[0].chainStepIndex ?? null, null);
    assert.equal(modernImport.history[0].chainStepCount ?? null, null);
    assert.equal(modernImport.favorites[0].usageCount, 0);
    assert.equal(modernImport.favorites[0].lastUsedAt, null);
    assert.equal(modernImport.favorites[0].mode, "single");
    assert.deepEqual(modernImport.favorites[0].steps, []);
    assert.equal(modernImport.favorites[0].scheduleEnabled, false);
    assert.equal(modernImport.favorites[0].scheduledAt, null);
    assert.equal(modernImport.favorites[0].scheduleRepeat, "none");

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
        requiresSubmitSurface: true,
      }),
      { ok: false, reason: "missing_submit" },
    );
    assert.deepEqual(
      module.evaluateReusableTabSnapshot({
        pathname: "/chat",
        hasPromptSurface: true,
        hasSubmitSurface: true,
        requiresSubmitSurface: true,
      }),
      { ok: true },
    );
  });

  await runStep("reset helper clears local and session runtime state", async () => {
    const chromeMock = createChromeMock();
    const module = await loadBundledModule("src/shared/runtime-state/reset.ts", chromeMock);

    await chromeMock.storage.local.set({
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
    });
    chromeMock.alarms.create("badge-clear", { when: 123 });

    await module.resetPersistedExtensionState({
      additionalSessionKeys: ["pendingInjections", "pendingBroadcasts", "selectorAlerts"],
      clearAlarmName: "badge-clear",
    });

    const storage = chromeMock.__getStorage();
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

