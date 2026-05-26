# KakaoTalk Import Log

- **Date:** 2026-05-26
- **Source:** Personal KakaoTalk self-chat `.eml` (gitignored, ~6,500 lines)
- **Target:** Supabase cloud (ounwan project, `wdypbeqyuqhbqdpwvgpj`)
- **Target user email:** `hyejin.jeon940120@gmail.com`
- **Target user_id:** `fbf4d037-82fe-4a2a-935e-f416560bb31e`

## Result

| Table | Count (DB) | Count (JSON) | Match |
|-------|------------|--------------|-------|
| `exercises` | 73 | 73 | ✅ |
| `exercise_body_parts` | 104 | 104 | ✅ |
| `workout_sessions` | 31 | 31 | ✅ |
| `workout_sets` (total) | 430 | 430 | ✅ |
| `workout_sets` (drops) | 14 | 14 | ✅ |

Verified via `scripts/verify-import.ts`.

## Date Range

- Earliest session: **2025-10-03**
- Latest session: **2026-05-21**
- ~7 months of personal workout data (lifting only — cardio absorbed into session notes)

## Confidence Breakdown (sets)

- high: **284**
- medium: **109**
- low: **37**

## Top Logged Exercises

1. 레그프레스 (10 sessions)
2. 랫풀다운 (7 sessions)
3. 리버스 랫풀다운 (6 sessions)
4. 펙덱 플라이 (6 sessions)
5. 사이드 레터럴 레이즈 (5 sessions)

## Pipeline Caveats

- **`routine_label` synthesis**: KakaoTalk session headers like `Pt 상체 등` / `개인운동 등` were synthesized into `overall_notes` as `[label] memo` (per ADR-004 + critic round 2 review — no schema change).
- **Aliases applied** (Chunk 2 user review): `꾹꾹이` → `스텝박스 원레그 스쿼트`, `부티머신` → `글루트 머신`.
- **Combo split** (Chunk 3 user review): "사이드 스쿼트 + 케틀벨 스윙" combo line on 2026-01-06 split into 2 separate exercise blocks per session.
- **Unresolved absorption** (Chunk 3 final): 11 ambiguous/cardio lines (천계, 마이마운틴, 러닝머신, 유산소, 롤러?, etc.) absorbed into respective session `overall_notes` as `[unresolved] ...` so no data lost. Lifting-only count remained 430 sets.
- **`빈바`**: mapped to `20kg` for barbell exercises (벤치프레스, 스쿼트, 데드리프트, 런지), kept as `null` + confidence=medium otherwise.

## Spot-Check Verification

Three sessions manually cross-checked against the `.eml` original by the parsing subagent:

| Date | Routine | Verified |
|------|---------|----------|
| 2026-04-06 | Pt 상체 등 | ✅ 랫풀다운 30/45/50, 리버스 20/25, 로잉머신, 케이블 누워서 당기기, 옆구리운동 |
| 2026-01-07 | 개인운동 등 | ✅ 랫풀다운 20/30/40+drop25, 리버스 15/25/35+drop20, 시티드 케이블 로우, 덤벨 로우 |
| 2026-01-08 | 가슴 어깨 | ✅ 벤치프레스 빈바=20/17.5/20, 팔굽혀펴기, 누워서 버터플라이, 펙덱, 사레레, 업라이트+페이스풀 |

## RLS Regression

`pnpm test` — 3/3 passing post-import:
- positive control (own row visible)
- isolation (User B cannot see)
- spoof attempt (user_id filter foreign id returns nothing)

## Recovery Path

If a re-run is needed:
- **Safe re-run**: `pnpm run import:apply` is idempotent. Skips existing exercises (by name) and sessions (by ISO `started_at`).
- **Clean re-import**: `pnpm run import:apply -- --wipe` deletes all imported data for the target user, then re-imports.
- **Manual SQL** (Supabase SQL Editor):
  ```sql
  DELETE FROM workout_sessions WHERE user_id = 'fbf4d037-82fe-4a2a-935e-f416560bb31e';
  DELETE FROM exercises WHERE user_id = 'fbf4d037-82fe-4a2a-935e-f416560bb31e';
  ```
  (CASCADE handles `workout_sets` and `exercise_body_parts`.)
