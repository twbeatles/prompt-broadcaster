# AI Prompt Broadcaster

> Broadcast one prompt to multiple AI chat services from a single Chrome extension popup.
>
> 하나의 프롬프트를 여러 AI 서비스에 동시에 전송하는 Chrome 확장 프로그램입니다.

[![Chrome Extension](https://img.shields.io/badge/Chrome-Extension-4285F4?logo=googlechrome&logoColor=white)](https://developer.chrome.com/docs/extensions/)
[![Manifest V3](https://img.shields.io/badge/Manifest-V3-34A853)](https://developer.chrome.com/docs/extensions/develop/migrate/what-is-mv3)
[![MIT License](https://img.shields.io/badge/License-MIT-black.svg)](LICENSE)
[![Status](https://img.shields.io/badge/status-best--effort-orange)](#supported-ai-services--지원-ai-서비스)

## Table of Contents
- [한국어](#한국어)
- [English](#english)

---

## 한국어

### 소개
`AI Prompt Broadcaster`는 팝업에서 한 번 입력한 프롬프트를 ChatGPT, Gemini, Claude, Grok, Perplexity로 동시에 전송하는 Chrome Manifest V3 확장 프로그램입니다.

백엔드나 API 키 없이, 사용자가 이미 로그인한 각 AI 웹앱의 DOM 입력창에 직접 프롬프트를 주입하는 방식으로 동작합니다.

현재 소스 코드는 `src/` 아래 TypeScript 모듈로 관리됩니다. Chrome에는 `dist/` 산출물을 기본으로 로드하고, 루트 런타임 JS는 `npm run build`가 함께 동기화하는 generated mirror입니다. `src/*/main.ts`는 얇은 composition root로 유지되고, 실제 런타임은 `src/background/{commands,context-menu,messages,popup,selection}`, `src/options/{core,features}`, `src/popup/features`, `src/shared/*`, `scripts/qa-smoke/*`, `popup/styles/partials`, `options/styles/partials`처럼 기능 기준으로 분리되어 있습니다.

빌드 및 패키징 절차는 [docs/build-guide.md](docs/build-guide.md), 현재 구조 설명은 [docs/extension-architecture.md](docs/extension-architecture.md)를 참고하세요.

### 주요 기능
- 하나의 프롬프트를 여러 AI 서비스로 한 번에 방송
- **다크 모드 + 팝업 키보드 단축키** – `Ctrl/Cmd+Enter`, `Ctrl/Cmd+Shift+Enter`, `Ctrl/Cmd+1..4`, `Esc` 등 지원
- 전송 성공 프롬프트 히스토리 자동 저장
- 즐겨찾기 저장, 제목 편집, 제목/본문/태그/폴더 검색
- **저장형 체인 즐겨찾기** – 단계별 지연시간과 단계별 대상 서비스 override를 가진 chain favorite 실행
- **즐겨찾기 예약 실행** – one-time / daily / weekday / weekly 예약과 options `Schedules` 목록 제공
- **빠른 팔레트** – `Alt+Shift+F`로 현재 페이지 위에서 즐겨찾기 검색 및 즉시 실행, 필요 시 popup 폴백
- **즐겨찾기 태그·폴더·핀 시스템** – 태그와 폴더로 즐겨찾기를 분류하고, 중요 항목을 상단 고정
- **즐겨찾기 복제 + 정렬 옵션** – 최근 사용순, 사용 횟수순, 제목순, 생성일순 정렬과 복제 저장 지원
- **히스토리 재전송 선택 + 옵션 일괄 삭제** – 원래 대상 기준 재전송 모달, 선택 삭제, 7/30/90일 이전 빠른 삭제
- **서비스별 프롬프트 오버라이드** – 서비스 카드마다 메인 프롬프트와 다른 별도 프롬프트를 지정 가능
- 히스토리/즐겨찾기/템플릿 캐시/설정/서비스 구성을 JSON으로 내보내기 및 가져오기 (`v6`, 체인/예약 메타, 재전송 스냅샷, `{{counter}}` 포함)
- **상세 import 리포트 + 구조화된 전송 결과 코드** – 권한 거부/ID 재작성/built-in 보정 내역과 서비스별 결과 코드 표시
- **확장 템플릿 변수** – `{{url}}`, `{{title}}`, `{{selection}}`, `{{counter}}`, `{{random}}` 등 9개 이상의 시스템 변수 지원
- Chrome MV3 기반, 백엔드 없음
- `chrome.scripting.executeScript` 기반 동적 주입
- 사이트별 셀렉터와 전략을 `src/config/sites/builtins.ts`에서 중앙 관리
- Perplexity는 `#ask-input[data-lexical-editor='true']`를 최우선으로 잡고, `MAIN` world에서 Lexical 상태를 갱신한 뒤 기존 submit 경로로 전송
- **전역 대기 배율(wait multiplier)** 과 서비스별 적응형 주입 전략 통계(내부 저장) 지원
- 입력 실패 시 클립보드 복사 + 비차단 폴백 배너 제공
- 셀렉터가 깨졌을 때 자동 진단 및 알림, **GitHub 이슈 신고 버튼** 제공
- 개발자용 셀렉터 탐지 스크립트 제공
- **옵션 페이지 히스토리 상세에서 서비스별 전송 결과 비교 뷰** 제공

### 지원 AI 서비스

| 서비스 | URL | 주입 방식 | 현재 상태 |
|---|---|---|---|
| ChatGPT | `https://chatgpt.com/` | `contenteditable` + 버튼 클릭 | 지원, Best effort |
| Gemini | `https://gemini.google.com/app` | `contenteditable` + 버튼 클릭 | 지원, Best effort |
| Claude | `https://claude.ai/new` | `contenteditable` + 버튼 클릭 | 지원, Best effort |
| Grok | `https://grok.com/` | `contenteditable` + 버튼 클릭 | 지원, Best effort |
| Perplexity | `https://www.perplexity.ai/` | `contenteditable` + 버튼 클릭 | 지원, Best effort |

`Best effort`는 대상 사이트의 DOM 구조 변경, 로그인 상태, 반자동화 정책에 따라 주입 성공률이 달라질 수 있음을 의미합니다.

Perplexity 참고:
- 일반 `contenteditable`처럼 보이지만 실제로는 Lexical editor이므로, broad selector 대신 `#ask-input[data-lexical-editor='true']`를 우선 사용합니다.
- 입력은 page-owned editor state와 맞추기 위해 `MAIN` world에서 처리하고, 발신은 기존 click-submit 경로를 유지합니다.

### 이런 분께 좋아요
- 같은 프롬프트를 여러 AI에 동시에 보내고 답변을 비교하고 싶은 사용자
- 반복적으로 프롬프트를 테스트하는 프롬프트 엔지니어와 개발자
- 여러 AI 탭을 일일이 열고 붙여넣는 작업을 줄이고 싶은 사용자

### 설치 방법
#### 1. 저장소 준비
```bash
git clone https://github.com/twbeatles/prompt-broadcaster.git
cd prompt-broadcaster
npm install
npm run build
```

#### 2. Chrome에서 확장 프로그램 로드
1. Chrome 주소창에 `chrome://extensions` 입력 후 이동합니다.
   스크린샷 자리표시자: `docs/assets/install-step-1-extensions-page.png`
2. 우측 상단의 `개발자 모드`를 켭니다.
   스크린샷 자리표시자: `docs/assets/install-step-2-developer-mode.png`
3. `압축해제된 확장 프로그램을 로드합니다`를 클릭합니다.
   스크린샷 자리표시자: `docs/assets/install-step-3-load-unpacked.png`
4. 이 프로젝트의 `dist` 폴더를 선택합니다.
   스크린샷 자리표시자: `docs/assets/install-step-4-select-folder.png`
5. 확장 프로그램이 목록에 표시되고 에러가 없는지 확인합니다.
   스크린샷 자리표시자: `docs/assets/install-step-5-extension-loaded.png`

### 사용 방법
1. Chrome 툴바에서 `AI Prompt Broadcaster` 아이콘을 클릭합니다.
2. 프롬프트를 입력합니다. `{{url}}`, `{{date}}` 같은 템플릿 변수를 사용할 수 있습니다.
3. 전송할 AI 서비스를 선택합니다. 서비스 카드에서 ▸ 아이콘을 클릭하면 해당 서비스에만 적용할 별도 프롬프트를 지정할 수 있습니다.
4. 필요하면 열린 탭 재사용/새 탭/특정 탭을 고르고, 히스토리/즐겨찾기 정렬 기준을 바꿉니다.
5. `Send` 버튼을 누르거나 `Ctrl/Cmd+Enter`를 누릅니다.
6. 전송 중에는 `Ctrl/Cmd+Shift+Enter` 또는 취소 버튼으로 중단할 수 있습니다.
7. 선택한 서비스별 새 탭이 열리거나 재사용 탭이 선택되고, 각 사이트에서 자동 주입과 전송을 시도합니다.
8. 실패한 경우 클립보드 복사 및 수동 전송 안내 배너가 표시됩니다.
9. 히스토리 재전송 시에는 서비스 선택 모달에서 일부 서비스만 골라 다시 보낼 수 있습니다.
10. 즐겨찾기는 단일 프롬프트뿐 아니라 chain favorite과 예약 favorite으로 저장할 수 있습니다.
11. `Alt+Shift+F` 빠른 팔레트로 현재 페이지 위에서 즐겨찾기를 검색해 바로 실행할 수 있습니다.
12. 옵션 페이지 히스토리에서 **상세 보기**를 누르면 서비스별 성공/실패 결과를 한눈에 확인할 수 있습니다.

GIF 자리표시자: `docs/assets/usage-demo.gif`

### 제한 사항
- 각 AI 서비스에 미리 로그인되어 있어야 정상 동작합니다.
- 이 확장 프로그램은 각 사이트의 DOM 구조와 입력창 셀렉터에 의존하므로, 사이트 UI가 바뀌면 자동 주입이 일시적으로 깨질 수 있습니다.
- 일부 서비스는 자동화 또는 합성 입력 이벤트를 제한할 수 있어, 환경에 따라 수동 붙여넣기 폴백이 사용될 수 있습니다.
- 지원 상태는 `Best effort`이며, 모든 환경에서 100% 동작을 보장하지는 않습니다.

### 개인정보 및 데이터 처리
- 이 프로젝트는 별도 백엔드를 사용하지 않습니다.
- 프롬프트 전송은 사용자의 브라우저에서 직접 대상 AI 서비스 탭으로 수행됩니다.
- 히스토리와 즐겨찾기 데이터는 브라우저 로컬 저장소에 보관됩니다.
- API 키를 요구하지 않으며, 별도 서버를 통해 프롬프트를 중계하지 않습니다.

### 템플릿 변수
프롬프트에 `{{변수명}}` 형태로 값을 자동 치환할 수 있습니다.

**시스템 변수 (자동 채워짐)**

| 변수 | 한국어 별칭 | 설명 |
|---|---|---|
| `{{date}}` | `{{날짜}}` | 오늘 날짜 |
| `{{time}}` | `{{시간}}` | 현재 시각 |
| `{{weekday}}` | `{{요일}}` | 요일 |
| `{{clipboard}}` | `{{클립보드}}` | 클립보드 텍스트 |
| `{{url}}` | `{{주소}}` | 현재 탭 URL |
| `{{title}}` | `{{제목}}` | 현재 탭 제목 |
| `{{selection}}` | `{{선택}}` | 현재 탭에서 선택한 텍스트 |
| `{{counter}}` | `{{카운터}}` | 최소 1개 타깃이 정상 큐잉된 방송 누적 횟수 |
| `{{random}}` | `{{랜덤}}` | 1–1000 랜덤 숫자 |

**사용자 변수** – `{{topic}}`처럼 임의 이름을 사용하면 팝업에서 값을 입력하는 모달이 열립니다.

### 즐겨찾기 태그·폴더·핀
- 즐겨찾기 항목의 `···` 메뉴 → **태그 및 폴더 편집**으로 쉼표 구분 태그와 폴더명을 입력합니다.
- 같은 메뉴에서 **상단 고정** / **고정 해제**로 중요 항목을 목록 최상단에 고정합니다.
- 같은 메뉴에서 **복제**를 누르면 `[복사]` 접두어가 붙은 새 즐겨찾기를 만들 수 있습니다.
- 즐겨찾기 패널 상단의 태그·폴더 칩을 클릭하면 해당 항목만 필터링됩니다.
- 즐겨찾기 검색창은 제목, 본문, 태그, 폴더명을 함께 검색합니다. `#태그명` 형태 검색도 지원합니다.
- 즐겨찾기 정렬은 최근 사용순, 사용 횟수순, 제목순, 생성일순을 지원하며, pinned 그룹 내부에만 정렬이 적용됩니다.

### 즐겨찾기 체인·예약·빠른 팔레트
- 즐겨찾기 편집기에서 `Single` / `Chain` 모드를 전환할 수 있고, chain 모드에서는 단계 추가, 순서 이동, 단계별 지연시간, 단계별 대상 서비스 override를 설정할 수 있습니다.
- chain 단계의 대상 서비스를 비워 두면 해당 단계는 즐겨찾기 기본 대상 서비스를 그대로 상속합니다.
- chain favorite은 각 단계를 순차 실행하며, 한 단계라도 `submitted`가 아닌 결과가 나오면 즉시 중단됩니다.
- 예약은 즐겨찾기 단위로 저장되며, `One time`, `Daily`, `Weekdays`, `Weekly` 반복 규칙을 지원합니다.
- 예약 실행은 `{{date}}`, `{{time}}`, `{{weekday}}`, `{{random}}`, `{{counter}}`만 자동 해석합니다. `{{url}}`, `{{title}}`, `{{selection}}`, `{{clipboard}}`가 필요하면 해당 예약 실행은 실패 히스토리를 남기고 건너뜁니다.
- popup에서 실행되는 즐겨찾기는 `{{url}}`, `{{title}}`, `{{selection}}`, `{{clipboard}}`를 먼저 준비한 뒤 background job으로 넘깁니다. quick palette/options에서 popup fallback이 발생해도 popup이 자동으로 이어서 실행을 재시도합니다.
- 즐겨찾기 실행은 background job으로 즉시 큐잉되고, 같은 즐겨찾기의 `queued/running` 실행만 dedupe합니다. 완료/실패 직후 재실행은 다시 허용됩니다. 팝업과 options `Schedules`에는 최근 job의 `queued/running/done/failed` 상태가 간단히 표시됩니다.
- 옵션 페이지 `Schedules` 섹션에서 예약된 즐겨찾기만 모아 보고, 활성화 토글, `Run now`, `Edit in popup`을 사용할 수 있습니다.
- `Alt+Shift+F` 빠른 팔레트는 shadow root 오버레이로 동작하며, popup 즐겨찾기 검색과 같은 로직으로 제목/본문/태그/폴더 및 `#tag` 검색을 지원합니다. 즉시 해석 가능한 즐겨찾기는 바로 실행하고 추가 입력이 필요하면 popup으로 handoff합니다.

### 팝업 단축키와 정렬
- `Ctrl/Cmd+Enter`는 전송, `Ctrl/Cmd+Shift+Enter`는 현재 방송 취소입니다.
- `Ctrl/Cmd+1..4`는 작성/히스토리/즐겨찾기/설정 탭을 전환합니다.
- `Esc`는 열린 모달이나 메뉴를 닫습니다.
- 작성 탭에서 포커스가 입력창 밖에 있을 때만 `Ctrl/Cmd+A`가 전체 서비스 선택/해제로 동작하고, 입력창 안에서는 브라우저 기본 전체 선택을 유지합니다.
- 히스토리와 즐겨찾기 목록은 키보드 roving focus 탐색을 지원하며, 각각 정렬 드롭다운으로 표시 순서를 바꿀 수 있습니다.
- 팝업을 다시 열면 마지막 전송 프롬프트가 아니라 현재 작성 중이던 draft가 우선 복원되고, popup handoff 프롬프트는 one-shot intent로 한 번만 주입됩니다.

### 서비스별 프롬프트 오버라이드
서비스 카드에서 **Custom prompt for this service** 토글을 켜면 해당 서비스에만 전송할 별도 프롬프트를 입력할 수 있습니다. 비워두면 메인 프롬프트가 사용됩니다.
메인 프롬프트와 서비스별 오버라이드는 모두 같은 템플릿 변수 해석 경로를 타며, 재시도와 히스토리 재전송 시에도 최초 전송 시점의 서비스별 resolved prompt snapshot이 그대로 재사용됩니다.

### 커스텀 서비스 권한
- 커스텀 서비스는 `url`과 `hostnameAliases`에서 파생된 모든 origin에 대해 optional host permission을 확인합니다.
- 저장 또는 JSON import 시 필요한 origin 중 하나라도 거부되면 해당 커스텀 서비스는 부분 적용되지 않고 전체가 거부됩니다.
- 커스텀 서비스를 삭제하거나 서비스 설정을 리셋하거나 JSON import로 교체하면, 더 이상 어떤 커스텀 서비스도 사용하지 않는 origin permission만 자동 회수합니다.
- `{{counter}}`는 팝업 미리보기에서는 다음 값처럼 보이지만, 실제 저장값은 최소 1개 타깃이 큐잉된 방송에서만 증가하며 export/import/reset과 함께 관리됩니다.

### 셀렉터 오류 신고
셀렉터 경고(⚠)가 표시된 서비스는 설정 탭의 서비스 관리 카드에 **Report issue** 링크가 표시됩니다. 클릭하면 해당 서비스의 GitHub 이슈 검색 페이지가 열립니다.

### 전송 결과 비교 뷰
옵션 페이지(`chrome://extensions` → AI Prompt Broadcaster → 세부정보 → 확장 옵션) 히스토리 탭에서 특정 전송 기록을 클릭하면 모달 하단에 서비스별 전송 결과(✅ 성공 / ❌ 실패 / ⏳ 요청만)가 카드 형태로 나열됩니다.

서비스별 결과는 문자열 한 개가 아니라 구조화된 결과 코드로 저장됩니다. 현재 주요 코드는 `submitted`, `selector_timeout`, `auth_required`, `submit_failed`, `strategy_exhausted`, `injection_timeout`, `cancelled`, `unexpected_error` 등입니다.

### 가져오기/내보내기와 상세 리포트
- JSON export는 항상 `version: 6`으로 기록됩니다.
- import는 `v1 -> v2 -> v3 -> v4 -> v5 -> v6` 단계형 마이그레이션을 거쳐 기존 데이터를 정규화합니다.
- `v6`에서는 즐겨찾기 `mode`, `steps`, `scheduleEnabled`, `scheduledAt`, `scheduleRepeat`, 히스토리 chain metadata와 함께 history resend용 `targetSnapshots`까지 보강합니다.
- popup과 options 모두 import 직후 상세 리포트 모달을 띄워 적용된 서비스, 거부된 서비스, 권한 거부 origin, ID 재작성, alias 검증 오류, built-in 보정 내역을 보여줍니다.

### Reset data
옵션 페이지의 **Reset data**는 background worker를 통해 실행됩니다. 진행 중인 방송을 먼저 정리한 뒤 히스토리, 즐겨찾기, 템플릿 캐시, 커스텀 서비스, `composeDraftPrompt`, `lastSentPrompt`, 전략 통계(`strategyStats`) 같은 local 데이터뿐 아니라 `pendingBroadcasts`, `pendingInjections`, `pendingUiToasts`, `lastBroadcast`, `popupPromptIntent`, `favoriteRunJobs` 같은 session/runtime 상태도 함께 초기화합니다.

### 새 AI 서비스 추가 방법
기본 내장 서비스 추가는 `src/config/sites/builtins.ts`에 새 항목을 추가하는 것입니다. `src/config/sites.ts`는 하위 호환용 re-export만 담당합니다.

예시:

```js
{
  id: "newai",
  name: "NewAI",
  url: "https://newai.example.com/",
  hostname: "newai.example.com",
  inputSelector: "textarea[name='prompt']",
  inputType: "textarea",
  submitSelector: "button[type='submit']",
  submitMethod: "click",
  waitMs: 2000,
  fallback: true,
  authSelectors: [
    "a[href*='login']",
    "input[type='password']"
  ]
}
```

추가 체크사항:
- 기존 도메인이 아니라면 [manifest.json](manifest.json)의 `host_permissions`와 `content_scripts.matches`에도 새 도메인을 추가해야 합니다.
- `inputSelector`는 가능한 한 안정적인 `id`, `data-testid`, `aria-label` 기반으로 잡는 것이 좋습니다.
- `waitMs`는 너무 짧게 잡지 말고 hydration 이후를 고려해 설정하세요.
- 변경 후 `npm run build`를 다시 실행해 `dist/`를 갱신하세요.

### 셀렉터가 깨졌을 때 직접 수정하는 방법
1. 문제 사이트를 Chrome에서 엽니다.
2. DevTools를 엽니다.
3. [tools/find_selector.js](tools/find_selector.js) 내용을 콘솔에 붙여넣고 실행합니다.
4. 콘솔에 출력된 후보 셀렉터와 추천 스니펫을 확인합니다.
5. [builtins.ts](src/config/sites/builtins.ts)에서 해당 서비스의 `inputSelector`, `submitSelector`, `inputType`을 수정합니다.
6. `npm run build`를 실행한 뒤 `chrome://extensions`에서 `dist` 확장 프로그램을 새로고침합니다.

참고:
- [`src/content/selector-checker/`](src/content/selector-checker) 모듈이 셀렉터 미검출과 인증 페이지 상태를 백그라운드로 보고합니다.
- 로그인 페이지로 리다이렉트된 경우에는 셀렉터가 정상이어도 자동 주입이 동작하지 않습니다.

### 기여 가이드라인
- 이슈를 열 때는 대상 서비스, URL, 로그인 상태, 실패 증상을 함께 적어주세요.
- 셀렉터 수정 PR에는 가능한 경우 DOM 스냅샷이나 DevTools 캡처를 포함해주세요.
- 새 서비스 추가 시 `src/config/sites/builtins.ts`, `manifest.json`, README의 서비스 표를 함께 업데이트해주세요.
- 사이트별 하드코딩보다 설정 기반 수정이 우선입니다.
- PR 설명에는 재현 방법과 확인 결과를 포함해주세요.

### 라이선스
MIT

---

## English

### Overview
`AI Prompt Broadcaster` is a Chrome Manifest V3 extension that sends a single prompt to ChatGPT, Gemini, Claude, Grok, and Perplexity from one popup UI.

It works without a backend or API keys by injecting prompts directly into each AI web app's input surface after the target tab loads.

The source of truth lives in `src/` as TypeScript modules. Chrome should load the built `dist/` output, and the root runtime JS files are generated mirrors refreshed by `npm run build`. The runtime entrypoints in `src/*/main.ts` stay intentionally thin while the implementation is split by feature into modules such as `src/background/{commands,context-menu,messages,popup,selection}`, `src/options/{core,features}`, `src/popup/features`, `src/shared/*`, `scripts/qa-smoke/*`, and CSS partials under `popup/styles/partials` and `options/styles/partials`.

For build and packaging steps, see [docs/build-guide.md](docs/build-guide.md). For the current architecture, see [docs/extension-architecture.md](docs/extension-architecture.md).

### Key Features
- Broadcast one prompt to multiple AI services from one popup
- **Dark mode plus popup keyboard shortcuts** — includes `Ctrl/Cmd+Enter`, `Ctrl/Cmd+Shift+Enter`, `Ctrl/Cmd+1..4`, and `Esc`
- Discover already-open AI tabs in the current window and reuse them by default
- Choose a specific open tab, force a new tab, or keep the default routing per service from the popup
- Automatic prompt history for successful broadcasts
- Favorites with editable titles and search across title, text, tags, and folders
- **Saved chain favorites** — build multi-step favorites with per-step delay and target overrides
- **Scheduled favorite runs** — store one-time or repeating schedules on favorites and manage them from the options `Schedules` surface
- **Quick palette overlay** — press `Alt+Shift+F` to search favorites on the current page and run them immediately when all inputs are resolvable
- **Favorites tag, folder, and pin system** — categorize saved prompts with tags and folders; pin important ones to the top
- **Favorite duplication and sort controls** — duplicate saved prompts and sort by recent use, usage count, title, or creation date
- **History resend selection and bulk delete tools** — choose a subset of the original services when replaying history and delete selected or aged entries from options
- **Per-service prompt overrides** — assign a different prompt to individual service cards without changing the main prompt
- JSON export/import for history, favorites, template cache, settings, and service configuration, including `broadcastCounter`, history resend snapshots, and export `version: 6`
- History keeps requested, submitted, failed, and per-site snapshot prompt data so partial broadcasts can be replayed accurately
- **Detailed import reports and structured result codes** — popup/options show rejected services, rewritten ids, built-in adjustments, and service-level result codes
- **Extended template variables** — 9+ system variables including `{{url}}`, `{{title}}`, `{{selection}}`, `{{counter}}`, and `{{random}}`
- Custom services can store fallback selectors, auth selectors, hostname aliases, and verification metadata
- Pure MV3 extension, no backend required
- Dynamic prompt injection using `chrome.scripting.executeScript`
- Central site configuration in `src/config/sites/builtins.ts`
- Perplexity prefers `#ask-input[data-lexical-editor='true']`, updates Lexical state from the page's `MAIN` world, and keeps the legacy submit path for dispatch
- Global wait scaling (`waitMsMultiplier`) and internally persisted adaptive strategy stats improve reliability on slow or changing sites
- Click-submit flows wait for the submit button to become enabled so async React editors can finish state updates before submission
- Clipboard copy fallback and non-blocking banner on injection failure
- Selector self-diagnostics with Chrome notifications; **Report issue button** appears in service management for affected services
- **Broadcast result comparison view** in the options page history detail modal
- Popup-open requests can fall back to a standalone extension window when Chrome cannot open the toolbar action popup from the background worker
- Developer helper script for finding replacement selectors

### Supported AI Services

| Service | URL | Injection Method | Status |
|---|---|---|---|
| ChatGPT | `https://chatgpt.com/` | `contenteditable` + click submit | Supported, Best effort |
| Gemini | `https://gemini.google.com/app` | `contenteditable` + click submit | Supported, Best effort |
| Claude | `https://claude.ai/new` | `contenteditable` + click submit | Supported, Best effort |
| Grok | `https://grok.com/` | `contenteditable` + click submit | Supported, Best effort |
| Perplexity | `https://www.perplexity.ai/` | `contenteditable` + click submit | Supported, Best effort |

`Best effort` means injection can break when a target site changes its DOM, redirects to login, or blocks synthetic input events.

Perplexity note:
- The visible composer is backed by a Lexical editor, so the extension prioritizes `#ask-input[data-lexical-editor='true']` over broader textbox selectors.
- Text injection runs in the page `MAIN` world to stay in sync with Lexical state, while submission still uses the standard click-submit flow.

### Who This Is For
- People who want to send the same prompt to multiple AI services and compare responses
- Prompt engineers and developers running repeated prompt experiments
- Users who want to avoid manually opening several AI tabs and pasting the same prompt over and over

### Installation
#### 1. Clone the repository
```bash
git clone https://github.com/twbeatles/prompt-broadcaster.git
cd prompt-broadcaster
npm install
npm run build
```

#### 2. Load the extension in Chrome
1. Open `chrome://extensions`.
   Screenshot placeholder: `docs/assets/install-step-1-extensions-page.png`
2. Enable `Developer mode` in the top-right corner.
   Screenshot placeholder: `docs/assets/install-step-2-developer-mode.png`
3. Click `Load unpacked`.
   Screenshot placeholder: `docs/assets/install-step-3-load-unpacked.png`
4. Select the `dist` folder of this project.
   Screenshot placeholder: `docs/assets/install-step-4-select-folder.png`
5. Confirm that the extension loads without manifest errors.
   Screenshot placeholder: `docs/assets/install-step-5-extension-loaded.png`

### Usage
1. Click the `AI Prompt Broadcaster` icon in the Chrome toolbar.
2. Enter a prompt. System template variables like `{{url}}` or `{{date}}` are replaced automatically at send time.
3. Select one or more target AI services.
4. Optionally expand a service card to set a **per-service prompt override** that replaces the main prompt for that service only.
5. Optionally choose `default behavior`, `always open a new tab`, or a specific already-open AI tab for each selected service.
6. Click `Send` or press `Ctrl/Cmd+Enter`.
7. Use `Ctrl/Cmd+Shift+Enter` to cancel an in-flight broadcast.
8. The extension reuses matching tabs in the current window when that setting is enabled, otherwise it opens fresh tabs.
9. Tabs are focused and processed in sequence so prompt injection can run against focus-sensitive editors more reliably.
10. If automatic injection fails, a fallback banner appears and the prompt is copied to the clipboard when possible.
11. Favorites can be saved as single prompts, scheduled runs, or multi-step chains.
12. Press `Alt+Shift+F` to open the quick palette on the current page and search favorites without opening the popup first.
13. Replaying a history item opens a service picker so you can resend only a subset of the originally requested services.
14. Open the options page and use **Open details** on any history row to see a per-service result comparison (✅ / ❌ / ⏳) in the detail modal.

If a keyboard shortcut or notification tries to reopen the UI while Chrome has no active browser window, the extension stores a one-shot popup prompt intent first and falls back to a standalone popup window when needed.

GIF placeholder: `docs/assets/usage-demo.gif`

### Tab Routing and Reuse
- The popup can list currently open AI tabs in the active browser window and let you target a specific tab per service.
- A reusable-tab setting is available in both the popup settings tab and the options page.
- The default routing mode reuses a matching open AI tab before opening a new one when `reuseExistingTabs` is enabled.
- Reuse candidates must still pass a lightweight preflight: matching service host, non-auth/non-settings route, visible editable prompt surface, and submit surface availability when the service requires click-submit.
- Cancelling a broadcast closes only tabs opened by the current broadcast and leaves reused conversation tabs untouched.

### Template Variables
Template prompts support both user-defined variables and built-in system variables.

**System variables (auto-filled)**

| Variable | Korean alias | Description |
|---|---|---|
| `{{date}}` | `{{날짜}}` | Today's date |
| `{{time}}` | `{{시간}}` | Current time |
| `{{weekday}}` | `{{요일}}` | Day of the week |
| `{{clipboard}}` | `{{클립보드}}` | Clipboard text |
| `{{url}}` | `{{주소}}` | Active tab URL |
| `{{title}}` | `{{제목}}` | Active tab page title |
| `{{selection}}` | `{{선택}}` | Text selected on the active tab |
| `{{counter}}` | `{{카운터}}` | Cumulative count of broadcasts that queued at least one target |
| `{{random}}` | `{{랜덤}}` | Random number between 1 and 1000 |

`url`, `title`, and `selection` are read from the active browser tab via the background service worker at send time.

**User variables** — any other `{{name}}` is treated as a user variable. The popup opens a fill-in modal and caches the entered values for reuse.

### Favorites Tag, Folder, and Pin System
- Open the `···` menu on any favorite entry and choose **Edit tags & folder** to assign comma-separated tags and a folder name (up to 50 characters).
- Use **Pin to top** / **Unpin** from the same menu to keep important favorites at the top of the list.
- Use **Duplicate** from the same menu to create a `[Copy]` clone of an existing favorite.
- A filter bar above the favorites list shows tag and folder chips for one-click filtering.
- The favorites search box matches title, body text, tags, and folder names. Queries like `#urgent` also match tags directly.
- Favorite sorting supports recent use, usage count, title, and created date. Sorting is applied inside pinned and unpinned groups separately.

### Favorite Chains, Schedules, and Quick Palette
- The favorite editor supports `Single` and `Chain` modes. Chain favorites can add steps, reorder them, apply per-step delays, and override the target services for each step.
- Leaving a chain step target list empty makes that step inherit the favorite's default targets.
- Chain execution is sequential. If any step finishes with a result other than `submitted`, the remaining steps are skipped.
- Favorites can store one-time or repeating schedules (`daily`, `weekday`, `weekly`) and the options page exposes a dedicated `Schedules` section for toggle, `Run now`, and `Edit in popup` actions.
- Scheduled execution auto-resolves only `{{date}}`, `{{time}}`, `{{weekday}}`, `{{random}}`, and `{{counter}}`. Favorites that need `{{url}}`, `{{title}}`, `{{selection}}`, or `{{clipboard}}` are skipped and recorded as failed schedule runs.
- Popup-triggered favorite runs pre-resolve `{{url}}`, `{{title}}`, `{{selection}}`, and `{{clipboard}}` before handing off to the background worker. Popup fallbacks from quick palette or options retry automatically once that context is available.
- Favorite runs now queue as background jobs immediately, dedupe only overlapping `queued/running` runs for the same favorite, and expose a light `queued/running/done/failed` status in popup and options.
- The quick palette uses a shadow-root overlay on the current page. Its search behavior now matches popup favorite search across title, body text, folder, tags, and `#tag` queries. Fully resolvable favorites run immediately; favorites that still need popup input fall back through a popup handoff intent.

### Popup Shortcuts and Sorting
- `Ctrl/Cmd+Enter` sends the current prompt, and `Ctrl/Cmd+Shift+Enter` cancels the active broadcast.
- `Ctrl/Cmd+1..4` switches between Compose, History, Favorites, and Settings.
- `Esc` closes the currently open modal or menu.
- `Ctrl/Cmd+A` toggles all services only when focus is outside a text field; normal select-all behavior is preserved inside inputs.
- History and favorites support keyboard roving focus and have popup sort controls for display order.
- Reopening the popup restores the unsent compose draft first; one-shot popup handoff prompts override the draft only once and are then consumed.

### Per-Service Prompt Overrides
Expand a service card in the compose view and enable the **Custom prompt for this service** toggle to enter a prompt that will be used exclusively for that service. The main prompt is used when the override is left blank or the toggle is off.
Both the main prompt and per-service overrides go through the same template-variable resolution flow, and retry/history replay actions reuse the exact resolved prompt captured by the original broadcast snapshot.

### Selector Error Reporting
When the selector checker detects a stale or missing selector (⚠), a **Report issue** link appears in the settings tab's service management card for that service. Clicking it opens a GitHub issue search scoped to that service so you can check existing reports or file a new one.

### Broadcast Result Comparison View
The options page history detail modal now includes a **Broadcast results** section listing every requested service with its outcome: ✅ succeeded, ❌ failed, or ⏳ requested but no result recorded. Successful rows include an **Open** link pointing to the service URL.

Each stored service result now uses a structured code rather than a free-form string. Main codes include `submitted`, `selector_timeout`, `auth_required`, `submit_failed`, `strategy_exhausted`, `injection_timeout`, `cancelled`, and `unexpected_error`.

### History and Favorites Semantics
- History entries now store `requestedSiteIds`, `submittedSiteIds`, and `failedSiteIds`.
- History entries also store `targetSnapshots`, which capture the original per-site resolved prompt and routing mode used for replay.
- The legacy `sentTo` field is still exported for backward compatibility and mirrors the submitted service ids.
- `appSettings.historyLimit` is a non-destructive default visible cap for popup/options history lists. Lowering it does not delete stored history, and exports still include the full stored history.
- Reloading a history entry or creating a favorite from it uses `targetSnapshots` first, then falls back to requested services for legacy data, so partially failed broadcasts can be retried with the original target list and prompt text intact.
- Favorite records also track `mode`, `steps`, `scheduleEnabled`, `scheduledAt`, `scheduleRepeat`, `usageCount`, and `lastUsedAt`.
- History rows can carry `originFavoriteId`, `chainRunId`, `chainStepIndex`, `chainStepCount`, and `trigger` so chain runs and scheduled executions remain traceable.

### Import / Export and Detailed Reports
- JSON export always writes `version: 6`.
- Import applies staged migrations from older payloads (`v1 -> v2 -> v3 -> v4 -> v5 -> v6`) before normalizing settings, favorites, and history records.
- `v6` backfills history resend `targetSnapshots` in addition to prior favorite chain/schedule fields, chain-related history metadata, and result normalization.
- Both popup and options show a detailed import report modal listing accepted services, rejected services, denied origins, rewritten ids, alias validation errors, and built-in override adjustments.

### Custom Service Advanced Settings
The popup service editor supports the following advanced fields for custom services:

- `fallbackSelectors`: alternate selectors checked when the primary input selector fails
- `authSelectors`: selectors that indicate a dedicated login or auth screen when no prompt surface is visible
- `hostnameAliases`: extra allowed hostnames for redirects or alternate app domains
- `lastVerified`: a free-form verification date such as `2026-03`
- `verifiedVersion`: a free-form UI or app build tag

If `submitMethod` is `click`, `submitSelector` is required and validation blocks saving until it is provided.

Custom service permissions are managed per site, not per single URL field:

- optional host permissions are derived from the service `url` plus every `hostnameAliases` entry
- `hostnameAliases` lines must be valid `host[:port]` entries or absolute `http/https` URLs before save/import continues
- save and JSON import are all-or-nothing for a custom service if any required origin is denied
- deleting a custom service, resetting service settings, or replacing custom services through JSON import removes only the unused optional origins

### Limitations
- You must already be logged in to each target AI service.
- The extension depends on each site's DOM structure and selectors, so automatic injection can break when a site updates its UI.
- Open-tab discovery is scoped to a normal Chrome browser window and only considers tabs that map back to a configured service and still expose a usable prompt surface.
- Some services may restrict automation or synthetic input events, which can force the fallback flow.
- Support is provided on a best-effort basis and is not guaranteed to work in every environment.

### Privacy and Data Handling
- This project does not require a backend server.
- Prompts are sent directly from the user's browser to the target AI service tabs.
- History and favorites are stored in the browser's local storage.
- No API keys are required, and prompts are not relayed through a separate server.

### Adding a New AI Service
The primary change goes into `src/config/sites/builtins.ts`.

Example:

```js
{
  id: "newai",
  name: "NewAI",
  url: "https://newai.example.com/",
  hostname: "newai.example.com",
  hostnameAliases: [
    "app.newai.example.com"
  ],
  inputSelector: "textarea[name='prompt']",
  fallbackSelectors: [
    "textarea",
    "div[contenteditable='true'][role='textbox']"
  ],
  inputType: "textarea",
  submitSelector: "button[type='submit']",
  submitMethod: "click",
  waitMs: 2000,
  fallback: true,
  authSelectors: [
    "a[href*='login']",
    "input[type='password']"
  ],
  lastVerified: "2026-03",
  verifiedVersion: "newai-web-mar-2026"
}
```

Additional notes:
- If the service uses a new domain, also update `host_permissions` and `content_scripts.matches` in [manifest.json](manifest.json).
- Prefer stable selectors using `id`, `data-testid`, or `aria-label`.
- Set `waitMs` conservatively to account for hydration and delayed editors.
- Run `npm run build` again after any source change so both `dist/` and the generated root runtime mirrors stay current.

### Local Smoke QA
The repository includes Playwright-based local fixtures under `qa/fixtures/`, orchestrated by `scripts/qa-smoke.mjs` with helper modules under `scripts/qa-smoke/`.

Run the local smoke flow with:

```bash
npm run build
npm run qa:smoke
```

The smoke script verifies:

- direct selector injection
- fallback selector injection
- visible element preference when hidden matches exist
- delayed click-submit activation for async contenteditable editors
- `click`, `enter`, and `shift+enter` submission paths
- selector checker `ok` reporting
- auth page detection through `authSelectors`
- custom service permission cleanup for shared and unused origins
- JSON import repair for alias-based custom service permissions and invalid built-in click-submit overrides
- `broadcastCounter` export/import/reset semantics
- import migration to export `version: 6` defaults
- history replay snapshot fallback and resend routing safety
- draft-first popup restore and popup handoff consumption
- favorite background job dedupe helpers and runtime-state cleanup
- quick palette filtering and execution handoff
- favorite chain/schedule field normalization for legacy imports
- favorites search across title, text, tags, folders, and `#tag`
- per-service override template resolution and retry prompt preservation
- CSV export escaping for spreadsheet formula-leading cells
- pending broadcast state accumulation across sequential completions with structured `siteResults`
- adaptive strategy-stat accumulation for injector attempts
- reusable-tab preflight rejection for auth/settings/non-input tabs
- reset helper cleanup for both local and session runtime state

If Chromium is not installed yet for Playwright, run:

```bash
npx playwright install chromium
```

### How to Fix Broken Selectors
1. Open the target AI site in Chrome.
2. Open DevTools.
3. Paste [tools/find_selector.js](tools/find_selector.js) into the console and run it.
4. Review the candidate selectors and the generated config snippet.
5. Update the matching service entry in [builtins.ts](src/config/sites/builtins.ts).
6. Run `npm run build`, then reload the `dist` extension in `chrome://extensions` and test again.

Related:
- The [`src/content/selector-checker/`](src/content/selector-checker) module reports stale selectors and auth-page states back to the background worker.
- If the tab redirects to a login screen, injection is expected to stop.

### Contributing
- Open an issue with the target service, URL, login state, and failure symptoms.
- Include DOM snapshots or DevTools screenshots when reporting selector breakage.
- When adding a new service, update `src/config/sites/builtins.ts`, `manifest.json`, and the README support table together.
- Prefer config-driven fixes over site-specific hardcoded logic.
- Include reproduction steps and validation notes in every PR.

### License
MIT
