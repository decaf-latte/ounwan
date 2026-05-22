-- 분할 템플릿 (per-user)
CREATE TABLE routine_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_routine_templates_user_id ON routine_templates (user_id);

-- 분할-부위 M:N (critic 검토에서 TEXT[]에서 정션으로 변경 — 정규화 일관성)
CREATE TABLE routine_template_body_parts (
  routine_template_id UUID REFERENCES routine_templates(id) ON DELETE CASCADE,
  body_part_id INT REFERENCES body_parts(id) ON DELETE CASCADE,
  PRIMARY KEY (routine_template_id, body_part_id)
);
