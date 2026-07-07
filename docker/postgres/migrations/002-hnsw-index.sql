-- Speed up vector similarity search (safe to re-run)
CREATE INDEX IF NOT EXISTS idx_passage_embeddings_hnsw
  ON passage_embeddings USING hnsw (embedding vector_cosine_ops);
