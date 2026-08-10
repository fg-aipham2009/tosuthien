-- Structured tin tức announcement fields for admin form (no HTML/image editing).
BEGIN;

ALTER TABLE posts
  ADD COLUMN IF NOT EXISTS topic_text text,
  ADD COLUMN IF NOT EXISTS teacher_text text,
  ADD COLUMN IF NOT EXISTS schedule_text text,
  ADD COLUMN IF NOT EXISTS zoom_meeting_id text,
  ADD COLUMN IF NOT EXISTS zoom_pass text,
  ADD COLUMN IF NOT EXISTS zoom_url text,
  ADD COLUMN IF NOT EXISTS description text;

COMMENT ON COLUMN posts.topic_text IS 'Announcement slot 1: topic / đề tài';
COMMENT ON COLUMN posts.teacher_text IS 'Announcement slot 2: teacher / giảng sư';
COMMENT ON COLUMN posts.schedule_text IS 'Announcement slot 3: schedule / thời gian';
COMMENT ON COLUMN posts.zoom_meeting_id IS 'Announcement slot 4: Zoom meeting id';
COMMENT ON COLUMN posts.zoom_pass IS 'Zoom passcode';
COMMENT ON COLUMN posts.zoom_url IS 'Zoom join URL (optional; can be derived from id+pass)';
COMMENT ON COLUMN posts.description IS 'Optional extra description / prose below poster';

COMMIT;
