# AI Prompt Broadcaster - 프로젝트 구조 분석

> 기준일: 2026-04-09
> 최종 업데이트: 2026-04-09 (runtime messaging hardening, siteOrder, dashboard 확장, schedules 결과 요약 반영)
> 분석 범위: 전체 소스코드, 빌드 시스템, 데이터 흐름, UI 구조

---

## 1. 프로젝트 개요

Chrome Manifest V3 기반 확장 프로그램이다. 프롬프트 하나를 ChatGPT, Gemini, Claude, Grok, Perplexity 등 여러 AI 서비스에 동시에 전송하며, 백엔드나 API 키 없이 `chrome.scripting.executeScript`와 content script로 각 사이트 DOM에 직접 주입한다.

현재 구현의 큰 축은 다음 4가지다.

- 다중 AI 방송 + 재사용 탭/새 탭/특정 탭 라우팅
- 템플릿 변수, 히스토리, 즐겨찾기, 커스텀 서비스 관리
- 즐겨찾기 체인/예약/빠른 팔레트 기반 실행 확장
- runtime messaging / sender trust boundary 하드닝
- options dashboard / schedules / services 운영성 강화
- background/popup/options의 기능 기준 모듈 분리 리팩터링

---

## 2. 현재 디렉터리 구조

```text
prompt-broadcaster/
├── src/
│   ├── background/
│   │   ├── app/
│   │   │   ├── bootstrap.ts
│   │   │   ├── constants.ts
│   │   │   └── injection-helpers.ts
│   │   ├── commands/
│   │   │   └── quick-palette.ts
│   │   ├── context-menu/
│   │   │   └── index.ts
│   │   ├── messages/
│   │   │   └── router.ts
│   │   ├── popup/
│   │   │   ├── favorites-workflow.ts
│   │   │   └── launcher.ts
│   │   ├── selection/
│   │   │   └── runtime.ts
│   │   └── main.ts
│   ├── config/
│   │   ├── sites/
│   │   │   ├── builtins.ts
│   │   │   └── index.ts
│   │   └── sites.ts
│   ├── content/
│   │   ├── injector/
│   │   ├── palette/
│   │   ├── selection/
│   │   └── selector-checker/
│   ├── onboarding/
│   ├── options/
│   │   ├── app/
│   │   ├── core/
│   │   ├── features/
│   │   ├── ui/
│   │   └── main.ts
│   ├── popup/
│   │   ├── app/
│   │   ├── features/
│   │   ├── ui/
│   │   └── main.ts
│   └── shared/
│       ├── broadcast/
│       ├── chrome/
│       ├── export/
│       ├── i18n/
│       ├── prompt-state.ts
│       ├── prompts/
│       ├── runtime-state/
│       ├── sites/
│       ├── stores/
│       ├── template/
│       ├── template-utils.ts
│       └── types/
├── popup/
│   ├── popup.html
│   └── styles/
│       ├── app.css
│       └── partials/
├── options/
│   ├── options.html
│   └── styles/
│       ├── app.css
│       └── partials/
├── onboarding/
├── _locales/
├── qa/
│   └── fixtures/
├── scripts/
│   ├── build.mjs
│   ├── qa-smoke.mjs
│   └── qa-smoke/
├── manifest.json
├── dist/
├── README.md
├── FEATURE_ROADMAP.md
└── CLAUDE.md
```

핵심 포인트:

- `src/*/main.ts`는 얇은 엔트리포인트다.
- 실제 런타임 책임은 `background/commands`, `background/popup`, `options/features`, `popup/features`처럼 기능 기준으로 나뉜다.
- 스타일도 `popup/styles/partials`, `options/styles/partials`로 쪼개져 있다.
- `src/config/sites.ts`는 하위 호환 re-export 역할만 한다.

---

## 3. 소스 → 빌드 매핑

| 소스 파일 | 빌드 출력 |
|---|---|
| `src/background/main.ts` | `dist/background/service_worker.js` |
| `src/popup/main.ts` | `dist/popup/popup.js` |
| `src/options/main.ts` | `dist/options/options.js` |
| `src/content/injector/main.ts` | `dist/content/injector.js` |
| `src/content/palette/main.ts` | `dist/content/palette.js` |
| `src/content/selector-checker/main.ts` | `dist/content/selector_checker.js` |
| `src/content/selection/main.ts` | `dist/content/selection.js` |
| `src/onboarding/main.ts` | `dist/onboarding/onboarding.js` |

루트의 `background/service_worker.js`, `popup/popup.js`, `options/options.js`, `content/*.js`는 모두 generated mirror이며, 수동 편집 대상이 아니다.

---

## 4. 주요 모듈 책임

### 4.1 Background

메인 조립 파일:

- `src/background/app/bootstrap.ts`

세부 기능:

- `src/background/messages/router.ts`
  - runtime message action 라우팅
  - 내부 extension page / content script sender만 허용
- `src/background/popup/favorites-workflow.ts`
  - 즐겨찾기 실행
  - chain step 순차 실행
  - schedule alarm reconcile / firing 처리
  - popup 준비 context(`url/title/selection/clipboard`) 병합
  - favorite run job / failure history / popup fallback 정리
  - popup handoff intent 저장
- `src/background/popup/launcher.ts`
  - toolbar popup 재오픈
  - active browser window 부재 시 standalone popup fallback
- `src/background/commands/quick-palette.ts`
  - `Alt+Shift+F` command 처리
  - 현재 탭에 palette bundle 주입
- `src/background/context-menu/index.ts`
  - 우클릭 메뉴 생성/갱신/실행
- `src/background/selection/runtime.ts`
  - 활성 탭 컨텍스트, 선택 텍스트 조회
- `src/background/app/injection-helpers.ts`
  - wait multiplier
  - selector/result normalization
  - adaptive strategy order 계산
- `src/shared/chrome/messaging.ts`
  - popup/options/content의 timeout-safe runtime message helper

### 4.2 Popup

메인 조립 파일:

- `src/popup/app/bootstrap.ts`

세부 기능:

- `src/popup/app/dom.ts`
  - DOM registry
- `src/popup/app/helpers.ts`, `sorting.ts`, `list-markup.ts`
  - pure formatting / markup
- `src/popup/features/favorite-editor.ts`
  - 즐겨찾기 통합 편집기
  - single/chain mode 전환
  - chain step 추가/삭제/순서 이동
  - schedule fields 편집
  - favorite `Run now` / `Edit`

### 4.3 Options

메인 조립 파일:

- `src/options/app/bootstrap.ts`

세부 기능:

- `src/options/core/data.ts`
  - 공통 데이터 로드/리로드
- `src/options/core/navigation.ts`
  - 섹션 이동
- `src/options/core/status.ts`
  - status/toast
- `src/options/core/service-filter.ts`
  - history service filter option 동기화
- `src/options/features/dashboard.ts`
  - 메트릭 카드/차트 데이터
- `src/options/features/dashboard-metrics.ts`
  - heatmap / service trend / failure reason / strategy summary 집계
- `src/options/features/history.ts`
  - 히스토리 필터, 페이지네이션, bulk delete, 상세 모달
- `src/options/features/schedules.ts`
  - 예약 즐겨찾기 목록, toggle, run-now, popup editor handoff
- `src/options/features/schedule-summary.ts`
  - 최근 scheduled 실행 결과 요약 계산
- `src/options/features/services.ts`
  - 서비스 카드, `waitMs`, `siteOrder` 편집
- `src/options/features/settings.ts`
  - import/export/reset/shortcut 표시
- `src/options/ui/charts.ts`
  - 차트 렌더링

### 4.4 Content Scripts

- `src/content/injector/`
  - 실제 입력/제출 파이프라인
- `src/content/selector-checker/`
  - 셀렉터/인증 페이지 상태 보고
- `src/content/selection/`
  - 현재 페이지 선택 텍스트 추적
- `src/content/palette/main.ts`
  - shadow root 기반 quick palette overlay

---

## 5. 데이터 모델 핵심

### 5.1 AppSettings

```ts
interface AppSettings {
  historyLimit: number; // default visible history cap, not destructive retention
  autoClosePopup: boolean;
  desktopNotifications: boolean;
  reuseExistingTabs: boolean;
  waitMsMultiplier: number;
  historySort: "latest" | "oldest" | "mostSuccess" | "mostFailure";
  favoriteSort: "recentUsed" | "usageCount" | "title" | "createdAt";
  siteOrder: string[];
}
```

### 5.2 FavoritePrompt

```ts
interface FavoritePrompt {
  id: string;
  title: string;
  text: string;
  sentTo: string[];
  templateDefaults: Record<string, string>;
  tags: string[];
  folder: string;
  pinned: boolean;
  usageCount: number;
  lastUsedAt: string | null;
  mode: "single" | "chain";
  steps: ChainStep[];
  scheduleEnabled: boolean;
  scheduledAt: string | null;
  scheduleRepeat: "none" | "daily" | "weekday" | "weekly";
}
```

### 5.3 PromptHistoryItem

```ts
interface PromptHistoryItem {
  id: number;
  text: string;
  requestedSiteIds: string[];
  submittedSiteIds: string[];
  failedSiteIds: string[];
  sentTo: string[];
  siteResults: Record<string, SiteInjectionResult>;
  originFavoriteId?: string | null;
  chainRunId?: string | null;
  chainStepIndex?: number | null;
  chainStepCount?: number | null;
  trigger?: "popup" | "scheduled" | "palette" | "options";
}
```

### 5.4 SiteInjectionResult

```ts
type InjectionResultCode =
  | "submitted"
  | "selector_timeout"
  | "auth_required"
  | "submit_failed"
  | "strategy_exhausted"
  | "permission_denied"
  | "tab_create_failed"
  | "tab_closed"
  | "injection_timeout"
  | "cancelled"
  | "unexpected_error";
```

구조:

```ts
interface SiteInjectionResult {
  code: InjectionResultCode;
  message?: string;
  strategy?: string;
  elapsedMs?: number;
  attempts?: Array<{ name: string; success: boolean }>;
}
```

---

## 6. 저장소와 마이그레이션

로컬 스토리지 주요 키:

- `promptHistory`
- `promptFavorites`
- `templateVariableCache`
- `appSettings`
- `broadcastCounter`
- `composeDraftPrompt`
- `lastSentPrompt`
- `failedSelectors`
- `onboardingCompleted`
- `strategyStats`
- `appSettings.siteOrder` (inside `appSettings`)

세션 스토리지 주요 키:

- `pendingInjections`
- `pendingBroadcasts`
- `selectorAlerts`
- `lastBroadcast`
- `pendingUiToasts`
- `popupPromptIntent`
- `popupFavoriteIntent`
- `favoriteRunJobs`

JSON export/import:

- 현재 export version: `6`
- 지원 migration: `v1 -> v2 -> v3 -> v4 -> v5 -> v6`
- `v6`에서 backfill 되는 대표 항목:
  - favorite `mode`
  - `steps`
  - `scheduleEnabled`
  - `scheduledAt`
  - `scheduleRepeat`
  - history chain metadata
  - history `targetSnapshots`

---

## 7. 방송 실행 흐름

### 7.1 일반 popup 방송

```text
Popup 입력
  ↓
템플릿 변수 탐지/해석
  ↓
site별 resolvedPrompt 생성
  ↓
background로 broadcast 요청
  ↓
탭 결정 (재사용 / 새 탭 / 특정 탭)
  ↓
content/injector.js 주입
  ↓
입력 + submit
  ↓
siteResults / history / lastBroadcast 업데이트
```

### 7.2 즐겨찾기 실행

- popup `Run now`
- options `Run now`
- quick palette
- `chrome.alarms`

모두 background의 동일 favorite 실행 엔트리포인트를 사용한다. popup 경유 실행은 background에 넘기기 전에 `url/title/selection/clipboard`를 먼저 준비해 함께 전달한다.

### 7.3 Chain favorite

- step을 순서대로 실행
- 각 step 전 `delayMs` 적용 가능
- step별 `targetSiteIds`가 비어 있으면 favorite 기본 `sentTo`를 상속하고, 값이 있으면 그것으로 override
- 어떤 step이든 결과가 `submitted`가 아니면 즉시 중단
- dedupe는 같은 favorite의 `queued/running` 겹침만 막고, 완료/실패 직후 재실행은 허용

### 7.4 Scheduled favorite

- schedule source of truth는 `FavoritePrompt`
- background가 startup/install/favorite update/import 이후 alarm reconcile
- `none` 반복은 1회 실행 후 disable
- `daily`, `weekday`, `weekly`는 다음 `scheduledAt` 갱신 후 재등록
- `url/title/selection/clipboard`가 필요한 템플릿은 schedule 실행 시 block
- options `Schedules`는 manual run과 분리된 최근 scheduled 실행 시각/상태/대표 실패 상세를 별도로 노출

### 7.5 Quick palette

- manifest command: `quick-palette`
- 기본 단축키: `Alt+Shift+F`
- background가 injectable tab이면 `content/palette.js`를 주입
- overlay는 favorites만 검색
- fully resolvable favorite면 즉시 실행
- popup이 자동으로 해결 가능한 입력만 부족하면 popup fallback 후 자동 재실행
- user variable 같은 수동 입력이 남아 있으면 favorite editor로 handoff

### 7.6 서비스 순서와 Dashboard 운영성

- `appSettings.siteOrder`는 runtime site 전체 순서를 저장하고 popup compose 서비스 카드, favorite editor 대상 체크리스트, options 서비스 목록에 동일 적용된다.
- options `Services`는 drag-and-drop 대신 `Move up` / `Move down`으로 접근성 있는 순서 편집을 제공한다.
- options `Dashboard`는 기본 overview 카드 외에 요일×시간대 heatmap, 서비스 성공률 추이, 상위 실패 원인, `strategyStats` 요약을 함께 렌더링한다.

---

## 8. 주입 파이프라인

```text
1. auth page 여부 확인
2. input selector 탐색 (primary -> fallback)
3. visible/enabled prompt surface 우선 선택
4. input strategy 시도
5. submit wait/poll 후 실행
6. structured result 반환
```

핵심 구현 포인트:

- `textarea`, `input`, `contenteditable` 지원
- `click`, `enter`, `shift+enter` 제출 지원
- Claude/Gemini는 언어 비의존 textbox/contenteditable 계열 fallback 우선 강화
- Perplexity는 Lexical editor 특수 경로 유지
- submit 실패 시 1회 재시도
- adaptive strategy stats 저장

---

## 9. UI 구조 요약

### Popup

탭:

1. Compose
2. History
3. Favorites
4. Settings

주요 UX:

- `Ctrl/Cmd+Enter` 전송
- `Ctrl/Cmd+Shift+Enter` 취소
- `Ctrl/Cmd+1..4` 탭 전환
- `Esc` 모달/메뉴 닫기
- history/favorites roving focus
- resend service-picker modal
- import report modal
- 통합 favorite editor

### Options

섹션:

1. Dashboard
2. History
3. Schedules
4. Services
5. Settings

주요 UX:

- history checkbox bulk delete
- 현재 필터 결과 전체 삭제
- `7/30/90일 이전 삭제`
- schedules toggle / run now / open in popup
- schedules last scheduled result summary
- service `waitMs` 편집
- service ordering (`Move up` / `Move down`)
- shortcut 목록 표시

---

## 10. 테스트 체계

### 자동 검증

```bash
npm run typecheck
npm run build
npm run qa:smoke
```

### smoke coverage 핵심

- selector injection / fallback
- delayed submit enablement
- `click` / `enter` / `shift+enter`
- selector checker `ok` / `auth_page`
- router trusted sender / runtime messaging timeout fallback
- custom service permission cleanup
- invalid built-in override import repair
- `broadcastCounter` export/import/reset
- export `version: 6` migration
- `siteOrder` normalization / ordering reuse
- favorite chain/schedule field backfill
- favorite run job dedupe / chain target fallback / counter serialization
- prepared clipboard context / pre-broadcast failure history
- scheduled summary isolation from manual run
- quick palette filtering 및 실행
- favorites search
- structured `siteResults`
- strategy stats accumulation
- dashboard metrics aggregation
- reusable-tab preflight
- reset helper cleanup

---

## 11. 현재 구현 완료 상태

### 핵심 방송

- [x] 다중 AI 서비스 동시 방송
- [x] 재사용 탭 / 새 탭 / 특정 탭 지정
- [x] 취소 시 새로 연 탭만 닫고 재사용 탭은 유지
- [x] reusable-tab preflight

### 즐겨찾기/템플릿

- [x] 시스템 템플릿 변수 9개
- [x] 사용자 변수 입력 모달
- [x] per-service prompt override
- [x] favorite tags / folder / pin / duplicate / sort
- [x] chain favorite
- [x] scheduled favorite
- [x] options schedules surface
- [x] quick palette

### 데이터/운영성

- [x] 구조화된 `siteResults`
- [x] adaptive strategy stats
- [x] timeout-safe runtime messaging helper
- [x] router sender trust boundary
- [x] import/export `v6`
- [x] 상세 import 리포트
- [x] background mutation chain
- [x] `siteOrder` 기반 서비스 순서 커스터마이징
- [x] dashboard heatmap / trend / failure / strategy summary
- [x] reset-data 일원화

### UI/문서화/리팩터링

- [x] popup/options 기능 기준 모듈 분리
- [x] CSS partial 분리
- [x] qa smoke helper 분리
- [x] 다크 모드/접근성 보강
- [x] 한영 로케일

---

## 12. 남은 로드맵 요약

현재 `FEATURE_ROADMAP.md` 기준 남은 큰 범주는 다음이다.

| 우선순위 | 기능 | 메모 |
|---|---|---|
| 2순위 | 고급 통계 확장 | prompt-length 분포 / keyword 분석은 아직 미구현 |
| 2순위 | 신규 내장 AI 서비스 | Copilot / Mistral / DeepSeek / HuggingChat 후보 |
| 보류 | 다국어 확장 | `ja`, `zh_CN` 미구현 |

---

## 13. 수정 포인트 빠른 가이드

| 목적 | 우선 확인 파일 |
|---|---|
| built-in 사이트 추가 | `src/config/sites/builtins.ts`, `manifest.json` |
| background 메시지/라우팅 수정 | `src/background/messages/router.ts`, `src/background/app/bootstrap.ts` |
| favorite 실행/예약/체인 수정 | `src/background/popup/favorites-workflow.ts`, `src/popup/features/favorite-editor.ts` |
| quick palette 수정 | `src/background/commands/quick-palette.ts`, `src/content/palette/main.ts` |
| popup UI 수정 | `src/popup/app/bootstrap.ts`, `src/popup/app/*`, `popup/popup.html`, `popup/styles/partials/*` |
| options UI 수정 | `src/options/app/bootstrap.ts`, `src/options/features/*`, `options/options.html`, `options/styles/partials/*` |
| 템플릿 변수 수정 | `src/shared/template/` |
| 타입 수정 | `src/shared/types/models.ts`, `src/shared/types/messages.ts` |
| import/export 수정 | `src/shared/prompts/import-export.ts` |
| smoke 테스트 수정 | `scripts/qa-smoke.mjs`, `scripts/qa-smoke/*` |

---

## 14. 결론

이 프로젝트는 이제 단순한 "멀티 전송 확장"을 넘어, 다음 특성을 가진 상태다.

- popup 중심 즉시 전송 도구
- favorite 기반 자동화 도구
- background 주도 예약/체인 실행 도구
- quick palette를 통한 page-local 실행 도구
- import/export와 runtime-state가 정리된 MV3 확장

즉, 현재의 핵심 과제는 기능 추가 자체보다도 남은 운영성 고도화와 신규 서비스 확대에 가깝다.
