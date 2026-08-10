-- Giảng sư + 3 lớp học + thông báo khóa học (poster)
CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS teachers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug text NOT NULL UNIQUE,
  rank text,
  name text NOT NULL,
  photo_url text,
  bio text,
  sort_order int NOT NULL DEFAULT 0,
  is_published boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_teachers_sort ON teachers (sort_order);
CREATE INDEX IF NOT EXISTS idx_teachers_published ON teachers (is_published);

CREATE TABLE IF NOT EXISTS dharma_classes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text NOT NULL UNIQUE,
  name text NOT NULL,
  short_name text,
  weekday int,
  time_text text,
  zoom_meeting_id text,
  zoom_pass text,
  zoom_url text,
  default_teacher_id uuid REFERENCES teachers (id) ON DELETE SET NULL,
  sort_order int NOT NULL DEFAULT 0,
  is_published boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_dharma_classes_sort ON dharma_classes (sort_order);

CREATE TABLE IF NOT EXISTS class_announcements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  class_id uuid NOT NULL REFERENCES dharma_classes (id) ON DELETE CASCADE,
  teacher_id uuid REFERENCES teachers (id) ON DELETE SET NULL,
  temple_name text NOT NULL DEFAULT 'TRƯỜNG HẠ CHÙA PHẬT ĐÀ',
  temple_address text,
  topic_title text NOT NULL,
  format_note text,
  teacher_name_text text,
  teacher_photo_url text,
  session_date date,
  lunar_date_text text,
  time_text text,
  zoom_meeting_id text,
  zoom_pass text,
  zoom_url text,
  resources_note text,
  background_key text NOT NULL DEFAULT 'default',
  is_published boolean NOT NULL DEFAULT true,
  sort_order int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_class_announcements_class_date
  ON class_announcements (class_id, session_date DESC);
CREATE INDEX IF NOT EXISTS idx_class_announcements_published
  ON class_announcements (is_published, session_date DESC);

-- Seed giảng sư
INSERT INTO teachers (slug, rank, name, sort_order) VALUES
  ('ht-thich-minh-hien', 'HT', 'Thích Minh Hiền', 1),
  ('ht-thich-duy-tran', 'HT', 'Thích Duy Trấn', 2),
  ('ht-thich-minh-thien', 'HT', 'Thích Minh Thiền', 3),
  ('ht-thich-minh-hoa', 'HT', 'Thích Minh Hoà', 4),
  ('ht-thich-nhut-tay', 'HT', 'Thích Nhựt Tây', 5),
  ('ht-thich-hue-minh', 'HT', 'Thích Huệ Minh', 6),
  ('ht-thich-minh-tho', 'HT', 'Thích Minh Thọ', 7),
  ('ht-thich-minh-ngoc', 'HT', 'Thích Minh Ngọc', 8),
  ('tt-thich-minh-due', 'TT', 'Thích Minh Duệ', 9),
  ('tt-thich-nhuan-thuan', 'TT', 'Thích Nhuận Thuận', 10)
ON CONFLICT (slug) DO UPDATE SET
  rank = EXCLUDED.rank,
  name = EXCLUDED.name,
  sort_order = EXCLUDED.sort_order,
  updated_at = now();

-- Seed 3 lớp + Zoom từ tosuthien.com
INSERT INTO dharma_classes (
  code, name, short_name, weekday, time_text,
  zoom_meeting_id, zoom_pass, zoom_url, default_teacher_id, sort_order
)
SELECT
  v.code, v.name, v.short_name, v.weekday, v.time_text,
  v.zoom_meeting_id, v.zoom_pass, v.zoom_url, t.id, v.sort_order
FROM (
  VALUES
    (
      'CLASS_THU_5',
      'Chuyên đề Tổ Sư thiền tối thứ 5 (các vị giáo thọ)',
      'Chuyên đề Tổ Sư thiền',
      4,
      '19h00 - 20h00 tối thứ 5 hàng tuần',
      '2258212697',
      'thamthien',
      'https://us02web.zoom.us/j/2258212697?pwd=ckp4bVZNbHhnaWFLb0R1cFNhVEk1UT09',
      NULL::text,
      1
    ),
    (
      'CLASS_THU_2',
      'Chuyên đề thiền căn bản tối thứ 2 (HT Thích Minh Hiền)',
      'Chuyên đề thiền căn bản',
      1,
      '19h00 - 20h00 tối thứ 2 hàng tuần',
      '8196000378',
      'phatphap',
      'https://zoom.us/j/8196000378?pwd=akZVV3p4YmVHSytlcTdQY2wvdTd3QT09',
      'ht-thich-minh-hien',
      2
    ),
    (
      'CLASS_THU_7',
      'Thiền căn bản tối thứ 7 (HT Thích Minh Hiền)',
      'Thiền căn bản',
      6,
      '19h00 - 20h00 tối thứ 7 hàng tuần',
      '8196000378',
      'phatphap',
      'https://zoom.us/j/8196000378?pwd=akZVV3p4YmVHSytlcTdQY2wvdTd3QT09',
      'ht-thich-minh-hien',
      3
    )
) AS v(code, name, short_name, weekday, time_text, zoom_meeting_id, zoom_pass, zoom_url, teacher_slug, sort_order)
LEFT JOIN teachers t ON t.slug = v.teacher_slug
ON CONFLICT (code) DO UPDATE SET
  name = EXCLUDED.name,
  short_name = EXCLUDED.short_name,
  weekday = EXCLUDED.weekday,
  time_text = EXCLUDED.time_text,
  zoom_meeting_id = EXCLUDED.zoom_meeting_id,
  zoom_pass = EXCLUDED.zoom_pass,
  zoom_url = EXCLUDED.zoom_url,
  default_teacher_id = EXCLUDED.default_teacher_id,
  sort_order = EXCLUDED.sort_order,
  updated_at = now();
