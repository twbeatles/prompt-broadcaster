# Implementation Risk Review - 2026-05-11

## Status

Resolved in the 2026-05-11 stabilization pass. The codebase now favors explicit one-shot comparison capture, bounded prompt experiment execution, export/import v9 documentation, selector evidence separation, and real extension-page E2E coverage.

## Implemented Changes

| Area | Resolution |
| --- | --- |
| Comparison capture | Removed the armed/background polling model and kept `comparison-capture:start` as an explicit one-time capture. Service-specific assistant response selectors are used before generic fallbacks. |
| Context-menu comparison notes | Selection-based notes now require an active comparison context for the same selected service/history instead of attaching to the latest history entry by default. |
| Prompt experiments | Shared limit calculation enforces soft confirmation above 10 broadcasts and a hard block above 30 from both options UI and background runtime handling. |
| Export/import docs | README, CLAUDE, build guide, architecture, roadmap, and project analysis now describe `CURRENT_EXPORT_VERSION = 9` and v8-compatible import backfill. |
| TypeScript suppressions | Removed `@ts-nocheck` from the highest-risk touched files: built-ins, options DOM/i18n/state, experiments, template packs, and history comparison modal. Remaining suppressions are tracked in `docs/typescript-nocheck-followup-2026-05-11.md`. |
| Options i18n | Added locale keys for the new options surfaces and wired experiments, selector health, service groups, template packs, and history modal text through `_locales/en|ko/messages.json`. |
| Selector audit evidence | Added `docs/selector-verification-2026-05-11.md` so automated access-challenge results are not confused with logged-in canonical route proof. |
| Extension E2E | Added `npm run qa:extension` to load the built `dist/` extension and cover options navigation, experiment caps, history comparison notes, template packs, service groups, and popup fallback. |
| Documentation guard | Added `npm run docs:check` and synchronized release-facing Markdown with current scripts, storage keys, export version, and validation flow. |

## Documentation and `.gitignore` Audit

- Markdown surfaces checked: `README.md`, `CLAUDE.md`, `PROJECT_ANALYSIS.md`, `docs/build-guide.md`, `docs/extension-architecture.md`, `docs/feature-enhancement-roadmap.md`, `docs/release-selector-verification-checklist.md`, `docs/web_store_checklist.md`, and the new dated follow-up docs.
- `.gitignore` already excludes generated or local-only artifacts produced by this pass: `/dist`, `/output`, `*.zip`, `/node_modules`, `.claude/`, and `docs/assets/web-store/screenshots/`.
- Verified ignore examples: `dist/manifest.json`, `output/selector-audit/*.md`, `prompt-broadcaster-v1.0.1.zip`, `dist.zip`, `dist (2).zip`, `node_modules/.package-lock.json`, `.claude/settings.local.json`, and web-store screenshot placeholders.
- No `.gitignore` rule change was required because the current rules cover the observed build, audit, Playwright, package, and local scratch outputs without hiding tracked documentation or source files.

## Validation Snapshot

Use this sequence before release or store packaging:

```bash
npm run typecheck
npm run docs:check
npm run build
npm run qa:smoke
npm run qa:extension
npm run selector:audit
```

Selector audit output is a development evidence artifact under `output/selector-audit/` and remains ignored. Logged-in service verification must be recorded separately in `docs/selector-verification-YYYY-MM-DD.md`.
