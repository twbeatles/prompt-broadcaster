# AI Prompt Broadcaster - 기능 개선 로드맵

> 작성일: 2026-03-31
> 최종 업데이트: 2026-04-02 (심층 분석 섹션 구현 완료 + UI 모듈 분리 리팩토링 반영)
> 기준 코드: 현재 `src/` 분석 결과 기반

---

## 구현 완료 현황

| # | 기능 | 상태 | 완료일 |
|---|---|:---:|:---:|
| ④ | 템플릿 변수 확장 (5개 신규: url/title/selection/counter/random) | ✅ 완료 | 2026-03-31 |
| ⑫ | Perplexity 내장 서비스 추가 | ✅ 완료 | 2026-03-31 |
| ① | 즐겨찾기 태그·폴더·핀 시스템 | ✅ 완료 | 2026-03-31 |
| ⑤ | 서비스별 프롬프트 오버라이드 | ✅ 완료 | 2026-03-31 |
| ⑩ | 셀렉터 오류 신고 버튼 | ✅ 완료 | 2026-03-31 |
| ⑥ | 방송 결과 비교 뷰 (옵션 히스토리 상세) | ✅ 완료 | 2026-03-31 |

## 2026-04-01 운영성 개선 완료

- 커스텀 서비스 권한 모델을 `url + hostnameAliases` 기준 다중 origin으로 정리했고, 삭제/리셋/import 교체 시 unused optional host permission을 자동 회수하도록 반영함
- built-in override import에서 `click + empty submitSelector`를 원본 selector 유지로 보정하고, import validation을 강화함
- `broadcastCounter`를 export/import/reset 수명주기에 포함시키고, 실제 queued broadcast 기준으로만 증가하도록 정리함
- 즐겨찾기 검색 범위를 제목, 본문, 태그, 폴더까지 확장함
- 서비스별 프롬프트 오버라이드를 site-level `resolvedPrompt` 기준으로 정리했고, retry가 최초 해석된 프롬프트를 그대로 재사용하도록 보강함
- background가 `pendingBroadcasts`, `pendingInjections`, `selectorAlerts`를 메모리 캐시 + 직렬 mutation 체인으로 관리하도록 정리함
- reset flow를 background 주도로 바꿔 진행 중 broadcast cancel, local/session 상태 동시 초기화, badge/toast 정리까지 포함하도록 반영함
- 열린 AI 탭 재사용을 hostname-only가 아니라 auth/settings path, 입력 surface, submit preflight 기준까지 검사하도록 강화함
- CSV export에 formula injection 방어를 추가하고 shared/core 타입 경계를 단계적으로 복구함
- smoke QA를 20개 시나리오 기준으로 확장해 권한 정리, import 보정, counter, 검색, override/retry, reset, reusable-tab preflight 정합성을 자동 검증함
- 이후 심층 분석 섹션 구현에 맞춰 smoke QA를 21개 시나리오로 갱신했고, `v4` import/export, 구조화된 `siteResults`, 전략 통계, reset 정합성까지 자동 검증 범위를 넓힘

## 2026-04-02 심층 분석 섹션 구현 완료

- 다크 모드, 팝업 내부 단축키, tablist/tabpanel 접근성 정리, roving focus 탐색을 실제 코드에 반영함
- 히스토리/즐겨찾기 정렬, 즐겨찾기 복제, 히스토리 재전송 서비스 선택 모달, 옵션 히스토리 bulk 삭제를 구현함
- `AppSettings.waitMsMultiplier`, `historySort`, `favoriteSort`와 `FavoritePrompt.usageCount`, `lastUsedAt`를 추가함
- `siteResults`를 구조화된 `SiteInjectionResult`로 전환하고, import/export를 `version: 4` 단계형 마이그레이션 구조로 올림
- import 직후 popup/options 모두에서 상세 리포트 모달을 표시하고, 거부 서비스/권한 거부 origin/ID 재작성/built-in 보정을 노출함
- 취소 시 `openedTabIds`를 기준으로 새로 연 탭만 닫도록 보강했고, 재사용 탭은 보존함
- Claude/Gemini selector를 role/contenteditable 우선 경로로 보강했고, submit retry 1회와 adaptive strategy stats 저장을 추가함
- `src/popup/app/*`, `src/options/app/*`, `src/background/app/injection-helpers.ts`로 긴 bootstrap 책임을 일부 분리함

이번 구현에서 제외:
- 신규 내장 서비스 추가(Copilot/Mistral/DeepSeek 등)
- 예약 방송, 체인 모드, Quick Palette
- options에서 전략 통계 자체를 시각화하는 전용 UI

아래 심층 분석 섹션은 제안 당시 스냅샷을 보존한 설계 메모다. 완료된 항목도 일부 설명은 미래형 표현을 유지할 수 있으므로, 최신 동작과 실제 구조는 `README.md`, `CLAUDE.md`, `PROJECT_ANALYSIS.md`, `docs/extension-architecture.md`를 우선 기준으로 본다.

---

## 우선순위 매트릭스 (잔여 기능)

| # | 기능 | 임팩트 | 난이도 | 권장 순서 |
|---|---|:---:|:---:|:---:|
| ② | 방송 예약 (Scheduled Broadcast) | ★★★ | ★★★ | **3순위** |
| ⑨ | 딜레이/순서 커스터마이징 | ★★☆ | ★★☆ | **3순위** |
| ⑧ | 히스토리 통계 강화 | ★★☆ | ★★☆ | **3순위** |
| ③ | 프롬프트 체인 (Chain Mode) | ★★★ | ★★★ | **4순위** |
| ⑦ | 빠른 팔레트 (Quick Palette) | ★★★ | ★★★ | **4순위** |
| ⑪ | 다국어 확장 (일본어/중국어) | ★★☆ | ★☆☆ | **보류** |

---

## 1순위 — 빠르게 시작할 수 있는 고임팩트 기능

---

### ④ 시스템 템플릿 변수 확장

**현재 상태**
`template-utils.ts`에 시스템 변수 4개 고정: `{{date}}`, `{{time}}`, `{{weekday}}`, `{{clipboard}}`

**제안 내용**
아래 변수 추가로 프롬프트 표현력 대폭 향상

| 변수 | 한국어 별칭 | 설명 | 구현 방법 |
|---|---|---|---|
| `{{url}}` | `{{주소}}` | 현재 활성 탭 URL | 백그라운드에서 `chrome.tabs.query` |
| `{{title}}` | `{{제목}}` | 현재 탭 페이지 제목 | 백그라운드에서 `chrome.tabs.query` |
| `{{selection}}` | `{{선택}}` | 현재 선택된 텍스트 | 기존 `selection.js` 구조 활용 |
| `{{counter}}` | `{{카운터}}` | 자동 증가 카운터 | `chrome.storage.local`에 카운터 저장 |
| `{{random}}` | `{{랜덤}}` | 랜덤 숫자 (1~1000) | `Math.random()` |

**수정 파일**
- `src/shared/template/` — 변수 정의 및 별칭 추가
- `src/background/app/bootstrap.ts` — URL/title 조회 후 값 주입
- `_locales/en/messages.json`, `_locales/ko/messages.json` — 변수 설명 문자열

**구현 포인트**
```typescript
// template-utils.ts 확장 예시
export const SYSTEM_TEMPLATE_VARIABLES = Object.freeze({
  date: "date",
  time: "time",
  weekday: "weekday",
  clipboard: "clipboard",
  url: "url",        // 신규
  title: "title",    // 신규
  selection: "selection", // 신규
  counter: "counter",    // 신규
  random: "random",      // 신규
});
```

---

### ⑫ 신규 내장 AI 서비스 추가

**현재 상태**
ChatGPT, Gemini, Claude, Grok, Perplexity 5개 내장

Perplexity는 2026-03-31 기준 기본 내장 서비스로 반영 완료
- 유지보수 메모: Perplexity는 Lexical editor 기반이라 exact selector 우선순위, `MAIN` world 입력, 기존 submit 경로 유지가 현재 안정 조합
**추가 검토 서비스 목록**

| 서비스 | 도메인 | 비고 |
|---|---|---|
| Microsoft Copilot | `copilot.microsoft.com` | MS 생태계 사용자 |
| Mistral Le Chat | `chat.mistral.ai` | 유럽 AI |
| DeepSeek | `chat.deepseek.com` | 아시아권 인기 |
| HuggingChat | `huggingface.co/chat` | 오픈소스 사용자 |

**수정 파일**
- `src/config/sites/builtins.ts` — 서비스 정의 추가 (inputSelector, submitSelector 셀렉터 직접 검증 필요)
- `manifest.json` — `host_permissions` 및 `content_scripts.matches` 도메인 추가

**추가 시 체크리스트**
- [ ] 실제 DOM에서 inputSelector 검증
- [ ] submitSelector 검증 (click vs enter)
- [ ] authSelectors 확인 (로그인 페이지 감지)
- [ ] waitMs 적정값 측정
- [ ] lastVerified 날짜 기록

---

## 2순위 — 중간 난이도, 높은 가치

---

### ① 프롬프트 태그 & 폴더 시스템

**현재 상태**
`FavoritePrompt`에 `title`, `text`, `sentTo`만 있고 분류 기능 없음

**제안 내용**
즐겨찾기에 태그와 폴더 개념 추가, 팝업에서 필터 UI 제공

**데이터 구조 변경**
```typescript
interface FavoritePrompt {
  // 기존 필드 유지
  id: string;
  title: string;
  text: string;
  sentTo: string[];
  createdAt: string;
  favoritedAt: string;
  templateDefaults: Record<string, string>;

  // 신규 필드
  tags: string[];          // ["코딩", "번역", "요약"]
  folder: string;          // "업무/개발" (슬래시로 계층 표현)
  color?: string;          // 카드 색상 커스텀
  pinned?: boolean;        // 상단 고정
}
```

**UI 변경**
- 팝업 즐겨찾기 탭: 태그 칩 필터 + 폴더 트리 사이드바
- 즐겨찾기 편집 모달: 태그 입력 (쉼표 구분), 폴더 선택 드롭다운

**수정 파일**
- `src/shared/prompts/` — `buildFavoriteEntry` 필드 추가, 마이그레이션 처리
- `src/popup/app/bootstrap.ts` — 필터 UI 로직
- `popup/popup.html` — 태그 필터 마크업
- `popup/styles/app.css` — 태그 칩 스타일
- `_locales/` — 태그/폴더 관련 문자열

---

### ⑤ 서비스별 프롬프트 오버라이드

**현재 상태**
모든 선택 서비스에 동일한 프롬프트 전송

**제안 내용**
서비스 카드별로 다른 프롬프트를 입력할 수 있는 "고급 모드" 추가

**사용 시나리오**
- ChatGPT에는 영어로, Claude에는 한국어로 다른 내용 전송
- 서비스마다 역할 지정 프리픽스 자동 추가

**데이터 구조 변경**
```typescript
interface BroadcastTarget {
  id?: string;
  tabId?: number;
  reuseExistingTab?: boolean;
  openInNewTab?: boolean;
  promptOverride?: string;   // 신규: 없으면 기본 프롬프트 사용
}
```

**UI 변경**
- 서비스 카드에 "개별 설정" 토글 버튼 추가
- 토글 시 해당 서비스 전용 텍스트 영역 확장

**수정 파일**
- `src/popup/app/bootstrap.ts` — 오버라이드 입력 UI
- `src/background/app/bootstrap.ts` — 타겟별 프롬프트 분기 처리
- `src/shared/types/messages.ts` — `BroadcastTarget` 타입 수정

---

### ⑩ 셀렉터 오류 신고 & 빠른 수정 UI

**현재 상태**
셀렉터 실패 시 경고 배지만 표시, 수정하려면 설정 모달까지 들어가야 함

**제안 내용**
- 경고 배지 클릭 시 "셀렉터 오류 신고" 버튼 + GitHub Issues 링크 바로 제공
- 마지막 검증일(`lastVerified`) 기준 "N일 지남" 경고 텍스트 표시
- 팝업에서 인라인으로 셀렉터 직접 수정 (설정 모달 진입 없이)

**수정 파일**
- `src/popup/app/bootstrap.ts` — 경고 배지 클릭 핸들러 확장
- `popup/popup.html` — 인라인 수정 UI 마크업
- `popup/styles/app.css` — 경고 UI 스타일

---

## 3순위 — 중간 난이도, 생산성 향상

---

### ② 방송 예약 (Scheduled Broadcast)

**현재 상태**
즉시 전송만 가능. `chrome.alarms` 권한은 이미 `manifest.json`에 존재.

**제안 내용**
즐겨찾기 프롬프트에 예약 시간 설정, 백그라운드 알람으로 자동 방송

**데이터 구조 변경**
```typescript
interface FavoritePrompt {
  // ... 기존 필드

  // 예약 관련 신규 필드
  scheduledAt?: string;                              // ISO 날짜시간
  scheduleRepeat?: "none" | "daily" | "weekday" | "weekly";
  scheduleEnabled?: boolean;
}
```

**구현 흐름**
```
즐겨찾기 편집 → 예약 시간 설정
       ↓
chrome.alarms.create(`apb-schedule-${favoriteId}`, { when: timestamp })
       ↓
background: chrome.alarms.onAlarm 수신
       ↓
해당 즐겨찾기 불러와 방송 실행
       ↓
repeat이면 다음 알람 재등록
```

**수정 파일**
- `src/background/app/bootstrap.ts` — `onAlarm` 핸들러 추가, 예약 실행 로직
- `src/shared/prompts/` — 예약 필드 추가
- `src/popup/app/bootstrap.ts` / `src/options/app/bootstrap.ts` — 예약 설정 UI
- `_locales/` — 예약 관련 문자열

**주의사항**
- 서비스 워커는 일정 시간 후 종료될 수 있으므로 알람 기반 깨우기 필수
- 예약 방송 시 탭이 없으면 자동으로 새 탭 열기

---

### ⑨ 방송 딜레이 & 순서 커스터마이징

**현재 상태**
`waitMs`가 `sites.ts`에 고정값으로 정의, 방송 순서는 사이트 배열 순서 고정

**제안 내용**
- 설정 페이지에 전역 딜레이 배율 슬라이더 추가 (0.5x ~ 3.0x)
- 팝업에서 서비스 카드 드래그로 방송 순서 변경 가능

**데이터 구조 변경**
```typescript
interface AppSettings {
  // ... 기존 필드
  waitMsMultiplier: number;     // 신규: 0.5 ~ 3.0, 기본 1.0
  siteOrder: string[];          // 신규: 사이트 ID 순서 배열
}
```

**수정 파일**
- `src/shared/prompts/` — 설정 필드 추가
- `src/background/app/bootstrap.ts` — `waitMs` 계산 시 배율 적용
- `src/options/app/bootstrap.ts` — 딜레이 슬라이더 UI
- `src/popup/app/bootstrap.ts` — 순서 드래그 UI (또는 화살표 버튼)

---

### ⑧ 히스토리 통계 강화

**현재 상태**
옵션 페이지에 서비스별 사용량 도넛 차트 + 7일 활동 막대 차트만 있음

**제안 내용**

| 차트/분석 | 설명 | 구현 방법 |
|---|---|---|
| 시간대별 사용 히트맵 | 0~23시 × 요일 격자 | 히스토리 `createdAt` 파싱 |
| 서비스 성공률 트렌드 | 주별 성공/실패 비율 추이 | `submittedSiteIds` vs `failedSiteIds` |
| 프롬프트 길이 분포 | 짧은/중간/긴 프롬프트 비율 | `text.length` 구간 분류 |
| 자주 쓰는 키워드 Top 10 | 히스토리 텍스트 빈도 분석 | 단어 토크나이징 후 카운트 |

**수정 파일**
- `src/options/app/bootstrap.ts` — 새 차트 섹션 추가
- `src/options/ui/charts.ts` — 히트맵, 트렌드 차트 함수 추가
- `options/options.html` — 차트 컨테이너 마크업

---

## 4순위 — 고난이도, 높은 차별화 가치

---

### ③ 프롬프트 체인 (Chain Mode)

**현재 상태**
단일 프롬프트만 전송 가능

**제안 내용**
즐겨찾기에 다단계 프롬프트 정의, 순차적으로 자동 전송

**사용 시나리오**
```
[1단계] "다음 코드를 분석해줘: {{clipboard}}"
  → 5초 대기
[2단계] "위 분석을 바탕으로 리팩토링 방안을 제안해줘"
  → 10초 대기
[3단계] "리팩토링된 코드를 실제로 작성해줘"
```

**데이터 구조 변경**
```typescript
interface ChainStep {
  text: string;
  delayMs: number;           // 이전 단계 완료 후 대기 시간
  targetSiteIds?: string[];  // 없으면 전체 선택 서비스
}

interface FavoritePrompt {
  // ... 기존 필드
  isChain: boolean;
  steps?: ChainStep[];
}
```

**수정 파일**
- `src/background/app/bootstrap.ts` — 체인 실행 오케스트레이션 로직
- `src/shared/prompts/` — 체인 필드 추가
- `src/popup/app/bootstrap.ts` — 체인 전용 UI (단계 목록, 딜레이 설정)

---

### ⑦ 빠른 팔레트 (Quick Palette)

**현재 상태**
즐겨찾기 사용 흐름: 팝업 열기 → 탭 전환 → 검색 → 클릭

**제안 내용**
새 단축키(Alt+Shift+F)로 현재 페이지 위에 검색 오버레이 표시

```
Alt+Shift+F 누름
  ↓
현재 페이지 위에 검색 오버레이 (content script로 주입)
  ↓
즐겨찾기 실시간 검색 (타이핑하면서 필터)
  ↓
Enter / 방향키 선택 → 즉시 방송 실행
```

**수정 파일**
- `manifest.json` — `commands`에 `quick-palette` 단축키 추가
- `src/background/app/bootstrap.ts` — 단축키 수신 → content script에 팔레트 열기 메시지
- 새 파일 `src/content/palette/main.ts` — 오버레이 UI + 즐겨찾기 검색 로직
- `manifest.json` — 새 content script 등록

---

### ⑥ 방송 결과 비교 뷰

**현재 상태**
전송 성공/실패 상태만 기록, 실제 응답 내용 비교 불가

**제안 내용**
방송 후 각 서비스의 응답 시작 부분을 캡처해 옵션 페이지에서 나란히 비교

**필요 권한 추가**
```json
// manifest.json
"permissions": ["...", "tabCapture"]
```

**구현 흐름**
```
방송 완료 → waitMs 후 각 탭 응답 영역 스크린샷
       ↓
chrome.tabs.captureVisibleTab → base64 이미지
       ↓
chrome.storage.local에 broadcastId 키로 저장
       ↓
옵션 페이지 "결과 비교" 탭에서 가로 비교 뷰 표시
```

**수정 파일**
- `src/background/app/bootstrap.ts` — 캡처 로직 추가
- `src/options/app/bootstrap.ts` — 비교 뷰 UI
- `manifest.json` — `tabCapture` 권한 추가

---

## 보류 — 낮은 난이도, 부가 가치

---

### ⑪ 다국어 확장 (일본어 / 중국어)

**제안 내용**
`_locales/ja/`, `_locales/zh_CN/` 추가 + 템플릿 변수 별칭 확장

```typescript
// shared/template/constants.ts 별칭 추가
aliases: ["date", "날짜", "日付", "日期"]
aliases: ["clipboard", "클립보드", "クリップボード", "剪贴板"]
```

**수정 파일**
- `_locales/ja/messages.json` (신규)
- `_locales/zh_CN/messages.json` (신규)
- `src/shared/template/` — 별칭 배열 확장

**비고**: 번역 품질 확보가 관건. 커뮤니티 기여 방식 고려.

---

---

## 신규 기능 — 코드베이스 심층 분석 기반 (2026-04-02)

> 아래 항목은 전체 소스 분석(`src/`, `popup/`, `options/`, `manifest.json`, 타입 정의)에서 도출했다.
> 기존 로드맵과 중복되지 않는 신규 제안만 기재한다.

---

### ⒜ 다크 모드 지원

**현재 상태**
`popup/styles/app.css`, `options/styles/app.css` 모두 `prefers-color-scheme` 미지원. 시스템 다크 모드 설정과 무관하게 항상 라이트 테마.

**제안 내용**
CSS 미디어 쿼리로 다크 팔레트 추가. JS 토글 없이 CSS 변수만으로 구현 가능.

```css
/* popup/styles/app.css 예시 */
:root {
  --bg: #ffffff;
  --text: #111111;
  --surface: #f5f5f5;
}

@media (prefers-color-scheme: dark) {
  :root {
    --bg: #1e1e1e;
    --text: #e8e8e8;
    --surface: #2d2d2d;
  }
}
```

**수정 파일**
- `popup/styles/app.css` — CSS 변수 + 다크 팔레트
- `options/styles/app.css` — 동일
- `onboarding/onboarding.html` 인라인 스타일 정리

**임팩트**: ★★★ | **난이도**: ★☆☆ | **권장 순서**: **즉시 적용 가능**

---

### ⒝ 팝업 내 키보드 단축키

**현재 상태**
팝업 진입 단축키(`Alt+Shift+P`)는 있지만 팝업 내부 조작은 마우스 의존. 서비스 카드 선택, 전송, 탭 전환에 키보드 없음.

**제안 내용**

| 단축키 | 동작 |
|---|---|
| `Ctrl+Enter` | 전송 |
| `Ctrl+Shift+Enter` | 취소 |
| `Ctrl+1~4` | 탭 전환 (작성/히스토리/즐겨찾기/설정) |
| `Ctrl+A` | 모든 서비스 선택/해제 토글 |
| `↑↓` | 즐겨찾기·히스토리 목록 탐색 |
| `Enter` | 선택 항목 즐겨찾기 전송 |
| `Esc` | 열린 모달 닫기 |

**수정 파일**
- `src/popup/app/bootstrap.ts` — `keydown` 이벤트 핸들러 추가
- `popup/popup.html` — `tabindex` 속성 정리
- `_locales/` — 단축키 안내 문자열

**임팩트**: ★★★ | **난이도**: ★★☆ | **권장 순서**: **즉시 적용 가능**

---

### ⒞ 방송 취소 실제 구현 (현재 미완성)

**현재 상태**
`popup/popup.html`에 "전송 중지" 버튼이 있고 `isSending = false`는 세팅되지만, background에 이미 큐잉된 주입 작업은 실제로 중단되지 않는다. 취소 후에도 나머지 서비스에 프롬프트가 주입될 수 있다.

**제안 내용**
`CancelBroadcastMessage`를 background에 전달해 `injectionProcessChain`을 실제로 끊는다.

```typescript
// background에 취소 플래그 세팅
let broadcastCancelled = false;

// injectionProcessChain 내부에서 매 스텝마다 체크
if (broadcastCancelled) {
  return; // 남은 큐 건너뜀
}
```

**수정 파일**
- `src/background/app/bootstrap.ts` — 취소 플래그 + 큐 체크
- `src/shared/types/messages.ts` — `CancelBroadcastMessage` 확장 (이미 존재, 처리 로직 보강)

**임팩트**: ★★★ | **난이도**: ★★☆ | **권장 순서**: **버그 수준 수정**

---

### ⒟ 주입 전략 적응형 재정렬 (Adaptive Strategy Ordering)

**현재 상태**
`src/content/injector/main.ts`의 전략 순서가 입력 타입별로 고정 배열로 하드코딩. `execCommand`가 실제 실패율이 높아도 항상 먼저 시도된다.

**제안 내용**
서비스별 전략 성공/실패 카운트를 `chrome.storage.local`에 누적하고, 다음 번 주입 시 성공률 높은 전략을 먼저 시도한다.

```typescript
// 예: siteId별 strategy hit rate 저장
interface StrategyStats {
  [siteId: string]: {
    [strategyName: string]: { success: number; fail: number };
  };
}
```

**수정 파일**
- `src/content/injector/main.ts` — 전략 시도 결과 reporting
- `src/background/app/bootstrap.ts` — stats 기록
- `src/shared/types/models.ts` — `StrategyStats` 인터페이스
- (선택) `src/options/app/bootstrap.ts` — 서비스별 전략 현황 표시

**임팩트**: ★★☆ | **난이도**: ★★★ | **권장 순서**: **신뢰성 개선**

---

### ⒠ 히스토리·즐겨찾기 정렬 옵션

**현재 상태**
히스토리는 `createdAt` 역순 고정. 즐겨찾기는 핀 → 폴더 → 생성순 고정. 정렬 변경 불가.

**제안 내용**

**히스토리 정렬:**
- 최신순 (기본) / 오래된순
- 성공 많은순 / 실패 많은순

**즐겨찾기 정렬:**
- 최근 사용순 (`lastUsedAt` 필드 추가 필요)
- 사용 횟수순 (`usageCount` 필드 추가 필요)
- 제목 가나다순
- 생성일순

**데이터 모델 변경 필요:**
```typescript
interface FavoritePrompt {
  // 기존 필드...
  usageCount: number;       // 신규
  lastUsedAt: string | null; // 신규
}
```

**수정 파일**
- `src/shared/types/models.ts` — `FavoritePrompt` 필드 추가
- `src/shared/prompts/favorites-store.ts` — `usageCount` 증가 로직
- `src/popup/app/bootstrap.ts` — 정렬 UI (드롭다운 또는 토글 버튼)
- `popup/popup.html` — 정렬 컨트롤 마크업

**임팩트**: ★★☆ | **난이도**: ★★☆ | **권장 순서**: **UX 개선**

---

### ⒡ 구조화된 오류 코드 시스템

**현재 상태**
`siteResults: Record<string, string>`에 "submitted" 또는 오류 문자열만 저장. 오류 원인 분류 불가 — 셀렉터 실패인지, 인증 페이지인지, 제출 실패인지 구분할 방법이 없다.

**제안 내용**
오류 코드 enum 도입, `siteResults` 구조화.

```typescript
type InjectionResultCode =
  | "submitted"
  | "selector_timeout"   // 셀렉터 찾기 실패
  | "auth_required"      // 로그인 페이지 감지
  | "submit_failed"      // 주입 성공, 제출 실패
  | "strategy_exhausted" // 모든 전략 실패
  | "tab_closed"         // 탭이 닫힘
  | "cancelled";         // 방송 취소

interface SiteInjectionResult {
  code: InjectionResultCode;
  strategy?: string;     // 성공/실패한 전략명
  elapsedMs?: number;
  message?: string;      // 사람 읽을 수 있는 보충 설명
}
```

**수정 파일**
- `src/shared/types/models.ts` — `InjectionResultCode`, `SiteInjectionResult`
- `src/content/injector/main.ts` — 결과 코드 세분화
- `src/background/app/bootstrap.ts` — 결과 저장 시 구조 적용
- `src/options/app/bootstrap.ts` — 오류 코드별 통계 UI

**임팩트**: ★★★ | **난이도**: ★★☆ | **권장 순서**: **신뢰성 + 분석 기반 확보**

---

### ⒢ export/import 버전 마이그레이션

**현재 상태**
`import-export.ts`의 `version: 3` 고정. v1·v2 내보내기 파일을 불러와도 마이그레이션 로직 없음. 구 버전 export 파일에 없는 필드(예: `tags`, `folder`, `pinned`)는 무음 누락.

**제안 내용**
import 시 버전 감지 → 단계별 마이그레이션 함수 체인.

```typescript
function migrateImportData(raw: unknown): ExportPayload {
  const v = (raw as any)?.version ?? 1;
  let data = raw;
  if (v < 2) data = migrateV1toV2(data);
  if (v < 3) data = migrateV2toV3(data);
  return data as ExportPayload;
}
```

**수정 파일**
- `src/shared/prompts/import-export.ts` — `migrateImportData()` 추가
- import UI에서 구버전 경고 배너 표시

**임팩트**: ★★☆ | **난이도**: ★★☆ | **권장 순서**: **데이터 안전성**

---

### ⒣ 신규 내장 AI 서비스 추가 (Copilot, Mistral, DeepSeek)

**현재 상태**
5개 내장 서비스 (ChatGPT, Gemini, Claude, Grok, Perplexity). FEATURE_ROADMAP.md 항목 ⑫에 Copilot·Mistral·DeepSeek·HuggingChat이 검토 목록에 있지만 미구현.

**추가 검토 서비스:**

| 서비스 | 도메인 | 비고 |
|---|---|---|
| Microsoft Copilot | `copilot.microsoft.com` | MS 생태계, WAI-ARIA 리치 에디터 |
| Mistral Le Chat | `chat.mistral.ai` | 유럽 AI, 기본 contenteditable |
| DeepSeek | `chat.deepseek.com` | 아시아권 인기, React 기반 |
| HuggingChat | `huggingface.co/chat` | 오픈소스 모델 서버 |
| Qwen (通义千问) | `tongyi.aliyun.com` | 알리바바 AI |

**구현 체크리스트 (서비스별 DOM 검증 필수):**
- [ ] 실제 페이지에서 `inputSelector` DevTools로 확인
- [ ] `submitSelector` 및 `submitMethod` (click vs enter)
- [ ] `authSelectors` (로그인 페이지 판별)
- [ ] `waitMs` 적정값 측정
- [ ] Lexical/Tiptap/ProseMirror 에디터 여부 확인
- [ ] `lastVerified` 기록

**수정 파일**
- `src/config/sites/builtins.ts`
- `manifest.json` — `host_permissions`, `content_scripts.matches`

**임팩트**: ★★★ | **난이도**: ★★☆ (검증 시간이 핵심) | **권장 순서**: **사용자 요청 대응**

---

### ⒤ 타임아웃 및 대기 설정 노출 (현재 하드코딩)

**현재 상태**
아래 값들이 소스 내 상수로 고정:

| 상수 | 위치 | 값 |
|---|---|---|
| `SUBMIT_BUTTON_WAIT_TIMEOUT_MS` | `injector/submit.ts` | 5000ms |
| `SUBMIT_BUTTON_POLL_INTERVAL_MS` | `injector/submit.ts` | 100ms |
| `TAB_LOAD_READY_TIMEOUT_MS` | `background/constants.ts` | 미공개 |
| `RECENT_INJECTION_DEDUPE_MS` | `injector/main.ts` | 1500ms |
| `waitMs` (서비스별) | `builtins.ts` | 서비스마다 다름 |

네트워크가 느린 환경 또는 고성능 환경에서 일률적 적용이 부적절.

**제안 내용**
`AppSettings`에 `waitMsMultiplier` 추가, 옵션 페이지에서 0.5x ~ 3.0x 슬라이더로 조절.

```typescript
interface AppSettings {
  // 기존...
  waitMsMultiplier: number; // 기본 1.0, 범위 0.5~3.0
}
```

**수정 파일**
- `src/shared/types/models.ts` — `AppSettings`
- `src/shared/prompts/constants.ts` — 기본값 추가
- `src/background/app/bootstrap.ts` — waitMs 계산 시 배율 적용
- `src/options/app/bootstrap.ts` — 슬라이더 UI

**임팩트**: ★★☆ | **난이도**: ★★☆ | **권장 순서**: **신뢰성 개선**

---

### ⒥ 즐겨찾기 복제 (Duplicate Favorite)

**현재 상태**
즐겨찾기 편집 모달에 "저장", "삭제"만 있고 "복사본 저장" 없음. 비슷한 프롬프트 변형 작업이 불편.

**제안 내용**
즐겨찾기 카드에 "복제" 버튼 추가. 제목은 `"[복사] {원본 제목}"`, 나머지 필드는 동일하게 복사.

**수정 파일**
- `src/shared/prompts/favorites-store.ts` — `duplicateFavoriteItem()` 함수
- `src/popup/app/bootstrap.ts` — 복제 버튼 핸들러
- `popup/popup.html` — 버튼 마크업
- `_locales/` — "복제" 문자열

**임팩트**: ★★☆ | **난이도**: ★☆☆ | **권장 순서**: **즉시 적용 가능**

---

### ⒦ 히스토리 항목 재전송 시 서비스 선택 UI

**현재 상태**
히스토리 "재전송" 버튼은 `requestedSiteIds`를 그대로 사용해 동일 서비스 세트로 전송. 일부 서비스만 재전송하는 기능 없음.

**제안 내용**
재전송 버튼 클릭 시 서비스 체크박스 미니 모달 표시. 사용자가 원하는 서비스만 선택 후 재전송.

**수정 파일**
- `src/popup/app/bootstrap.ts` — 재전송 플로우에 서비스 선택 스텝 추가
- `popup/popup.html` — 재전송 선택 모달 마크업

**임팩트**: ★★★ | **난이도**: ★★☆ | **권장 순서**: **UX 개선**

---

### ⒧ 접근성 개선 (ARIA + 키보드 네비게이션)

**현재 상태**
- 서비스 카드: `<div>` 기반, `role` / `aria-label` 미완성
- 팝업 탭 바: `tabindex` 미지정
- 상태 메시지: `aria-atomic` 미설정
- 모달: `aria-labelledby` 참조 없음

**제안 내용**

```html
<!-- 서비스 카드 -->
<li role="option" aria-selected="true" aria-label="ChatGPT — 활성화됨">

<!-- 팝업 탭 -->
<button role="tab" aria-selected="true" aria-controls="compose-panel">

<!-- 상태 알림 -->
<div role="status" aria-live="polite" aria-atomic="true">
```

**수정 파일**
- `popup/popup.html` — role, aria-* 속성 전면 정리
- `options/options.html` — 동일
- `src/popup/app/bootstrap.ts` — aria-selected 동적 갱신

**임팩트**: ★★☆ | **난이도**: ★★☆ | **권장 순서**: **접근성 요건**

---

### ⒨ 히스토리 bulk 선택 삭제

**현재 상태**
히스토리 항목 삭제가 건별로만 가능. 기간 단위 일괄 삭제 없음 (전체 삭제 "초기화"만 존재).

**제안 내용**
- 날짜 범위 선택 → 해당 기간 항목 일괄 삭제
- 체크박스 멀티 선택 → 선택 항목 삭제
- "X일 이전 항목 삭제" 빠른 버튼

**수정 파일**
- `src/shared/prompts/history-store.ts` — `deleteHistoryItemsBeforeDate()`, `deleteHistoryItemsByIds()` 함수
- `src/options/app/bootstrap.ts` — 선택 UI
- `options/options.html` — 체크박스 + 삭제 툴바

**임팩트**: ★★☆ | **난이도**: ★★☆ | **권장 순서**: **데이터 관리**

---

### ⒩ import 오류 상세 리포트

**현재 상태**
`import-export.ts`에서 커스텀 서비스 import 시 권한 거부된 서비스가 몇 개인지 숫자만 표시. 어떤 서비스가 거부됐는지 이름을 알 수 없음.

**제안 내용**
import 요약 모달에 "거부된 서비스" 목록(이름 + 거부 이유) 명시.

```typescript
interface ImportSummary {
  accepted: string[];     // 서비스 이름 배열
  rejected: Array<{
    name: string;
    reason: "permission_denied" | "invalid_config" | "duplicate_id";
  }>;
  rewritten: string[];
}
```

**수정 파일**
- `src/shared/prompts/import-export.ts` — `ImportSummary` 구조 변경
- `src/popup/app/bootstrap.ts` — 상세 모달 렌더링
- `_locales/` — 거부 이유 문자열

**임팩트**: ★★☆ | **난이도**: ★★☆ | **권장 순서**: **데이터 안전성**

---

## 개선이 필요한 기존 기능 (버그/미완성)

> 신규 기능은 아니지만 현재 코드에서 발견된 동작 불일치, 신뢰성 문제, 안전성 이슈.

---

### 🔧 B-1. `{{clipboard}}` 권한 거부 시 무음 실패

**위치:** `src/shared/template/values.ts`

**문제:** `clipboardRead` 선택적 권한이 거부된 경우 `{{clipboard}}`가 빈 문자열로 조용히 대체된다. 사용자가 프롬프트에 클립보드 내용이 삽입됐다고 착각할 수 있다.

**수정 방향:** 권한 없을 때 팝업에서 "clipboardRead 권한 필요" 경고 토스트 표시 또는 미리보기에서 `[클립보드: 권한 없음]`으로 표기.

**난이도**: ★☆☆

---

### 🔧 B-2. 취소 버튼이 이미 열린 새 탭을 닫지 않는 케이스

**위치:** `src/background/app/bootstrap.ts` — 방송 취소 처리 부분

**문제:** 방송 중 취소 시 "방송을 위해 열린 탭만 닫는다"는 원칙인데, 취소 타이밍에 따라 이미 주입이 시작된 탭이 닫히지 않는 엣지 케이스 존재.

**수정 방향:** 취소 시점에 `pendingInjections`에 남은 항목의 `openedForBroadcast` 탭을 모두 순회 후 닫기.

**난이도**: ★★☆

---

### 🔧 B-3. Claude.ai 셀렉터 `aria-label` 다국어 취약

**위치:** `src/config/sites/builtins.ts` — Claude 정의

**문제:** `aria-label='Write your prompt to Claude'` 정확 문자열 매치. Claude.ai가 한국어 UI를 제공하면 `'Claude에게 프롬프트 작성'`으로 바뀌어 셀렉터 실패.

**수정 방향:** `aria-label` 부분 일치 (`[aria-label*="prompt"]`) 또는 더 안정적인 구조 셀렉터로 교체. 검증일 갱신.

**난이도**: ★☆☆

---

### 🔧 B-4. 서비스 워커 종료 후 `pendingBroadcasts` 유실 가능성

**위치:** `src/background/app/bootstrap.ts` — 메모리 캐시 부분

**문제:** `pendingBroadcasts`는 session storage에 쓰여 있지만, background가 메모리 캐시를 먼저 참조한다. 장시간 방송(탭 많음) 중 서비스 워커가 종료·재시작되면 캐시가 빈 상태로 복구될 수 있다.

**수정 방향:** 서비스 워커 재시작 시 session storage에서 `pendingBroadcasts`/`pendingInjections`를 복구해 메모리 캐시로 반영하는 초기화 단계 추가.

**난이도**: ★★★

---

### 🔧 B-5. Gemini `.ql-editor` 클래스 불안정

**위치:** `src/config/sites/builtins.ts` — Gemini 정의

**문제:** `.ql-editor` (Quill 에디터 클래스)를 사용 중인데, Gemini가 에디터를 교체하거나 클래스명을 변경하면 즉시 실패.

**수정 방향:** `[contenteditable="true"][role="textbox"]` 같은 WAI-ARIA 속성 기반 셀렉터를 폴백으로 추가. 검증일 갱신.

**난이도**: ★☆☆

---

### 🔧 B-6. 제출 실패 시 단일 재시도 없음

**위치:** `src/content/injector/submit.ts`

**문제:** `submitByClick()` 실패 시 `submit_failed` 반환으로 종료. 비동기 상태 업데이트가 늦은 서비스(특히 Gemini)는 5초 내에 버튼이 활성화되지 않아 실패로 처리될 수 있다.

**수정 방향:** `SUBMIT_BUTTON_WAIT_TIMEOUT_MS`을 `AppSettings.waitMsMultiplier` 연동, 또는 타임아웃 초과 시 1회 재시도 로직 추가.

**난이도**: ★★☆

---

## 전체 우선순위 통합표

| # | 분류 | 기능/이슈 | 임팩트 | 난이도 | 권장 순서 |
|---|---|---|:---:|:---:|:---:|
| ⒜ | 신규 | 다크 모드 | ★★★ | ★☆☆ | **즉시** |
| ⒝ | 신규 | 팝업 키보드 단축키 | ★★★ | ★★☆ | **즉시** |
| ⒠ | 신규 | 즐겨찾기 복제 | ★★☆ | ★☆☆ | **즉시** |
| B-3 | 버그 | Claude aria-label 취약 | ★★★ | ★☆☆ | **즉시** |
| B-5 | 버그 | Gemini 셀렉터 불안정 | ★★★ | ★☆☆ | **즉시** |
| ⒞ | 개선 | 취소 버튼 실제 구현 | ★★★ | ★★☆ | **1순위** |
| ⒡ | 신규 | 구조화된 오류 코드 | ★★★ | ★★☆ | **1순위** |
| ⒣ | 신규 | 신규 내장 서비스 | ★★★ | ★★☆ | **1순위** |
| ⒦ | 신규 | 재전송 서비스 선택 UI | ★★★ | ★★☆ | **1순위** |
| B-1 | 버그 | clipboard 무음 실패 | ★★☆ | ★☆☆ | **1순위** |
| B-6 | 버그 | 제출 실패 재시도 없음 | ★★☆ | ★★☆ | **1순위** |
| ② | 기존 | 방송 예약 | ★★★ | ★★★ | **2순위** |
| ⒟ | 신규 | 적응형 전략 재정렬 | ★★☆ | ★★★ | **2순위** |
| ⒤ | 신규 | 타임아웃 설정 노출 | ★★☆ | ★★☆ | **2순위** |
| ⒧ | 신규 | 접근성 개선 ARIA | ★★☆ | ★★☆ | **2순위** |
| ⒨ | 신규 | 히스토리 bulk 삭제 | ★★☆ | ★★☆ | **2순위** |
| ⒩ | 신규 | import 오류 상세 리포트 | ★★☆ | ★★☆ | **2순위** |
| ⒢ | 신규 | export 버전 마이그레이션 | ★★☆ | ★★☆ | **2순위** |
| ⑨ | 기존 | 딜레이·순서 커스터마이징 | ★★☆ | ★★☆ | **3순위** |
| ⑧ | 기존 | 히스토리 통계 강화 | ★★☆ | ★★☆ | **3순위** |
| ⒥ | 신규 | 즐겨찾기 정렬 옵션 | ★★☆ | ★★☆ | **3순위** |
| B-4 | 버그 | 서비스 워커 재시작 복구 | ★★★ | ★★★ | **3순위** |
| ③ | 기존 | 프롬프트 체인 | ★★★ | ★★★ | **4순위** |
| ⑦ | 기존 | 빠른 팔레트 | ★★★ | ★★★ | **4순위** |
| ⑪ | 기존 | 다국어 확장 | ★★☆ | ★☆☆ | **보류** |

---

## 구현 시 공통 체크리스트

새 기능 추가 시 아래 항목을 반드시 확인:

- [ ] `src/` TypeScript 소스만 수정 (절대 `dist/` 직접 편집 금지)
- [ ] `npm run build` 실행 후 Chrome에서 테스트
- [ ] `npm run typecheck` 통과 확인
- [ ] 새 i18n 문자열은 `_locales/en/messages.json` + `_locales/ko/messages.json` 동시 추가
- [ ] 새 저장 필드는 기존 데이터와의 **하위 호환성** 보장 (마이그레이션 또는 기본값 처리)
- [ ] 새 권한은 `manifest.json`에 추가 + 사용자 안내 문구 검토
- [ ] 새 내장 서비스는 실제 DOM 검증 필수 (`lastVerified` 날짜 기록)
- [ ] `npm run qa:smoke` 기존 테스트 통과 유지
