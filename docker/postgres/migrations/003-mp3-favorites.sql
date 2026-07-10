-- MP3 favorites by anonymous device_id (same pattern as reading_progress)
CREATE TABLE IF NOT EXISTS mp3_favorites (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  device_id    TEXT NOT NULL,
  mp3_track_id UUID NOT NULL REFERENCES mp3_tracks(id) ON DELETE CASCADE,
  created_at   TIMESTAMPTZ DEFAULT now(),
  UNIQUE (device_id, mp3_track_id)
);

CREATE INDEX IF NOT EXISTS idx_mp3_favorites_device ON mp3_favorites(device_id);
CREATE INDEX IF NOT EXISTS idx_mp3_favorites_track ON mp3_favorites(mp3_track_id);
