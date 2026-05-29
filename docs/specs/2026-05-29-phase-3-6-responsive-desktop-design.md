# Phase 3.6: Responsive Desktop Layout + UX Bug Fixes — Design Spec

**Date:** 2026-05-29
**Status:** Draft (brainstorming approved, pending reviewer + user gate)
**Predecessor:** Phase 3.5 Design System Renewal (merged, tag `v0.3.5-design-system`)
**Branch (planned):** `feat/phase-3-6-responsive-desktop`
**Tag (planned):** `v0.3.6-responsive-desktop`

---

## 1. Goal

Phase 3.5의 따뜻한 코랄 디자인 시스템을 **모바일 우선 유지하면서 데스크탑(`lg` 1024px+)에서 멀티컬럼 레이아웃으로 펼침**. 동시에 헬스장 1주일 실사용에서 발견된 UX 버그 3개를 같이 해결.

### 검증되는 것

| 항목 | 검증 |
|---|---|
| 모바일 (`<1024px`) | Phase 3.5와 동일한 단일 컬럼, max-w-md, bottom tab nav 신규 |
| 데스크탑 (`>=1024px`) | 좌측 sidebar nav + 메인 영역, 세션 화면은 좌측 운동 리스트 + 우측 세트 입력 2-컬럼 |
| 운동 진행 중 운동 선택 (R1) | 좌측 운동 리스트(데스크탑) 또는 운동 카드(모바일) 탭으로 active 전환 |
| 운동 카드 X 버튼 (R2) | 색 가시성 향상, swipe handler와 클릭 간섭 차단 |
| 기록 보기 버튼 (R3) | `/history` 페이지 신설 (최근 4주 세션 카드 리스트, 차트 없음) |
| Hydration | next-themes warning 0개 유지 |
| 회귀 | 기존 17 tests pass (RLS 3 + recommendation 6 + motion 3 + progress-ring 5) + 신규 4~5 tests |
| Build | `pnpm build` 0 errors, 6 routes 출력 (`/login`, `/`, `/dashboard`, `/workout/new`, `/workout/[sessionId]`, `/history`) |
| WCAG AA | sidebar/bottom tab 활성 표시 contrast 4.5:1+, X 버튼 가시성 검증 |

---

## 2. Out of Scope

- /history 차트 (recharts/visx) — Plan 3.7 이후
- 운동 순서 drag&drop 변경 — 사이드 클릭만으로 충분
- 사이드바 collapsible / 접기 — 항상 펼침 고정
- 운동 시작 옆 추가 단축 액션 — 추후
- OAuth 403 핫픽스 — 코드가 아닌 Google Cloud Console / Supabase 설정 이슈, 별도 처리

---

## 3. 추가 결정 사항 (Brainstorm 결과)

| # | 결정 | 사유 |
|---|------|------|
| Layout | **C: 하이브리드** | 대시보드는 sidebar+main, 세션은 운동리스트+세트입력 2-컬럼. R1과 시너지. |
| Breakpoint | **lg (1024px+)** | 태블릿 세로(768~1023px)는 모바일 레이아웃 유지로 단순함 |
| Nav (lg-) | **Bottom Tab 3개** | 대시보드/운동/기록, fixed bottom, 활성 탭은 코랄 |
| Nav (lg+) | **Sidebar 고정** | 좌측 220px, 같은 3개 항목 + 테마 토글 + 로그아웃 |
| R1 운동 선택 | **사이드 클릭만 active 전환** | drag&drop 불요, 사용자가 다음 할 운동을 사이드에서 탭하면 우측 세트 입력이 그 운동으로 전환 |
| R2 X 버튼 fix | **색 + 터치 간섭 동시 해결** | `text-text-ghost` → `text-text-muted`, swipe handler는 카드 본체 div에만 (X 버튼은 sibling으로 absolute) |
| R3 /history | **간단 카드 리스트** | 최근 4주 세션 카드, 차트 없음, fetchRecentSessions RSC 쿼리 신설 |

---

## 4. Architecture

### 4.1 라우트 그룹 도입

기존 페이지를 `(app)` 라우트 그룹에 묶고, 그룹 layout.tsx에 AppShell 적용.

```
src/app/
├─ layout.tsx              ← 루트 (ThemeProvider, QueryProvider)
├─ page.tsx                ← / → /dashboard redirect (변경 없음)
├─ login/page.tsx          ← /login (AppShell 미적용, 단독 페이지)
├─ auth/callback/...       ← (변경 없음)
└─ (app)/                  ← (NEW) 라우트 그룹
    ├─ layout.tsx          ← AppShell wrapper
    ├─ dashboard/
    │   ├─ page.tsx        ← (이동)
    │   ├─ Dashboard.tsx   ← (이동, lg 그리드 추가)
    │   └─ actions.ts      ← (이동)
    ├─ workout/
    │   ├─ actions.ts
    │   ├─ new/
    │   └─ [sessionId]/
    └─ history/            ← (NEW)
        ├─ page.tsx        ← RSC, fetchRecentSessions
        └─ HistoryList.tsx ← 카드 리스트 client (필요 시)
```

`/login`은 `(app)` 그룹 밖이라 sidebar/bottom tab 없이 단독 페이지. (인증 전이라 nav 노출이 의미 없음.)

### 4.2 신규 컴포넌트

#### `src/components/layout/AppShell.tsx`

```tsx
// Server Component — 페이지마다 다시 렌더되지만 children은 RSC 그대로 통과
import { Sidebar } from "./Sidebar";
import { BottomTab } from "./BottomTab";

export function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-dvh lg:flex">
      <Sidebar className="hidden lg:flex" />
      <div className="flex-1 lg:max-w-[calc(100vw-13rem)]">
        {children}
      </div>
      <BottomTab className="lg:hidden" />
    </div>
  );
}
```

> 주: `Sidebar`는 220px 고정 폭 (`w-52`). 메인 영역의 `lg:max-w-[calc(100vw-13rem)]`은 viewport - sidebar 폭으로 overflow 방지.

#### `src/components/layout/Sidebar.tsx`

```tsx
"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { LayoutDashboard, Dumbbell, BarChart3, LogOut } from "lucide-react";
import { ThemeToggle } from "@/components/ui/theme-toggle";
import { signOut } from "@/app/(app)/dashboard/actions";

const NAV = [
  { href: "/dashboard", label: "대시보드", icon: LayoutDashboard },
  { href: "/workout/new", label: "운동 시작", icon: Dumbbell },
  { href: "/history", label: "기록", icon: BarChart3 },
];

export function Sidebar({ className }: { className?: string }) {
  const pathname = usePathname();
  return (
    <nav className={cn("w-52 flex-col p-4 bg-surface-soft border-r border-border", className)}>
      <Link href="/dashboard" className="text-h2 font-extrabold mb-6 block">오운완</Link>
      <ul className="flex-1 space-y-1">
        {NAV.map(({ href, label, icon: Icon }) => {
          const active = pathname.startsWith(href);
          return (
            <li key={href}>
              <Link
                href={href}
                className={cn(
                  "flex items-center gap-2 px-3 py-2 rounded-md text-body transition-colors",
                  active ? "bg-accent text-surface font-semibold" : "text-text-muted hover:bg-accent-soft",
                )}
              >
                <Icon className="w-4 h-4" /> {label}
              </Link>
            </li>
          );
        })}
      </ul>
      <div className="flex items-center gap-1 mt-6">
        <ThemeToggle />
        <form action={signOut}>
          <Button type="submit" size="icon" variant="ghost" aria-label="로그아웃">
            <LogOut className="w-5 h-5" />
          </Button>
        </form>
      </div>
    </nav>
  );
}
```

#### `src/components/layout/BottomTab.tsx`

```tsx
"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { LayoutDashboard, Dumbbell, BarChart3 } from "lucide-react";

const TABS = [
  { href: "/dashboard", label: "홈", icon: LayoutDashboard },
  { href: "/workout/new", label: "운동", icon: Dumbbell },
  { href: "/history", label: "기록", icon: BarChart3 },
];

export function BottomTab({ className }: { className?: string }) {
  const pathname = usePathname();
  return (
    <nav
      className={cn(
        "fixed bottom-0 inset-x-0 z-40 bg-surface border-t border-border",
        "flex justify-around items-stretch h-14 pb-safe",
        className,
      )}
    >
      {TABS.map(({ href, label, icon: Icon }) => {
        const active = pathname.startsWith(href);
        return (
          <Link
            key={href}
            href={href}
            className={cn(
              "flex-1 flex flex-col items-center justify-center gap-0.5 text-caption transition-colors",
              active ? "text-accent" : "text-text-muted",
            )}
            aria-current={active ? "page" : undefined}
          >
            <Icon className="w-5 h-5" />
            <span>{label}</span>
          </Link>
        );
      })}
    </nav>
  );
}
```

> `pb-safe`는 iOS safe-area 처리. `globals.css`에 `@utility pb-safe { padding-bottom: env(safe-area-inset-bottom); }` 추가.

#### `src/components/workout/ExerciseList.tsx`

세션 페이지 좌측 운동 리스트. lg 이상에서만 렌더.

```tsx
"use client";

type Props = {
  exercises: ExerciseWithBodyParts[];
  activeExerciseId: string | null;
  completionByEx: Record<string, { saved: number; target: number }>;
  onSelectExercise: (id: string) => void;
};

export function ExerciseList({ exercises, activeExerciseId, completionByEx, onSelectExercise }: Props) {
  return (
    <aside className="hidden lg:block w-56 shrink-0 space-y-2">
      <h2 className="text-caption text-text-muted uppercase mb-2">운동 목록</h2>
      {exercises.map((ex) => {
        const c = completionByEx[ex.id] ?? { saved: 0, target: ex.default_sets ?? 3 };
        const done = c.saved >= c.target;
        const active = ex.id === activeExerciseId;
        return (
          <button
            key={ex.id}
            type="button"
            onClick={() => onSelectExercise(ex.id)}
            className={cn(
              "w-full text-left p-3 rounded-lg border transition-colors",
              active
                ? "border-2 border-accent bg-accent-soft"
                : done
                  ? "border-border bg-surface opacity-60"
                  : "border-border bg-surface hover:bg-surface-soft",
            )}
          >
            <div className="text-body font-semibold text-text">
              {done ? "✓ " : active ? "▶ " : ""}{ex.name}
            </div>
            <div className="text-caption text-text-muted">
              {c.saved}/{c.target} 세트
            </div>
          </button>
        );
      })}
    </aside>
  );
}
```

#### `src/app/(app)/history/page.tsx` (NEW)

```tsx
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { fetchRecentSessions } from "@/lib/queries/sessions";

export default async function HistoryPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const sessions = await fetchRecentSessions(user.id, 4); // 최근 4주

  return (
    <main className="p-5 max-w-md lg:max-w-3xl mx-auto pb-32">
      <h1 className="text-display font-extrabold text-text">기록</h1>
      <p className="text-body text-text-muted mt-1">최근 4주 운동 기록</p>
      <div className="mt-5 space-y-2 lg:grid lg:grid-cols-2 lg:gap-3 lg:space-y-0">
        {sessions.length === 0 ? (
          <p className="text-body text-text-muted">아직 기록이 없어요. 첫 운동을 시작해보세요.</p>
        ) : (
          sessions.map((s) => (
            <article key={s.id} className="rounded-xl border border-border p-4">
              <div className="text-caption text-text-muted">
                {new Date(s.started_at).toLocaleString("ko-KR", { dateStyle: "medium", timeStyle: "short" })}
              </div>
              <div className="text-h3 font-bold text-text mt-1">
                {s.bodyParts.join(", ") || "운동"}
              </div>
              <div className="text-body text-text-muted mt-1">
                운동 {s.exerciseCount}개 · 세트 {s.setCount}개
                {s.durationMin ? ` · ${s.durationMin}분` : ""}
              </div>
            </article>
          ))
        )}
      </div>
    </main>
  );
}
```

### 4.3 기존 컴포넌트 수정

#### `Dashboard.tsx`

- `<main>` 클래스: `p-5 max-w-md mx-auto pb-32` → `p-5 max-w-md lg:max-w-5xl mx-auto pb-32 lg:pb-5`
  - 모바일은 그대로
  - lg+은 max-w-5xl로 펼치고 bottom 패딩 제거 (sidebar에서 nav 처리)
- 진행 카드 + 주간 칩 + 최근 운동 영역을 lg에서 grid 2x2로:
  ```tsx
  <section className="mt-5 grid grid-cols-1 lg:grid-cols-2 gap-3">
    <ProgressCard ... />
    <WeeklyCard ... />
    <RecentExercisesCard className="lg:col-span-2" />
  </section>
  ```
- 헤더의 ThemeToggle + 로그아웃은 `lg:hidden`으로 (sidebar에서 처리)
- 하단 fixed CTA(`fixed bottom-5 ...`)는 `lg:static lg:mt-6`으로

#### `SessionRunner.tsx`

```tsx
const [userPickedExId, setUserPickedExId] = useState<string | null>(null);
const computedActiveId = useMemo(() => {
  // 기존 로직: 첫 미완료 운동
  for (const ex of exercises) { ... }
  return null;
}, [exercises, savedSets]);
const activeExerciseId = userPickedExId ?? computedActiveId;

// 사용자가 선택한 운동이 이미 완료되면 자동 해제
useEffect(() => {
  if (userPickedExId) {
    const targetSets = exercises.find((e) => e.id === userPickedExId)?.default_sets ?? 3;
    const saved = savedSets.filter((s) => s.exercise_id === userPickedExId && s.parent_set_id === null).length;
    if (saved >= targetSets) setUserPickedExId(null);
  }
}, [savedSets, userPickedExId, exercises]);

return (
  <div className="lg:flex lg:gap-6">
    <ExerciseList
      exercises={exercises}
      activeExerciseId={activeExerciseId}
      completionByEx={completionByEx}
      onSelectExercise={setUserPickedExId}
    />
    <div className="flex-1 space-y-4">
      {/* 기존 운동 카드 렌더 — 단, lg+에선 activeExerciseId 카드만 보여줄지 결정 필요 */}
      {/* 결정: lg+에선 active 카드만 크게, 다른 카드는 ExerciseList에 이미 들어가 있으니 메인 영역에 안 보여줌 */}
      {(lgUp ? exercises.filter((e) => e.id === activeExerciseId) : exercises).map((ex) => (
        <ExerciseCardWrapper ... />
      ))}
      <Separator />
      <Button onClick={handleFinish} ...>운동 종료</Button>
    </div>
  </div>
);
```

`lgUp` 판단은 CSS 미디어 쿼리만으로 처리 (JS 분기 없이 둘 다 렌더하고 `lg:hidden` / `hidden lg:block`으로 토글).

#### `ExerciseCardWrapper` (R2 fix)

```tsx
function ExerciseCardWrapper({ ... }) {
  const [revealed, setRevealed] = useState(false);

  // 변경 1: swipe handler를 카드 본체 div에만 붙임 (X 버튼은 별도 sibling, swipe 트랙 영향 없음)
  const swipeHandlers = useSwipeable({ ... });

  return (
    <div className="relative overflow-hidden rounded-xl mt-3">
      {/* X 버튼: swipe handler 밖에 absolute로. 클릭 우선권 확보. */}
      <button
        type="button"
        onClick={(e) => { e.stopPropagation(); onRemove(exerciseId); }}
        disabled={isRemoving}
        className={cn(
          "absolute top-2 right-2 z-10 p-2 rounded-md",
          "text-text-muted hover:text-text hover:bg-accent-soft", // 변경 2: ghost → muted (가시성 향상)
        )}
        aria-label={`${exerciseName} 운동 삭제`}
      >
        <X className="w-5 h-5" />
      </button>

      {/* swipe-revealed 삭제 버튼 (기존 그대로) */}
      <button ... className="absolute right-0 top-0 bottom-0 w-20 ...">삭제</button>

      {/* 카드 본체 — swipe handler 여기에만 */}
      <Card {...swipeHandlers} className={cn("p-4 ...", revealed && "-translate-x-20", ...)} onClick={...}>
        {children}
      </Card>
    </div>
  );
}
```

> 핵심 변화: X 버튼이 swipe-tracked div 밖으로 빠짐 → 모바일 터치가 swipe로 잘못 해석되지 않음. `z-10`으로 카드 위에 올라옴.

---

## 5. 데이터 흐름

### 5.1 신규 쿼리: `fetchRecentSessions`

```ts
// src/lib/queries/sessions.ts (추가)
export type RecentSession = {
  id: string;
  started_at: string;
  ended_at: string | null;
  bodyParts: string[];        // 한국어 이름
  exerciseCount: number;
  setCount: number;
  durationMin: number | null;
};

export async function fetchRecentSessions(
  userId: string,
  weeksBack: number = 4,
): Promise<RecentSession[]> {
  const supabase = await createClient();
  const cutoff = new Date(Date.now() - weeksBack * 7 * 86_400_000).toISOString();
  const { data, error } = await supabase
    .from("workout_sessions")
    .select(`
      id,
      started_at,
      ended_at,
      workout_sets!inner (
        exercise_id,
        parent_set_id,
        exercises!inner (
          exercise_body_parts (
            body_parts ( name_ko )
          )
        )
      )
    `)
    .eq("user_id", userId)
    .gte("started_at", cutoff)
    .order("started_at", { ascending: false });
  if (error) throw error;
  // ...aggregate exerciseCount, setCount, bodyParts, durationMin
  return (data ?? []).map(/* aggregation */);
}
```

> 한 번의 쿼리로 세션+세트+운동+부위 join. `bodyParts`는 unique deduplicated 한국어 이름 배열.

### 5.2 기존 쿼리 변경 없음

`fetchTodaySession`, `fetchWeeklySessionDates`, `fetchRecentExerciseHistory`, `fetchLastMainSetsByExercise` — 모두 그대로.

---

## 6. 라우팅 / 페이지 구조

| 경로 | RSC | 클라이언트 | 인증 가드 | AppShell |
|------|-----|----------|---------|----------|
| `/` | redirect → /dashboard | - | - | - |
| `/login` | - | Login form | - | ❌ |
| `/auth/callback` | RSC | - | - | ❌ |
| `/dashboard` | page.tsx (3 쿼리) | Dashboard.tsx | yes | ✅ |
| `/workout/new` | page.tsx (4 쿼리) | StartForm | yes | ✅ |
| `/workout/[sessionId]` | page.tsx (4 쿼리) | SessionRunner | yes + session.user_id 검증 | ✅ |
| `/history` | page.tsx (1 쿼리) | (없음, 카드는 server-rendered) | yes | ✅ |

---

## 7. 오류 처리 / UX states

- `(app)/layout.tsx`에 AppShell만 적용. 인증 가드는 각 페이지의 RSC에서 (기존과 동일).
- 신규 `(app)/history/loading.tsx` + `(app)/history/error.tsx` 추가 — Phase 3.5와 동일한 톤 (`text-h2 font-extrabold`, `잠시 멈췄어요`, 등).
- 기존 5개 loading/error/not-found는 `(app)/` 그룹 안으로 이동 시 그대로 작동 (변경 없음).
- BottomTab 활성 표시: `usePathname()` startsWith 매칭. `/dashboard` 와 `/dashboard/anything` 모두 활성.
- Sidebar도 동일 패턴.
- AppShell이 SSR 시 모바일/데스크탑 둘 다 렌더 → hydration 후 CSS 미디어 쿼리로 토글. hydration warning 발생 안 함 (둘 다 markup에 존재).

---

## 8. 테스트 전략

### 8.1 회귀 (변경 없이 그대로 통과)
- `tests/rls/isolation.test.ts` — 3 tests
- `tests/workout/recommendation.test.ts` — 6 tests
- `tests/lib/motion.test.ts` — 3 tests
- `tests/components/progress-ring.test.tsx` — 5 tests
- 총 17개 그대로 PASS

### 8.2 신규 (4~5 tests)
- `tests/components/app-shell.test.tsx` — Sidebar/BottomTab 동시 렌더 + 클래스 토글 검증 (1 test)
- `tests/components/sidebar.test.tsx` — usePathname mock으로 active state 검증 (1 test)
- `tests/components/bottom-tab.test.tsx` — 동일 (1 test)
- `tests/components/exercise-list.test.tsx` — onSelectExercise 콜백 호출 + 완료/활성 시각 표시 (1~2 tests)

> `fetchRecentSessions`는 Supabase 의존성이 커서 단위 테스트보다는 통합 테스트(별도 환경)로 검증. Plan 3.6 스코프에서는 RLS isolation regression(쿼리 작동 + 본인 데이터만 노출)만 확인.

### 8.3 수동 E2E (PR 머지 전)
- iPhone 14 Pro 시뮬레이션: bottom tab으로 페이지 이동 ✓
- iPad 시뮬레이션 (768~1023px): 모바일 레이아웃 유지 확인
- 데스크탑 1280px: sidebar + 세션 2-컬럼 작동
- 운동 진행 중 사이드 클릭 → 우측 세트 입력 즉시 전환
- 운동 카드 X 버튼: 모바일 swipe 안 깨짐, X 단독 탭으로도 삭제 확인 dialog 노출
- /history: 최근 4주 세션 카드 N개 표시 (없으면 빈 상태 메시지)
- WCAG: sidebar 활성 탭, bottom tab 활성 탭, X 버튼 contrast 4.5:1 이상 (DevTools Lighthouse)

---

## 9. Risks & Mitigations

| 리스크 | 영향 | 완화 |
|--------|------|------|
| `(app)` 라우트 그룹 이동 시 import 경로 깨짐 | 중간 | `find` + `sed`로 일괄 변경. 빌드로 검증. 별도 chunk로 격리. |
| AppShell이 모든 (app) 페이지에 BottomTab 렌더 → 모바일 viewport 하단 14h 잠식 | 중간 | 각 `<main>`에 `pb-32` 또는 충분한 bottom padding 유지 (이미 적용됨) |
| Sidebar usePathname() SSR 시 빈 문자열 → 활성 표시 깜빡임 | 낮음 | Sidebar/BottomTab을 `"use client"`로. 초기 렌더에서 active 미반영 → next-themes 패턴과 동일 (mounted guard 없이도 1tick 후 hydration) |
| `(app)/workout/[sessionId]/SessionRunner.tsx`에서 lg/sm 둘 다 운동 카드 렌더 → DOM 중복 | 낮음 | `hidden lg:block` / `lg:hidden`으로 토글. 모바일 카드 N개 vs 데스크탑 active 카드 1개. 화면에는 한쪽만 보임. |
| ExerciseCardWrapper의 X 버튼이 swipe-tracked div 밖으로 빠지면 swipe 시 X도 따라 이동 안 함 → 시각적 어색 | 낮음 | X 버튼 `absolute top-2 right-2` — 카드 본체 위에 떠 있으니 swipe로 카드만 좌측 이동, X는 제자리. 의도된 동작. |
| `fetchRecentSessions` join 비효율 (세션 N x 세트 M x 운동 K) | 중간 | 4주 윈도우면 N <= 30, M <= 300. 단일 query로 충분. Plan 3.7에서 view/materialized view 검토. |
| /history 빈 상태 (신규 사용자) | 낮음 | 빈 상태 메시지 + /workout/new 링크 |
| Bottom tab + iOS safe-area inset | 낮음 | `pb-safe` 유틸 추가, `env(safe-area-inset-bottom)` 적용 |
| 라우트 그룹 이동으로 dev server hot reload 깨짐 | 낮음 | dev restart 1회로 해결 |
| 데스크탑 sidebar 활성 표시 + 모바일 bottom tab 활성 표시가 다른 코드라 중복 | 낮음 | 둘 다 `usePathname().startsWith()`로 동일 로직. 추후 hook으로 추출 가능 (Plan 3.7) |

---

## 10. Implementation Order (Chunks 미리보기)

상세 task는 plan 문서(writing-plans 단계)에서 작성. 여기는 chunk 단위 개요만:

| Chunk | 내용 | 예상 |
|------:|------|------|
| 1 | `(app)` 라우트 그룹 생성 + 기존 페이지 이동 + 빌드 확인 | 0.5h |
| 2 | AppShell + Sidebar + BottomTab + 신규 컴포넌트 테스트 | 2h |
| 3 | Dashboard lg 그리드 + 모바일/데스크탑 nav 충돌 정리 | 1.5h |
| 4 | SessionRunner 2-컬럼 + ExerciseList + userPickedExId state | 2.5h |
| 5 | ExerciseCardWrapper X 가시성 + swipe handler 격리 + 회귀 테스트 | 1h |
| 6 | /history page + fetchRecentSessions query | 2h |
| 7 | loading/error 페이지 lg 분기 + WCAG/manual E2E 점검 | 1h |
| 8 | build / test / log / PR / 머지 / `v0.3.6` 태그 | 1h |

총 ~11.5h (1.5일 작업).

---

## 11. References

- Phase 3.5 spec: `docs/specs/2026-05-28-design-system-design.md`
- Phase 3.5 plan: `docs/plans/2026-05-28-phase-3-5-design-system.md`
- Phase 3.5 completion log: `docs/import/design-system-renewal-log.md`
- shadcn / base-ui Dialog: `src/components/ui/dialog.tsx` (render prop API 그대로 사용)
- next-themes 패턴: Phase 3.5 layout.tsx 참조

---

## Revision History

| Version | Date | Change |
|---------|------|--------|
| v1 | 2026-05-29 | Initial draft after brainstorming session (사용자 선택: 레이아웃 C / lg breakpoint / bottom tab / 사이드 클릭 / 간단 history / X fix) |
