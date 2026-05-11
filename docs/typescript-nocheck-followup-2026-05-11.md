# TypeScript `@ts-nocheck` Follow-Up - 2026-05-11

This pass removed `@ts-nocheck` from the highest-risk implementation surfaces touched by the risk review:

- `src/config/sites/builtins.ts`
- `src/options/app/dom.ts`
- `src/options/app/i18n.ts`
- `src/options/app/state.ts`
- `src/options/features/experiments.ts`
- `src/options/features/template-packs.ts`
- `src/options/features/history/modal.ts`

The remaining suppressions are intentionally left for smaller follow-up passes because they span older options rendering, settings, schedules, selector-checker, selection, and onboarding modules.

## Remaining Groups

- Options shell and data flow: `src/options/app/bootstrap.ts`, `src/options/app/helpers.ts`, `src/options/core/*`
- Options feature renderers: dashboard, services, settings, schedules, history list/filter/export/events
- Content selector checker: `src/content/selector-checker/*`
- Content selection helper: `src/content/selection/*`
- Onboarding app: `src/onboarding/app/*`

## Guardrail

Before removing another suppression, run:

```bash
npm run typecheck
```

After removing each file-level suppression, keep the edit local to that module and avoid broad behavior changes in the same commit.
