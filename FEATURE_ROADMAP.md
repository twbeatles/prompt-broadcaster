# AI Prompt Broadcaster - 기능 개선 로드맵

> 작성일: 2026-03-31
> 최종 업데이트: 2026-03-31 (6개 기능 구현 완료)
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
