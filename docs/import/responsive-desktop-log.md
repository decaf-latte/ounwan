# Phase 3.6 — Responsive Desktop + UX Fixes 완료

- **Date:** 2026-06-01
- **Branch:** feat/phase-3-6-responsive-desktop
- **Tag:** v0.3.6-responsive-desktop

## Implemented

- (app) route group 도입 + 모든 페이지 이동 + import 경로 일괄 갱신 (URL 불변)
- AppShell + Sidebar(lg+) + BottomTab(lg-) — CSS-only 반응형 토글 (JS 미디어쿼리 없음)
- `pb-safe` Tailwind v4 utility (iOS safe-area)
- Dashboard lg:max-w-5xl + grid 2x2 (진행/주간/최근) + 헤더 액션 lg 숨김
- BarChart3 dead button 제거 (sidebar/bottomtab에서 기록 진입)
- SessionRunner 2-column (CSS-only): 좌측 ExerciseList + 우측 활성 카드
- userPickedExId state + 순수 파생 effectivePickedId로 사용자 운동 선택 우선
- 모든 운동 완료 시 "모든 운동 완료 🎉" 메시지 (lg+)
- ExerciseCardWrapper X 버튼: swipe-tracked Card 밖 absolute sibling(z-10), text-text-muted 가시성
- exerciseName prop으로 스크린리더 aria-label 명확화
- /history 페이지 + fetchRecentSessions (workout_sets!inner, 세트 0개 세션 제외) + loading/error
- dashboard loading.tsx / error.tsx 신규
- workout/[sessionId] loading.tsx에 sidebar skeleton 분기
- WCAG: Sidebar active 흰색→어두운 텍스트 (2.96:1 → 5.43:1)

## Out of Scope (Plan 3.7)

- /history 차트, 운동 drag&drop, 사이드바 collapsible
- Magic link / 인앱 브라우저 OAuth 우회, ExerciseList 화살표 키 네비
- BottomTab active 코랄 라벨 (2.96:1) — 팔레트 darkening 패스 (aria-current로 보완 중)

## Tests (22 total / 8 files)

- tests/rls/isolation.test.ts — 3 (regression)
- tests/workout/recommendation.test.ts — 6 (regression)
- tests/lib/motion.test.ts — 3 (regression)
- tests/components/progress-ring.test.tsx — 5 (regression)
- tests/components/layout/sidebar.test.tsx — 1 (new)
- tests/components/layout/bottom-tab.test.tsx — 1 (new)
- tests/components/layout/app-shell.test.tsx — 1 (new)
- tests/components/workout/exercise-list.test.tsx — 2 (new)

## Bugs Resolved

- R1: 운동 진행 중 순서 강제 → 좌측 ExerciseList 클릭으로 active 전환 (userPickedExId)
- R2: X 버튼 안 보이고 swipe로 가로채짐 → swipe 격리 + text-text-muted 가시성
- R3: BarChart3 데드 버튼 → 제거 + /history 페이지 신설

## Verification

- pnpm tsc --noEmit → 0 errors
- pnpm lint → 0 errors
- pnpm test → 22 passed (8 files)
- pnpm build → 0 errors, 7 URL routes (/, login, dashboard, history, workout/new, workout/[id], auth/callback)
- WCAG: computed contrast from globals.css tokens (light mode); active states carry aria-current
