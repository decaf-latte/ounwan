# ADR-007: 프론트엔드 상태 관리 전략

- **Status:** Accepted
- **Date:** 2026-05-22
- **Decider:** HJ

## Context

Next.js App Router 환경에서 서버/클라이언트 상태를 어떻게 분리하고 관리할지 결정.

핵심 시나리오:
- **헬스장 모바일**: 세트 완료 버튼 → 0ms 지연으로 UI 반영 필요 (자주 입력)
- **집 데스크탑**: 캘린더/차트 (읽기 중심, 데이터 변경 빈도 낮음)

제약:
- Supabase Postgres + RLS
- ADR-006의 PWA + Read-only Cache 결정과 정합성 필요

## Considered Options

| Option | 설명 | 트레이드오프 |
|--------|------|--------------|
| W. Server Components Only + Server Actions | 모든 페칭 RSC, 변경 Server Actions | App Router 정직한 패턴이지만 자주 입력 시 매 요청마다 서버 왕복 → UX 병목 |
| **X. TanStack Query (React Query)** | 클라이언트 캐시 + optimistic mutation + DevTools | 학습 곡선 있지만 업계 표준 |
| Y. SWR | TanStack Query보다 단순 API | `useMutation` 부재 → optimistic 롤백 직접 관리 |
| Z. Zustand + 직접 fetch | 가장 가벼움 | 캐시/동기화 직접 구현 → 바퀴 재발명 |

## Decision

**Option X (TanStack Query) 채택**: RSC와 하이브리드로 사용.

### 페이지별 역할 분담

| 페이지 | 패턴 | 이유 |
|--------|------|------|
| 대시보드(데스크탑) | RSC + `HydrationBoundary` 프리시딩 → Client에서 `useQuery` | 초기 SSR로 빠른 표시 + 인터랙티브 필터링 |
| 캘린더 뷰 | RSC로 초기 데이터 → Client `useQuery`로 월 변경 | 자주 안 바뀜, SWR 캐시 적합 |
| **운동 기록 입력** | Full Client (`'use client'`) + `useMutation` optimistic | 0ms UI 반응 필수 |
| 운동 관리(설정) | RSC CRUD + Server Actions | 자주 안 바뀜, RSC로 충분 |

### 기각 이유

| 옵션 | 기각 이유 |
|------|-----------|
| W. RSC Only | 매 세트 입력마다 `revalidatePath` 서버 왕복 → 헬스장 느린 네트워크에서 UX 치명적. ADR-006의 SW 캐시와 부조화 (RSC는 오프라인 셸 안에서 못 돔). |
| Y. SWR | `useMutation` 추상화 없음 → optimistic 롤백 직접 관리. 1인 프로젝트 학습곡선 차이는 미미하지만 디버깅 도구(DevTools) 열위. |
| Z. Zustand | 서버 상태 캐시를 직접 구현 = 이미 풀린 문제 재구현. **Zustand는 클라이언트 전용 UI 상태(타이머, 선택된 운동 등)에 제한적으로 보조 사용 가능.** |

## Consequences

### Positive
- **즉각적 UI 반응**: `onMutate`에서 캐시 즉시 업데이트, 실패 시 `onError` 롤백
- **자동 캐시 관리**: `staleTime: 5*60*1000`으로 1인 사용에서 불필요한 리페치 차단
- **ADR-006과 시너지**: `persistQueryClient`로 캐시를 localStorage/IndexedDB에 영속화 → SW의 read-only 캐시와 역할 분리 (SW=정적 자산, TQ=동적 데이터)
- **재연결 자동 갱신**: `refetchOnReconnect: true`로 오프라인 → 온라인 복귀 시 자동 동기화
- **DevTools**: 캐시/뮤테이션 상태 실시간 디버깅
- **확장 경로**: ADR-006의 B → C 마이그레이션 시 `MutationCache` 큐만 추가하면 됨

### Negative
- 클라이언트 상태 라이브러리 학습 곡선
- RSC와 Client 경계 의사결정 필요 (어떤 페이지에서 어디까지 클라이언트?)
- 번들 사이즈 +13KB (gzipped, TanStack Query v5)

### Mitigation
- 경계 가이드: "자주 입력하는 페이지는 Client, 조회/관리는 RSC"
- 초기 데이터는 RSC에서 prefetch + `HydrationBoundary`로 hydration 시 캐시 시딩 → SEO/SSR 이점 유지

## Implementation Notes

### 디렉토리 구조 (예정)
```
app/
  layout.tsx                ← <QueryClientProvider> 래핑
  providers.tsx              ← QueryClient 생성, persistQueryClient 설정
  dashboard/
    page.tsx                ← RSC, prefetchQuery + dehydrate
    CalendarView.tsx        ← 'use client', useQuery(monthKey)
    StatsCard.tsx           ← 'use client', useQuery
  workout/
    new/page.tsx            ← RSC 최소
    SessionRunner.tsx       ← 'use client', useMutation + optimistic
  exercises/
    page.tsx                ← RSC, fetch from Supabase
    ExerciseForm.tsx        ← Server Action 또는 useMutation
lib/
  query-client.ts           ← QueryClient + 기본 옵션
  supabase-client.ts        ← Browser client (createBrowserClient)
  supabase-server.ts        ← Server client (createServerClient)
```

### QueryClient 기본 설정
```typescript
new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5 * 60 * 1000,         // 5분
      gcTime: 24 * 60 * 60 * 1000,      // 24시간 (persist용)
      refetchOnWindowFocus: false,       // 모바일에서 과도한 리페치 방지
      refetchOnReconnect: true,
      retry: 2,
    },
    mutations: {
      retry: 1,
    }
  }
})
```

### Optimistic Mutation 예시 (세트 완료)
```typescript
const completeSet = useMutation({
  mutationFn: (set) => supabase.from('workout_sets').insert(set),
  onMutate: async (newSet) => {
    await queryClient.cancelQueries({ queryKey: ['session', sessionId] });
    const prev = queryClient.getQueryData(['session', sessionId]);
    queryClient.setQueryData(['session', sessionId], (old) => [...old, newSet]);
    return { prev };
  },
  onError: (err, newSet, ctx) => {
    queryClient.setQueryData(['session', sessionId], ctx.prev);
    toast.error('저장 실패. 다시 시도해주세요.');
  },
  onSuccess: () => {
    queryClient.invalidateQueries({ queryKey: ['session', sessionId] });
  }
});
```

### Zustand 보조 사용처 (제한적)
- 운동 중 쉬는 시간 타이머 상태
- 현재 선택된 운동 (입력 화면 내 임시 상태)
- 모달/시트 열림 상태
→ 서버 데이터와 무관한 순수 UI 상태만

## References
- Architect 에이전트 검토 (2026-05-22)
- ADR-006 (PWA scope) — B + X 조합의 시너지 확인됨
- TanStack Query v5 docs: `persistQueryClient`, `HydrationBoundary`, optimistic updates
