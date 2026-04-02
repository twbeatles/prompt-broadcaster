import path from "node:path";
import process from "node:process";

export const rootDir = process.cwd();
export const injectorPath = path.join(rootDir, "dist", "content", "injector.js");
export const palettePath = path.join(rootDir, "dist", "content", "palette.js");
export const selectorCheckerPath = path.join(rootDir, "dist", "content", "selector_checker.js");
export const fixturesDir = path.join(rootDir, "qa", "fixtures");
export const isHeaded = process.argv.includes("--headed");
