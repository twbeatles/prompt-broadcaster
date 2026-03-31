import fs from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { chromium } from "playwright";

const rootDir = process.cwd();
const showcasePath = path.join(rootDir, "docs", "assets", "web-store", "showcase.html");
const outputDir = path.join(rootDir, "docs", "assets", "web-store", "screenshots");

const scenes = [
  ["compose", "store-screenshot-01-compose.jpg"],
  ["favorites", "store-screenshot-02-favorites.jpg"],
  ["reuse-tabs", "store-screenshot-03-reuse-tabs.jpg"],
  ["dashboard", "store-screenshot-04-dashboard.jpg"],
  ["custom-service", "store-screenshot-05-custom-service.jpg"],
];

async function launchBrowser() {
  const attempts = [
    { headless: true, channel: "chrome" },
    { headless: true },
  ];

  let lastError = null;
  for (const options of attempts) {
    try {
      return await chromium.launch(options);
    } catch (error) {
      lastError = error;
    }
  }

  throw lastError;
}

async function ensureOutputDir() {
  await fs.mkdir(outputDir, { recursive: true });
}

async function captureScene(page, scene, fileName) {
  const url = `${pathToFileURL(showcasePath).href}?scene=${encodeURIComponent(scene)}`;
  await page.goto(url, { waitUntil: "load" });
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.waitForTimeout(150);

  const targetPath = path.join(outputDir, fileName);
  await page.screenshot({
    path: targetPath,
    type: "jpeg",
    quality: 92,
  });

  return targetPath;
}

async function main() {
  await ensureOutputDir();
  const browser = await launchBrowser();
  const page = await browser.newPage({
    viewport: { width: 1280, height: 800 },
    deviceScaleFactor: 1,
    colorScheme: "light",
  });

  const created = [];
  try {
    for (const [scene, fileName] of scenes) {
      const savedPath = await captureScene(page, scene, fileName);
      created.push(savedPath);
    }
  } finally {
    await page.close();
    await browser.close();
  }

  for (const filePath of created) {
    console.log(path.relative(rootDir, filePath));
  }
}

main().catch((error) => {
  console.error("[generate-store-screenshots] Failed to create screenshots.");
  console.error(error);
  process.exitCode = 1;
});
