-- Shared Zoom rooms for tin tức admin dropdown (currently 2 rooms).
BEGIN;

CREATE TABLE IF NOT EXISTS zoom_rooms (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text NOT NULL UNIQUE,
  name text NOT NULL,
  meeting_id text NOT NULL,
  pass text,
  url text,
  sort_order int NOT NULL DEFAULT 0,
  is_published boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_zoom_rooms_sort
  ON zoom_rooms (sort_order, name);

ALTER TABLE posts
  ADD COLUMN IF NOT EXISTS zoom_room_id uuid REFERENCES zoom_rooms (id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_posts_zoom_room
  ON posts (zoom_room_id);

INSERT INTO zoom_rooms (code, name, meeting_id, pass, url, sort_order)
VALUES
  (
    'ZOOM_CAN_BAN',
    'Thiền căn bản (thứ 2 / thứ 7)',
    '8196000378',
    'phatphap',
    'https://zoom.us/j/8196000378?pwd=akZVV3p4YmVHSytlcTdQY2wvdTd3QT09',
    1
  ),
  (
    'ZOOM_CHUYEN_DE',
    'Chuyên đề Tổ Sư thiền (thứ 5)',
    '2258212697',
    'thamthien',
    'https://us02web.zoom.us/j/2258212697?pwd=ckp4bVZNbHhnaWFLb0R1cFNhVEk1UT09',
    2
  )
ON CONFLICT (code) DO UPDATE SET
  name = EXCLUDED.name,
  meeting_id = EXCLUDED.meeting_id,
  pass = EXCLUDED.pass,
  url = EXCLUDED.url,
  sort_order = EXCLUDED.sort_order,
  updated_at = now();

-- Link existing posts that already have matching meeting ids.
UPDATE posts p
SET zoom_room_id = z.id
FROM zoom_rooms z
WHERE p.zoom_room_id IS NULL
  AND coalesce(p.zoom_meeting_id, '') <> ''
  AND regexp_replace(p.zoom_meeting_id, '\s', '', 'g') = z.meeting_id;

COMMIT;
