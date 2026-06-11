# Project Audit

## 1. Executive Summary

현재 전체 위험도는 **Low-Medium**입니다. 기존 감사에서 확인된 저장 quota, runtime sender policy, pending injection 복구, selector/docs drift 리스크는 구현과 검증으로 대부분 해소되었습니다. 이후 코드 분할 리팩토링도 public entrypoint/facade 경로를 유지하면서 background, popup, options, shared 영역의 책임 경계를 하위 폴더로 분리했습니다.

완료된 핵심 사항:

- `promptHistory`: 최신순 저장 hard cap 1000개, quota 실패 시 500개 emergency retry
- `comparisonNotes`: `updatedAt` 최신순 저장 hard cap 2000개, quota 실패 시 1000개 emergency retry
- 자동 캡처 응답: 저장 전 20000자 truncate
- Runtime message: action별 sender policy 적용, mutation/reset/settings 계열은 extension sender 전용
- Pending injection: `status: "injecting"` + `startedAt` 기반 재시작 reconcile 적용
- Custom service selector: input/fallback/submit selector CSS 문법 검증 추가
- Docs/build parity: built-in selector mode, generated mirror drift, `PROJECT_ANALYSIS.md`, `PROJECT_AUDIT.md` consistency guard 보강
- `.gitignore`: local `.codegraph/` index 제외

검증 결과:

- `npm run typecheck`: 통과
- `npm run build`: 통과
- `npm run docs:check`: 통과
- `npm run qa:smoke`: 59/59 통과
- `npm run qa:extension`: 통과
- `git diff --check`: 통과

## 2. Project Understanding

이 프로젝트는 Chrome Manifest V3 확장으로, 백엔드/API 키 없이 사용자가 로그인한 AI 웹앱의 DOM 입력창에 프롬프트를 직접 주입합니다. `src/`가 TypeScript source of truth이고, `npm run build`가 `dist/`와 root generated mirror(`background/`, `popup/`, `options/`, `content/`)를 동기화합니다.

주요 흐름:

1. Popup composer가 prompt, 대상 서비스, per-service override, template variable을 resolve합니다.
2. Background runtime handler가 `broadcast` message를 받아 pending broadcast와 pending injection을 생성합니다.
3. Background가 탭 routing/reuse/preflight를 수행하고 content injector를 실행합니다.
4. Content injector가 selector 탐색, 입력, submit을 수행하고 구조화된 result code를 반환합니다.
5. Background가 history, last broadcast, favorite job, auto response capture, notification을 best-effort side effect로 처리합니다.

현재 구조 리팩토링 상태:

- `src/background/app/bootstrap.ts`는 facade이고 실제 wiring은 `src/background/app/bootstrap/app.ts`에 있습니다.
- Background singleton state와 공통 helper는 `bootstrap/context.ts`, `bootstrap/utils.ts`로 분리했습니다.
- Background feature helper는 `src/background/app/{comparison,experiments,injection}/`에 분리했습니다.
- Popup bootstrap app body, favorite filter/rendering, options experiments/services, options i18n, shared prompt normalizers는 facade-preserving 하위 폴더 구조로 분리했습니다.

## 3. High-Risk Issues

### 3.1 저장 데이터 증가와 quota 실패 복구

* 위치: `src/shared/prompts/history-store.ts`, `src/shared/prompts/advanced-store.ts`, `src/shared/prompts/storage.ts`
* 문제: 기존에는 history/comparison note 저장 cap이 없고 quota 계열 실패가 사용자에게 잘 보이지 않았습니다.
* 영향: 장기 사용 또는 자동 응답 캡처 누적으로 Chrome local storage quota를 넘으면 히스토리/비교 노트 저장이 조용히 실패할 수 있었습니다.
* 근거: 기존 저장 함수는 전체 배열을 그대로 `chrome.storage.local.set`에 저장했습니다.
* 권장 수정 방향: **구현 완료.** 저장 hard cap, quota-like error emergency retry, 최종 실패 toast, 자동 캡처 20000자 cap을 적용했습니다.
* 우선순위: High -> Implemented

### 3.2 service worker 재시작 시 pending injection 복구

* 위치: `src/shared/types/models.ts`, `src/background/session/store.ts`, `src/background/app/bootstrap/app.ts`
* 문제: 기존에는 실제 injection 전 `injected: true`로 저장된 작업이 service worker 재시작 후 timeout 전까지 재큐잉되지 않을 수 있었습니다.
* 영향: favorite chain/schedule이 broadcast completion을 기다리며 오래 지연될 수 있었습니다.
* 근거: 기존 reconcile이 `job.injected === true` 항목을 건너뛰었습니다.
* 권장 수정 방향: **구현 완료.** `PendingInjectionRecord.startedAt`을 추가했고, `status: "injecting"` 작업은 timeout 전이면 탭 상태 확인 후 재큐잉하며 오래된 injecting 작업은 즉시 timeout 정리합니다.
* 우선순위: Medium -> Implemented

### 3.3 runtime message sender 권한

* 위치: `src/background/messages/router.ts`, `src/background/runtime/handlers.ts`
* 문제: 기존 라우터는 content sender와 extension sender를 action별로 충분히 분리하지 않았습니다.
* 영향: 향후 content script 확장 시 저장/삭제성 action 노출 가능성이 있었습니다.
* 근거: mutation/reset/experiment/template/service-group action이 selector/injection report action과 같은 handler table에 있었습니다.
* 권장 수정 방향: **구현 완료.** `senderPolicy`를 추가해 content 허용 action을 selector/injection report, selection update, quick palette 계열로 제한했습니다.
* 우선순위: Medium -> Implemented

### 3.4 selector/docs/build parity

* 위치: `README.md`, `CLAUDE.md`, `PROJECT_ANALYSIS.md`, `docs/extension-architecture.md`, `scripts/check-docs.mjs`
* 문제: 코드 분할 이후 문서가 old module path를 유지하면 release/debug 기준이 어긋날 수 있었습니다.
* 영향: 새 구조에서 수정 지점을 잘못 찾거나 generated mirror 갱신 누락을 놓칠 수 있습니다.
* 근거: `src/background/app/bootstrap.ts`는 facade로 바뀌었고, options/popup/shared 기능이 하위 폴더로 분리되었습니다.
* 권장 수정 방향: **구현 완료.** 주요 Markdown 구조 설명과 docs check required snippets를 새 폴더 구조에 맞췄습니다.
* 우선순위: Medium -> Implemented

## 4. Potential Functional Gaps

* 잔여 리스크: 자동 응답 캡처는 여전히 서비스 DOM selector 기반입니다. 실제 서비스 UI 변화에 대한 fixture 확장이 필요합니다.
* 잔여 리스크: pending injection service worker restart 복구는 코드 경로와 smoke 간접 검증은 되었지만, 강제 worker restart 전용 E2E는 아직 없습니다.
* 잔여 리스크: `src/background/app/bootstrap/app.ts`는 여전히 가장 큰 wiring 파일입니다. 이번 리팩토링은 facade/context/feature helper 경계를 만든 1차 분할이며, broadcast/injection/comparison controller factory로 더 나누는 후속 작업 여지가 있습니다.

## 5. Recommended Fix Plan

### 1단계: 완료

1. 저장 hard cap, quota emergency retry, 저장 실패 toast.
2. runtime message action별 sender allowlist.
3. pending injection `startedAt`/`status` 기반 reconcile.
4. selector syntax validation과 docs/build mirror drift 검사.

### 2단계: 완료

1. public facade 유지형 코드 분할.
2. `README.md`, `CLAUDE.md`, `PROJECT_ANALYSIS.md`, `docs/extension-architecture.md`, `docs/build-guide.md` 구조 설명 갱신.
3. `.gitignore`에 local `.codegraph/` index 제외 추가 및 proof 확인.

### 3단계: 권장 후속

1. `src/background/app/bootstrap/app.ts`를 broadcast/injection/comparison/lifecycle controller factory로 추가 분할.
2. service worker restart 전용 E2E 추가.
3. 자동 응답 캡처 DOM fixture 확대.

## 6. Test Recommendations

이번 변경에서 확인된 테스트:

- `npm run typecheck`
- `npm run build`
- `npm run docs:check`
- `npm run qa:smoke`
- `npm run qa:extension`
- `git diff --check`

추가 권장 테스트:

- 실제 service worker restart 중 `status: "injecting"` pending job 재큐잉/timeout E2E
- 자동 응답 캡처 서비스별 DOM fixture: prompt echo, streaming 중간 상태, 복수 assistant candidate, 긴 응답
- custom service selector validation에서 browser `querySelector`가 잡는 고급 invalid selector 케이스
