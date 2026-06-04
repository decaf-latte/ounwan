-- 유산소 기록 — 운동 진행 화면 최하단 유산소 카드용.
-- 기존 workout_sets(무게×회수)와 모델이 달라 별도 테이블.
-- machine: 천국의계단 / 인클라인 / 러닝머신 (UI에서 3택1, 자유 text)
-- speed: 속도, incline: 경사/레벨, duration_min: 시간(분)
CREATE TABLE IF NOT EXISTS cardio_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id uuid NOT NULL REFERENCES workout_sessions(id) ON DELETE CASCADE,
  machine text NOT NULL,
  speed numeric,
  incline numeric,
  duration_min integer,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE cardio_logs ENABLE ROW LEVEL SECURITY;

-- 본인 세션의 유산소만 (workout_sets와 동일 패턴)
CREATE POLICY "own cardio" ON cardio_logs
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM workout_sessions s
      WHERE s.id = session_id AND s.user_id = auth.uid()
    )
  );

CREATE INDEX IF NOT EXISTS idx_cardio_logs_session ON cardio_logs (session_id);
