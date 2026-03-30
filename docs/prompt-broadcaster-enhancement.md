# AI Prompt Broadcaster — 고도화 Codex 프롬프트 명세서

> **사용 방법**: 이 문서를 AI(Claude, ChatGPT, Codex 등)에게 통째로 붙여넣은 뒤,
> "PHASE 7-A부터 순서대로 구현해줘" 또는 "PHASE 7-C만 구현해줘"처럼 지시하면 됩니다.
> 각 Phase는 독립적으로도, 누적 컨텍스트로도 사용 가능합니다.

---

## 📌 프로젝트 개요

| 항목 | 내용 |
|------|------|
| 프로젝트명 | AI Prompt Broadcaster |
| 리포지토리 | `prompt-broadcaster` |
| 목적 | 프롬프트 하나를 ChatGPT / Gemini / Claude / Grok에 동시 전송하는 Chrome 확장 프로그램 |
| 기술 스택 | Chrome Extension Manifest V3, TypeScript + esbuild, Chrome APIs (`storage`, `scripting`, `tabs`, `notifications`) |
| 현재 상태 | 기본 기능(팝업 입력 → 탭 생성 → DOM 주입 → 전송) 구현 완료 |
| 고도화 목표 | UI/UX 개선, 히스토리·즐겨찾기, 서비스 커스터마이징, 템플릿 변수, 대시보드, 단축키, 다국어, 배포 준비 |

---

## ⚠️ 현재 코드베이스 기준 메모

이 문서는 고도화 요구사항을 정리한 프롬프트 문서이며, 문서 안의 일부 파일 경로는 작성 당시 구조를 기준으로 합니다. 현재 실제 소스 구조는 `src/`, 실제 Chrome 로드 대상은 `dist/`입니다.

자주 바뀐 경로 매핑:

- `config/sites.js` → `src/config/sites.ts`
- `shared/prompt_store.js` → `src/shared/stores/prompt-store.ts`
- `shared/sites_store.js` → `src/shared/stores/sites-store.ts`
- `shared/runtime_state.js` → `src/shared/stores/runtime-state.ts`
- `background/service_worker.js` → `src/background/main.ts`
- `popup/popup.js` → `src/popup/main.ts`
- `options/options.js` → `src/options/main.ts`
- `content/injector.js` → `src/content/injector/main.ts`
- `content/selector_checker.js` → `src/content/selector-checker/main.ts`
- `content/selection.js` → `src/content/selection/main.ts`

과거 프롬프트의 요구사항을 현재 코드에 적용할 때는 위 매핑을 기준으로 해석하면 됩니다.

---

## 🗺️ 고도화 로드맵

| Phase | 내용 | 난이도 | 우선순위 |
|-------|------|--------|---------|
| 7-A | UI/UX 전면 개선 | ⭐⭐ | 🔴 높음 |
| 7-B | 히스토리 & 즐겨찾기 | ⭐⭐ | 🔴 높음 |
| 7-C | 서비스 커스터마이징 UI | ⭐⭐⭐ | 🟡 중간 |
| 7-D | 템플릿 변수 치환 | ⭐⭐⭐ | 🟡 중간 |
| 7-E | 전송 결과 대시보드 | ⭐⭐⭐ | 🟡 중간 |
| 7-F | 단축키 & 컨텍스트 메뉴 | ⭐⭐ | 🔴 높음 |
| 7-G | 다국어 지원 (i18n) | ⭐ | 🟢 낮음 |
| 7-H | 보안 강화 & 배포 준비 | ⭐⭐⭐ | 🔴 높음 |

**권장 구현 순서**: 7-A → 7-F → 7-B → 7-H → 7-C → 7-D → 7-E → 7-G

---

## 📁 현재 파일 구조 (고도화 전 기준)

```
prompt-broadcaster/
├── manifest.json
├── config/
│   └── sites.js              # AI 서비스 셀렉터 중앙 설정
├── background/
│   └── service_worker.js     # 탭 생성 및 메시지 중계
├── popup/
│   ├── popup.html
│   └── popup.js
└── content/
    └── injector.js           # DOM 주입 범용 로직
```

---

## PHASE 7-A: UI/UX 전면 개선

```
당신은 Chrome 확장 프로그램 전문 UI/UX 디자이너이자 프론트엔드 개발자입니다.

현재 AI Prompt Broadcaster 확장 프로그램의 팝업 UI를 전면 개선해주세요.

---

[현재 상태]
- 단순 textarea + 체크박스 + Send 버튼 구조
- 인라인 스타일 기반, 디자인 미흡

---

[개선 요구사항]

1. 비주얼 디자인
   - 각 AI 서비스 카드형 UI로 변경
     (체크박스 대신 토글 카드: 선택 시 해당 서비스 컬러로 하이라이트)
   - ChatGPT: #10a37f / Gemini: #4285f4 / Claude: #d97706 / Grok: #000000
   - 팝업 크기: 너비 420px, 최대 높이 600px (스크롤 없이 보이도록)
   - 폰트: system-ui 기반, 한국어 최적화 (word-break: keep-all)
   - 전송 버튼: 그라디언트 + 클릭 시 ripple 애니메이션
   - 다크모드: prefers-color-scheme 자동 대응

2. 프롬프트 입력 영역
   - 글자 수 실시간 카운터 표시 (예: 42 / 2000자)
   - 입력 중 textarea 높이 자동 확장 (min 100px, max 300px)
   - placeholder: 서비스별 팁 문구를 랜덤으로 표시
   - 입력 내용 지우기(X) 버튼

3. 전송 상태 피드백
   - Send 클릭 시 버튼이 로딩 스피너로 전환
   - 각 서비스 카드에 전송 완료 체크마크 순차 표시 (애니메이션)
   - 전송 실패한 서비스는 카드에 빨간 X + 재시도 버튼 표시

4. 접근성
   - 모든 인터랙티브 요소에 aria-label 추가
   - Tab 키 포커스 순서 논리적으로 정렬
   - 고대비 모드(prefers-contrast: high) 대응

popup.html과 popup.js 전체 코드를 출력해주세요.
외부 라이브러리 없이 순수 HTML/CSS/JS로 구현해주세요.
```

---

## PHASE 7-B: 프롬프트 히스토리 & 즐겨찾기

```
당신은 Chrome 확장 프로그램 개발자입니다.

AI Prompt Broadcaster에 프롬프트 히스토리와 즐겨찾기 기능을 추가해주세요.

---

[기능 요구사항]

1. 히스토리 저장
   - 전송 성공한 프롬프트를 chrome.storage.local에 자동 저장
   - 저장 구조:
     {
       id: timestamp,
       text: "프롬프트 내용",
       sentTo: ["chatgpt", "gemini"],
       createdAt: ISO 문자열
     }
   - 최대 50개 저장, 초과 시 가장 오래된 항목 자동 삭제

2. 히스토리 UI (팝업 내 탭 전환 방식)
   - 팝업 상단에 [작성] [히스토리] [즐겨찾기] 탭 추가
   - 히스토리 탭: 저장된 프롬프트를 시간순 목록으로 표시
     - 각 항목: 프롬프트 앞 50자 미리보기 + 전송 서비스 아이콘 + 날짜
     - 클릭 시 해당 프롬프트를 textarea에 자동 로드
     - 우클릭 또는 ··· 메뉴: [즐겨찾기 추가] [삭제]

3. 즐겨찾기 기능
   - 즐겨찾기 탭: 별표(★) 표시된 프롬프트 목록
   - 즐겨찾기 항목에 커스텀 제목 붙이기 가능 (인라인 편집)
   - 즐겨찾기는 삭제해도 히스토리 50개 한도에 포함되지 않음

4. 검색
   - 히스토리/즐겨찾기 탭 상단에 검색창
   - 프롬프트 내용으로 실시간 필터링

5. 데이터 관리
   - 설정 탭에 [히스토리 전체 삭제] [JSON으로 내보내기] [JSON 가져오기] 버튼

신규 파일 목록과 기존 파일 수정 사항을 명시하고,
전체 코드를 출력해주세요.
```

---

## PHASE 7-C: 설정 페이지 & 서비스 커스터마이징

```
당신은 Chrome 확장 프로그램 개발자입니다.

AI Prompt Broadcaster에 사용자가 직접 AI 서비스를 추가·편집·삭제할 수 있는
설정 UI를 구현해주세요. (코드를 수정하지 않고 팝업에서 직접 관리)

---

[기능 요구사항]

1. 설정 탭 내 "서비스 관리" 섹션
   - 현재 등록된 서비스 목록 카드 표시
   - 각 카드: 서비스명 / URL / 활성화 토글 / 편집 / 삭제 버튼
   - 기본 제공 서비스(ChatGPT 등)는 삭제 불가, 비활성화만 가능

2. 서비스 추가/편집 폼
   입력 필드:
   - 서비스 이름 (텍스트)
   - 페이지 URL (URL 유효성 검사)
   - 입력 필드 CSS 셀렉터 (텍스트 + "현재 탭에서 테스트" 버튼)
   - 입력 타입 선택: textarea / contenteditable / input (라디오 버튼)
   - 전송 버튼 셀렉터 (선택사항)
   - 전송 방법: click / enter / shift+enter (드롭다운)
   - 페이지 로드 대기시간 ms (슬라이더: 500~5000ms)
   - 서비스 색상 (컬러 피커)
   - 아이콘 이모지 (이모지 선택기)

3. "현재 탭에서 셀렉터 테스트" 기능
   - 버튼 클릭 시 현재 활성 탭에 테스트 content script 주입
   - 입력한 셀렉터로 요소를 찾아 노란색 하이라이트 표시
   - 결과를 팝업에 반환: "✅ 요소 발견 (textarea)" 또는 "❌ 요소 없음"

4. 설정 저장 방식
   - 기본 서비스: `src/config/sites.ts` (문서 작성 당시에는 `config/sites.js`로 표기됨)
   - 사용자 추가 서비스: chrome.storage.local의 "customSites" 키
   - 런타임에 두 소스를 병합하여 사용

5. 설정 초기화
   - "기본값으로 초기화" 버튼: 사용자 추가 서비스 전체 삭제,
     기본 서비스 활성화 상태 초기화

신규 파일과 수정 파일을 구분하여 전체 코드를 출력해주세요.
```

---

## PHASE 7-D: 프롬프트 템플릿 & 변수 치환

```
당신은 Chrome 확장 프로그램 개발자입니다.

AI Prompt Broadcaster에 템플릿 변수 치환 기능을 추가해주세요.

---

[기능 개요]
사용자가 {{변수명}} 형식으로 프롬프트를 작성하면,
전송 전에 팝업에서 각 변수의 값을 입력받아 치환한 뒤 전송합니다.

예시:
  입력: "{{언어}}로 {{주제}}에 대한 블로그 글을 500자로 써줘"
  전송 전 팝업: [언어: ____] [주제: ____] 입력창 자동 생성
  치환 후: "한국어로 AI 트렌드에 대한 블로그 글을 500자로 써줘"

---

[기능 요구사항]

1. 변수 감지
   - textarea 입력 중 {{...}} 패턴을 실시간 감지 (정규식)
   - 감지된 변수 목록을 textarea 하단에 인라인으로 표시

2. 변수 입력 UI
   - Send 버튼 클릭 시, 변수가 있으면 먼저 변수 입력 모달 표시
   - 각 변수마다 레이블 + 텍스트 입력창 자동 생성
   - 이전에 입력한 변수 값은 chrome.storage.local에 캐싱
     (같은 변수명이면 마지막 값을 기본값으로 채움)
   - 확인 버튼 클릭 시 치환 후 전송

3. 내장 시스템 변수 (자동 치환, 사용자 입력 불필요)
   - {{날짜}}: 오늘 날짜 (YYYY-MM-DD)
   - {{시간}}: 현재 시각 (HH:MM)
   - {{요일}}: 오늘 요일 (월~일)
   - {{클립보드}}: 현재 클립보드 내용 (clipboardRead 권한 필요 시 안내)

4. 템플릿 저장
   - 즐겨찾기 프롬프트에 변수 포함 가능
   - 저장 시 변수 기본값도 함께 저장 옵션 제공

5. 미리보기
   - 변수 입력 완료 후 전송 전에 치환된 최종 프롬프트를
     모달 내 미리보기 영역에 표시

기존 파일 수정 사항과 신규 파일을 명시하고 전체 코드를 출력해주세요.
```

---

## PHASE 7-E: 전송 결과 대시보드

```
당신은 Chrome 확장 프로그램 개발자입니다.

AI Prompt Broadcaster에 전송 이력과 결과를 시각화하는
대시보드 페이지(options page)를 구현해주세요.

---

[기능 요구사항]

1. options.html 페이지 구성 (chrome://extensions에서 접근 또는 팝업 링크)
   - 전체 레이아웃: 사이드바 네비게이션 + 메인 콘텐츠 영역
   - 섹션: 대시보드 / 히스토리 / 서비스 관리 / 설정

2. 대시보드 섹션
   통계 카드 (4개):
   - 총 전송 횟수
   - 가장 많이 사용한 AI 서비스
   - 이번 주 전송 횟수
   - 평균 프롬프트 길이

   차트 (순수 SVG로 구현 — 외부 라이브러리 없이):
   - 서비스별 사용 비율 도넛 차트
   - 최근 7일간 일별 전송 횟수 막대 차트

3. 히스토리 섹션
   - 테이블: 날짜 / 프롬프트 미리보기 / 전송 서비스 / 상태
   - 페이지네이션 (10개씩)
   - 필터: 서비스별 / 날짜 범위
   - 행 클릭 시 프롬프트 전체 내용 모달로 표시
   - CSV 내보내기 버튼

4. 설정 섹션
   - 히스토리 보관 개수 설정 (슬라이더: 10~200개)
   - 전송 후 팝업 자동 닫기 여부 토글
   - 전송 완료 시 데스크탑 알림 표시 여부 토글
   - 단축키 설정 안내 (chrome://extensions/shortcuts 링크)
   - 데이터 초기화 / 내보내기 / 가져오기

manifest.json 수정 사항(options_page 추가)과
options.html, options.js 전체 코드를 출력해주세요.
외부 라이브러리 없이 순수 HTML/CSS/JS + SVG로 구현해주세요.
```

---

## PHASE 7-F: 단축키 & Context Menu 통합

```
당신은 Chrome 확장 프로그램 개발자입니다.

AI Prompt Broadcaster에 단축키와 우클릭 컨텍스트 메뉴 기능을 추가해주세요.

---

[기능 1] 글로벌 단축키
   - Alt+Shift+P: 팝업 즉시 열기
   - Alt+Shift+S: 현재 선택된 텍스트를 프롬프트로 자동 입력 후 팝업 열기
   - manifest.json commands 섹션에 선언

[기능 2] 컨텍스트 메뉴 (우클릭)
   - 웹페이지에서 텍스트 선택 후 우클릭 시 메뉴 표시:
     "AI Broadcaster로 전송" (부모 메뉴)
     ├ 전체 서비스로 전송
     ├ ChatGPT로만 전송
     ├ Gemini로만 전송
     ├ Claude로만 전송
     └ Grok로만 전송
   - 클릭 시 해당 서비스 탭 열고 선택 텍스트 자동 주입

[기능 3] 선택 텍스트 처리
   - content script에서 현재 선택된 텍스트(window.getSelection())를
     background로 전달하는 메시지 구현
   - 선택 텍스트가 없으면 컨텍스트 메뉴 비활성화

[기능 4] 단축키 커스터마이징 안내
   - options 페이지에 chrome://extensions/shortcuts 페이지로 이동하는
     버튼과 현재 설정된 단축키 표시

manifest.json 수정 사항(commands, contextMenus 권한 추가)과
background/service_worker.js 수정 사항,
신규 content/selection.js 전체 코드를 출력해주세요.
```

---

## PHASE 7-G: 다국어 지원 (i18n)

```
당신은 Chrome 확장 프로그램 국제화(i18n) 전문가입니다.

AI Prompt Broadcaster에 Chrome 내장 i18n API를 활용한
한국어/영어 다국어 지원을 추가해주세요.

---

[요구사항]

1. 디렉토리 구조
   _locales/
     ko/messages.json  (한국어 — 기본값)
     en/messages.json  (영어)

2. 번역 키 목록 (최소 포함 항목)
   - ext_name, ext_description
   - popup_placeholder, popup_send, popup_select_all
   - tab_write, tab_history, tab_favorites, tab_settings
   - history_empty, favorites_empty
   - status_sending, status_success, status_failed
   - settings_reset, settings_export, settings_import
   - context_menu_send_all, context_menu_send_to

3. 코드 적용
   - popup.html: 정적 텍스트를 data-i18n 속성으로 마킹
   - popup.js: DOMContentLoaded 시 data-i18n 요소를 찾아
     chrome.i18n.getMessage()로 일괄 치환하는 함수 구현
   - manifest.json: name, description을 __MSG_ext_name__ 형식으로 변경

4. 언어 감지
   - chrome.i18n.getUILanguage()로 브라우저 언어 감지
   - ko, ko-KR이면 한국어, 나머지는 영어 폴백

_locales/ko/messages.json, _locales/en/messages.json,
popup.js i18n 적용 코드, manifest.json 수정 사항을 출력해주세요.
```

---

## PHASE 7-H: 보안 강화 & Chrome Web Store 배포 준비

```
당신은 Chrome 확장 프로그램 보안 전문가이자 배포 엔지니어입니다.

AI Prompt Broadcaster를 Chrome Web Store에 배포하기 위한
보안 강화와 배포 준비 작업을 수행해주세요.

---

[보안 강화]

1. Content Security Policy 강화
   - manifest.json의 content_security_policy를 최대한 엄격하게 설정
   - eval, inline script 완전 차단
   - 허용 도메인을 명시적으로 열거

2. 입력 새니타이징
   - 사용자 프롬프트를 DOM에 삽입할 때 XSS 방지 함수 구현
     (innerHTML 대신 textContent 사용, 불가피한 경우 DOMPurify 없이 직접 구현)
   - URL 유효성 검사 함수 구현 (사용자 추가 서비스 URL)

3. 권한 최소화 최종 점검
   - 실제 사용되지 않는 권한 제거
   - optional_permissions 활용:
     clipboardRead는 선택적 권한으로 분리
     사용자가 {{클립보드}} 변수 사용 시에만 권한 요청

---

[배포 준비]

4. 아이콘 생성 가이드
   - 필요한 아이콘 크기: 16, 32, 48, 128px
   - SVG 기반 아이콘 코드 작성 (번개 + AI 느낌의 심플한 디자인)
   - PNG 변환 방법 안내

5. Chrome Web Store 등록 체크리스트
   - 스토어 설명 문구 (한국어/영어, 132자 이내 요약 + 상세 설명)
   - 스크린샷 권장 크기 및 구성 안내
   - 개인정보처리방침 템플릿 (데이터 수집 없음 기준)
   - 심사 통과를 위한 주의사항 (원격 코드, 과도한 권한 등)

6. 버전 관리 전략
   - manifest.json version 필드 관리 방식
   - GitHub Releases와 연동하는 방법
   - 자동 패키징 스크립트 (zip 생성): package.sh

보안 강화 코드, 아이콘 SVG, 배포 체크리스트,
package.sh 스크립트를 모두 출력해주세요.
```

---

## 📎 고도화 완료 후 예상 파일 구조

```
prompt-broadcaster/
├── manifest.json                        # commands, contextMenus, options_page 추가
├── config/
│   └── sites.js                         # 기본 서비스 설정 (불변)
├── background/
│   └── service_worker.js                # 탭 생성 + 컨텍스트 메뉴 + 단축키 처리
├── popup/
│   ├── popup.html                       # 카드형 UI, 탭 전환, 다국어
│   └── popup.js                         # 히스토리·즐겨찾기·변수치환 통합
├── content/
│   ├── injector.js                      # DOM 주입 (XSS 방지 강화)
│   ├── selection.js                     # 선택 텍스트 감지
│   └── selector_checker.js             # 셀렉터 자가 진단
├── options/
│   ├── options.html                     # 대시보드 + 서비스 관리 + 설정
│   └── options.js
├── _locales/
│   ├── ko/messages.json
│   └── en/messages.json
├── icons/
│   ├── icon16.png
│   ├── icon32.png
│   ├── icon48.png
│   └── icon128.png
├── tools/
│   └── find_selector.js                 # 개발자용 셀렉터 탐지 헬퍼
├── package.sh                           # 배포용 zip 자동 생성
└── README.md
```

---

## 💡 AI에게 이 문서를 넘길 때 추천 지시 문구

```
# 전체 순서대로 구현
위 문서를 기반으로 PHASE 7-A부터 순서대로 구현해줘.
각 Phase 완료 후 다음으로 넘어가기 전에 수정된 파일 목록을 요약해줘.

# 특정 Phase만 구현
위 문서에서 PHASE 7-F(단축키 & 컨텍스트 메뉴)만 구현해줘.
현재 코드: [기존 코드 첨부]

# 누적 컨텍스트로 사용
Phase 7-A 구현이 완료됐어. 아래가 현재 코드야.
[코드 첨부]
이제 Phase 7-B를 이어서 구현해줘.

# 특정 기능 우선
우선순위가 높은 Phase(7-A, 7-F, 7-B, 7-H)만 먼저 구현하고,
나머지는 TODO 주석으로 자리를 잡아줘.
```

---

*문서 버전: v1.0 | 작성 기준: Chrome Extension Manifest V3 | 최종 업데이트: 2026-03*
