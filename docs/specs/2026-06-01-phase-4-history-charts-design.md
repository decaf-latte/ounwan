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
| 부위 색 | **`body_parts.color` DB 컬럼 직접 사용** (단일 진실 소스) | 이미 seed에 8개 부위 hex 색 있음 (chest #FF6B6B / back #4ECDC4 / shoulder #FFE66D / trap #95E1D3 / arm #C9B1FF / leg #F38181 / glute #FCBAD3 / core #A8E6CF). RSC가 join으로 color 같이 fetch → props로 전달. 다크모드 채도 조정은 CSS `filter: saturate(0.85) brightness(0.9)` 동적 적용. 새 CSS 토큰 안 만듦 → divergent risk 차단. |

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

월별 그리드. **고정 6주 × 7일 = 42 셀** (변동 높이 layout shift 방지). 각 날짜 셀에 부위 도트 + 같은 날 여러 세션 가능.

```tsx
"use client";
import { cn } from "@/lib/utils";
import { bodyPartStyle } from "@/lib/workout/body-part-color";

export type DayEntry = {
  /** 그 날 운동한 부위별 색 (DB hex). 도트 색 매핑용. 중복 제거됨. */
  bodyPartColors: string[];
  /** 그 날 세션 UUID 리스트. 같은 날 여러 세션 가능. */
  sessionIds: string[];
};

type Props = {
  year: number;            // 2026
  /** 1-indexed (1=Jan, 12=Dec) — URL 표기와 일치 */
  month: number;
  todayDayOfMonth?: number;
  /** dayOfMonth → DayEntry */
  dotsByDate: Record<number, DayEntry>;
  /** 날짜 클릭 콜백. 미지정 시 셀 비활성 (대시보드용). 같은 날 여러 세션이면 첫 sessionId 전달. */
  onDateClick?: (sessionId: string) => void;
  size?: "sm" | "md";       // sm = 대시보드, md = /history
};

export function MiniCalendar({ year, month, todayDayOfMonth, dotsByDate, onDateClick, size = "md" }: Props) {
  // 1) 월의 첫 날 요일 → 월요일 시작 보정 (Mon=0 ... Sun=6)
  //    JS getDay(): Sun=0, Mon=1, ..., Sat=6 → ((getDay() + 6) % 7) = Mon=0...Sun=6
  // 2) 마지막 일 = new Date(year, month, 0).getDate()  (month=1~12, JS Date의 0번째 일은 전월 마지막)
  // 3) 6주 고정 (42 셀). 앞뒤로 비는 셀은 empty.
  // 4) 셀 종류:
  //    - empty: 회색 텍스트 또는 빈 공간
  //    - 일반: 숫자만
  //    - 오늘: border-2 border-accent
  //    - 운동한 날: 숫자 + 하단에 부위 색 도트 N개 (max 4, 5개부터는 +N)
  //    - onDateClick 있고 운동한 날이면 클릭 가능 (button)

  return (
    <div
      role="grid"
      aria-label={`${year}년 ${month}월 운동 캘린더`}
      className={cn("grid grid-cols-7 gap-1", size === "sm" ? "text-[10px]" : "text-xs")}
    >
      {/* 요일 헤더 */}
      {["월","화","수","목","금","토","일"].map((d) => (
        <div key={d} role="columnheader" className="text-center text-text-muted py-1">{d}</div>
      ))}

      {/* 42 셀 */}
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
                  <span key={j} className="w-1 h-1 rounded-full inline-block" style={bodyPartStyle(c)} />
                ))}
                {entry.bodyPartColors.length > 4 && <span className="text-[8px]">+{entry.bodyPartColors.length - 4}</span>}
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
              onClick={() => onDateClick(entry.sessionIds[0])}  /* 같은 날 여러면 첫 세션 */
              className={cn("text-center rounded p-1 hover:bg-accent-soft", isToday && "border-2 border-accent")}
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
            className={cn("text-center rounded p-1", isToday && "border-2 border-accent", !inMonth && "text-text-ghost")}
          >
            {cellContent}
          </div>
        );
      })}
    </div>
  );
}
```

> **요일 시작:** 한국 사용자 — 월요일 시작.
> **같은 날 여러 세션:** 첫 세션만 모달로 표시 (Plan 4 스코프). 여러 세션 picker UI는 Plan 4.1+ 후보.
> **고정 6주:** 변동 높이 layout shift 방지. 빈 셀은 회색 텍스트.
> **접근성:** `role="grid"` + `aria-label`. 각 셀 `role="gridcell"`. 클릭 가능 셀은 `<button>`. 화살표 키 네비는 Plan 4.1로 연기.

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
    <button type="button" onClick={() => onClick?.(exerciseId)} className="w-full text-left p-3 rounded-lg border border-border bg-surface hover:bg-accent-soft transition-colors">
      <span className="block text-h3 font-bold text-text">{exerciseName}</span>
      <span className="block text-caption text-text-muted">1RM 추이 (8주)</span>
      <span className="block h-16 mt-2">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data}>
            <Line dataKey="oneRepMax" stroke="var(--color-accent)" strokeWidth={2} dot={false} />
          </LineChart>
        </ResponsiveContainer>
      </span>
      <span className="block text-caption mt-1">{latest}kg · {delta >= 0 ? "+" : ""}{delta}kg</span>
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
import { bodyPartStyle } from "@/lib/workout/body-part-color";

type Props = {
  sessionId: string | null;        // null이면 닫힘
  onClose: () => void;
};

/** 한국어 날짜 포맷 헬퍼 (인라인) */
function formatDateKo(iso: string): string {
  return new Date(iso).toLocaleString("ko-KR", { dateStyle: "long", timeStyle: "short" });
}

/** 부위 태그 — body_parts.color 직접 사용 (CSS 토큰 없음) */
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
    <Dialog open={!!sessionId} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-md lg:max-w-2xl">
        <DialogHeader>
          <DialogTitle>{data ? formatDateKo(data.started_at) : "세션 상세"}</DialogTitle>
        </DialogHeader>
        {isLoading ? (
          <Skeleton className="h-40" />
        ) : error ? (
          <p className="text-body text-text-muted">불러올 수 없어요. 다시 시도해 주세요.</p>
        ) : data ? (
          <div className="space-y-3">
            <div className="flex flex-wrap gap-1">
              {data.bodyParts.map((bp) => (
                <BodyPartTag key={bp.id} name={bp.name_ko} color={bp.color} />
              ))}
            </div>
            {data.exercises.map((ex) => (
              <article key={ex.id} className="rounded-lg border border-border p-3">
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

> `fetchSessionWithDetailsClient`는 클라이언트용 wrapper (Browser supabase client). 동일 쿼리이지만 클라이언트에서 호출. SessionDetail 타입의 `bodyParts: Array<{ id; name_ko; color }>`로 color 포함 — 5.2 query에서 join.
> `weight_kg`/`reps`는 nullable이라 `??` 가드.

#### `src/components/workout/ExerciseProgressDialog.tsx`

운동 클릭 → 12주 1RM + 볼륨 차트.

```tsx
"use client";
import { useQuery } from "@tanstack/react-query";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { MultiSeriesChart } from "@/components/charts/MultiSeriesChart";
import { fetchExerciseProgressionClient } from "@/lib/queries/sessions-client";

type Props = {
  exerciseId: string | null;
  exerciseName: string;
  onClose: () => void;
};

export function ExerciseProgressDialog({ exerciseId, exerciseName, onClose }: Props) {
  const { data, isLoading, error } = useQuery({
    queryKey: ["exercise-progression", exerciseId],
    queryFn: () => fetchExerciseProgressionClient(exerciseId!, 12),
    enabled: !!exerciseId,
  });

  return (
    <Dialog open={!!exerciseId} onOpenChange={(open) => !open && onClose()}>
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
          <p className="text-body text-text-muted">아직 기록이 부족해요. 2회 이상 기록 후 다시 봐주세요.</p>
        )}
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
        onCheckedChange={(checked) => onToggle(exercise.id, checked)}
        aria-label={`${exercise.name} ${included ? "제외하기" : "다시 포함하기"}`}
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

> **Checkbox는 base-ui (`@base-ui/react/checkbox`)** — NOT Radix. `onCheckedChange` 시그니처는 `(checked: boolean, eventDetails) => void`. `checked`는 항상 boolean (Radix의 `'indeterminate'` 문자열 분기 없음). `src/components/ui/checkbox.tsx`에 이미 wrapper 정의됨 (Phase 0+1).

### 4.3 기존 컴포넌트 수정

#### `Dashboard.tsx`

- **주간 칩 영역 → MiniCalendar로 교체**
- `weeklyDates: number[]` prop 폐기. 대신 `dotsByDate: Record<number, DayEntry>` prop 도입(MiniCalendar Props와 동일 형태). `fetchSessionsInMonth` 결과를 RSC에서 transform 후 전달.
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
+     month={today.getMonth() + 1}   /* 1-indexed (URL 표기와 일치) */
+     todayDayOfMonth={today.getDate()}
+     dotsByDate={dotsByDate}
+     size="sm"
+   />
+ </Card>
```

> page.tsx에서 transform 예시:
> ```ts
> const monthSessions = await fetchSessionsInMonth(user.id, today.getFullYear(), today.getMonth() + 1);
> const dotsByDate: Record<number, DayEntry> = Object.fromEntries(
>   monthSessions.map((e) => [e.dayOfMonth, { bodyPartColors: e.bodyPartColors, sessionIds: e.sessionIds }])
> );
> ```

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
// RSC. URL: /history?y=2026&m=6  (m은 1-indexed, 사용자 친화적).
import { fetchSessionsInMonth, fetchTopExercises } from "@/lib/queries/sessions";

export default async function HistoryPage({
  searchParams,
}: {
  searchParams: Promise<{ y?: string; m?: string }>;
}) {
  const { y, m } = await searchParams;
  const today = new Date();
  const year = y ? Number(y) : today.getFullYear();
  // URL 1-indexed → JS 내부에서도 1-indexed 유지 (fetchSessionsInMonth가 1-indexed 받음)
  const month = m !== undefined ? Number(m) : today.getMonth() + 1;

  // 입력 검증: 범위 밖 → 오늘 달로 fallback
  const safeYear = year >= 2000 && year <= 2100 ? year : today.getFullYear();
  const safeMonth = month >= 1 && month <= 12 ? month : today.getMonth() + 1;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  // 캘린더 + 카드 리스트 둘 다 "선택한 월" 데이터 사용 (탭 간 시간 범위 일관성)
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
        userId={user.id}
        year={safeYear}
        month={safeMonth}  /* 1-indexed */
        todayDayOfMonth={isCurrentMonth ? today.getDate() : undefined}
        monthSessions={monthSessions}
        topExercises={topExercises}
      />
    </main>
  );
}
```

> **URL `?m=6` = 2026년 6월** (1-indexed, 사용자 친화). 내부 코드도 동일하게 1-indexed 유지. JS `Date(year, monthIndex)`는 0-indexed라 변환 필요한 경우 `safeMonth - 1`.
> `fetchRecentSessions`(Phase 3.6, 최근 4주)는 더 이상 호출 안 함 — 리스트도 같은 월 데이터 사용해 탭 간 시간 범위 일관성 확보.

#### `src/app/(app)/history/HistoryView.tsx` (NEW)

```tsx
"use client";
// Props: userId, year, month(1-indexed), todayDayOfMonth?, monthSessions: MonthSessionEntry[], topExercises
//
// State:
//   - selectedSessionId: string | null  (SessionDetailDialog 트리거)
//   - selectedExercise: { id, name } | null  (ExerciseProgressDialog 트리거)
//   - viewMode: 'calendar' | 'list'
//   - isPending: boolean (useTransition, 월 이동 시 부드러운 전환)
//
// monthSessions → dotsByDate: Record<number, DayEntry> 변환
//   * MiniCalendar(캘린더 탭): onDateClick={(sessionId) => setSelectedSessionId(sessionId)}
//   * 리스트 탭: 같은 monthSessions 데이터를 시간 desc로 정렬해 카드 표시 (Phase 3.6 카드 디자인 유지)
//     - 카드 클릭 → 첫 sessionId로 setSelectedSessionId (캘린더와 동일 흐름)
//
// 월 navigation (이전/다음/오늘):
//   const [isPending, startTransition] = useTransition();
//   const goPrev = () => {
//     const prev = month === 1 ? { y: year - 1, m: 12 } : { y: year, m: month - 1 };
//     startTransition(() => router.push(`/history?y=${prev.y}&m=${prev.m}`, { scroll: false }));
//   };
//   const goNext = () => { ... };
//   const goToday = () => router.push("/history", { scroll: false });
//
// 하단: ProgressLine 카드 grid (lg:grid-cols-2 lg:gap-3)
//   onClick={(exId) => setSelectedExercise({ id: exId, name: ... })}
//   topExercises가 비어있으면 빈 상태 메시지
//
// Dialog 2개: SessionDetailDialog + ExerciseProgressDialog (sessionId/exerciseId null로 닫힘 제어)
//
// isPending 동안 캘린더에 opacity-60 적용 (부드러운 전환 인디케이션)
```

> **월 이동:** `router.push` + `{ scroll: false }`로 스크롤 보존. `useTransition`으로 transition 중 isPending → UI 살짝 fade. RSC 재호출은 자동.
> **탭 간 시간 범위:** 캘린더 / 리스트 둘 다 `monthSessions` (선택한 월) — 사용자 혼란 차단.

### 4.4 부위 색 — `body_parts.color` 직접 사용

**새 CSS 토큰 만들지 않음.** DB seed에 이미 모든 부위의 색이 정의되어 있음:

| id | code | name_ko | color |
|----|------|---------|-------|
| 1 | chest | 가슴 | `#FF6B6B` |
| 2 | back | 등 | `#4ECDC4` |
| 3 | shoulder | 어깨 | `#FFE66D` |
| 4 | trap | 승모근 | `#95E1D3` |
| 5 | arm | 팔 | `#C9B1FF` |
| 6 | leg | 허벅지 | `#F38181` |
| 7 | glute | 엉덩이 | `#FCBAD3` |
| 8 | core | 복부 | `#A8E6CF` |

**전략:**
- RSC 쿼리(`fetchSessionsInMonth` 등)가 join으로 `body_parts.color`를 같이 fetch
- 컴포넌트는 hex 문자열을 `style={{ backgroundColor: color }}`로 직접 적용 — Tailwind class 안 씀
- 다크모드는 카드/캘린더 도트 컨테이너에 `dark:saturate-90 dark:brightness-95` 적용해서 살짝 톤다운 (개별 토큰 안 만듦)
- 새 부위 추가는 Plan 5 운동 CRUD에서 DB seed에 추가 — 코드 변경 없음

**얇은 헬퍼 1개만:**

```ts
// src/lib/workout/body-part-color.ts
export function bodyPartStyle(color: string): React.CSSProperties {
  return { backgroundColor: color };
}
```

> 헬퍼는 사실상 trivial이지만 추후 다크모드 톤다운 / 알파 채널 처리 / 미정의 fallback 등이 들어갈 자리. 한 곳에 집중.

> **`body_parts.color` 컬럼은 단일 진실 소스가 됨.** 색을 바꾸려면 migration 추가만 하면 됨. CSS 코드 변경 0.

---

## 5. 데이터 흐름

### 5.1 신규 쿼리: `fetchSessionsInMonth`

```ts
// src/lib/queries/sessions.ts (추가)
export type MonthSessionEntry = {
  dayOfMonth: number;             // 1~31
  sessionIds: string[];            // 같은 날 여러 세션 가능
  bodyPartColors: string[];        // unique 도트 색 (body_parts.color에서 직접)
};

/**
 * 특정 월의 세션 목록 — 캘린더 도트 + 리스트용.
 * @param month 1-indexed (1=Jan, 12=Dec)
 */
export async function fetchSessionsInMonth(
  userId: string,
  year: number,
  month: number,
): Promise<MonthSessionEntry[]> {
  const supabase = await createClient();
  // JS Date는 0-indexed. month=1(Jan) → new Date(y, 0, 1).
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

  // 날짜별 집계: { dayOfMonth, sessionIds, bodyPartColors (unique) }
  const byDay = new Map<number, MonthSessionEntry>();
  for (const row of (data ?? []) as Array<{
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
  }>) {
    const day = new Date(row.started_at).getDate();
    if (!byDay.has(day)) {
      byDay.set(day, { dayOfMonth: day, sessionIds: [], bodyPartColors: [] });
    }
    const entry = byDay.get(day)!;
    if (!entry.sessionIds.includes(row.id)) entry.sessionIds.push(row.id);
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
  return Array.from(byDay.values()).sort((a, b) => a.dayOfMonth - b.dayOfMonth);
}
```

> `is_primary === true`만 도트로 표시. body_parts join으로 `color` hex 같이 fetch. `is_primary: boolean | null`이라 명시적 `=== true` 비교.

### 5.2 신규 쿼리: `fetchSessionWithDetails`

```ts
export type SessionDetail = {
  id: string;
  started_at: string;
  ended_at: string | null;
  bodyParts: Array<{ id: number; name_ko: string; color: string }>;     // color 포함
  exercises: Array<{
    id: string;
    name: string;
    sets: Array<{
      set_number: number;
      weight_kg: number | null;       // nullable — UI에서 ?? 가드
      reps: number | null;             // nullable
      parent_set_id: string | null;
    }>;
  }>;
};

export async function fetchSessionWithDetails(sessionId: string): Promise<SessionDetail | null> {
  // workout_sessions + workout_sets + exercises + exercise_body_parts + body_parts join
  // - .eq('id', sessionId) — RLS가 본인 세션만 노출
  // - bodyParts unique 집계 (is_primary 무관, 그 세션의 모든 매핑된 부위)
  // - exercises group: parent_set_id IS NULL 메인 세트만 표시 (드롭세트는 Plan 4 스코프 외)
  // - sets sort: set_number asc
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
  // - workout_sets + workout_sessions!inner join
  // - .eq('exercise_id', exerciseId), .eq('workout_sessions.user_id', userId)
  // - .is('parent_set_id', null)  (메인 세트만)
  // - .not('weight_kg', 'is', null).not('reps', 'is', null)  (null 가드 — Epley NaN 방지)
  // - .gte('workout_sessions.started_at', <cutoff>)  (12주 전부터)
  // - 세션 단위로 group → 각 세션마다:
  //     oneRepMax = Math.max(...sets.map(s => estimateOneRepMax(s.weight_kg, s.reps)))
  //     volume = sum(weight_kg * reps)
  //     maxWeight = Math.max(...weights)
  // - 시간순 asc
  // - 결과 0~1개여도 그대로 반환 (UI에서 length < 2 빈 메시지)
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

> 두 함수 모두 null/undefined 가드 + 0/음수 가드. `fetchExerciseProgression`이 추가로 SQL 레벨에서 not-null 필터링하지만, 함수 자체도 안전하게 처리해 NaN 전파 차단.

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
| `/history` | MOD | 캘린더 탭 + 리스트 탭 + 차트 카드 + 모달 2개. URL `?y=2026&m=6` (m **1-indexed**, 사용자 친화). 범위 밖 입력 시 오늘 달로 fallback. |
| `/history/[sessionId]` | — | 안 만듦 (모달로 처리) |
| 라우트 추가 | — | 없음 |

---

## 7. 오류 처리 / UX states

- `/history/loading.tsx` (이미 존재) — 캘린더 + 차트 카드 영역 skeleton 추가 (6주×7 셀 grid + 8 카드 placeholder)
- `/history/error.tsx` — 그대로
- SessionDetailDialog / ExerciseProgressDialog: useQuery `isLoading` → Skeleton inside dialog, `error` → 빈 메시지 + 재시도 안내
- ProgressLine: `data.length < 2` → "기록 부족" 메시지 카드
- 캘린더 빈 달(monthSessions 0): "이 달엔 기록이 없어요" + 이전 달 버튼
- TopExercises 0개(신규 사용자): "아직 추이를 보여줄 운동이 없어요. 헬스장에서 더 채워보세요." + /workout/new 링크
- **같은 날 여러 세션:** MiniCalendar 셀에 도트만 표시(개수 구분 X), 클릭 시 첫 sessionId만 모달로. aria-label에 `세션 N개`로 카운트 노출 (스크린리더). 여러 세션 picker UI는 Plan 4.1+ 후보.
- **월 navigation 로딩:** `useTransition` + `router.push({ scroll: false })`. `isPending` 동안 캘린더 컨테이너에 `opacity-60` → 부드러운 전환.
- **recharts SSR/hydration:** ProgressLine / MultiSeriesChart 모두 `"use client"`. 서버에서는 ResponsiveContainer 자식이 0x0으로 렌더 → 클라이언트 hydration 시 width/height 계산. dimension prop 명시 (`<ResponsiveContainer width="100%" height="100%">`)로 hydration mismatch 없음. 부모 컨테이너에 명시적 높이(`h-16`, `h-64`) 부여로 ResponsiveContainer가 0 높이 trap 안 빠짐.

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
| recharts ResponsiveContainer 가 jsdom에서 0×0 — 테스트 실패 | 중간 | ProgressLine은 데이터 가공 로직(증감 계산)만 단위 테스트. 차트 렌더링 자체는 manual E2E로 검증. 필요 시 `vi.mock('recharts')`로 stub. |
| `fetchSessionsInMonth`가 큰 join (sessions × sets × exercises × ebp × body_parts) | 중간 | 한 달 ≤ 31 sessions, ≤ 200 sets. 단일 query로 충분. Plan 5 이후 materialized view 검토. |
| 1RM Epley 공식이 reps > 12 일 때 오차 큼 | 낮음 | 헬스장 메인 세트 보통 1~12회. >12회는 근지구력 영역이라 1RM 자체 적용 부적합 → 차트엔 그대로 표시. |
| body_parts 추가/색 변경 시 — | 낮음 | DB seed에 row 추가만 하면 모든 UI 자동 반영 (단일 진실 소스). 코드 변경 0. |
| weight_kg / reps 가 NULL 인 세트 → Epley NaN | 해결됨 | `estimateOneRepMax`/`calcSetVolume`에 null 가드 + `fetchExerciseProgression`에 SQL `.not('weight_kg','is',null)` 이중 차단. |
| SessionDetailDialog `useQuery` 결과 캐시가 모달 닫혀도 살아있음 | 낮음 | 캐시 살아있음 → 같은 세션 재오픈 시 즉시 표시. queryKey에 sessionId 포함되어 분리. |
| /history URL `?y&m` 직접 입력 (예: y=2050, m=15) | 낮음 | safeYear/safeMonth 범위 검증 후 오늘 달로 fallback. 빈 결과 → "이 달엔 기록이 없어요". |
| recharts dependency 신규 추가로 번들 사이즈 | 낮음 | 18kB gzip. /history에만 dynamic import 고려 (Phase 4.1에서 최적화). |
| Dashboard 미니 캘린더가 lg에서 너무 큰가 | 낮음 | `size="sm"` props + lg에서 컨테이너 max-w 제한. /history는 `size="md"`. |
| 캐시 stale: 새 세션 끝나도 /history 캘린더에 안 보임 | 해결됨 | **`finishSession`(in `src/app/(app)/workout/actions.ts`)에 `revalidatePath('/history')` 명시적 추가** — Chunk 7 sub-task로 포함. 기존 `revalidatePath('/dashboard')` 유지. |
| StartForm에서 부위 chip 토글 시 excludedExerciseIds 잔존 — 다른 부위 추천에 옛 제외 ID 남음 | 낮음 | `toggleBP` 내부에서 `setExcludedExerciseIds(new Set())` 명시적 호출 (useEffect 아님). |
| 같은 날 여러 세션 → 첫 세션만 모달 표시 | 낮음 | 사용자 대부분 하루 1회 운동. 다중 세션 picker UI는 Plan 4.1+. `aria-label`로 카운트 노출. |
| 월 navigation 시 RSC 재호출 동안 빈 화면 | 낮음 | `useTransition` + `router.push({ scroll: false })`. `isPending` 동안 캘린더 `opacity-60`로 transition 인디케이터. |
| recharts SSR hydration warning | 낮음 | 모든 차트 컴포넌트 `"use client"`. 부모에 명시적 높이 + `<ResponsiveContainer width="100%" height="100%">`로 dimension mismatch 없음. |

---

## 10. Implementation Order (Chunks 미리보기)

| Chunk | 내용 | 예상 |
|------:|------|------|
| 1 | recharts 의존성 추가 + `one-rep-max.ts` (null 가드) + `body-part-color.ts` 헬퍼 + tests (4 Epley tests) | 1h |
| 2 | `MiniCalendar` (6주 고정 그리드, role/aria, DayEntry props) + tests (2 tests — 도트 + 클릭 콜백) | 1.5h |
| 3 | `fetchSessionsInMonth` (body_parts.color join, is_primary 필터) + Dashboard 미니 캘린더 교체 + 회귀 22 PASS | 1.5h |
| 4 | `fetchSessionWithDetails` (color 포함) + 클라이언트 wrapper `sessions-client.ts` + `SessionDetailDialog` (formatDateKo + BodyPartTag 인라인) | 1.5h |
| 5 | `fetchExerciseProgression` (not-null SQL 필터) + `fetchTopExercises` + `ProgressLine` (span children) + `MultiSeriesChart` + `ExerciseProgressDialog` + tests (2 tests — progress-line 증감) | 2h |
| 6 | `/history` page (URL m 1-indexed, safeYear/safeMonth) + `HistoryView` 클라이언트 (탭 + useTransition 월 이동 + 같은 monthSessions로 리스트 일관성) + 모달 트리거 | 2h |
| 7 | R4 — `ExerciseRecCard` (base-ui Checkbox) + `StartForm` excludedExerciseIds wiring + 부위 chip 토글 시 reset + **`finishSession`에 `revalidatePath('/history')` 추가** (`src/app/(app)/workout/actions.ts`) | 1h |
| 8 | build / 28+ tests / `docs/import/history-charts-log.md` / PR / 머지 / `v0.4.0-history-charts` 태그 | 1h |

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
| v2 | 2026-06-01 | critic round 1 fixes: (CRITICAL) body_parts ID hardcoded 매핑이 DB seed와 5/8 부위 불일치 → CSS 토큰 시스템 폐기, **`body_parts.color` DB 컬럼 직접 사용으로 단일 진실 소스화**. RSC 쿼리들이 join으로 color fetch, 컴포넌트는 `style={{ backgroundColor }}` 직접. (CRITICAL→MAJOR) weight_kg/reps NULL 가드 — `estimateOneRepMax`/`calcSetVolume`에 null check + `fetchExerciseProgression`에 SQL `.not(...)` 이중 차단. (MAJOR) `formatDateKo`/`BodyPartTag` 인라인 정의, ExerciseProgressDialog 누락 imports(Skeleton, fetchExerciseProgressionClient) 추가. (MAJOR) Checkbox base-ui API 명시 — `(checked: boolean) => void`. (MAJOR) `finishSession`에 `revalidatePath('/history')` 추가를 Chunk 7 sub-task로 명시. (MISSING) MiniCalendar Props에 `sessionIds` 통합 → `DayEntry { bodyPartColors, sessionIds }`. 같은 날 여러 세션 → 첫 sessionId만 모달, aria-label에 카운트 노출. (MISSING) URL `m` 1-indexed로 변경(사용자 친화), safeYear/safeMonth 범위 검증. (MISSING) `<button>` 자식 `<div>` → `<span>` (HTML5 phrasing). (MISSING) MiniCalendar 6주 고정, role="grid"/gridcell + aria-label. 화살표 키 네비는 Plan 4.1로 연기. (MISSING) HistoryView 리스트 탭도 선택한 월 데이터로 통일 (탭 간 시간 범위 일관성). useTransition + router.push({ scroll: false }) 월 이동. (MISSING) recharts SSR — 부모 명시 높이 + ResponsiveContainer width/height 100%. Chunk 1에서 globals.css 토큰 작업 제거, Chunk 7에 finishSession 갱신 추가. |
