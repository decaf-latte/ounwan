# 디자인 시스템 리뉴얼 — Design Spec

- **Date:** 2026-05-28
- **Author:** HJ (with Claude, via brainstorming)
- **Status:** Draft (User review pending)
- **Predecessor:** `docs/specs/2026-05-22-gym-routine-app-design.md` (제품 spec, UI 방향 미명시)
- **Scope:** Phase 3.1로 머지된 모든 화면의 시각 리뉴얼 + Phase 3.2+ 부터 적용될 디자인 토큰/컴포넌트 시스템 정의

## 1. Why this exists

Phase 3.1 머지 후 사용자 본인의 첫 폰 사용 피드백:

> "디자인은 걍 다 쓰레기네 — 전체적으로 아마추어 / 새항이 / 감성·컨셉 부재"

원인 분석:
- shadcn/ui base-nova 디폴트 그대로 사용 (slate gray, 기능적이지만 무미)
- 컬러 토큰 미정의 — Tailwind 디폴트 className 즉흥 사용
- "오운완"이라는 앱 이름이 시사하는 감정적 가치(자기보상)가 시각에 안 드러남
- 헬스장 모바일 사용 컨텍스트에 최적화 안 됨 (작은 버튼, 약한 위계)

목표:
1. **"뿌듯/자기보상" 감정을 시각으로 표현** — 따뜻한 코랄 액센트, 친근한 마이크로카피
2. **포트폴리오로 자랑할 만한 디자인 일관성** — 토큰 시스템 + 다크모드 동시 디자인
3. **헬스장 모바일 친화** — 큰 터치 영역, 명확한 위계, 빠른 가독성
4. **차별화** — 일반적인 fitness 앱들과 결이 다른 따뜻함 (Pretendard, 코랄 톤, 친근 존대)

## 2. Tone & Concept

**핵심 단어:** 뿌듯함 · 자기보상 · 옥하도다 · 따뜻함 · 친근함

| 영향 받은 곳 | 영향 안 받은 곳 |
|---|---|
| Apple Health 활동 링 (구조) | Duolingo 마스코트 게이미피케이션 |
| 플랜핏 친근한 카드 구조 | Strong 앱의 데이터 밀도/그리드 |
| 한국 인디 앱 (Noted, Linkly) 어른스러운 코지 | Strava 스포츠 경쟁 톤 |

**언어 톤:** 친근 + 존대
- ✅ "오운완 ✓", "오늘 잘 끝냈어요", "아직 운동 전이에요"
- ❌ "운동 완료", "Workout finished" (기능적·차가움)
- ❌ "오운완!!", "잘했다 친구야" (반말·과함)

## 3. Visual Tokens

### 3.1 Color (Light)

```css
/* 배경 그라데이션 */
--bg-from:         #FFF8EE;   /* 거의 흰 크림 */
--bg-to:           #FFEDD9;   /* 살구 베이스 */
--bg-flat:         #FFF8EE;   /* 그라데이션 안 쓸 때 단색 */

/* 표면 (카드/입력) */
--surface:         #FFFFFF;
--surface-shadow:  rgba(180, 100, 50, 0.06);

/* 액센트 (warm coral) */
--accent:          #E8763D;   /* 코랄 — CTA 배경, 진행 링, 완료 ✓ */
--accent-soft:     #FFEDD9;   /* 부드러운 영역, 비활성 배경 */
--accent-strong:   #B8704A;   /* 라벨, 캡션 강조 */

/* 텍스트 */
--text:            #2A1F15;   /* 메인 (다크 브라운, 검정 X) */
--text-muted:      #8B6B4F;   /* 보조 (웜 그레이) — 본문에 사용. AA pass on bg-flat (~5.6:1) */
--text-ghost:      #9A7A56;   /* 비활성/캡션. AA large pass on bg-flat (~4.1:1) */

/* 상태 */
--success: #E8763D;           /* 액센트 재사용 — 완료 = 코랄 */
--danger:  #C44A4A;           /* 빨강 (drop set, 삭제 시) */
```

### 3.2 Color (Dark)

```css
/* 배경 그라데이션 (따뜻한 갈색, 차가운 검정 X) */
--bg-from:        #1A1410;
--bg-to:          #241B14;
--bg-flat:        #1A1410;

/* 표면 */
--surface:        #2D211A;
--surface-shadow: rgba(0, 0, 0, 0.3);

/* 액센트 — 어둠 위 채도 보정 */
--accent:         #FF8B5C;
--accent-soft:    #3D2D22;
--accent-strong:  #C97B5C;

/* 텍스트 — 웜 화이트 (순백 X) */
--text:           #F5EBE0;
--text-muted:     #A89178;    /* AA pass on bg-flat (~5.8:1) */
--text-ghost:     #856B4B;    /* AA large pass on bg-flat (~3.4:1) */

/* 상태 */
--success: #FF8B5C;
--danger:  #E07B7B;
```

### 3.3 Contrast & On-color rules (CRITICAL)

코랄(`--accent`) **on white text는 AA 실패** (2.96:1). 모든 코랄 배경 위 텍스트는 **`--text` (dark brown)** 사용:

| 배경 | 텍스트 | 라이트 결과 | 다크 결과 |
|---|---|---|---|
| `--surface` (white/2D211A) | `--text` | 14.5:1 ✅ AAA | 13.2:1 ✅ AAA |
| `--surface` | `--text-muted` | 5.6:1 ✅ AA | 5.8:1 ✅ AA |
| `--surface` | `--text-ghost` | 4.1:1 ✅ AA Large | 3.4:1 ✅ AA Large |
| `--accent` (E8763D / FF8B5C) | **`--text`** (NOT white) | 6.5:1 ✅ AAA | 6.8:1 ✅ AAA |
| `--accent-soft` | `--text` | 13.8:1 ✅ AAA | 11.9:1 ✅ AAA |

**원칙:** 코랄 위에는 흰색 절대 X. 다크 브라운 텍스트. CTA 버튼이 더 따뜻한 "warm-on-warm" 느낌 됨.

> **다크 vs 라이트 매핑 원칙:** 코랄 명도 ↑ (다크 배경 대비), 텍스트는 웜 화이트, 차가운 검정·순백 절대 X. "따뜻한 어둠".

### 3.4 Typography

**폰트:** Pretendard Variable (CDN @font-face 방식 — Section 6.3 참조)

**Fallback 스택:**
```css
--font-sans: 'Pretendard Variable', 'Pretendard', -apple-system, BlinkMacSystemFont,
             'Apple SD Gothic Neo', 'Noto Sans KR', system-ui, sans-serif;
```

**스케일** (한국어 우선 — line-height는 영문보다 살짝 넉넉):

| 토큰 | size | weight | line-height | letter-spacing | 사용처 |
|---|---|---|---|---|---|
| `text-display` | 36px | 800 | 1.05 | -0.03em | 페이지 메인 타이틀 ("오운완 ✓", "가슴+어깨") |
| `text-h2` | 24px | 800 | 1.15 | -0.02em | 섹션 헤더 |
| `text-h3` | 16px | 800 | 1.3 | -0.01em | 카드 제목 (운동명) |
| `text-stat-l` | 28px | 800 | 1.0 | -0.02em | 큰 수치 (세트 수, 무게 등) |
| `text-body` | 14px | 500 | 1.5 | 0 | 본문 |
| `text-body-strong` | 14px | 700 | 1.5 | 0 | 강조 본문, 버튼 |
| `text-caption` | 12px | 600 | 1.4 | 0 | 보조 정보 |
| `text-label` | 11px | 600 | 1.3 | 0.08em | 작은 라벨 (날짜, 카테고리) |
| `text-tiny` | 10px | 600 | 1.3 | 0.12em | 가장 작은 마이크로카피 |

### 3.5 Spacing

8pt grid 기반. Tailwind 디폴트(4pt) 위에 시맨틱 별칭만 정의:

| 토큰 | 값 | 사용 |
|---|---|---|
| `--space-1` | 4px | 인라인 갭 |
| `--space-2` | 8px | 텍스트 행간 보조 |
| `--space-3` | 12px | 컴포넌트 내부 |
| `--space-4` | 16px | 카드 패딩, 컴포넌트 사이 |
| `--space-5` | 20px | 페이지 좌우 패딩 |
| `--space-6` | 24px | 섹션 사이 |
| `--space-8` | 32px | 큰 섹션 |

### 3.6 Radius

| 토큰 | 값 | 사용 |
|---|---|---|
| `--radius-sm` | 8px | 작은 칩 (요일 칸, 세트 번호 원) |
| `--radius-md` | 12px | 버튼, 입력 |
| `--radius-lg` | 14px | 큰 CTA 버튼 |
| `--radius-xl` | 16px | 카드 |
| `--radius-full` | 9999px | 원형 (진행 링, 아이콘 버튼) |

### 3.7 Shadow

라이트:
```css
--shadow-card: 0 2px 12px rgba(180, 100, 50, 0.06);
--shadow-card-hover: 0 4px 16px rgba(180, 100, 50, 0.10);
```

다크:
```css
--shadow-card: 0 2px 12px rgba(0, 0, 0, 0.3);
--shadow-card-hover: 0 4px 16px rgba(0, 0, 0, 0.4);
```

### 3.8 Animation

기본 easing/duration:

| 토큰 | 값 | 사용 |
|---|---|---|
| `--ease-soft` | `cubic-bezier(0.32, 0.72, 0, 1)` | 일반 트랜지션 |
| `--ease-pop` | `cubic-bezier(0.34, 1.56, 0.64, 1)` | 셀럽 모먼트 (오버슈트) |
| `--dur-fast` | 150ms | 호버, 클릭 |
| `--dur-base` | 250ms | 페이지 트랜지션 |
| `--dur-pop` | 400ms | 셀럽 |

**Celebrate animation — 운동 종료 시 1회만 (운동 1개 완료에는 트리거 X. 매 운동마다 confetti는 과함):**
1. Confetti — `canvas-confetti` 패키지, 120개 입자, 코랄 + 크림 + 화이트 컬러
2. 진행 링 + 핵심 숫자 scale pop — `transform: scale(1) → scale(1.15) → scale(1)`, dur-pop, ease-pop
3. 진행 링 stroke pulse — `stroke-opacity: 1 → 0.4 → 1` 한 번

**Set 완료 ✓ animation (매 ✓ 클릭 시):**
- 체크 버튼 scale pop only — 0.15s, ease-pop
- 배경색 트랜지션 — `bg-surface → bg-accent-soft` 0.25s

**`prefers-reduced-motion` 처리 (필수):**
```typescript
// src/lib/motion.ts
export function prefersReducedMotion() {
  if (typeof window === 'undefined') return false;
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}
```
- Confetti: `if (prefersReducedMotion()) return;` 완전 스킵
- Scale pop / pulse: CSS `@media (prefers-reduced-motion: reduce) { animation: none !important; transition: none !important; }`
- 색상 트랜지션은 유지 (시각적 피드백 필요)

## 4. Component Inventory

각 컴포넌트는 라이트/다크 토큰 자동 적용 (Tailwind CSS variables).

### 4.1 Button
- **Primary** — 큰 CTA. `bg-accent text-text radius-lg p-3.5 font-bold text-body-strong` (⚠ dark text on coral, **NOT white** — Section 3.3 contrast 규칙)
- **Secondary** — 보조. `bg-surface text-text-muted border border-accent-soft radius-md`
- **Ghost** — 텍스트만. `text-accent-strong hover:bg-accent-soft`
- **Icon** — 사각형. `bg-surface text-text-muted radius-md p-2`

`disabled` 상태: `opacity-65`, `pointer-events-none`. (이전 표기 "활성"은 오기 — disabled를 의미)

### 4.2 Card
- **Surface** — `bg-surface shadow-card radius-xl p-4` 흰/다크 표면
- **Outline (active)** — `border-2 border-accent` (현재 진행 중인 운동)
- **Muted (upcoming)** — opacity 0.65 (다음 운동들)

### 4.3 Input
- 무게/회수: 작고 인라인. `bg-surface border border-accent-soft radius-md p-2 text-body font-bold focus:border-accent`
- 텍스트(템플릿 이름): 표준. `text-body p-3 radius-md border border-accent-soft`

### 4.4 Progress Ring
SVG 컴포넌트. 64px 기본.
- 트랙: `stroke-accent-soft` (8px)
- 진행: `stroke-accent` (8px, `stroke-linecap: round`)
- 회전 시작: 12시 방향 (rotate -90)

### 4.5 Day chip (캘린더 칸)
정사각형 (`aspect-ratio: 1`), `radius-sm`. 3가지 상태:
- 완료: `bg-accent text-white text-tiny font-bold`
- 미완: `bg-surface text-text-ghost text-tiny font-semibold`
- 오늘 (미완): `bg-accent-soft text-text border-2 border-dashed border-accent`

### 4.6 Set Row (운동 진행 화면)
세 가지 상태:
- **완료** (✓): `bg-accent-soft radius-md p-2` + 코랄 채워진 ✓ 원 + 무게×회수 표시
- **활성** (입력 중): 코랄 보더 박스, 무게/회수 input 활성
- **비활성** (다음 세트): opacity 0.5, "— kg × —" 표시

### 4.7 Body Part Chip
부위 선택 칩. `radius-full p-2.5 text-body`. 두 상태:
- 선택: `bg-text text-surface` (라이트: 진한 갈색 배경 + 흰 텍스트 14.5:1 / 다크: 웜화이트 배경 + 다크표면 텍스트 13.2:1 — 둘 다 AAA)
- 미선택: `bg-surface border border-accent-soft text-text`

## 5. Screen-Level Redesign

### 5.1 `/dashboard`

**현재:** 단순 "로그인됨: email" + 운동 시작 + 로그아웃

**리뉴얼:**
```
[label-tiny] SAT · 5월 26일
[display]    오운완 ✓  ← 오늘 운동 했으면 ✓, 안 했으면 "운동 전이에요"
[body muted] 오늘 [부위] 잘 끝냈어요  ← 오늘 한 운동 부위 요약

[Card] 진행 카드
  [Progress Ring 64px] + [Stat-l 7 / 8] 운동 · 18세트
  (오늘 세션이 있으면 그 세션의 운동 수 vs 기본 목표 8)

[Section] 이번 주
  [요일 chip × 7] 완료/미완/오늘

[Card] 최근 운동
  랫풀다운     40kg × 10
  스쿼트       60kg × 8

[Primary CTA] + 운동 시작   [Icon] 📊
```

빈 상태 (운동 0회): "오운완을 시작해볼까요?" + 큰 + 운동 시작 버튼만.

**필요한 새 RSC 쿼리 (Phase 3.1에 없음 — Plan 3.5에 추가 작업):**

| 쿼리 헬퍼 | 위치 | 반환 | 용도 |
|---|---|---|---|
| `fetchTodaySession(userId)` | `lib/queries/sessions.ts` | `WorkoutSession + 운동 부위 array` (오늘 일자 first) | "오운완 ✓" 판정 + 부위 요약 + 진행 카드 |
| `fetchWeeklySessionDates(userId, weekStart)` | `lib/queries/sessions.ts` | `Set<dayOfWeek>` (월~일 중 운동한 요일) | 이번 주 요일 chip 7개 |
| `fetchRecentExerciseHistory(userId, limit=2)` | `lib/queries/sets.ts` | `[{ exerciseName, lastWeightKg, lastReps }]` | 최근 운동 카드 |

모두 RLS로 본인 데이터만 반환. Page는 `Promise.all`로 4개(`auth.getUser` 포함) 병렬 fetch.

### 5.2 `/workout/new`

**현재:** body part chip + recommended exercises list + 운동 시작 버튼

**리뉴얼:**
```
[label-tiny] 새 운동
[display]    오늘 뭐 할까요?

[Section label] 부위 선택
[Body part chip × 8 wrap]

[Section] 저장된 분할 (있으면)
[Template chip wrap]

[Section] 추천 (선택 1개 이상 + "추천 보기" 누르면)
[Exercise card × N]
  · 운동명
  · "지난번 50kg × 10" (있으면)
  · "기본 3세트" 

[Primary CTA] 운동 시작 (N개)
[Ghost] 이 분할 저장
```

### 5.3 `/workout/[sessionId]`

**현재:** 운동 카드 N개 + 세트 input + 운동 종료

**리뉴얼:**
```
[label-tiny] 진행 중 · 24분  ← 경과 시간
[h2]         가슴+어깨        ← 세션 이름 (부위 조합 또는 템플릿)
                            [pill] 2 / 7  ← N번째 운동 진행 중

[Card outline] 활성 운동 (코랄 보더)
  벤치프레스                  지난번 50kg × 10
  ✓ 1세트  50kg × 10
  [Active row] 2세트  [52.5] kg × [10]  [✓]
  3세트  — kg × —

[Card muted] 다음 운동
  랫풀다운    3세트

[Card muted] 다음 운동
  사레레      3세트

[Primary CTA] 운동 종료
```

**Active 운동 판정 로직 (client-side, SessionRunner 내부):**
```typescript
// 모든 운동을 순회하면서 "아직 모든 세트가 저장되지 않은" 첫 운동 = active.
// "default_sets개의 메인 세트가 모두 savedSets에 있는가"로 완료 판단.
const activeExerciseId = useMemo(() => {
  for (const ex of exercises) {
    const targetSets = ex.default_sets ?? 3;
    const savedMainSets = savedSets.filter(
      (s) => s.exercise_id === ex.id && s.parent_set_id === null,
    ).length;
    if (savedMainSets < targetSets) return ex.id;
  }
  return null; // 전부 완료 → "운동 종료" 활성화
}, [exercises, savedSets]);
```

UI: `activeExerciseId === ex.id`이면 `border-2 border-accent`, 아니면 `opacity-65`.

### 5.4 부수 화면

- **/login** — 로고 + "구글로 시작하기" 버튼. 그라데이션 배경, 손글씨 X.
- **loading.tsx** — Skeleton이 base coral 톤으로 (Tailwind `animate-pulse` + `bg-accent-soft`)
- **error.tsx** — "문제가 발생했어요" + 다시 시도 ghost 버튼
- **not-found.tsx** — "찾을 수 없어요" + 대시보드로 secondary 버튼

## 6. Implementation Approach

### 6.1 Tailwind v4 토큰 통합 (클래스 기반 다크모드)

**기존 globals.css와의 호환성:** 현재 코드는 `@custom-variant dark (&:is(.dark *))` + `:root` / `.dark` 패턴 사용 중. shadcn base-nova의 grayscale oklch 토큰이 함께 정의되어 있음. **이 패턴을 유지하면서** 새 따뜻한 토큰을 위에 얹는 방식.

`@media (prefers-color-scheme: dark) { @theme { ... } }` 절대 사용 금지 — Tailwind v4에서 `@theme`는 build-time 정적 분석. media 안에 못 넣음.

**최종 globals.css 구조:**

```css
@import "tailwindcss";
@import "tw-animate-css";
/* @import "shadcn/tailwind.css" 제거 — Section 6.5 참조 */

@custom-variant dark (&:is(.dark *));

/* 1. 시맨틱 토큰을 Tailwind 클래스로 노출 */
@theme inline {
  /* 색상 (CSS variable 참조) */
  --color-bg-from: var(--bg-from);
  --color-bg-to: var(--bg-to);
  --color-bg-flat: var(--bg-flat);
  --color-surface: var(--surface);
  --color-accent: var(--accent);
  --color-accent-soft: var(--accent-soft);
  --color-accent-strong: var(--accent-strong);
  --color-text: var(--text);
  --color-text-muted: var(--text-muted);
  --color-text-ghost: var(--text-ghost);
  --color-success: var(--success);
  --color-danger: var(--danger);

  /* 폰트 */
  --font-sans: 'Pretendard Variable', 'Pretendard', -apple-system, BlinkMacSystemFont,
               'Apple SD Gothic Neo', 'Noto Sans KR', system-ui, sans-serif;

  /* Radius */
  --radius-sm: 8px;
  --radius-md: 12px;
  --radius-lg: 14px;
  --radius-xl: 16px;

  /* Easing */
  --ease-soft: cubic-bezier(0.32, 0.72, 0, 1);
  --ease-pop: cubic-bezier(0.34, 1.56, 0.64, 1);
}

/* 2. 라이트 모드 변수 */
:root {
  --bg-from: #FFF8EE;
  --bg-to: #FFEDD9;
  --bg-flat: #FFF8EE;
  --surface: #FFFFFF;
  --accent: #E8763D;
  --accent-soft: #FFEDD9;
  --accent-strong: #B8704A;
  --text: #2A1F15;
  --text-muted: #8B6B4F;
  --text-ghost: #9A7A56;
  --success: #E8763D;
  --danger: #C44A4A;
  --surface-shadow: 0 2px 12px rgba(180, 100, 50, 0.06);
}

/* 3. 다크 모드 변수 (next-themes가 .dark class 토글) */
.dark {
  --bg-from: #1A1410;
  --bg-to: #241B14;
  --bg-flat: #1A1410;
  --surface: #2D211A;
  --accent: #FF8B5C;
  --accent-soft: #3D2D22;
  --accent-strong: #C97B5C;
  --text: #F5EBE0;
  --text-muted: #A89178;
  --text-ghost: #856B4B;
  --success: #FF8B5C;
  --danger: #E07B7B;
  --surface-shadow: 0 2px 12px rgba(0, 0, 0, 0.3);
}

/* 4. Reduced motion */
@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after {
    animation-duration: 0.01ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: 0.01ms !important;
  }
}

/* 5. Base */
@layer base {
  html { @apply font-sans; }
  body {
    @apply text-text;
    background: linear-gradient(160deg, var(--bg-from) 0%, var(--bg-to) 100%);
    min-height: 100dvh;
  }
}
```

Tailwind 클래스 사용 예: `bg-surface`, `text-text-muted`, `border-accent-soft`, `rounded-xl`, `font-sans`.

### 6.2 Dark Mode 토글 (next-themes — 이미 설치됨)

**현 상태:** `next-themes@^0.4.6` 이미 `package.json`에 있음. `src/components/ui/sonner.tsx`가 `useTheme()` 사용 중. Provider는 아직 마운트 안 됨.

**변경 사항:**

1. `src/components/providers/theme-provider.tsx` 신설:
```typescript
"use client";
import { ThemeProvider as NextThemesProvider } from "next-themes";

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  return (
    <NextThemesProvider
      attribute="class"
      defaultTheme="system"
      enableSystem
      disableTransitionOnChange
    >
      {children}
    </NextThemesProvider>
  );
}
```

2. `src/app/layout.tsx` 수정:
   - `<ThemeProvider>` wrapping (QueryProvider 바깥)
   - `<html lang="ko" suppressHydrationWarning>` ← **suppressHydrationWarning 필수** (next-themes가 client에서 `class="dark"` 주입)
   - 기존 `Geist`, `Geist_Mono` 임포트 **제거** (Pretendard 단일)
   - 배경 그라데이션은 `globals.css`의 `body` 규칙으로 옮김 (각 화면에서 background-style 제거)

3. **토글 UI 위치:** Plan 3.5 범위 — 대시보드 상단 우측 작은 icon 버튼 (Sun/Moon/Monitor lucide 아이콘). 별도 설정 페이지는 만들지 않음. 토글 → `setTheme('light' | 'dark' | 'system')`.

### 6.3 Pretendard 폰트 (CDN @font-face)

**선택:** CDN @font-face. Reason: `next/font/local`은 `node_modules` 경로를 resolve 못 함. Pretendard npm 패키지의 woff2 파일을 별도 복사해야 하는데 추가 복잡도. CDN은 1줄로 끝남.

**globals.css 최상단에 추가:**
```css
@import url('https://cdn.jsdelivr.net/gh/orioncactus/pretendard@v1.3.9/dist/web/variable/pretendardvariable-dynamic-subset.min.css');
```

> `dynamic-subset`은 한글 동적 서브셋(필요한 글자만). 전체 파일 ~200KB → 서브셋 ~30KB. CLS 방지 위해 `font-display: swap`은 패키지 CSS가 이미 설정함.

**Fallback** (CDN 지연 시): Section 3.4의 `--font-sans`에 정의된 시스템 폰트 stack.

`layout.tsx`의 `Geist`, `Geist_Mono` import 및 className 사용 **전부 제거** (의존성도 `next/font/google`만 쓰는 거라 추가 정리 X).

### 6.4 Confetti (Celebrate)

`pnpm add canvas-confetti` + `pnpm add -D @types/canvas-confetti`.

`src/lib/celebrate.ts`:
```typescript
"use client";
import { prefersReducedMotion } from "@/lib/motion";

// canvas-confetti는 document를 직접 만지므로 dynamic import + client만 호출.
export async function celebrate() {
  if (prefersReducedMotion()) return;
  const { default: confetti } = await import("canvas-confetti");
  // 현재 테마에서 코랄 hex 가져오기 (라이트/다크 동일 시각효과 위해 라이트값 사용)
  confetti({
    particleCount: 120,
    spread: 70,
    origin: { y: 0.7 },
    colors: ["#E8763D", "#FFEDD9", "#FFFFFF", "#B8704A"],
  });
}
```

**호출 시점 (단 1군데):** `finishSession` Server Action 완료 직후 클라이언트. 운동 1개 완료 시에는 호출 X (Section 3.8 — 매 운동마다 confetti는 과함).

### 6.5 shadcn 토큰 매핑 (CRITICAL)

기존 shadcn 컴포넌트가 사용하는 토큰명(`bg-primary`, `text-muted-foreground` 등)을 새 토큰명으로 교체. **`@import "shadcn/tailwind.css"` 줄은 globals.css에서 제거** (기존 oklch grayscale 토큰이 새 따뜻한 토큰과 충돌 — 라이트가 회색 base 그대로면 디자인 안 변함).

**Mapping table:**

| shadcn 토큰 | 새 토큰 | 비고 |
|---|---|---|
| `--background` / `bg-background` | `--bg-flat` / `bg-bg-flat` | body 배경은 globals.css가 그라데이션으로 그림. 단색 필요시 `bg-bg-flat` |
| `--foreground` / `text-foreground` | `--text` / `text-text` | 메인 텍스트 |
| `--card` / `bg-card` | `--surface` / `bg-surface` | 카드 표면 |
| `--card-foreground` | `--text` / `text-text` | |
| `--popover` / `bg-popover` | `--surface` / `bg-surface` | 토스트, 드롭다운 |
| `--popover-foreground` | `--text` / `text-text` | |
| `--primary` / `bg-primary` | `--accent` / `bg-accent` | CTA 색 |
| `--primary-foreground` | `--text` / `text-text` | ⚠ `text-white` X — Section 3.3 contrast 규칙 |
| `--secondary` / `bg-secondary` | `--accent-soft` / `bg-accent-soft` | 부드러운 영역 |
| `--secondary-foreground` | `--text` / `text-text` | |
| `--muted` / `bg-muted` | `--accent-soft` / `bg-accent-soft` | 비활성 배경 |
| `--muted-foreground` / `text-muted-foreground` | `--text-muted` / `text-text-muted` | 보조 텍스트 |
| `--accent` (shadcn) | `--accent-soft` / `bg-accent-soft` | shadcn `--accent`는 hover 강조용 — 우리 `--accent-soft`와 의미 같음 |
| `--accent-foreground` | `--text` / `text-text` | |
| `--border` / `border-border` | `--accent-soft` / `border-accent-soft` | |
| `--input` | `--accent-soft` | input 보더 |
| `--ring` / `ring-ring` | `--accent` / `ring-accent` | focus ring |
| `--destructive` | `--danger` / `bg-danger` | |
| `--radius` | (제거) — `radius-{sm,md,lg,xl}` 직접 사용 | |

**구현 방식:** `:root` / `.dark`에서 위 매핑대로 변수 alias 정의. shadcn 컴포넌트 .tsx 파일은 **수정 없이** 새 색상 자동 적용. 예:

```css
:root {
  /* 새 토큰 */
  --accent: #E8763D;
  --surface: #FFFFFF;
  /* ... */

  /* shadcn alias (compat) */
  --primary: var(--accent);
  --primary-foreground: var(--text);
  --card: var(--surface);
  --card-foreground: var(--text);
  --muted-foreground: var(--text-muted);
  --border: var(--accent-soft);
  /* ... */
}
```

이렇게 하면 shadcn `<Button variant="default">` (`bg-primary text-primary-foreground`) 가 자동으로 `bg-accent text-text`처럼 렌더됨. **CVA variants 수정 불필요** — alias 한 곳에서 끝.

### 6.6 새 컴포넌트

- `src/components/ui/progress-ring.tsx` — SVG 진행 링 (`size`, `value`, `max` props)
- `src/components/ui/body-part-chip.tsx` — 부위 chip (`selected`, `onClick`, `label`)
- `src/components/ui/day-chip.tsx` — 요일 칸 (`day`, `state: "done" | "missed" | "today"`)
- `src/components/ui/set-row.tsx` — 세트 input row 3상태 (`status: "done" | "active" | "upcoming"`)
- `src/lib/celebrate.ts` — confetti 헬퍼 (Section 6.4)
- `src/lib/motion.ts` — `prefersReducedMotion` 헬퍼 (Section 3.8)
- `src/components/providers/theme-provider.tsx` — next-themes wrapper (Section 6.2)

### 6.7 화면 단위 수정 범위

| 파일 | 변경 | 작업량 |
|---|---|---|
| `src/app/globals.css` | 토큰 시스템 전면 교체 (Section 6.1) | 큼 |
| `src/app/layout.tsx` | ThemeProvider, suppressHydrationWarning, Geist 제거, Pretendard 단일 | 중 |
| `src/app/login/page.tsx` | 로고 + 구글 버튼 톤 적용 (※ `(auth)` 라우트 그룹 없음 — 실제 경로 `app/login/`) | 작 |
| `src/app/dashboard/page.tsx` | 4 RSC 쿼리 병렬, 진행 카드 + 요일 + 최근 운동 + 테마 토글 + CTA | 큼 |
| `src/app/dashboard/actions.ts` | (변경 없음) | — |
| `src/app/workout/new/page.tsx` + `StartForm.tsx` | 부위 chip → BodyPartChip 컴포넌트, 추천 카드 톤 | 중 |
| `src/app/workout/[sessionId]/page.tsx` + `SessionRunner.tsx` | activeExerciseId 계산, SetRow 컴포넌트, 운동 종료 → celebrate() | 큼 |
| `src/app/workout/{new,[sessionId]}/loading.tsx` | Skeleton 톤 — `bg-accent-soft animate-pulse` | 작 |
| `src/app/workout/{new,[sessionId]}/error.tsx` | "문제가 발생했어요" + ghost 버튼 | 작 |
| `src/app/workout/[sessionId]/not-found.tsx` | "세션을 찾을 수 없어요" + secondary 버튼 | 작 |
| `src/components/ui/button.tsx` | variants에 `text-text` 강제 (CVA 수정) — primary-foreground alias로 자동이지만 명시도 OK | 작 |
| `src/components/ui/{card,input,label,checkbox,badge,separator,dialog,skeleton}.tsx` | (수정 없음 — alias로 자동 적용) | — |
| `src/components/ui/sonner.tsx` | 색상 alias로 자동. 단 `--normal-bg`, `--normal-text` 등 sonner 자체 토큰 매핑 1줄 추가 | 작 |
| `src/lib/queries/sessions.ts` | `fetchTodaySession`, `fetchWeeklySessionDates` 신설 | 중 |
| `src/lib/queries/sets.ts` | `fetchRecentExerciseHistory` 신설 | 중 |

**비고:** `src/app/workout/new/not-found.tsx`는 존재하지 않음 (only `[sessionId]/not-found.tsx`). 새로 만들 필요 X.

## 7. Out of Scope (this design)

- **PWA / 오프라인 셸** — Phase 6
- **차트/캘린더 풀뷰** — Phase 4
- **운동 카탈로그 페이지** (CRUD) — Phase 5
- **드롭세트/좌우 입력/타이머 UI** — Plan 3.2 (위 토큰 시스템 활용 예정)
- **로고/아이콘 디자인** — 임시로 텍스트 + ✓ 이모지 사용, 추후 Phase 7 polish에서 결정

> **이 plan으로 옮겨온 항목 (원래 Plan 3.2 후보였음):**
> - **운동 진행 중 운동 카드 삭제** (✕ 버튼 + 세트 저장 시 확인 다이얼로그 + CASCADE delete)
> - **지난번 기록 값으로 세트 input 자동 채움** (`fetchLastMainSetsByExercise` 활용)
>
> 이유: 사용자 헬스장 실사용 직전 우선순위 ↑ — 다음 세션 디자인 리뉴얼 머지될 때 함께 사용 가능해야 ROI 큼.

## 8. Testing

1인 프로젝트 + 시각 디자인 → **자동화 테스트 안 함**. 대신:

- ✅ 라이트/다크 두 모드에서 각 화면 수동 점검 (대시보드, /workout/new, /workout/[id], login, loading/error/not-found)
- ✅ DevTools Accessibility Pane으로 contrast 검증 — Section 3.3 표대로 AA 이상 확인
- ✅ Chrome DevTools "iPhone 14 Pro" 시뮬레이션 + "Slow 3G" throttle
- ✅ 실제 폰(Safari)에서 1회 cycle (`/login → /dashboard → /workout/new → /workout/[id] → 종료`)
- ✅ Lighthouse 데스크탑/모바일 점수 90+ (Plan 3.1 baseline 유지)
- ✅ Confetti 애니메이션 60fps 확인 — 운동 종료 모먼트만 (Section 3.8)
- ✅ `prefers-reduced-motion: reduce` 켠 상태에서 confetti / scale pop 미발동 확인 (DevTools → Rendering → Emulate CSS media feature)
- ✅ next-themes 토글 시 hydration warning 없음 확인 (콘솔)
- ✅ Pretendard 로드 전/후 CLS 확인 — Lighthouse Performance "Cumulative Layout Shift" < 0.1

## 9. Success Criteria

- [ ] 본인 폰으로 봤을 때 "이거 좋다"고 느껴짐 (주관적이지만 핵심)
- [ ] 토큰이 한 곳(`globals.css`)에 정의되어 향후 Phase 3.2~6에서 일관성 유지
- [ ] 다크/라이트 두 모드 모두 동작
- [ ] Phase 3.1의 기존 기능(세션 시작·세트 입력·종료) 회귀 없음
- [ ] Confetti가 운동 종료 시 한 번 터짐 + 60fps 유지
- [ ] PR 머지 + 태그 `v0.3.5-design-system`

## 10. Risks

| 리스크 | 영향 | 완화 |
|---|---|---|
| Tailwind v4 `@theme`는 build-time 정적 — `@media` 내부 X | 해결됨 | `@theme inline`에 CSS var 참조 + `:root` / `.dark` 클래스에서 값 정의. next-themes의 `attribute="class"`와 일치 (Section 6.1, 6.2). |
| next-themes hydration mismatch | 해결됨 | `<html suppressHydrationWarning>` + `disableTransitionOnChange`로 깜빡임 차단 (Section 6.2). |
| Pretendard CDN 지연 시 CLS | 중간 | `dynamic-subset` (~30KB) + fallback `Apple SD Gothic Neo`/`Noto Sans KR` 시스템 폰트. `font-display: swap`은 패키지가 기본. |
| Confetti가 저사양 폰에서 끊김 | 해결됨 | 120개 입자 + `prefers-reduced-motion` 시 완전 스킵 + dynamic import로 초기 번들 영향 0 (Section 6.4). |
| shadcn `@import "shadcn/tailwind.css"` 제거 시 기존 컴포넌트 회귀 | 중간 | shadcn 컴포넌트들이 쓰는 토큰은 새 `:root`/`.dark`에서 **alias**로 매핑 (Section 6.5). 컴포넌트 .tsx 수정 없이 자동 적용. 머지 전 모든 화면 수동 회귀 점검 필수. |
| Sonner의 자체 토큰 (`--normal-bg` 등)이 안 매핑됨 | 낮음 | `sonner.tsx`에 CSS var override 한 줄 추가 (Section 6.7). |
| 코랄 위 흰 텍스트 시 WCAG AA 실패 (2.96:1) | 해결됨 | 모든 코랄 배경 위 텍스트는 `--text` (dark brown). primary-foreground alias도 `--text`로. Section 3.3 + 6.5. |
| 다크모드 사용자가 거의 없음 (1인 앱) | 낮음 | 그래도 spec에 포함 — 포트폴리오 시그널 + OS 자동 감지로 비용 0. |
| `Geist` 폰트 import 남으면 두 폰트 로드 | 낮음 | layout.tsx에서 명시적으로 제거 (Section 6.7). |
| 한국어 + 영어 혼합 텍스트 letter-spacing 미관 | 낮음 | Pretendard가 두 글자 모두 균일 처리 (Pretendard 설계 목적). |
| Dashboard에 새 RSC 쿼리 3개 추가 — 페이지 로딩 느려짐 | 낮음 | 4개 fetch `Promise.all` 병렬 + Supabase indexed columns. |

## 11. Open Questions

구현 중 결정 필요 (Plan 3.5에서 다룰지, 보류할지):
- **로고/아이콘 디자인** — 현재 "오운완 ✓" 텍스트 + 이모지 사용. 추후 Phase 7 polish에서 로고 디자인. PWA manifest는 그때 같이.
- **대시보드 "오늘 운동 안 함" 상태 마이크로카피** — "운동 전이에요" vs "아직 운동 전" vs "오늘은 쉬는 날인가요?" 등. 실제 사용해보고 결정.
- **이번 주 시작 요일** — 월요일 시작 (현재 spec) vs 일요일 시작. 한국 기본은 월요일이지만 사용자 선호 확인 필요.

(나머지 핵심 결정은 brainstorming 단계 + critic round 1에서 확정)

## References

- 본 spec과 짝이 되는 mockup: `.superpowers/brainstorm/28936-1779946122/*.html` (gitignored)
- 제품 spec: `docs/specs/2026-05-22-gym-routine-app-design.md`
- ADR-007 (frontend state) — Tailwind/shadcn 결정 유지
- Brainstorming session: 2026-05-28 (이 문서 작성 직전)

## Revision History

| Version | Date | Change |
|---------|------|--------|
| v1 | 2026-05-28 | 초안 — 사용자 "디자인 다 쓰레기" 피드백 → brainstorming → Apple Health 구조 + 코랄 + Pretendard + 다크모드 + Celebrate + Lucide + 친근 존대 |
| v2 | 2026-05-28 | critic round 1 반영: (CRITICAL) Tailwind v4 `@theme + @media` 패턴 → 기존 `:root` / `.dark` 클래스 패턴으로 전면 교체. (CRITICAL) 코랄 위 흰 텍스트 (2.96:1) → 다크 브라운 텍스트 (6.5:1) + Section 3.3 contrast 표 추가. (MAJOR) next-themes 이미 설치됨 명시, `suppressHydrationWarning` 추가, Geist 폰트 제거 명시. (MAJOR) shadcn 토큰 alias 매핑 표 추가 — 컴포넌트 .tsx 수정 없이 자동 적용. (MAJOR) Pretendard CDN @font-face 방식 확정 (next/font/local 포기). (MAJOR) `--text-ghost` AA fail (#C9A78D → #9A7A56). 신설: Section 3.3 Contrast 규칙, dashboard 새 RSC 쿼리 3개, SessionRunner activeExerciseId 계산 로직, `prefers-reduced-motion` 처리. Confetti는 운동 종료 1회만 (운동 1개 완료에선 X). 영향 파일 경로 정확화 (`/login` 직접 — `(auth)` 없음). |
