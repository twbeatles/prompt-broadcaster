# Project Audit

Audit date: 2026-08-22
Scope: functional implementation and runtime stability. Source code and configuration were not changed by this audit.

## 1. Executive Summary

The project is in **Acceptable** functional condition. It is a Manifest V3 Chrome extension that opens or reuses AI-service tabs, injects prompts through site-specific selectors, records structured results, and supports history, favorites, schedules, imports/exports, and comparison notes.

Overall risk is **Low-Medium**. No `Confirmed` or strongly evidenced `Likely` production high-risk issue was found in the audited paths. The audit found protections for invalid broadcast requests, custom-site host permissions, duplicate result writes, worker-restart recovery, storage quota pressure, and runtime-message sender authorization.

Most important follow-up areas:

1. Make the extension E2E check runnable in a headless/CI-capable MV3 browser.
2. Add authenticated, real-service selector/injection regression coverage; three public built-in pages are Cloudflare-gated.
3. Add an explicit service-worker restart E2E around a live pending injection and multi-site automatic response capture.

No evidence of current data destruction or silent data loss was found. Local storage writes are capped for large collections and recover from quota-like errors. Import data is normalized before a single multi-key commit; permission denial aborts before that commit.

## 2. Project Understanding

### Purpose

AI Prompt Broadcaster sends one prompt to selected AI web applications. Built-ins are ChatGPT, Gemini, Claude, Grok, and Perplexity; users may add custom services with optional host permissions. The extension keeps prompt history, reusable favorites/chains/schedules, comparison notes, template packs, and experiment metadata in `chrome.storage`.

### Entrypoints and core modules

- `manifest.json` → MV3 background worker `background/service_worker.js` (built from `src/background/app/bootstrap/app.ts`).
- `manifest.json` → popup `popup/popup.html` / `popup/popup.js` (source bootstrap: `src/popup/app/bootstrap/app.ts`).
- `manifest.json` → options page `options/options.html` / `options/options.js`.
- `manifest.json` → `content/selector_checker.js` on configured AI domains. The worker injects the main injector when a broadcast is ready.
- `src/config/sites/builtins.ts` → routes, selector chains, auth selectors, submit behavior, and verification metadata.

### Data storage and dependencies

- `chrome.storage.local`: history, favorites, settings, templates, experiments, comparison notes, custom services, and built-in overrides/states.
- `chrome.storage.session`: pending broadcasts/injections, last broadcast, active comparison context, and favorite-run jobs.
- An in-memory background mutation queue serializes shared session-state updates; a waiter registry coordinates favorite/chain completion.
- Runtime uses Chrome extension APIs. Development dependencies are TypeScript, esbuild, and Playwright; product runtime has no database or backend API.

### Core execution flows

```text
Popup/shortcut/context-menu input
  → runtime message router (sender policy)
  → broadcast queue (prompt/target validation)
  → pending broadcast + tab creation/reuse + pending injection
  → focused content-script injection / submit
  → structured site result + history + last-broadcast state
  → optional response capture / favorite-chain completion / user feedback
```

```text
Import JSON
  → JSON parse + version migration + normalization/ID repair
  → request/check custom-service host permissions
  → one chrome.storage.local.set commit
  → best-effort removal of unused optional permissions
  → import summary to popup/options
```

CodeGraph call paths inspected included `createBroadcastQueue`, `createPendingInjectionController`, `recordBroadcastSiteResult`, `createBroadcastWaiterRegistry`, `importPromptData`, `createComparisonHandlers`, and `registerRuntimeMessageRouter`.

## 3. Audit Coverage & Limitations

### Covered

- Manifest, package scripts, README, CLAUDE, repository instructions, built-in site configuration, and entrypoint relationships.
- Popup send flow, broadcast queue, tab reuse/preflight, pending-injection timeout/recovery, injection result handling, and history completion.
- Local/session storage, import/export/migrations, custom-site permissions, reset behavior, schedules/favorite jobs, automatic response capture, and runtime-message sender policy.
- CodeGraph caller/callee and blast-radius information for the above paths.
- The repository's local `.codegraph/` index was present and used before file search for code discovery.

### Executed checks

- `npm run typecheck` — passed.
- `npm run docs:check` — passed.
- `npm run qa:smoke` — passed, 60/60 checks.
- `npm run qa:extension` with `APB_E2E_HEADLESS=1` — timed out waiting for an MV3 service worker. README documents this headless limitation; this is not evidence of a product-runtime failure.
- The headed E2E command was started but did not complete within this audit environment's command window; it is not counted as passed.

### Limitations

- No authenticated accounts or live prompt submissions were used.
- The full extension E2E suite could not be completed in the available environment.
- External service DOMs and Cloudflare challenges are volatile; local source analysis cannot prove future selector compatibility.

## 4. High-Risk Issues

No `Confirmed` or strongly supported `Likely` production high-risk issues were found.

The following suspected failure modes were investigated and not retained as issues:

- **Concurrent broadcast/result corruption:** `createBroadcastQueue` routes session mutations through `queueBackgroundStateMutation`; pending injection has active/queued-tab guards; result updates are centralized. Smoke coverage includes result accumulation, resend routing, and favorite-job concurrency.
- **Worker restart leaving a send stuck:** pending records retain `createdAt`, `startedAt`, and `status`; reconciliation turns stale work into `injection_timeout`, records a result, and removes the pending entry.
- **Import replacing data after permission failure:** custom-site origins are requested and rechecked before `chrome.storage.local.set`; denied origins throw before commit. Smoke tests cover denial and commit-failure paths.
- **Content pages invoking privileged mutations:** the router classifies extension versus content senders and enforces handler sender policies. Smoke tests exercise action allowlists.
- **Unbounded local collections:** history, comparison notes, captured responses, UI toasts, and favorite jobs have caps/normalizers; quota retry and retention are smoke-tested.

## 5. Potential Functional Gaps

### [GAP-001] CI-compatible MV3 extension E2E is not currently proven

- **Classification:** Confirmed Gap (test-environment capability, not product failure)
- **Evidence:** `qa:extension` times out in documented headless mode at `waitForExtensionServiceWorker`. `scripts/qa-extension.mjs` enables this only through `APB_E2E_HEADLESS`; README warns that headless must only be used with Chromium builds supporting MV3 extension workers.
- **Impact:** CI in that mode can report a false failure and will not validate popup/options integration.
- **Suggested direction:** pin a browser/launch configuration with headless MV3 support, or run headed under a virtual display and document it in CI.

### [GAP-002] Authenticated live-service regression coverage is incomplete

- **Classification:** Likely Gap
- **Evidence:** selector evidence records Cloudflare challenges for ChatGPT, Claude, and Perplexity on public pages. Playwright interaction checks confirmed Gemini and Grok only. Fixtures test injector mechanics, not every provider's current authenticated DOM.
- **Impact:** A provider UI change can cause a selector/submit failure until the selector checker detects it.
- **Suggested direction:** keep an opt-in authenticated release checklist and add fixtures for discovered DOM variations.

### [GAP-003] Automatic response capture has no real-service streaming E2E

- **Classification:** Likely Gap
- **Evidence:** capture polls visible service-specific DOM selectors for up to 45 seconds and deduplicates text. Its code path is covered by review and caps, but executed smoke tests did not replay a provider streaming response.
- **Impact:** Provider DOM drift may cause missing comparison notes, while sending remains unaffected.
- **Suggested direction:** add fixtures with partial streaming, prompt echo, multiple assistant candidates, and final stable text.

## 6. Documentation Mismatches

No material README/CLAUDE mismatch was found in the audited scope.

`npm run docs:check` passed. The source-of-truth rule (`src/`), build command, MV3 E2E headless caveat, selector-verification workflow, and service configuration agree with the implementation.

## 7. Recommended Fix Plan

### Phase 1 — Immediate

No production-code emergency fix is indicated. Make the extension E2E environment deterministic so regression coverage can run reliably.

### Phase 2 — Stability

1. Add a forced service-worker restart E2E while an injection is `injecting`; assert exactly one terminal site result.
2. Add streaming-response fixtures and verify the retry loop preserves useful final text.
3. Run the authenticated selector checklist before releases that modify selectors, routes, or submit mechanics.

### Phase 3 — Structural

1. Retain the current facade/module boundaries and add caller-path tests when expanding background controllers.
2. Promote selector audit evidence and E2E browser/version requirements into release automation.

## 8. Test Recommendations

### Unit

- Import duplicate history IDs, malformed custom-site selectors, and an ungranted origin; expect repaired IDs, validation errors, and no storage commit.
- Feed `recordBroadcastSiteResult` the same terminal site result twice; expect one completion increment, one history result, and one final summary.
- Feed capture update logic a prompt echo, shorter partial text, larger streamed text, and unrelated replacement text; assert its update decisions.

### Integration

- Create a two-site broadcast with one denied custom permission and one injectable tab; expect one `permission_denied`, one submitted result, and partial history.
- Start a favorite chain whose first step fails under `stop`, `continue`, and `retry-once`; assert step count, history, and terminal job state.
- Import successfully then force optional permission cleanup to reject; assert the local commit remains and a warning is handled.

### End-to-End and concurrency

- Start a multi-site broadcast, terminate the worker after a record becomes `injecting`, restart it, and assert one timeout result with no duplicate notification/history record.
- Run two favorites resolving `{{counter}}`; assert consecutive counter values and no duplicate job for one favorite.
- Exercise popup, options, and content origins against sender-policy actions; content may report selector status but must not reset settings or mutate services.

### Platform-specific

- Run `package:win` on Windows and `package:unix` on Linux/macOS from clean checkouts; load `dist/` and execute extension E2E using a supported headed/virtual-display configuration.

## 9. Final Assessment

| Area | Assessment | Basis |
| --- | --- | --- |
| Functional Correctness | Good | Typecheck, docs checks, and all 60 smoke checks passed; primary broadcast/persistence paths validate input and return structured outcomes. |
| Runtime Stability | Acceptable | Pending work is persisted and reconciled, but full MV3 restart E2E remains unproven. |
| Data Integrity | Good | Normalization, caps, permission-before-import commit, and serialized state mutation reduce corruption/loss risk. |
| Error Resilience | Acceptable | Injector, tab, selector, permission, and storage failures return structured states and user feedback; external DOMs remain variable. |
| Cross-platform Robustness | Needs Work | Windows/Unix package scripts exist, but no completed cross-platform extension E2E evidence was available. |
| Test Confidence | Acceptable | Strong fixture/smoke coverage; extension E2E needs deterministic MV3 launch support and live authenticated coverage is intentionally absent. |

The first three items to address are:

1. Stabilize the MV3 extension E2E browser/CI environment.
2. Add a service-worker-restart pending-injection regression test.
3. Add authenticated/manual provider selector checks and streaming response-capture fixtures for all built-in services.
