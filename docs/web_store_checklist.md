# Chrome Web Store 배포 체크리스트

## 1. 스토어 등록 정보

- 확장 프로그램 이름: `AI Prompt Broadcaster`
- 짧은 설명: 하나의 프롬프트를 여러 AI 서비스 탭으로 전송하는 Chrome 확장 프로그램
- 상세 설명에는 아래 내용을 포함합니다.
  - 지원 서비스 범위: ChatGPT, Gemini, Claude, Grok, Perplexity
  - 동작 방식: 사용자가 로그인한 AI 웹앱 탭을 열고 DOM 입력창에 프롬프트를 주입
  - 데이터 저장 범위: 로컬 브라우저 저장소 기반 히스토리, 즐겨찾기, 템플릿 변수 캐시
  - 주요 편의 기능: 템플릿 변수, 히스토리/즐겨찾기, 대시보드, 단축키, 컨텍스트 메뉴

## 2. 개인정보처리방침

- 이 프로젝트는 GitHub Pages 또는 별도 호스팅을 통해 개인정보처리방침 웹페이지를 반드시 공개 URL로 발행해야 합니다.
- 저장소 내 초안 문서는 `docs/privacy-policy.md`에 있습니다.
- Web Store 등록 시에는 로컬 파일 경로가 아니라 외부에서 접근 가능한 HTTPS URL을 입력해야 합니다.
- 핵심 문구에는 아래 내용을 포함하는 것이 좋습니다.
  - 사용자의 프롬프트, 히스토리, 즐겨찾기, 템플릿 변수 값은 기본적으로 사용자의 브라우저 로컬 저장소에만 보관됩니다.
  - 확장 프로그램 자체 서버는 없으며, 데이터는 확장 프로그램 개발자 서버로 전송되지 않습니다.
  - 사용자가 전송을 실행하면 프롬프트는 선택한 제3자 AI 서비스 웹사이트로 전달됩니다.
  - 데이터 판매 및 제3자 공유를 하지 않습니다. 단, 사용자가 직접 선택한 AI 서비스로의 전송은 기능 수행에 포함됩니다.

## 3. 현재 권한 점검

현재 `manifest.json` 기준 권한은 아래와 같습니다.

### 필수 권한

- `activeTab`
  - 현재 탭의 선택 텍스트를 읽는 단축키/컨텍스트 메뉴 흐름에 사용
- `tabs`
  - 대상 AI 서비스 탭 생성, 현재 창의 열린 AI 탭 탐지, 탭 상태 추적에 사용
- `scripting`
  - 대상 탭에 injector 및 selection script를 주입하는 데 사용
- `alarms`
  - MV3 서비스 워커 재조정 및 keepalive 보조 처리에 사용
- `clipboardWrite`
  - 자동 주입 실패 시 프롬프트를 클립보드에 복사하는 폴백에 사용
- `storage`
  - 히스토리, 즐겨찾기, 템플릿 변수 캐시, 런타임 상태 저장에 사용
- `notifications`
  - 전송 완료 알림 및 셀렉터 변경 감지 알림에 사용
- `contextMenus`
  - 선택 텍스트 우클릭 메뉴에 사용

### 선택 권한

- `clipboardRead`
  - `{{클립보드}}` 템플릿 변수를 사용할 때만 요청

### 필수 호스트 권한

- `https://chatgpt.com/*`
- `https://gemini.google.com/*`
- `https://claude.ai/*`
- `https://grok.com/*`
- `https://www.perplexity.ai/*`
- `https://perplexity.ai/*`

### 선택 호스트 권한

- `https://*/*`
- `http://*/*`

선택 호스트 권한은 커스텀 서비스 추가 시 optional permission 요청 흐름에 사용됩니다.

### 호스트 권한 사용 근거

- 기본 호스트 권한(`chatgpt.com`, `gemini.google.com`, `claude.ai`, `grok.com`, `www.perplexity.ai`, `perplexity.ai`)은 해당 지원 사이트에서만 content script를 실행하고, 입력창 탐지, 전송 버튼 탐지, 열린 탭 재사용, 자동 프롬프트 주입/전송을 수행하기 위해 필요합니다.
- 기본 호스트 권한은 범용 웹 탐색 추적이나 임의 사이트 데이터 수집을 위한 것이 아니라, 사용자가 명시적으로 선택한 지원 AI 웹앱에서 확장 기능을 동작시키기 위한 최소 범위 접근입니다.
- 선택 호스트 권한(`https://*/*`, `http://*/*`)은 매니페스트에 넓게 선언되어 있지만, 실제 권한 요청은 사용자가 사용자 정의 AI 서비스를 추가할 때 그 서비스의 정확한 origin 패턴에 대해서만 런타임에 수행됩니다.
- 사용자 정의 서비스 권한이 승인되지 않으면 해당 서비스에는 selector test, 열린 탭 재사용, 자동 입력/전송 기능을 적용하지 않습니다.
- 제출 시에는 [web-store-copy.md](/d:/twbeatles-repos/prompt-broadcaster/docs/web-store-copy.md)와 [privacy-policy.md](/d:/twbeatles-repos/prompt-broadcaster/docs/privacy-policy.md)의 동일한 설명과 표현을 맞춰 두는 것이 좋습니다.

## 4. 보안 및 정책 확인

- `manifest.json`의 `content_security_policy.extension_pages`가 원격 스크립트를 허용하지 않는지 확인합니다.
- `eval`, `new Function`, 원격 코드 로더가 없는지 확인합니다.
- 사용자 입력이 `innerHTML`로 직접 삽입되지 않는지 확인합니다.
- 주입 실패 UI는 `alert()` 대신 비차단 토스트/배너 기반으로 동작하는지 확인합니다.
- 수집하는 데이터가 Chrome Web Store의 단일 목적 원칙과 맞는지 설명 문구를 준비합니다.

## 5. 빌드 및 패키징 절차

개발/검수용 로드 대상은 프로젝트 루트가 아니라 `dist/`입니다.

### 사전 준비

```bash
npm install
npm run typecheck
npm run build
npm run qa:smoke
```

`qa:smoke`는 `dist/` 기준 주입/전송 경로를 로컬 fixture로 검증합니다. 다만 실제 Chrome 툴바 팝업 동작, 열린 탭 재사용, 실서비스 Claude 전송 성공 여부는 수동 검수가 필요합니다.

### 로컬 테스트

1. `chrome://extensions`를 엽니다.
2. 개발자 모드를 활성화합니다.
3. `압축해제된 확장 프로그램을 로드합니다`를 클릭합니다.
4. 프로젝트 루트가 아니라 `dist/` 폴더를 선택합니다.

### ZIP 패키징

- Windows:

```powershell
powershell -ExecutionPolicy Bypass -File .\package.ps1
```

- macOS / Linux:

```bash
bash ./package.sh
```

생성되는 ZIP은 `dist/` 산출물만 포함합니다.

스토어 업로드 파일은 루트의 `prompt-broadcaster-v<version>.zip` 하나로 정리하는 것을 권장합니다.

## 6. 그래픽 에셋

- 스토어 아이콘: `128x128`
- 스크린샷: 1~5장
- 작은 프로모션 타일: `440x280`
- 큰 프로모션 타일: 선택
- 소개 영상: 선택

현재 저장소의 `icons/`는 개발용 기준이므로, Web Store 제출 전에는 실제 브랜딩용 최종 에셋으로 교체 여부를 검토하는 것이 좋습니다.

## 7. 제출 전 최종 체크

- `npm run build` 후 `dist/manifest.json`이 최신 상태인지 확인
- `dist/`를 로드했을 때 manifest 오류가 없는지 확인
- 팝업을 처음 열었을 때 즐겨찾기 저장 모달이 자동으로 뜨지 않는지 확인
- 즐겨찾기 저장 모달에서 `닫기`/`취소`/`저장` 버튼이 모두 정상 동작하는지 확인
- 히스토리/즐겨찾기/템플릿/대시보드/옵션 페이지가 정상 동작하는지 확인
- 단축키와 컨텍스트 메뉴 동작을 확인
- ChatGPT, Gemini, Claude, Grok, Perplexity에 각각 한 번씩 실제 전송을 시도하고 특히 Claude와 Perplexity의 전송 버튼 경로를 확인
- 현재 창의 열린 AI 탭 재사용 설정과 서비스별 특정 탭 선택 UI를 확인
- 알림 권한, optional clipboard permission 요청 흐름을 확인
- 공개된 개인정보처리방침 URL을 준비했는지 확인
- 업로드 ZIP이 `dist/` 기준으로 생성되었는지 확인
