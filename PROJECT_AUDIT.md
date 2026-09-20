# Project Audit

Audit date: 2026-09-20
Scope: 기능 구현·런타임 안정성 관점의 one-shot 감사. 코드는 수정하지 않았으며 감사 리포트만 작성한다.
이전 감사(`2026-08-22` 버전의 `PROJECT_AUDIT.md`)는 참고하지 않고 이번 세션에서 코드·테스트를 직접 확인하여 새로 작성했다.

## 1. Executive Summary

- 프로젝트 전체 상태: **Acceptable (양호, 단 1건의 High 수정 필요)**. Manifest V3 확장으로서 핵심 흐름(브로드캐스트 큐 → 탭 생성/재사용 → 순차 주입 → 구조화 결과 기록 → 히스토리/last-broadcast 반영)이 정합하게 연결되어 있고, 권한·검증·원자성 측면에서 주요 보호 장치가 실제로 코드에 존재함을 확인했다.
- 전체 위험도: **Medium**. `Confirmed` 데이터 파괴 이슈는 없다. 다만 타임아웃 복구 경로에서 사용자의 기존 탭을 닫을 수 있는 근거 강한 `Likely / High` 1건이 있어 방치 시 사용자 체감 피해가 크다. (전임 감사(2026-08-22)의 전체 위험도 평가는 Low-Medium이었으나, 이번 감사에서 High 1건을 새로 확인하여 Medium으로 상향한다.)
- 가장 중요한 문제:
  1. [ISSUE-001] 브로드캐스트 타임아웃 reconcile이 재사용 탭(`closeOnCancel=false`)까지 무조건 닫음 — High / Likely.
  2. [ISSUE-002] 동일 탭을 공유하는 동시 브로드캐스트가 `pendingInjections[tabId]` 레코드를 덮어써 선행 브로드캐스트가 최대 60초간 `sending`에 고착 — Medium / Likely.
  3. (Gap) CI/헤드리스 환경에서 E2E(`qa:extension`)와 스모크(`qa:smoke`)를 실행할 수 없어 주입·SW 수명주기 회귀가 로컬 브라우저 보유 환경에 의존 — Confirmed Gap.
- 데이터 손상/유실 가능성: **저장 데이터 파괴 경로는 발견되지 않았다.** import는 단일 `chrome.storage.local.set` 원자 커밋 + 권한 거부 시 커밋 전 abort, history는 quota 폴백 + id 중복 해소, reset은 세션/로컬 키를 명시적으로 정리한다. [ISSUE-001]은 저장 데이터가 아닌 "열려 있는 사용자 탭"에 대한 피해다.
- 가장 먼저 수정해야 할 영역: `src/background/broadcast/pending/controller.ts`의 `reconcilePendingBroadcasts` 타임아웃 탭 정리 로직.

## 2. Project Understanding

### 프로젝트 목적

API 키·백엔드 없이, 이미 로그인된 브라우저의 AI 웹 서비스(ChatGPT, Gemini, Claude, Grok, Perplexity + 커스텀 사이트)에 하나의 프롬프트를 동시 주입하는 Chrome MV3 확장. 히스토리·즐겨찾기(단일/체인/스케줄)·비교 노트·실험·템플릿 팩·서비스 그룹을 로컬에 보관한다.

### 주요 entrypoint

- `manifest.json` → `background/service_worker.js` (빌드원: `src/background/main.ts` → `src/background/app/bootstrap/app.ts` 컴포지션 루트)
- `manifest.json` → popup (`popup/popup.html`, 원: `src/popup/main.ts` → `src/popup/app/bootstrap/`)
- `manifest.json` → options (`options/options.html`, 원: `src/options/main.ts` → `src/options/app/bootstrap.ts`)
- `manifest.json` content_scripts → `content/selector_checker.js` (AI 도메인 상시 동작), 브로드캐스트 시점에 worker가 `content/injector.js`를 주입
- on-boarding, quick palette(`Alt+Shift+F`), context-menu, alarms가 부가 진입점

### 핵심 모듈

- `src/background/broadcast/queue.ts` (`createBroadcastQueue`): 프롬프트 검증 → 타겟 해소 → 권한 검사 → 탭 생성/재사용 → pending injection 등록 → 순차 처리 위임 → `queuedSiteCount>0`일 때만 카운터 증가
- `src/background/broadcast/pending/controller.ts` (`createPendingBroadcastController`): pending 브로드캐스트 생성, 사이트 결과 누적(`recordBroadcastSiteResult`, 사이트당 1회만 기록·이중 기록 방지), 완료 시 side-effect 격리 실행(히스토리 append → 포커스 복원 → 알림 순서로 best-effort), 취소, stale reconcile
- `src/background/injection/pending.ts` + `execute.ts`: 주입 직렬화 체인(`injectionProcessChain`), 탭 활성화 후 주입, 전략 통계 누적, 타임아웃 처리
- `src/background/app/bootstrap/tab-targets/index.ts`: 타겟 해소(`resolveSelectedTargets`, 중복 id 제거) + 재사용 탭 preflight(입력 서피스·인증 서피스·submit 조건부 검사)
- `src/background/messages/router.ts`: sender 정책(`extension`/`content`/`any`) + `safeSendResponse` (닫힌 포트 내성)
- `src/shared/chrome/messaging.ts`: 타임아웃 내성 `sendRuntimeMessage` (fallback 값으로 해소, 미해결 방지)
- `src/shared/prompts/import-export.ts` + `migrations.ts` + `summary.ts`: v1→v9 마이그레이션, 정규화, 권한 선검사, 단일 커밋
- `src/background/popup/favorites-workflow/`: 진입점(검증·차단 사유 판정) + run-jobs(중복 실행 dedupe, 체인 진행, `queueFavoriteExecution` 직렬화)
- `src/background/session/store.ts`: 세션 상태 직렬화 mutation 체인(메모리 + `chrome.storage.session` 영속)
- `src/shared/prompts/history-store.ts`, `src/shared/runtime-state/reset.ts`, `src/shared/export/csv.ts`

### 데이터 저장 방식

- `chrome.storage.local`: history, favorites, settings, templates, experiments, comparison notes, custom sites, built-in overrides/states (하드캡 + quota 폴백)
- `chrome.storage.session`: pendingBroadcasts, pendingInjections, pendingSelectorChecks, selectorAlerts, lastBroadcast, favoriteRunJobs, UI toasts, intents
- DB/백엔드/API 없음. 외부 의존성은 Chrome extension API + 개발 의존성(TypeScript, esbuild, Playwright)뿐.

### 외부 의존성

- 실행 시점 외부 네트워크 호출 없음(주입 대상 AI 웹페이지 자체 제외). 원칙적으로 오프라인 로직 + 로컬 저장소.

### 핵심 실행 흐름

```text
Popup send / favorite run / schedule alarm / context-menu / quick-palette
→ Entry: 입력 정규화·템플릿 변수 해소(resolvedPrompt)·실행 차단 사유 검증
→ Handler: runtime message router (sender 정책 검사, safeSendResponse)
→ Core: broadcast queue (타겟당 권한·명시탭·재사용 preflight) → pendingBroadcast + pendingInjection(tabId 키)
→ Tab/File/API: chrome.tabs.create/reuse → windows/tabs 활성화 → scripting.executeScript 주입·submit
→ State: recordBroadcastSiteResult(사이트당 1회) → 완료 시 lastBroadcast sync·히스토리 append·포커스 복원·알림 (격리된 side-effect)
→ Result: popup 카드 상태 갱신 / 체인 다음 스텝 / 재시도(저장된 resolvedPrompt 재사용)
```

```text
Import JSON
→ JSON parse → 버전 마이그레이션(v1→…→v9) → 정규화·id 중복 해소
→ 커스텀 사이트 오리진 권한 일괄 요청 (거부 시 커밋 전 throw로 전체 abort)
→ 단일 chrome.storage.local.set 커밋 → 미사용 optional 권한 best-effort 정리 → import 리포트 반환
```

## 3. Audit Coverage & Limitations

### 실제 확인한 주요 모듈

- 매니페스트·빌드 스크립트·`tsconfig`·README·CLAUDE.md(스펙킷 블록 포함, `AGENTS.md`는 루트에 없음 — `.agents/` 스킬만 존재)
- 브로드캐스트 큐·pending 컨트롤러(생성/결과누적/완료 side-effect/취소/reconcile)·주입 pending/execute 뼈대
- 메시지 라우터 신뢰 경계 + 타임아웃 메시징 헬퍼
- import/export 전량(마이그레이션 상수 `CURRENT_EXPORT_VERSION = 9` 확인), history-store(quota·id), reset(세션+로컬+알람)
- 즐겨찾기 실행 전 과정(차단 사유·스케줄 변수 블록리스트·counter 직렬화·dedupe·체인 재시도 정책·스케줄 알람 자가정리)
- 팝업 재시도(resolvedPrompt 보존)·CSV formula escaping·세션 mutation 체인·waiter 레지스트리

### CodeGraph로 분석한 호출 관계

- 본 환경에는 CodeGraph MCP 도구가 노출되어 있지 않아, 동일 엔진의 **CLI(`codegraph explore / node / query`)를 우선 사용**하고 부족분만 파일 직접 열람으로 보완했다. `.codegraph/codegraph.db` 인덱스가 존재함을 확인했다.
- 확인한 호출/영향 범위: `createBroadcastQueue`·`recordBroadcastSiteResult`·`createPendingInjectionController`·`registerRuntimeMessageRouter`·`importPromptData`·`queueFavoriteExecution`·`runFavoriteJob`·`reconcileFavoriteSchedules`·`resolveSelectedTargets`·`sendRuntimeMessage`·`resetPersistedExtensionState` 및 블라스트 래이디언스(호출자/피호출자) 정보.

### 실행한 테스트

- `npm run typecheck` — **통과** (이번 세션에서 직접 실행)
- `npm run docs:check` — **통과** (이번 세션에서 직접 실행)
- `npm run qa:smoke` — **미실행**: Playwright Chromium 바이너리가 환경에 미설치(`chrome-headless-shell.exe` 부재로 시작 실패). 지침상 불필요한 의존성 설치를 하지 않으므로 브라우저를 설치하지 않았다.
- `npm run qa:extension` — **미실행**: 동일 사유(헤드리스 MV3 워커 필요). headed 실행도 본 환경에서 불가.
- `npm run selector:audit` — **미실행**: 실서비스 DOM 접근이 필요한 감사가 범위·환경상 불가하여 실행하지 않았다.

### 반증 후 제외한 후보 (이슈로 채택하지 않음)

- 즐겨찾기 `{{counter}}` 동시 실행 중복: `runFavoriteJob`이 `buildFavoriteStepPrompt` 읽기 + `queueBroadcastRequest` 증가를 `queueFavoriteExecution` 체인 안에서 함께 직렬화함을 확인 — 주장 성립, 제외.
- 스케줄 알람이 reset 후 고아로 남아 유령 실행: reset이 `promptFavorites` 삭제를 일으키면 `storage.onChanged` → `reconcileFavoriteSchedules`가 고아 알람을 정리하고, 설령 발사되더라도 `handleFavoriteScheduleAlarm`이 favorite 부재 시 알람을 self-clear 후 return — 유령 브로드캐스트 불가, 제외(잔여 과도 구간은 Low로 Gap에 기술).
- import 비정상 JSON으로 상태 반파괴: 호출자(options/popup)가 try/catch 처리하고, 커밋이 단일 `set`이며 권한 거부 시 커밋 전 throw — 제외.
- 팝업 재시도가 per-service resolvedPrompt를 버림: `buildRuntimeBroadcastTargets`가 동일 target 객체의 `resolvedPrompt`를 그대로 전달 — 제외.
- history id 충돌·quota 유실: `ensureUniqueNumericId` + `isStorageQuotaError` 시 emergency cap 후 재기록 — 제외.
- content-script 위장 메시지: `getSenderKind`가 extension-origin URL 우선 판별 후 tab 기반 content 판별, 기본 정책 `extension` — 제외.
- waiter 미해결 영구 대기: 레지스트리가 메모리 순수 함수(never reject)이고, favorite run은 `getLastBroadcast` 재확인 폴백 보유 — 제외.
- CSV 수식 주입: `normalizeCsvCellValue`가 `= + - @` 선행 셀에 `'` 접두 — 제외.

### 확인하지 못한 환경/외부 서비스 및 한계

- 실제 Chrome에 확장 로드 후 5개 내장 서비스에 대한 주입·submit·셀렉터 drift를 재현하지 못함(외부 로그인 서비스·실브라우저 필요).
- Windows 단일 환경에서만 확인. MV3 SW 장시간 suspend·절전 복원 타이밍은 코드 경로로만 판단.
- CodeGraph 인덱스가 `dist/` 빌드 산출물도 포함하므로, blast-radius 인용 시 `src/` 심볼 기준으로 교차 확인했다.

## 4. High-Risk Issues

### [ISSUE-001] 타임아웃 reconcile이 재사용 탭까지 무조건 닫음

- **위치:** `src/background/broadcast/pending/controller.ts` — `reconcilePendingBroadcasts` (타임아웃 분기, 약 402~414행) / 대조군: 동일 파일 `cancelBroadcast` (약 312~332행, `closeOnCancel` 존중)
- **우선순위:** High
- **신뢰도:** Likely (코드 근거 강함, 런타임 재현은 못함)
- **문제:** 브로드캐스트가 `PENDING_TIMEOUT_MS`(60초, `src/background/app/constants.ts`)를 초과한 채로 관련 주입 job이 남아 있으면, reconcile이 `job.closeOnCancel` 값을 확인하지 않고 관련 탭을 전부 `closeTabQuietly`로 닫는다. 재사용된 사용자 기존 탭도 pending injection 레코드를 갖기 때문에 닫힘 대상에 포함된다.
- **발생 조건:** 브로드캐스트 시작 후 60초 이상 경과한 stale 상태에서 (1) SW 재시작 후 초기화(`initializeServiceWorker`), (2) 새 브로드캐스트 요청 전 reconcile, (3) 팝업 열림(`handlePopupOpened`) 중 어느 하나가 실행될 때. 예: 주입 대기 중 노트북 절전·SW 장시간 suspend 후 팝업을 다시 열면 조건 성립.
- **영향:** 사용자가 브로드캐스트와 무관하게 열어 둔 AI 대화 탭(재사용 탭)이 본인 의사와 무관하게 닫힘. 대화 내용은 서비스 측에 남아 있을 수 있으나 작업 맥락이 소실되고, Chrome 기록으로 복원해야 하는 불편 + 신뢰 하락. 저장 데이터 자체는 손상되지 않음.
- **근거:** `queueResolvedBroadcastRequest`(`src/background/broadcast/queue.ts` 약 172~181행)는 재사용 탭에 `closeOnCancel: !reusableTab` 즉 `false`를 기록하고, `cancelBroadcast`는 `job?.closeOnCancel !== false`를 검사한 뒤에만 닫는다. 반면 타임아웃 reconcile 분기는 동일 검사를 생략하고 `relatedJobs` 전부를 닫는다. 취소 경로가 구분을 알고 있다는 점이 오히려 reconcile의 누락을 방증한다. 주입 레벨 reconcile(`src/background/injection/pending.ts`의 `reconcilePendingInjections` → `handlePendingInjectionTimeout`)은 탭을 닫지 않으므로, 탭 닫힘은 이 브로드캐스트 레벨 경로 고유 동작이다.
- **반증 확인:** (a) injection-timeout 처리는 탭을 닫지 않음을 확인 — 해당 없음. (b) 60초 이내 정상 완료 경로는 영향 없음 — stale 조건에서만 발화하므로 정상 경로는 보호됨. (c) 닫힌 탭이 모두 확장 생성 탭이라면 무해 — 그러나 재사용 탭도 동일 레코드 구조로 포함됨을 `addPendingInjection` 호출 위치로 확인. 보호 장치가 해당 분기에 존재하지 않으므로 반증 실패.
- **호출/영향 범위:** CodeGraph 기준 `reconcilePendingBroadcasts` 호출자: SW 초기화(`service-worker.ts`), `queueBroadcastRequest`(신규 요청 전), `handlePopupOpened`, `resetAllExtensionData`. 영향 모듈: 탭 라우팅·사용자 열린 탭 전체(사이트 무관).
- **권장 수정 방향:** 타임아웃 reconcile의 탭 정리 루프에 `cancelBroadcast`와 동일한 `closeOnCancel !== false` 조건을 적용하고, 닫지 않은 재사용 탭의 pending injection은 `removePendingInjection` + `tab_closed`가 아닌 `injection_timeout` 결과로만 마감한다. (코드는 수정하지 않음 — 방향만 제시)
- **필요한 회귀 테스트:** (1) 단위: `closeOnCancel=false` job이 포함된 stale broadcast에 대해 reconcile 실행 후 `chrome.tabs.remove`가 해당 tabId에 호출되지 않음을 검증. (2) 통합: 재사용 탭 1 + 신규 탭 1 조합에서 강제 stale 만료 시 신규 탭만 닫히고 재사용 탭 생존 + 양쪽 모두 터미널 결과 기록됨을 검증.

### [ISSUE-002] 동시 브로드캐스트가 같은 재사용 탭의 pending 레코드를 덮어씀

- **위치:** `src/background/session/store.ts` — `addPendingInjection`/`updatePendingInjection` (tabId 키 단일 슬롯, 약 174~209행) / 기인: `src/background/broadcast/queue.ts` — `queueResolvedBroadcastRequest` (약 172~212행)
- **우선순위:** Medium
- **신뢰도:** Likely (코드 근거 강함, 런타임 재현은 못함)
- **문제:** `pendingInjections`가 tabId당 단일 레코드(`broadcastId` 포함)다. 두 브로드캐스트가 같은 재사용 탭을 대상으로 하면(기본 `reuseExistingTabs` 켜짐), 후행 `addPendingInjection`이 선행 job을 통째로 교체한다. 선행 브로드캐스트의 해당 사이트는 결과가 영원히 도착하지 않고, 최대 60초 뒤 stale reconcile(`broadcast_stale`)로 마감될 때까지 팝업에 `sending`으로 고착된다.
- **발생 조건:** 두 브로드캐스트의 처리 구간이 겹치고 동일한 재사용 가능 탭을 선택할 때. 팝업 단독 연타는 `state.isSending` 가드가 막지만, 팝업 전송 + quick-palette/스케줄 favorite 실행 + 컨텍스트 메뉴 브로드캐스트의 조합은 가드를 공유하지 않아 도달 가능. SW 재시작 후 잔류 pending 상태에서 새 요청이 겹쳐도 가능.
- **영향:** 선행 브로드캐스트 일부 사이트의 상태 표시가 최대 60초간 `sending` 고착 후 `broadcast_stale`로 마감. 데이터 유실은 없으나(히스토리는 터미널 결과로 기록됨) 상태 신뢰 하락 + 체인 후속 스텝 지연. 주입 자체는 후행 레코드로 1회 수행되므로 이중 전송은 아니다.
- **근거:** `updatePendingInjection`이 `pending[String(tabId)]` 단일 슬롯을 무조건 교체하며, `queuePendingInjection`의 중복 방지(`activeInjections`/`queuedInjectionTabIds`)는 처리 중복만 막을 뿐 레코드 교체는 막지 못한다. `processPendingInjectionNow`는 슬롯의 현재 `job.broadcastId` 기준으로 결과를 기록하므로 선행 broadcastId로의 결과 귀속이 소실된다.
- **반증 확인:** (a) 팝업 `isSending` 가드 — 단일 진입점 연타는 막지만 진입점 간 동시는 막지 못함. (b) `recordBroadcastSiteResult`의 사이트당 1회 기록 — 고착된 선행 사이트가 reconcile에서 정확히 1회 마감되는 것은 보장하나, 고착 자체는 막지 못함. (c) SW 재시작 시 `activeInjections`/`queuedInjectionTabIds` 메모리 초기화 — 오히려 재처리 경합을 넓힘. 반증 실패.
- **호출/영향 범위:** CodeGraph 기준 `addPendingInjection` 호출자는 브로드캐스트 큐 단일 경로이며, 소비자는 주입 컨트롤러·탭 제거 리스너·취소·reconcile. 영향 모듈: pending 상태 전반 + lastBroadcast/히스토리 마감 시점.
- **권장 수정 방향:** (택1) 동일 tabId에 활성 job이 다른 broadcastId로 존재하면 신규 브로드캐스트의 해당 사이트를 `tab_busy` 성격의 즉시 터미널 결과로 마감하고 탭을 공유하지 않음. (택2) 슬롯을 `(tabId, broadcastId)` 복합 키로 확장. 규모상 택1이 적합.
- **필요한 회귀 테스트:** (1) 단위: 동일 tabId에 broadcast-A job 존재 상태에서 broadcast-B가 `addPendingInjection`을 시도할 때 A 레코드 보존 + B 사이트 즉시 터미널 마감 검증. (2) 동시성: 두 `queueBroadcastRequest`를 겹쳐 실행해도 양쪽 브로드캐스트가 60초 대기 없이 터미널 상태에 도달함을 검증.

## 5. Potential Functional Gaps

- **Confirmed Gap — CI/헤드리스 회귀 실행 불가:** 본 감사 환경에서 `qa:smoke`가 Playwright 브라우저 미설치로 시작 실패했고, `qa:extension`은 MV3 워커 특성상 헤드리스 제약을 갖는다(CLAUDE.md에 headed 기본으로 명시). 결과적으로 주입·SW 수명주기 회귀가 "브라우저 보유 개발자 머신"에 의존한다. 테스트 코드 자체의 결함이 아니라 실행 환경 보장 부재다.
- **Likely Gap — 실서비스 인증 기반 셀렉터 회귀 부재:** 내장 5개 서비스 중 일부 공개 페이지는 bot-gate에 막혀 외부 무인증 검증이 제한적이라는 전임 감사 관측과 일치하는 구조다(셀렉터는 `builtins.ts` 하드코딩 + `supportedRoutes`/인증 셀렉터 기반). 로그인 세션이 필요한 주입 회귀는 자동화되어 있지 않은 것으로 보인다.
- **추정 — reset 직후 스케줄 알람의 과도 구간:** `resetAllExtensionData`는 `apb-favorite-job:*` 알람만 명시 제거하고 `apb-schedule:*`는 `promptFavorites` 삭제에 따른 `storage.onChanged` → `reconcileFavoriteSchedules` 간접 정리 + 발사 시 self-clear에 의존한다. 발사 핸들러가 favorite 부재를 먼저 처리하므로 유령 실행은 되지 않지만, 명시적 정리가 아니라 SW suspend 타이밍에 따라 과도 잔존이 가능하다. 다음 reset 수정 시 스케줄 prefix도 함께 제거하는 편이 안전하다.
- **추정 — JSON 백업 평문 보관:** export 산출물에 민감 프롬프트·선택 텍스트가 평문으로 포함된다. Local-first 설계상 의도된 범위이나, 백업 파일 유출 시 노출을 줄이는 선택적 보호(예: 내보내기 경고 문구)는 없다.
- **추정 — 브로드캐스트 내 사이트 단위 개별 취소 없음:** 취소는 브로드캐스트 단위다. 특정 사이트만 중단하고 나머지를 계속하는操作은 현재 모델에 없다. 실패율이 높은 사이트가 전체 흐름을 지연시킬 때의 조작 세분화 여지로만 기록한다(버그 아님).

## 6. Documentation Mismatches

- **경미 1건:** `README.md`의 테스트 안내는 `npm run qa:extension`을 headed/헤드리스 구분 없이 기재한다. `APB_E2E_HEADLESS=1` 조건과 "헤드리스 MV3 워커 제약" 설명은 `CLAUDE.md`에만 있다. 신규 기여자가 README만 보고 CI 헤드리스 실행을 시도하면 실패 원인을 찾기 어렵다.
- 그 외 확인 범위 내 불일치는 없다: export `version: 9`(코드 `CURRENT_EXPORT_VERSION = 9`와 일치), `{{counter}}` 증가 조건(성공 큐 1건 이상), retry의 resolvedPrompt 재사용, CSV 수식 이스케이프(`'` 접두), `historyLimit`의 표시 상한 semantics, sender 신뢰 경계, `siteOrder`/스케줄/체인 동작 서술이 모두 구현과 일치한다.
- `AGENTS.md`는 루트에 존재하지 않는다(`.agents/` 스킬 디렉터리만 존재). 작업 지시가 전제한 문서 중 없는 파일이므로 명시한다. 프로젝트 규칙은 `CLAUDE.md` + `README.md`가 사실상 대체한다.

## 7. Recommended Fix Plan

### Phase 1 — Immediate (데이터·사용자 피해 직결)

1. [ISSUE-001] reconcile 타임아웃 분기에 `closeOnCancel` 존중 추가 + 회귀 테스트(재사용 탭 생존/신규 탭 정리 분리 검증).
2. [ISSUE-002] 동시 브로드캐스트의 tabId 슬롯 경합 해소(후행 사이트 즉시 터미널 마감 또는 복합 키) + 동시성 회귀 테스트.

### Phase 2 — Stability (예외·검증·상태·호환성)

3. reset에서 `apb-schedule:*` 알람 명시 제거(간접 정리에 의존하지 않기) — [ISSUE-001] 수정과 함께 처리 시 위험 없음.
4. README 테스트 섹션에 `qa:extension` headed 기본 + `APB_E2E_HEADLESS` 조건 3줄 보완.
5. `reconcilePendingBroadcasts`의 60초 고정 타임아웃을 주입 진행 중(`injecting`·최근 전략 시도 존재) 건과 완전 정체 건으로 구분하는 정교화 검토(오탐 탭 정리 축소).
6. 플랫폼별 패키징 스크립트(`package.ps1`/`package.sh`)의 산출물 동등성 점검을 릴리스 체크리스트에 명문화(현재 코드 자체의 OS 분기는 없음).

### Phase 3 — Structural (구조·테스트 가능성)

7. `pendingInjections`를 tabId 단일 슬롯에서 브로드캐스트 귀속을 보존하는 구조로 리팩터링(Phase 1 택2 선택 시).
8. 헤드리스/CI 실행 가능한 E2E tier 분리(실브라우저 필요 편 vs chrome-API 모킹 편) — Confirmed Gap 해소.
9. 실서비스 인증 기반 셀렉터 회귀를 수동 체크리스트(`docs/selector-verification-*`)와 자동 smoke의 경계 명문화.

실제 코드는 수정하지 않는다 — 위는 방향 제시에 한한다.

## 8. Test Recommendations

- **Unit — reconcile 탭 정리:** 입력: `closeOnCancel=false` job 1 + `true` job 1을 가진 61초 경과 broadcast. 기대: `false` 탭에 `tabs.remove` 미호출 + `injection_timeout` 기록, `true` 탭만 제거. ([ISSUE-001] 회귀)
- **Unit — 슬롯 경합:** 입력: tabId=7에 broadcast-A pending 존재 중 broadcast-B 큐잉. 기대: A 레코드 불변 + B 해당 사이트 즉시 터미널(`tab_busy` 성격) 마감, B의 타 사이트 정상 진행. ([ISSUE-002] 회귀)
- **Integration — stale 브로드캐스트 전 수명주기:** 입력: 사이트 2곳 브로드캐스트 후 SW 재시작 흉내(메모리 셋 초기화) + 61초 경과. 기대: 재사용 탭 생존, 양쪽 사이트 터미널 결과, history 1행 append, lastBroadcast 갱신.
- **Integration — reset 후 스케줄:** 입력: 스케줄 favorite 1건 상태에서 `resetAllExtensionData`. 기대: `chrome.alarms.getAll()`에 `apb-schedule:*`·`apb-favorite-job:*` 잔존 0 + 이후 알람 발사 시 브로드캐스트 0건.
- **E2E — 팝업 재시도 보존:** 입력: per-service override가 있는 전송 실패 후 Retry 클릭. 기대: 재전송 payload의 `resolvedPrompt`가 최초 렌더값과 동일(override 재적용이 아닌 저장값 재사용).
- **E2E — import 권한 거부:** 입력: 미보유 오리진 포함 v9 JSON import + 권한 거부. 기대: `chrome.storage.local` 기존 값 불변 + 거부 오리진 명시 리포트.
- **Concurrency — favorite 2건 동시 실행:** 입력: `{{counter}}` 포함 favorite 2건을 50ms 간격으로 큐잉. 기대: 렌더된 counter 값 중복 없음 + 양쪽 history에 서로 다른 counter 반영.
- **Regression — 라우터 신뢰 경계:** 입력: 외부/무-id sender의 `broadcast`·`resetAllData` 메시지. 기대: 핸들러 미실행 + 응답 없음(포트 유지), 내부 sender는 정상 처리.
- **Platform-specific — 패키징 동등성:** 입력: 동일 커밋에서 `package.ps1`와 `package.sh`. 기대: 양쪽 zip 내 `dist/` 파일 목록·매니페스트 버전 동일(Windows/macOS 실행).

## 9. Final Assessment

| 영역 | 평가 | 근거 |
|---|---|---|
| Functional Correctness | Acceptable | 핵심 흐름 정합 + 주요 보호장치 실재. 단 [ISSUE-001]의 복구 경로 결함 1건 |
| Runtime Stability | Acceptable | 직렬화 체인·side-effect 격리·재조정(reconcile) 완비, SW 재시작 복구 고려됨 |
| Data Integrity | Good | 원자 커밋·quota 폴백·id 해소·권한 선검사가 코드로 확인됨 |
| Error Resilience | Acceptable | 라우터·메시징·주입 예외 격리 양호. 고착 60초([ISSUE-002])가 잔여 |
| Cross-platform Robustness | Acceptable | 확장 본체는 플랫폼 중립. 패키징 2종 동등성은 미검증이라 Good 불가 |
| Test Confidence | Needs Work | typecheck·docs:check 통과이나, 브라우저 의존 테스트를 본 환경에서 실행 불가 + 실서비스 회귀 부재 |

**실제로 먼저 수정할 문제 3개:**

1. [ISSUE-001] reconcile 타임아웃의 재사용 탭 무조건 닫기 — 사용자 탭 피해 직결이므로 최우선.
2. [ISSUE-002] 동시 브로드캐스트의 tabId 슬롯 덮어쓰기 — 상태 고착 60초 해소.
3. reset의 스케줄 알람 명시 제거 + README E2E 안내 3줄 보완 — Phase 1 작업과 묶음 처리 가능한 저비용 안정화.
