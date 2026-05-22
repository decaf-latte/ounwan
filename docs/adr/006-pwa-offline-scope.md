# ADR-006: PWA Offline 지원 범위

- **Status:** Accepted
- **Date:** 2026-05-22
- **Decider:** HJ

## Context

핵심 사용 시나리오:
- **헬스장 모바일**: 실시간 운동 기록 입력 (자주, 짧게)
- **집 데스크탑**: 캘린더/차트/관리 (조회 중심)

네트워크 환경:
- 헬스장 Wi-Fi 불안정, but LTE/5G는 대부분 연결됨
- 즉 진짜 문제는 **"완전 오프라인"이 아닌 "느린/불안정한 네트워크"**

## Considered Options

| Option | 설명 | 구현 복잡도 |
|--------|------|------------|
| A. 온라인 전용 | manifest만 (홈화면 추가) | 최소 |
| **B. PWA + Read-only Cache** | SW로 앱 셸 + 카탈로그 캐시. 입력은 온라인 필요 | 낮음 |
| C. PWA + Offline-first + Sync Queue | IndexedDB + 동기화 큐, 충돌 해결 | 높음 |
| D. PWA 없이 Optimistic UI만 | SW 없음, 캐시 없음 | 최소 |

## Decision

**Option B 채택**: PWA + Read-only Cache.

단, **ADR-007의 TanStack Query 설정에서 `persistQueryClient` + `MutationCache`를 처음부터 활성화** → 나중에 필요하면 C(Offline-first)로 점진적 확장 가능한 게이트웨이로 설계.

### 기각 이유

| 옵션 | 기각 이유 |
|------|-----------|
| A. 온라인 전용 | 헬스장 불안정 네트워크 UX 나쁨. 포트폴리오 어필력 낮음. |
| C. Offline-first | Supabase RLS 환경에서 클라이언트 IndexedDB ↔ 서버 Postgres 동기화는 1인 프로젝트 규모 초과. 동기화 충돌, 큐 재시도, 상태 머신 등 부수 코드가 앱 본체보다 커질 수 있음. |
| D. SW 없는 Optimistic | TanStack Query를 쓰면 자연히 얻어지는 효과. 별도 옵션이 아님. |

## Consequences

### Positive
- **헬스장 UX 향상**: 네트워크 잠깐 끊겨도 캘린더/과거 기록 조회 가능
- **앱 셸 즉시 로딩**: 첫 진입 후 두 번째 방문부터는 캐시에서 즉시 표시
- **점진적 확장 경로 확보**: B → C 마이그레이션이 `retry`/`retryDelay` 설정 + IndexedDB mutation 큐 추가 수준에서 가능
- **포트폴리오 가치**: "왜 C를 선택하지 않았는가"를 논리적으로 설명 가능 (over-engineering 회피 판단력)
- **홈화면 추가**: 모바일에서 네이티브 앱처럼 사용 가능

### Negative
- 완전 오프라인 시 새 기록 입력 불가 (저장 실패 → 사용자가 재시도해야 함)
- Service Worker 디버깅 학습 곡선 (브라우저 SW 캐시 vs 강력 새로고침 등)

### Mitigation
- TanStack Query `onlineManager`로 온라인/오프라인 상태 감지 → 입력 시 토스트로 명확히 안내
- 추후 실제 헬스장에서 네트워크 완전 단절 빈도가 잦으면 C로 확장
- 개발 환경에서 SW 비활성화 옵션 (`disable: process.env.NODE_ENV === 'development'`)

## Implementation Notes

### 라이브러리 선택: `@serwist/next`
- `next-pwa`는 메인테이너 비활성 상태
- Serwist는 Workbox 기반 후속, App Router 호환

### 캐시 전략

| 자원 | 전략 | 이유 |
|------|------|------|
| App Shell (HTML/CSS/JS) | `CacheFirst` | 변경 빈도 낮음, 빠른 로딩 우선 |
| `/api/exercises` (운동 카탈로그) | `StaleWhileRevalidate` | 자주 안 바뀜, 백그라운드 갱신 |
| `/api/sessions/*` (운동 기록) | `NetworkFirst` | TanStack Query가 클라이언트 캐시 담당, SW는 네트워크 우선 |
| 이미지/아이콘 | `CacheFirst` (장기) | 정적 자산 |

### manifest.json 핵심 필드
```json
{
  "name": "헬스 루틴",
  "short_name": "루틴",
  "start_url": "/",
  "display": "standalone",
  "background_color": "#0F172A",
  "theme_color": "#0F172A",
  "icons": [
    { "src": "/icons/192.png", "sizes": "192x192", "type": "image/png" },
    { "src": "/icons/512.png", "sizes": "512x512", "type": "image/png" }
  ]
}
```

### Service Worker 캐시 무효화 전략 (배포 시 stale shell 방지)

Next.js + SW 조합의 알려진 함정 → 명시적 정책 필요:

1. **Serwist precache 자동 버저닝 사용**
   - Serwist는 빌드 시 자동으로 각 자산에 해시를 붙여 precache 매니페스트 생성
   - 새 빌드는 새 매니페스트 → SW가 새 자산 fetch

2. **`skipWaiting()` + `clientsClaim()` 활성화**
   - 새 SW가 즉시 활성화되도록 (기본은 모든 탭 닫힐 때까지 대기)
   - 단점: 활성 사용자의 페이지가 도중에 새 자산을 받을 수 있음 → 모순 발생 가능
   - 본인만 쓰는 앱이라 이 트레이드오프 수용 가능

3. **"새 버전 사용 가능" 토스트 (선택)**
   - 새 SW 감지 시 사용자에게 새로고침 안내 (선택적)
   - 1인용에서는 과잉일 수 있음 → MVP에서는 생략, 필요 시 추가

4. **개발 환경 비활성화**
   - `disable: process.env.NODE_ENV === 'development'`로 로컬 디버깅 시 SW 끔
   - HMR과 SW 캐시 충돌 회피

### 향후 C로의 마이그레이션 경로 (열어둠)
1. `persistQueryClient`에 IndexedDB 어댑터 추가
2. `useMutation`에 `retry: true` + 지수백오프 설정
3. Workbox `BackgroundSync` 플러그인으로 오프라인 큐
4. 단일 기기 사용 가정 시 conflict resolution은 last-write-wins로 단순화

## References
- Architect 에이전트 검토 (2026-05-22)
- ADR-007 (state management) — B + X 조합 정합성 확인
- Serwist (next-pwa 후속): https://serwist.pages.dev
