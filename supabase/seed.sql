-- ADR-001 시드 데이터: body_parts 8행
INSERT INTO body_parts (code, name_ko, color, icon, display_order) VALUES
  ('chest',    '가슴',   '#FF6B6B', 'chest',    1),
  ('back',     '등',     '#4ECDC4', 'back',     2),
  ('shoulder', '어깨',   '#FFE66D', 'shoulder', 3),
  ('trap',     '승모근', '#95E1D3', 'trap',     4),
  ('arm',      '팔',     '#C9B1FF', 'arm',      5),
  ('leg',      '허벅지', '#F38181', 'leg',      6),
  ('glute',    '엉덩이', '#FCBAD3', 'glute',    7),
  ('core',     '복부',   '#A8E6CF', 'core',     8)
ON CONFLICT (code) DO NOTHING;
