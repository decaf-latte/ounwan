# Phase 4: History + Charts + Exclude Recommendation — Design Spec

**Date:** 2026-06-01
**Status:** Draft (brainstorming approved, pending reviewer + user gate)
**Predecessor:** Phase 3.6 Responsive Desktop (merged, tag `v0.3.6-responsive-desktop`)
**Branch (planned):** `feat/phase-4-history-charts`
**Tag (planned):** `v0.4.0-history-charts`

---

## 1. Goal

Phase 3.6의 `/history` 카드 리스트(최근 4주) 위에 **월별 캘린더 + 운동별 1RM 추이 차트 + 세션 상세 모달**을 얹어 진척도를 시각적으로 확인. 동시에 헬스장 실사용 피드백 R4(오늘 하기 싫은 추천 운동을 시작 전에 빼기) 해결.

### 검증되는 것

| 항목 | 검증 |
|---|---|
| 대시보드 미니 캘린더 | 주간 칩 7개 → 이번 달 그리드(부위 도트)로 교체 |
| /history 풀 캘린더 | 월 그리드 + 부위 도트 + 날짜 클릭 → 세션 상세 모달 |
| /history 카드 리스트 | Phase 3.6 카드 리스트 유지 (탭으로 전환) |
| 운동별 1RM 추이 차트 | 최근 사용 운동 8개의 미니 라인 카드 + 클릭 시 큰 모달(1RM + 볼륨 멀티 시리즈) |
| 세션 상세 모달 | 운동 N개 + 세트 weight×reps + 부위 태그 |
| R4 추천 제외 | StartForm 추천 카드에 체크박스(기본 모두 체크), 체크 해제된 운동은 세션에서 제외 |
| 부위 색 매핑 | 8개 부위마다 라이트/다크 토큰, 캘린더 도트 + 세션 상세 태그에 일관 적용 |
| Hydration | next-themes warning 0개 유지 |
| 회귀 | 22 → 28+ tests pass |
| Build | `pnpm build` 0 errors, 라우트 변동 없음 (URL은 그대로) |

---

## 2. Out of Scope

- 차트 zoom/brush/툴팁 상세 — Plan 4.1 이후
- 1RM PR(personal record) 자동 감지 토스트 — 추후
- 세션 비교(이번 vs 지난번) — 추후
- 부위별 주간 볼륨 추이 차트 — 추후
- 운동 순서 drag&drop — Plan 3.7 후보
- Magic link 로그인(카카오톡 인앱브라우저 우회) — Plan 3.7 후보
- /history 무한 스크롤(현재는 월 단위 페이징만)

---

## 3. 결정 사항 (Brainstorm 결과)

| # | 결정 | 사유 |
|---|------|------|
| 라우트 구조 | **C 하이브리드** | 대시보드 미니 캘린더 + /history 풀 캘린더+차트. 시각 가치 ↑. |
| 차트 | **A + D 조합** | 메인 = 1RM 미니 라인 카드 N개, 모달 = 1RM + 볼륨 멀티 시리즈. Strength + Volume 둘 다 확인 가능. |
| R4 | **체크박스 (기본 모두 체크)** | 직관적 + form-like. excludedExerciseIds Set으로 startSession 호출 시 제외. |
| 세션 상세 | **Dialog 모달** | 캘린더 컨텍스트 유지. URL 공유 niede 없음(MVP). |
| 미니 캘린더 위치 | **주간 칩 대체** | 7일 → 이번 달 전체 그리드. 동점 파악 ↑, 정보 중복 X. |
| 1RM 공식 | **Epley**: `weight × (1 + reps/30)` | 가장 보편적. 회수가 다른 세트도 비교 가능. |
| 차트 라이브러리 | **recharts** | 18kB gzip, React 19 호환, 가장 안정적 |
| 부위 색 | 8개 부위마다 CSS var 토큰 | globals.css에 `--bp-*` 추가, 라이트/다크 동시 정의 |

---

## 4. Architecture

### 4.1 새 파일 / 수정 파일 맵

```
src/
├─ app/(app)/
│   ├─ dashboard/
│   │   └─ Dashboard.tsx                     [MOD] 주간 칩 → MiniCalendar
│   ├─ workout/new/
│   │   ├─ StartForm.tsx                     [MOD] excludedExerciseIds state + 체크박스
│   │   └─ ExerciseRecCard.tsx               [NEW] 추천 카드 + 체크박스 (분리)
│   └─ history/
│       ├─ page.tsx                          [MOD] 풀 캘린더 + 카드 리스트 + 차트 영역
│       └─ HistoryView.tsx                   [NEW] 클라이언트: 탭 + 모달 트리거
│
├─ components/
│   ├─ ui/
│   │   └─ mini-calendar.tsx                 [NEW] 월별 그리드 (5주 × 7일) + 부위 도트
│   ├─ charts/
│   │   ├─ ProgressLine.tsx                  [NEW] recharts 1RM 미니 라인 카드
│   │   └─ MultiSeriesChart.tsx              [NEW] recharts 1RM + 볼륨 듀얼 축
│   └─ workout/
│       ├─ SessionDetailDialog.tsx           [NEW] 세션 상세 (Dialog + useQuery)
│       └─ ExerciseProgressDialog.tsx        [NEW] 운동 상세 (Dialog + 큰 차트 + useQuery)
│
└─ lib/
    ├─ queries/
    │   └─ sessions.ts                       [MOD] fetchSessionsInMonth, fetchSessionWithDetails, fetchExerciseProgression, fetchTopExercises 추가
    └─ workout/
        └─ one-rep-max.ts                    [NEW] Epley 공식 + 볼륨 계산 (순수 함수)

src/app/globals.css                          [MOD] --bp-* 부위 색 토큰 추가
package.json                                 [MOD] recharts dependency
```

### 4.2 신규 컴포넌트

#### `src/components/ui/mini-calendar.tsx`

월별 그리드. 일주일 = 7열, 5주 ≤ N ≤ 6주. 각 날짜 셀에 부위 도트 0~4개.

```tsx
"use client";
import { cn } from "@/lib/utils";

type Props = {
  year: number;            // 2026
  month: number;           // 0-indexed (0=Jan, 5=Jun)
  todayDayOfMonth?: number;
  /** dayOfMonth → bodyPartIds (color dot 매핑) */
  dotsByDate: Record<number, number[]>;
  /** 날짜 클릭 콜백. 미지정 시 셀 비활성 (대시보드용) */
  onDateClick?: (dayOfMonth: number) => void;
  size?: "sm" | "md";       // sm = 대시보드, md = /history
};

export function MiniCalendar({ year, month, todayDayOfMonth, dotsByDate, onDateClick, size = "md" }: Props) {
  // 1) 월의 첫 날 요일 (0=일 ... 6=토) → 한국식 (월=0)으로 변환
  // 2) 마지막 일 계산
  // 3) 5~6주 그리드 렌더
  // 4) 셀: 비활성(empty) / 평일 / 오늘(border-accent) / 도트
}
```

> **요일 시작:** 한국 사용자 — 월요일 시작. `getDay()` 결과 보정 헬퍼 분리.

#### `src/components/charts/ProgressLine.tsx`

운동 1개의 8주 1RM 추이 미니 라인 카드. 클릭 시 ExerciseProgressDialog 트리거.

```tsx
"use client";
import { LineChart, Line, ResponsiveContainer } from "recharts";

type Props = {
  exerciseId: string;
  exerciseName: string;
  /** 시간순(asc) — [{date: '2026-04-08', oneRepMax: 70}, ...] */
  data: Array<{ date: string; oneRepMax: number }>;
  onClick?: (exerciseId: string) => void;
};

export function ProgressLine({ exerciseId, exerciseName, data, onClick }: Props) {
  if (data.length < 2) return /* "기록 부족" 카드 */;

  const latest = data[data.length - 1].oneRepMax;
  const earliest = data[0].oneRepMax;
  const delta = latest - earliest;

  return (
    <button type="button" onClick={() => onClick?.(exerciseId)} className="...">
      <div className="text-h3 font-bold">{exerciseName}</div>
      <div className="text-caption text-text-muted">1RM 추이 (8주)</div>
      <div className="h-16 mt-2">
        <ResponsiveContainer>
          <LineChart data={data}>
            <Line dataKey="oneRepMax" stroke="var(--color-accent)" strokeWidth={2} dot={false} />
          </LineChart>
        </ResponsiveContainer>
      </div>
      <div className="text-caption mt-1">{latest}kg · {delta >= 0 ? "+" : ""}{delta}kg</div>
    </button>
  );
}
```

#### `src/components/charts/MultiSeriesChart.tsx`

큰 모달 안에 들어가는 1RM + 볼륨 듀얼 축 차트.

```tsx
"use client";
import {
  LineChart, Line, XAxis, YAxis, Tooltip, CartesianGrid,
  ResponsiveContainer, Legend,
} from "recharts";

type Props = {
  data: Array<{ date: string; oneRepMax: number; volume: number }>;
};

export function MultiSeriesChart({ data }: Props) {
  return (
    <div className="h-64 lg:h-80">
      <ResponsiveContainer>
        <LineChart data={data} margin={{ top: 8, right: 16, left: 0, bottom: 0 }}>
          <CartesianGrid stroke="var(--color-border)" strokeDasharray="2 2" vertical={false} />
          <XAxis dataKey="date" tick={{ fontSize: 10, fill: "var(--color-text-muted)" }} />
          <YAxis yAxisId="left" tick={{ fontSize: 10, fill: "var(--color-text-muted)" }} label={{ value: "1RM (kg)", angle: -90, position: "insideLeft", fontSize: 10, fill: "var(--color-text-muted)" }} />
          <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 10, fill: "var(--color-text-muted)" }} label={{ value: "볼륨 (kg)", angle: 90, position: "insideRight", fontSize: 10, fill: "var(--color-text-muted)" }} />
          <Tooltip contentStyle={{ background: "var(--color-surface)", border: "1px solid var(--color-border)", borderRadius: 8, fontSize: 12 }} />
          <Legend wrapperStyle={{ fontSize: 11 }} />
          <Line yAxisId="left" dataKey="oneRepMax" stroke="var(--color-accent)" strokeWidth={2} name="1RM" dot={{ r: 3 }} />
          <Line yAxisId="right" dataKey="volume" stroke="var(--color-accent-strong)" strokeWidth={2} strokeDasharray="4 2" name="볼륨" dot={false} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
```

> 색: 1RM은 `--color-accent` (코랄), 볼륨은 점선 `--color-accent-strong`. 다른 부위 색은 캘린더 도트에만 사용.

#### `src/components/workout/SessionDetailDialog.tsx`

날짜 클릭 → 그 날 세션 상세. TanStack Query로 lazy fetch.

```tsx
"use client";
import { useQuery } from "@tanstack/react-query";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { fetchSessionWithDetailsClient } from "@/lib/queries/sessions-client";

type Props = {
  sessionId: string | null;        // null이면 닫힘
  onClose: () => void;
};

export function SessionDetailDialog({ sessionId, onClose }: Props) {
  const { data, isLoading, error } = useQuery({
    queryKey: ["session-detail", sessionId],
    queryFn: () => fetchSessionWithDetailsClient(sessionId!),
    enabled: !!sessionId,
  });

  return (
    <Dialog open={!!sessionId} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-md lg:max-w-2xl">
        <DialogHeader><DialogTitle>{data ? formatDateKo(data.started_at) : "세션 상세"}</DialogTitle></DialogHeader>
        {isLoading ? <Skeleton className="h-40" /> : error ? <p>불러올 수 없어요</p> : data && (
          <div className="space-y-3">
            <div className="flex flex-wrap gap-1">
              {data.bodyParts.map((bp) => <BodyPartTag key={bp.id} bodyPartId={bp.id} name={bp.name_ko} />)}
            </div>
            {data.exercises.map((ex) => (
              <article key={ex.id} className="rounded-lg border p-3">
                <h3 className="text-h3 font-bold">{ex.name}</h3>
                <div className="text-caption mt-1">
                  {ex.sets.map((s, i) => <span key={i}>{s.weight_kg}kg × {s.reps}회{i < ex.sets.length - 1 ? " · " : ""}</span>)}
                </div>
              </article>
            ))}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
```

> `fetchSessionWithDetailsClient`는 클라이언트용 wrapper (Browser supabase client). 동일 쿼리이지만 클라이언트에서 호출.

#### `src/components/workout/ExerciseProgressDialog.tsx`

운동 클릭 → 12주 1RM + 볼륨 차트.

```tsx
"use client";
import { useQuery } from "@tanstack/react-query";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { MultiSeriesChart } from "@/components/charts/MultiSeriesChart";

type Props = {
  exerciseId: string | null;
  exerciseName: string;
  onClose: () => void;
};

export function ExerciseProgressDialog({ exerciseId, exerciseName, onClose }: Props) {
  const { data, isLoading } = useQuery({
    queryKey: ["exercise-progression", exerciseId],
    queryFn: () => fetchExerciseProgressionClient(exerciseId!, 12),
    enabled: !!exerciseId,
  });

  return (
    <Dialog open={!!exerciseId} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-md lg:max-w-3xl">
        <DialogHeader><DialogTitle>{exerciseName}</DialogTitle></DialogHeader>
        {isLoading ? <Skeleton className="h-64" /> : data && data.length >= 2 ? <MultiSeriesChart data={data} /> : <p>아직 기록이 부족해요</p>}
      </DialogContent>
    </Dialog>
  );
}
```

#### `src/app/(app)/workout/new/ExerciseRecCard.tsx`

추천 카드 분리 + 체크박스. R4.

```tsx
"use client";
import { Checkbox } from "@/components/ui/checkbox";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import type { ExerciseWithBodyParts } from "@/lib/queries/exercises";

type Props = {
  exercise: ExerciseWithBodyParts;
  included: boolean;
  onToggle: (exerciseId: string, included: boolean) => void;
};

export function ExerciseRecCard({ exercise, included, onToggle }: Props) {
  return (
    <Card className={cn("p-3 flex items-center gap-3", !included && "opacity-50")}>
      <Checkbox
        id={`rec-${exercise.id}`}
        checked={included}
        onCheckedChange={(v) => onToggle(exercise.id, v === true)}
        aria-label={`${exercise.name} ${included ? "제외" : "포함"}`}
      />
      <label htmlFor={`rec-${exercise.id}`} className="flex-1 cursor-pointer">
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

> shadcn `Checkbox` 컴포넌트는 Phase 0+1에서 이미 추가됨 (`src/components/ui/checkbox.tsx`).

### 4.3 기존 컴포넌트 수정

#### `Dashboard.tsx`

- **주간 칩 영역 → MiniCalendar로 교체**
- `weeklyDates: number[]` prop 폐기. 대신 `monthDots: Record<number, number[]>` prop 도입(`fetchSessionsInMonth` 결과를 변환).
- 카드 안에 MiniCalendar(`size="sm"`, `onDateClick` 미지정 = 비활성).

```diff
- {/* 주간 칩 카드 */}
- <Card className="p-4">
-   <div className="text-center">
-     {DAY_LABELS.map((d, i) => <DayChip key={i} state={...} />)}
-   </div>
- </Card>
+ {/* 이번 달 캘린더 카드 */}
+ <Card className="p-4">
+   <MiniCalendar
+     year={today.getFullYear()}
+     month={today.getMonth()}
+     todayDayOfMonth={today.getDate()}
+     dotsByDate={monthDots}
+     size="sm"
+   />
+ </Card>
```

#### `StartForm.tsx`

```tsx
// 새 state
const [excludedExerciseIds, setExcludedExerciseIds] = useState<Set<string>>(new Set());

// 토글 핸들러
const toggleInclude = useCallback((exId: string, included: boolean) => {
  setExcludedExerciseIds((prev) => {
    const next = new Set(prev);
    if (included) next.delete(exId); else next.add(exId);
    return next;
  });
}, []);

// 추천 ID 계산 — 제외 적용
const recommendedExerciseIds = useMemo(
  () => recommendations.map((r) => r.exerciseId).filter((id) => !excludedExerciseIds.has(id)),
  [recommendations, excludedExerciseIds],
);

// 렌더: 기존 추천 카드 → ExerciseRecCard로 교체
{recommendations.map((r) => {
  const ex = exerciseById.get(r.exerciseId);
  if (!ex) return null;
  return (
    <ExerciseRecCard
      key={r.exerciseId}
      exercise={ex}
      included={!excludedExerciseIds.has(r.exerciseId)}
      onToggle={toggleInclude}
    />
  );
})}

// 시작 버튼: disabled 조건에 recommendedExerciseIds.length === 0 추가
<Button
  disabled={isPending || selectedBP.size === 0 || !showRecommendations || recommendedExerciseIds.length === 0}
  onClick={handleStart}
>
  {isPending ? "시작 중..." : `운동 시작 (${recommendedExerciseIds.length})`}
</Button>

// startSession 호출: recommendations.map → recommendedExerciseIds 사용
await startSession({
  bodyPartIds: [...selectedBP],
  recommendedExerciseIds,  // 제외 적용된 리스트
  templateId: null,
});
```

> 부위 chip 토글 시 `excludedExerciseIds` 자동 reset (추천 자체가 바뀌므로).

#### `src/app/(app)/history/page.tsx`

```tsx
// RSC. 3개 쿼리 + HistoryView 클라이언트.
import { fetchSessionsInMonth, fetchTopExercises, fetchRecentSessions } from "@/lib/queries/sessions";

export default async function HistoryPage({ searchParams }: { searchParams: Promise<{ y?: string; m?: string }> }) {
  const { y, m } = await searchParams;
  const today = new Date();
  const year = y ? Number(y) : today.getFullYear();
  const month = m !== undefined ? Number(m) : today.getMonth();

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const [monthSessions, topExercises, recentSessions] = await Promise.all([
    fetchSessionsInMonth(user.id, year, month),
    fetchTopExercises(user.id, 8),
    fetchRecentSessions(user.id, 4),
  ]);

  return (
    <main className="p-5 max-w-md lg:max-w-5xl mx-auto pb-32 lg:pb-5">
      <h1 className="text-display font-extrabold text-text">기록</h1>
      <HistoryView
        userId={user.id}
        year={year}
        month={month}
        todayDayOfMonth={today.getMonth() === month && today.getFullYear() === year ? today.getDate() : undefined}
        monthSessions={monthSessions}
        topExercises={topExercises}
        recentSessions={recentSessions}
      />
    </main>
  );
}
```

#### `src/app/(app)/history/HistoryView.tsx` (NEW)

```tsx
"use client";
// State: selectedSessionId, selectedExerciseId, viewMode ('calendar' | 'list')
// 상단: 월 navigation (이전/다음/오늘), 탭 (캘린더 | 리스트)
// 캘린더 탭: MiniCalendar (md size, onDateClick → setSelectedSessionId)
// 리스트 탭: 기존 카드 리스트 (recentSessions)
// 하단: ProgressLine 카드 N개 (topExercises) → onClick → setSelectedExerciseId
// Dialog: SessionDetailDialog + ExerciseProgressDialog
```

> 월 이동은 `router.push('/history?y=2026&m=4')`로 URL 갱신 → 서버 RSC가 다시 호출. SPA-like UX 위해 `router.replace` + scroll preserve.

### 4.4 globals.css 부위 색 토큰

```css
/* :root (light) */
--bp-chest: #FF6B6B;
--bp-back: #4ECDC4;
--bp-shoulder: #A78BFA;
--bp-arm: #FFD93D;
--bp-legs: #95E1D3;
--bp-abs: #F8B400;
--bp-cardio: #74B9FF;
--bp-other: #B2BEC3;

/* .dark — 채도 살짝 낮추고 명도 보정 */
--bp-chest: #E55656;
--bp-back: #3DB5AB;
--bp-shoulder: #8B6FE0;
--bp-arm: #E5C12B;
--bp-legs: #7BC9B7;
--bp-abs: #D89500;
--bp-cardio: #5A9BE5;
--bp-other: #8E97A0;

/* @theme inline */
--color-bp-chest: var(--bp-chest);
/* ... 나머지 7개 */
```

**body_parts.id ↔ 토큰 매핑 헬퍼:**

```ts
// src/lib/workout/body-part-colors.ts
const ID_TO_TOKEN: Record<number, string> = {
  1: "bp-chest", 2: "bp-back", 3: "bp-shoulder", 4: "bp-arm",
  5: "bp-legs", 6: "bp-abs", 7: "bp-cardio", 8: "bp-other",
};

export function bodyPartColorClass(id: number): string {
  return `bg-${ID_TO_TOKEN[id] ?? "bp-other"}`;
}
export function bodyPartColorVar(id: number): string {
  return `var(--color-${ID_TO_TOKEN[id] ?? "bp-other"})`;
}
```

> body_parts.id는 1~8 고정(global seed). 새 부위 추가 시 토큰도 같이 추가 — Plan 5 운동 CRUD에서 처리.

---

## 5. 데이터 흐름

### 5.1 신규 쿼리: `fetchSessionsInMonth`

```ts
// src/lib/queries/sessions.ts (추가)
export type MonthSessionEntry = {
  dayOfMonth: number;          // 1~31
  sessionIds: string[];         // 같은 날 여러 세션 가능
  bodyPartIds: number[];        // 그 날 운동한 부위 (unique)
};

export async function fetchSessionsInMonth(
  userId: string,
  year: number,
  month: number,  // 0-indexed
): Promise<MonthSessionEntry[]> {
  const supabase = await createClient();
  const start = new Date(year, month, 1).toISOString();
  const end = new Date(year, month + 1, 1).toISOString();

  const { data, error } = await supabase
    .from("workout_sessions")
    .select(`
      id,
      started_at,
      workout_sets!inner (
        exercises!inner (
          exercise_body_parts ( body_part_id, is_primary )
        )
      )
    `)
    .eq("user_id", userId)
    .gte("started_at", start)
    .lt("started_at", end);

  if (error) throw error;

  // 날짜별 집계: { dayOfMonth, sessionIds, bodyPartIds }
  const byDay = new Map<number, MonthSessionEntry>();
  for (const row of data ?? []) {
    const day = new Date(row.started_at).getDate();
    if (!byDay.has(day)) byDay.set(day, { dayOfMonth: day, sessionIds: [], bodyPartIds: [] });
    const entry = byDay.get(day)!;
    entry.sessionIds.push(row.id);
    for (const ws of row.workout_sets as any[]) {
      for (const ebp of ws.exercises.exercise_body_parts) {
        if (ebp.is_primary && !entry.bodyPartIds.includes(ebp.body_part_id)) {
          entry.bodyPartIds.push(ebp.body_part_id);
        }
      }
    }
  }
  return Array.from(byDay.values());
}
```

> `is_primary=true`만 도트로 표시 (한 운동의 secondary 부위는 도트에서 제외).

### 5.2 신규 쿼리: `fetchSessionWithDetails`

```ts
export type SessionDetail = {
  id: string;
  started_at: string;
  ended_at: string | null;
  bodyParts: Array<{ id: number; name_ko: string }>;
  exercises: Array<{
    id: string;
    name: string;
    sets: Array<{ set_number: number; weight_kg: number; reps: number; parent_set_id: string | null }>;
  }>;
};

export async function fetchSessionWithDetails(sessionId: string): Promise<SessionDetail | null> {
  // workout_sessions + workout_sets + exercises + exercise_body_parts + body_parts join
  // 본인 세션인지 RLS가 보장 (auth.uid() check)
  // 결과 aggregate: 운동별 grouping, 부위 unique
}
```

### 5.3 신규 쿼리: `fetchExerciseProgression`

```ts
export type ProgressionPoint = {
  date: string;            // ISO date (yyyy-mm-dd)
  oneRepMax: number;       // 그 날 세션의 max 1RM (해당 운동 메인 세트 중)
  volume: number;          // 그 날 세션 총 볼륨 (sum of weight × reps)
  maxWeight: number;       // 그 날 최대 무게
};

export async function fetchExerciseProgression(
  userId: string,
  exerciseId: string,
  weeksBack: number = 12,
): Promise<ProgressionPoint[]> {
  // workout_sets + workout_sessions join, .eq('exercise_id', exerciseId), .eq('user_id', userId)
  // parent_set_id IS NULL (메인 세트만)
  // 세션 단위로 group → 각 세션마다 max(estimateOneRepMax(w, r)), sum(w*r), max(w)
  // 시간순 asc
}
```

### 5.4 신규 쿼리: `fetchTopExercises`

```ts
export type TopExercise = {
  exerciseId: string;
  exerciseName: string;
  lastUsedAt: string;
  recentSetCount: number;   // 최근 12주 메인 세트 수
};

export async function fetchTopExercises(userId: string, limit: number = 8): Promise<TopExercise[]> {
  // 최근 12주 workout_sets에서 exercise_id별 세트 수 집계
  // 가장 자주 한 운동 N개 (set count desc)
  // ProgressLine 카드 N개에 표시
}
```

### 5.5 1RM 헬퍼

```ts
// src/lib/workout/one-rep-max.ts
export function estimateOneRepMax(weight: number, reps: number): number {
  if (reps <= 0 || weight <= 0) return 0;
  if (reps === 1) return weight;
  // Epley: weight × (1 + reps/30)
  return Math.round(weight * (1 + reps / 30) * 10) / 10;
}

export function calcSetVolume(weight: number, reps: number): number {
  if (weight <= 0 || reps <= 0) return 0;
  return weight * reps;
}
```

### 5.6 클라이언트용 쿼리 wrapper

`SessionDetailDialog` / `ExerciseProgressDialog`는 모달이 열릴 때만 fetch (lazy). RSC가 아니라 브라우저 supabase client.

```ts
// src/lib/queries/sessions-client.ts (NEW)
import { createClient } from "@/lib/supabase/client";

export async function fetchSessionWithDetailsClient(sessionId: string) {
  const supabase = createClient();
  // 동일 쿼리. RLS가 본인 세션만 노출.
}

export async function fetchExerciseProgressionClient(exerciseId: string, weeksBack: number) {
  const supabase = createClient();
  // 동일.
}
```

> 동일 로직을 서버/클라이언트 둘에 두는 게 약간의 중복이지만, RSC 패턴 + Dialog lazy fetch 패턴이 다르기 때문에 분리가 자연스러움. 헬퍼는 같은 시그니처.

---

## 6. 라우팅

| 경로 | 변경 | 비고 |
|------|------|------|
| `/dashboard` | MOD | 주간 칩 → MiniCalendar |
| `/workout/new` | MOD | StartForm 체크박스 |
| `/history` | MOD | 캘린더 탭 + 리스트 탭 + 차트 카드 + 모달 2개. URL `?y=2026&m=5` 지원 (월 이동). |
| `/history/[sessionId]` | — | 안 만듦 (모달로 처리) |
| 라우트 추가 | — | 없음 |

---

## 7. 오류 처리 / UX states

- `/history/loading.tsx` (이미 존재) — 캘린더 + 차트 카드 영역 skeleton 추가
- `/history/error.tsx` — 그대로
- SessionDetailDialog / ExerciseProgressDialog: useQuery `isLoading` → Skeleton inside dialog, `error` → 빈 메시지 + 재시도 안내
- ProgressLine: `data.length < 2` → "기록 부족" 메시지 카드
- 캘린더 빈 달(데이터 0): "이 달엔 기록이 없어요" + 이전 달 버튼
- TopExercises 0개(신규 사용자): "8개 미만이라 추이를 보여드릴 수 없어요. 헬스장에서 더 채워보세요." + /workout/new 링크

---

## 8. 테스트 전략

### 8.1 회귀 (변경 없이 통과)
- 22 tests 기존 (RLS 3 + recommendation 6 + motion 3 + progress-ring 5 + layout 3 + exercise-list 2)

### 8.2 신규 (총 +6~8)

- `tests/lib/one-rep-max.test.ts` — Epley 공식 (4 tests)
  - 1회 무게 == 입력 무게
  - 일반 케이스 (10회, 60kg → 80kg)
  - 0/음수 → 0
  - 소수 1자리 반올림
- `tests/components/ui/mini-calendar.test.tsx` — 도트 + 클릭 (2 tests)
  - dotsByDate 매핑된 날짜에 도트 N개
  - onDateClick 콜백 호출 + 비활성 모드(onDateClick 미지정)에선 클릭 핸들러 없음
- `tests/components/charts/progress-line.test.tsx` — 렌더 + 증감 (1~2 tests)
  - data.length < 2 → 빈 메시지
  - latest + delta 표시

> recharts ResponsiveContainer는 jsdom에서 width=0 이슈가 흔함. 테스트에서 `<div style={{width:300,height:100}}>`로 wrap.

### 8.3 수동 E2E
- 새 세션 시작 → 추천 체크박스 1개 해제 → 운동 시작 → 추천 N-1개로 세션 생성 확인
- 대시보드: 미니 캘린더에서 운동한 날짜 도트 표시
- /history: 월 이동 (이전 달 버튼) → URL `?y=...&m=...` 갱신
- 캘린더 날짜 클릭 → 세션 상세 모달 → 운동 N개 + 세트 무게/회수 표시
- ProgressLine 카드 N개 → 클릭 → 큰 차트 모달 (1RM + 볼륨)
- 다크 모드 토글 → 차트 색 + 캘린더 도트 정상 표시
- WCAG: 모달 키보드 닫기, 차트 색 대비 검증

---

## 9. Risks & Mitigations

| 리스크 | 영향 | 완화 |
|---|---|---|
| recharts ResponsiveContainer 가 jsdom에서 0×0 — 테스트 실패 | 중간 | 테스트에서 명시적 div wrapper. 또는 recharts mock. ProgressLine은 data-driven 테스트로만(렌더링 자체 아닌 props 검증). |
| `fetchSessionsInMonth`가 큰 join (sessions × sets × exercises × ebp) | 중간 | 한 달 ≤ 31 sessions, ≤ 200 sets. 단일 query로 충분. Plan 5 이후 materialized view 검토. |
| 1RM Epley 공식이 reps > 12 일 때 오차 큼 | 낮음 | 헬스장 메인 세트 보통 1~12회. >12회는 근지구력 영역이라 1RM 자체 적용 부적합 → 차트엔 그대로 표시. |
| body_parts.id가 1~8 fixed → 새 부위 추가 시 토큰 갱신 누락 | 낮음 | Plan 5 CRUD에서 부위 추가 UI 만들 때 토큰 추가 가이드. 임시 unknown id는 `bp-other`로 fallback. |
| 캘린더 도트 색 매핑이 ID hard-code 의존 | 중간 | `body-part-colors.ts` 헬퍼 1곳에 집중. 변경 영향 최소화. |
| SessionDetailDialog `useQuery` 결과 캐시가 모달 닫혀도 살아있음 | 낮음 | 캐시 살아있음 → 같은 세션 재오픈 시 즉시 표시. queryKey에 sessionId 포함되어 분리. |
| /history URL `?y&m` 직접 입력 (예: y=2050) | 낮음 | 빈 결과 → "이 달엔 기록이 없어요". 미래 날짜 입력해도 에러 X. |
| recharts dependency 신규 추가로 번들 사이즈 | 낮음 | 18kB gzip. /history에만 dynamic import 고려 (Phase 4.1에서 최적화). |
| Dashboard 미니 캘린더가 lg에서 너무 큰가 | 낮음 | size="sm" 토큰 + lg에서 max-w 제한. /history는 size="md". |
| 캐시 stale: 새 세션 끝나도 /history 캘린더에 안 보임 | 중간 | `finishSession` 후 `revalidatePath('/history')` 추가. 대시보드도 `revalidatePath('/dashboard')` 이미 있음. |
| StartForm에서 부위 chip 토글 시 excludedExerciseIds reset 필요 | 낮음 | `toggleBP`에서 `setExcludedExerciseIds(new Set())`도 같이 호출. |

---

## 10. Implementation Order (Chunks 미리보기)

| Chunk | 내용 | 예상 |
|------:|------|------|
| 1 | recharts 의존성 추가 + `one-rep-max.ts` + tests (4 tests) + globals.css `--bp-*` 토큰 + `body-part-colors.ts` | 1h |
| 2 | `MiniCalendar` 컴포넌트 + tests (2 tests) | 1.5h |
| 3 | `fetchSessionsInMonth` 쿼리 + Dashboard MiniCalendar 교체 + 회귀 | 1.5h |
| 4 | `fetchSessionWithDetails` + `SessionDetailDialog` + 클라이언트 wrapper | 1.5h |
| 5 | `fetchExerciseProgression` + `fetchTopExercises` + `ProgressLine` + `MultiSeriesChart` + `ExerciseProgressDialog` + tests | 2h |
| 6 | `/history` page + `HistoryView` 클라이언트 (탭, 월 navigation, 모달 트리거) | 2h |
| 7 | R4 — `ExerciseRecCard` + `StartForm` 체크박스 wiring + 부위 chip 토글 시 excluded reset | 1h |
| 8 | build / test 28+ / log / PR / 머지 / `v0.4.0-history-charts` 태그 | 1h |

총 ~11.5h (1.5일).

---

## 11. References

- Phase 3.6 spec: `docs/specs/2026-05-29-phase-3-6-responsive-desktop-design.md`
- Phase 3.6 plan: `docs/plans/2026-05-29-phase-3-6-responsive-desktop.md`
- Phase 3.6 log: `docs/import/responsive-desktop-log.md`
- 원래 큰 spec (Phase 4 정의): `docs/specs/2026-05-22-gym-routine-app-design.md` §10
- recharts: https://recharts.org/
- Epley 1RM 공식: weight × (1 + reps/30)

---

## Revision History

| Version | Date | Change |
|---|---|---|
| v1 | 2026-06-01 | Initial draft after brainstorming session (사용자 선택: 라우트 C 하이브리드 / 차트 A+D / R4 체크박스 / 세션 상세 모달 / 미니 캘린더는 주간 칩 대체 / 1RM Epley / recharts 도입) |
