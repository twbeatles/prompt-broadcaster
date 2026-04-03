# AI Prompt Broadcaster - 잔여 기능 로드맵

> 작성일: 2026-03-31
> 최종 업데이트: 2026-04-03 (favorite workflow 보강, locale parity 검증 반영)
> 기준 코드: 현재 `main` 브랜치의 `src/`, `popup/`, `options/`, `manifest.json`

이 문서는 아직 구현되지 않은 항목만 남긴다. 현재 동작과 완료된 기능은 `README.md`, `PROJECT_ANALYSIS.md`, `CLAUDE.md`, `docs/extension-architecture.md`를 기준으로 본다.

---

## 우선순위 매트릭스

| 우선순위 | 기능 | 현재 상태 | 임팩트 | 난이도 |
|---|---|---|:---:|:---:|
| 2순위 | 방송 순서 커스터마이징 | `waitMsMultiplier`는 있음, `siteOrder`는 없음 | ★★☆ | ★★☆ |
| 2순위 | 히스토리 통계 강화 | 기본 차트만 존재 | ★★☆ | ★★☆ |
| 2순위 | 신규 내장 AI 서비스 | 5개 built-in만 제공 | ★★☆ | ★★☆ |
| 보류 | 다국어 확장 | `en`, `ko`만 제공 | ★★☆ | ★☆☆ |

---

## 2순위 — 운영성 및 분석 고도화

### ① 방송 순서 커스터마이징

**현재 상태**
- 전역 `waitMsMultiplier`는 이미 구현되어 있다.
- 그러나 서비스별 방송 순서는 아직 고정이며, 사용자가 `siteOrder`를 직접 관리할 수 없다.

**남은 작업**
- `AppSettings.siteOrder` 추가
- popup 서비스 목록에서 드래그 또는 이동 버튼 기반 순서 편집
- broadcast target 생성 시 저장된 순서를 우선 적용
- 필요하면 향후 per-site wait override로 확장 가능한 타입 구조 확보

**수정 파일 후보**
- `src/shared/types/models.ts`
- `src/shared/prompts/`
- `src/popup/app/bootstrap.ts`
- `popup/popup.html`
- `popup/styles/partials/`
- `src/background/app/bootstrap.ts`

**주의사항**
- pinned 즐겨찾기와는 별개로, 서비스 순서는 방송 타깃 정렬에만 적용해야 한다.
- 기존 설정 import/export와 마이그레이션 호환성을 유지해야 한다.

---

### ② 히스토리 통계 강화

**현재 상태**
- 옵션 페이지에 기본 사용량 차트와 활동 차트만 있다.
- 구조화된 `siteResults`와 `strategyStats`는 저장되지만, 이를 충분히 시각화하지 않는다.

**남은 작업**
- 시간대 × 요일 히트맵
- 서비스 성공률 추이
- 프롬프트 길이 분포
- 상위 키워드 통계
- 필요 시 전략 통계(`strategyStats`) 요약 카드 또는 표 추가

**수정 파일 후보**
- `src/options/features/dashboard.ts`
- `src/options/ui/charts.ts`
- `options/options.html`
- `options/styles/partials/`

**주의사항**
- 히스토리가 커질수록 옵션 페이지 렌더 비용이 커질 수 있으므로 집계 캐싱 전략이 필요하다.
- 한글/영문 혼합 텍스트의 키워드 분해 규칙을 단순 공백 기준으로 둘지 별도 토크나이저를 둘지 결정해야 한다.

---

### ③ 신규 내장 AI 서비스 추가

**현재 상태**
- 현재 built-in 서비스는 ChatGPT, Gemini, Claude, Grok, Perplexity까지다.
- 추가 서비스 검토 대상은 남아 있다.

**추가 검토 대상**

| 서비스 | 도메인 | 비고 |
|---|---|---|
| Microsoft Copilot | `copilot.microsoft.com` | Microsoft 생태계 사용자층 |
| Mistral Le Chat | `chat.mistral.ai` | 유럽권 AI 서비스 |
| DeepSeek | `chat.deepseek.com` | 아시아권 사용량 증가 |
| HuggingChat | `huggingface.co/chat` | 오픈소스 친화적 서비스 |

**남은 작업**
- 각 서비스의 input selector / submit selector 실기 검증
- auth page 탐지 selector 보강
- `waitMs`, submit 방식(`click`/`enter`/`shift+enter`) 튜닝
- `lastVerified` 기록
- host permissions / content script match 확장

**수정 파일 후보**
- `src/config/sites/builtins.ts`
- `src/config/sites/`
- `manifest.json`
- `_locales/en/messages.json`
- `_locales/ko/messages.json`

**체크리스트**
- [ ] 실제 로그인/대화 화면 DOM 확인
- [ ] 인증 페이지 오탐 여부 확인
- [ ] 재사용 탭 후보 탐지 조건 검증
- [ ] smoke 또는 fixture 회귀 추가 가능 여부 검토

---

## 보류 — 로케일 확장

### ④ 다국어 확장 (일본어 / 중국어)

**현재 상태**
- 현재 로케일은 `_locales/en`, `_locales/ko`만 유지한다.
- 빌드 시 `en/ko` locale key parity와 placeholder parity를 함께 검증한다.

**남은 작업**
- `_locales/ja/messages.json`
- `_locales/zh_CN/messages.json`
- 템플릿 변수 별칭 및 도움말 문구 확장
- popup/options/onboarding 주요 UI 문자열 번역 검수

**수정 파일 후보**
- `_locales/ja/messages.json`
- `_locales/zh_CN/messages.json`
- `src/shared/template/`
- locale 키를 참조하는 popup/options/onboarding UI

**주의사항**
- 단순 기계 번역으로는 템플릿 변수 설명과 접근성 문구 품질이 떨어질 수 있다.
- 새 로케일 추가 시 한국어/영어와 동일한 키 셋 및 placeholder 구성을 유지하도록 빌드 검증을 확장해야 한다.

---

## 구현 시 공통 체크리스트

- [ ] `src/` 기준으로 수정하고 생성물은 빌드로 갱신
- [ ] `npm run typecheck` 통과
- [ ] `npm run build` 통과
- [ ] `npm run qa:smoke` 회귀 확인
- [ ] 새 i18n 키는 `_locales/en/messages.json`와 `_locales/ko/messages.json`를 기본으로 함께 추가
- [ ] 새 저장 필드는 import/export 및 기존 로컬 데이터와 하위 호환되게 처리
- [ ] 새 권한이 필요하면 `manifest.json`과 사용자 안내 문구를 함께 갱신
- [ ] 새 built-in 서비스는 실제 DOM 검증 후 `lastVerified`를 기록
- [ ] 문서 변경이 필요하면 `README.md`, `PROJECT_ANALYSIS.md`, `docs/extension-architecture.md`도 함께 동기화
