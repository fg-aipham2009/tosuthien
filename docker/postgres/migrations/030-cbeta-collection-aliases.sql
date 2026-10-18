-- CBETA collection name → code aliases (router filter; no Nest hardcode)
-- Apply on database `cbeta`.

CREATE TABLE IF NOT EXISTS collection_aliases (
  id               bigserial PRIMARY KEY,
  collection_code  text NOT NULL REFERENCES collections (code) ON DELETE CASCADE,
  alias            text NOT NULL,
  created_at       timestamptz NOT NULL DEFAULT now(),
  UNIQUE (collection_code, alias)
);

CREATE INDEX IF NOT EXISTS idx_cbeta_collection_aliases_code
  ON collection_aliases (collection_code);

-- Supplement corpora (may already exist from ingest)
INSERT INTO collections (code, name_zh, name_vi, sort_order) VALUES
  ('XY', '虛雲和尚全集（岑學呂法彙＋年譜）', 'Hư Vân toàn tập (Pháp hội + Niên phổ)', 90),
  ('LQ', '來果禪師語錄／開示錄', 'Lai Quả ngữ lục / khai thị lục', 91)
ON CONFLICT (code) DO NOTHING;

INSERT INTO collection_aliases (collection_code, alias) VALUES
  ('XY', '虛雲'),
  ('XY', 'hư vân'),
  ('XY', 'xuyun'),
  ('LQ', '來果'),
  ('LQ', 'lai quả'),
  ('LQ', 'laiguo')
ON CONFLICT (collection_code, alias) DO NOTHING;
