import assert from "node:assert/strict";
import { mkdir, rm, stat } from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { chromium } from "playwright";

const rootDir = process.cwd();
const distDir = path.join(rootDir, "dist");
const profileDir = path.join(rootDir, "output", "extension-e2e", "profile");
const headless = process.env.APB_E2E_HEADLESS === "1";

async function ensureDist() {
  try {
    await stat(path.join(distDir, "manifest.json"));
    await stat(path.join(distDir, "options", "options.html"));
    await stat(path.join(distDir, "popup", "popup.html"));
  } catch {
    throw new Error("Built extension files were not found. Run `npm run build` before `npm run qa:extension`.");
  }
}

async function waitForExtensionServiceWorker(context) {
  const existingWorker = context.serviceWorkers()[0];
  if (existingWorker) {
    return existingWorker;
  }

  return context.waitForEvent("serviceworker", { timeout: 10000 });
}

function getExtensionId(worker) {
  const url = new URL(worker.url());
  assert.equal(url.protocol, "chrome-extension:");
  return url.host;
}

async function seedStorage(worker) {
  await worker.evaluate(async () => {
    const now = "2026-05-11T00:00:00.000Z";
    await chrome.storage.local.set({
      promptHistory: [
        {
          id: 101,
          text: "Compare the release selector risks",
          requestedSiteIds: ["chatgpt", "claude"],
          submittedSiteIds: ["chatgpt"],
          failedSiteIds: ["claude"],
          sentTo: ["chatgpt", "claude"],
          createdAt: now,
          status: "partial",
          siteResults: {
            chatgpt: { code: "submitted" },
            claude: { code: "submit_failed", message: "Send button stayed disabled" },
          },
          targetSnapshots: [],
        },
      ],
      promptFavorites: [
        {
          id: "fav-pack",
          sourceHistoryId: null,
          title: "Selector pack favorite",
          text: "Summarize selector verification for {{topic}}",
          sentTo: ["chatgpt"],
          createdAt: now,
          favoritedAt: now,
          templateDefaults: { topic: "release" },
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
      comparisonNotes: [],
      promptExperiments: [],
      templatePacks: [],
      serviceGroups: [],
    });
    await chrome.storage.session.clear();
  });
}

async function main() {
  await ensureDist();
  await rm(profileDir, { recursive: true, force: true });
  await mkdir(profileDir, { recursive: true });

  const context = await chromium.launchPersistentContext(profileDir, {
    acceptDownloads: true,
    headless,
    args: [
      `--disable-extensions-except=${distDir}`,
      `--load-extension=${distDir}`,
    ],
  });

  try {
    const worker = await waitForExtensionServiceWorker(context);
    const extensionId = getExtensionId(worker);
    await seedStorage(worker);

    const optionsPage = await context.newPage();
    await optionsPage.goto(`chrome-extension://${extensionId}/options/options.html`);
    await optionsPage.waitForSelector("#section-dashboard");

    await optionsPage.click('[data-section="experiments"]');
    await optionsPage.waitForSelector("#section-experiments.active");
    await optionsPage.fill("#experiment-title", "Large matrix guard");
    await optionsPage.fill(
      "#experiment-variants",
      Array.from({ length: 11 }, (_, index) => `Variant ${index + 1}`).join("\n---\n"),
    );
    await optionsPage.fill("#experiment-variables", '[{"topic":"selectors"}]');
    await optionsPage.click("#experiment-preview");
    const limitText = await optionsPage.locator(".experiment-run-limit").textContent();
    assert.match(limitText ?? "", /11/);
    assert.match(limitText ?? "", /10/);
    assert.match(limitText ?? "", /30/);

    await optionsPage.click('[data-section="history"]');
    await optionsPage.waitForSelector("#section-history.active");
    await optionsPage.click("[data-open-history-id='101']");
    await optionsPage.waitForSelector("[data-compare-history-id='101']");
    await optionsPage.selectOption("[data-comparison-service]", "chatgpt");
    await optionsPage.fill("[data-comparison-text]", "Manual captured ChatGPT response from extension E2E.");
    await optionsPage.click("[data-comparison-save]");
    await optionsPage.waitForSelector(".compare-note");

    const comparisonStorage = await worker.evaluate(async () => {
      const { comparisonNotes } = await chrome.storage.local.get("comparisonNotes");
      const { activeComparisonContext } = await chrome.storage.session.get("activeComparisonContext");
      return { comparisonNotes, activeComparisonContext };
    });
    assert.equal(comparisonStorage.comparisonNotes.length, 1);
    assert.equal(comparisonStorage.comparisonNotes[0].historyId, 101);
    assert.equal(comparisonStorage.comparisonNotes[0].serviceId, "chatgpt");
    assert.equal(comparisonStorage.activeComparisonContext.serviceId, "chatgpt");
    await optionsPage.click("#history-modal-close");
    await optionsPage.waitForSelector("#history-modal", { state: "hidden" });

    await optionsPage.click('[data-section="services"]');
    await optionsPage.waitForSelector("#section-services.active");
    await optionsPage.fill("#service-group-title", "Core E2E");
    await optionsPage.check("[data-service-group-select='chatgpt']");
    await optionsPage.click("#service-group-save");
    await optionsPage.waitForSelector("[data-group-select]");

    await optionsPage.click('[data-section="settings"]');
    await optionsPage.waitForSelector("#section-settings.active");
    const downloadPromise = optionsPage.waitForEvent("download");
    await optionsPage.click("#template-pack-export");
    await downloadPromise;
    await optionsPage.waitForSelector("[data-pack-download]");

    const storageAfterOptions = await worker.evaluate(async () => {
      const { serviceGroups, templatePacks } = await chrome.storage.local.get([
        "serviceGroups",
        "templatePacks",
      ]);
      return { serviceGroups, templatePacks };
    });
    assert.equal(storageAfterOptions.serviceGroups[0].title, "Core E2E");
    assert.equal(storageAfterOptions.templatePacks.length, 1);

    const popupPage = await context.newPage();
    await popupPage.goto(`chrome-extension://${extensionId}/popup/popup.html`);
    await popupPage.waitForSelector("#prompt-input");
    await popupPage.waitForSelector("#send-btn");

    console.log("Extension E2E passed: options, experiments, comparison notes, service groups, template packs, and popup loaded.");
  } finally {
    await context.close();
  }
}

main().catch((error) => {
  console.error("[AI Prompt Broadcaster] Extension E2E failed.", error);
  process.exitCode = 1;
});
