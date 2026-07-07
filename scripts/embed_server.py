#!/usr/bin/env python3
"""
Local OpenAI-compatible embedding server (fastembed, multilingual, 384-dim).

Serves POST /v1/embeddings so BOTH the offline batch job (scripts/embed.py)
and the NestJS runtime (EmbeddingService) can share one model — no API key,
no cost. Default model paraphrase-multilingual-MiniLM-L12-v2 outputs 384 dims
(matching pgvector schema vector(384)). On this Vietnamese Zen corpus it
retrieved relevant passages better than the larger mpnet-base-v2 (which
surfaced cover pages / boilerplate) and embeds far faster on CPU (~23s).

Only e5-family models use asymmetric prefixes ("query: ..." / "passage: ...");
for symmetric sentence-transformers (the default) prefixes hurt, so they are
applied only when the model name contains "e5". The caller signals intent via
the (non-OpenAI) `input_type` field; NestJS sends input_type="query".

Usage:
  python3 scripts/embed_server.py                 # http://localhost:7997
  EMBED_PORT=8100 python3 scripts/embed_server.py

.env (point both consumers here):
  EMBEDDING_BASE_URL=http://localhost:7997/v1
  EMBEDDING_API_KEY=local
  EMBEDDING_MODEL=sentence-transformers/paraphrase-multilingual-MiniLM-L12-v2
  EMBEDDING_DIM=384
"""

from __future__ import annotations

import os
from typing import List, Optional, Union

from fastapi import FastAPI
from fastembed import TextEmbedding
from pydantic import BaseModel

MODEL_NAME = os.getenv(
    "EMBEDDING_MODEL",
    "sentence-transformers/paraphrase-multilingual-MiniLM-L12-v2",
)
PORT = int(os.getenv("EMBED_PORT", "7997"))
USES_E5_PREFIX = "e5" in MODEL_NAME.lower()

print(f"Loading fastembed model: {MODEL_NAME} (first run downloads weights)...")
_model = TextEmbedding(model_name=MODEL_NAME)
print("Model ready.")

app = FastAPI(title="Local Embedding Server")


class EmbeddingRequest(BaseModel):
    input: Union[str, List[str]]
    model: Optional[str] = None
    # Accepted for OpenAI compatibility but ignored: dim is fixed by the model.
    dimensions: Optional[int] = None
    # "passage" (default) for documents, "query" for search queries.
    input_type: str = "passage"


def _apply_prefix(texts: List[str], input_type: str) -> List[str]:
    if not USES_E5_PREFIX:
        return texts
    prefix = "query: " if input_type == "query" else "passage: "
    return [prefix + t for t in texts]


@app.get("/health")
def health() -> dict:
    return {"status": "ok", "model": MODEL_NAME}


@app.post("/v1/embeddings")
@app.post("/embeddings")
def embeddings(req: EmbeddingRequest) -> dict:
    texts = [req.input] if isinstance(req.input, str) else req.input
    prefixed = _apply_prefix(texts, req.input_type)
    vectors = [vec.tolist() for vec in _model.embed(prefixed)]
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

    uvicorn.run(app, host="0.0.0.0", port=PORT)
