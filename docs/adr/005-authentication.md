# ADR-005: 인증 방식 (Authentication)

- **Status:** Accepted
- **Date:** 2026-05-22
- **Decider:** HJ

## Context

1인용 헬스 루틴 앱이지만 웹 배포되므로 URL 노출 가능성 있음.
헬스장(모바일) ↔ 집(데스크탑) 동기화 필요 → 디바이스 간 동일 계정 인증 필요.

기존 대화에서 검토된 옵션:
- 인증 없음 (URL 비밀)
- 단일 비밀번호
- Google OAuth (Supabase)
- Kakao OAuth (Supabase 기본 미지원, 별도 설정)

## Decision

**Google OAuth via Supabase Auth 채택. 단일 프로바이더로 시작.**

## Considered Options

| Option | 평가 |
|--------|------|
| 인증 없음 | ❌ URL 유출 시 누구나 접근. 개인 운동 데이터의 사적 성격 무시 |
| 단일 비밀번호 | ❌ 비번 관리 부담, 멀티디바이스 UX 떨어짐, 보안 약함 |
| **Google OAuth** | ✅ Supabase 기본 지원, 클릭 몇 번 설정, 비번 외울 필요 없음, 멀티디바이스 자연스러움 |
| Kakao OAuth | △ 한국 친화적이지만 Supabase 기본 미지원 → 별도 설정 노력 vs 본인만 쓰는 앱에 과잉 |
| 멀티 프로바이더 | △ 1인용에는 오버스펙 (본인이 Google + Kakao 둘 다 쓸 일 없음) |

## Consequences

### Positive
- 비밀번호 없음 → 보안 + UX 둘 다 ↑
- Supabase Auth가 세션 관리, RLS(Row Level Security) 통합 다 해줌
- Vercel 배포 시 OAuth callback URL 한 줄 설정으로 끝
- `auth.users` 테이블이 자동 생성 → `workout_sessions.user_id`에 FK 걸기 쉬움

### Negative
- Google 계정에 의존 (구글 계정 잠기면 앱 접근 불가)
- 추후 친구한테 공유 시 친구도 Google 계정 필요

### Mitigation
- 추후 친구 공유 필요해지면 ADR-005의 Update 또는 ADR-XXX로 Kakao/Email 추가
- 데이터 export 기능을 통해 lock-in 완화 (ADR-009 후보)

## Implementation Notes

### Supabase 설정 순서
1. Supabase 프로젝트 생성
2. Authentication → Providers → Google 활성화
3. Google Cloud Console에서 OAuth 2.0 client ID 발급
4. Authorized redirect URIs에 `https://<project>.supabase.co/auth/v1/callback` 등록
5. Vercel 환경변수: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`

### Row Level Security (RLS) 정책
모든 운동 데이터 테이블에 RLS 활성화 + 본인 row만 접근:
```sql
ALTER TABLE workout_sessions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own sessions" ON workout_sessions
  FOR ALL USING (auth.uid() = user_id);

-- (NOTE: 아래 exercises RLS는 ADR-008에 의해 SUPERSEDED됨)
-- ADR-008에서 exercises를 per-user catalog로 변경 → 본인 row만 RLS 허용
-- 최신 정책은 spec §5.3 참조: CREATE POLICY "own exercises" ON exercises FOR ALL USING (auth.uid() = user_id);
-- body_parts만 read-only public 유지

ALTER TABLE body_parts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "read body_parts" ON body_parts FOR SELECT USING (true);
```

### Next.js 인증 흐름
- `@supabase/ssr` 사용 (Server Components + Client Components 양쪽)
- 미인증 시 `/login` 리다이렉트
- 로그인 페이지: "Google로 로그인" 버튼 하나만

## References
- Supabase Auth docs: https://supabase.com/docs/guides/auth/social-login/auth-google
- Next.js + Supabase Auth (App Router): `@supabase/ssr` 패키지
