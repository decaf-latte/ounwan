# Phase 4 — History + Charts + Exclude Recommendation 완료

- **Date:** 2026-06-01
- **Branch:** feat/phase-4-history-charts
- **Tag:** v0.4.0-history-charts

## Implemented

- 대시보드 미니 캘린더 (주간 칩 대체) — 이번 달 그리드 + 부위 색 도트
- /history 풀 캘린더 (`size="md"`, role=grid + aria) + 날짜 클릭 모달
- /history 카드 리스트 탭 — 선택한 월 데이터로 일관성
- ProgressLine 카드 N개 — 1RM 미니 라인 + 증감 표시
- ExerciseProgressDialog — 1RM + 볼륨 듀얼 축 큰 차트 (recharts)
- SessionDetailDialog — 운동 N개 + 세트 weight×reps + 부위 태그(DB color)
- URL `/history?y=2026&m=6` (m 1-indexed) + safe range fallback
- useTransition + router.push({ scroll: false }) 월 이동 — 부드러운 전환
- R4 — ExerciseRecCard base-ui 체크박스, excludedExerciseIds Set, 부위 chip 토글 시 자동 reset
- finishSession에 revalidatePath('/history') 추가 (캐시 stale 차단)
- 1RM Epley 공식 (null 가드 + SQL not-null 이중 차단)
- body_parts.color DB 직접 사용 — 단일 진실 소스, CSS 토큰 폐기

## Out of Scope (Plan 4.1+)

- 차트 zoom/brush/tooltip 상세
- 1RM PR 자동 감지 토스트
- 세션 비교, 부위별 주간 볼륨 추이
- 같은 날 여러 세션 picker (현재 첫 세션만)
- MiniCalendar 화살표 키 네비
- 운동 drag&drop, Magic link (Plan 3.7)

## Tests

- tests/rls/isolation.test.ts — 3 (regression)
- tests/workout/recommendation.test.ts — 6 (regression)
- tests/lib/motion.test.ts — 3 (regression)
- tests/components/progress-ring.test.tsx — 5 (regression)
- tests/components/layout/{sidebar,bottom-tab,app-shell}.test.tsx — 3 (regression)
- tests/components/workout/exercise-list.test.tsx — 2 (regression)
- tests/lib/one-rep-max.test.ts — 6 (new)
- tests/components/ui/mini-calendar.test.tsx — 2 (new)
- tests/components/charts/progress-line.test.tsx — 2 (new)
- 총 32 tests / 11 files

## Build

- pnpm build ✓ (Next.js 16 Turbopack, recharts 추가)
- 라우트 변동 없음, hydration warning 0

## Manual E2E (체크리스트)

- 대시보드 미니 캘린더 도트, 다크모드 톤다운
- /history 월 이동 (이전/다음/오늘), URL 갱신, useTransition fade
- 캘린더 ↔ 리스트 탭 전환
- 세션 상세 모달 → 운동/세트 표시, 부위 태그
- 운동 클릭 → 1RM + 볼륨 듀얼 차트
- R4 체크박스 → opacity-50, 카운트 감소, 0 시 disabled
- 부위 chip 토글 → 추천 새로 + excluded reset

## R4 Resolved

- /workout/new 추천 카드에 체크박스 (기본 모두 체크)
- 체크 해제 → 시각 dim + startSession에서 제외
- 부위 chip 변경 → excludedExerciseIds 초기화
