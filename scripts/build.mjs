import { build } from "esbuild";
import { cp, mkdir, rm, stat } from "node:fs/promises";
import path from "node:path";
import process from "node:process";

const rootDir = process.cwd();
const distDir = path.join(rootDir, "dist");
const shouldCleanOnly = process.argv.includes("--clean");

const esmEntries = [
  { entry: "src/background/main.ts", out: "background/service_worker.js" },
  { entry: "src/popup/main.ts", out: "popup/popup.js" },
  { entry: "src/options/main.ts", out: "options/options.js" },
  { entry: "src/onboarding/main.ts", out: "onboarding/onboarding.js" },
];

const iifeEntries = [
  { entry: "src/content/injector/main.ts", out: "content/injector.js", globalName: "AIPromptBroadcasterInjectorBundle" },
  { entry: "src/content/palette/main.ts", out: "content/palette.js", globalName: "AIPromptBroadcasterQuickPaletteBundle" },
  { entry: "src/content/selector-checker/main.ts", out: "content/selector_checker.js", globalName: "AIPromptBroadcasterSelectorCheckerBundle" },
  { entry: "src/content/selection/main.ts", out: "content/selection.js", globalName: "AIPromptBroadcasterSelectionBundle" },
];

const generatedMirrorTargets = [
  "background/service_worker.js",
  "content/injector.js",
  "content/palette.js",
  "content/selector_checker.js",
  "content/selection.js",
  "popup/popup.js",
  "options/options.js",
  "onboarding/onboarding.js",
];

const staticTargets = [
  "manifest.json",
  "_locales",
  "icons",
  "popup/popup.html",
  "popup/popup.css",
  "popup/styles",
  "options/options.html",
  "options/options.css",
  "options/styles",
  "onboarding/onboarding.html",
  "onboarding/onboarding.css",
  "onboarding/styles",
];

async function pathExists(targetPath) {
  try {
    await stat(targetPath);
    return true;
  } catch {
    return false;
  }
}

async function copyStaticTarget(relativePath) {
  const source = path.join(rootDir, relativePath);
  if (!(await pathExists(source))) {
    return;
  }

  const destination = path.join(distDir, relativePath);
  await mkdir(path.dirname(destination), { recursive: true });
  await cp(source, destination, { recursive: true, force: true });
}

async function mirrorGeneratedTarget(relativePath) {
  const source = path.join(distDir, relativePath);
  if (!(await pathExists(source))) {
    return;
  }

  const destination = path.join(rootDir, relativePath);
  await mkdir(path.dirname(destination), { recursive: true });
  await cp(source, destination, { force: true });
}

async function buildEsmEntry(item) {
  await build({
    entryPoints: [path.join(rootDir, item.entry)],
    outfile: path.join(distDir, item.out),
    bundle: true,
    format: "esm",
    target: "chrome120",
    sourcemap: false,
    legalComments: "none",
    charset: "utf8",
  });
}

async function buildIifeEntry(item) {
  await build({
    entryPoints: [path.join(rootDir, item.entry)],
    outfile: path.join(distDir, item.out),
    bundle: true,
    format: "iife",
    globalName: item.globalName,
    target: "chrome120",
    sourcemap: false,
    legalComments: "none",
    charset: "utf8",
  });
}

async function main() {
  await rm(distDir, { recursive: true, force: true });

  if (shouldCleanOnly) {
    return;
  }

  await mkdir(distDir, { recursive: true });
  await Promise.all(staticTargets.map((target) => copyStaticTarget(target)));

  for (const item of esmEntries) {
    await buildEsmEntry(item);
  }

  for (const item of iifeEntries) {
    await buildIifeEntry(item);
  }

  await Promise.all(generatedMirrorTargets.map((target) => mirrorGeneratedTarget(target)));
}

main().catch((error) => {
  console.error("[AI Prompt Broadcaster] Build failed.", error);
  process.exitCode = 1;
});
