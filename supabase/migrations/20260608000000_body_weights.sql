-- 몸무게 기록 — 캘린더 배지 + 추이 그래프용.
-- 하루에 아침/저녁 각 1건씩 저장 가능 (UNIQUE(user_id, log_date, slot)).
CREATE TABLE IF NOT EXISTS body_weights (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  log_date date NOT NULL,
  slot text NOT NULL CHECK (slot IN ('morning', 'evening')),
  weight_kg numeric(5,2) NOT NULL CHECK (weight_kg > 0 AND weight_kg < 500),
  recorded_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, log_date, slot)
);

ALTER TABLE body_weights ENABLE ROW LEVEL SECURITY;

CREATE POLICY "own body_weights" ON body_weights
  FOR ALL USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE INDEX IF NOT EXISTS idx_body_weights_user_date
  ON body_weights (user_id, log_date DESC);
