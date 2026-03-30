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
`AI Prompt Broadcaster`는 팝업에서 한 번 입력한 프롬프트를 ChatGPT, Gemini, Claude, Grok으로 동시에 전송하는 Chrome Manifest V3 확장 프로그램입니다.

백엔드나 API 키 없이, 사용자가 이미 로그인한 각 AI 웹앱의 DOM 입력창에 직접 프롬프트를 주입하는 방식으로 동작합니다.

현재 소스 코드는 `src/` 아래 TypeScript 모듈로 관리되며, Chrome에는 `dist/` 산출물을 로드합니다.

빌드 및 패키징 절차는 [docs/build-guide.md](docs/build-guide.md), 현재 구조 설명은 [docs/extension-architecture.md](docs/extension-architecture.md)를 참고하세요.

### 주요 기능
- 하나의 프롬프트를 여러 AI 서비스에 병렬 전송
- 전송 성공 프롬프트 히스토리 자동 저장
- 즐겨찾기 저장, 제목 편집, 검색
- 히스토리/즐겨찾기 JSON 내보내기 및 가져오기
- Chrome MV3 기반, 백엔드 없음
- `chrome.scripting.executeScript` 기반 동적 주입
- 사이트별 셀렉터와 전략을 `src/config/sites.ts`에서 중앙 관리
- 입력 실패 시 클립보드 복사 + 비차단 폴백 배너 제공
- 셀렉터가 깨졌을 때 자동 진단 및 알림
- 개발자용 셀렉터 탐지 스크립트 제공

### 지원 AI 서비스

| 서비스 | URL | 주입 방식 | 현재 상태 |
|---|---|---|---|
| ChatGPT | `https://chatgpt.com/` | `contenteditable` + 버튼 클릭 | 지원, Best effort |
| Gemini | `https://gemini.google.com/app` | `contenteditable` + 버튼 클릭 | 지원, Best effort |
| Claude | `https://claude.ai/new` | `contenteditable` + 버튼 클릭 | 지원, Best effort |
| Grok | `https://grok.com/` | `textarea` + 버튼 클릭 | 지원, Best effort |

`Best effort`는 대상 사이트의 DOM 구조 변경, 로그인 상태, 반자동화 정책에 따라 주입 성공률이 달라질 수 있음을 의미합니다.

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
2. 프롬프트를 입력합니다.
3. 전송할 AI 서비스를 선택합니다.
4. `Send` 버튼을 누릅니다.
5. 선택한 서비스별 새 탭이 열리고, 각 사이트에서 자동 주입과 전송을 시도합니다.
6. 실패한 경우 클립보드 복사 및 수동 전송 안내 배너가 표시됩니다.

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

### 새 AI 서비스 추가 방법
기본 작업은 `src/config/sites.ts`에 새 항목을 추가하는 것입니다.

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
5. [sites.ts](src/config/sites.ts)에서 해당 서비스의 `inputSelector`, `submitSelector`, `inputType`을 수정합니다.
6. `npm run build`를 실행한 뒤 `chrome://extensions`에서 `dist` 확장 프로그램을 새로고침합니다.

참고:
- [helper.ts](src/content/selector-checker/helper.ts)가 셀렉터 미검출 시 알림을 띄웁니다.
- 로그인 페이지로 리다이렉트된 경우에는 셀렉터가 정상이어도 자동 주입이 동작하지 않습니다.

### 기여 가이드라인
- 이슈를 열 때는 대상 서비스, URL, 로그인 상태, 실패 증상을 함께 적어주세요.
- 셀렉터 수정 PR에는 가능한 경우 DOM 스냅샷이나 DevTools 캡처를 포함해주세요.
- 새 서비스 추가 시 `src/config/sites.ts`, `manifest.json`, README의 서비스 표를 함께 업데이트해주세요.
- 사이트별 하드코딩보다 설정 기반 수정이 우선입니다.
- PR 설명에는 재현 방법과 확인 결과를 포함해주세요.

### 라이선스
MIT

---

## English

### Overview
`AI Prompt Broadcaster` is a Chrome Manifest V3 extension that sends a single prompt to ChatGPT, Gemini, Claude, and Grok from one popup UI.

It works without a backend or API keys by injecting prompts directly into each AI web app's input surface after the target tab loads.

The source of truth lives in `src/` as TypeScript modules, and Chrome should load the built `dist/` output.

For build and packaging steps, see [docs/build-guide.md](docs/build-guide.md). For the current architecture, see [docs/extension-architecture.md](docs/extension-architecture.md).

### Key Features
- Send one prompt to multiple AI services in parallel
- Automatic prompt history for successful broadcasts
- Favorites with editable titles and live search
- JSON export/import for history and favorites
- Pure MV3 extension, no backend required
- Dynamic prompt injection using `chrome.scripting.executeScript`
- Central site configuration in `src/config/sites.ts`
- Clipboard copy fallback and non-blocking banner on injection failure
- Selector self-diagnostics with Chrome notifications
- Developer helper script for finding replacement selectors

### Supported AI Services

| Service | URL | Injection Method | Status |
|---|---|---|---|
| ChatGPT | `https://chatgpt.com/` | `contenteditable` + click submit | Supported, Best effort |
| Gemini | `https://gemini.google.com/app` | `contenteditable` + click submit | Supported, Best effort |
| Claude | `https://claude.ai/new` | `contenteditable` + click submit | Supported, Best effort |
| Grok | `https://grok.com/` | `textarea` + click submit | Supported, Best effort |

`Best effort` means injection can break when a target site changes its DOM, redirects to login, or blocks synthetic input events.

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
2. Enter a prompt.
3. Select one or more target AI services.
4. Click `Send`.
5. The extension opens one tab per selected service and attempts prompt injection.
6. If automatic injection fails, a fallback banner appears and the prompt is copied to the clipboard when possible.

GIF placeholder: `docs/assets/usage-demo.gif`

### Limitations
- You must already be logged in to each target AI service.
- The extension depends on each site's DOM structure and selectors, so automatic injection can break when a site updates its UI.
- Some services may restrict automation or synthetic input events, which can force the fallback flow.
- Support is provided on a best-effort basis and is not guaranteed to work in every environment.

### Privacy and Data Handling
- This project does not require a backend server.
- Prompts are sent directly from the user's browser to the target AI service tabs.
- History and favorites are stored in the browser's local storage.
- No API keys are required, and prompts are not relayed through a separate server.

### Adding a New AI Service
The primary change goes into `src/config/sites.ts`.

Example:

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

Additional notes:
- If the service uses a new domain, also update `host_permissions` and `content_scripts.matches` in [manifest.json](manifest.json).
- Prefer stable selectors using `id`, `data-testid`, or `aria-label`.
- Set `waitMs` conservatively to account for hydration and delayed editors.
- Run `npm run build` again after any source change so `dist/` stays current.

### How to Fix Broken Selectors
1. Open the target AI site in Chrome.
2. Open DevTools.
3. Paste [tools/find_selector.js](tools/find_selector.js) into the console and run it.
4. Review the candidate selectors and the generated config snippet.
5. Update the matching service entry in [sites.ts](src/config/sites.ts).
6. Run `npm run build`, then reload the `dist` extension in `chrome://extensions` and test again.

Related:
- [helper.ts](src/content/selector-checker/helper.ts) warns when configured selectors no longer match the page.
- If the tab redirects to a login screen, injection is expected to stop.

### Contributing
- Open an issue with the target service, URL, login state, and failure symptoms.
- Include DOM snapshots or DevTools screenshots when reporting selector breakage.
- When adding a new service, update `src/config/sites.ts`, `manifest.json`, and the README support table together.
- Prefer config-driven fixes over site-specific hardcoded logic.
- Include reproduction steps and validation notes in every PR.

### License
MIT
