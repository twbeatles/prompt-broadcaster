# Release Selector Verification Checklist

Use this checklist before shipping selector or route changes.

## Built-in services

### ChatGPT
- Logged-out/auth route: verify the login/auth entry route does not raise a confirmed selector warning.
- Logged-in canonical route: verify the main composer route still accepts injection.
- Locale: record the locale used during verification.
- Prompt surface: confirm the visible editable composer is found.
- Submit surface: confirm the expected send button appears after input when conditional-submit mode is used.
- Soft-gated: note whether login prompts can coexist with the composer without blocking injection.

### Gemini
- Logged-out/auth route: verify auth pages are treated as auth-only and do not promote selector warnings.
- Logged-in canonical route: verify `/app` still exposes the supported composer.
- Locale: record the locale used during verification.
- Prompt surface: confirm the visible editable composer is found.
- Submit surface: confirm the send button is visible on `/app`.
- Soft-gated: note whether partial gating appears and whether composer access remains available.

### Claude
- Logged-out/auth route: verify auth pages are treated as auth-only and do not promote selector warnings.
- Logged-in canonical route: verify `/new` still exposes the supported composer.
- Locale: record the locale used during verification.
- Prompt surface: confirm the visible editable composer is found.
- Submit surface: confirm the send button is visible on `/new`.
- Soft-gated: note whether partial gating appears and whether composer access remains available.

### Grok
- Logged-out/auth route: verify sign-in routes do not promote selector warnings.
- Logged-in canonical route: verify the main composer route still accepts textarea-first injection.
- Locale: record the locale used during verification.
- Prompt surface: confirm the visible editable composer or textarea is found.
- Submit surface: confirm the send button appears after input when conditional-submit mode is used.
- Soft-gated: note whether login prompts can coexist with the composer without blocking injection.

### Perplexity
- Logged-out/auth route: verify login routes do not promote selector warnings.
- Logged-in canonical route: verify the main composer route still exposes the Lexical prompt surface.
- Locale: record the locale used during verification.
- Prompt surface: confirm `#ask-input[data-lexical-editor='true']` or the current supported fallback is found.
- Submit surface: confirm the submit button appears after input when conditional-submit mode is used.
- Soft-gated: note whether login prompts can coexist with the composer without blocking injection.

## Custom and override checks
- If a built-in service override changes `supportedRoutes`, verify every configured prefix manually.
- If a custom service uses `supportedRoutes`, verify unsupported routes are skipped rather than warned.
- If hostname aliases were changed, verify selector checks and reusable-tab detection behave consistently on every allowed hostname.

## Metadata sync after verification
- Update structured verification fields for every changed service: `verifiedAt`, `verifiedRoute`, `verifiedAuthState`, `verifiedLocale`, `verifiedVersion`, and any changed `supportedRoutes`.
- Treat `lastVerified` as a compatibility field only. If `verifiedAt` is present, let the code derive `lastVerified` instead of hand-editing both.
- Re-run `npm run selector:audit` after selector or route-policy changes and carry the recorded route/auth/locale details into release notes when behavior stays best-effort or soft-gated.

## Automation and evidence files
- Run `npm run docs:check` before publishing selector docs so stale export-version or validation-command wording is caught.
- Run `npm run qa:extension` after `npm run build` when options navigation, selector health, comparison notes, service groups, template packs, experiments, or popup fallback changed.
- Store audit evidence in a dated file such as [selector-verification-2026-05-11.md](selector-verification-2026-05-11.md). Automated audit rows that hit Cloudflare, login, or access challenges must stay separate from logged-in canonical route proof.
- Do not promote a selector to verified logged-in status unless the manual evidence records route, auth state, locale, prompt surface, submit surface after input, and build/UI version.

## Source touchpoints for selector changes
- `src/config/sites/builtins.ts`: built-in selector, route, and verification metadata source of truth.
- `src/shared/sites/normalizers/site-records.ts`: built-in override repair and runtime site-record normalization logic.
- `src/background/app/bootstrap/tab-targets.ts`: reusable-tab preflight and supported-route assumptions that must stay aligned with selector policy.
- `src/popup/services/controller/editor.ts`: custom-service editor validation and advanced verification fields in popup settings.
- `src/popup/app/i18n/catalog.ts` and `_locales/*/messages.json`: user-facing wording when selector or verification states require new copy.

## Release notes
- Capture the verification date, route, auth state, locale, and UI version/build tag for every changed service.
- If a service remains best-effort or soft-gated, note the limitation explicitly in release notes or audit docs.
