#!/usr/bin/env python3
"""
Local OpenAI-compatible embedding server — BAAI/bge-m3 only (1024-d).

Shared by scripts/embed.py and NestJS EmbeddingService.

Per https://huggingface.co/BAAI/bge-m3 :
  - Dense retrieval: 1024 dims, up to 8192 tokens
  - Do NOT add instruction prefixes to query or passage (unlike older BGE)
  - Official RAG tip: hybrid retrieval (+ optional rerank) — FTS lives in Nest/DB

.env:
  EMBEDDING_BASE_URL=http://localhost:7997/v1
  EMBEDDING_API_KEY=local
  EMBEDDING_MODEL=BAAI/bge-m3
  EMBEDDING_DIM=1024
  EMBED_THREADS=1
  EMBED_BATCH=8
"""

from __future__ import annotations

import os
from typing import List, Optional, Union

_nthreads = max(1, int(os.getenv("EMBED_THREADS", os.getenv("OMP_NUM_THREADS", "1"))))
os.environ.setdefault("OMP_NUM_THREADS", str(_nthreads))
os.environ.setdefault("MKL_NUM_THREADS", str(_nthreads))
os.environ.setdefault("OPENBLAS_NUM_THREADS", str(_nthreads))
os.environ.setdefault("TOKENIZERS_PARALLELISM", "false")

from fastapi import FastAPI
from pydantic import BaseModel
from sentence_transformers import SentenceTransformer

MODEL_NAME = os.getenv("EMBEDDING_MODEL", "BAAI/bge-m3")
PORT = int(os.getenv("EMBED_PORT", "7997"))
EXPECTED_DIM = int(os.getenv("EMBEDDING_DIM", "1024"))

if "bge-m3" not in MODEL_NAME.lower():
    raise SystemExit(
        f"Unsupported EMBEDDING_MODEL={MODEL_NAME!r}. "
        "This server only serves BAAI/bge-m3 (MiniLM/fastembed removed)."
    )

print(
    f"Loading {MODEL_NAME} (sentence-transformers, cpu, threads={_nthreads}; "
    "first run may download from Hugging Face)..."
)
_model = SentenceTransformer(MODEL_NAME, device="cpu")
print("Model ready.")

app = FastAPI(title="Local Embedding Server (BGE-M3)")


class EmbeddingRequest(BaseModel):
    input: Union[str, List[str]]
    model: Optional[str] = None
    dimensions: Optional[int] = None
    # Accepted for API compat; BGE-M3 dense needs no query/passage prefix.
    input_type: str = "passage"


def _embed(texts: List[str]) -> List[List[float]]:
    batch = max(1, int(os.getenv("EMBED_BATCH", "8")))
    vectors = _model.encode(
        texts,
        batch_size=batch,
        normalize_embeddings=True,
        show_progress_bar=False,
    )
    out = [vec.tolist() for vec in vectors]
    if out and len(out[0]) != EXPECTED_DIM:
        raise RuntimeError(f"Got dim {len(out[0])}, expected {EXPECTED_DIM}")
    return out


@app.get("/health")
def health() -> dict:
    return {
        "status": "ok",
        "model": MODEL_NAME,
        "dim": EXPECTED_DIM,
        "backend": "sentence-transformers",
        "threads": _nthreads,
    }


@app.post("/v1/embeddings")
@app.post("/embeddings")
def embeddings(req: EmbeddingRequest) -> dict:
    texts = [req.input] if isinstance(req.input, str) else req.input
    vectors = _embed(texts)
    data = [
        {"object": "embedding", "index": i, "embedding": vec}
        for i, vec in enumerate(vectors)
    ]
    return {
        "object": "list",
        "model": MODEL_NAME,
        "data": data,
        "usage": {"prompt_tokens": 0, "total_tokens": 0},
    }


if __name__ == "__main__":
    import uvicorn

    uvicorn.run(
        app,
        host="0.0.0.0",
        port=PORT,
        workers=1,
        limit_concurrency=8,
        timeout_keep_alive=30,
    )
