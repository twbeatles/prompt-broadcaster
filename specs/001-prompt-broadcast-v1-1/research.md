# Research: 멀티 AI 프롬프트 동시 전송 · 셀렉터 안정화

**Date**: 2026-07-24  
**Feature**: `001-prompt-broadcast-v1-1`

## Phase 0 Findings

### 1. DOM injection vs API

**Decision**: DOM injection vs API

**Rationale**: Works with user login, no keys

**Alternatives considered**: Official APIs — not available uniformly

### 2. Modular service worker

**Decision**: Modular service worker

**Rationale**: Maintainability after monolith split

**Alternatives considered**: Single SW file — hard to reason

### 3. Reduce proactive selector alerts

**Decision**: Reduce proactive selector alerts

**Rationale**: Alert fatigue

**Alternatives considered**: Alert on every change — noisy


## Resolved Clarifications

All Technical Context fields filled from repository layout and recent commits; no remaining NEEDS CLARIFICATION.
