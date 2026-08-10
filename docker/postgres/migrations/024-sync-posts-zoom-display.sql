-- Ensure tin tức structured fields + zoom rooms stay in sync for the public site.
BEGIN;

-- Re-seed zoom rooms (idempotent).
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

-- Link posts → zoom_rooms and copy official join URLs.
UPDATE posts p
SET
  zoom_room_id = z.id,
  zoom_meeting_id = z.meeting_id,
  zoom_pass = z.pass,
  zoom_url = z.url,
  updated_at = now()
FROM zoom_rooms z
WHERE regexp_replace(coalesce(p.zoom_meeting_id, ''), '\s', '', 'g') = z.meeting_id;

COMMIT;
