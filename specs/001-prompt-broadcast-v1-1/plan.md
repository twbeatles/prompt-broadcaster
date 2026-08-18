# Implementation Plan: 멀티 AI 프롬프트 동시 전송 · 셀렉터 안정화

**Branch**: `001-prompt-broadcast-v1-1` | **Date**: 2026-07-24 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/001-prompt-broadcast-v1-1/spec.md`

**Note**: Brownfield plan — align codebase with already-shipped intent; use for converge/tasks and future parity.

## Summary

Chrome MV3 extension broadcasts one prompt to multiple AI tabs via DOM injection; modular background; quieter selector alerts; refreshed site selectors.

## Technical Context

**Language/Version**: TypeScript (src/) → built JS (dist/)

**Primary Dependencies**: Chrome Extension MV3 APIs; npm build toolchain

**Storage**: chrome.storage (favorites, history, settings)

**Testing**: npm build + QA smoke scripts under scripts/qa-smoke

**Target Platform**: Chrome desktop extension

**Project Type**: browser-extension

**Performance Goals**: Broadcast to N tabs without blocking popup UI

**Constraints**: No API keys; depends on live site DOMs

**Scale/Scope**: Personal multi-AI workflow

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

- Constitution file is still a Spec Kit template placeholder in this repo — treat as **advisory defaults**:
  - Prefer small, testable modules over monolith growth
  - Keep user-facing paths documented and verifiable
  - No unjustified new top-level packages
- **Gate result (pre)**: PASS with advisory constitution (no hard project-specific rules yet)
- **Gate result (post Phase 1)**: PASS — design stays within existing tree (`Feature folders under background/popup; shared normalizers.`)

## Project Structure

### Documentation (this feature)

```text
specs/001-prompt-broadcast-v1-1/
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
├── contracts/
└── tasks.md             # NOT created by /speckit-plan
```

### Source Code (repository root)

```text
src/background/
src/popup/
src/content/
src/options/
src/shared/
dist/
docs/
```

**Structure Decision**: Feature folders under background/popup; shared normalizers.

## Complexity Tracking

> No constitution violations requiring justification for this brownfield plan.
