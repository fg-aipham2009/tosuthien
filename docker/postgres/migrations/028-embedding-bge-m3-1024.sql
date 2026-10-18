-- Switch RAG embeddings from MiniLM 384-d to BGE-M3 1024-d.
-- Idempotent: only truncate/alter when column is still vector(384).
-- After this, re-run: scripts/embed.py --all --create-index

DO $$
DECLARE
  dim int;
BEGIN
  SELECT NULLIF(atttypmod, -1) - 4
    INTO dim
  FROM pg_attribute a
  JOIN pg_class c ON c.oid = a.attrelid
  JOIN pg_namespace n ON n.oid = c.relnamespace
  WHERE n.nspname = 'public'
    AND c.relname = 'passage_embeddings'
    AND a.attname = 'embedding'
    AND NOT a.attisdropped;

  IF dim IS DISTINCT FROM 1024 THEN
    EXECUTE 'DROP INDEX IF EXISTS idx_passage_embeddings_hnsw';
    EXECUTE 'TRUNCATE TABLE passage_embeddings';
    EXECUTE 'ALTER TABLE passage_embeddings ALTER COLUMN embedding TYPE vector(1024)';
    UPDATE rag_sources
    SET status = 'ingested',
        embedded_at = NULL
    WHERE status = 'embedded';
  END IF;
END $$;
