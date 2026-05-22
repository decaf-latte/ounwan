# ADR-004: 카톡 데이터 임포트 전략

- **Status:** Accepted
- **Date:** 2026-05-22
- **Decider:** HJ

## Context

1년치 카톡 셀프챗 운동 기록(.eml, ~6,500 lines, 운동 세션 30~50회 분량)을 ADR-001~003에서 확정한 스키마(body_parts M:N, parent_set_id, side 등)로 임포트해야 함.

### 데이터의 특성
- **비정형도 높음**: 표기 변형 12가지 이상 (`15회/15번/15개/숫자만`, `5kg/5키로/빈바/0`, `+바로`, `한발씩/한팔씩/원레그`)
- **양은 적음**: 실제 운동 라인은 추정 300~800줄
- **노이즈 비율 90%**: 인스타 링크, 음식, 면접 메시지가 대부분
- **드롭세트 위치 가변**: 1세트, 3세트 등 임의 위치
- **메모/세션 헤더 자유**: `Pt 상체 등`, `왼쪽 등이 너무 굳어있음` 등

### 제약
- **런타임 LLM 호출 금지** (비용 우려) — 단, 개발 도구로서 Claude Code 사용은 OK
- 작업은 단 1회 수행 → 재현성보다 결과물의 정확성과 검증 가능성 중요

## Considered Options

| Option | 설명 |
|--------|------|
| **A. 순수 정규식 파서** | TypeScript/Python 스크립트로 규칙 기반 파싱 |
| **B. Claude Code 일회성 파싱** | 개발 도구에 .eml 보여주고 JSON으로 변환 (런타임 API 아님) |
| **C. 하이브리드** | 정규식 1차 + LLM 보강 2단계 파이프라인 |
| **D. 포기 (수동 입력)** | 카탈로그만 시드, 과거 기록은 옮기지 않음 |

## Decision

**Option B+ 채택**: Claude Code 일회성 파싱 + Markdown 검증 + Confidence 마킹.

### 기각 이유

| 옵션 | 기각 이유 |
|------|-----------|
| A. 정규식 | 변형 패턴 30~40개 규칙 작성/디버깅에 4~8시간. 30~50세션 1회성 작업에 투자 회수 불가. 자유 텍스트 메모 처리 약함. |
| C. 하이브리드 | 2단계 파이프라인 설계는 수천 세션 규모에서 의미. 현재 데이터 양 대비 과잉 설계. |
| D. 수동 입력 | 점진적 과부하 추천의 베이스라인 손실. 1년치 PT 학습 데이터 소실. 앱 핵심 가치 훼손. |

## 실행 절차

### Step 1: 운동 카탈로그(exercises) 시드 먼저 생성
**카탈로그가 확정되어야 세트 데이터 FK 정합성 보장 + 운동명 검증이 즉시 가능**.

- Claude Code에 .eml + ADR-001/003 스키마 컨텍스트 제공
- 출력: `seeds/exercises.json`
  ```jsonc
  {
    "exercises": [
      {
        "name": "랫풀다운",
        "body_parts": [{ "code": "back", "is_primary": true }],
        "is_unilateral": false,
        "parent_exercise_id": null,
        "equipment": "machine"
      },
      {
        "name": "랫풀다운 (한팔씩)",
        "body_parts": [{ "code": "back", "is_primary": true }],
        "is_unilateral": true,
        "parent_exercise_id": "랫풀다운"
      }
      // ...
    ]
  }
  ```
- 사용자(본인)가 운동명 리스트 검토 → OK면 진행

### Step 2: 세션 + 세트 데이터 파싱
- Claude Code에 카탈로그(Step 1 결과) + .eml + 파싱 규칙 명시
- **명시적 매핑 테이블 제공**:
  - `빈바` → 20kg
  - `0` → bodyweight (weight_kg=NULL 또는 0)
  - `+바로` → 드롭세트 (parent_set_id 연결)
  - `한발씩/한팔씩/원레그` → unilateral variant 매핑
- 출력: `seeds/workout_sessions.json`
  ```jsonc
  {
    "sessions": [
      {
        "date": "2026-01-07",
        "started_at": "2026-01-07T20:02:00+09:00",
        "routine_label": "개인운동 등",
        "notes": "",
        "exercises": [
          {
            "exercise_name": "랫풀다운",
            "sets": [
              { "set_number": 1, "weight_kg": 20, "reps": 15, "side": "both", "confidence": "high" },
              { "set_number": 2, "weight_kg": 30, "reps": 15, "side": "both", "confidence": "high" },
              { "set_number": 3, "weight_kg": 40, "reps": 8, "side": "both", "confidence": "high" },
              { "set_number": 3, "drop_order": 1, "weight_kg": 25, "reps": 15, "side": "both", "confidence": "high" }
            ]
          }
        ]
      }
    ],
    "unresolved": [
      { "line": "5에서 7.5로 쥐어짜냄", "reason": "운동 미상", "session_date": "..." }
    ]
  }
  ```

### Step 3: Markdown 검증 테이블 생성
사용자가 원본 ↔ 파싱 결과를 눈으로 대조.

`docs/import/validation-2026-01-07.md` 예시:
```
| 원본 | 운동 | 세트 | kg | 회수 | drop | side | conf |
|------|------|------|----|----|------|------|------|
| 랫풀다운 40(8회)+바로25(15회) | 랫풀다운 | 3 | 40 | 8 | - | both | high |
| (drop) | 랫풀다운 | 3-d1 | 25 | 15 | 1 | both | high |
```

### Step 4: 사용자 검토 + 수정 → DB 임포트
- `confidence=low` 또는 `unresolved` 항목 수동 처리
- 최종 JSON → SQL INSERT 변환 스크립트 → Supabase

## Consequences

### Positive
- **작업량 최소**: Step 1~2가 1~2시간, 검증 2~3시간 = 총 3~5시간
- **변형/메모/노이즈 처리 유연**: LLM이 컨텍스트 보고 판단
- **단계적 검증**: 카탈로그 → 세트 데이터 → Markdown 대조 → DB
- **포트폴리오 산출물**: exercises.json, workout_sessions.json, validation 마크다운 3종을 Git에 커밋 → "비정형 텍스트 → 정형 Postgres" 마이그레이션 사례
- **비용 0**: Claude Code는 개발 환경이므로 런타임 API 비용 없음

### Negative
- 재현 불가능 (LLM 비결정성) — 단, 1회성 작업이므로 결과 JSON이 산출물로 충분
- 사용자 검증 시간 필요 (~2~3시간)
- LLM hallucination 리스크 → confidence 마킹과 unresolved 분리로 완화

### Mitigation
- `confidence=low`/`unresolved` 분리로 의심 케이스 명시
- Markdown 검증 테이블에 원본 그대로 병기 → 눈 대조
- 최종 INSERT 전 사용자 승인 게이트 1회 더

## Implementation Notes

### 파싱 지시 프롬프트 핵심 요소
1. 스키마 참조: ADR-001/002/003 핵심 표
2. 매핑 사전: 빈바=20kg, 0=bodyweight, +바로=drop_set 등
3. 출력 형식: 위 JSON 스키마 그대로
4. confidence 기준: high(완전 명시) / medium(추정) / low(맥락 의존)
5. 노이즈 라인 무시 규칙: 운동 키워드 미포함 라인 스킵

### 디렉토리 구조 (예정)
```
/seeds/
  body_parts.json          # ADR-001 시드
  exercises.json           # Step 1 산출물
  workout_sessions.json    # Step 2 산출물
/scripts/
  import-from-json.ts      # JSON → SQL INSERT
  validate-imports.ts      # 검증 헬퍼
/docs/import/
  validation-YYYY-MM-DD.md # 검증 테이블 (세션별)
  import-log.md            # 임포트 결과 로그
```

### 운영 후 정책
- 임포트 완료 후 카탈로그(exercises)는 앱 내 "운동 추가" UI로 점진적 보강
- 과거 데이터는 동결, 새 데이터는 정상 워크플로우

## References
- Architect 에이전트 검토 (2026-05-22)
- ADR-001 (body_parts), ADR-002 (drop sets), ADR-003 (side) 스키마 정합성 확인됨
