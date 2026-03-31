# AI Prompt Broadcaster - 프로젝트 구조 분석

> 기준일: 2026-03-31
> 최종 업데이트: 2026-03-31 (6개 기능 구현 반영)
> 분석 범위: 전체 소스코드, 빌드 시스템, 데이터 흐름, UI 구조

---

## 1. 프로젝트 개요

Chrome Manifest V3 기반 확장 프로그램. 프롬프트 하나를 ChatGPT, Gemini, Claude, Grok, Perplexity 등 여러 AI 서비스에 동시에 전송한다. 백엔드/API 키 불필요 — `chrome.scripting.executeScript`로 각 서비스의 DOM에 직접 주입.

**핵심 특징:**
- 완전 클라이언트사이드 (서버 없음)
- TypeScript + esbuild 빌드
- 한국어/영어 이중 지원 (기본 로케일: 한국어)
- 커스텀 AI 서비스 추가 가능
- 히스토리·즐겨찾기·템플릿 변수·분석 대시보드 내장
- 즐겨찾기 태그·폴더·핀 시스템
- 서비스별 프롬프트 오버라이드
- 확장 시스템 템플릿 변수 9개 (url, title, selection, counter, random 신규 포함)
- 셀렉터 오류 GitHub 신고 버튼
- 옵션 페이지 히스토리 상세 결과 비교 뷰

---

## 2. 디렉터리 구조

```
prompt-broadcaster/
├── src/                          # TypeScript 소스 (수정은 여기서)
│   ├── background/
│   │   └── main.ts               # 서비스 워커 (오케스트레이션 핵심)
│   ├── config/
│   │   └── sites.ts              # 내장 AI 서비스 정의
│   ├── content/
│   │   ├── injector/             # DOM 주입 로직
│   │   │   ├── main.ts           # 주입 오케스트레이션
│   │   │   ├── dom.ts            # DOM 유틸리티
│   │   │   ├── fallback.ts       # 클립보드 폴백
│   │   │   ├── selectors.ts      # 셀렉터 탐색
│   │   │   ├── strategies.ts     # 텍스트 주입 전략
│   │   │   └── submit.ts         # 제출 실행
│   │   ├── selector-checker/     # 셀렉터 유효성 검사 (지원 페이지에서 실행)
│   │   └── selection/            # 사용자 선택 텍스트 캡처
│   ├── onboarding/
│   │   └── main.ts               # 최초 실행 온보딩
│   ├── options/
│   │   ├── main.ts               # 대시보드 & 설정 페이지
│   │   └── ui/
│   │       └── charts.ts         # 차트 렌더링
│   ├── popup/
│   │   ├── main.ts               # 팝업 UI (메인 인터페이스)
│   │   └── ui/
│   │       └── toast.ts          # 토스트 알림
│   └── shared/
│       ├── chrome/               # Chrome API 래퍼
│       ├── i18n/
│       │   └── messages.ts       # i18n 헬퍼
│       ├── stores/
│       │   ├── sites-store.ts    # 사이트 레지스트리 (내장+커스텀 병합)
│       │   ├── prompt-store.ts   # 히스토리·즐겨찾기·설정 영속화
│       │   └── runtime-state.ts  # 세션 상태 (방송 상태, 토스트)
│       ├── security.ts           # URL 검증
│       ├── template-utils.ts     # 템플릿 변수 감지·렌더링
│       └── types/
│           ├── models.ts         # 핵심 TypeScript 인터페이스
│           └── messages.ts       # 런타임 메시지 타입
│
├── popup/
│   ├── popup.html                # 팝업 마크업
│   └── styles/
│       └── app.css               # 팝업 스타일
│
├── options/
│   ├── options.html              # 대시보드 마크업
│   └── styles/
│       └── app.css               # 대시보드 스타일
│
├── onboarding/
│   └── onboarding.html
│
├── _locales/
│   ├── en/messages.json          # 영어 문자열
│   └── ko/messages.json          # 한국어 문자열
│
├── icons/                        # 확장 프로그램 아이콘
├── qa/
│   └── fixtures/                 # Playwright 로컬 테스트 픽스처
├── scripts/
│   ├── build.mjs                 # esbuild 빌드 설정
│   └── qa-smoke.mjs              # 스모크 테스트
│
├── dist/                         # 빌드 출력 (편집 금지)
├── manifest.json                 # 확장 매니페스트
├── package.json
├── tsconfig.json
├── CLAUDE.md                     # AI 어시스턴트 작업 가이드
└── README.md
```

---

## 3. 소스 → 빌드 매핑

| 소스 파일 | 빌드 출력 |
|---|---|
| `src/background/main.ts` | `dist/background/service_worker.js` |
| `src/popup/main.ts` | `dist/popup/popup.js` |
| `src/options/main.ts` | `dist/options/options.js` |
| `src/content/injector/main.ts` | `dist/content/injector.js` |
| `src/content/selector-checker/main.ts` | `dist/content/selector_checker.js` |
| `src/content/selection/main.ts` | `dist/content/selection.js` |
| `src/onboarding/main.ts` | `dist/onboarding/onboarding.js` |
| `popup/styles/app.css` | `dist/popup/styles/app.css` |
| `options/styles/app.css` | `dist/options/styles/app.css` |

---

## 4. 핵심 모듈 상세

### 4.1 사이트 설정 (`src/config/sites.ts`)

내장 4개 서비스 정의 (셀렉터 검증: 2026-03 기준):

| 서비스 | URL | 입력 타입 | 대기시간 |
|---|---|---|---|
| ChatGPT | `chatgpt.com` | contenteditable | 2000ms |
| Gemini | `gemini.google.com` | contenteditable | 2500ms |
| Claude | `claude.ai` | contenteditable | 1500ms |
| Grok | `grok.com` | contenteditable | 2000ms |

각 서비스 구조:
```typescript
{
  inputSelector: string        // 주 입력 셀렉터
  fallbackSelectors: string[]  // 폴백 셀렉터 목록
  authSelectors: string[]      // 로그인 페이지 감지용
  submitSelector: string       // 제출 버튼 셀렉터
  submitMethod: "click" | "enter" | "shift+enter"
  waitMs: number               // 주입 후 대기
  lastVerified: string         // 마지막 검증 날짜
}
```

### 4.2 사이트 스토어 (`src/shared/stores/sites-store.ts`)

3계층 병합으로 런타임 사이트 목록 생성:
1. **내장 사이트** (불변 기본값)
2. **내장 오버라이드** (사용자가 수정한 내장 셀렉터)
3. **커스텀 사이트** (사용자 추가 서비스)

런타임 사이트 (`RuntimeSite`) 추가 필드:
- `enabled` — 활성화 여부
- `color`, `icon` — 사용자 지정 표시
- `isBuiltIn`, `isCustom`, `deletable`, `editable` — 관리 플래그
- `permissionPattern` — 선택적 호스트 권한 요청용

### 4.3 프롬프트 스토어 (`src/shared/stores/prompt-store.ts`)

| 데이터 | 스토리지 키 | 구조 |
|---|---|---|
| 히스토리 | `promptHistory` | `PromptHistoryItem[]` |
| 즐겨찾기 | `promptFavorites` | `FavoritePrompt[]` |
| 앱 설정 | `appSettings` | `AppSettings` |
| 템플릿 캐시 | `templateVariableCache` | `Record<string, string>` |

**히스토리 아이템 주요 필드:**
```typescript
{
  id: number
  text: string
  requestedSiteIds: string[]   // 사용자가 선택한 대상 (재전송 시 사용)
  submittedSiteIds: string[]   // 실제 주입 성공한 서비스
  failedSiteIds: string[]      // 실패한 서비스
  sentTo: string[]             // deprecated, submittedSiteIds 미러
  siteResults: Record<string, string>
  status: string
  createdAt: string
}
```

**앱 설정:**
```typescript
{
  historyLimit: number        // 10-200, 기본 50
  autoClosePopup: boolean
  desktopNotifications: boolean
  reuseExistingTabs: boolean
}
```

### 4.4 런타임 상태 (`src/shared/stores/runtime-state.ts`)

`chrome.storage.session`에 저장 (세션 범위):
- `lastBroadcast` — 현재/최근 방송 진행 상황
- `pendingUiToasts` — 표시 대기 중인 알림 큐
- `failedSelectors` — 서비스별 셀렉터 실패 기록

### 4.5 템플릿 유틸 (`src/shared/template-utils.ts`)

**시스템 변수** (자동 치환):
- `{{date}}` / `{{날짜}}` → YYYY-MM-DD
- `{{time}}` / `{{시간}}` → HH:MM
- `{{weekday}}` / `{{요일}}` → 요일명
- `{{clipboard}}` / `{{클립보드}}` → 클립보드 내용

**사용자 변수** — `{{임의이름}}` 형태면 팝업에서 입력 모달 표시

---

## 5. 주요 데이터 흐름

### 방송 흐름
```
사용자 → 팝업 열기
  ↓
팝업: 현재 창의 열린 AI 탭 검색
  ↓
사용자: 프롬프트 작성 + 서비스 선택
  ↓ (템플릿 변수 있으면 모달)
팝업 → background: BroadcastMessage 전송
  ↓
background: 탭 결정 (재사용/새탭/지정탭)
background: 대기열에 추가, 순차 처리
  ↓
background → 탭: content/injector.js 주입
  ↓
injector: 셀렉터 탐색 (주→폴백 순서)
injector: 텍스트 주입
injector: 제출 버튼 활성화 대기 → 클릭/키보드 제출
  ↓
injector → background: 결과 보고
background: lastBroadcast 업데이트
  ↓
팝업: 상태 아이콘 갱신
히스토리 항목 저장
```

### 메시지 프로토콜

**팝업 → 백그라운드:**
```typescript
{
  action: "broadcast",
  prompt: string,
  sites: Array<{
    id?: string,
    tabId?: number,
    reuseExistingTab?: boolean,
    openInNewTab?: boolean
  }>
}
```

**콘텐츠 스크립트 → 백그라운드:**
- `selector-check:report` — 셀렉터 검증 결과
- `injectSuccess` — 주입 성공
- `injectFallback` — 실패 (클립보드에 복사됨)
- `selectorFailed` — 셀렉터 없음
- `selection:update` — 선택 텍스트 변경

---

## 6. 팝업 UI 구조

**탭 구성:**
1. **작성 (Compose)** — 프롬프트 입력, 서비스 선택, 전송
2. **히스토리** — 전송 기록 검색·관리·재전송
3. **즐겨찾기** — 제목 붙은 템플릿 저장·관리
4. **설정** — 탭 재사용, 내보내기, 커스텀 서비스 관리

**주요 모달:**
- **템플릿 모달** — 시스템 변수 미리보기 + 사용자 변수 입력
- **서비스 편집 모달** — 커스텀 서비스 추가/편집 (셀렉터, URL, 색상 등)

**탭 타겟팅 옵션:**
- 기본 라우팅 (설정에 따라)
- 새 탭 강제
- 특정 열린 탭 지정

---

## 7. 콘텐츠 주입 파이프라인

```
1. 인증 페이지 감지 (authSelectors)
       ↓
2. 셀렉터 탐색
   주 셀렉터 → 폴백 셀렉터 1 → 폴백 셀렉터 2 → ...
   (숨겨진 요소보다 보이는 요소 우선)
       ↓
3. 텍스트 주입 전략 시도 (순서대로)
   contenteditable: execCommand → DOM 조작 → paste 이벤트
   textarea/input: native setter → paste 이벤트
       ↓
4. 제출 실행
   click: 버튼 활성화될 때까지 폴링 → 클릭
   keyboard: 포커스 → 키 이벤트 dispatch
       ↓
5. 결과 보고 → 백그라운드
```

**폴백:** 주입 실패 시 클립보드에 복사 + 배너 표시

---

## 8. 옵션 페이지 구조

1. **대시보드** — 서비스별 사용량 도넛 차트, 7일 활동 막대 차트, 지표 카드
2. **히스토리** — 페이지네이션 테이블, 서비스/날짜 필터, CSV 내보내기
3. **서비스** — 검사 그리드 (사용 횟수, 성공률, 마지막 검증일)
4. **설정** — 히스토리 보존 한도, 자동 닫기, 알림, 탭 재사용, 단축키 안내, 데이터 관리

---

## 9. 권한 및 보안

**manifest.json 권한:**
- `activeTab`, `tabs`, `scripting`, `storage`
- `notifications`, `contextMenus`, `alarms`
- `clipboardWrite` (기본), `clipboardRead` (선택적)
- 호스트 권한: chatgpt.com, gemini.google.com, claude.ai, grok.com

**보안 조치:**
- `src/shared/security.ts` — URL 검증 (http/https만 허용)
- 매니페스트 CSP — unsafe-eval 금지
- 클립보드 읽기는 명시적 권한 후 허용
- 입력 셀렉터·텍스트 정규화 처리

---

## 10. 테스트

**스모크 QA (`qa/` + `scripts/qa-smoke.mjs`):**
- Playwright로 로컬 픽스처 대상 실행
- 테스트 항목:
  - textarea / contenteditable 주입
  - 폴백 셀렉터 동작
  - 지연 제출 버튼 활성화
  - click / enter / shift+enter 제출 방식
  - 셀렉터 체커 `ok` / `auth_page` 보고

```bash
npx playwright install chromium
npm run qa:smoke
```

---

## 11. i18n 구조

- 기본 로케일: `ko` (한국어)
- 키 네이밍: `section_component_detail` 패턴
- 매니페스트: `__MSG_key__` 플레이스홀더
- UI 요소: `data-i18n="key"` 속성
- 런타임: `chrome.i18n.getMessage(key, substitutions)`

---

## 12. 핵심 타입 요약

```typescript
// 입력 타입
type InputType = "textarea" | "contenteditable" | "input";
type SubmitMethod = "click" | "enter" | "shift+enter";

// 사이트 설정 (내장 정의)
interface SiteConfig { ... }

// 런타임 사이트 (병합 결과)
interface RuntimeSite extends SiteConfig {
  enabled: boolean;
  color: string;
  icon: string;
  isBuiltIn: boolean;
  isCustom: boolean;
  deletable: boolean;
  editable: boolean;
  permissionPattern: string;
}

// 히스토리 항목
interface PromptHistoryItem {
  id: number;
  text: string;
  requestedSiteIds: string[];   // 재전송 시 이것을 사용
  submittedSiteIds: string[];
  failedSiteIds: string[];
  sentTo: string[];             // legacy, submittedSiteIds 미러
  ...
}

// 즐겨찾기
interface FavoritePrompt {
  id: string;
  title: string;
  text: string;
  templateDefaults: Record<string, string>;
  ...
}

// 현재 방송 상태
interface LastBroadcastSummary {
  broadcastId: string;
  status: string;
  total: number;
  completed: number;
  submittedSiteIds: string[];
  failedSiteIds: string[];
  siteResults: Record<string, string>;
  ...
}
```

---

## 13. 빌드 시스템

**도구:** esbuild (번들링), TypeScript (타입 검사)

**엔트리포인트:**
- background, popup, options, injector, selector-checker, selection, onboarding

**주요 명령:**
```bash
npm install                          # 의존성 설치
npm run build                        # dist/ 컴파일
npm run rebuild                      # 클린 + 빌드
npm run typecheck                    # 타입 검사 (emit 없음)
npm run qa:smoke                     # 스모크 테스트
powershell -ExecutionPolicy Bypass -File .\package.ps1   # 릴리즈 zip (Windows)
bash ./package.sh                    # 릴리즈 zip (macOS/Linux)
```

> **주의:** 소스 수정 후 반드시 `npm run build` 실행 후 Chrome에서 테스트

---

## 14. 새 기능 추가 시 참고 포인트

| 목적 | 수정 파일 |
|---|---|
| 새 AI 서비스 추가 | `src/config/sites.ts` + `manifest.json` |
| 팝업 UI 변경 | `src/popup/main.ts` + `popup/popup.html` + `popup/styles/app.css` |
| 옵션 페이지 변경 | `src/options/main.ts` + `options/options.html` |
| 주입 로직 변경 | `src/content/injector/` 하위 파일 |
| 템플릿 변수 추가 | `src/shared/template-utils.ts` |
| 설정 항목 추가 | `src/shared/stores/prompt-store.ts` |
| 새 문자열 추가 | `_locales/en/messages.json` + `_locales/ko/messages.json` |
| 타입 정의 변경 | `src/shared/types/models.ts` |
| 백그라운드 로직 | `src/background/main.ts` |

---

## 15. 현재 구현된 기능 목록

- [x] 다중 AI 서비스 동시 방송 (ChatGPT, Gemini, Claude, Grok)
- [x] 탭 재사용 / 새 탭 / 특정 탭 지정
- [x] 템플릿 변수 (시스템 + 사용자 정의)
- [x] 한국어/영어 이중 언어
- [x] 강건한 DOM 주입 (textarea, contenteditable, input)
- [x] 클립보드 폴백
- [x] 셀렉터 자가 진단
- [x] 커스텀 서비스 추가
- [x] 히스토리 & 즐겨찾기
- [x] JSON 내보내기/가져오기
- [x] 분석 대시보드 (차트 포함)
- [x] 데스크탑 알림
- [x] 우클릭 컨텍스트 메뉴
- [x] 키보드 단축키 (Alt+Shift+P, Alt+Shift+S)
- [x] 온보딩 페이지
