# AI Prompt Broadcaster 기능 고도화 및 추가 기능 분석

> 작성일: 2026-05-10  
> 참고 문서: `README.md`, `PROJECT_ANALYSIS.md`, `docs/extension-architecture.md`, `docs/build-guide.md`, `docs/web_store_checklist.md`, `docs/web-store-copy.md`, `docs/release-selector-verification-checklist.md`  
> 목적: 현재 Chrome 확장 프로그램의 기능 성숙도를 기준으로, 실제 제품 가치가 큰 고도화 방향과 추가 기능 후보를 우선순위별로 정리한다.

> 2026-05-11 구현 상태: Selector Health Center, history comparison notes, prompt experiment MVP, template packs, service groups, export/import v9, and extension-page E2E are now implemented as baseline features. This roadmap now treats those items as hardening/expansion tracks rather than wholly new work.

---

## 1. 현재 제품 포지션 요약

`AI Prompt Broadcaster`는 단순히 여러 AI 사이트에 프롬프트를 복사해 넣는 확장 프로그램을 이미 넘어섰다. 현재 문서와 구조 기준으로 핵심 역량은 아래 네 가지로 정리된다.

1. 다중 AI 서비스 동시 전송
   - ChatGPT, Gemini, Claude, Grok, Perplexity 내장 지원
   - 열린 AI 탭 재사용, 새 탭 열기, 특정 탭 지정
   - DOM selector 기반 best-effort 주입 및 전송

2. 반복 프롬프트 운영
   - 히스토리, 즐겨찾기, 태그, 폴더, 핀, 복제
   - 서비스별 prompt override
   - 템플릿 변수, 사용자 변수, 시스템 변수

3. 자동화
   - 단일/체인 즐겨찾기
   - 예약 실행
   - quick palette
   - context menu와 선택 텍스트 기반 실행

4. 운영성
   - 구조화된 전송 결과 코드
   - selector checker와 selector audit
   - dashboard, heatmap, success trend, failure reason, strategy summary
   - import/export v9, custom service, optional host permission 관리

따라서 다음 기능 고도화는 "더 많은 버튼"보다 "결과 비교, 실험 관리, selector 신뢰도, 반복 워크플로우 품질"에 집중하는 편이 제품 방향과 잘 맞는다.

---

## 2. 추천 우선순위 한눈에 보기

| 우선순위 | 기능 | 사용자 가치 | 구현 난이도 | 추천 이유 |
|---|---|---:|---:|---|
| P0 | Selector Health Center | 높음 | 중간 | 이 확장의 가장 큰 리스크인 DOM 변경/로그인/보안 확인 오탐을 사용자가 이해하고 복구하게 함 |
| P0 | 실패 복구 UX 고도화 | 높음 | 낮음~중간 | selector 실패, auth_required, submit_failed를 사용자가 다음 행동으로 바로 이어갈 수 있음 |
| P1 | 결과 비교 워크스페이스 | 매우 높음 | 높음 | "여러 AI에 보낸다" 다음의 자연스러운 핵심 가치 |
| P1 | 프롬프트 실험 매트릭스 | 높음 | 중간~높음 | prompt engineer와 power user에게 반복 실험 가치를 제공 |
| P1 | 즐겨찾기/템플릿 팩 | 높음 | 중간 | 현재 favorite/tag/folder 기능을 공유 가능한 자산으로 확장 |
| P2 | 예약 실행의 context snapshot | 중간~높음 | 중간 | 현재 schedule에서 막히는 `{{url}}`, `{{selection}}`, `{{clipboard}}` 문제 완화 |
| P2 | 신규 내장 서비스 확대 | 중간~높음 | 중간 | Copilot, DeepSeek, Mistral, HuggingChat 등 후보. 단 selector 유지 비용 증가 |
| P2 | 데이터 관리/백업 고도화 | 중간 | 중간 | local-first 제품의 신뢰도를 높임 |
| P3 | 다국어 확장 | 중간 | 낮음~중간 | 문서상 보류 항목. 배포 국가 확대 시 가치 |

---

## 3. P0: 안정성과 신뢰도 고도화

### 3.1 Selector Health Center

현재 selector 관련 기능은 분산되어 있다.

- `src/config/sites/builtins.ts`: built-in selector source of truth
- `src/content/selector-checker/`: live page selector check
- `scripts/selector-audit.mjs`: Playwright 기반 audit
- `pendingSelectorChecks`, `failedSelectors`, `selectorAlerts`: runtime 상태
- options `Services`: waitMs와 서비스 순서 편집

이를 options 페이지의 전용 섹션 또는 `Services` 하위 패널로 묶는 것을 추천한다.

제안 기능:

- 서비스별 상태 카드
  - 마지막 성공 전송 시각
  - 마지막 selector warning 시각
  - 마지막 실패 코드
  - 마지막 성공 strategy
  - 현재 설정의 `verifiedAt`, `verifiedRoute`, `verifiedAuthState`, `verifiedLocale`
- "현재 열린 탭에서 검사" 버튼
  - 이미 구현된 service test / selector checker 흐름을 UI에서 더 명확히 노출
- "로그인/보안 확인 필요"와 "진짜 selector 변경"을 분리 표시
  - 최근 패치처럼 Cloudflare/access challenge 감지는 selector 변경으로 단정하지 않는 쪽이 맞음
- "수동 복구 가이드" 링크
  - `tools/find_selector.js`
  - `docs/release-selector-verification-checklist.md`
  - GitHub issue search
- audit 결과 import 또는 표시
  - `output/selector-audit/*.md`는 개발자 산출물이므로, 사용자 UI에는 요약 상태만 표시

구현 후보:

- 새 shared model: `ServiceHealthSnapshot`
- background handler: `service-health:get`
- options feature: `src/options/features/service-health.ts`
- QA fixture: access challenge, auth page, missing input, conditional submit

기대 효과:

- 사용자가 "셀렉터가 바뀌었다"는 팝업을 불신하는 문제를 줄임
- 개발자도 release 전 selector 상태를 한 화면에서 점검 가능

### 3.2 실패 복구 UX 고도화

현재 결과 코드는 이미 구조화되어 있다.

- `selector_timeout`
- `auth_required`
- `submit_failed`
- `strategy_exhausted`
- `permission_denied`
- `tab_closed`
- `unexpected_error`

이 코드별로 사용자 행동을 연결하면 체감 품질이 크게 올라간다.

제안 기능:

- 결과 카드별 action
  - `auth_required`: "사이트 열기", "로그인 후 다시 시도"
  - `selector_timeout`: "열린 탭에서 selector 검사", "프롬프트 복사"
  - `submit_failed`: "입력만 유지하고 직접 전송", "전송 버튼 다시 찾기"
  - `permission_denied`: "권한 다시 요청"
  - `tab_closed`: "새 탭으로 재시도"
- history detail에서 실패 서비스만 재전송
  - 이미 target snapshot이 있으므로 구현 부담이 비교적 낮음
- toast 문구 개선
  - "selector 변경"처럼 원인을 단정하지 않고 "입력창 확인 필요", "로그인/보안 확인 가능성"처럼 안내

구현 후보:

- `src/popup/compose/send-flow/card-state.ts`
- `src/popup/app/i18n/catalog.ts`
- `src/options/features/history/modal.ts`
- `_locales/*/messages.json`

---

## 4. P1: 제품 핵심 가치를 키우는 기능

### 4.1 결과 비교 워크스페이스

현재 확장의 가장 자연스러운 다음 단계는 "여러 AI에 보낸 뒤 결과를 비교"하는 것이다. README의 사용자 대상도 "여러 AI 답변 비교"에 가깝다. 지금은 전송과 기록은 강하지만, 답변 자체를 비교하는 화면은 없다.

다만 AI 사이트 응답 DOM을 자동 수집하는 기능은 서비스별 DOM 변경, 이용약관, 개인정보 기대치, 권한 설명 부담이 크다. 따라서 단계적으로 접근하는 것이 좋다.

권장 단계:

1. 수동 비교 워크스페이스
   - 방송 history에서 "비교 노트 열기"
   - 서비스별 탭 링크와 전송 prompt snapshot 표시
   - 사용자가 각 AI 답변을 붙여넣어 비교 가능
   - local-only 저장

2. 선택 영역 기반 답변 캡처
   - 사용자가 AI 답변을 드래그 선택한 뒤 context menu로 "이 방송 결과에 저장"
   - 이미 selection script와 context menu가 있으므로 기존 구조와 잘 맞음
   - 자동 scraping보다 정책/신뢰 리스크가 낮음

3. opt-in 자동 캡처 실험
   - 특정 사이트별 assistant response selector가 안정적인 경우에만 optional로 제공
   - 기본값 off
   - Web Store 설명과 privacy 문구 보강 필요

데이터 모델 후보:

```ts
interface BroadcastComparisonNote {
  id: string;
  historyId: number;
  serviceId: string;
  responseText: string;
  rating?: number;
  tags?: string[];
  createdAt: string;
  updatedAt: string;
}
```

UI 후보:

- options history detail modal 하단에 `Compare` 탭 추가
- 서비스별 prompt/result side-by-side
- "복사", "Markdown export", "CSV export"

### 4.2 프롬프트 실험 매트릭스

현재는 한 prompt를 여러 서비스에 보내는 구조다. power user에게는 "여러 prompt variant를 여러 서비스에 보내고 결과를 비교"하는 실험 매트릭스가 강력하다.

예시:

- Variant A: "간결하게 요약해줘"
- Variant B: "표로 비교해줘"
- Variant C: "실행 계획 중심으로 정리해줘"
- 대상: ChatGPT, Claude, Gemini

결과적으로 `3 prompts x 3 services = 9 sends`가 된다.

기능 범위:

- prompt variant 추가/삭제/복제
- 변수 값 세트 여러 개 입력
- 서비스별 override와 조합
- 실행 전 예상 전송 수와 탭 수 표시
- 중단/재시도
- history에는 experiment id를 저장

데이터 모델 후보:

```ts
interface PromptExperiment {
  id: string;
  title: string;
  variants: Array<{ id: string; title: string; text: string }>;
  targetSiteIds: string[];
  variableSets: Array<Record<string, string>>;
  createdAt: string;
  lastRunAt: string | null;
}
```

구현 포인트:

- 기존 chain favorite을 그대로 확장할지, 별도 experiment 모델을 둘지 결정 필요
- chain은 순차 자동화, experiment는 조합 실행과 비교가 목적이라 별도 모델이 더 깔끔함
- 실행량이 커질 수 있으므로 rate/UX 안전장치 필요

### 4.3 즐겨찾기/템플릿 팩

현재 favorite은 개인 생산성 도구로 충분히 좋다. 다음 단계는 "재사용 가능한 프롬프트 자산"이다.

제안 기능:

- 템플릿 팩 export/import
  - favorite 일부만 선택해 `.json`으로 내보내기
  - tag/folder/schedule은 선택적으로 포함
  - 민감한 template default 값은 제외 옵션 제공
- 기본 제공 샘플 팩
  - 글쓰기
  - 코드 리뷰
  - 번역
  - 회의 요약
  - 리서치 비교
- favorite editor에 "팩에 추가" 액션
- import preview
  - 중복 title/tag 처리
  - 대상 서비스가 없는 경우 fallback 안내

장점:

- Web Store 설명에서 "바로 쓸 수 있는 prompt workflow"로 어필 가능
- 사용자가 처음 설치했을 때 빈 화면 문제를 줄임

주의:

- 기본 샘플 프롬프트는 너무 많으면 오히려 제품이 복잡해 보임
- 온보딩에서 선택 설치 방식이 좋음

### 4.4 고급 체인 실행

현재 chain favorite은 순차 실행과 실패 시 중단이 핵심이다. 다음 고도화는 조건과 재시도다.

제안 기능:

- 단계별 실패 정책
  - stop on failure
  - continue on failure
  - retry once
  - manual confirm before next step
- 단계별 target mode
  - 새 탭 강제
  - 기존 탭 재사용
  - 특정 탭 유지
- 단계별 변수 override
  - 같은 chain 안에서 step마다 `{{tone}}`, `{{format}}` 값 다르게 적용
- chain run preview
  - 실행 전 step 목록, 대상 서비스, 예상 delay 표시

구현 포인트:

- `ChainStep` 타입 확장 필요
- legacy import migration 추가 필요
- smoke QA에 chain policy fixture 추가

---

## 5. P2: 확장성과 데이터 관리

### 5.1 예약 실행의 context snapshot

현재 scheduled favorite은 `{{url}}`, `{{title}}`, `{{selection}}`, `{{clipboard}}`를 막는다. background alarm 시점에는 active page context가 보장되지 않기 때문에 타당한 제한이다.

대신 사용자가 예약을 만들 때 context를 snapshot으로 저장하도록 하면 유용하다.

예시:

- 현재 페이지 URL과 제목을 저장한 예약
- 선택 텍스트를 저장한 예약
- 특정 clipboard 값을 저장한 예약

제안 UI:

- favorite schedule 설정에 "현재 탭 context 저장" 버튼
- 저장된 context 미리보기
- 실행 시 live context 대신 snapshot 사용

주의:

- clipboard snapshot은 민감할 수 있으므로 기본 off, 명시 동의 필요
- 저장된 selection/url/title은 export에 포함될 수 있으므로 import/export 안내 필요

### 5.2 신규 내장 AI 서비스 확대

`PROJECT_ANALYSIS.md`의 잔여 로드맵에도 신규 내장 서비스 후보가 있다.

후보:

- Microsoft Copilot
- DeepSeek
- Mistral Le Chat
- HuggingChat
- Poe
- You.com
- Phind

추천 접근:

1. selector 안정성이 높은 서비스부터 추가
2. 서비스별 route/auth/soft-gated 여부를 `verifiedAt` 메타데이터로 기록
3. `manifest.json` host permission과 README support table 동시 갱신
4. QA fixture와 selector audit 체크리스트 추가

주의:

- 내장 서비스가 많아질수록 유지보수 비용이 증가한다.
- 모든 서비스를 기본 활성화하면 popup이 복잡해진다.
- "서비스 마켓/선택 설치"처럼 기본 노출 수를 제한하는 UX가 필요할 수 있다.

### 5.3 서비스 프로필/그룹

서비스가 늘어나면 사용자는 매번 체크박스를 고르기 어렵다.

제안 기능:

- 서비스 그룹
  - "빠른 비교": ChatGPT, Gemini
  - "깊은 분석": Claude, Perplexity
  - "전체"
  - 사용자 정의 그룹
- favorite 기본 대상 대신 group 참조 허용
- popup 상단 segmented control 또는 dropdown으로 group 선택

데이터 모델 후보:

```ts
interface ServiceGroup {
  id: string;
  name: string;
  siteIds: string[];
  createdAt: string;
  updatedAt: string;
}
```

### 5.4 백업/동기화 고도화

현재는 local storage와 JSON import/export가 중심이다. local-first 방향은 privacy 측면에서 좋다. 다만 사용자는 여러 기기에서 favorite과 template을 옮기고 싶어 할 수 있다.

후보:

- 선택적 Chrome sync
  - favorite 제목/본문/태그/폴더처럼 크기가 작은 데이터만
  - history는 제외
  - storage quota 고려 필요
- 암호화된 백업 파일
  - passphrase 기반 export
  - 민감한 template default와 clipboard snapshot 보호
- 자동 백업 reminder
  - 일정 기간마다 export 안내

추천:

- 먼저 "선택 export/import UX"와 "민감 필드 제외"를 개선
- 이후 sync는 quota와 충돌 병합 정책을 설계한 뒤 도입

---

## 6. P2/P3: 사용성, 접근성, 배포 품질

### 6.1 온보딩 고도화

README는 설치/사용 설명이 풍부하지만, 실제 확장 첫 실행 경험은 별도 개선 여지가 있다.

제안:

- 첫 실행 체크리스트
  - 지원 서비스 로그인 확인
  - 첫 prompt 보내기
  - favorite 저장
  - quick palette 단축키 안내
- 권한 설명을 기능 단위로 표시
  - clipboardRead는 `{{clipboard}}` 사용 시에만 요청된다는 점 강조
- 샘플 favorite 선택 설치

### 6.2 Dashboard 고도화

현재 dashboard는 이미 heatmap/trend/failure/strategy summary가 있다. 추가 분석 후보는 아래 정도가 적당하다.

- prompt length 분포
- 서비스별 평균 elapsedMs
- 실패 코드의 시간대별 추세
- favorite별 성공률
- schedule 성공률
- selector warning 빈도
- export 가능한 monthly report

우선순위는 중간이다. dashboard가 너무 분석툴처럼 커지면 popup 중심 제품의 단순성이 흐려질 수 있다.

### 6.3 접근성과 키보드 중심 UX

이미 popup shortcut과 roving focus가 있다. 다음 개선은 "모든 주요 흐름이 키보드로 끝나는지"다.

점검 후보:

- favorite editor chain step reorder keyboard support
- service card expand/collapse focus order
- options history detail modal focus trap
- quick palette screen reader label
- high contrast mode

### 6.4 다국어 확장

문서상 `ja`, `zh_CN`이 보류 항목이다.

추천 순서:

1. 영어/한국어 문구 키 정리
2. i18n key naming consistency 점검
3. 일본어 추가
4. 중국어 간체 추가

기능 개발보다 배포 확장 단계에서 진행하는 편이 좋다.

---

## 7. 정책/프라이버시 관점에서 주의할 기능

아래 기능은 사용자 가치가 크지만, 설명과 opt-in 설계가 중요하다.

| 기능 | 주의점 | 권장 방식 |
|---|---|---|
| AI 답변 자동 캡처 | 제3자 사이트 DOM 읽기, 사용자 기대치, 사이트 정책 이슈 | 기본 off, 수동 선택 캡처부터 시작 |
| clipboard snapshot 예약 | 민감 정보 저장 가능 | 명시 동의, export 제외 옵션 |
| Chrome sync | prompt/favorite가 계정 동기화됨 | opt-in, history 제외, 민감 필드 제외 |
| 신규 내장 서비스 대량 추가 | host permission 증가, 유지보수 증가 | 선택 활성화, 명확한 권한 설명 |
| 자동 재시도/대량 실험 | 서비스 자동화 제한 가능성 | 실행량 preview, 취소/속도 제한 |

---

## 8. 추천 개발 순서

### Milestone 1: 신뢰도와 복구 UX

목표: 사용자가 실패 원인을 이해하고 직접 복구할 수 있게 한다.

작업:

- Selector Health Center baseline 유지 및 실패 코드별 복구 action 확장
- 실패 코드별 action 버튼
- selector/auth/access challenge 문구 정리
- history detail에서 실패 서비스만 재전송 강화

검증:

- `qa:smoke`
- `qa:extension`
- auth/access challenge/missing selector fixture 추가
- 수동으로 실제 5개 서비스 selector audit

### Milestone 2: 비교 워크스페이스 MVP

목표: 전송 이후의 핵심 가치인 "비교"를 제품 안으로 가져온다.

작업:

- history detail의 comparison capture/notes UX 고도화
- 서비스별 응답 수동 붙여넣기와 명시적 1회 캡처 개선
- Markdown/CSV export
- context menu로 선택 답변을 특정 history에 저장

검증:

- local storage migration
- export/import roundtrip
- active comparison context reset
- 긴 답변/Markdown escaping

### Milestone 3: Prompt Experiment

목표: prompt engineer용 반복 실험 도구로 확장한다.

작업:

- experiment 모델/variants/variable set UI baseline 유지
- 실행량 preview
- soft 10 / hard 30 실행 제한 유지
- experiment run history

검증:

- 조합 수 제한
- cancel/retry
- targetSnapshots 보존

### Milestone 4: 서비스 확장과 템플릿 생태계

목표: 더 많은 사용자와 use case를 흡수한다.

작업:

- Copilot/DeepSeek/Mistral/HuggingChat 중 안정적인 후보부터 추가
- 서비스 그룹 hardening
- 템플릿 팩 export/import hardening
- 샘플 favorite pack

검증:

- manifest host permission 정합성
- README support table 업데이트
- Web Store copy 업데이트

---

## 9. 빠른 개선 후보

작게 시작할 수 있는 작업들이다.

- options history detail에서 "실패한 서비스만 다시 보내기" 버튼 추가
- favorite list에서 "최근 실패한 favorite" 필터 추가
- service card에 "마지막 성공/실패" badge 추가
- selector warning 클릭 시 바로 해당 서비스 설정 카드로 이동
- schedule list에 "다음 실행 예정 시각" 명확히 표시
- dashboard에 "평균 전송 시간" 추가
- import/export에서 "favorites only", "settings only" 선택 export
- README의 selector 오류 문구를 최근 access challenge 대응에 맞게 업데이트

---

## 10. 구현 시 지켜야 할 구조 원칙

현재 프로젝트 구조가 잘 분리되어 있으므로, 새 기능도 아래 경계를 유지하는 것이 좋다.

- source of truth는 `src/`
- built file과 root runtime mirror는 `npm run build`로만 갱신
- background message action은 `src/background/messages/router.ts`의 trust boundary 유지
- popup/options UI는 feature 모듈에 추가
- 데이터 모델 변경 시:
  - `src/shared/types/models.ts`
  - normalizer
  - import/export migration
  - reset cleanup
  - smoke QA
  를 함께 갱신
- 사용자 데이터는 local-first 유지
- 제3자 AI 사이트 응답을 읽는 기능은 opt-in과 명확한 설명을 우선

---

## 11. 결론

가장 추천하는 방향은 아래 순서다.

1. Selector Health Center와 실패 복구 UX로 신뢰도 강화
2. 결과 비교 워크스페이스로 핵심 사용자 가치 확장
3. 프롬프트 실험 매트릭스로 power user 확보
4. 템플릿 팩과 신규 서비스로 사용 범위 확대

현재 프로젝트는 이미 "여러 AI에 보내기"의 기본기를 충분히 갖추고 있다. 다음 성장은 전송 자체보다 "보낸 뒤 어떻게 비교하고, 반복 실험을 어떻게 관리하며, 실패를 얼마나 투명하게 복구하는가"에 달려 있다.
