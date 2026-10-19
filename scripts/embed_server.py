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
  EMBED_DEVICE=auto   # auto | mps | cpu  (auto prefers Apple MPS when available)
"""

from __future__ import annotations

import os
import threading
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
# HTTP accept limit (uvicorn). Encode itself is serialized by _ENCODE_LOCK —
# raise this so clients wait instead of getting 503 "Exceeded concurrency limit".
LIMIT_CONCURRENCY = max(1, int(os.getenv("EMBED_LIMIT_CONCURRENCY", "64")))
# Cap sequence length for speed (CBETA chunks ~512–1k tokens; full 8192 is slow).
MAX_SEQ_LENGTH = max(128, int(os.getenv("EMBED_MAX_SEQ_LENGTH", "1024")))
_ENCODE_LOCK = threading.Lock()


def _resolve_device() -> str:
    """Pick inference device. Prefer MPS on Apple Silicon when EMBED_DEVICE=auto."""
    wanted = (os.getenv("EMBED_DEVICE") or "auto").strip().lower()
    if wanted == "cpu":
        return "cpu"
    if wanted == "mps":
        try:
            import torch

            if torch.backends.mps.is_available():
                return "mps"
        except Exception:
            pass
        print("EMBED_DEVICE=mps unavailable; falling back to cpu", flush=True)
        return "cpu"
    # auto
    try:
        import torch

        if torch.backends.mps.is_available():
            return "mps"
    except Exception:
        pass
    return "cpu"


DEVICE = _resolve_device()

# Never honor MiniLM/384 from a stale .env — CBETA vectors are BGE-M3 1024-d.
if "bge-m3" not in MODEL_NAME.lower() or EXPECTED_DIM != 1024:
    print(
        f"WARNING: refusing EMBEDDING_MODEL={MODEL_NAME!r} dim={EXPECTED_DIM}; "
        f"forcing BAAI/bge-m3 / 1024 (MiniLM permanently removed).",
        flush=True,
    )
    MODEL_NAME = "BAAI/bge-m3"
    EXPECTED_DIM = 1024
    os.environ["EMBEDDING_MODEL"] = MODEL_NAME
    os.environ["EMBEDDING_DIM"] = "1024"

print(
    f"Loading {MODEL_NAME} (sentence-transformers, device={DEVICE}, "
    f"threads={_nthreads}; first run may download from Hugging Face)...",
    flush=True,
)
_model = SentenceTransformer(MODEL_NAME, device=DEVICE)
try:
    _model.max_seq_length = MAX_SEQ_LENGTH
except Exception:
    pass
print(f"Model ready. max_seq_length={getattr(_model, 'max_seq_length', '?')}", flush=True)

app = FastAPI(title="Local Embedding Server (BGE-M3)")


class EmbeddingRequest(BaseModel):
    input: Union[str, List[str]]
    model: Optional[str] = None
    dimensions: Optional[int] = None
    # Accepted for API compat; BGE-M3 dense needs no query/passage prefix.
    input_type: str = "passage"


def _embed(texts: List[str]) -> List[List[float]]:
    batch = max(1, int(os.getenv("EMBED_BATCH", "8")))
    # One encode at a time — BGE-M3 + MPS/CPU cannot usefully parallelize HTTP
    # requests; queuing avoids uvicorn 503 storms that waste client retries.
    with _ENCODE_LOCK:
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
        "device": DEVICE,
        "threads": _nthreads,
        "batch": max(1, int(os.getenv("EMBED_BATCH", "8"))),
        "max_seq_length": getattr(_model, "max_seq_length", None),
        "limit_concurrency": LIMIT_CONCURRENCY,
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
        limit_concurrency=LIMIT_CONCURRENCY,
        timeout_keep_alive=120,
    )
