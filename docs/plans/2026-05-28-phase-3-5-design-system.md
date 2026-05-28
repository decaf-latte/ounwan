# Phase 3.5: Design System Renewal Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Phase 3.1로 머지된 모든 화면을 spec(`docs/specs/2026-05-28-design-system-design.md`)에 정의된 따뜻한 코랄 디자인 시스템으로 리뉴얼. 라이트/다크 동시 디자인, Pretendard 폰트, 운동 종료 시 confetti, 친근 + 존대 마이크로카피.

**Architecture:** Tailwind v4 클래스 기반 다크모드 (`@theme inline` + `:root` / `.dark`), shadcn 컴포넌트는 alias 매핑으로 .tsx 수정 없이 자동 적용. 새 UI 프리미티브 4개 (ProgressRing, BodyPartChip, DayChip, SetRow) 추가. 대시보드 3개 RSC 쿼리 신설. SessionRunner에 activeExerciseId 계산 + celebrate 트리거.

**Tech Stack:** Next.js 16 / React 19 / TypeScript 5 / Tailwind CSS v4 / next-themes v0.4.6 (already installed) / Pretendard Variable (CDN) / canvas-confetti (new) / lucide-react (already installed)

**Reference docs:**
- Spec: `docs/specs/2026-05-28-design-system-design.md` (특히 Section 3, 4, 5, 6 — 토큰, 컴포넌트, 화면, 구현)
- Brainstorming mockups: `.superpowers/brainstorm/28936-*/locked-direction.html`, `dark-mode.html` (gitignored, 참고용)
- Plan 3.1 (이전 작업): `docs/plans/2026-05-26-phase-3-1-workout-runner-basic.md`

**완료 시점에 검증되는 것:**

| 항목 | 검증 |
|---|---|
| 라이트 모드 | `/dashboard`, `/workout/new`, `/workout/[id]`, `/login` 모두 spec 디자인대로 |
| 다크 모드 | 같은 화면들 `<html class="dark">` 토글 시 자동 적용 |
| 폰트 | Pretendard Variable 로드, Geist 완전 제거 |
| Confetti | 운동 종료 시 1회 발동 (운동 1개 완료에는 X) |
| Reduced motion | `prefers-reduced-motion: reduce` 시 confetti/scale pop 미발동 |
| Hydration | 콘솔 warning 0개 (next-themes + suppressHydrationWarning) |
| WCAG AA | spec Section 3.3 contrast 표대로 검증 (DevTools accessibility pane) |
| 회귀 | `pnpm test` 9/9 통과 (RLS 3 + recommendation 6) |
| Build | `pnpm build` 0 errors |

**스코프 명시 — 이 plan에 포함 안 됨:**
- ❌ 로고 / 앱 아이콘 디자인 (Phase 7 polish)
- ❌ 차트 / 풀 캘린더 페이지 (Phase 4)
- ❌ 운동 카탈로그 페이지 (Phase 5)
- ❌ 드롭세트 UI / 좌우 분리 / 휴식 타이머 UI (Plan 3.2)
- ❌ PWA / 오프라인 셸 (Phase 6)

> Plan 3.2 (드롭/좌우/타이머)는 이 plan 머지 후 새 토큰 시스템 위에서 작업.

---

## 데이터 흐름 (대시보드 신설 쿼리)

```
/dashboard (RSC)
  ├─ auth.getUser()
  ├─ fetchTodaySession(uid)        ← 오늘 운동 했는지 + 부위 요약
  ├─ fetchWeeklySessionDates(uid)  ← 이번 주 운동한 요일 Set
  └─ fetchRecentExerciseHistory(uid, 2)  ← 최근 운동 2개

→ <Dashboard ... /> 클라이언트 hydration (테마 토글 + lucide 아이콘)
```

---

## 마이그레이션 원칙 (회귀 방지)

| 원칙 | 이유 |
|---|---|
| shadcn 컴포넌트 .tsx 파일은 수정 X | alias 매핑으로 새 색상 자동 적용. 변경 영역 최소화. |
| Plan 3.1 Server Actions / DB 쿼리는 수정 X | 데이터 레이어는 동일. 시각만 변경. |
| 기존 RLS 테스트 + recommendation 테스트는 수정 X | 회귀 감지 baseline. |
| 컴포넌트 props 시그니처 유지 | StartForm/SessionRunner의 외부 호출 흐름 보존. |

---

## Chunk 1: Foundation — Token System + Dark Mode

**목표:** globals.css 토큰 전면 교체 + ThemeProvider 마운트 + Pretendard 로드 + Geist 제거. 끝나면 `<html class="dark">` 토글로 색상 자동 전환되어야 함.

### Task 1.1: 브랜치 확인 + 의존성

**현재 브랜치는 이미 `feat/phase-3-5-design-system` (디자인 spec commit `d680238`이 이 브랜치에 있음).** 새로 만들지 않음.

- [ ] **Step 1.1.1: 브랜치 확인**

```bash
cd "/Users/jeonhyejin/Desktop/사이드프로젝트/gym-routine-app"
git branch --show-current
# Expected: feat/phase-3-5-design-system
git log --oneline -1
# Expected: d680238 docs(phase-3-5): design system spec ...
```

- [ ] **Step 1.1.2: canvas-confetti 설치**

```bash
pnpm add canvas-confetti
pnpm add -D @types/canvas-confetti
```

Expected: `package.json`에 `canvas-confetti` (deps), `@types/canvas-confetti` (devDeps) 추가됨.

- [ ] **Step 1.1.3: 설치 검증 commit**

```bash
git add package.json pnpm-lock.yaml
git commit -m "chore(phase-3-5): add canvas-confetti for session completion celebrate"
```

---

### Task 1.2: globals.css 토큰 시스템 전면 교체

**Files:**
- Modify: `src/app/globals.css` (전체 교체)

이 변경이 가장 중요합니다. spec Section 6.1, 6.5의 패턴을 정확히 따릅니다.

- [ ] **Step 1.2.1: 새 globals.css 작성**

`src/app/globals.css` 전체를 다음으로 교체:

```css
/* src/app/globals.css */
@import url('https://cdn.jsdelivr.net/gh/orioncactus/pretendard@v1.3.9/dist/web/variable/pretendardvariable-dynamic-subset.min.css');
@import "tailwindcss";
@import "tw-animate-css";

@custom-variant dark (&:is(.dark *));

/* ─────────────────────────────────────────────────────────
   1. 시맨틱 토큰 → Tailwind 클래스 노출
   ───────────────────────────────────────────────────────── */
@theme inline {
  /* 색상 */
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

  /* shadcn alias (compat layer — 기존 컴포넌트 .tsx 수정 없이 자동 적용) */
  --color-background: var(--bg-flat);
  --color-foreground: var(--text);
  --color-card: var(--surface);
  --color-card-foreground: var(--text);
  --color-popover: var(--surface);
  --color-popover-foreground: var(--text);
  --color-primary: var(--accent);
  --color-primary-foreground: var(--text);
  --color-secondary: var(--accent-soft);
  --color-secondary-foreground: var(--text);
  --color-muted: var(--accent-soft);
  --color-muted-foreground: var(--text-muted);
  --color-accent-foreground: var(--text);
  --color-border: var(--accent-soft);
  --color-input: var(--accent-soft);
  --color-ring: var(--accent);
  --color-destructive: var(--danger);

  /* 폰트 */
  --font-sans: 'Pretendard Variable', 'Pretendard', -apple-system, BlinkMacSystemFont,
               'Apple SD Gothic Neo', 'Noto Sans KR', system-ui, sans-serif;
  --font-heading: 'Pretendard Variable', 'Pretendard', -apple-system, BlinkMacSystemFont,
                  'Apple SD Gothic Neo', 'Noto Sans KR', system-ui, sans-serif;
  --font-mono: ui-monospace, 'SFMono-Regular', Menlo, Monaco, Consolas, monospace;

  /* Radius */
  --radius-sm: 8px;
  --radius-md: 12px;
  --radius-lg: 14px;
  --radius-xl: 16px;

  /* Easing */
  --ease-soft: cubic-bezier(0.32, 0.72, 0, 1);
  --ease-pop: cubic-bezier(0.34, 1.56, 0.64, 1);
}

/* ─────────────────────────────────────────────────────────
   2. 라이트 모드 변수
   ───────────────────────────────────────────────────────── */
:root {
  /* 시맨틱 색상 */
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
  --radius: 0.875rem;

  /* shadcn raw CSS vars — sonner.tsx, card.tsx 등이 inline style/className에서 직접 참조 */
  /* @theme inline의 --color-* alias는 Tailwind utility용. 컴포넌트 내부 var() 참조는 raw var 필요. */
  --background: var(--bg-flat);
  --foreground: var(--text);
  --card: var(--surface);
  --card-foreground: var(--text);
  --popover: var(--surface);
  --popover-foreground: var(--text);
  --primary: var(--accent);
  --primary-foreground: var(--text);
  --secondary: var(--accent-soft);
  --secondary-foreground: var(--text);
  --muted: var(--accent-soft);
  --muted-foreground: var(--text-muted);
  --accent-foreground: var(--text);
  --border: var(--accent-soft);
  --input: var(--accent-soft);
  --ring: var(--accent);
  --destructive: var(--danger);
}

/* ─────────────────────────────────────────────────────────
   3. 다크 모드 변수 (next-themes가 .dark 클래스 토글)
   ───────────────────────────────────────────────────────── */
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

  /* raw vars 다크 모드 — light :root와 동일한 alias 구조. 값은 .dark 위 토큰이 자동 적용 */
  --background: var(--bg-flat);
  --foreground: var(--text);
  --card: var(--surface);
  --card-foreground: var(--text);
  --popover: var(--surface);
  --popover-foreground: var(--text);
  --primary: var(--accent);
  --primary-foreground: var(--text);
  --secondary: var(--accent-soft);
  --secondary-foreground: var(--text);
  --muted: var(--accent-soft);
  --muted-foreground: var(--text-muted);
  --accent-foreground: var(--text);
  --border: var(--accent-soft);
  --input: var(--accent-soft);
  --ring: var(--accent);
  --destructive: var(--danger);
}

/* ─────────────────────────────────────────────────────────
   4. Reduced motion
   ───────────────────────────────────────────────────────── */
@media (prefers-reduced-motion: reduce) {
  *,
  *::before,
  *::after {
    animation-duration: 0.01ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: 0.01ms !important;
  }
}

/* ─────────────────────────────────────────────────────────
   5. Base
   ───────────────────────────────────────────────────────── */
@layer base {
  * {
    @apply border-border outline-ring/50;
  }
  html {
    font-family: var(--font-sans);
  }
  body {
    color: var(--text);
    background: linear-gradient(160deg, var(--bg-from) 0%, var(--bg-to) 100%);
    min-height: 100dvh;
  }
}
```

> **삭제된 것:** `@import "shadcn/tailwind.css"` (oklch grayscale 토큰 — alias로 우리 토큰이 우선), shadcn의 chart/sidebar 토큰 (사용 X). 기존 `--background: oklch(1 0 0)` 같은 정의들 전부.

- [ ] **Step 1.2.2: dev 서버 기동해서 깨진 곳 확인**

```bash
pnpm dev
```

브라우저: `http://localhost:3000/login`. 그라데이션 배경 + Pretendard 폰트 + 코랄 톤이어야 함. 검은 글자/회색이 보이면 alias 매핑이 작동 안 한 것 (다음 step에서 디버깅).

→ Ctrl+C로 중단.

- [ ] **Step 1.2.3: TypeScript / lint 확인**

```bash
pnpm tsc --noEmit && pnpm lint
```

Expected: 0 errors. (globals.css는 검사 대상 아니지만, 영향 받는 다른 파일은 검사.)

- [ ] **Step 1.2.4: 커밋**

```bash
git add src/app/globals.css
git commit -m "feat(phase-3-5): globals.css token system — coral on cream, dark mode via .dark class"
```

---

### Task 1.3: ThemeProvider + layout.tsx 리뉴얼

**Files:**
- Create: `src/components/providers/theme-provider.tsx`
- Modify: `src/app/layout.tsx`

- [ ] **Step 1.3.1: ThemeProvider 컴포넌트 작성**

`src/components/providers/theme-provider.tsx`:

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

- [ ] **Step 1.3.2: layout.tsx 전체 재작성**

`src/app/layout.tsx` 전체 교체:

```typescript
import type { Metadata } from "next";
import "./globals.css";
import { QueryProvider } from "@/components/providers/query-provider";
import { ThemeProvider } from "@/components/providers/theme-provider";
import { Toaster } from "@/components/ui/sonner";

export const metadata: Metadata = {
  title: "오운완 (Ounwan)",
  description: "개인용 헬스 루틴 관리 PWA",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ko" className="h-full antialiased" suppressHydrationWarning>
      <body className="min-h-full flex flex-col">
        <ThemeProvider>
          <QueryProvider>
            {children}
            <Toaster />
          </QueryProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
```

**변경 사항:**
- ❌ 제거: `Geist`, `Geist_Mono` 임포트 + `geistSans.variable` 등 className 사용
- ✅ 추가: `<ThemeProvider>` (`<QueryProvider>` 바깥, QueryProvider도 hooks 사용하므로 안쪽)
- ✅ 추가: `suppressHydrationWarning` (next-themes가 client에서 `class="dark"` 주입)

- [ ] **Step 1.3.3: dev 서버에서 hydration warning 0개 확인**

```bash
pnpm dev
```

브라우저 콘솔 열어두고 `/login` 진입. Hydration 관련 빨간 에러 없어야 함. (만약 sonner.tsx가 hydration mismatch를 일으키면 별도 처리 필요 — 다음 step에서 확인)

→ Ctrl+C.

- [ ] **Step 1.3.4: TypeCheck + lint**

```bash
pnpm tsc --noEmit && pnpm lint
```

Expected: 0 errors.

- [ ] **Step 1.3.5: 커밋**

```bash
git add src/components/providers/theme-provider.tsx src/app/layout.tsx
git commit -m "feat(phase-3-5): mount next-themes ThemeProvider + remove Geist font (Pretendard only via CDN)"
```

---

## Chunk 2: Utilities — Motion + Celebrate

**목표:** confetti 호출 전 `prefers-reduced-motion` 검사 + 실제 confetti 발동 헬퍼. 호출은 Chunk 5의 SessionRunner에서.

### Task 2.1: motion.ts (reduced motion 검사)

**Files:**
- Create: `src/lib/motion.ts`
- Create: `tests/lib/motion.test.ts`

- [ ] **Step 2.1.1: 테스트 fixture + 첫 테스트 (RED)**

`tests/lib/motion.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { prefersReducedMotion } from "@/lib/motion";

describe("prefersReducedMotion", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("returns false when window is undefined (SSR)", () => {
    vi.stubGlobal("window", undefined);
    expect(prefersReducedMotion()).toBe(false);
  });

  it("returns true when matchMedia reports reduce", () => {
    vi.stubGlobal("window", {
      matchMedia: (q: string) => ({
        matches: q === "(prefers-reduced-motion: reduce)",
      }),
    });
    expect(prefersReducedMotion()).toBe(true);
  });

  it("returns false when matchMedia reports no-preference", () => {
    vi.stubGlobal("window", {
      matchMedia: () => ({ matches: false }),
    });
    expect(prefersReducedMotion()).toBe(false);
  });
});
```

- [ ] **Step 2.1.2: 테스트 실행 (RED)**

```bash
pnpm vitest run tests/lib/motion.test.ts
```

Expected: 3 failed — `Failed to resolve import "@/lib/motion"`.

- [ ] **Step 2.1.3: 최소 구현 (GREEN)**

`src/lib/motion.ts`:

```typescript
/**
 * `prefers-reduced-motion: reduce` 미디어 쿼리 검사.
 * 서버에서는 항상 false (window 없음).
 */
export function prefersReducedMotion(): boolean {
  if (typeof window === "undefined") return false;
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}
```

- [ ] **Step 2.1.4: 테스트 PASS 확인**

```bash
pnpm vitest run tests/lib/motion.test.ts
```

Expected: 3 passed.

- [ ] **Step 2.1.5: 커밋**

```bash
git add src/lib/motion.ts tests/lib/motion.test.ts
git commit -m "feat(phase-3-5): prefersReducedMotion utility + tests"
```

---

### Task 2.2: celebrate.ts (confetti 발동)

**Files:**
- Create: `src/lib/celebrate.ts`

> TDD 제외 — canvas-confetti는 document를 직접 조작하므로 단위 테스트 어려움. 수동 검증으로 충분 (Chunk 6).

- [ ] **Step 2.2.1: celebrate.ts 작성**

`src/lib/celebrate.ts`:

```typescript
"use client";

import { prefersReducedMotion } from "@/lib/motion";

/**
 * 운동 종료 시 발동하는 confetti 폭죽.
 * - reduced-motion 사용자에게는 발동 안 함
 * - canvas-confetti는 document를 만지므로 dynamic import (서버 번들에 포함 X)
 * - 1회 발동 — 운동 1개 완료에는 호출하지 말 것 (과함)
 */
export async function celebrate(): Promise<void> {
  if (prefersReducedMotion()) return;
  if (typeof window === "undefined") return;

  const { default: confetti } = await import("canvas-confetti");
  confetti({
    particleCount: 120,
    spread: 70,
    origin: { y: 0.7 },
    colors: ["#E8763D", "#FFEDD9", "#FFFFFF", "#B8704A"],
  });
}
```

- [ ] **Step 2.2.2: TypeCheck**

```bash
pnpm tsc --noEmit
```

Expected: 0 errors (canvas-confetti 타입 OK).

- [ ] **Step 2.2.3: 커밋**

```bash
git add src/lib/celebrate.ts
git commit -m "feat(phase-3-5): celebrate() helper — dynamic-imported confetti, reduced-motion aware"
```

---

## Chunk 3: New UI Components

**목표:** ProgressRing / DayChip / BodyPartChip / SetRow 컴포넌트. spec Section 4.4~4.7 + 5.1~5.3에 명세된 UI 프리미티브.

### Task 3.1: ProgressRing

**Files:**
- Create: `src/components/ui/progress-ring.tsx`
- Create: `tests/components/progress-ring.test.tsx`

- [ ] **Step 3.1.1: 테스트 작성 (RED) — stroke-dashoffset 계산만 검증**

`tests/components/progress-ring.test.tsx`:

```typescript
import { describe, it, expect } from "vitest";
import { computeDashOffset } from "@/components/ui/progress-ring";

describe("computeDashOffset", () => {
  it("0 progress → full offset (no fill)", () => {
    // circumference = 2 * PI * 26 ≈ 163.36
    expect(computeDashOffset(0, 100, 26)).toBeCloseTo(163.36, 1);
  });

  it("50% progress → half offset", () => {
    expect(computeDashOffset(50, 100, 26)).toBeCloseTo(81.68, 1);
  });

  it("100% progress → 0 offset (fully filled)", () => {
    expect(computeDashOffset(100, 100, 26)).toBeCloseTo(0, 1);
  });

  it("clamps progress above max to 0", () => {
    expect(computeDashOffset(150, 100, 26)).toBeCloseTo(0, 1);
  });

  it("clamps negative progress to full offset", () => {
    expect(computeDashOffset(-10, 100, 26)).toBeCloseTo(163.36, 1);
  });
});
```

- [ ] **Step 3.1.2: 테스트 실행 (RED)**

```bash
pnpm vitest run tests/components/progress-ring.test.tsx
```

Expected: 5 failed (모듈 없음).

- [ ] **Step 3.1.3: 컴포넌트 구현 (GREEN)**

`src/components/ui/progress-ring.tsx`:

```typescript
/**
 * 진행 링 (Apple Health 스타일).
 * size: 외곽 픽셀, strokeWidth: 라인 굵기, radius: 자동 계산
 */

export function computeDashOffset(value: number, max: number, radius: number): number {
  const clamped = Math.max(0, Math.min(value, max));
  const circumference = 2 * Math.PI * radius;
  return circumference * (1 - clamped / max);
}

type Props = {
  /** 0~max 사이 값 */
  value: number;
  max?: number;
  /** 외곽 픽셀 (기본 64) */
  size?: number;
  /** 라인 굵기 (기본 8) */
  strokeWidth?: number;
  /** 추가 클래스 (예: 색상 오버라이드) */
  className?: string;
};

export function ProgressRing({
  value,
  max = 100,
  size = 64,
  strokeWidth = 8,
  className,
}: Props) {
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = computeDashOffset(value, max, radius);

  return (
    <svg
      width={size}
      height={size}
      viewBox={`0 0 ${size} ${size}`}
      className={className}
      role="img"
      aria-label={`${value} of ${max}`}
    >
      <circle
        cx={size / 2}
        cy={size / 2}
        r={radius}
        fill="none"
        stroke="var(--accent-soft)"
        strokeWidth={strokeWidth}
      />
      <circle
        cx={size / 2}
        cy={size / 2}
        r={radius}
        fill="none"
        stroke="var(--accent)"
        strokeWidth={strokeWidth}
        strokeDasharray={circumference}
        strokeDashoffset={offset}
        strokeLinecap="round"
        transform={`rotate(-90 ${size / 2} ${size / 2})`}
      />
    </svg>
  );
}
```

- [ ] **Step 3.1.4: 테스트 PASS**

```bash
pnpm vitest run tests/components/progress-ring.test.tsx
```

Expected: 5 passed.

- [ ] **Step 3.1.5: TypeCheck**

```bash
pnpm tsc --noEmit
```

Expected: 0 errors.

- [ ] **Step 3.1.6: 커밋**

```bash
git add src/components/ui/progress-ring.tsx tests/components/progress-ring.test.tsx
git commit -m "feat(phase-3-5): ProgressRing SVG component + dashoffset unit tests"
```

---

### Task 3.2: DayChip (요일 칸)

**Files:**
- Create: `src/components/ui/day-chip.tsx`

> 순수 시각 컴포넌트 — TDD 제외. 시각은 Chunk 6에서 검증.

- [ ] **Step 3.2.1: 컴포넌트 작성**

`src/components/ui/day-chip.tsx`:

```typescript
import { cn } from "@/lib/utils";

type DayState = "done" | "missed" | "today";

type Props = {
  /** 요일 텍스트 (월/화/...) */
  day: string;
  state: DayState;
  className?: string;
};

export function DayChip({ day, state, className }: Props) {
  return (
    <div
      className={cn(
        "flex-1 aspect-square rounded-sm flex items-center justify-center text-tiny font-bold",
        state === "done" && "bg-accent text-text",
        state === "missed" && "bg-surface text-text-ghost font-semibold",
        state === "today" &&
          "bg-accent-soft text-text border-2 border-dashed border-accent",
        className,
      )}
    >
      {day}
    </div>
  );
}
```

> 주: `cn` 헬퍼는 이미 `src/lib/utils.ts`에 존재 (shadcn 기본). `text-tiny`는 새 토큰 — 다음 step에서 추가.

- [ ] **Step 3.2.2: text-tiny 토큰 추가**

`src/app/globals.css`의 `@theme inline` 블록에 추가:

```css
  --text-tiny: 10px;
  --text-label: 11px;
  --text-caption: 12px;
  --text-body: 14px;
  --text-h3: 16px;
  --text-h2: 24px;
  --text-stat-l: 28px;
  --text-display: 36px;
```

> Tailwind v4는 `--text-*` 토큰을 자동으로 `text-tiny`, `text-display` 등 **font-size** 클래스로 노출.
>
> **주의 (typography 토큰 한계):** Tailwind v4 CSS `@theme`는 `--text-*` 토큰에서 size만 적용. spec Section 3.4의 weight/line-height/letter-spacing은 별도 utility 클래스 조합으로 처리:
> - `text-display` + `font-extrabold` + `tracking-tight` + `leading-none`
> - `text-h2` + `font-extrabold` + `tracking-tight`
> - `text-body` + `font-medium` + `leading-relaxed`
> - etc.
>
> 이미 Dashboard.tsx / SessionRunner.tsx 등에 이 조합 사용 중. 새 컴포넌트 작성 시 spec 표 참조해서 weight도 같이 적용.

- [ ] **Step 3.2.3: TypeCheck**

```bash
pnpm tsc --noEmit && pnpm lint
```

Expected: 0 errors.

- [ ] **Step 3.2.4: 커밋**

```bash
git add src/components/ui/day-chip.tsx src/app/globals.css
git commit -m "feat(phase-3-5): DayChip component + text size tokens"
```

---

### Task 3.3: BodyPartChip

**Files:**
- Create: `src/components/ui/body-part-chip.tsx`

- [ ] **Step 3.3.1: 컴포넌트 작성**

`src/components/ui/body-part-chip.tsx`:

```typescript
"use client";

import { cn } from "@/lib/utils";

type Props = {
  label: string;
  selected: boolean;
  onClick: () => void;
};

/**
 * 부위 선택 칩 (가슴, 등, 어깨...).
 * 선택: 진한 배경 (bg-text) + 표면 텍스트.
 * 미선택: 표면 배경 + 부드러운 보더.
 */
export function BodyPartChip({ label, selected, onClick }: Props) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "px-3 py-2 rounded-full text-body font-medium transition-colors",
        selected
          ? "bg-text text-surface"
          : "bg-surface border border-accent-soft text-text hover:bg-accent-soft",
      )}
    >
      {label}
    </button>
  );
}
```

- [ ] **Step 3.3.2: TypeCheck**

```bash
pnpm tsc --noEmit && pnpm lint
```

Expected: 0 errors.

- [ ] **Step 3.3.3: 커밋**

```bash
git add src/components/ui/body-part-chip.tsx
git commit -m "feat(phase-3-5): BodyPartChip with selected/unselected states"
```

---

### Task 3.4: SetRow (운동 진행 화면 세트 input row)

**Files:**
- Create: `src/components/ui/set-row.tsx`

- [ ] **Step 3.4.1: 컴포넌트 작성**

`src/components/ui/set-row.tsx`:

```typescript
"use client";

import { cn } from "@/lib/utils";

export type SetRowStatus = "done" | "active" | "upcoming";

type Props = {
  setNumber: number;
  status: SetRowStatus;
  /** done이면 표시할 값, active이면 input value, upcoming이면 무시 */
  weight: string;
  reps: string;
  onWeightChange?: (v: string) => void;
  onRepsChange?: (v: string) => void;
  onCheck?: () => void;
  checkDisabled?: boolean;
};

/**
 * 세트 1줄 — 3가지 상태:
 * - done: 완료된 세트 (✓ 채워진 원 + 값 표시)
 * - active: 입력 중 (number input 활성)
 * - upcoming: 아직 안 함 (회색 placeholder)
 */
export function SetRow({
  setNumber,
  status,
  weight,
  reps,
  onWeightChange,
  onRepsChange,
  onCheck,
  checkDisabled,
}: Props) {
  if (status === "done") {
    return (
      <div className="flex items-center gap-2 mt-2 p-2 bg-accent-soft rounded-md">
        <div className="w-6 h-6 bg-accent text-text rounded-full flex items-center justify-center text-caption font-bold">
          ✓
        </div>
        <div className="flex-1 text-body text-text">
          <strong>{setNumber}세트</strong>
        </div>
        <div className="text-body text-text font-bold">
          {weight}kg × {reps}
        </div>
      </div>
    );
  }

  if (status === "upcoming") {
    return (
      <div className="flex items-center gap-2 mt-2 opacity-50">
        <div className="w-6 h-6 bg-surface border-2 border-accent-soft text-text-muted rounded-full flex items-center justify-center text-caption">
          {setNumber}
        </div>
        <div className="flex-1 text-body text-text-muted">
          — kg × —
        </div>
      </div>
    );
  }

  // active
  return (
    <div className="flex items-center gap-2 mt-2">
      <div className="w-6 h-6 bg-surface border-2 border-accent-soft text-text-muted rounded-full flex items-center justify-center text-caption font-semibold">
        {setNumber}
      </div>
      <input
        inputMode="decimal"
        type="number"
        step="0.5"
        placeholder="kg"
        className="flex-1 p-2 bg-surface border border-accent-soft rounded-md text-body font-bold focus:border-accent focus:outline-none"
        value={weight}
        onChange={(e) => onWeightChange?.(e.target.value)}
      />
      <span className="text-caption text-text-muted">×</span>
      <input
        inputMode="numeric"
        type="number"
        placeholder="회"
        className="w-14 p-2 bg-surface border border-accent-soft rounded-md text-body font-bold focus:border-accent focus:outline-none"
        value={reps}
        onChange={(e) => onRepsChange?.(e.target.value)}
      />
      <button
        type="button"
        disabled={checkDisabled}
        onClick={onCheck}
        className={cn(
          "w-8 h-8 rounded-md flex items-center justify-center font-bold text-body",
          checkDisabled
            ? "bg-surface border border-accent-soft text-text-ghost"
            : "bg-accent text-text",
        )}
      >
        ✓
      </button>
    </div>
  );
}
```

- [ ] **Step 3.4.2: TypeCheck**

```bash
pnpm tsc --noEmit && pnpm lint
```

Expected: 0 errors.

- [ ] **Step 3.4.3: 커밋**

```bash
git add src/components/ui/set-row.tsx
git commit -m "feat(phase-3-5): SetRow component with done/active/upcoming states"
```

---

## Chunk 4: 대시보드용 새 RSC 쿼리

**목표:** spec Section 5.1에 정의된 3개 새 쿼리. RLS는 기존 정책 그대로 활용.

### Task 4.1: fetchTodaySession + fetchWeeklySessionDates

**Files:**
- Modify: `src/lib/queries/sessions.ts`

- [ ] **Step 4.1.1: `fetchTodaySession` 추가**

`src/lib/queries/sessions.ts` 끝에 추가:

```typescript
export type TodaySession = WorkoutSession & {
  /** 오늘 한 운동 부위 (예: ["가슴", "어깨"]) — 중복 제거 */
  bodyParts: string[];
  /** 오늘 한 운동 수 */
  exerciseCount: number;
  /** 오늘 완료한 메인 세트 수 */
  mainSetCount: number;
};

/**
 * 오늘 (KST 기준 자정~자정) 시작된 사용자의 세션을 가져옴.
 * 없으면 null. 있으면 부위/운동수/세트수 요약 동봉.
 */
export async function fetchTodaySession(
  userId: string,
): Promise<TodaySession | null> {
  const supabase = await createClient();

  const now = new Date();
  const todayStart = new Date(
    now.getFullYear(),
    now.getMonth(),
    now.getDate(),
  ).toISOString();
  const tomorrowStart = new Date(
    now.getFullYear(),
    now.getMonth(),
    now.getDate() + 1,
  ).toISOString();

  const { data: session, error: sessErr } = await supabase
    .from("workout_sessions")
    .select(
      "*, workout_sets(exercise_id, parent_set_id, exercises(exercise_body_parts(body_parts(name_ko))))",
    )
    .eq("user_id", userId)
    .gte("started_at", todayStart)
    .lt("started_at", tomorrowStart)
    .order("started_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (sessErr) throw sessErr;
  if (!session) return null;

  // 부위 추출 (primary만 — 가독성)
  const bodyPartSet = new Set<string>();
  const exerciseIds = new Set<string>();
  let mainSetCount = 0;

  type SetRow = {
    exercise_id: string;
    parent_set_id: string | null;
    exercises: {
      exercise_body_parts: { body_parts: { name_ko: string } | null }[];
    } | null;
  };

  for (const s of (session.workout_sets ?? []) as SetRow[]) {
    if (s.parent_set_id === null) mainSetCount += 1;
    exerciseIds.add(s.exercise_id);
    for (const m of s.exercises?.exercise_body_parts ?? []) {
      if (m.body_parts?.name_ko) bodyPartSet.add(m.body_parts.name_ko);
    }
  }

  return {
    ...session,
    bodyParts: [...bodyPartSet],
    exerciseCount: exerciseIds.size,
    mainSetCount,
  };
}

/**
 * 이번 주 (월 시작) 사용자가 운동한 요일 Set.
 * 0=월, 1=화, ..., 6=일.
 */
export async function fetchWeeklySessionDates(
  userId: string,
): Promise<Set<number>> {
  const supabase = await createClient();

  const now = new Date();
  // 월요일 시작 (한국 기본). JS getDay(): 0=일 6=토 → 월=1
  const dayOfWeek = (now.getDay() + 6) % 7; // 월=0
  const monday = new Date(now);
  monday.setDate(now.getDate() - dayOfWeek);
  monday.setHours(0, 0, 0, 0);
  const nextMonday = new Date(monday);
  nextMonday.setDate(monday.getDate() + 7);

  const { data, error } = await supabase
    .from("workout_sessions")
    .select("started_at")
    .eq("user_id", userId)
    .gte("started_at", monday.toISOString())
    .lt("started_at", nextMonday.toISOString());

  if (error) throw error;

  const set = new Set<number>();
  for (const row of data ?? []) {
    const d = new Date(row.started_at);
    set.add((d.getDay() + 6) % 7);
  }
  return set;
}
```

- [ ] **Step 4.1.2: TypeCheck**

```bash
pnpm tsc --noEmit
```

Expected: 0 errors. (PostgREST select 문자열은 unsafe하지만 컴파일은 통과.)

- [ ] **Step 4.1.3: 커밋**

```bash
git add src/lib/queries/sessions.ts
git commit -m "feat(phase-3-5): fetchTodaySession + fetchWeeklySessionDates RSC helpers"
```

---

### Task 4.2: fetchRecentExerciseHistory

**Files:**
- Modify: `src/lib/queries/sets.ts`

- [ ] **Step 4.2.1: 함수 추가**

`src/lib/queries/sets.ts` 끝에 추가:

```typescript
export type RecentExercise = {
  exerciseId: string;
  exerciseName: string;
  lastWeightKg: number | null;
  lastReps: number | null;
  lastDoneAt: string;
};

/**
 * 사용자가 최근에 한 N개 운동의 가장 최근 메인 세트.
 * 운동별로 1개씩 (중복 운동은 가장 최근 1개만).
 */
export async function fetchRecentExerciseHistory(
  userId: string,
  limit: number,
): Promise<RecentExercise[]> {
  const supabase = await createClient();

  // 최근 100개 메인 세트 (over-fetch 후 클라 dedupe)
  const { data, error } = await supabase
    .from("workout_sets")
    .select(
      "exercise_id, weight_kg, reps, created_at, exercises!inner(name, user_id)",
    )
    .eq("exercises.user_id", userId)
    .is("parent_set_id", null)
    .order("created_at", { ascending: false })
    .limit(100);

  if (error) throw error;

  const seen = new Set<string>();
  const out: RecentExercise[] = [];

  type Row = {
    exercise_id: string;
    weight_kg: number | null;
    reps: number | null;
    created_at: string | null;
    exercises: { name: string; user_id: string } | null;
  };

  for (const r of (data ?? []) as Row[]) {
    if (seen.has(r.exercise_id)) continue;
    if (!r.exercises) continue;
    seen.add(r.exercise_id);
    out.push({
      exerciseId: r.exercise_id,
      exerciseName: r.exercises.name,
      lastWeightKg: r.weight_kg,
      lastReps: r.reps,
      lastDoneAt: r.created_at ?? new Date(0).toISOString(),
    });
    if (out.length >= limit) break;
  }

  return out;
}
```

- [ ] **Step 4.2.2: TypeCheck**

```bash
pnpm tsc --noEmit
```

Expected: 0 errors.

- [ ] **Step 4.2.3: 커밋**

```bash
git add src/lib/queries/sets.ts
git commit -m "feat(phase-3-5): fetchRecentExerciseHistory RSC helper"
```

---

### Task 4.3: fetchLastMainSetsByExercise (prefill용)

**Files:**
- Modify: `src/lib/queries/sets.ts`

세션 시작 시 운동별 "지난번 기록"을 한 번에 가져와서 SessionRunner의 input default 값으로 활용.

- [ ] **Step 4.3.1: 함수 추가**

`src/lib/queries/sets.ts` 끝에 추가:

```typescript
export type LastMainSet = {
  weightKg: number | null;
  reps: number | null;
};

/**
 * 주어진 exerciseIds 각각에 대해 가장 최근 메인 세트(parent_set_id IS NULL)를 가져옴.
 * 결과는 exerciseId → { weightKg, reps } 매핑. 기록 없으면 매핑에 키 자체 없음.
 *
 * 사용처: 운동 진행 화면 진입 시 SetRow의 input default 값.
 */
export async function fetchLastMainSetsByExercise(
  userId: string,
  exerciseIds: string[],
): Promise<Record<string, LastMainSet>> {
  if (exerciseIds.length === 0) return {};
  const supabase = await createClient();

  // 한 번의 query로 over-fetch 후 클라에서 운동별 dedupe (최신 1개만)
  // 운동별로 GROUP BY + MAX(created_at) 같은 SQL은 PostgREST에서 표현 복잡 — over-fetch가 단순
  const { data, error } = await supabase
    .from("workout_sets")
    .select(
      "exercise_id, weight_kg, reps, created_at, workout_sessions!inner(user_id)",
    )
    .eq("workout_sessions.user_id", userId)
    .in("exercise_id", exerciseIds)
    .is("parent_set_id", null)
    .order("created_at", { ascending: false })
    .limit(200); // 운동 10개 × 평균 20개 history = 안전 마진

  if (error) throw error;

  type Row = {
    exercise_id: string;
    weight_kg: number | null;
    reps: number | null;
    created_at: string | null;
  };

  const out: Record<string, LastMainSet> = {};
  for (const r of (data ?? []) as Row[]) {
    if (out[r.exercise_id]) continue; // 이미 더 최신 (order DESC)
    out[r.exercise_id] = { weightKg: r.weight_kg, reps: r.reps };
  }
  return out;
}
```

- [ ] **Step 4.3.2: TypeCheck**

```bash
pnpm tsc --noEmit
```

Expected: 0 errors.

- [ ] **Step 4.3.3: 커밋**

```bash
git add src/lib/queries/sets.ts
git commit -m "feat(phase-3-5): fetchLastMainSetsByExercise — prefill values for session runner"
```

---

## Chunk 5: Screen Redesigns

**목표:** 토큰/컴포넌트/쿼리가 다 준비됐으니 실제 화면에 적용.

### Task 5.1: /login 페이지 톤

**Files:**
- Modify: `src/app/login/page.tsx`

- [ ] **Step 5.1.1: 현재 파일 구조 확인**

현재 `src/app/login/page.tsx`는 Server Component + Card 래퍼 + `<form action={signInWithGoogle}>` + `searchParams.error` 표시. 이 구조를 보존하면서 톤만 적용.

- [ ] **Step 5.1.2: 전체 파일 교체**

`src/app/login/page.tsx` 전체를 다음으로 교체:

```typescript
// Server Component — `<form action={...}>`로 Server Action 직접 호출, 'use client' 불필요
import { Button } from "@/components/ui/button";
import { signInWithGoogle } from "./actions";

type SearchParams = Promise<{ error?: string }>;

export default async function LoginPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const { error } = await searchParams;

  return (
    <main className="p-8 max-w-md mx-auto flex flex-col items-center justify-center min-h-[80dvh]">
      <h1 className="text-display font-extrabold text-text">오운완</h1>
      <p className="text-body text-text-muted mt-2">오늘도 운동 잘 했어요</p>

      <form action={signInWithGoogle} className="w-full mt-8">
        <Button type="submit" size="lg" className="w-full">
          Google로 시작하기
        </Button>
      </form>

      {error && (
        <p className="text-caption text-danger mt-3">로그인 실패: {error}</p>
      )}
    </main>
  );
}
```

**제거:** `Card`, `CardContent`, `CardDescription`, `CardHeader`, `CardTitle` import (Card 래퍼 없이 메인 페이지 자체가 컨테이너).

**유지:** `signInWithGoogle` Server Action import + form action, `searchParams.error` 에러 표시 (코랄 톤 적용).

- [ ] **Step 5.1.3: dev에서 시각 확인**

```bash
pnpm dev
```

브라우저: `/login` — 크림 그라데이션 배경 + Pretendard + "오운완" 큰 타이틀. 버튼 색 코랄.

→ Ctrl+C.

- [ ] **Step 5.1.4: TypeCheck + lint + 커밋**

```bash
pnpm tsc --noEmit && pnpm lint
git add src/app/login/page.tsx
git commit -m "feat(phase-3-5): login page tone — Pretendard display + warm copy"
```

---

### Task 5.2: /dashboard 리뉴얼

**Files:**
- Modify: `src/app/dashboard/page.tsx`
- Create: `src/app/dashboard/Dashboard.tsx` ('use client', 테마 토글 등 인터랙션)
- Create: `src/components/ui/theme-toggle.tsx`

- [ ] **Step 5.2.1: ThemeToggle 컴포넌트**

`src/components/ui/theme-toggle.tsx`:

```typescript
"use client";

import { Monitor, Moon, Sun } from "lucide-react";
import { useTheme } from "next-themes";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";

/**
 * Light/Dark/System 순환 토글.
 * Hydration 안전 — mounted 가드.
 */
export function ThemeToggle() {
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    return <Button size="icon" variant="ghost" disabled aria-label="테마 전환" />;
  }

  const next = theme === "light" ? "dark" : theme === "dark" ? "system" : "light";
  const Icon = theme === "light" ? Sun : theme === "dark" ? Moon : Monitor;

  return (
    <Button
      size="icon"
      variant="ghost"
      aria-label={`현재 ${theme} 테마, 클릭해서 ${next}로 변경`}
      onClick={() => setTheme(next)}
    >
      <Icon className="w-5 h-5" />
    </Button>
  );
}
```

- [ ] **Step 5.2.2: Dashboard 클라이언트 컴포넌트**

`src/app/dashboard/Dashboard.tsx`:

```typescript
"use client";

import Link from "next/link";
import { BarChart3, LogOut } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ProgressRing } from "@/components/ui/progress-ring";
import { DayChip } from "@/components/ui/day-chip";
import { ThemeToggle } from "@/components/ui/theme-toggle";
import { signOut } from "@/app/dashboard/actions";
import type { TodaySession } from "@/lib/queries/sessions";
import type { RecentExercise } from "@/lib/queries/sets";

const DAY_LABELS = ["월", "화", "수", "목", "금", "토", "일"] as const;
const DEFAULT_EXERCISE_GOAL = 8;

type Props = {
  userEmail: string;
  todaySession: TodaySession | null;
  /** 0=월 ... 6=일. Set이 아닌 number[] — RSC→Client 직렬화 제약 (Set 미지원) */
  weeklyDates: number[];
  recentExercises: RecentExercise[];
  /** 0=월 ... 6=일 */
  todayDayIndex: number;
};

function formatDate(d: Date) {
  return `${d.getMonth() + 1}월 ${d.getDate()}일`;
}

export function Dashboard({
  todaySession,
  weeklyDates,
  recentExercises,
  todayDayIndex,
}: Props) {
  const today = new Date();
  const completed = todaySession !== null;
  const subline = completed
    ? `오늘 ${todaySession.bodyParts.join(", ")} 잘 끝냈어요`
    : "아직 운동 전이에요";

  return (
    <main className="p-5 max-w-md mx-auto pb-32">
      <div className="flex items-start justify-between">
        <div>
          <div className="text-label text-accent-strong uppercase">
            {DAY_LABELS[todayDayIndex]} · {formatDate(today)}
          </div>
          <h1 className="text-display font-extrabold mt-1 text-text">
            {completed ? "오운완 ✓" : "오운완"}
          </h1>
          <p className="text-body text-text-muted mt-1">{subline}</p>
        </div>
        <div className="flex items-center gap-1">
          <ThemeToggle />
          <form action={signOut}>
            <Button
              type="submit"
              size="icon"
              variant="ghost"
              aria-label="로그아웃"
            >
              <LogOut className="w-5 h-5" />
            </Button>
          </form>
        </div>
      </div>

      {/* 진행 카드 */}
      <Card className="mt-5 p-4 flex items-center gap-4">
        <ProgressRing
          value={todaySession?.exerciseCount ?? 0}
          max={DEFAULT_EXERCISE_GOAL}
        />
        <div>
          <div className="text-stat-l font-extrabold leading-none">
            {todaySession?.exerciseCount ?? 0}
            <span className="text-body font-medium text-text-muted">
              {" "}
              / {DEFAULT_EXERCISE_GOAL}
            </span>
          </div>
          <div className="text-caption text-text-muted mt-1">
            운동 · {todaySession?.mainSetCount ?? 0}세트 완료
          </div>
        </div>
      </Card>

      {/* 이번 주 */}
      <section className="mt-5">
        <div className="flex justify-between items-center">
          <div className="text-h3 font-extrabold">이번 주</div>
        </div>
        <div className="flex gap-1.5 mt-2.5">
          {DAY_LABELS.map((label, i) => {
            const state: "done" | "missed" | "today" =
              weeklyDates.includes(i)
                ? "done"
                : i === todayDayIndex
                  ? "today"
                  : "missed";
            return <DayChip key={label} day={label} state={state} />;
          })}
        </div>
      </section>

      {/* 최근 운동 */}
      {recentExercises.length > 0 && (
        <Card className="mt-4 p-3.5">
          <div className="text-caption text-text-muted font-semibold">
            최근 운동
          </div>
          {recentExercises.map((ex) => (
            <div
              key={ex.exerciseId}
              className="flex justify-between items-center mt-2"
            >
              <div className="text-body font-bold">{ex.exerciseName}</div>
              <div className="text-caption text-text font-semibold">
                {ex.lastWeightKg ?? "-"}kg × {ex.lastReps ?? "-"}
              </div>
            </div>
          ))}
        </Card>
      )}

      {/* CTA */}
      <div className="fixed bottom-5 left-5 right-5 max-w-md mx-auto flex gap-2">
        <Link href="/workout/new" className="flex-1">
          <Button size="lg" className="w-full">
            + 운동 시작
          </Button>
        </Link>
        <Button size="lg" variant="outline" aria-label="기록 보기">
          <BarChart3 className="w-5 h-5" />
        </Button>
      </div>
    </main>
  );
}
```

- [ ] **Step 5.2.3: page.tsx 리뉴얼 (RSC, 4 쿼리 병렬)**

`src/app/dashboard/page.tsx` 전체 교체:

```typescript
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { fetchTodaySession, fetchWeeklySessionDates } from "@/lib/queries/sessions";
import { fetchRecentExerciseHistory } from "@/lib/queries/sets";
import { Dashboard } from "./Dashboard";

export default async function DashboardPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const [todaySession, weeklyDates, recentExercises] = await Promise.all([
    fetchTodaySession(user.id),
    fetchWeeklySessionDates(user.id),
    fetchRecentExerciseHistory(user.id, 2),
  ]);

  const now = new Date();
  const todayDayIndex = (now.getDay() + 6) % 7; // 월=0

  return (
    <Dashboard
      userEmail={user.email ?? ""}
      todaySession={todaySession}
      weeklyDates={Array.from(weeklyDates)}
      recentExercises={recentExercises}
      todayDayIndex={todayDayIndex}
    />
  );
}
```

> **주:** `weeklyDates`는 RSC에서 `Set<number>` 반환 → page.tsx에서 `Array.from()` 변환 후 Client에 전달. React 19 RSC 직렬화에서 `Set`은 미지원 (`Map`은 지원). Dashboard 컴포넌트는 `number[]` 받음 (.includes로 검색).

> **로그아웃 UI:** 기존 dashboard 로그아웃 폼은 제거 — 대신 ThemeToggle 옆에 작은 logout 아이콘 추가 (Task 5.2.2 참조). `dashboard/actions.ts:signOut`은 그대로 유지하고 새 위치에서 호출.

- [ ] **Step 5.2.4: dev에서 시각 확인 (light + dark)**

```bash
pnpm dev
```

브라우저:
1. `/dashboard` 진입 — 크림 배경 + 진행 링 + 요일 칩 7개 + 최근 운동 + 하단 CTA
2. 우상단 테마 토글 클릭 — 다크 모드로 전환 (따뜻한 갈색)
3. 한 번 더 → System으로 (OS 따라감)

→ Ctrl+C.

- [ ] **Step 5.2.5: TypeCheck + lint + 커밋**

```bash
pnpm tsc --noEmit && pnpm lint
git add src/components/ui/theme-toggle.tsx src/app/dashboard/Dashboard.tsx src/app/dashboard/page.tsx
git commit -m "feat(phase-3-5): /dashboard redesign — progress ring, weekly chips, recent exercises, theme toggle"
```

---

### Task 5.3: /workout/new — StartForm에 BodyPartChip 적용

**Files:**
- Modify: `src/app/workout/new/StartForm.tsx`
- Modify: `src/app/workout/new/page.tsx` (제목 톤만)

> 페이지 데이터 로직(추천 알고리즘 등)은 Plan 3.1 그대로. **시각만 변경.**

- [ ] **Step 5.3.1: page.tsx 헤더 톤**

`src/app/workout/new/page.tsx`의 main 내부 구조를 다음과 일치시킴:

```typescript
return (
  <main className="p-5 max-w-md mx-auto">
    <div className="text-label text-accent-strong uppercase">새 운동</div>
    <h1 className="text-display font-extrabold mt-1 text-text">
      오늘 뭐 할까요?
    </h1>
    <StartForm
      userId={user.id}
      bodyParts={bodyParts}
      exercises={exercises}
      templates={templates}
      recentSets={recentSets}
    />
  </main>
);
```

- [ ] **Step 5.3.2: StartForm.tsx — 부위 chip을 BodyPartChip으로 교체**

`src/app/workout/new/StartForm.tsx`에서 기존 buttom 토글 JSX(부위 토글)를 다음으로 교체:

```typescript
import { BodyPartChip } from "@/components/ui/body-part-chip";

// 부위 섹션:
<section className="mt-6">
  <h2 className="text-caption font-semibold text-text-muted mb-2">
    부위 선택
  </h2>
  <div className="flex flex-wrap gap-2">
    {bodyParts.map((bp) => (
      <BodyPartChip
        key={bp.id}
        label={bp.name_ko}
        selected={selectedBP.has(bp.id)}
        onClick={() => toggleBP(bp.id)}
      />
    ))}
  </div>
</section>
```

- [ ] **Step 5.3.3: 추천 카드 톤 정리**

추천 운동 리스트 카드 구조를 새 토큰 클래스로:

```typescript
<ul className="space-y-2 mt-3">
  {recommendations.map((r) => {
    const ex = exerciseById.get(r.exerciseId);
    if (!ex) return null;
    return (
      <li
        key={r.exerciseId}
        className="rounded-md border border-accent-soft bg-surface p-3 text-body"
      >
        <div className="font-bold text-text">{ex.name}</div>
        <div className="text-caption text-text-muted mt-0.5">
          기본 {ex.default_sets ?? 3}세트
          {ex.default_reps_min && ex.default_reps_max
            ? ` · ${ex.default_reps_min}~${ex.default_reps_max}회`
            : ""}
        </div>
      </li>
    );
  })}
</ul>
```

- [ ] **Step 5.3.4: 템플릿 chip은 shadcn Badge 그대로**

(이미 alias 매핑으로 자동 코랄 톤 적용됨 — 손댈 필요 X.)

- [ ] **Step 5.3.5: dev 시각 확인**

```bash
pnpm dev
```

`/workout/new` 진입 — "오늘 뭐 할까요?" 제목 + 코랄 톤 chip + 추천 카드.

→ Ctrl+C.

- [ ] **Step 5.3.6: TypeCheck + lint + 커밋**

```bash
pnpm tsc --noEmit && pnpm lint
git add src/app/workout/new/StartForm.tsx src/app/workout/new/page.tsx
git commit -m "feat(phase-3-5): /workout/new — BodyPartChip + warmer copy + card tone"
```

---

### Task 5.4: /workout/[sessionId] — SessionRunner activeExerciseId + SetRow + celebrate + prefill + delete

**Files:**
- Modify: `src/app/workout/[sessionId]/SessionRunner.tsx`
- Modify: `src/app/workout/[sessionId]/page.tsx` (prefill 쿼리 호출 + prop 전달)
- Modify: `src/app/workout/actions.ts` (deleteSessionExercise Server Action)

가장 큰 변경. spec Section 5.3 + 6.4 적용 + 신규 기능 2개:
- `activeExerciseId` 계산 (`useMemo`)
- `<SetRow>` 컴포넌트로 세트 input 교체
- 운동 카드: 활성이면 `border-2 border-accent`, 비활성이면 `opacity-65`
- 운동 종료 시 `celebrate()` 호출
- **NEW: 운동 카드 우상단 ✕ 버튼 — 세트 저장 시 확인 다이얼로그 + DB cascade delete**
- **NEW: SetRow input default를 prefill 값(지난번 기록)으로 채움**

- [ ] **Step 5.4.1: import 추가**

기존 import에 다음 추가:

```typescript
import { SetRow } from "@/components/ui/set-row";
import { celebrate } from "@/lib/celebrate";
```

- [ ] **Step 5.4.2: activeExerciseId 계산**

컴포넌트 본문에 `useMemo` 추가 (기존 `drafts` state 정의 아래):

```typescript
const activeExerciseId = useMemo(() => {
  for (const ex of exercises) {
    const targetSets = ex.default_sets ?? 3;
    const savedMainSets = savedSets.filter(
      (s) => s.exercise_id === ex.id && s.parent_set_id === null,
    ).length;
    if (savedMainSets < targetSets) return ex.id;
  }
  return null;
}, [exercises, savedSets]);
```

- [ ] **Step 5.4.3: 운동 카드 상태별 클래스 적용**

기존 운동 카드 JSX에서 `<Card>` 사용 부분을 다음으로 변경 (각 운동 ex):

```typescript
<Card
  key={ex.id}
  className={cn(
    "mt-3 p-4",
    ex.id === activeExerciseId && "border-2 border-accent",
    ex.id !== activeExerciseId && activeExerciseId !== null && "opacity-65",
  )}
>
```

> `cn` import 필요. `import { cn } from "@/lib/utils";`

- [ ] **Step 5.4.4: 세트 input 부분을 SetRow로 교체**

기존 세트 input (drafts.map(...)) 부분 전체를 다음으로 교체:

```typescript
{drafts[ex.id].map((draft, idx) => {
  const saved = isSaved(ex.id, draft.setNumber);
  const isActive = ex.id === activeExerciseId && !saved;
  const status = saved ? "done" : isActive ? "active" : "upcoming";
  const isPending = pendingKeys.has(setKey(ex.id, draft.setNumber));

  return (
    <SetRow
      key={idx}
      setNumber={draft.setNumber}
      status={status}
      weight={draft.weightKg}
      reps={draft.reps}
      onWeightChange={(v) =>
        setDrafts((prev) => {
          const copy = { ...prev };
          copy[ex.id] = [...copy[ex.id]];
          copy[ex.id][idx] = { ...draft, weightKg: v };
          return copy;
        })
      }
      onRepsChange={(v) =>
        setDrafts((prev) => {
          const copy = { ...prev };
          copy[ex.id] = [...copy[ex.id]];
          copy[ex.id][idx] = { ...draft, reps: v };
          return copy;
        })
      }
      checkDisabled={
        isPending || !draft.weightKg || !draft.reps
      }
      onCheck={() => {
        const w = parseFloat(draft.weightKg);
        const r = parseInt(draft.reps, 10);
        if (!Number.isFinite(w) || !Number.isFinite(r) || w < 0 || r <= 0) {
          toast.error("무게(0 이상)와 회수(1 이상)를 올바르게 입력하세요");
          return;
        }
        saveSet.mutate({
          exerciseId: ex.id,
          setNumber: draft.setNumber,
          weightKg: w,
          reps: r,
        });
      }}
    />
  );
})}
```

- [ ] **Step 5.4.5: 운동 종료 시 celebrate() 호출**

기존 `handleFinish` 수정:

```typescript
const handleFinish = () => {
  startFinish(async () => {
    // celebrate를 redirect 전에 호출 (페이지 떠나기 전 1프레임)
    void celebrate();
    const result = await finishSession(session.id);
    if (result && result.ok === false) {
      toast.error(result.error);
    }
  });
};
```

> `void celebrate()`는 Promise 무시. confetti는 비동기 dynamic import + 발동 자체는 ms 단위라 redirect 전에 시작됨.

- [ ] **Step 5.4.6: dev 시각 + 행동 확인**

```bash
pnpm dev
```

E2E 1회:
1. `/dashboard` → "운동 시작" → 부위 2개 → 추천 보기 → 운동 시작
2. 첫 운동: 코랄 보더 / 나머지: 옅음
3. 첫 운동 1세트 입력 → ✓ → 칩 형태로 done 처리
4. 모든 세트 입력 → "운동 종료" → confetti 폭죽 → 대시보드로

→ Ctrl+C.

- [ ] **Step 5.4.7: TypeCheck + lint + 커밋**

```bash
pnpm tsc --noEmit && pnpm lint
git add src/app/workout/\[sessionId\]/SessionRunner.tsx
git commit -m "feat(phase-3-5): SessionRunner — activeExerciseId + SetRow + confetti on finish"
```

- [ ] **Step 5.4.8: Prefill 통합 — page.tsx에서 쿼리 + SessionRunner에 prop 전달**

`src/app/workout/[sessionId]/page.tsx` 수정 — `fetchLastMainSetsByExercise` 호출 추가:

```typescript
// 기존 import에 추가
import { fetchLastMainSetsByExercise } from "@/lib/queries/sets";
import type { LastMainSet } from "@/lib/queries/sets";

// fetchSessionSets 옆에 병렬 fetch 추가 — exerciseIds 결정 후
const [allExercises, existingSets] = await Promise.all([
  fetchUserExercises(user.id),
  fetchSessionSets(sessionId),
]);

const exerciseIds = exParam
  ? exParam.split(",").filter(Boolean)
  : [...new Set(existingSets.map((s) => s.exercise_id))];

// 신규: prefill
const prefillDefaults = await fetchLastMainSetsByExercise(user.id, exerciseIds);

// ... selectedExercises 계산 동일

return (
  <main className="p-5 max-w-md mx-auto pb-32">
    <SessionRunner
      session={session}
      exercises={selectedExercises}
      initialSets={existingSets}
      prefillDefaults={prefillDefaults}
    />
  </main>
);
```

`SessionRunner.tsx` props 타입에 `prefillDefaults` 추가:

```typescript
import type { LastMainSet } from "@/lib/queries/sets";

type Props = {
  session: WorkoutSession;
  exercises: ExerciseWithBodyParts[];
  initialSets: WorkoutSet[];
  prefillDefaults: Record<string, LastMainSet>; // exerciseId → 지난번 값
};

export function SessionRunner({
  session,
  exercises,
  initialSets,
  prefillDefaults,
}: Props) {
```

`drafts` useState 초기화 로직 수정 — 빈 세트의 weight/reps default를 prefill로:

```typescript
const [drafts, setDrafts] = useState<Record<string, DraftSet[]>>(() => {
  const out: Record<string, DraftSet[]> = {};
  for (const ex of exercises) {
    const existing = initialSets
      .filter((s) => s.exercise_id === ex.id && s.parent_set_id === null)
      .sort((a, b) => a.set_number - b.set_number);
    const n = ex.default_sets ?? 3;
    // prefill 값 (없으면 빈 문자열)
    const prefill = prefillDefaults[ex.id];
    const defaultWeight = prefill?.weightKg != null ? String(prefill.weightKg) : "";
    const defaultReps = prefill?.reps != null ? String(prefill.reps) : "";

    if (existing.length > 0) {
      out[ex.id] = existing.map((s) => ({
        setNumber: s.set_number,
        weightKg: s.weight_kg?.toString() ?? "",
        reps: s.reps?.toString() ?? "",
      }));
      while (out[ex.id].length < n) {
        out[ex.id].push({
          setNumber: out[ex.id].length + 1,
          weightKg: defaultWeight,
          reps: defaultReps,
        });
      }
    } else {
      out[ex.id] = Array.from({ length: n }, (_, i) => ({
        setNumber: i + 1,
        weightKg: defaultWeight,
        reps: defaultReps,
      }));
    }
  }
  return out;
});
```

> 운동 카드 헤더에 "지난번 50kg × 10" 표시는 이미 Plan 명세에 있음 — 그 값을 `prefillDefaults[ex.id]`에서 가져와 표시 가능 (구현 시 활용).

- [ ] **Step 5.4.9: Delete UI — ✕ 버튼 + 확인 다이얼로그**

먼저 `src/app/workout/actions.ts`에 Server Action 추가:

```typescript
export type RemoveExerciseResult = { ok: false; error: string };

/**
 * 세션에서 운동 1개 제거.
 * 1. 해당 운동의 모든 세트 (drop set 포함) CASCADE 삭제
 * 2. URL의 ?exercises= 파라미터에서 해당 ID 제거 후 같은 페이지로 redirect
 */
export async function removeExerciseFromSession(input: {
  sessionId: string;
  exerciseId: string;
  remainingExerciseIds: string[]; // 클라가 알고 있는 현재 목록 - 삭제된 ID
}): Promise<RemoveExerciseResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  // session_id + exercise_id 조합으로 모든 세트 삭제
  // RLS는 workout_sets via session 정책으로 본인 데이터만 허용 — exercise_id 조건은 명시 안전장치
  const { error } = await supabase
    .from("workout_sets")
    .delete()
    .eq("session_id", input.sessionId)
    .eq("exercise_id", input.exerciseId);

  if (error) {
    console.error("removeExerciseFromSession failed", error);
    return { ok: false, error: "운동 삭제 실패" };
  }

  if (input.remainingExerciseIds.length === 0) {
    // 더 이상 운동 없음 → 대시보드로
    redirect("/dashboard");
  }

  const exParam = encodeURIComponent(input.remainingExerciseIds.join(","));
  redirect(`/workout/${input.sessionId}?exercises=${exParam}`);
}
```

`SessionRunner.tsx`에 ✕ 버튼 + 확인 다이얼로그 추가:

```typescript
// import 추가
import { X } from "lucide-react";
import { useTransition, useState } from "react";
import { removeExerciseFromSession } from "@/app/workout/actions";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogClose,
} from "@/components/ui/dialog";

// 컴포넌트 본문에 추가
const [isRemoving, startRemove] = useTransition();
const [removeTarget, setRemoveTarget] = useState<string | null>(null);

const hasSavedSetsFor = (exerciseId: string): boolean =>
  savedSets.some(
    (s) => s.exercise_id === exerciseId && s.parent_set_id === null,
  );

const handleRemoveClick = (exerciseId: string) => {
  if (hasSavedSetsFor(exerciseId)) {
    // 저장된 세트 있음 — 확인 다이얼로그
    setRemoveTarget(exerciseId);
  } else {
    // 즉시 삭제
    confirmRemove(exerciseId);
  }
};

const confirmRemove = (exerciseId: string) => {
  startRemove(async () => {
    const remaining = exercises
      .filter((e) => e.id !== exerciseId)
      .map((e) => e.id);
    const result = await removeExerciseFromSession({
      sessionId: session.id,
      exerciseId,
      remainingExerciseIds: remaining,
    });
    if (result && result.ok === false) {
      toast.error(result.error);
    }
    setRemoveTarget(null);
  });
};
```

운동 카드 JSX에 ✕ 버튼 추가 (CardHeader 근처):

```tsx
<Card
  key={ex.id}
  className={cn(
    "mt-3 p-4 relative",
    ex.id === activeExerciseId && "border-2 border-accent",
    ex.id !== activeExerciseId && activeExerciseId !== null && "opacity-65",
  )}
>
  <button
    type="button"
    onClick={() => handleRemoveClick(ex.id)}
    disabled={isRemoving}
    className="absolute top-2 right-2 p-1.5 rounded-md text-text-ghost hover:text-text-muted hover:bg-accent-soft"
    aria-label={`${ex.name} 운동 삭제`}
  >
    <X className="w-4 h-4" />
  </button>
  {/* 기존 운동 헤더 + 세트 행들 */}
</Card>
```

운동 카드 밖에 확인 다이얼로그 1개 추가 (component return 안 어딘가):

```tsx
<Dialog
  open={removeTarget !== null}
  onOpenChange={(open) => !open && setRemoveTarget(null)}
>
  <DialogContent>
    <DialogHeader>
      <DialogTitle>이 운동 삭제할까요?</DialogTitle>
    </DialogHeader>
    <p className="text-body text-text-muted">
      이미 저장한 세트도 같이 지워집니다. 되돌릴 수 없어요.
    </p>
    <DialogFooter>
      <DialogClose asChild>
        <Button variant="ghost" disabled={isRemoving}>
          취소
        </Button>
      </DialogClose>
      <Button
        variant="default"
        disabled={isRemoving}
        onClick={() => removeTarget && confirmRemove(removeTarget)}
      >
        {isRemoving ? "삭제 중..." : "삭제"}
      </Button>
    </DialogFooter>
  </DialogContent>
</Dialog>
```

- [ ] **Step 5.4.10: dev 검증 — prefill + delete**

```bash
pnpm dev
```

검증:
1. `/dashboard` → "운동 시작" → 운동 시작 → 세션 페이지
2. 각 세트 input에 **지난번 값이 미리 채워져 있어야 함** (Phase 2 import 데이터 기준 — 예: 랫풀다운 40kg × 10)
3. 운동 카드 우상단 ✕ 클릭:
   - 세트 저장 안 한 운동 → 즉시 사라짐 + URL `?exercises=` 갱신
   - 세트 저장한 운동 → 확인 다이얼로그 → "삭제" → 세트 + 카드 사라짐
4. 마지막 운동까지 삭제하면 `/dashboard`로 자동 이동

→ Ctrl+C.

- [ ] **Step 5.4.11: TypeCheck + lint + 커밋**

```bash
pnpm tsc --noEmit && pnpm lint
git add src/app/workout/actions.ts src/app/workout/\[sessionId\]/
git commit -m "feat(phase-3-5): prefill from last main set + delete exercise with confirm dialog"
```

---

### Task 5.5: loading.tsx / error.tsx / not-found.tsx 톤 적용

**Files:**
- Modify: `src/app/workout/new/loading.tsx`
- Modify: `src/app/workout/new/error.tsx`
- Modify: `src/app/workout/[sessionId]/loading.tsx`
- Modify: `src/app/workout/[sessionId]/error.tsx`
- Modify: `src/app/workout/[sessionId]/not-found.tsx`

기존 Skeleton/Button alias로 자동 코랄 톤 적용됨. 텍스트만 따스하게:

- [ ] **Step 5.5.1: error.tsx 페이지들 (2개) 마이크로카피 통일**

각 `error.tsx`에서:
- `<h2>문제가 발생했습니다</h2>` → `<h2 className="text-h2 font-extrabold">잠시 멈췄어요</h2>`
- `<p>{error.message}</p>` → `<p className="text-body text-text-muted">{error.message ?? "다시 한번 시도해보세요"}</p>`
- 버튼 라벨: "다시 시도" → "다시 해볼게요"

- [ ] **Step 5.5.2: not-found.tsx 톤**

`src/app/workout/[sessionId]/not-found.tsx`:
- 제목: "세션을 찾을 수 없습니다" → "세션을 찾을 수 없어요"
- 부제는 유지
- 버튼 라벨: "대시보드로" → "대시보드로 돌아가기"

- [ ] **Step 5.5.3: loading.tsx — Skeleton alias 자동 적용 (수정 안 해도 코랄 톤). 패딩만 max-w-md mx-auto 일치 확인.**

- [ ] **Step 5.5.4: dev에서 확인 (선택)**

`/workout/<random-uuid>` → not-found 페이지가 코랄 톤으로.

- [ ] **Step 5.5.5: TypeCheck + lint + 커밋**

```bash
pnpm tsc --noEmit && pnpm lint
git add src/app/workout/
git commit -m "feat(phase-3-5): loading/error/not-found pages — warm copy + tokens"
```

---

## Chunk 6: Verification + PR

### Task 6.1: 빌드 + 회귀 테스트 + 수동 점검

- [ ] **Step 6.1.1: 프로덕션 빌드**

```bash
pnpm build
```

Expected: 에러 0개. 모든 라우트 출력 (`/dashboard`, `/workout/new`, `/workout/[sessionId]`, `/login` 등).

- [ ] **Step 6.1.2: 회귀 테스트**

```bash
pnpm vitest run
```

Expected: 모든 기존 테스트 + 새 motion/progress-ring 테스트 통과 (12+ tests).

기존: RLS 3 + recommendation 6 = 9
신규: motion 3 + progress-ring 5 = 8
**총 17 passed.**

- [ ] **Step 6.1.3: 수동 E2E (iPhone 14 Pro 시뮬레이션, 라이트 + 다크 + reduced motion)**

```bash
pnpm dev
```

각 시나리오 (Chrome DevTools Device Mode):

**시나리오 A: 라이트 모드 / motion 정상**
1. `/login` 진입 → "오운완" 큰 타이틀 + 코랄 톤 버튼 + 그라데이션 배경 확인
2. 로그인 → `/dashboard` → 진행 링 / 요일 칩 / 최근 운동 / CTA 확인
3. 우상단 테마 토글 → 다크모드 전환
4. (다크) 같은 화면들이 따뜻한 갈색 톤으로 자동 전환
5. 운동 시작 → 부위 선택 → 추천 → 시작
6. 세션 페이지: 활성 운동 코랄 보더, 비활성 운동 옅음
7. **세트 input에 지난번 기록(예: 50kg × 10) 자동 채워져 있음**
8. 운동 카드 우상단 ✕ 클릭 (세트 저장 안 함) → 즉시 사라짐
9. 다른 운동 카드 ✕ 클릭 (세트 1개 저장 후) → 확인 다이얼로그 → "삭제" → 카드 + 세트 모두 사라짐
10. 세트 입력 후 ✓ → 칩 형태로 done
11. 운동 종료 → confetti 폭죽 → `/dashboard`로

**시나리오 B: prefers-reduced-motion 켜기**
- DevTools → Rendering → Emulate CSS media feature → `prefers-reduced-motion: reduce`
- 운동 종료 → confetti 미발동 확인 (페이지만 이동)
- ✓ 버튼 클릭 시 색 변경만, scale pop 없음

**시나리오 C: 콘솔 hydration warning 0개**
- 콘솔 열어두고 모든 페이지 진입
- 빨간 React hydration mismatch 메시지 없어야 함

**시나리오 D: Accessibility contrast**
- DevTools → Lighthouse → Accessibility → 점수 90+ 확인
- 또는 Elements 패널에서 텍스트 노드 클릭 → contrast ratio AA pass 확인

**시나리오 E: shadcn `dark:` variant 시각 audit (중요)**

shadcn 기본 컴포넌트들(button.tsx, input.tsx, checkbox.tsx)은 `dark:bg-input/30`, `dark:border-input` 같은 하드코딩 dark variant 사용 중. 새 토큰 시스템에서 `--input`이 이미 다크 모드에서 어두운 값이라 30% opacity 적용 시 거의 안 보일 수 있음.

각 컴포넌트를 다크 모드에서 시각 확인:
- **Outline 버튼**: 보더와 호버 상태 보임? (`dark:border-input dark:bg-input/30 dark:hover:bg-input/50`)
- **Input 필드**: 배경 살짝 보임? disabled 상태 구분됨? (`dark:bg-input/30 dark:disabled:bg-input/80`)
- **Checkbox**: 체크 안 된 상태 보더 보임?

→ **안 보이면 Task 6.1.5로 픽스 진행. 보이면 시나리오 통과.**

→ Ctrl+C.

- [ ] **Step 6.1.4: 시나리오 통과 확인 + 정리**

문제 발견 시 해당 Chunk로 돌아가 수정 + 새 commit. 회귀 차단.

- [ ] **Step 6.1.5: (조건부) shadcn `dark:` variant 픽스**

시나리오 E에서 안 보이는 컴포넌트가 있으면 해당 .tsx 파일 수정. 예: `src/components/ui/button.tsx`에서 `dark:bg-input/30 dark:hover:bg-input/50` → `dark:bg-accent-soft/50 dark:hover:bg-accent-soft` (또는 비슷한 더 진한 값). 같은 방식으로 input.tsx, checkbox.tsx 보정.

```bash
# 수정 후 다시 dev로 검증 → commit
git add src/components/ui/<수정한 파일들>
git commit -m "fix(phase-3-5): shadcn dark: variant double-darkening on warm tokens"
```

> Plan의 "shadcn .tsx 수정 X" 원칙의 예외 — 실제 시각 확인 후에만 발생. 발생 안 하면 이 step 건너뜀.

---

### Task 6.2: 결과 로그 + PR + 머지 + 태그

**Files:**
- Create: `docs/import/design-renewal-log.md`

- [ ] **Step 6.2.1: 완료 로그**

```bash
TODAY=$(date +%Y-%m-%d)
cat > docs/import/design-renewal-log.md <<EOF
# Phase 3.5 — Design System Renewal 완료

- **Date:** ${TODAY}
- **Branch:** feat/phase-3-5-design-system
- **Tag:** v0.3.5-design-system

## Implemented (Plan 3.5)

- 디자인 토큰 시스템: \`globals.css\` 전면 교체 (코랄 + 크림 / 따뜻한 갈색 다크)
- Pretendard Variable CDN (Geist 제거)
- next-themes 마운트 + 토글 (라이트/다크/시스템)
- shadcn alias 매핑 — 기존 컴포넌트 .tsx 수정 없이 자동 적용
- 새 컴포넌트: ProgressRing, DayChip, BodyPartChip, SetRow, ThemeToggle
- 새 유틸: prefersReducedMotion, celebrate (canvas-confetti)
- 새 RSC 쿼리: fetchTodaySession, fetchWeeklySessionDates, fetchRecentExerciseHistory
- 화면 리뉴얼: /login, /dashboard, /workout/new, /workout/[id], loading/error/not-found
- WCAG AA 준수: 모든 코랄 위 텍스트 다크 브라운 (4.5:1+)
- prefers-reduced-motion 처리 (confetti / animation 스킵)
- 운동 종료 시 confetti (1회만)

## Tests

- tests/lib/motion.test.ts — 3 unit tests
- tests/components/progress-ring.test.tsx — 5 unit tests
- 기존 tests/rls/isolation.test.ts (3) + tests/workout/recommendation.test.ts (6) 회귀 통과
- 총 17 passed

## Manual E2E Performed

- iPhone 14 Pro 시뮬레이션: 라이트 → 다크 토글 / 세션 1회 (시작 → 세트 → 종료 → confetti)
- prefers-reduced-motion: reduce 모드에서 confetti 미발동 확인
- Hydration warning 0개
- Lighthouse Accessibility 90+
EOF
```

- [ ] **Step 6.2.2: 로그 commit**

```bash
git add docs/import/design-renewal-log.md
git commit -m "docs(phase-3-5): completion log"
```

- [ ] **Step 6.2.3: 푸시 + PR**

```bash
git push -u origin feat/phase-3-5-design-system
gh pr create --title "Phase 3.5: Design System Renewal" --body "$(cat <<'EOF'
## Summary

Phase 3.1 머지 후 사용자 피드백("디자인 다 쓰레기네") 반영. 따뜻한 코랄 디자인 시스템으로 모든 화면 리뉴얼 + 다크모드 + Pretendard.

## Scope

- ✅ globals.css 토큰 시스템 전면 교체 (코랄 + 크림 / 따뜻한 갈색 다크)
- ✅ Pretendard Variable CDN (Geist 제거)
- ✅ next-themes 마운트 + ThemeToggle (Sun/Moon/Monitor 순환)
- ✅ shadcn alias 매핑 — 컴포넌트 .tsx 수정 없이 자동 적용
- ✅ 새 컴포넌트: ProgressRing, DayChip, BodyPartChip, SetRow, ThemeToggle
- ✅ 새 유틸: prefersReducedMotion, celebrate (canvas-confetti)
- ✅ 새 RSC 쿼리: fetchTodaySession, fetchWeeklySessionDates, fetchRecentExerciseHistory
- ✅ 화면 리뉴얼: /login, /dashboard, /workout/new, /workout/[id], loading/error/not-found
- ✅ WCAG AA: 모든 코랄 위 텍스트 다크 브라운 (4.5:1+)
- ✅ prefers-reduced-motion 처리
- ✅ 운동 종료 confetti

## Out of Scope (Plan 3.2 / Phase 4+)

- 드롭세트 UI, 좌/우 토글, 휴식 타이머, 풀 캘린더, 차트, 로고/아이콘.

## Test Plan

- [ ] pnpm vitest run — 17 passed (RLS 3 + recommendation 6 + motion 3 + progress-ring 5)
- [ ] pnpm build — 0 errors
- [ ] 라이트/다크 토글 시 모든 화면 자동 전환
- [ ] iPhone 14 Pro 시뮬레이션 E2E 1회 (시작 → 세트 → confetti → 대시보드)
- [ ] prefers-reduced-motion: reduce 모드 confetti 미발동
- [ ] Lighthouse Accessibility 90+
- [ ] 콘솔 hydration warning 0개

## Spec

`docs/specs/2026-05-28-design-system-design.md` (v2, critic round 1 반영)
EOF
)"
```

- [ ] **Step 6.2.4: 머지 + 태그**

```bash
gh pr merge --merge --delete-branch
git checkout main && git pull
git tag v0.3.5-design-system
git push origin v0.3.5-design-system
```

- [ ] **Step 6.2.5: 사용자 보고**

다음 정보 사용자에게 제공:
- PR URL
- 머지 commit SHA
- 태그 `v0.3.5-design-system`
- production URL (`https://ounwan.vercel.app`) — 새 디자인 폰에서 확인 권장
- 다음 단계: 1주일 실사용 → Plan 3.2 (드롭/좌우/타이머)

---

## Risks & Mitigations

| 리스크 | 영향 | 완화 |
|--------|------|------|
| `Set<number>` RSC→Client 직렬화 미지원 → 런타임 크래시 | 해결됨 | page.tsx에서 `Array.from(weeklyDates)` 변환, Dashboard.tsx는 `number[]` + `.includes()` (Task 5.2). |
| `--font-heading` 토큰 제거 시 CardTitle / DialogTitle 폰트 깨짐 | 해결됨 | globals.css `@theme inline`에 `--font-heading` 명시 (Task 1.2.1). |
| Sonner / shadcn 컴포넌트 inline style의 raw var (`var(--popover)` 등) 미정의 | 해결됨 | `:root` / `.dark`에 raw shadcn vars 명시 정의 — `--popover`, `--border`, `--radius`, `--primary` 등. `@theme inline`의 `--color-*` alias와 별도. (Task 1.2.1). |
| shadcn `dark:bg-input/30` 같은 하드코딩 variant가 새 토큰에서 거의 안 보임 | 중간 | Task 6.1.5에서 시각 audit + 필요 시 해당 .tsx 수정. "shadcn .tsx 수정 X" 원칙의 명시적 예외. |
| signOut UI 제거 — 로그아웃 못 함 | 해결됨 | Dashboard 우상단 ThemeToggle 옆에 `LogOut` 아이콘 버튼 (Task 5.2.2). |
| Typography 토큰이 font-size만 적용 (weight/line-height 빠짐) | 해결됨 | 사용 패턴 명시 — `text-h2 font-extrabold tracking-tight` 같은 조합 사용 (Step 3.2.2 주). |
| shadcn alias가 컴포넌트의 일부 hardcoded class 못 덮음 (예: `text-primary-foreground`가 흰색일 거라 가정한 곳) | 중간 | 6.1.3 수동 점검에서 발견 시 그 컴포넌트만 .tsx 수정. alias로 99% 커버 예상. |
| Pretendard CDN 다운 / 지연 | 낮음 | Fallback 시스템 폰트 stack 정의. jsdelivr는 다운 사례 거의 없음. |
| canvas-confetti 다이내믹 import 첫 호출 시 ~150ms 지연 | 낮음 | finishSession redirect 전에 호출 — 사용자는 페이지 이동 직전 confetti 보고 다음 페이지 진입. |
| next-themes hydration mismatch | 해결됨 | `suppressHydrationWarning` + `disableTransitionOnChange` (Task 1.3). |
| activeExerciseId 계산 — 모든 세트 완료한 운동 다음에 새 운동이 없는 경우 (이미 다 완료) | 낮음 | 반환값 null. UI는 모든 카드 정상 표시 + "운동 종료" 활성화. |
| 다크모드에서 Sonner 토스트 색 안 맞음 | 중간 | Sonner는 useTheme() 사용 중 — 자동 전환. 단 `--normal-bg` 등 자체 토큰은 alias 안 됨. 발견 시 sonner.tsx에 한 줄 추가. |
| Dashboard 4 쿼리가 느림 (특히 fetchRecentExerciseHistory가 100개 over-fetch) | 낮음 | Supabase indexed columns (workout_sets.created_at, workout_sessions.user_id+started_at). 100개도 ms 단위. |
| 사용자가 다크모드 토글 후 새로고침 시 깜빡임 | 해결됨 | next-themes `attribute="class"` + `defaultTheme="system"`로 hydration 전에 class 주입. |
| 운동 종료가 빈 세션일 때도 confetti | 낮음 | Plan 3.1 finishSession이 `savedSets.length === 0`이면 버튼 disabled. 통과 안 됨. |
| Delete exercise → 세트 CASCADE 데이터 손실 (실수 탭) | 중간 | 세트 저장한 운동은 무조건 확인 다이얼로그 (Task 5.4.9). 세트 없는 운동은 URL만 갱신 — 복구는 페이지 뒤로 가서 다시 추천 받으면 됨. |
| Delete 모든 운동 삭제 시 빈 세션이 DB에 남음 | 낮음 | `removeExerciseFromSession`에서 remaining=0이면 `/dashboard`로 redirect. 세션 자체는 남지만 ended_at은 null — 사용자가 직접 다시 진입해서 종료 가능. (편의성 vs 데이터 자동 정리 트레이드오프). |
| Prefill 값이 너무 옛날 기록 (1년 전 등) | 낮음 | `fetchLastMainSetsByExercise`는 시간 필터 없이 latest 1개. 1년 묵은 가벼운 무게가 채워질 수 있음. 사용자가 input 보고 조정. 한 번 ✓ 누르면 그게 새 prefill 됨. |
| Prefill 쿼리 200건 over-fetch 성능 | 낮음 | `created_at` indexed + `workout_sessions.user_id` indexed. 운동 10개 × 평균 20세트 = 200 row 조회 ms 단위. |

## Recovery Path

PR 머지 후 디자인 회귀 발견 시:

1. **특정 컴포넌트만 톤 안 맞음:** 해당 .tsx의 hardcoded color class 찾아서 토큰으로 교체 (예: `text-white` → `text-text`).
2. **전체 다크모드가 깨짐:** `globals.css`의 `.dark` 블록 + `theme-provider.tsx` 검토.
3. **롤백:** `git revert <merge-commit>` 후 새 PR.

---

## Reference Map

| 구현 항목 | 파일 | 스펙 섹션 |
|-----------|------|---------|
| 토큰 + alias 매핑 | `src/app/globals.css` | 3.1, 3.2, 6.1, 6.5 |
| ThemeProvider | `src/components/providers/theme-provider.tsx` | 6.2 |
| Pretendard CDN | `src/app/globals.css` | 6.3 |
| Reduced motion 유틸 | `src/lib/motion.ts` | 3.8 |
| Confetti | `src/lib/celebrate.ts` | 6.4 |
| ProgressRing | `src/components/ui/progress-ring.tsx` | 4.4 |
| DayChip | `src/components/ui/day-chip.tsx` | 4.5 |
| BodyPartChip | `src/components/ui/body-part-chip.tsx` | 4.7 |
| SetRow | `src/components/ui/set-row.tsx` | 4.6 |
| ThemeToggle | `src/components/ui/theme-toggle.tsx` | 6.2 |
| Dashboard 새 쿼리 | `src/lib/queries/sessions.ts`, `sets.ts` | 5.1 |
| Prefill 쿼리 | `src/lib/queries/sets.ts` fetchLastMainSetsByExercise | (plan-only addition) |
| 운동 삭제 Server Action | `src/app/workout/actions.ts` removeExerciseFromSession | (plan-only addition) |
| Dashboard 리뉴얼 | `src/app/dashboard/{page,Dashboard}.tsx` | 5.1 |
| StartForm 리뉴얼 | `src/app/workout/new/StartForm.tsx` | 5.2 |
| SessionRunner activeId + celebrate | `src/app/workout/[sessionId]/SessionRunner.tsx` | 5.3, 6.4 |
| 라우트 UX (loading/error/not-found) | 각 위치 | 5.4 |
| WCAG AA contrast | 전 컴포넌트 | 3.3 |

---

## Revision History

| Version | Date | Change |
|---------|------|--------|
| v1 | 2026-05-28 | 초안 — spec v2 기반 — 6 chunks (Foundation / Utilities / Components / Queries / Screens / Verification). TDD는 유틸 + ProgressRing에만 적용 (시각 컴포넌트는 수동 검증). |
| v2 | 2026-05-28 | critic round 1 반영: **(CRITICAL)** `Set<number>` RSC→Client 직렬화 실패 — `Array.from()` 변환 + Dashboard `number[]` 수용 (.includes). **(CRITICAL)** `--font-heading` 토큰 복원으로 CardTitle/DialogTitle 폰트 보존. **(MAJOR)** Sonner / shadcn inline style 위한 raw shadcn vars (`--popover`, `--border`, `--radius`, `--primary` 등) `:root` / `.dark` 명시. **(MAJOR)** signOut UI 복원 — Dashboard 우상단 LogOut 아이콘 + `dashboard/actions.ts:signOut` 재호출. **(MAJOR)** Login page 전체 코드 명시 (vague description 제거, signInWithGoogle/searchParams.error 보존). **(MAJOR)** Typography 토큰 한계 명시 — font-size만 적용, weight/line-height는 별도 utility로. **(MAJOR)** shadcn `dark:` variant 시각 audit step (Task 6.1.5) — `dark:bg-input/30` 등 double-darkening 발견 시 .tsx 수정 허용. **(MINOR)** `--font-mono` 시스템 monospace fallback 유지. |
| v3 | 2026-05-28 | 사용자 기능 추가 요청 반영 (원래 Plan 3.2 후보 2개를 3.5로 이동): (1) **운동 진행 중 운동 카드 삭제** — ✕ 버튼, 세트 저장 시 확인 다이얼로그, CASCADE delete, 마지막 운동 삭제 시 대시보드 redirect. Task 5.4.9 + `removeExerciseFromSession` Server Action 신설. (2) **이전 기록 자동 채움** — `fetchLastMainSetsByExercise` 쿼리 (Task 4.3), SessionRunner의 drafts useState 초기화에 prefill 통합 (Task 5.4.8). Verification 시나리오 A에 두 기능 추가. spec Section 7도 "이 plan으로 옮겨온 항목"으로 업데이트. |
