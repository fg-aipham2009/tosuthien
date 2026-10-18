-- CBETA entity index (masters / names extracted from coverage works)
-- Apply on database `cbeta`.

CREATE TABLE IF NOT EXISTS canon_entities (
  id             bigserial PRIMARY KEY,
  name_zh        text NOT NULL,
  kind           text NOT NULL DEFAULT 'master'
                   CHECK (kind IN ('master', 'other')),
  work_code      text REFERENCES works (work_code) ON DELETE CASCADE,
  collection     text,
  chunk_id       text REFERENCES chunks (id) ON DELETE SET NULL,
  juan_no        int,
  mention_count  int NOT NULL DEFAULT 1,
  metadata       jsonb NOT NULL DEFAULT '{}',
  created_at     timestamptz NOT NULL DEFAULT now(),
  updated_at     timestamptz NOT NULL DEFAULT now(),
  UNIQUE (name_zh, work_code, kind)
);

CREATE INDEX IF NOT EXISTS idx_cbeta_entities_name
  ON canon_entities (name_zh);
CREATE INDEX IF NOT EXISTS idx_cbeta_entities_work
  ON canon_entities (work_code);
CREATE INDEX IF NOT EXISTS idx_cbeta_entities_kind_count
  ON canon_entities (kind, mention_count DESC);
