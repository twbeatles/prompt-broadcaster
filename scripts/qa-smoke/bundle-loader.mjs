import { access } from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { build as esbuild } from "esbuild";
import { fixturesDir, rootDir } from "./config.mjs";

export async function ensureFileExists(targetPath) {
  try {
    await access(targetPath);
  } catch (_error) {
    throw new Error(`Required file is missing: ${targetPath}`);
  }
}

export async function loadBundledModule(relativeEntryPath, chromeMock) {
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

export function createFixtureUrl(relativePath) {
  return pathToFileURL(path.join(fixturesDir, relativePath)).href;
}
