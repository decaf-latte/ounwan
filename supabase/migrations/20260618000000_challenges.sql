-- 챌린지 — 특정 운동/주제로 N일 도전. 운동 세션과 독립적으로 매일 수동 체크.
-- 연속 우선 + 허용 휴식일 N회 (누적 카운트).

CREATE TABLE IF NOT EXISTS challenges (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name text NOT NULL CHECK (char_length(name) BETWEEN 1 AND 60),
  target_days integer NOT NULL CHECK (target_days > 0 AND target_days <= 365),
  rest_days_allowed integer NOT NULL DEFAULT 0
    CHECK (rest_days_allowed >= 0 AND rest_days_allowed < target_days),
  start_date date NOT NULL DEFAULT CURRENT_DATE,
  ended_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS challenge_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  challenge_id uuid NOT NULL REFERENCES challenges(id) ON DELETE CASCADE,
  log_date date NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (challenge_id, log_date)
);

ALTER TABLE challenges ENABLE ROW LEVEL SECURITY;
ALTER TABLE challenge_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "own challenges" ON challenges
  FOR ALL USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "own challenge_logs" ON challenge_logs
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM challenges c
      WHERE c.id = challenge_id AND c.user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM challenges c
      WHERE c.id = challenge_id AND c.user_id = auth.uid()
    )
  );

CREATE INDEX IF NOT EXISTS idx_challenges_user_active
  ON challenges (user_id, ended_at);
CREATE INDEX IF NOT EXISTS idx_challenge_logs_date
  ON challenge_logs (challenge_id, log_date DESC);
