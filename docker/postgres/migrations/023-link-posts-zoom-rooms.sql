-- Attach posts to zoom_rooms by meeting id and copy official join URLs.
BEGIN;

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
