# Phase 3.6: Responsive Desktop Layout + UX Fixes Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Phase 3.5의 모바일 우선 코랄 디자인 시스템을 유지하면서 `lg`(1024px+)에서 sidebar+main(대시보드) / 운동리스트+세트입력(세션) 멀티컬럼 레이아웃으로 펼치고, 헬스장 1주일 실사용에서 발견된 UX 버그 3개(운동 선택 강제 순차 / X 버튼 미작동 / 기록 버튼 데드) 해결.

**Architecture:** Next.js App Router `(app)` route group + AppShell wrapper. lg 분기는 Tailwind `lg:` 클래스만으로 처리(JS 미디어쿼리 없음, hydration mismatch 차단). SessionRunner는 모바일/데스크탑 두 DOM 트리를 같은 state로 공유. 신규 RSC 쿼리 1개(`fetchRecentSessions`)로 /history 카드 리스트 노출.

**Tech Stack:** Next.js 16 / React 19 / TypeScript 5 / Tailwind CSS v4 / `react-swipeable` (이미 설치됨) / `@tanstack/react-query` v5

**Reference docs:**
- Spec: `docs/specs/2026-05-29-phase-3-6-responsive-desktop-design.md` (v3, critic 2라운드 통과)
- Phase 3.5 plan: `docs/plans/2026-05-28-phase-3-5-design-system.md` (이전 단계, 머지됨)
- Phase 3.5 completion log: `docs/import/design-system-renewal-log.md`

**완료 시점에 검증되는 것:**

| 항목 | 검증 |
|---|---|
| 모바일 (`<1024px`) | 기존 단일 컬럼 그대로 + BottomTab 노출 |
| 데스크탑 (`>=1024px`) | Sidebar 좌측 고정 + 메인 영역 멀티컬럼 |
| 세션 화면 lg | 운동 리스트(좌) + 활성 운동 세트 입력(우) 2-컬럼 |
| 운동 클릭 active 전환 (R1) | `userPickedExId` state로 사용자 선택 우선 |
| X 버튼 (R2) | 색 `text-text-muted` + swipe-tracked div 밖 sibling, 모바일 swipe도 작동 |
| 기록 페이지 (R3) | `/history` 신규, 최근 4주 세션 카드 리스트 |
| Hydration | next-themes warning 0개 유지 |
| 회귀 | 17 → 21+ tests pass |
| Build | `pnpm build` 0 errors, 7 routes (login/dashboard/workout/[id]/workout/new/history/auth/callback/root) |

**스코프 명시 — 이 plan에 포함 안 됨 (Plan 3.7+):**
- ❌ /history 차트 (recharts 등)
- ❌ 운동 drag&drop 순서 변경
- ❌ 사이드바 collapsable
- ❌ Magic link / 인앱 브라우저 OAuth 우회
- ❌ ExerciseList 화살표 키 네비게이션

---

## 데이터 흐름 한눈에

```
모바일 (<1024px)
  ┌─ AppShell ──────────────────┐
  │  /dashboard | /workout/* | /history
  │  ┌──────────────────────┐   │
  │  │ main (max-w-md)      │   │
  │  └──────────────────────┘   │
  │  ┌──────────────────────┐   │
  │  │ BottomTab (홈/운동/기록) │   │
  │  └──────────────────────┘   │
  └──────────────────────────────┘

데스크탑 (>=1024px)
  ┌─ AppShell ────────────────────────────────┐
  │  ┌─ Sidebar ─┐  ┌─ main (max-w-5xl) ───┐  │
  │  │ 오운완      │  │ 페이지 콘텐츠            │  │
  │  │ ▸ 대시보드  │  │  (lg: 그리드 or 분할)   │  │
  │  │ ▷ 운동      │  │                       │  │
  │  │ ▷ 기록      │  └───────────────────────┘  │
  │  │ 테마·로그아웃 │                             │
  │  └────────────┘                             │
  └──────────────────────────────────────────────┘

세션 화면 lg:
  Sidebar | ExerciseList (w-56) | active 운동 카드 1개 + 운동 종료
```

---

## Chunk 1: Route Group Migration

**목표:** `src/app/` 하위 페이지를 `src/app/(app)/`로 이동 + 모든 import 경로 갱신. URL은 그대로 (route group은 URL에 영향 없음). 빌드/회귀 17 PASS 확인.

### Task 1.1: 브랜치 확인 + 디렉토리 이동

**Files:**
- Move: 13개 파일 (`src/app/dashboard/*`, `src/app/workout/**/*`)
- Create dir: `src/app/(app)/`

- [ ] **Step 1.1.1: 브랜치 확인**

```bash
cd "/Users/jeonhyejin/Desktop/사이드프로젝트/gym-routine-app"
git status
git branch --show-current
```

Expected: `feat/phase-3-6-responsive-desktop` + working tree clean (단, `docs/specs/...` 만 이미 커밋된 상태).

- [ ] **Step 1.1.2: `(app)` 라우트 그룹 디렉토리 생성**

```bash
mkdir -p 'src/app/(app)/dashboard' 'src/app/(app)/workout/new' 'src/app/(app)/workout/[sessionId]' 'src/app/(app)/history'
```

- [ ] **Step 1.1.3: 기존 파일 이동 (git mv)**

```bash
git mv src/app/dashboard/page.tsx 'src/app/(app)/dashboard/page.tsx'
git mv src/app/dashboard/Dashboard.tsx 'src/app/(app)/dashboard/Dashboard.tsx'
git mv src/app/dashboard/actions.ts 'src/app/(app)/dashboard/actions.ts'

git mv src/app/workout/actions.ts 'src/app/(app)/workout/actions.ts'

git mv src/app/workout/new/page.tsx 'src/app/(app)/workout/new/page.tsx'
git mv src/app/workout/new/StartForm.tsx 'src/app/(app)/workout/new/StartForm.tsx'
git mv src/app/workout/new/start-form-types.ts 'src/app/(app)/workout/new/start-form-types.ts'
git mv src/app/workout/new/loading.tsx 'src/app/(app)/workout/new/loading.tsx'
git mv src/app/workout/new/error.tsx 'src/app/(app)/workout/new/error.tsx'

git mv 'src/app/workout/[sessionId]/page.tsx' 'src/app/(app)/workout/[sessionId]/page.tsx'
git mv 'src/app/workout/[sessionId]/SessionRunner.tsx' 'src/app/(app)/workout/[sessionId]/SessionRunner.tsx'
git mv 'src/app/workout/[sessionId]/loading.tsx' 'src/app/(app)/workout/[sessionId]/loading.tsx'
git mv 'src/app/workout/[sessionId]/error.tsx' 'src/app/(app)/workout/[sessionId]/error.tsx'
git mv 'src/app/workout/[sessionId]/not-found.tsx' 'src/app/(app)/workout/[sessionId]/not-found.tsx'

rmdir src/app/workout/new src/app/workout/[sessionId] src/app/workout src/app/dashboard 2>/dev/null || true
```

- [ ] **Step 1.1.4: 이동 검증**

```bash
ls 'src/app/(app)/' && ls 'src/app/(app)/dashboard/' && ls 'src/app/(app)/workout/' && ls 'src/app/(app)/history/'
```

Expected: history는 빈 디렉토리(Chunk 6에서 채움), 나머지 디렉토리에 파일 다 들어있음.

---

### Task 1.2: Import 경로 일괄 갱신

**Files:**
- Modify: `src/app/(app)/dashboard/Dashboard.tsx` (import `signOut`)
- Modify: `src/app/(app)/workout/[sessionId]/SessionRunner.tsx` (import workout actions)
- Modify: `src/app/(app)/workout/new/StartForm.tsx` (import workout actions)
- 추가로 grep으로 찾아 갱신

- [ ] **Step 1.2.1: 옛 경로 사용처 grep**

```bash
grep -rn "@/app/dashboard\|@/app/workout" src tests 2>/dev/null
```

Expected: 3~5건 정도 출력. 모두 갱신 대상.

- [ ] **Step 1.2.2: `@/app/dashboard/...` → `@/app/(app)/dashboard/...` 일괄 치환**

```bash
grep -rl "@/app/dashboard\b" src tests 2>/dev/null | xargs sed -i '' 's|@/app/dashboard|@/app/(app)/dashboard|g'
```

> macOS sed는 `-i ''` 형식. Linux면 `-i` 만.

- [ ] **Step 1.2.3: `@/app/workout/...` → `@/app/(app)/workout/...` 일괄 치환**

```bash
grep -rl "@/app/workout\b" src tests 2>/dev/null | xargs sed -i '' 's|@/app/workout|@/app/(app)/workout|g'
```

- [ ] **Step 1.2.4: 잔존 확인 (옛 경로가 0건이어야 함)**

```bash
grep -rn "@/app/dashboard\|@/app/workout" src tests 2>/dev/null | grep -v "(app)"
```

Expected: **출력 없음**. 옛 경로가 0건이면 통과.

- [ ] **Step 1.2.5: TypeCheck (0 errors)**

```bash
pnpm tsc --noEmit
```

- [ ] **Step 1.2.6: 회귀 테스트 (17 PASS)**

```bash
pnpm test
```

Expected: `Test Files 4 passed (4)`, `Tests 17 passed (17)`.

- [ ] **Step 1.2.7: 빌드 확인**

```bash
pnpm build 2>&1 | tail -20
```

Expected: 6개 라우트 출력 (`/`, `/_not-found`, `/auth/callback`, `/dashboard`, `/login`, `/workout/[sessionId]`, `/workout/new`). URL은 변경 없음.

- [ ] **Step 1.2.8: 커밋**

```bash
git add -A
git commit -m "$(cat <<'EOF'
refactor(phase-3-6): move pages into (app) route group + update imports

- Move dashboard, workout/* into src/app/(app)/ route group
- Update all @/app/dashboard|workout imports to @/app/(app)/...
- URL paths unchanged (route group is folder-only)
- Prepare for AppShell wrapper in next chunk
EOF
)"
```

---

## Chunk 2: AppShell + Sidebar + BottomTab

**목표:** `(app)/layout.tsx`에 AppShell 마운트. Sidebar(lg+) + BottomTab(lg-) 컴포넌트 구현. `pb-safe` 유틸 globals.css 추가. 컴포넌트 단위 테스트 3개.

### Task 2.1: pb-safe 유틸 + 컴포넌트 디렉토리

**Files:**
- Modify: `src/app/globals.css` (pb-safe 유틸 추가)
- Create dirs: `src/components/layout/`, `tests/components/layout/`

- [ ] **Step 2.1.1: `pb-safe` 유틸 globals.css에 추가**

`src/app/globals.css` 끝 (마지막 `@layer base` 다음)에 추가:

```css
@utility pb-safe {
  padding-bottom: env(safe-area-inset-bottom);
}
```

- [ ] **Step 2.1.2: 빌드 확인**

```bash
pnpm build 2>&1 | tail -5
```

Expected: 0 errors. `pb-safe` 클래스가 Tailwind v4 `@utility`로 등록됨.

- [ ] **Step 2.1.3: 컴포넌트 디렉토리 생성**

```bash
mkdir -p src/components/layout tests/components/layout
```

---

### Task 2.2: Sidebar 컴포넌트 작성

**Files:**
- Create: `src/components/layout/Sidebar.tsx`

- [ ] **Step 2.2.1: Sidebar 작성**

```tsx
// src/components/layout/Sidebar.tsx
"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LayoutDashboard, Dumbbell, BarChart3, LogOut } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { ThemeToggle } from "@/components/ui/theme-toggle";
import { signOut } from "@/app/(app)/dashboard/actions";

const NAV = [
  {
    href: "/dashboard",
    label: "대시보드",
    icon: LayoutDashboard,
    matchPrefix: "/dashboard",
  },
  {
    href: "/workout/new",
    label: "운동 시작",
    icon: Dumbbell,
    matchPrefix: "/workout",
  },
  {
    href: "/history",
    label: "기록",
    icon: BarChart3,
    matchPrefix: "/history",
  },
];

export function Sidebar({ className }: { className?: string }) {
  const pathname = usePathname();
  return (
    <nav
      className={cn(
        "w-52 flex-col p-4 bg-accent-soft border-r border-border",
        className,
      )}
    >
      <Link href="/dashboard" className="text-h2 font-extrabold mb-6 block">
        오운완
      </Link>
      <ul className="flex-1 space-y-1">
        {NAV.map(({ href, label, icon: Icon, matchPrefix }) => {
          const active = pathname.startsWith(matchPrefix);
          return (
            <li key={href}>
              <Link
                href={href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "flex items-center gap-2 px-3 py-2 rounded-md text-body transition-colors",
                  active
                    ? "bg-accent text-surface font-semibold"
                    : "text-text-muted hover:bg-surface",
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

- [ ] **Step 2.2.2: Sidebar 단위 테스트 (RED → GREEN)**

```tsx
// tests/components/layout/sidebar.test.tsx
import { render, screen } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import { Sidebar } from "@/components/layout/Sidebar";

vi.mock("next/navigation", () => ({
  usePathname: () => "/workout/abc-123",
}));

vi.mock("@/app/(app)/dashboard/actions", () => ({
  signOut: async () => {},
}));

describe("Sidebar", () => {
  it("'/workout/<id>'에서 운동 시작 nav를 활성으로 표시한다", () => {
    render(<Sidebar />);
    const workoutLink = screen.getByRole("link", { name: /운동 시작/ });
    expect(workoutLink).toHaveAttribute("aria-current", "page");
  });
});
```

> 주: `@testing-library/react` + `jsdom`이 dev deps에 이미 있어야 함. 없으면 다음 step에서 추가.

- [ ] **Step 2.2.3: 테스트 의존성 확인**

```bash
pnpm list @testing-library/react @testing-library/jest-dom jsdom 2>&1 | head -10
```

없으면 설치:

```bash
pnpm add -D @testing-library/react @testing-library/jest-dom jsdom
```

vitest.config.ts에 `test.environment = 'jsdom'` 또는 파일별 `// @vitest-environment jsdom` 주석 확인.

- [ ] **Step 2.2.4: 테스트 RED 확인 (만약 ThemeToggle/Button render 이슈 시 컴포넌트 조정)**

```bash
pnpm vitest run tests/components/layout/sidebar.test.tsx
```

Expected: PASS (위 mock 적용 시).

---

### Task 2.3: BottomTab 컴포넌트 작성

**Files:**
- Create: `src/components/layout/BottomTab.tsx`
- Create: `tests/components/layout/bottom-tab.test.tsx`

- [ ] **Step 2.3.1: BottomTab 작성**

```tsx
// src/components/layout/BottomTab.tsx
"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LayoutDashboard, Dumbbell, BarChart3 } from "lucide-react";
import { cn } from "@/lib/utils";

const TABS = [
  {
    href: "/dashboard",
    label: "홈",
    icon: LayoutDashboard,
    matchPrefix: "/dashboard",
  },
  {
    href: "/workout/new",
    label: "운동",
    icon: Dumbbell,
    matchPrefix: "/workout",
  },
  {
    href: "/history",
    label: "기록",
    icon: BarChart3,
    matchPrefix: "/history",
  },
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
      {TABS.map(({ href, label, icon: Icon, matchPrefix }) => {
        const active = pathname.startsWith(matchPrefix);
        return (
          <Link
            key={href}
            href={href}
            aria-current={active ? "page" : undefined}
            className={cn(
              "flex-1 flex flex-col items-center justify-center gap-0.5 text-caption transition-colors",
              active ? "text-accent" : "text-text-muted",
            )}
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

- [ ] **Step 2.3.2: BottomTab 단위 테스트**

```tsx
// tests/components/layout/bottom-tab.test.tsx
import { render, screen } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import { BottomTab } from "@/components/layout/BottomTab";

vi.mock("next/navigation", () => ({
  usePathname: () => "/history",
}));

describe("BottomTab", () => {
  it("/history 경로에서 기록 탭을 활성으로 표시한다", () => {
    render(<BottomTab />);
    const historyTab = screen.getByRole("link", { name: /기록/ });
    expect(historyTab).toHaveAttribute("aria-current", "page");
  });
});
```

- [ ] **Step 2.3.3: 테스트 PASS 확인**

```bash
pnpm vitest run tests/components/layout/bottom-tab.test.tsx
```

---

### Task 2.4: AppShell + (app)/layout.tsx 마운트

**Files:**
- Create: `src/components/layout/AppShell.tsx`
- Create: `src/app/(app)/layout.tsx`
- Create: `tests/components/layout/app-shell.test.tsx`

- [ ] **Step 2.4.1: AppShell 작성**

```tsx
// src/components/layout/AppShell.tsx
import { Sidebar } from "./Sidebar";
import { BottomTab } from "./BottomTab";

export function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-dvh lg:flex">
      <Sidebar className="hidden lg:flex" />
      <div className="flex-1 lg:max-w-[calc(100vw-13rem)]">{children}</div>
      <BottomTab className="lg:hidden" />
    </div>
  );
}
```

- [ ] **Step 2.4.2: `(app)/layout.tsx` 작성**

```tsx
// src/app/(app)/layout.tsx
import { AppShell } from "@/components/layout/AppShell";

export default function AppGroupLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <AppShell>{children}</AppShell>;
}
```

- [ ] **Step 2.4.3: AppShell 단위 테스트**

```tsx
// tests/components/layout/app-shell.test.tsx
import { render } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import { AppShell } from "@/components/layout/AppShell";

vi.mock("next/navigation", () => ({
  usePathname: () => "/dashboard",
}));

vi.mock("@/app/(app)/dashboard/actions", () => ({
  signOut: async () => {},
}));

describe("AppShell", () => {
  it("Sidebar와 BottomTab을 모두 렌더하고 반응형 클래스로 토글한다", () => {
    const { container } = render(
      <AppShell>
        <main>content</main>
      </AppShell>,
    );
    // sidebar: hidden lg:flex
    const nav = container.querySelectorAll("nav");
    expect(nav.length).toBe(2); // sidebar + bottom tab
    expect(nav[0].className).toContain("hidden");
    expect(nav[0].className).toContain("lg:flex");
    expect(nav[1].className).toContain("lg:hidden");
  });
});
```

- [ ] **Step 2.4.4: 회귀 테스트 (20+ PASS)**

```bash
pnpm vitest run
```

Expected: 17 기존 + 3 신규 = 20 tests pass.

- [ ] **Step 2.4.5: TypeCheck + lint + 빌드**

```bash
pnpm tsc --noEmit && pnpm lint && pnpm build 2>&1 | tail -10
```

Expected: 0 errors. 빌드 출력에 6 routes (history는 아직 없음).

- [ ] **Step 2.4.6: 커밋**

```bash
git add -A
git commit -m "$(cat <<'EOF'
feat(phase-3-6): AppShell + Sidebar + BottomTab + pb-safe utility

- AppShell renders both Sidebar (hidden lg:flex) and BottomTab (lg:hidden)
- CSS-only responsive toggle, no JS media query, no hydration issues
- Sidebar/BottomTab share matchPrefix pattern (/workout matches /workout/<id>)
- pb-safe utility added to globals.css for iOS safe-area
- 3 unit tests covering active state matching
EOF
)"
```

---

## Chunk 3: Dashboard lg Grid + BarChart3 Removal

**목표:** Dashboard 헤더의 ThemeToggle/로그아웃을 `lg:hidden`으로(sidebar에서 처리). 진행/주간/최근 영역 lg에서 grid 2x2. BarChart3 dead button 제거. `<main>` max-w lg 분기.

### Task 3.1: Dashboard.tsx 헤더 + 그리드 + CTA

**Files:**
- Modify: `src/app/(app)/dashboard/Dashboard.tsx`
- Modify: `src/app/(app)/dashboard/page.tsx` (main className)

- [ ] **Step 3.1.1: Dashboard.tsx 현재 상태 확인**

```bash
cat 'src/app/(app)/dashboard/Dashboard.tsx' | head -80
```

기존 구조 파악 — `<main className="p-5 max-w-md mx-auto pb-32">` + header(점수 + ThemeToggle + 로그아웃) + 진행 카드 + 주간 칩 + 최근 운동 + 하단 fixed CTA (운동 시작 + BarChart3).

- [ ] **Step 3.1.2: page.tsx `<main>` max-w lg 확장**

`src/app/(app)/dashboard/page.tsx`에서 Dashboard를 감싸는 `<main>` (있다면) 또는 Dashboard.tsx 내부 `<main>` 클래스를 다음으로:

```diff
- <main className="p-5 max-w-md mx-auto pb-32">
+ <main className="p-5 max-w-md lg:max-w-5xl mx-auto pb-32 lg:pb-5">
```

- [ ] **Step 3.1.3: Dashboard.tsx 헤더 액션 lg 숨김**

기존 헤더의 `<div className="flex items-center gap-1">` (ThemeToggle + signOut) 부분을:

```diff
- <div className="flex items-center gap-1">
+ <div className="flex items-center gap-1 lg:hidden">
```

> lg+에선 sidebar에서 동일 액션 노출되므로 헤더 중복 제거.

- [ ] **Step 3.1.4: 진행 / 주간 / 최근 영역 grid 2x2**

```tsx
{/* before: 각 카드 sequential. after: grid 2x2 (lg+) */}
<section className="mt-5 grid grid-cols-1 lg:grid-cols-2 gap-3">
  {/* 진행 카드 (기존) */}
  <Card className="p-4 flex items-center gap-4">
    <ProgressRing ... />
    {/* ... */}
  </Card>

  {/* 주간 칩 카드 (기존) */}
  <Card className="p-4">
    {/* DayChip들 */}
  </Card>

  {/* 최근 운동 리스트 — lg에서 2칸 차지 */}
  <Card className="p-4 lg:col-span-2">
    <h2 className="text-h3 font-bold text-text">최근 운동</h2>
    {/* 기존 recentExercises 매핑 */}
  </Card>
</section>
```

> 정확한 카드 분리는 현재 Dashboard.tsx 코드를 보고 그대로 옮기되, 바깥 wrapper를 `grid lg:grid-cols-2`로.

- [ ] **Step 3.1.5: 하단 fixed CTA — BarChart3 제거 + lg 정적 배치**

기존 CTA `<div className="fixed bottom-5 left-5 right-5 max-w-md mx-auto flex gap-2">`:

```diff
- <div className="fixed bottom-5 left-5 right-5 max-w-md mx-auto flex gap-2">
-   <Link href="/workout/new" className="flex-1">
-     <Button size="lg" className="w-full">운동 시작</Button>
-   </Link>
-   <Button size="lg" variant="outline" aria-label="기록 보기">
-     <BarChart3 className="w-5 h-5" />
-   </Button>
- </div>
+ <div className="fixed bottom-5 left-5 right-5 max-w-md mx-auto lg:static lg:mt-6 lg:max-w-xs lg:mx-0">
+   <Link href="/workout/new" className="block">
+     <Button size="lg" className="w-full">운동 시작</Button>
+   </Link>
+ </div>
```

> BarChart3 outline 버튼 완전 제거 (sidebar/bottomtab에서 "기록" 진입 가능). 운동 시작 단일 CTA.

- [ ] **Step 3.1.6: 사용하지 않게 된 BarChart3 import 제거**

```bash
grep -n "BarChart3" 'src/app/(app)/dashboard/Dashboard.tsx'
```

남아있으면 `lucide-react` import 라인에서 제거. (lint가 unused import로 잡을 수 있음.)

- [ ] **Step 3.1.7: TypeCheck + lint**

```bash
pnpm tsc --noEmit && pnpm lint
```

Expected: 0 errors.

- [ ] **Step 3.1.8: dev 서버에서 시각 확인**

```bash
pnpm dev
```

브라우저:
1. `http://localhost:3000/dashboard` — 모바일 (좁은 창): 기존과 동일. BottomTab만 새로 보임.
2. 창 폭 1024px 이상: 좌측 Sidebar + 메인 max-w-5xl + 진행/주간 가로 2칸 + 최근 운동 풀폭 + 운동 시작 버튼 정적 배치.
3. Ctrl+C로 종료.

- [ ] **Step 3.1.9: 회귀 테스트 (20 PASS)**

```bash
pnpm test
```

- [ ] **Step 3.1.10: 커밋**

```bash
git add -A
git commit -m "$(cat <<'EOF'
feat(phase-3-6): Dashboard responsive grid + remove BarChart3 dead button

- main wrapper: max-w-md lg:max-w-5xl, pb-32 lg:pb-5
- Header ThemeToggle/signOut hidden on lg (sidebar handles it)
- Progress/weekly/recent cards reflow to lg:grid-cols-2
- Recent card lg:col-span-2 for full width
- Remove BarChart3 outline button (history nav via sidebar/bottomtab)
- CTA: fixed on mobile, static aligned-left on lg
EOF
)"
```

---

## Chunk 4: SessionRunner 2-Column + ExerciseList + userPickedExId

**목표:** SessionRunner를 CSS-only 2-column 토글로 분리. ExerciseList 신규 컴포넌트로 lg+ 좌측 운동 리스트. 사용자가 운동 클릭하면 active 전환 (`userPickedExId` state). 모든 운동 완료 시 lg에서 "모든 운동 완료" 메시지. `/workout/[sessionId]/page.tsx` `<main>` max-w lg 확장.

### Task 4.1: ExerciseList 컴포넌트 + 테스트

**Files:**
- Create: `src/components/workout/ExerciseList.tsx`
- Create: `tests/components/workout/exercise-list.test.tsx`

- [ ] **Step 4.1.1: 디렉토리 생성**

```bash
mkdir -p src/components/workout tests/components/workout
```

- [ ] **Step 4.1.2: ExerciseList 작성**

```tsx
// src/components/workout/ExerciseList.tsx
"use client";
import { cn } from "@/lib/utils";
import type { ExerciseWithBodyParts } from "@/lib/queries/exercises";

type Props = {
  exercises: ExerciseWithBodyParts[];
  activeExerciseId: string | null;
  completionByEx: Record<string, { saved: number; target: number }>;
  onSelectExercise: (id: string) => void;
};

export function ExerciseList({
  exercises,
  activeExerciseId,
  completionByEx,
  onSelectExercise,
}: Props) {
  return (
    <aside className="hidden lg:block w-56 shrink-0 space-y-2">
      <h2 className="text-caption text-text-muted uppercase mb-2">
        운동 목록
      </h2>
      {exercises.map((ex) => {
        const c = completionByEx[ex.id] ?? {
          saved: 0,
          target: ex.default_sets ?? 3,
        };
        const done = c.saved >= c.target;
        const active = ex.id === activeExerciseId;
        return (
          <button
            key={ex.id}
            type="button"
            onClick={() => onSelectExercise(ex.id)}
            aria-current={active ? "true" : undefined}
            className={cn(
              "w-full text-left p-3 rounded-lg border transition-colors",
              active
                ? "border-2 border-accent bg-accent-soft"
                : done
                  ? "border-border bg-surface opacity-60"
                  : "border-border bg-surface hover:bg-accent-soft",
            )}
          >
            <div className="text-body font-semibold text-text">
              {done ? "✓ " : active ? "▶ " : ""}
              {ex.name}
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

- [ ] **Step 4.1.3: 단위 테스트**

```tsx
// tests/components/workout/exercise-list.test.tsx
import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import { ExerciseList } from "@/components/workout/ExerciseList";

const exercises = [
  { id: "a", name: "벤치프레스", default_sets: 3, exercise_body_parts: [] },
  { id: "b", name: "랫풀다운", default_sets: 3, exercise_body_parts: [] },
] as never;

describe("ExerciseList", () => {
  it("active 운동에 aria-current를 부착하고 클릭 시 콜백을 호출한다", () => {
    const onSelect = vi.fn();
    render(
      <ExerciseList
        exercises={exercises}
        activeExerciseId="b"
        completionByEx={{ a: { saved: 3, target: 3 }, b: { saved: 1, target: 3 } }}
        onSelectExercise={onSelect}
      />,
    );
    const activeBtn = screen.getByRole("button", { name: /랫풀다운/ });
    expect(activeBtn).toHaveAttribute("aria-current", "true");
    fireEvent.click(screen.getByRole("button", { name: /벤치프레스/ }));
    expect(onSelect).toHaveBeenCalledWith("a");
  });

  it("완료된 운동에 ✓ 표시 + opacity-60 적용", () => {
    render(
      <ExerciseList
        exercises={exercises}
        activeExerciseId={null}
        completionByEx={{ a: { saved: 3, target: 3 }, b: { saved: 0, target: 3 } }}
        onSelectExercise={() => {}}
      />,
    );
    const doneBtn = screen.getByRole("button", { name: /벤치프레스/ });
    expect(doneBtn.textContent).toContain("✓");
    expect(doneBtn.className).toContain("opacity-60");
  });
});
```

- [ ] **Step 4.1.4: 테스트 PASS 확인**

```bash
pnpm vitest run tests/components/workout/exercise-list.test.tsx
```

Expected: 2 passed.

---

### Task 4.2: SessionRunner 2-Column + userPickedExId

**Files:**
- Modify: `src/app/(app)/workout/[sessionId]/SessionRunner.tsx`
- Modify: `src/app/(app)/workout/[sessionId]/page.tsx` (main max-w)

- [ ] **Step 4.2.1: page.tsx `<main>` max-w 확장**

```diff
- <main className="p-5 max-w-md mx-auto pb-32">
+ <main className="p-5 max-w-md lg:max-w-5xl mx-auto pb-32 lg:pb-5">
```

- [ ] **Step 4.2.2: SessionRunner.tsx — userPickedExId state + computedActiveId 분리**

기존 `activeExerciseId` useMemo를 다음으로 교체:

```tsx
const [userPickedExId, setUserPickedExId] = useState<string | null>(null);

const computedActiveId = useMemo(() => {
  for (const ex of exercises) {
    const targetSets = ex.default_sets ?? 3;
    const savedMainSets = savedSets.filter(
      (s) => s.exercise_id === ex.id && s.parent_set_id === null,
    ).length;
    if (savedMainSets < targetSets) return ex.id;
  }
  return null;
}, [exercises, savedSets]);

// 사용자가 고른 운동이 완료되면 자동 해제 → computedActiveId가 다음 운동 가리킴
useEffect(() => {
  if (!userPickedExId) return;
  const target = exercises.find((e) => e.id === userPickedExId);
  if (!target) {
    setUserPickedExId(null);
    return;
  }
  const targetSets = target.default_sets ?? 3;
  const saved = savedSets.filter(
    (s) => s.exercise_id === userPickedExId && s.parent_set_id === null,
  ).length;
  if (saved >= targetSets) setUserPickedExId(null);
}, [savedSets, userPickedExId, exercises]);

const activeExerciseId = userPickedExId ?? computedActiveId;
const allDone = activeExerciseId === null;
```

(`useEffect` import 추가 필요. 이미 있을 확률 높지만 확인.)

- [ ] **Step 4.2.3: completionByEx 계산**

```tsx
const completionByEx = useMemo(() => {
  const out: Record<string, { saved: number; target: number }> = {};
  for (const ex of exercises) {
    const saved = savedSets.filter(
      (s) => s.exercise_id === ex.id && s.parent_set_id === null,
    ).length;
    out[ex.id] = { saved, target: ex.default_sets ?? 3 };
  }
  return out;
}, [exercises, savedSets]);
```

- [ ] **Step 4.2.4: 렌더 구조 변경 — 2-column + 모바일/데스크탑 분기**

기존 `<div className="space-y-4">` 외곽을 다음으로:

```tsx
import { ExerciseList } from "@/components/workout/ExerciseList";

return (
  <div className="lg:flex lg:gap-6">
    <ExerciseList
      exercises={exercises}
      activeExerciseId={activeExerciseId}
      completionByEx={completionByEx}
      onSelectExercise={setUserPickedExId}
    />

    <div className="flex-1 space-y-4 min-w-0">
      <header>
        <h1 className="text-h2 font-extrabold text-text">운동 진행 중</h1>
        <p className="text-caption text-text-muted">
          {new Date(session.started_at).toLocaleString("ko-KR")}
        </p>
      </header>

      {/* 모바일: 모든 운동 카드 펼침 (lg:hidden) */}
      <div className="space-y-4 lg:hidden">
        {exercises.map((ex) => renderExerciseCard(ex))}
      </div>

      {/* lg+: active 운동 카드 1개만 또는 모든 운동 완료 메시지 */}
      <div className="hidden lg:block">
        {allDone ? (
          <div className="text-center py-12 space-y-2">
            <p className="text-h2 font-extrabold text-accent">
              모든 운동 완료 🎉
            </p>
            <p className="text-body text-text-muted">
              아래 버튼으로 세션을 끝낼 수 있어요.
            </p>
          </div>
        ) : (
          exercises
            .filter((ex) => ex.id === activeExerciseId)
            .map((ex) => renderExerciseCard(ex))
        )}
      </div>

      <Separator />
      <Button
        className="w-full lg:max-w-xs"
        size="lg"
        variant="default"
        disabled={isFinishing || savedSets.length === 0}
        onClick={handleFinish}
      >
        {isFinishing ? "종료 중..." : "운동 종료"}
      </Button>
    </div>

    {/* 삭제 confirm Dialog — 기존 그대로 */}
    <Dialog ... />
  </div>
);
```

> `renderExerciseCard(ex)`은 기존의 `<ExerciseCardWrapper ...>...</ExerciseCardWrapper>` 블록을 함수로 추출 (또는 inline 두 번 작성).

- [ ] **Step 4.2.5: renderExerciseCard 헬퍼 추출 (또는 inline)**

가장 단순한 방법은 inline 두 번 작성하되 공통 부분을 변수로:

```tsx
const cardFor = (ex: ExerciseWithBodyParts) => {
  const prefill = prefillDefaults[ex.id];
  return (
    <ExerciseCardWrapper
      key={ex.id}
      exerciseId={ex.id}
      exerciseName={ex.name}
      isActive={ex.id === activeExerciseId}
      isAnyActive={activeExerciseId !== null}
      isRemoving={isRemoving}
      onRemove={handleRemoveClick}
    >
      {/* 기존 children: 운동 이름, 지난번 기록, drafts SetRow들 */}
    </ExerciseCardWrapper>
  );
};

// 모바일: {exercises.map(cardFor)}
// 데스크탑: {exercises.filter(e => e.id === activeExerciseId).map(cardFor)}
```

> 이 헬퍼는 ExerciseCardWrapper의 `exerciseName` prop 추가가 필요하므로 Chunk 5에서 한꺼번에 처리. Chunk 4에선 일단 기존 children 코드를 그대로 두 번 렌더(또는 inline 작성)하고 `exerciseName` 전달은 Chunk 5에서 ExerciseCardWrapper props에 추가하면서 같이.

- [ ] **Step 4.2.6: TypeCheck + lint**

```bash
pnpm tsc --noEmit && pnpm lint
```

- [ ] **Step 4.2.7: dev 서버 시각 확인**

```bash
pnpm dev
```

브라우저:
1. 모바일(<1024px) `/workout/<id>`: 기존과 동일하게 모든 운동 카드 펼침.
2. 데스크탑(>=1024px): 좌측 ExerciseList + 우측 활성 운동 카드 1개.
3. 좌측에서 다른 운동 클릭 → 우측 카드가 그 운동으로 즉시 전환.
4. 모든 운동의 세트가 다 채워지면 "모든 운동 완료 🎉" 메시지.

Ctrl+C 종료.

- [ ] **Step 4.2.8: 회귀 테스트 (22 PASS)**

```bash
pnpm test
```

Expected: 17 기존 + 3 layout + 2 exercise-list = 22 pass.

- [ ] **Step 4.2.9: 커밋**

```bash
git add -A
git commit -m "$(cat <<'EOF'
feat(phase-3-6): SessionRunner 2-column + ExerciseList + user-pickable active

- ExerciseList client component (hidden lg:block, w-56)
- userPickedExId state + computedActiveId fallback + useEffect auto-clear
- Mobile: all cards (space-y-4 lg:hidden)
- Desktop: active card only or "모든 운동 완료" message
- Session page <main> max-w-md lg:max-w-5xl
- 2 unit tests for ExerciseList (active + done states)
EOF
)"
```

---

## Chunk 5: ExerciseCardWrapper X Button Fix (R2)

**목표:** ExerciseCardWrapper의 X 버튼을 swipe-tracked Card 밖으로 빼서 absolute sibling으로 배치. 색은 `text-text-muted`로 가시성 향상. `exerciseName` prop 추가로 aria-label 명확화.

### Task 5.1: ExerciseCardWrapper 리팩토링

**Files:**
- Modify: `src/app/(app)/workout/[sessionId]/SessionRunner.tsx`

- [ ] **Step 5.1.1: ExerciseCardWrapperProps에 exerciseName 추가**

기존:
```tsx
type ExerciseCardWrapperProps = {
  exerciseId: string;
  isActive: boolean;
  isAnyActive: boolean;
  isRemoving: boolean;
  onRemove: (exerciseId: string) => void;
  children: React.ReactNode;
};
```

변경:
```tsx
type ExerciseCardWrapperProps = {
  exerciseId: string;
  exerciseName: string;          // 추가
  isActive: boolean;
  isAnyActive: boolean;
  isRemoving: boolean;
  onRemove: (exerciseId: string) => void;
  children: React.ReactNode;
};
```

- [ ] **Step 5.1.2: ExerciseCardWrapper 본체 — X 버튼을 Card 밖 sibling으로**

기존 ExerciseCardWrapper 함수 본체 통째로 교체:

```tsx
function ExerciseCardWrapper({
  exerciseId,
  exerciseName,
  isActive,
  isAnyActive,
  isRemoving,
  onRemove,
  children,
}: ExerciseCardWrapperProps) {
  const [revealed, setRevealed] = useState(false);

  const swipeHandlers = useSwipeable({
    onSwipedLeft: () => setRevealed(true),
    onSwipedRight: () => setRevealed(false),
    preventScrollOnSwipe: true,
    trackTouch: true,
    trackMouse: false,
    delta: 30,
  });

  return (
    <div className="relative overflow-hidden rounded-xl mt-3">
      {/* X 버튼 — swipe-tracked div 밖, absolute sibling. 클릭 우선권 확보. */}
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          onRemove(exerciseId);
        }}
        disabled={isRemoving}
        className={cn(
          "absolute top-2 right-2 z-10 p-2 rounded-md",
          "text-text-muted hover:text-text hover:bg-accent-soft",
        )}
        aria-label={`${exerciseName} 운동 삭제`}
      >
        <X className="w-5 h-5" />
      </button>

      {/* swipe-revealed 삭제 버튼 — 카드 뒤에 깔림 */}
      <button
        type="button"
        onClick={() => onRemove(exerciseId)}
        disabled={isRemoving}
        className="absolute right-0 top-0 bottom-0 w-20 bg-danger text-surface font-bold text-body flex items-center justify-center"
        aria-label={`${exerciseName} 운동 삭제`}
      >
        삭제
      </button>

      {/* 카드 본체 — swipe handler 여기에만 */}
      <Card
        {...swipeHandlers}
        className={cn(
          "p-4 relative transition-transform duration-200 ease-soft",
          revealed && "-translate-x-20",
          isActive && "border-2 border-accent",
          !isActive && isAnyActive && "opacity-65",
        )}
        onClick={() => revealed && setRevealed(false)}
      >
        {children}
      </Card>
    </div>
  );
}
```

- [ ] **Step 5.1.3: 호출처에서 exerciseName 전달 추가**

SessionRunner 본체의 ExerciseCardWrapper 사용처(Chunk 4의 `cardFor` 또는 inline) 두 군데에 `exerciseName={ex.name}` 추가:

```diff
  <ExerciseCardWrapper
    key={ex.id}
    exerciseId={ex.id}
+   exerciseName={ex.name}
    isActive={ex.id === activeExerciseId}
    ...
  >
```

- [ ] **Step 5.1.4: TypeCheck + lint**

```bash
pnpm tsc --noEmit && pnpm lint
```

Expected: 0 errors.

- [ ] **Step 5.1.5: dev 서버 모바일 시각 확인**

```bash
pnpm dev
```

Chrome DevTools → Device Toolbar → iPhone 14 Pro:
1. `/workout/<id>` 진입 (1 세트라도 저장된 세션).
2. 운동 카드 우상단 X 버튼 — Phase 3.5에선 거의 안 보이던 `text-text-ghost`였는데 이제 `text-text-muted`로 또렷이 보임.
3. X 버튼 단독 탭 → confirm Dialog 정상 노출.
4. 카드 좌측 swipe → 뒤의 빨간 "삭제" 버튼 나타남. swipe 중 X 영역에 손가락이 닿아도 swipe가 swipe로 정상 인식됨 (X는 swipe-tracked div 밖이라 swipe 트랙 영향 없음).
5. 반대 swipe(우→좌→우) → revealed 해제.

Ctrl+C.

- [ ] **Step 5.1.6: 회귀 테스트 (22 PASS)**

```bash
pnpm test
```

- [ ] **Step 5.1.7: 커밋**

```bash
git add -A
git commit -m "$(cat <<'EOF'
feat(phase-3-6): R2 fix — X button visibility + swipe handler isolation

- Move X button outside swipe-tracked Card as absolute sibling (z-10)
- text-text-ghost → text-text-muted for clear visibility
- Add exerciseName prop to ExerciseCardWrapper for screen-reader aria-label
- swipe handler now scoped to Card body only; touch tap on X does not trigger swipe
EOF
)"
```

---

## Chunk 6: /history Page + fetchRecentSessions

**목표:** `/history` 페이지 RSC 신설 + `fetchRecentSessions` Supabase 쿼리 + loading.tsx / error.tsx.

### Task 6.1: fetchRecentSessions 쿼리

**Files:**
- Modify: `src/lib/queries/sessions.ts` (RecentSession type + fetchRecentSessions 추가)

- [ ] **Step 6.1.1: sessions.ts 확장**

`src/lib/queries/sessions.ts` 끝에 추가:

```ts
export type RecentSession = {
  id: string;
  started_at: string;
  ended_at: string | null;
  bodyParts: string[];        // unique 한국어 이름
  exerciseCount: number;       // unique exercise_id 수
  setCount: number;            // main set만 (parent_set_id IS NULL)
  durationMin: number | null;  // ended_at 있으면 분 단위
};

/**
 * 최근 N주 세션 목록 — /history 페이지용.
 * workout_sets!inner 사용으로 세트 0개 세션은 제외 (의도된 동작).
 */
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

  return (data ?? []).map((row) => {
    const sets = row.workout_sets as Array<{
      exercise_id: string;
      parent_set_id: string | null;
      exercises: {
        exercise_body_parts: Array<{
          body_parts: { name_ko: string } | null;
        }>;
      };
    }>;

    const exerciseIds = new Set<string>();
    const bodyPartNames = new Set<string>();
    let mainSetCount = 0;

    for (const s of sets) {
      exerciseIds.add(s.exercise_id);
      if (s.parent_set_id === null) mainSetCount += 1;
      for (const ebp of s.exercises.exercise_body_parts) {
        if (ebp.body_parts?.name_ko) {
          bodyPartNames.add(ebp.body_parts.name_ko);
        }
      }
    }

    const durationMin =
      row.ended_at && row.started_at
        ? Math.round(
            (new Date(row.ended_at).getTime() -
              new Date(row.started_at).getTime()) /
              60_000,
          )
        : null;

    return {
      id: row.id,
      started_at: row.started_at,
      ended_at: row.ended_at,
      bodyParts: Array.from(bodyPartNames),
      exerciseCount: exerciseIds.size,
      setCount: mainSetCount,
      durationMin,
    };
  });
}
```

- [ ] **Step 6.1.2: TypeCheck**

```bash
pnpm tsc --noEmit
```

Expected: 0 errors. (Supabase 타입이 join을 어떻게 처리하는지에 따라 `as` cast 필요할 수도 있음 — 위처럼.)

---

### Task 6.2: /history page + loading/error

**Files:**
- Create: `src/app/(app)/history/page.tsx`
- Create: `src/app/(app)/history/loading.tsx`
- Create: `src/app/(app)/history/error.tsx`

- [ ] **Step 6.2.1: history/page.tsx 작성**

```tsx
// src/app/(app)/history/page.tsx
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { fetchRecentSessions } from "@/lib/queries/sessions";

export default async function HistoryPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const sessions = await fetchRecentSessions(user.id, 4);

  return (
    <main className="p-5 max-w-md lg:max-w-3xl mx-auto pb-32 lg:pb-5">
      <h1 className="text-display font-extrabold text-text">기록</h1>
      <p className="text-body text-text-muted mt-1">최근 4주 운동 기록</p>

      <div className="mt-5 space-y-2 lg:grid lg:grid-cols-2 lg:gap-3 lg:space-y-0">
        {sessions.length === 0 ? (
          <p className="text-body text-text-muted">
            아직 기록이 없어요. 첫 운동을 시작해보세요.
          </p>
        ) : (
          sessions.map((s) => (
            <article
              key={s.id}
              className="rounded-xl border border-border p-4 bg-surface"
            >
              <div className="text-caption text-text-muted">
                {new Date(s.started_at).toLocaleString("ko-KR", {
                  dateStyle: "medium",
                  timeStyle: "short",
                })}
              </div>
              <div className="text-h3 font-bold text-text mt-1">
                {s.bodyParts.length > 0 ? s.bodyParts.join(", ") : "운동"}
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

- [ ] **Step 6.2.2: history/loading.tsx**

```tsx
// src/app/(app)/history/loading.tsx
import { Skeleton } from "@/components/ui/skeleton";

export default function Loading() {
  return (
    <main className="p-5 max-w-md lg:max-w-3xl mx-auto space-y-3">
      <Skeleton className="h-8 w-24" />
      <Skeleton className="h-4 w-40" />
      {[1, 2, 3, 4].map((i) => (
        <Skeleton key={i} className="h-24 w-full" />
      ))}
    </main>
  );
}
```

- [ ] **Step 6.2.3: history/error.tsx**

```tsx
// src/app/(app)/history/error.tsx
"use client";

import { useEffect } from "react";
import { Button } from "@/components/ui/button";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("history error", error);
  }, [error]);

  return (
    <main className="p-5 max-w-md lg:max-w-3xl mx-auto space-y-4">
      <h2 className="text-h2 font-extrabold text-text">기록을 불러올 수 없어요</h2>
      <p className="text-body text-text-muted">
        {error.message ?? "다시 한번 시도해보세요"}
      </p>
      <Button onClick={reset}>다시 해볼게요</Button>
    </main>
  );
}
```

- [ ] **Step 6.2.4: dev 시각 확인**

```bash
pnpm dev
```

브라우저:
1. `/history` 직접 접근 또는 BottomTab/Sidebar의 "기록" 탭 클릭.
2. 최근 4주 세션 카드 N개 (모바일: 1컬럼, 데스크탑: 2컬럼) 표시.
3. 빈 사용자(신규)면 "아직 기록이 없어요" 메시지.

Ctrl+C.

- [ ] **Step 6.2.5: TypeCheck + lint + 테스트**

```bash
pnpm tsc --noEmit && pnpm lint && pnpm test
```

Expected: 0 errors, 22 tests pass.

- [ ] **Step 6.2.6: 커밋**

```bash
git add -A
git commit -m "$(cat <<'EOF'
feat(phase-3-6): /history page + fetchRecentSessions RSC query

- fetchRecentSessions joins sessions+sets+exercises+body_parts (workout_sets!inner)
- RecentSession aggregates bodyParts (unique), exerciseCount, setCount, durationMin
- /history page renders cards: mobile single column, lg:grid-cols-2
- loading.tsx skeleton + error.tsx with reset button (warm copy)
- Empty state message for new users
EOF
)"
```

---

## Chunk 7: dashboard loading/error + WCAG + lg skeleton

**목표:** dashboard에 loading/error 페이지 추가 (Phase 3.5엔 없었음). 기존 workout loading.tsx에 sidebar skeleton 분기 (lg+). WCAG 4.5:1 contrast 검증.

### Task 7.1: dashboard loading/error 신규

**Files:**
- Create: `src/app/(app)/dashboard/loading.tsx`
- Create: `src/app/(app)/dashboard/error.tsx`

- [ ] **Step 7.1.1: dashboard/loading.tsx**

```tsx
// src/app/(app)/dashboard/loading.tsx
import { Skeleton } from "@/components/ui/skeleton";

export default function Loading() {
  return (
    <main className="p-5 max-w-md lg:max-w-5xl mx-auto space-y-4">
      <Skeleton className="h-4 w-24" />
      <Skeleton className="h-10 w-40" />
      <Skeleton className="h-4 w-56" />
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 mt-5">
        <Skeleton className="h-24 w-full" />
        <Skeleton className="h-24 w-full" />
        <Skeleton className="h-32 w-full lg:col-span-2" />
      </div>
      <Skeleton className="h-12 w-full lg:max-w-xs mt-6" />
    </main>
  );
}
```

- [ ] **Step 7.1.2: dashboard/error.tsx**

```tsx
// src/app/(app)/dashboard/error.tsx
"use client";

import { useEffect } from "react";
import { Button } from "@/components/ui/button";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("dashboard error", error);
  }, [error]);

  return (
    <main className="p-5 max-w-md lg:max-w-5xl mx-auto space-y-4">
      <h2 className="text-h2 font-extrabold text-text">대시보드를 불러올 수 없어요</h2>
      <p className="text-body text-text-muted">
        {error.message ?? "다시 한번 시도해보세요"}
      </p>
      <Button onClick={reset}>다시 해볼게요</Button>
    </main>
  );
}
```

---

### Task 7.2: 기존 loading.tsx lg 확장

**Files:**
- Modify: `src/app/(app)/workout/new/loading.tsx`
- Modify: `src/app/(app)/workout/[sessionId]/loading.tsx`

- [ ] **Step 7.2.1: workout/new/loading.tsx max-w 확장**

```diff
- <main className="p-5 max-w-md mx-auto space-y-4">
+ <main className="p-5 max-w-md lg:max-w-3xl mx-auto space-y-4">
```

- [ ] **Step 7.2.2: workout/[sessionId]/loading.tsx max-w + sidebar list skeleton**

```tsx
// src/app/(app)/workout/[sessionId]/loading.tsx
import { Skeleton } from "@/components/ui/skeleton";

export default function Loading() {
  return (
    <main className="p-5 max-w-md lg:max-w-5xl mx-auto">
      <div className="lg:flex lg:gap-6">
        {/* lg+ 좌측 운동 리스트 skeleton */}
        <aside className="hidden lg:block w-56 shrink-0 space-y-2">
          <Skeleton className="h-3 w-20 mb-2" />
          {[1, 2, 3, 4].map((i) => (
            <Skeleton key={i} className="h-16 w-full" />
          ))}
        </aside>

        {/* 메인 영역 skeleton */}
        <div className="flex-1 space-y-4">
          <Skeleton className="h-6 w-40" />
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-32 w-full" />
          ))}
          <Skeleton className="h-12 w-full lg:max-w-xs" />
        </div>
      </div>
    </main>
  );
}
```

---

### Task 7.3: WCAG / manual E2E 점검

- [ ] **Step 7.3.1: dev 서버 + Lighthouse / Accessibility 검사**

```bash
pnpm dev
```

Chrome DevTools:
1. `/dashboard` 진입 (데스크탑 폭).
2. DevTools → Lighthouse → Accessibility 단독 실행. 점수 90+ 목표.
3. Elements 탭 → sidebar 활성 링크(`bg-accent text-surface`) 선택 → 우측 Computed에서 contrast 4.5:1 이상 확인.
4. 다크모드 토글(헤더 ThemeToggle) → 같은 contrast 측정. 미달 시 활성 텍스트 `text-surface` → `text-text`로 변경 권장.
5. BottomTab 활성 탭 contrast 측정.
6. ExerciseCardWrapper X 버튼 hover/focus contrast.

- [ ] **Step 7.3.2: 모바일 E2E (Chrome Device Toolbar iPhone 14 Pro)**
1. `/login` → 구글 로그인 (외부 브라우저 권장 — `disallowed_useragent` 회피)
2. `/dashboard` 진입 → BottomTab 3 탭 표시 + 운동 시작 CTA + 진행/주간/최근
3. BottomTab "운동" → `/workout/new` → 부위 선택 → 추천 → 시작 → `/workout/<id>`
4. 운동 카드 X 버튼 단독 탭 → confirm Dialog. 좌측 swipe → 빨간 "삭제" 슬라이드.
5. 운동 종료 → `/dashboard`.
6. BottomTab "기록" → `/history`에 방금 종료한 세션 카드 표시.

- [ ] **Step 7.3.3: 데스크탑 E2E (1280px)**
1. `/dashboard` → 좌측 Sidebar (대시보드 활성) + 메인 max-w-5xl.
2. 사이드 "운동 시작" → `/workout/new` (사이드 "운동" 항목 활성 표시).
3. 운동 시작 → `/workout/<id>` (사이드 여전히 "운동" 활성).
4. 좌측 ExerciseList 노출. 다른 운동 카드 클릭 → 우측 활성 카드 즉시 전환.
5. 모든 운동 완료 → "모든 운동 완료 🎉" 메시지 + 운동 종료 버튼 활성.
6. 종료 → `/dashboard`.
7. 사이드 "기록" → `/history` lg:grid-cols-2로 카드 표시.

→ Ctrl+C.

- [ ] **Step 7.3.4: TypeCheck + lint + 회귀**

```bash
pnpm tsc --noEmit && pnpm lint && pnpm test
```

Expected: 0 errors, 22 tests pass.

- [ ] **Step 7.3.5: 커밋**

```bash
git add -A
git commit -m "$(cat <<'EOF'
feat(phase-3-6): dashboard loading/error + lg sidebar skeleton + WCAG pass

- New dashboard/loading.tsx, dashboard/error.tsx (warm copy + grid skeleton)
- workout/new + workout/[sessionId] loading.tsx widened to lg:max-w-*
- Session loading.tsx adds sidebar list skeleton (hidden lg:block w-56)
- Manual WCAG check: sidebar/bottomtab/X-button contrast 4.5:1+ in both modes
EOF
)"
```

---

## Chunk 8: Verification + PR + Merge + Tag

### Task 8.1: 빌드 + 테스트 + 로그

- [ ] **Step 8.1.1: 프로덕션 빌드**

```bash
pnpm build 2>&1 | tail -25
```

Expected: 0 errors. 라우트 출력에 다음 7개:
```
/
/_not-found
/auth/callback
/dashboard
/history       ← (NEW)
/login
/workout/[sessionId]
/workout/new
```

(`_not-found`와 `/` 포함 시 8개. URL 경로 기준 7개.)

- [ ] **Step 8.1.2: 전체 회귀 테스트**

```bash
pnpm test
```

Expected: 17 기존 + 5 신규 (3 layout + 2 exercise-list) = 22 tests pass / 6+ files.

- [ ] **Step 8.1.3: 완료 로그 작성**

```bash
cat > docs/import/responsive-desktop-log.md <<'EOF'
# Phase 3.6 — Responsive Desktop + UX Fixes 완료

- **Date:** 2026-05-29
- **Branch:** feat/phase-3-6-responsive-desktop
- **Tag:** v0.3.6-responsive-desktop

## Implemented

- (app) route group 도입 + 모든 페이지 이동 + import 경로 일괄 갱신
- AppShell + Sidebar(lg+) + BottomTab(lg-) — CSS-only 반응형 토글
- `pb-safe` Tailwind v4 utility (iOS safe-area)
- Dashboard lg:max-w-5xl + grid 2x2 (진행/주간/최근) + 헤더 액션 lg 숨김
- BarChart3 dead button 제거 (sidebar/bottomtab에서 기록 진입)
- SessionRunner 2-column (CSS-only): 좌측 ExerciseList + 우측 활성 카드
- userPickedExId state로 사용자 운동 선택 우선
- 모든 운동 완료 시 "모든 운동 완료 🎉" 메시지 (lg+)
- ExerciseCardWrapper X 버튼: swipe-tracked div 밖 sibling, text-text-muted 가시성
- exerciseName prop으로 스크린리더 aria-label 명확화
- /history 페이지 + fetchRecentSessions (workout_sets!inner) + loading/error
- dashboard loading.tsx / error.tsx 신규
- workout/[sessionId] loading.tsx에 sidebar skeleton 분기

## Out of Scope (Plan 3.7)

- /history 차트
- 운동 drag&drop
- 사이드바 collapsible
- Magic link / 인앱 브라우저 OAuth 우회
- ExerciseList 화살표 키 네비

## Tests

- tests/rls/isolation.test.ts — 3 (regression)
- tests/workout/recommendation.test.ts — 6 (regression)
- tests/lib/motion.test.ts — 3 (regression)
- tests/components/progress-ring.test.tsx — 5 (regression)
- tests/components/layout/sidebar.test.tsx — 1 (new)
- tests/components/layout/bottom-tab.test.tsx — 1 (new)
- tests/components/layout/app-shell.test.tsx — 1 (new)
- tests/components/workout/exercise-list.test.tsx — 2 (new)
- 총 22 tests / 6+ files

## Manual E2E

- iPhone 14 Pro 시뮬: BottomTab nav, 운동 X 버튼, 세션 시작~종료, /history
- 데스크탑 1280px: Sidebar nav, 세션 운동 클릭 전환, 모든 운동 완료 메시지
- WCAG: sidebar/bottomtab 활성 contrast 4.5:1+, light/dark 양쪽

## Bugs Resolved

- R1: 운동 진행 중 순서 강제 → 좌측 클릭만으로 active 전환
- R2: X 버튼 안 보이고 swipe로 가로채짐 → 가시성 + swipe 격리
- R3: BarChart3 데드 버튼 → 제거 + /history 페이지 신설
EOF
```

- [ ] **Step 8.1.4: 로그 커밋**

```bash
git add docs/import/responsive-desktop-log.md
git commit -m "docs(phase-3-6): completion log"
```

---

### Task 8.2: PR + 머지 + 태그

- [ ] **Step 8.2.1: 푸시 + PR 생성**

```bash
git push -u origin feat/phase-3-6-responsive-desktop
gh pr create --title "Phase 3.6: Responsive Desktop Layout + UX Fixes" --body "$(cat <<'EOF'
## Summary

Phase 3.5 머지 후 헬스장 1주일 실사용에서 발견된 UX 이슈 3개 + 데스크탑 멀티컬럼 레이아웃 추가.

## Scope

- ✅ `(app)` route group + AppShell + Sidebar(lg+) + BottomTab(lg-)
- ✅ Dashboard lg grid 2x2 + BarChart3 dead button 제거
- ✅ SessionRunner CSS-only 2-column + ExerciseList + userPickedExId
- ✅ ExerciseCardWrapper X 버튼 가시성 + swipe handler 격리
- ✅ /history 페이지 + fetchRecentSessions
- ✅ dashboard loading/error + lg sidebar skeleton

## Out of Scope (Plan 3.7)

차트, drag&drop 순서, 사이드바 collapse, magic link, 화살표 키 네비

## Verification

- ✅ pnpm tsc --noEmit → 0 errors
- ✅ pnpm lint → 0 errors
- ✅ pnpm test → 22 passed (6+ files)
- ✅ pnpm build → 0 errors, 7 routes
- ✅ WCAG manual: sidebar/bottomtab/X-button contrast 4.5:1+ (light + dark)
- ✅ iPhone 14 Pro + Desktop 1280px manual E2E

Plan: docs/plans/2026-05-29-phase-3-6-responsive-desktop.md
Spec: docs/specs/2026-05-29-phase-3-6-responsive-desktop-design.md (v3)
Log: docs/import/responsive-desktop-log.md
EOF
)"
```

- [ ] **Step 8.2.2: PR 머지 + 브랜치 삭제**

```bash
PR_NUMBER=$(gh pr list --head feat/phase-3-6-responsive-desktop --json number --jq '.[0].number')
gh pr merge $PR_NUMBER --merge --delete-branch
```

- [ ] **Step 8.2.3: main 동기화 + 태그**

```bash
git checkout main && git pull --ff-only
MERGE_COMMIT=$(git log --merges --grep="phase-3-6-responsive-desktop" -n 1 --format=%H)
git tag v0.3.6-responsive-desktop $MERGE_COMMIT
git push origin v0.3.6-responsive-desktop
```

- [ ] **Step 8.2.4: PRD 모두 passes:true 마킹 (Ralph가 자동, 수동이면)**

```bash
# Ralph가 자동 처리. 수동 실행 시 .omc/prd.json 6 stories 다 passes: true.
```

- [ ] **Step 8.2.5: 완료 보고**

사용자에게 제공:
- PR URL
- 머지 commit SHA
- 태그 `v0.3.6-responsive-desktop`
- 다음 단계: 헬스장 1주일 실사용 → 피드백 → Plan 3.7 작성

---

## Risks & Mitigations

| 리스크 | 영향 | 완화 |
|---|---|---|
| `(app)` 라우트 그룹 이동 시 import 경로 깨짐 | 중간 | Chunk 1에서 grep + sed로 일괄. 1.2.4에서 잔존 0 확인. |
| Sidebar 활성 텍스트 다크모드 contrast 미달 | 낮음 | 7.3.1에서 Lighthouse + Computed 측정. 미달 시 `text-surface` → `text-text`. |
| SessionRunner 두 트리 DOM 중복으로 이벤트 핸들러 2배 | 낮음 | 운동 카드 평균 5개. 모바일/데스크탑 동시 노출이라 사용자 1명에게 ~10개 핸들러. 무시 가능. |
| fetchRecentSessions join 비효율 (4주, N≤30 세션) | 낮음 | Plan 3.7에서 view/materialized view 검토. 현재 N x M x K로 안전 마진. |
| 모바일 OAuth `disallowed_useragent` | 외부 | 코드 변경 없음. 사용자 안내(외부 브라우저 또는 홈 화면 추가). Magic link는 Plan 3.7. |
| ExerciseList 키보드 화살표 네비 부재 | 낮음 | Tab 이동은 자동. 화살표 네비는 Plan 3.7. aria-current로 스크린리더 OK. |

---

## Reference Map

| 구현 항목 | 파일 | Spec 섹션 |
|---|---|---|
| (app) route group | `src/app/(app)/layout.tsx` | §4.1, §6.1 |
| AppShell | `src/components/layout/AppShell.tsx` | §4.2 |
| Sidebar matchPrefix | `src/components/layout/Sidebar.tsx` | §4.2 |
| BottomTab | `src/components/layout/BottomTab.tsx` | §4.2 |
| pb-safe utility | `src/app/globals.css` | §4.2 |
| ExerciseList | `src/components/workout/ExerciseList.tsx` | §4.2 |
| SessionRunner CSS-only 2-col + allDone | `src/app/(app)/workout/[sessionId]/SessionRunner.tsx` | §4.3 |
| ExerciseCardWrapper X fix | 동상 | §4.3 |
| Dashboard lg grid + BarChart3 제거 | `src/app/(app)/dashboard/Dashboard.tsx` | §4.3 |
| /history page | `src/app/(app)/history/page.tsx` | §4.2 |
| fetchRecentSessions | `src/lib/queries/sessions.ts` | §5.1 |
| dashboard/history loading-error | `(app)/dashboard|history/{loading,error}.tsx` | §7 |

---

## Revision History

| Version | Date | Change |
|---|---|---|
| v1 | 2026-05-29 | Initial plan from spec v3 (8 chunks, ~12h estimate, Ralph-ready) |
