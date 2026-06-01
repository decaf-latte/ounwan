# Phase 4: History + Charts + Exclude Recommendation Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Phase 3.6의 `/history` 카드 리스트 위에 **월별 캘린더 + 운동별 1RM 추이 차트 + 세션 상세 모달**을 얹어 진척도를 시각적으로 확인. 동시에 헬스장 피드백 R4(추천에서 운동 빼기) 해결.

**Architecture:** `body_parts.color` DB 컬럼을 단일 진실 소스로 직접 사용(새 CSS 토큰 안 만듦). RSC가 색 포함 join 결과 fetch → props로 전달. SessionDetailDialog/ExerciseProgressDialog는 모달 열릴 때 클라이언트 supabase로 lazy fetch (useQuery). MiniCalendar는 6주 고정 그리드, CSS-only(JS 미디어쿼리 X). recharts 신규 도입 (18kB gzip).

**Tech Stack:** Next.js 16 / React 19 / TypeScript 5 / Tailwind v4 / `recharts` (NEW) / `@tanstack/react-query` v5 / `@base-ui/react` (Dialog, Checkbox 기존)

**Reference docs:**
- Spec: `docs/specs/2026-06-01-phase-4-history-charts-design.md` (v3, critic 2라운드 통과)
- Phase 3.6 plan: `docs/plans/2026-05-29-phase-3-6-responsive-desktop.md` (이전 단계, 머지됨)
- Phase 3.6 log: `docs/import/responsive-desktop-log.md`

**완료 시점에 검증되는 것:**

| 항목 | 검증 |
|---|---|
| 대시보드 미니 캘린더 | 주간 칩 7개 → 이번 달 그리드(부위 도트)로 교체 |
| /history 풀 캘린더 | 월 그리드 + 부위 도트 + 날짜 클릭 → 세션 상세 모달 |
| /history 카드 리스트 | 선택한 월 데이터로 리스트 표시 (탭 전환), 4주 baseline 폐기 |
| 운동별 1RM 추이 차트 | 최근 사용 운동 8개의 미니 라인 카드 + 클릭 시 큰 모달(1RM + 볼륨 멀티) |
| 세션 상세 모달 | 운동 N개 + 세트 weight×reps + 부위 태그(DB color) |
| R4 추천 제외 | StartForm 추천 카드 체크박스(기본 모두 체크), 체크 해제는 세션에서 제외 |
| Hydration | next-themes warning 0개 유지 |
| 회귀 | 22 → 28+ tests pass |
| Build | `pnpm build` 0 errors, 라우트 변동 없음 |

**스코프 명시 — 이 plan에 포함 안 됨 (Plan 4.1+):**
- ❌ 차트 zoom/brush/툴팁 상세
- ❌ 1RM PR(personal record) 자동 감지 토스트
- ❌ 세션 비교, 부위별 주간 볼륨 추이
- ❌ 같은 날 여러 세션 picker (첫 세션만 표시)
- ❌ MiniCalendar 화살표 키 네비
- ❌ 운동 drag&drop, Magic link (Plan 3.7 후보)

---

## 데이터 흐름 한눈에

```
/dashboard (RSC)
  └─ fetchSessionsInMonth(this month) + 기존 쿼리들
      └─ Dashboard.tsx (주간 칩 → MiniCalendar size="sm", 비활성)

/workout/new (RSC + Client)
  └─ StartForm
      └─ ExerciseRecCard (체크박스, base-ui)
          → excludedExerciseIds Set
          → startSession에 넘기는 ids = recommendations - excluded

/history (RSC)
  ├─ URL: ?y=2026&m=6 (m 1-indexed)
  ├─ safeYear/safeMonth 범위 검증
  └─ fetchSessionsInMonth(year, month) + fetchTopExercises(8)
      └─ HistoryView 클라이언트
          ├─ Tab1: MiniCalendar (md size, onDateClick → SessionDetailDialog)
          ├─ Tab2: 같은 monthSessions를 카드 리스트 (탭 일관성)
          ├─ ProgressLine 카드 N개 → onClick → ExerciseProgressDialog
          ├─ useTransition + router.push({ scroll: false }) 월 이동
          └─ SessionDetailDialog + ExerciseProgressDialog (useQuery lazy)

/workout/[sessionId] 세션 종료
  └─ finishSession Server Action
      └─ revalidatePath('/dashboard') + revalidatePath('/history') (NEW)
```

---

## Chunk 1: Foundation — recharts + 1RM 헬퍼 + body_parts color 헬퍼

**목표:** recharts 의존성 추가 + `one-rep-max.ts` 순수 함수 (null 가드) + `body-part-color.ts` 헬퍼 + 4개 Vitest 단위 테스트. 회귀 22 PASS 확인.

### Task 1.1: 브랜치 확인 + 의존성

**Files:**
- Modify: `package.json` (`recharts` 추가)

- [ ] **Step 1.1.1: 브랜치 확인**

```bash
cd "/Users/jeonhyejin/Desktop/사이드프로젝트/gym-routine-app"
git status
git branch --show-current
```

Expected: `feat/phase-4-history-charts` + working tree clean (docs/specs만 커밋된 상태).

- [ ] **Step 1.1.2: recharts 설치**

```bash
pnpm add recharts
```

Expected: `recharts` 버전이 dependencies에 추가됨. `pnpm-lock.yaml` 변경.

- [ ] **Step 1.1.3: 회귀 확인 (의존성 추가만)**

```bash
pnpm tsc --noEmit && pnpm test 2>&1 | tail -10
```

Expected: 0 errors. 기존 22 tests pass.

- [ ] **Step 1.1.4: 커밋**

```bash
git add package.json pnpm-lock.yaml
git commit -m "chore(phase-4): add recharts dependency for history charts"
```

---

### Task 1.2: `one-rep-max.ts` 순수 함수 + tests (TDD)

**Files:**
- Create: `src/lib/workout/one-rep-max.ts`
- Create: `tests/lib/one-rep-max.test.ts`

- [ ] **Step 1.2.1: 테스트 fixture + 4개 테스트 (RED)**

```typescript
// tests/lib/one-rep-max.test.ts
import { describe, it, expect } from "vitest";
import { estimateOneRepMax, calcSetVolume } from "@/lib/workout/one-rep-max";

describe("estimateOneRepMax (Epley)", () => {
  it("1회 무게는 입력 무게 그대로 반환", () => {
    expect(estimateOneRepMax(80, 1)).toBe(80);
  });

  it("일반 케이스 — 60kg × 10회 → 80kg (Epley)", () => {
    // 60 × (1 + 10/30) = 60 × 1.333 = 80
    expect(estimateOneRepMax(60, 10)).toBe(80);
  });

  it("null / undefined / 0 / 음수 → 0", () => {
    expect(estimateOneRepMax(null, 10)).toBe(0);
    expect(estimateOneRepMax(60, null)).toBe(0);
    expect(estimateOneRepMax(undefined, undefined)).toBe(0);
    expect(estimateOneRepMax(0, 5)).toBe(0);
    expect(estimateOneRepMax(-10, 5)).toBe(0);
    expect(estimateOneRepMax(50, 0)).toBe(0);
    expect(estimateOneRepMax(50, -3)).toBe(0);
  });

  it("소수 1자리 반올림", () => {
    // 70 × (1 + 8/30) = 70 × 1.2667 = 88.6666... → 88.7
    expect(estimateOneRepMax(70, 8)).toBe(88.7);
  });
});

describe("calcSetVolume", () => {
  it("정상 케이스 60kg × 10회 = 600", () => {
    expect(calcSetVolume(60, 10)).toBe(600);
  });

  it("null / undefined / 0 / 음수 → 0", () => {
    expect(calcSetVolume(null, 10)).toBe(0);
    expect(calcSetVolume(60, null)).toBe(0);
    expect(calcSetVolume(0, 10)).toBe(0);
    expect(calcSetVolume(50, -1)).toBe(0);
  });
});
```

- [ ] **Step 1.2.2: 테스트 실행 (RED 확인)**

```bash
pnpm vitest run tests/lib/one-rep-max.test.ts
```

Expected: 모듈을 찾을 수 없다는 에러로 실패.

- [ ] **Step 1.2.3: 구현 작성 (GREEN)**

```typescript
// src/lib/workout/one-rep-max.ts
/**
 * Epley 1RM 추정. weight 또는 reps가 null/0/음수면 0 반환.
 * weight_kg / reps 컬럼이 nullable이므로 null 가드 필수.
 */
export function estimateOneRepMax(
  weight: number | null | undefined,
  reps: number | null | undefined,
): number {
  if (weight == null || reps == null) return 0;
  if (reps <= 0 || weight <= 0) return 0;
  if (reps === 1) return weight;
  // Epley: weight × (1 + reps/30)
  return Math.round(weight * (1 + reps / 30) * 10) / 10;
}

export function calcSetVolume(
  weight: number | null | undefined,
  reps: number | null | undefined,
): number {
  if (weight == null || reps == null) return 0;
  if (weight <= 0 || reps <= 0) return 0;
  return weight * reps;
}
```

- [ ] **Step 1.2.4: 테스트 PASS 확인**

```bash
pnpm vitest run tests/lib/one-rep-max.test.ts
```

Expected: 4 passed (describe 2개에 총 4 + 2 = 6 it이지만 표현은 6 tests in 2 describes).

> 실제 it 개수: 6 (4 + 2). 회귀 baseline 카운트 갱신.

- [ ] **Step 1.2.5: TypeCheck**

```bash
pnpm tsc --noEmit
```

Expected: 0 errors.

- [ ] **Step 1.2.6: 커밋**

```bash
git add src/lib/workout/one-rep-max.ts tests/lib/one-rep-max.test.ts
git commit -m "feat(phase-4): one-rep-max Epley + volume helpers with null guards + 6 tests"
```

---

### Task 1.3: `body-part-color.ts` 헬퍼

**Files:**
- Create: `src/lib/workout/body-part-color.ts`

- [ ] **Step 1.3.1: 헬퍼 작성**

```typescript
// src/lib/workout/body-part-color.ts
/**
 * body_parts.color hex 문자열 → React inline style.
 * MiniCalendar 도트, BodyPartTag 등에서 공통 사용.
 * 추후 다크모드 톤다운 / 알파 채널 / fallback 등을 여기 한 곳에 추가.
 */
import type { CSSProperties } from "react";

export function bodyPartStyle(color: string | null | undefined): CSSProperties {
  return { backgroundColor: color ?? "#B2BEC3" };
}
```

> trivial이지만 한 곳 집중 패턴. 별도 테스트 불요.

- [ ] **Step 1.3.2: TypeCheck + lint**

```bash
pnpm tsc --noEmit && pnpm lint
```

Expected: 0 errors.

- [ ] **Step 1.3.3: 커밋**

```bash
git add src/lib/workout/body-part-color.ts
git commit -m "feat(phase-4): bodyPartStyle helper for inline color from DB"
```

---

## Chunk 2: MiniCalendar 컴포넌트

**목표:** 6주 고정 그리드, 부위 도트, role/aria 접근성, 클릭 가능/비활성 모드. 2 단위 테스트.

### Task 2.1: MiniCalendar 컴포넌트

**Files:**
- Create: `src/components/ui/mini-calendar.tsx`
- Create: `tests/components/ui/mini-calendar.test.tsx`

- [ ] **Step 2.1.1: 단위 테스트 작성 (RED)**

```tsx
// tests/components/ui/mini-calendar.test.tsx
import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { MiniCalendar, type DayEntry } from "@/components/ui/mini-calendar";

const dotsByDate: Record<number, DayEntry> = {
  5: { bodyPartColors: ["#FF6B6B", "#4ECDC4"], sessionIds: ["s1"] },
  12: { bodyPartColors: ["#FFE66D"], sessionIds: ["s2", "s3"] }, // 같은 날 2 세션
};

describe("MiniCalendar", () => {
  it("운동한 날짜에 부위 도트 N개 + 다중 세션은 첫 sessionId만 onClick에 전달", () => {
    const onDateClick = vi.fn();
    render(
      <MiniCalendar
        year={2026}
        month={6}
        todayDayOfMonth={8}
        dotsByDate={dotsByDate}
        onDateClick={onDateClick}
      />,
    );
    // 12일 셀 클릭 → sessionIds[0] = "s2" 전달
    const day12 = screen.getByRole("button", { name: /6월 12일.*세션 2개/ });
    fireEvent.click(day12);
    expect(onDateClick).toHaveBeenCalledWith("s2");
  });

  it("onDateClick 미지정 시 운동한 날도 button 아닌 div로 렌더 (대시보드 비활성 모드)", () => {
    render(
      <MiniCalendar
        year={2026}
        month={6}
        todayDayOfMonth={8}
        dotsByDate={dotsByDate}
      />,
    );
    // 5일은 운동한 날이지만 button 아닌 div
    expect(screen.queryByRole("button", { name: /6월 5일/ })).toBeNull();
  });
});
```

- [ ] **Step 2.1.2: 테스트 실행 (RED 확인)**

```bash
pnpm vitest run tests/components/ui/mini-calendar.test.tsx
```

Expected: 모듈 없음 에러.

- [ ] **Step 2.1.3: MiniCalendar 구현 (GREEN)**

```tsx
// src/components/ui/mini-calendar.tsx
"use client";
import { cn } from "@/lib/utils";
import { bodyPartStyle } from "@/lib/workout/body-part-color";

export type DayEntry = {
  bodyPartColors: string[];
  sessionIds: string[];
};

type Props = {
  year: number;
  /** 1-indexed (1=Jan, 12=Dec) — URL 표기와 일치 */
  month: number;
  todayDayOfMonth?: number;
  dotsByDate: Record<number, DayEntry>;
  /** 미지정 시 비활성 (대시보드용). 클릭 시 첫 sessionId 전달. */
  onDateClick?: (sessionId: string) => void;
  size?: "sm" | "md";
};

const DAY_LABELS = ["월", "화", "수", "목", "금", "토", "일"] as const;

export function MiniCalendar({
  year,
  month,
  todayDayOfMonth,
  dotsByDate,
  onDateClick,
  size = "md",
}: Props) {
  // 첫 날의 요일 (월요일=0 ... 일요일=6)
  // JS Date: month 0-indexed, getDay()는 일=0...토=6
  // 월요일 시작으로 보정: (getDay() + 6) % 7
  const firstDayMonOffset = (new Date(year, month - 1, 1).getDay() + 6) % 7;
  // 해당 월 마지막 일
  const daysInMonth = new Date(year, month, 0).getDate();

  return (
    <div
      role="grid"
      aria-label={`${year}년 ${month}월 운동 캘린더`}
      className={cn(
        "grid grid-cols-7 gap-1",
        size === "sm" ? "text-[10px]" : "text-xs",
      )}
    >
      {DAY_LABELS.map((d) => (
        <div
          key={d}
          role="columnheader"
          className="text-center text-text-muted py-1 font-semibold"
        >
          {d}
        </div>
      ))}

      {Array.from({ length: 42 }).map((_, i) => {
        const dayNum = i - firstDayMonOffset + 1;
        const inMonth = dayNum >= 1 && dayNum <= daysInMonth;
        const entry = inMonth ? dotsByDate[dayNum] : undefined;
        const isToday = inMonth && dayNum === todayDayOfMonth;
        const clickable = !!entry && !!onDateClick;

        const cellContent = (
          <>
            <span>{inMonth ? dayNum : ""}</span>
            {entry && (
              <div className="flex justify-center gap-0.5 mt-0.5">
                {entry.bodyPartColors.slice(0, 4).map((c, j) => (
                  <span
                    key={j}
                    className="w-1 h-1 rounded-full inline-block dark:saturate-90 dark:brightness-95"
                    style={bodyPartStyle(c)}
                  />
                ))}
                {entry.bodyPartColors.length > 4 && (
                  <span className="text-[8px] text-text-muted">
                    +{entry.bodyPartColors.length - 4}
                  </span>
                )}
              </div>
            )}
          </>
        );

        if (clickable) {
          return (
            <button
              key={i}
              type="button"
              role="gridcell"
              onClick={() => onDateClick(entry.sessionIds[0])}
              className={cn(
                "text-center rounded p-1 hover:bg-accent-soft transition-colors",
                isToday && "border-2 border-accent",
              )}
              aria-label={`${month}월 ${dayNum}일, 세션 ${entry.sessionIds.length}개`}
            >
              {cellContent}
            </button>
          );
        }
        return (
          <div
            key={i}
            role="gridcell"
            className={cn(
              "text-center rounded p-1",
              isToday && "border-2 border-accent",
              !inMonth && "text-text-ghost",
            )}
            aria-label={
              inMonth ? `${month}월 ${dayNum}일` : undefined
            }
          >
            {cellContent}
          </div>
        );
      })}
    </div>
  );
}
```

- [ ] **Step 2.1.4: 테스트 PASS 확인**

```bash
pnpm vitest run tests/components/ui/mini-calendar.test.tsx
```

Expected: 2 passed.

- [ ] **Step 2.1.5: 전체 회귀 (24 PASS 예상)**

```bash
pnpm test 2>&1 | tail -10
```

Expected: 22 기존 + 6 (one-rep-max) + 2 (mini-calendar) = 30 tests pass.

> 위 Task 1.2에서 it 6개 추가, Task 2.1에서 it 2개 추가. 정확한 누적 = 22 + 6 + 2 = 30.

- [ ] **Step 2.1.6: TypeCheck + lint**

```bash
pnpm tsc --noEmit && pnpm lint
```

- [ ] **Step 2.1.7: 커밋**

```bash
git add src/components/ui/mini-calendar.tsx tests/components/ui/mini-calendar.test.tsx
git commit -m "feat(phase-4): MiniCalendar — 6-week grid, body-part dots, role=grid + aria + 2 tests"
```

---

## Chunk 3: fetchSessionsInMonth + Dashboard 미니 캘린더 교체

**목표:** 신규 RSC 쿼리 `fetchSessionsInMonth` (body_parts.color join) + Dashboard에서 주간 칩 → MiniCalendar 교체. 30 PASS 유지.

### Task 3.1: `fetchSessionsInMonth` 쿼리

**Files:**
- Modify: `src/lib/queries/sessions.ts` (RecentSession은 그대로 두고 새 export 추가)

- [ ] **Step 3.1.1: 타입 + 쿼리 추가**

`src/lib/queries/sessions.ts` 끝에 추가:

```typescript
// 기존 import 외에 createClient는 이미 있음

export type MonthSessionEntry = {
  dayOfMonth: number;
  sessionIds: string[];
  bodyPartColors: string[];
};

/**
 * 특정 월의 세션 목록 — 캘린더 도트 + 리스트용.
 * @param month 1-indexed (1=Jan, 12=Dec). JS Date는 0-indexed라 내부에서 변환.
 * workout_sets!inner: 세트 0개 세션 제외 (Phase 3.6과 일관).
 * is_primary === true 만 도트로 표시.
 */
export async function fetchSessionsInMonth(
  userId: string,
  year: number,
  month: number,
): Promise<MonthSessionEntry[]> {
  const supabase = await createClient();
  const start = new Date(year, month - 1, 1).toISOString();
  const end = new Date(year, month, 1).toISOString();

  const { data, error } = await supabase
    .from("workout_sessions")
    .select(`
      id,
      started_at,
      workout_sets!inner (
        exercises!inner (
          exercise_body_parts (
            is_primary,
            body_parts ( color )
          )
        )
      )
    `)
    .eq("user_id", userId)
    .gte("started_at", start)
    .lt("started_at", end);

  if (error) throw error;

  type Row = {
    id: string;
    started_at: string;
    workout_sets: Array<{
      exercises: {
        exercise_body_parts: Array<{
          is_primary: boolean | null;
          body_parts: { color: string } | null;
        }>;
      };
    }>;
  };

  const byDay = new Map<number, MonthSessionEntry>();
  for (const row of (data ?? []) as Row[]) {
    const day = new Date(row.started_at).getDate();
    if (!byDay.has(day)) {
      byDay.set(day, { dayOfMonth: day, sessionIds: [], bodyPartColors: [] });
    }
    const entry = byDay.get(day)!;
    if (!entry.sessionIds.includes(row.id)) {
      entry.sessionIds.push(row.id);
    }
    for (const ws of row.workout_sets) {
      for (const ebp of ws.exercises.exercise_body_parts) {
        if (ebp.is_primary === true && ebp.body_parts?.color) {
          if (!entry.bodyPartColors.includes(ebp.body_parts.color)) {
            entry.bodyPartColors.push(ebp.body_parts.color);
          }
        }
      }
    }
  }
  return Array.from(byDay.values()).sort(
    (a, b) => a.dayOfMonth - b.dayOfMonth,
  );
}
```

- [ ] **Step 3.1.2: TypeCheck**

```bash
pnpm tsc --noEmit
```

Expected: 0 errors. Supabase 타입이 join 추론을 못 하면 `as Row[]` cast로 처리됨 (위 코드 그대로).

- [ ] **Step 3.1.3: 커밋 (Dashboard 변경 전 단독 커밋)**

```bash
git add src/lib/queries/sessions.ts
git commit -m "feat(phase-4): fetchSessionsInMonth query — body_parts.color join + is_primary filter"
```

---

### Task 3.2: Dashboard 미니 캘린더 교체

**Files:**
- Modify: `src/app/(app)/dashboard/page.tsx`
- Modify: `src/app/(app)/dashboard/Dashboard.tsx`

- [ ] **Step 3.2.1: 현재 Dashboard 구조 확인**

```bash
cat 'src/app/(app)/dashboard/Dashboard.tsx' | head -60
cat 'src/app/(app)/dashboard/page.tsx'
```

> 현재: `fetchTodaySession`, `fetchWeeklySessionDates`, `fetchRecentExerciseHistory` 3개 쿼리. Dashboard에 weeklyDates: number[] prop.

- [ ] **Step 3.2.2: page.tsx — fetchWeeklySessionDates → fetchSessionsInMonth + transform**

`src/app/(app)/dashboard/page.tsx` 수정:

```typescript
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import {
  fetchTodaySession,
  fetchSessionsInMonth,
} from "@/lib/queries/sessions";
import { fetchRecentExerciseHistory } from "@/lib/queries/sets";
import { Dashboard } from "./Dashboard";
import type { DayEntry } from "@/components/ui/mini-calendar";

export default async function DashboardPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const today = new Date();
  const year = today.getFullYear();
  const month = today.getMonth() + 1; // 1-indexed

  const [todaySession, monthSessions, recentExercises] = await Promise.all([
    fetchTodaySession(user.id),
    fetchSessionsInMonth(user.id, year, month),
    fetchRecentExerciseHistory(user.id, 5),
  ]);

  const dotsByDate: Record<number, DayEntry> = Object.fromEntries(
    monthSessions.map((e) => [
      e.dayOfMonth,
      { bodyPartColors: e.bodyPartColors, sessionIds: e.sessionIds },
    ]),
  );

  return (
    <Dashboard
      todaySession={todaySession}
      year={year}
      month={month}
      todayDayOfMonth={today.getDate()}
      dotsByDate={dotsByDate}
      recentExercises={recentExercises}
    />
  );
}
```

> `fetchWeeklySessionDates` 호출 제거. `weeklyDates`/`todayDayIndex` 더 이상 안 넘김.

- [ ] **Step 3.2.3: Dashboard.tsx Props 변경 + 주간 칩 → MiniCalendar**

`src/app/(app)/dashboard/Dashboard.tsx` 수정:

기존 Props/import 정리:
```diff
- import { DayChip } from "@/components/ui/day-chip";
+ import { MiniCalendar, type DayEntry } from "@/components/ui/mini-calendar";

  // ...

  type Props = {
    todaySession: TodaySession | null;
-   weeklyDates: number[];
+   year: number;
+   month: number;  /* 1-indexed */
+   dotsByDate: Record<number, DayEntry>;
    recentExercises: RecentExercise[];
-   todayDayIndex: number;
+   todayDayOfMonth: number;
  };
```

본문에서 `DAY_LABELS` / `DayChip` 사용처를 MiniCalendar로 교체:

```tsx
// 기존 주간 칩 카드 ↓
- <Card className="p-4">
-   <div className="text-center">
-     {DAY_LABELS.map((_, idx) => (
-       <DayChip
-         key={idx}
-         state={
-           idx === todayDayIndex
-             ? "today"
-             : weeklyDates.includes(idx)
-               ? "done"
-               : "missed"
-         }
-         label={DAY_LABELS[idx]}
-       />
-     ))}
-   </div>
- </Card>

// 신규 미니 캘린더 카드 ↓
+ <Card className="p-4">
+   <MiniCalendar
+     year={year}
+     month={month}
+     todayDayOfMonth={todayDayOfMonth}
+     dotsByDate={dotsByDate}
+     size="sm"
+   />
+ </Card>
```

> 헤더의 날짜/요일 표시(`{DAY_LABELS[todayDayIndex]} · {formatDate(today)}`) 부분에서 todayDayIndex가 더 이상 안 넘어옴. 헤더 표시 — `today.getDay()` 기반 또는 props 추가로 처리. 간단히: Dashboard 본문 안에 `new Date()` 호출은 hydration mismatch 위험. 안전한 방법 — `dayIdx` 계산을 page.tsx에서 해서 prop으로 같이 넘기기:

추가 prop:
```diff
  type Props = {
    todaySession: TodaySession | null;
    year: number;
    month: number;
    dotsByDate: Record<number, DayEntry>;
    recentExercises: RecentExercise[];
    todayDayOfMonth: number;
+   todayDayLabel: string;        // "월" / "화" / ...
+   todayFormatted: string;        // "6월 1일"
  };
```

`page.tsx`에서 계산해서 넘기기:
```typescript
const DAY_LABELS = ["월", "화", "수", "목", "금", "토", "일"];
const todayDayIdx = (today.getDay() + 6) % 7; // 월=0...일=6
const todayDayLabel = DAY_LABELS[todayDayIdx];
const todayFormatted = `${today.getMonth() + 1}월 ${today.getDate()}일`;
```

Dashboard.tsx 헤더에서:
```tsx
<div className="text-label text-accent-strong uppercase">
  {todayDayLabel} · {todayFormatted}
</div>
```

`DAY_LABELS` / `formatDate` / `DayChip` import 제거.

- [ ] **Step 3.2.4: dev 시각 확인**

```bash
pnpm dev
```

브라우저:
1. `/dashboard` 진입 → 주간 칩 7개 자리에 이번 달 미니 캘린더 표시
2. 운동한 날에 부위 색 도트
3. 오늘 날짜에 코랄 border
4. 다크모드 토글 → 도트 saturate/brightness 살짝 톤다운 확인

Ctrl+C.

- [ ] **Step 3.2.5: TypeCheck + lint + 회귀 30 PASS**

```bash
pnpm tsc --noEmit && pnpm lint && pnpm test 2>&1 | tail -10
```

Expected: 0 errors, 30 tests pass.

- [ ] **Step 3.2.6: 커밋**

```bash
git add -A
git commit -m "$(cat <<'EOF'
feat(phase-4): Dashboard weekly chips → MiniCalendar (this month)

- page.tsx: fetchWeeklySessionDates → fetchSessionsInMonth
- transform monthSessions → dotsByDate: Record<dayOfMonth, DayEntry>
- Dashboard.tsx: DayChip 제거, MiniCalendar size="sm" 마운트
- 헤더 todayDayLabel/todayFormatted prop으로 hydration mismatch 차단
EOF
)"
```

---

## Chunk 4: fetchSessionWithDetails + SessionDetailDialog + 클라이언트 wrapper

**목표:** 신규 server 쿼리 + client wrapper + Dialog 컴포넌트. useQuery로 lazy fetch.

### Task 4.1: `fetchSessionWithDetails` server 쿼리

**Files:**
- Modify: `src/lib/queries/sessions.ts`

- [ ] **Step 4.1.1: 타입 + 쿼리 추가**

`src/lib/queries/sessions.ts`에 추가:

```typescript
export type SessionDetail = {
  id: string;
  started_at: string;
  ended_at: string | null;
  bodyParts: Array<{ id: number; name_ko: string; color: string }>;
  exercises: Array<{
    id: string;
    name: string;
    sets: Array<{
      set_number: number;
      weight_kg: number | null;
      reps: number | null;
      parent_set_id: string | null;
    }>;
  }>;
};

export async function fetchSessionWithDetails(
  sessionId: string,
): Promise<SessionDetail | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("workout_sessions")
    .select(`
      id,
      started_at,
      ended_at,
      workout_sets (
        set_number,
        weight_kg,
        reps,
        parent_set_id,
        exercise_id,
        exercises (
          id,
          name,
          exercise_body_parts (
            body_parts ( id, name_ko, color )
          )
        )
      )
    `)
    .eq("id", sessionId)
    .maybeSingle();

  if (error) throw error;
  if (!data) return null;

  type Row = typeof data & {
    workout_sets: Array<{
      set_number: number;
      weight_kg: number | null;
      reps: number | null;
      parent_set_id: string | null;
      exercise_id: string;
      exercises: {
        id: string;
        name: string;
        exercise_body_parts: Array<{
          body_parts: { id: number; name_ko: string; color: string } | null;
        }>;
      };
    }>;
  };

  const row = data as Row;

  // 메인 세트만 (parent_set_id IS NULL)
  const mainSets = row.workout_sets.filter((s) => s.parent_set_id === null);

  // 운동별 group
  const exerciseMap = new Map<
    string,
    { id: string; name: string; sets: SessionDetail["exercises"][number]["sets"] }
  >();
  const bodyPartMap = new Map<number, { id: number; name_ko: string; color: string }>();

  for (const s of mainSets) {
    const ex = s.exercises;
    if (!exerciseMap.has(ex.id)) {
      exerciseMap.set(ex.id, { id: ex.id, name: ex.name, sets: [] });
    }
    exerciseMap.get(ex.id)!.sets.push({
      set_number: s.set_number,
      weight_kg: s.weight_kg,
      reps: s.reps,
      parent_set_id: s.parent_set_id,
    });
    for (const ebp of ex.exercise_body_parts) {
      if (ebp.body_parts && !bodyPartMap.has(ebp.body_parts.id)) {
        bodyPartMap.set(ebp.body_parts.id, ebp.body_parts);
      }
    }
  }

  // 세트 정렬
  for (const ex of exerciseMap.values()) {
    ex.sets.sort((a, b) => a.set_number - b.set_number);
  }

  return {
    id: row.id,
    started_at: row.started_at,
    ended_at: row.ended_at,
    bodyParts: Array.from(bodyPartMap.values()),
    exercises: Array.from(exerciseMap.values()),
  };
}
```

- [ ] **Step 4.1.2: TypeCheck**

```bash
pnpm tsc --noEmit
```

Expected: 0 errors.

---

### Task 4.2: 클라이언트 wrapper

**Files:**
- Create: `src/lib/queries/sessions-client.ts`

- [ ] **Step 4.2.1: 클라이언트 wrapper 작성**

```typescript
// src/lib/queries/sessions-client.ts
"use client";
import { createClient } from "@/lib/supabase/client";
import type { SessionDetail } from "./sessions";

/**
 * SessionDetailDialog용 — 브라우저 supabase client로 lazy fetch.
 * 본인 세션만 RLS로 노출. 서버 fetchSessionWithDetails와 같은 결과 shape.
 */
export async function fetchSessionWithDetailsClient(
  sessionId: string,
): Promise<SessionDetail | null> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("workout_sessions")
    .select(`
      id,
      started_at,
      ended_at,
      workout_sets (
        set_number,
        weight_kg,
        reps,
        parent_set_id,
        exercise_id,
        exercises (
          id,
          name,
          exercise_body_parts (
            body_parts ( id, name_ko, color )
          )
        )
      )
    `)
    .eq("id", sessionId)
    .maybeSingle();

  if (error) throw error;
  if (!data) return null;

  // 서버와 동일한 aggregation. 코드 중복을 줄이려면 lib/queries/session-detail-mapper.ts로 분리도 가능.
  // Plan 4 스코프에서는 inline.
  type Row = typeof data & {
    workout_sets: Array<{
      set_number: number;
      weight_kg: number | null;
      reps: number | null;
      parent_set_id: string | null;
      exercise_id: string;
      exercises: {
        id: string;
        name: string;
        exercise_body_parts: Array<{
          body_parts: { id: number; name_ko: string; color: string } | null;
        }>;
      };
    }>;
  };
  const row = data as Row;
  const mainSets = row.workout_sets.filter((s) => s.parent_set_id === null);

  const exerciseMap = new Map<
    string,
    { id: string; name: string; sets: SessionDetail["exercises"][number]["sets"] }
  >();
  const bodyPartMap = new Map<number, { id: number; name_ko: string; color: string }>();

  for (const s of mainSets) {
    const ex = s.exercises;
    if (!exerciseMap.has(ex.id)) {
      exerciseMap.set(ex.id, { id: ex.id, name: ex.name, sets: [] });
    }
    exerciseMap.get(ex.id)!.sets.push({
      set_number: s.set_number,
      weight_kg: s.weight_kg,
      reps: s.reps,
      parent_set_id: s.parent_set_id,
    });
    for (const ebp of ex.exercise_body_parts) {
      if (ebp.body_parts && !bodyPartMap.has(ebp.body_parts.id)) {
        bodyPartMap.set(ebp.body_parts.id, ebp.body_parts);
      }
    }
  }

  for (const ex of exerciseMap.values()) {
    ex.sets.sort((a, b) => a.set_number - b.set_number);
  }

  return {
    id: row.id,
    started_at: row.started_at,
    ended_at: row.ended_at,
    bodyParts: Array.from(bodyPartMap.values()),
    exercises: Array.from(exerciseMap.values()),
  };
}
```

> 서버/클라 중복 — Phase 4 스코프에서 받아들임. Plan 4.1+에서 mapper 분리 검토.

- [ ] **Step 4.2.2: TypeCheck**

```bash
pnpm tsc --noEmit
```

---

### Task 4.3: SessionDetailDialog 컴포넌트

**Files:**
- Create: `src/components/workout/SessionDetailDialog.tsx`

- [ ] **Step 4.3.1: 컴포넌트 작성**

```tsx
// src/components/workout/SessionDetailDialog.tsx
"use client";
import { useQuery } from "@tanstack/react-query";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { fetchSessionWithDetailsClient } from "@/lib/queries/sessions-client";
import { bodyPartStyle } from "@/lib/workout/body-part-color";

type Props = {
  sessionId: string | null;
  onClose: () => void;
};

function formatDateKo(iso: string): string {
  return new Date(iso).toLocaleString("ko-KR", {
    dateStyle: "long",
    timeStyle: "short",
  });
}

function BodyPartTag({ name, color }: { name: string; color: string }) {
  return (
    <span
      className="px-2 py-0.5 rounded text-caption font-medium text-text dark:saturate-90 dark:brightness-95"
      style={bodyPartStyle(color)}
    >
      {name}
    </span>
  );
}

export function SessionDetailDialog({ sessionId, onClose }: Props) {
  const { data, isLoading, error } = useQuery({
    queryKey: ["session-detail", sessionId],
    queryFn: () => fetchSessionWithDetailsClient(sessionId!),
    enabled: !!sessionId,
  });

  return (
    <Dialog
      open={!!sessionId}
      onOpenChange={(open) => !open && onClose()}
    >
      <DialogContent className="max-w-md lg:max-w-2xl">
        <DialogHeader>
          <DialogTitle>
            {data ? formatDateKo(data.started_at) : "세션 상세"}
          </DialogTitle>
        </DialogHeader>
        {isLoading ? (
          <Skeleton className="h-40" />
        ) : error ? (
          <p className="text-body text-text-muted">
            불러올 수 없어요. 다시 시도해 주세요.
          </p>
        ) : data ? (
          <div className="space-y-3">
            <div className="flex flex-wrap gap-1">
              {data.bodyParts.map((bp) => (
                <BodyPartTag key={bp.id} name={bp.name_ko} color={bp.color} />
              ))}
            </div>
            {data.exercises.map((ex) => (
              <article
                key={ex.id}
                className="rounded-lg border border-border p-3"
              >
                <h3 className="text-h3 font-bold text-text">{ex.name}</h3>
                <div className="text-caption text-text-muted mt-1">
                  {ex.sets.map((s, i) => (
                    <span key={i}>
                      {s.weight_kg ?? "-"}kg × {s.reps ?? "-"}회
                      {i < ex.sets.length - 1 ? " · " : ""}
                    </span>
                  ))}
                </div>
              </article>
            ))}
          </div>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}
```

- [ ] **Step 4.3.2: TypeCheck + lint**

```bash
pnpm tsc --noEmit && pnpm lint
```

Expected: 0 errors.

- [ ] **Step 4.3.3: 커밋**

```bash
git add src/lib/queries/sessions.ts src/lib/queries/sessions-client.ts src/components/workout/SessionDetailDialog.tsx
git commit -m "$(cat <<'EOF'
feat(phase-4): fetchSessionWithDetails + client wrapper + SessionDetailDialog

- Server query joins workout_sessions+sets+exercises+ebp+body_parts (color included)
- Client wrapper mirrors server for useQuery lazy fetch
- SessionDetailDialog: inline formatDateKo + BodyPartTag, weight/reps null guard
- Main sets only (parent_set_id IS NULL); drop sets out of Phase 4 scope
EOF
)"
```

---

## Chunk 5: fetchExerciseProgression + fetchTopExercises + ProgressLine + MultiSeriesChart + ExerciseProgressDialog

**목표:** 차트 영역 일괄. ProgressLine 1~2 tests 추가.

### Task 5.1: `fetchTopExercises` + `fetchExerciseProgression` server 쿼리

**Files:**
- Modify: `src/lib/queries/sessions.ts`

- [ ] **Step 5.1.1: 타입 + 쿼리 2개 추가**

`src/lib/queries/sessions.ts`에 추가:

```typescript
import { estimateOneRepMax, calcSetVolume } from "@/lib/workout/one-rep-max";

export type TopExercise = {
  exerciseId: string;
  exerciseName: string;
  lastUsedAt: string;
  recentSetCount: number;
};

/**
 * 최근 12주 메인 세트 기준 자주 한 운동 N개 — ProgressLine 카드용.
 */
export async function fetchTopExercises(
  userId: string,
  limit: number = 8,
): Promise<TopExercise[]> {
  const supabase = await createClient();
  const cutoff = new Date(
    Date.now() - 12 * 7 * 86_400_000,
  ).toISOString();

  const { data, error } = await supabase
    .from("workout_sets")
    .select(`
      exercise_id,
      created_at,
      exercises!inner ( id, name ),
      workout_sessions!inner ( user_id, started_at )
    `)
    .eq("workout_sessions.user_id", userId)
    .is("parent_set_id", null)
    .gte("workout_sessions.started_at", cutoff);

  if (error) throw error;

  type Row = {
    exercise_id: string;
    created_at: string | null;
    exercises: { id: string; name: string };
    workout_sessions: { user_id: string; started_at: string };
  };

  const map = new Map<
    string,
    { name: string; count: number; lastUsedAt: string }
  >();
  for (const r of (data ?? []) as Row[]) {
    const cur = map.get(r.exercise_id);
    const ts = r.workout_sessions.started_at;
    if (!cur) {
      map.set(r.exercise_id, {
        name: r.exercises.name,
        count: 1,
        lastUsedAt: ts,
      });
    } else {
      cur.count += 1;
      if (ts > cur.lastUsedAt) cur.lastUsedAt = ts;
    }
  }

  return Array.from(map.entries())
    .map(([exerciseId, v]) => ({
      exerciseId,
      exerciseName: v.name,
      lastUsedAt: v.lastUsedAt,
      recentSetCount: v.count,
    }))
    .sort((a, b) => b.recentSetCount - a.recentSetCount)
    .slice(0, limit);
}

export type ProgressionPoint = {
  date: string;        // ISO date string (그 날 첫 세션의 started_at)
  oneRepMax: number;
  volume: number;
  maxWeight: number;
};

/**
 * 운동별 N주 진척 — ExerciseProgressDialog 차트용.
 * 세션 단위로 group: max 1RM, sum volume, max weight.
 * SQL not-null 필터로 NaN 차단.
 */
export async function fetchExerciseProgression(
  userId: string,
  exerciseId: string,
  weeksBack: number = 12,
): Promise<ProgressionPoint[]> {
  const supabase = await createClient();
  const cutoff = new Date(
    Date.now() - weeksBack * 7 * 86_400_000,
  ).toISOString();

  const { data, error } = await supabase
    .from("workout_sets")
    .select(`
      weight_kg,
      reps,
      workout_sessions!inner ( id, user_id, started_at )
    `)
    .eq("exercise_id", exerciseId)
    .eq("workout_sessions.user_id", userId)
    .is("parent_set_id", null)
    .not("weight_kg", "is", null)
    .not("reps", "is", null)
    .gte("workout_sessions.started_at", cutoff);

  if (error) throw error;

  type Row = {
    weight_kg: number | null;
    reps: number | null;
    workout_sessions: { id: string; user_id: string; started_at: string };
  };

  // 세션 단위 group
  const bySession = new Map<
    string,
    { date: string; sets: Array<{ w: number; r: number }> }
  >();
  for (const r of (data ?? []) as Row[]) {
    const sid = r.workout_sessions.id;
    if (!bySession.has(sid)) {
      bySession.set(sid, {
        date: r.workout_sessions.started_at,
        sets: [],
      });
    }
    // not-null 필터로 이미 걸렀지만 TS narrowing
    if (r.weight_kg != null && r.reps != null) {
      bySession.get(sid)!.sets.push({ w: r.weight_kg, r: r.reps });
    }
  }

  const points: ProgressionPoint[] = Array.from(bySession.values()).map(
    (sess) => {
      const oneRepMaxValues = sess.sets.map((s) =>
        estimateOneRepMax(s.w, s.r),
      );
      const volumes = sess.sets.map((s) => calcSetVolume(s.w, s.r));
      const weights = sess.sets.map((s) => s.w);
      return {
        date: sess.date,
        oneRepMax: Math.max(0, ...oneRepMaxValues),
        volume: volumes.reduce((sum, v) => sum + v, 0),
        maxWeight: Math.max(0, ...weights),
      };
    },
  );

  return points.sort((a, b) => (a.date < b.date ? -1 : 1));
}
```

- [ ] **Step 5.1.2: TypeCheck**

```bash
pnpm tsc --noEmit
```

---

### Task 5.2: 클라이언트 wrapper

**Files:**
- Modify: `src/lib/queries/sessions-client.ts`

- [ ] **Step 5.2.1: `fetchExerciseProgressionClient` 추가**

`src/lib/queries/sessions-client.ts` 끝에:

```typescript
import type { ProgressionPoint } from "./sessions";
import { estimateOneRepMax, calcSetVolume } from "@/lib/workout/one-rep-max";

export async function fetchExerciseProgressionClient(
  exerciseId: string,
  weeksBack: number = 12,
): Promise<ProgressionPoint[]> {
  const supabase = createClient();
  const cutoff = new Date(
    Date.now() - weeksBack * 7 * 86_400_000,
  ).toISOString();
  // 본인 user_id는 RLS가 자동 필터 (browser client + auth.uid())

  const { data, error } = await supabase
    .from("workout_sets")
    .select(`
      weight_kg,
      reps,
      workout_sessions!inner ( id, started_at )
    `)
    .eq("exercise_id", exerciseId)
    .is("parent_set_id", null)
    .not("weight_kg", "is", null)
    .not("reps", "is", null)
    .gte("workout_sessions.started_at", cutoff);

  if (error) throw error;

  type Row = {
    weight_kg: number | null;
    reps: number | null;
    workout_sessions: { id: string; started_at: string };
  };

  const bySession = new Map<
    string,
    { date: string; sets: Array<{ w: number; r: number }> }
  >();
  for (const r of (data ?? []) as Row[]) {
    const sid = r.workout_sessions.id;
    if (!bySession.has(sid)) {
      bySession.set(sid, {
        date: r.workout_sessions.started_at,
        sets: [],
      });
    }
    if (r.weight_kg != null && r.reps != null) {
      bySession.get(sid)!.sets.push({ w: r.weight_kg, r: r.reps });
    }
  }

  return Array.from(bySession.values())
    .map((sess) => ({
      date: sess.date,
      oneRepMax: Math.max(0, ...sess.sets.map((s) => estimateOneRepMax(s.w, s.r))),
      volume: sess.sets.reduce((sum, s) => sum + calcSetVolume(s.w, s.r), 0),
      maxWeight: Math.max(0, ...sess.sets.map((s) => s.w)),
    }))
    .sort((a, b) => (a.date < b.date ? -1 : 1));
}
```

- [ ] **Step 5.2.2: TypeCheck**

```bash
pnpm tsc --noEmit
```

---

### Task 5.3: ProgressLine + 단위 테스트

**Files:**
- Create: `src/components/charts/ProgressLine.tsx`
- Create: `tests/components/charts/progress-line.test.tsx`

- [ ] **Step 5.3.1: 단위 테스트 (RED)**

```tsx
// tests/components/charts/progress-line.test.tsx
import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { ProgressLine } from "@/components/charts/ProgressLine";

// recharts ResponsiveContainer가 jsdom 0×0 이슈 → mock
vi.mock("recharts", () => ({
  LineChart: ({ children }: { children: React.ReactNode }) => <div data-testid="line-chart">{children}</div>,
  Line: () => <div data-testid="line" />,
  ResponsiveContainer: ({ children }: { children: React.ReactNode }) => <div data-testid="rc">{children}</div>,
}));

describe("ProgressLine", () => {
  it("데이터 2개 미만이면 '기록 부족' 메시지 표시", () => {
    render(
      <ProgressLine
        exerciseId="ex1"
        exerciseName="벤치프레스"
        data={[{ date: "2026-05-01", oneRepMax: 80 }]}
      />,
    );
    expect(screen.getByText(/기록 부족/)).toBeTruthy();
  });

  it("데이터 2개 이상이면 최신값 + 증감 표시 + 클릭 시 onClick 호출", () => {
    const onClick = vi.fn();
    render(
      <ProgressLine
        exerciseId="ex1"
        exerciseName="벤치프레스"
        data={[
          { date: "2026-04-01", oneRepMax: 70 },
          { date: "2026-05-01", oneRepMax: 82 },
        ]}
        onClick={onClick}
      />,
    );
    // 최신 82kg
    expect(screen.getByText(/82kg/)).toBeTruthy();
    // 증감 +12
    expect(screen.getByText(/\+12kg/)).toBeTruthy();
    // 클릭
    fireEvent.click(screen.getByRole("button"));
    expect(onClick).toHaveBeenCalledWith("ex1");
  });
});
```

- [ ] **Step 5.3.2: RED 확인**

```bash
pnpm vitest run tests/components/charts/progress-line.test.tsx
```

Expected: 모듈 없음 에러.

- [ ] **Step 5.3.3: ProgressLine 구현 (GREEN)**

```tsx
// src/components/charts/ProgressLine.tsx
"use client";
import { LineChart, Line, ResponsiveContainer } from "recharts";

type Props = {
  exerciseId: string;
  exerciseName: string;
  data: Array<{ date: string; oneRepMax: number }>;
  onClick?: (exerciseId: string) => void;
};

export function ProgressLine({ exerciseId, exerciseName, data, onClick }: Props) {
  if (data.length < 2) {
    return (
      <div className="p-3 rounded-lg border border-border bg-surface">
        <div className="text-h3 font-bold text-text">{exerciseName}</div>
        <div className="text-caption text-text-muted mt-1">
          기록 부족 — 2회 이상 기록 후 추이가 나타나요
        </div>
      </div>
    );
  }

  const latest = data[data.length - 1].oneRepMax;
  const earliest = data[0].oneRepMax;
  const delta = Math.round((latest - earliest) * 10) / 10;
  const deltaSign = delta >= 0 ? "+" : "";

  return (
    <button
      type="button"
      onClick={() => onClick?.(exerciseId)}
      className="w-full text-left p-3 rounded-lg border border-border bg-surface hover:bg-accent-soft transition-colors"
    >
      <span className="block text-h3 font-bold text-text">{exerciseName}</span>
      <span className="block text-caption text-text-muted">1RM 추이 (12주)</span>
      <span className="block h-16 mt-2">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data}>
            <Line
              dataKey="oneRepMax"
              stroke="var(--color-accent)"
              strokeWidth={2}
              dot={false}
            />
          </LineChart>
        </ResponsiveContainer>
      </span>
      <span className="block text-caption mt-1 text-text">
        {latest}kg · {deltaSign}{delta}kg
      </span>
    </button>
  );
}
```

- [ ] **Step 5.3.4: GREEN 확인**

```bash
pnpm vitest run tests/components/charts/progress-line.test.tsx
```

Expected: 2 passed.

---

### Task 5.4: MultiSeriesChart

**Files:**
- Create: `src/components/charts/MultiSeriesChart.tsx`

- [ ] **Step 5.4.1: 컴포넌트 작성**

```tsx
// src/components/charts/MultiSeriesChart.tsx
"use client";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  ResponsiveContainer,
  Legend,
} from "recharts";

type Props = {
  data: Array<{ date: string; oneRepMax: number; volume: number }>;
};

function formatDateShort(iso: string): string {
  const d = new Date(iso);
  return `${d.getMonth() + 1}/${d.getDate()}`;
}

export function MultiSeriesChart({ data }: Props) {
  const formatted = data.map((d) => ({
    ...d,
    dateLabel: formatDateShort(d.date),
  }));

  return (
    <div className="h-64 lg:h-80">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart
          data={formatted}
          margin={{ top: 8, right: 16, left: 0, bottom: 0 }}
        >
          <CartesianGrid
            stroke="var(--color-border)"
            strokeDasharray="2 2"
            vertical={false}
          />
          <XAxis
            dataKey="dateLabel"
            tick={{ fontSize: 10, fill: "var(--color-text-muted)" }}
          />
          <YAxis
            yAxisId="left"
            tick={{ fontSize: 10, fill: "var(--color-text-muted)" }}
          />
          <YAxis
            yAxisId="right"
            orientation="right"
            tick={{ fontSize: 10, fill: "var(--color-text-muted)" }}
          />
          <Tooltip
            contentStyle={{
              background: "var(--color-surface)",
              border: "1px solid var(--color-border)",
              borderRadius: 8,
              fontSize: 12,
            }}
          />
          <Legend wrapperStyle={{ fontSize: 11 }} />
          <Line
            yAxisId="left"
            dataKey="oneRepMax"
            stroke="var(--color-accent)"
            strokeWidth={2}
            name="1RM (kg)"
            dot={{ r: 3 }}
          />
          <Line
            yAxisId="right"
            dataKey="volume"
            stroke="var(--color-accent-strong)"
            strokeWidth={2}
            strokeDasharray="4 2"
            name="볼륨 (kg)"
            dot={false}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
```

- [ ] **Step 5.4.2: TypeCheck**

```bash
pnpm tsc --noEmit
```

---

### Task 5.5: ExerciseProgressDialog

**Files:**
- Create: `src/components/workout/ExerciseProgressDialog.tsx`

- [ ] **Step 5.5.1: 컴포넌트 작성**

```tsx
// src/components/workout/ExerciseProgressDialog.tsx
"use client";
import { useQuery } from "@tanstack/react-query";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { MultiSeriesChart } from "@/components/charts/MultiSeriesChart";
import { fetchExerciseProgressionClient } from "@/lib/queries/sessions-client";

type Props = {
  exerciseId: string | null;
  exerciseName: string;
  onClose: () => void;
};

export function ExerciseProgressDialog({
  exerciseId,
  exerciseName,
  onClose,
}: Props) {
  const { data, isLoading, error } = useQuery({
    queryKey: ["exercise-progression", exerciseId],
    queryFn: () => fetchExerciseProgressionClient(exerciseId!, 12),
    enabled: !!exerciseId,
  });

  return (
    <Dialog
      open={!!exerciseId}
      onOpenChange={(open) => !open && onClose()}
    >
      <DialogContent className="max-w-md lg:max-w-3xl">
        <DialogHeader>
          <DialogTitle>{exerciseName}</DialogTitle>
        </DialogHeader>
        {isLoading ? (
          <Skeleton className="h-64" />
        ) : error ? (
          <p className="text-body text-text-muted">차트를 불러올 수 없어요.</p>
        ) : data && data.length >= 2 ? (
          <MultiSeriesChart data={data} />
        ) : (
          <p className="text-body text-text-muted">
            아직 기록이 부족해요. 2회 이상 기록 후 다시 봐주세요.
          </p>
        )}
      </DialogContent>
    </Dialog>
  );
}
```

- [ ] **Step 5.5.2: TypeCheck + lint + 회귀 32 PASS**

```bash
pnpm tsc --noEmit && pnpm lint && pnpm test 2>&1 | tail -10
```

Expected: 0 errors, 32 tests pass (30 + 2 progress-line).

- [ ] **Step 5.5.3: 커밋**

```bash
git add -A
git commit -m "$(cat <<'EOF'
feat(phase-4): charts pipeline — progression query + ProgressLine + MultiSeriesChart + ExerciseProgressDialog

- fetchTopExercises (12주 메인 세트 count desc, top N)
- fetchExerciseProgression (SQL not-null 필터 + session group + 1RM/volume/maxWeight)
- Client wrapper for useQuery lazy fetch
- ProgressLine recharts mini line + 증감 표시 + 2 tests
- MultiSeriesChart dual-axis 1RM + volume
- ExerciseProgressDialog lazy fetch + skeleton + empty state
EOF
)"
```

---

## Chunk 6: /history page + HistoryView (탭 + 월 navigation + 모달 트리거)

**목표:** `/history` RSC + 클라이언트 HistoryView. URL `?y&m` 1-indexed, safe range. 캘린더 + 리스트 탭 + ProgressLine 카드 + 모달 2개.

### Task 6.1: /history page.tsx RSC

**Files:**
- Modify: `src/app/(app)/history/page.tsx`

- [ ] **Step 6.1.1: 기존 page.tsx 백업 확인 후 재작성**

```bash
cat 'src/app/(app)/history/page.tsx'
```

- [ ] **Step 6.1.2: 새 page.tsx**

```tsx
// src/app/(app)/history/page.tsx
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import {
  fetchSessionsInMonth,
  fetchTopExercises,
} from "@/lib/queries/sessions";
import { HistoryView } from "./HistoryView";

type PageProps = {
  searchParams: Promise<{ y?: string; m?: string }>;
};

export default async function HistoryPage({ searchParams }: PageProps) {
  const { y, m } = await searchParams;
  const today = new Date();

  const yearInput = y ? Number(y) : today.getFullYear();
  const monthInput = m !== undefined ? Number(m) : today.getMonth() + 1;

  // 범위 검증 — 잘못된 값은 오늘 달로 fallback
  const safeYear =
    Number.isFinite(yearInput) && yearInput >= 2000 && yearInput <= 2100
      ? yearInput
      : today.getFullYear();
  const safeMonth =
    Number.isFinite(monthInput) && monthInput >= 1 && monthInput <= 12
      ? monthInput
      : today.getMonth() + 1;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const [monthSessions, topExercises] = await Promise.all([
    fetchSessionsInMonth(user.id, safeYear, safeMonth),
    fetchTopExercises(user.id, 8),
  ]);

  const isCurrentMonth =
    today.getMonth() + 1 === safeMonth && today.getFullYear() === safeYear;

  return (
    <main className="p-5 max-w-md lg:max-w-5xl mx-auto pb-32 lg:pb-5">
      <h1 className="text-display font-extrabold text-text">기록</h1>
      <HistoryView
        year={safeYear}
        month={safeMonth}
        todayDayOfMonth={isCurrentMonth ? today.getDate() : undefined}
        monthSessions={monthSessions}
        topExercises={topExercises}
      />
    </main>
  );
}
```

- [ ] **Step 6.1.3: TypeCheck**

```bash
pnpm tsc --noEmit
```

---

### Task 6.2: HistoryView 클라이언트

**Files:**
- Create: `src/app/(app)/history/HistoryView.tsx`

- [ ] **Step 6.2.1: HistoryView 작성**

```tsx
// src/app/(app)/history/HistoryView.tsx
"use client";
import { useState, useMemo, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ChevronLeft, ChevronRight, CalendarDays, List } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  MiniCalendar,
  type DayEntry,
} from "@/components/ui/mini-calendar";
import { ProgressLine } from "@/components/charts/ProgressLine";
import { SessionDetailDialog } from "@/components/workout/SessionDetailDialog";
import { ExerciseProgressDialog } from "@/components/workout/ExerciseProgressDialog";
import { useQuery } from "@tanstack/react-query";
import { fetchExerciseProgressionClient } from "@/lib/queries/sessions-client";
import type {
  MonthSessionEntry,
  TopExercise,
} from "@/lib/queries/sessions";

type Props = {
  year: number;
  month: number; // 1-indexed
  todayDayOfMonth?: number;
  monthSessions: MonthSessionEntry[];
  topExercises: TopExercise[];
};

const MONTH_NAMES = ["1월","2월","3월","4월","5월","6월","7월","8월","9월","10월","11월","12월"];

export function HistoryView({
  year,
  month,
  todayDayOfMonth,
  monthSessions,
  topExercises,
}: Props) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [viewMode, setViewMode] = useState<"calendar" | "list">("calendar");
  const [selectedSessionId, setSelectedSessionId] = useState<string | null>(null);
  const [selectedExercise, setSelectedExercise] = useState<{
    id: string;
    name: string;
  } | null>(null);

  // monthSessions → dotsByDate
  const dotsByDate = useMemo<Record<number, DayEntry>>(
    () =>
      Object.fromEntries(
        monthSessions.map((e) => [
          e.dayOfMonth,
          { bodyPartColors: e.bodyPartColors, sessionIds: e.sessionIds },
        ]),
      ),
    [monthSessions],
  );

  const goMonth = (deltaMonths: number) => {
    let y = year;
    let m = month + deltaMonths;
    if (m < 1) {
      m += 12;
      y -= 1;
    } else if (m > 12) {
      m -= 12;
      y += 1;
    }
    startTransition(() => {
      router.push(`/history?y=${y}&m=${m}`, { scroll: false });
    });
  };
  const goToday = () => {
    startTransition(() => {
      router.push("/history", { scroll: false });
    });
  };

  // 리스트 탭: monthSessions를 시간 desc로 정렬해 카드 형태로 표시
  const sortedSessions = useMemo(
    () => [...monthSessions].sort((a, b) => b.dayOfMonth - a.dayOfMonth),
    [monthSessions],
  );

  return (
    <div className="mt-5 space-y-4">
      {/* 월 navigation */}
      <div className="flex items-center justify-between">
        <Button
          variant="ghost"
          size="icon"
          onClick={() => goMonth(-1)}
          aria-label="이전 달"
        >
          <ChevronLeft className="w-5 h-5" />
        </Button>
        <div className="text-h3 font-bold text-text">
          {year}년 {MONTH_NAMES[month - 1]}
        </div>
        <div className="flex gap-1">
          <Button
            variant="ghost"
            size="sm"
            onClick={goToday}
            disabled={!!todayDayOfMonth}
          >
            오늘
          </Button>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => goMonth(1)}
            aria-label="다음 달"
          >
            <ChevronRight className="w-5 h-5" />
          </Button>
        </div>
      </div>

      {/* 탭 */}
      <div className="flex gap-2 border-b border-border">
        <button
          type="button"
          onClick={() => setViewMode("calendar")}
          className={cn(
            "px-3 py-2 text-body flex items-center gap-1",
            viewMode === "calendar"
              ? "border-b-2 border-accent text-accent font-semibold"
              : "text-text-muted",
          )}
        >
          <CalendarDays className="w-4 h-4" /> 캘린더
        </button>
        <button
          type="button"
          onClick={() => setViewMode("list")}
          className={cn(
            "px-3 py-2 text-body flex items-center gap-1",
            viewMode === "list"
              ? "border-b-2 border-accent text-accent font-semibold"
              : "text-text-muted",
          )}
        >
          <List className="w-4 h-4" /> 리스트
        </button>
      </div>

      {/* 캘린더 또는 리스트 */}
      <div className={cn("transition-opacity", isPending && "opacity-60")}>
        {viewMode === "calendar" ? (
          monthSessions.length === 0 ? (
            <p className="text-body text-text-muted py-12 text-center">
              이 달엔 기록이 없어요.
            </p>
          ) : (
            <MiniCalendar
              year={year}
              month={month}
              todayDayOfMonth={todayDayOfMonth}
              dotsByDate={dotsByDate}
              onDateClick={(sessionId) => setSelectedSessionId(sessionId)}
              size="md"
            />
          )
        ) : sortedSessions.length === 0 ? (
          <p className="text-body text-text-muted py-12 text-center">
            이 달엔 기록이 없어요.
          </p>
        ) : (
          <ul className="space-y-2 lg:grid lg:grid-cols-2 lg:gap-3 lg:space-y-0">
            {sortedSessions.map((s) => (
              <li key={s.sessionIds[0]}>
                <button
                  type="button"
                  onClick={() => setSelectedSessionId(s.sessionIds[0])}
                  className="w-full text-left rounded-xl border border-border p-4 bg-surface hover:bg-accent-soft transition-colors"
                >
                  <div className="text-caption text-text-muted">
                    {month}월 {s.dayOfMonth}일
                  </div>
                  <div className="text-body font-bold text-text mt-1">
                    부위 {s.bodyPartColors.length}개 ·
                    {s.sessionIds.length > 1 ? ` 세션 ${s.sessionIds.length}개` : " 세션 1개"}
                  </div>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* ProgressLine 카드 영역 */}
      <section className="mt-8">
        <h2 className="text-h3 font-bold text-text mb-3">운동별 추이</h2>
        {topExercises.length === 0 ? (
          <p className="text-body text-text-muted">
            아직 추이를 보여줄 운동이 없어요. 헬스장에서 더 채워보세요.
          </p>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
            {topExercises.map((ex) => (
              <ExerciseProgressCard
                key={ex.exerciseId}
                exercise={ex}
                onClick={(id) =>
                  setSelectedExercise({ id, name: ex.exerciseName })
                }
              />
            ))}
          </div>
        )}
      </section>

      {/* 모달 2개 */}
      <SessionDetailDialog
        sessionId={selectedSessionId}
        onClose={() => setSelectedSessionId(null)}
      />
      <ExerciseProgressDialog
        exerciseId={selectedExercise?.id ?? null}
        exerciseName={selectedExercise?.name ?? ""}
        onClose={() => setSelectedExercise(null)}
      />
    </div>
  );
}

/**
 * 카드별로 ProgressLine 데이터 fetch — 운동 8개 × 동시 호출.
 * staleTime 5분으로 페이지 재방문 시 캐시 활용.
 */
function ExerciseProgressCard({
  exercise,
  onClick,
}: {
  exercise: TopExercise;
  onClick: (id: string) => void;
}) {
  const { data } = useQuery({
    queryKey: ["exercise-progression", exercise.exerciseId, 12],
    queryFn: () =>
      fetchExerciseProgressionClient(exercise.exerciseId, 12),
    staleTime: 5 * 60_000,
  });
  return (
    <ProgressLine
      exerciseId={exercise.exerciseId}
      exerciseName={exercise.exerciseName}
      data={(data ?? []).map((p) => ({
        date: p.date,
        oneRepMax: p.oneRepMax,
      }))}
      onClick={onClick}
    />
  );
}
```

- [ ] **Step 6.2.2: dev 시각 확인**

```bash
pnpm dev
```

브라우저:
1. `/history` → 6월 캘린더 + 오늘 표시 + 도트
2. 이전 달 버튼 → URL `?y=2026&m=5` → 5월 데이터
3. 오늘 버튼 → `/history` (current month)
4. 캘린더 ↔ 리스트 탭 전환
5. 날짜 클릭 → SessionDetailDialog 열림 → 운동/세트 표시
6. ProgressLine 카드 N개 → 클릭 → ExerciseProgressDialog → MultiSeriesChart
7. 다크모드에서도 정상

Ctrl+C.

- [ ] **Step 6.2.3: TypeCheck + lint + 회귀 32 PASS**

```bash
pnpm tsc --noEmit && pnpm lint && pnpm test 2>&1 | tail -10
```

- [ ] **Step 6.2.4: 커밋**

```bash
git add -A
git commit -m "$(cat <<'EOF'
feat(phase-4): /history page + HistoryView client — calendar/list tabs + dialogs

- page.tsx: URL ?y&m (m 1-indexed), safeYear/safeMonth fallback, RSC fetches
- HistoryView: useTransition month nav, calendar/list tabs, ProgressLine cards
- Both tabs use same monthSessions data (time-range consistency)
- SessionDetailDialog + ExerciseProgressDialog wiring
- ExerciseProgressCard per-card useQuery with 5min staleTime
EOF
)"
```

---

## Chunk 7: R4 — ExerciseRecCard + StartForm 체크박스 + finishSession revalidate

**목표:** /workout/new 추천 카드에 base-ui Checkbox + excludedExerciseIds wiring. `finishSession`에 `revalidatePath('/history')` 추가.

### Task 7.1: ExerciseRecCard 분리

**Files:**
- Create: `src/app/(app)/workout/new/ExerciseRecCard.tsx`

- [ ] **Step 7.1.1: 컴포넌트 작성**

```tsx
// src/app/(app)/workout/new/ExerciseRecCard.tsx
"use client";
import { Card } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { cn } from "@/lib/utils";
import type { ExerciseWithBodyParts } from "@/lib/queries/exercises";

type Props = {
  exercise: ExerciseWithBodyParts;
  included: boolean;
  onToggle: (exerciseId: string, included: boolean) => void;
};

export function ExerciseRecCard({ exercise, included, onToggle }: Props) {
  return (
    <Card
      className={cn(
        "p-3 flex items-center gap-3 transition-opacity",
        !included && "opacity-50",
      )}
    >
      <Checkbox
        id={`rec-${exercise.id}`}
        checked={included}
        onCheckedChange={(checked) => onToggle(exercise.id, checked)}
        aria-label={`${exercise.name} ${included ? "제외하기" : "다시 포함하기"}`}
      />
      <label
        htmlFor={`rec-${exercise.id}`}
        className="flex-1 cursor-pointer"
      >
        <div className="text-body font-semibold text-text">{exercise.name}</div>
        <div className="text-caption text-text-muted">
          기본 {exercise.default_sets ?? 3}세트
          {exercise.default_reps_min && exercise.default_reps_max
            ? ` · ${exercise.default_reps_min}~${exercise.default_reps_max}회`
            : ""}
        </div>
      </label>
    </Card>
  );
}
```

> base-ui Checkbox `onCheckedChange: (checked: boolean) => void` (Radix의 'indeterminate' 분기 없음).

---

### Task 7.2: StartForm 체크박스 wiring

**Files:**
- Modify: `src/app/(app)/workout/new/StartForm.tsx`

- [ ] **Step 7.2.1: StartForm 현재 상태 확인**

```bash
cat 'src/app/(app)/workout/new/StartForm.tsx' | head -100
```

> 현재: `recommendations.map((r) => ...)` 부분에 추천 카드 inline 렌더링. ExerciseRecCard로 교체.

- [ ] **Step 7.2.2: state + 토글 핸들러 추가**

import 추가:
```tsx
import { useCallback } from "react";
import { ExerciseRecCard } from "./ExerciseRecCard";
```

state 추가 (기존 useState들 옆에):
```tsx
const [excludedExerciseIds, setExcludedExerciseIds] = useState<Set<string>>(
  new Set(),
);
```

토글 핸들러:
```tsx
const toggleInclude = useCallback((exId: string, included: boolean) => {
  setExcludedExerciseIds((prev) => {
    const next = new Set(prev);
    if (included) next.delete(exId);
    else next.add(exId);
    return next;
  });
}, []);
```

`toggleBP` 안에서 reset 추가:
```tsx
const toggleBP = (id: number) => {
  setSelectedBP((prev) => {
    const next = new Set(prev);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    return next;
  });
  setShowRecommendations(false);
  setExcludedExerciseIds(new Set()); /* NEW: 부위 바뀌면 추천도 새로 — excluded 초기화 */
};
```

활성 운동 ID 계산:
```tsx
const recommendedExerciseIds = useMemo(
  () =>
    recommendations
      .map((r) => r.exerciseId)
      .filter((id) => !excludedExerciseIds.has(id)),
  [recommendations, excludedExerciseIds],
);
```

- [ ] **Step 7.2.3: 추천 렌더 부분 ExerciseRecCard로 교체**

기존:
```tsx
- <ul className="space-y-2">
-   {recommendations.map((r) => {
-     const ex = exerciseById.get(r.exerciseId);
-     if (!ex) return null;
-     return (
-       <li key={r.exerciseId} className="rounded-md border p-3 text-sm">
-         <div className="font-medium">{ex.name}</div>
-         {/* ... default_sets info ... */}
-       </li>
-     );
-   })}
- </ul>

+ <ul className="space-y-2">
+   {recommendations.map((r) => {
+     const ex = exerciseById.get(r.exerciseId);
+     if (!ex) return null;
+     return (
+       <li key={r.exerciseId}>
+         <ExerciseRecCard
+           exercise={ex}
+           included={!excludedExerciseIds.has(r.exerciseId)}
+           onToggle={toggleInclude}
+         />
+       </li>
+     );
+   })}
+ </ul>
```

- [ ] **Step 7.2.4: 운동 시작 버튼 — 카운트 표시 + 0 가드**

기존 `handleStart` — `recommendations.map((r) => r.exerciseId)` 대신 `recommendedExerciseIds`:

```tsx
const handleStart = () => {
  startTransition(async () => {
    const result = await startSession({
      bodyPartIds: [...selectedBP],
      recommendedExerciseIds, /* 제외 적용된 리스트 */
      templateId: null,
    });
    if (result && result.ok === false) {
      toast.error(result.error);
    }
  });
};
```

운동 시작 버튼:
```tsx
<Button
  type="button"
  className="w-full"
  disabled={
    isPending ||
    selectedBP.size === 0 ||
    !showRecommendations ||
    recommendedExerciseIds.length === 0
  }
  onClick={handleStart}
>
  {isPending
    ? "시작 중..."
    : `운동 시작 (${recommendedExerciseIds.length})`}
</Button>
```

- [ ] **Step 7.2.5: dev 시각 확인**

```bash
pnpm dev
```

브라우저:
1. `/workout/new` → 부위 2개 선택 → 추천 보기
2. 추천 카드 N개에 체크박스 (다 체크된 상태)
3. 하나 해제 → 카드 opacity 50% + "운동 시작 (N-1)"로 카운트 감소
4. 부위 chip 다른 부위로 토글 → 추천 새로 + excluded 초기화
5. 모두 해제 → 운동 시작 버튼 disabled
6. 운동 시작 → 제외된 운동 빼고 세션 생성 (Supabase Studio에서 workout_sets 확인)

Ctrl+C.

- [ ] **Step 7.2.6: TypeCheck + lint**

```bash
pnpm tsc --noEmit && pnpm lint
```

Expected: 0 errors.

---

### Task 7.3: finishSession revalidatePath('/history') 추가

**Files:**
- Modify: `src/app/(app)/workout/actions.ts`

- [ ] **Step 7.3.1: 현재 finishSession 확인**

```bash
grep -A 15 "export async function finishSession" 'src/app/(app)/workout/actions.ts'
```

> 현재: `revalidatePath("/dashboard")` 1줄만. `redirect("/dashboard")` 호출.

- [ ] **Step 7.3.2: revalidatePath('/history') 추가**

```diff
  revalidatePath("/dashboard");
+ revalidatePath("/history");
  redirect("/dashboard");
```

- [ ] **Step 7.3.3: TypeCheck + lint + 회귀 32 PASS**

```bash
pnpm tsc --noEmit && pnpm lint && pnpm test 2>&1 | tail -10
```

- [ ] **Step 7.3.4: 커밋**

```bash
git add -A
git commit -m "$(cat <<'EOF'
feat(phase-4): R4 추천 운동 제외 체크박스 + finishSession /history 갱신

- ExerciseRecCard: base-ui Checkbox + label, included=false 시 opacity-50
- StartForm: excludedExerciseIds Set, toggleInclude, toggleBP에서 reset
- recommendedExerciseIds = recommendations - excluded
- 운동 시작 버튼: 카운트 표시, 0개일 때 disabled
- finishSession: revalidatePath('/history') 추가 (캐시 stale 차단)
EOF
)"
```

---

## Chunk 8: Verification + PR + Merge + Tag

### Task 8.1: 빌드 + 회귀 + 로그

- [ ] **Step 8.1.1: 프로덕션 빌드**

```bash
pnpm build 2>&1 | tail -25
```

Expected: 0 errors. 라우트 변동 없음 (history 이미 존재, /workout/new도 그대로).

- [ ] **Step 8.1.2: 전체 회귀 (32 PASS 예상)**

```bash
pnpm test 2>&1 | tail -10
```

Expected: 22 기존 + 6 (one-rep-max) + 2 (mini-calendar) + 2 (progress-line) = 32 tests pass / 11+ files.

- [ ] **Step 8.1.3: 완료 로그 작성**

```bash
cat > docs/import/history-charts-log.md <<'EOF'
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

- pnpm build ✓ (Next.js 16 Turbopack, recharts 18kB gzip 추가)
- 라우트 변동 없음, hydration warning 0

## Manual E2E

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
EOF
```

- [ ] **Step 8.1.4: 로그 커밋**

```bash
git add docs/import/history-charts-log.md
git commit -m "docs(phase-4): completion log"
```

---

### Task 8.2: PR + 머지 + 태그

- [ ] **Step 8.2.1: 푸시 + PR 생성**

```bash
git push -u origin feat/phase-4-history-charts
gh pr create --title "Phase 4: History + Charts + Exclude Recommendation" --body "$(cat <<'EOF'
## Summary

Phase 3.6 머지 후 1RM 추이 차트 + 캘린더 시각화 + R4(추천 운동 제외) 추가.

## Scope

- ✅ 대시보드 미니 캘린더 (주간 칩 대체, body_parts.color 직접 사용)
- ✅ /history 풀 캘린더 + 카드 리스트 탭 + 월 navigation
- ✅ SessionDetailDialog (운동 N개 + 세트 + 부위 태그)
- ✅ ProgressLine 미니 라인 카드 (1RM Epley) + ExerciseProgressDialog (1RM + 볼륨 듀얼)
- ✅ R4 체크박스 — 추천에서 운동 개별 제외
- ✅ finishSession revalidatePath('/history') (캐시 stale 차단)

## Out of Scope (Plan 4.1+)

차트 zoom/tooltip 상세, PR 자동 감지, 다중 세션 picker, drag&drop, magic link

## Verification

- ✅ pnpm tsc --noEmit → 0 errors
- ✅ pnpm lint → 0 errors
- ✅ pnpm test → 32 passed (11+ files)
- ✅ pnpm build → 0 errors, recharts 18kB gzip 추가
- ✅ Manual E2E: 대시보드/캘린더/리스트/차트/R4 모두 동작

Plan: docs/plans/2026-06-01-phase-4-history-charts.md
Spec: docs/specs/2026-06-01-phase-4-history-charts-design.md (v3)
Log: docs/import/history-charts-log.md
EOF
)"
```

- [ ] **Step 8.2.2: PR 머지 + 브랜치 삭제**

```bash
PR_NUMBER=$(gh pr list --head feat/phase-4-history-charts --json number --jq '.[0].number')
gh pr merge $PR_NUMBER --merge --delete-branch
```

- [ ] **Step 8.2.3: main 동기화 + 태그**

```bash
git checkout main && git pull --ff-only
MERGE_COMMIT=$(git log --merges --grep="phase-4-history-charts" -n 1 --format=%H)
git tag v0.4.0-history-charts $MERGE_COMMIT
git push origin v0.4.0-history-charts
```

- [ ] **Step 8.2.4: 완료 보고**

사용자에게 제공:
- PR URL
- 머지 commit SHA
- 태그 `v0.4.0-history-charts`
- 다음 단계: 1주일 실사용 후 피드백 → Plan 4.1 또는 Plan 5

---

## Risks & Mitigations

| 리스크 | 영향 | 완화 |
|---|---|---|
| recharts ResponsiveContainer jsdom 0×0 | 중간 | ProgressLine 테스트에서 `vi.mock('recharts')` stub. 차트 렌더링은 manual E2E. |
| Supabase 타입이 join 추론 못함 → as cast | 낮음 | `as Row[]` 명시 cast로 처리. Phase 3.6과 동일 패턴. |
| body_parts.color hex가 다크모드에서 너무 밝음 | 낮음 | 모든 도트/태그에 `dark:saturate-90 dark:brightness-95` 일괄 적용. 미달 시 ADR로 토큰 도입 검토. |
| `fetchExerciseProgression` per-card 호출이 8개 동시 | 중간 | TanStack Query staleTime 5분 캐시. 같은 운동 재방문 시 재요청 X. 추후 batch endpoint 검토. |
| /history URL 비정상 입력(y=text, m=99) | 해결됨 | safeYear/safeMonth 범위 검증 + fallback. |
| StartForm 부위 chip 토글 시 excludedExerciseIds 잔존 | 해결됨 | toggleBP 내부에서 명시적 `setExcludedExerciseIds(new Set())`. |
| 같은 날 여러 세션 → 첫 세션만 모달 | 낮음 | aria-label에 카운트 노출. 다중 picker는 Plan 4.1+. |
| Hydration warning (recharts) | 해결됨 | 모든 차트 'use client', 부모 명시 높이, ResponsiveContainer width="100%" height="100%". |
| 캐시 stale: finishSession 후 /history에 새 세션 안 보임 | 해결됨 | Task 7.3에서 revalidatePath('/history') 추가. |
| 서버/클라이언트 쿼리 코드 중복 (sessions-client.ts) | 낮음 | Plan 4 스코프에서 받아들임. Plan 4.1+에서 mapper 분리 검토. |

---

## Reference Map

| 구현 항목 | 파일 | Spec 섹션 |
|---|---|---|
| MiniCalendar | `src/components/ui/mini-calendar.tsx` | §4.2 |
| ProgressLine | `src/components/charts/ProgressLine.tsx` | §4.2 |
| MultiSeriesChart | `src/components/charts/MultiSeriesChart.tsx` | §4.2 |
| SessionDetailDialog | `src/components/workout/SessionDetailDialog.tsx` | §4.2 |
| ExerciseProgressDialog | `src/components/workout/ExerciseProgressDialog.tsx` | §4.2 |
| ExerciseRecCard | `src/app/(app)/workout/new/ExerciseRecCard.tsx` | §4.2 |
| HistoryView | `src/app/(app)/history/HistoryView.tsx` | §4.3 |
| Dashboard 미니 캘린더 | `src/app/(app)/dashboard/Dashboard.tsx` + page.tsx | §4.3 |
| StartForm 체크박스 | `src/app/(app)/workout/new/StartForm.tsx` | §4.3 |
| finishSession revalidate | `src/app/(app)/workout/actions.ts` | §9 |
| body-part-color 헬퍼 | `src/lib/workout/body-part-color.ts` | §4.4 |
| one-rep-max Epley | `src/lib/workout/one-rep-max.ts` | §5.5 |
| fetchSessionsInMonth | `src/lib/queries/sessions.ts` | §5.1 |
| fetchSessionWithDetails | `src/lib/queries/sessions.ts` | §5.2 |
| fetchExerciseProgression | `src/lib/queries/sessions.ts` | §5.3 |
| fetchTopExercises | `src/lib/queries/sessions.ts` | §5.4 |
| 클라이언트 wrapper | `src/lib/queries/sessions-client.ts` | §5.6 |

---

## Revision History

| Version | Date | Change |
|---|---|---|
| v1 | 2026-06-01 | Initial plan from spec v3 (8 chunks, ~12h estimate, Ralph-ready) |
