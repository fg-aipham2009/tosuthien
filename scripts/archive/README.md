# One-shot / offline scripts (not used by runtime API or site)

Moved here to keep `scripts/` focused on live ops:

- `ingest.py`, `embed.py`, `embed_server.py` — RAG pipeline
- `import_wp_news.py` — WordPress news import (re-runnable)
- `restart-api.sh`, `sync-pdfs-to-data.sh` — deploy helpers

Also kept at `scripts/` (ops, not archive):

- `migrate_posts_announcement_fields.mjs` — one-shot HTML → structured tin tức fields

Archive contents are historical migrations, renames, image cleanup, and chat benchmarks.
