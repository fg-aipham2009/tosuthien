# Hướng dẫn cơ bản — App Tổ Sư Thiền

Tài liệu ngắn gọn cho **backend + RAG** đã dựng sẵn. Chi tiết kiến trúc đầy đủ: [`README.md`](README.md).

**Phạm vi:** Hoà thượng Thích Duy Lực · phương pháp Tổ Sư Thiền · nguồn `text/*.txt` (OCR kinh sách).

---

## 1. App làm gì?

| Tab (Flutter) | Chức năng | API |
|---------------|-----------|-----|
| Kinh sách | Đọc PDF, nhớ trang | `GET /api/pdfs` |
| **Hỏi đáp** | Hỏi tiếng Việt → AI + trích dẫn trang | `POST /api/rag/chat` |
| MP3 | Nghe pháp thoại | `GET /api/media/...` |
| Video | YouTube | `GET /api/youtube/videos` |
| Thiền đường | Chùa, khoá tu | `GET /api/centers`, `GET /api/courses` |

App **không đăng nhập**. Lịch sử hỏi đáp lưu trên điện thoại (Flutter local).

---

## 2. Chạy local (3 bước)

### Bước 1 — PostgreSQL

```bash
cp .env.example .env
# Sửa SHOPAIKEY_API_KEY trong .env

docker compose up -d
psql "$DATABASE_URL" -f schema.sql   # lần đầu
```

### Bước 2 — Ingest + embed kinh sách (1 lần, hoặc khi thêm file text)

```bash
pip3 install -r requirements.txt

python3 scripts/ingest.py
python3 scripts/embed_server.py     # terminal 1 — giữ chạy nền
python3 scripts/embed.py --create-index
```

### Bước 3 — Backend NestJS

```bash
cd nestjs
npm install
npm run start:dev                   # http://localhost:8000
```

Kiểm tra:

```bash
curl http://localhost:8000/api/health
curl http://localhost:7997/health
```

---

## 3. Hỏi đáp RAG — cách dùng

### Gọi API

```bash
curl -X POST http://localhost:8000/api/rag/chat \
  -H "Content-Type: application/json" \
  -d '{"question":"nghi tình là gì"}'
```

Tùy chọn `topK` (1–10, mặc định server tự chọn):

```bash
curl -X POST http://localhost:8000/api/rag/chat \
  -H "Content-Type: application/json" \
  -d '{"question":"thoại đầu là gì","topK":5}'
```

### Response mẫu

```json
{
  "answer": "Nghi tình là sự thắc mắc... — (Duy Lực Ngữ Lục, tr.282)",
  "disclaimer": "Câu trả lời do AI tổng hợp từ kinh sách...",
  "citations": [
    {
      "label": "DUY LỰC NGỮ LỤC, tr.282",
      "title": "DUY LỰC NGỮ LỤC",
      "pageNum": 282,
      "quote": "Tham thiền phải giữ được nghi tình...",
      "pdf": null,
      "openLabel": null
    }
  ],
  "meta": {
    "topK": 3,
    "topKResolved": 3,
    "embeddingCount": 1352,
    "searchMode": "hybrid"
  }
}
```

| Field | Ý nghĩa |
|-------|---------|
| `answer` | Câu trả lời — có trích nguyên văn `"..."` + nguồn `(Tên kinh, tr.X)` |
| `disclaimer` | Nhắc user tự đối chiếu kinh, không tin 100% AI |
| `citations[].quote` | Đoạn trích để user đọc lại |
| `citations[].pdf` | Link mở PDF đúng trang (khi đã seed `pdf_files`) |
| `meta.searchMode` | `hybrid` = FTS + vector · `fts` = chỉ từ khoá |

### Câu test đã thử OK

| Câu hỏi | Ghi chú |
|---------|---------|
| `thoại đầu là gì` | Trích Duy Lực Ngữ Lục tr.270, tr.504 |
| `nghi tình là gì` | Phân biệt nghi tình / hôn trầm / chơn nghi |
| `phương pháp tham thoại đầu` | Hybrid retrieval |

---

## 4. Cấu hình `.env`

```env
DATABASE_URL=postgresql://tosuthien:thamthien@localhost:5432/tosuthien
PUBLIC_BASE_URL=http://localhost:8000
PORT=8000

# Chat — Claude qua ShopAIKey (bắt buộc cho /rag/chat)
SHOPAIKEY_API_KEY=sk-...
CHAT_MODEL=claude-sonnet-4-6

# Embedding — local, miễn phí (scripts/embed_server.py)
EMBEDDING_BASE_URL=http://localhost:7997/v1
EMBEDDING_API_KEY=local
EMBEDDING_MODEL=sentence-transformers/paraphrase-multilingual-MiniLM-L12-v2
EMBEDDING_DIM=384
```

| Key | Ghi chú |
|-----|---------|
| `SHOPAIKEY_API_KEY` | Chat RAG — **ShopAIKey không có embedding** |
| `CHAT_MODEL` | Khuyên `claude-sonnet-4-6` (ổn định). Haiku đôi khi từ chối vai trò khi context dài |
| `EMBEDDING_*` | Trỏ embed server local — không tốn phí API |

---

## 5. RAG hoạt động thế nào?

```
Câu hỏi
  → embed câu hỏi (local MiniLM, 384-dim)
  → hybrid retrieval: FTS (từ khoá) + vector (ngữ nghĩa), gộp RRF
  → lọc đoạn rác (bìa sách, metadata)
  → topK đoạn (3–5 mặc định) → Claude (ShopAIKey)
  → answer + citations + disclaimer
```

**topK tự động:**

| Loại câu | topK |
|----------|------|
| Câu ngắn (≤2 từ khoá) | 3 |
| Câu thường | 5 |
| So sánh ("khác gì", "vs"...) | 8 |
| Tối đa | 10 |

---

## 6. Thêm / cập nhật kinh sách

```bash
# 1. Thêm hoặc sửa file trong text/
# 2. Ingest lại
python3 scripts/ingest.py

# 3. Embed (chỉ đoạn mới, hoặc --all để embed lại hết)
python3 scripts/embed.py --create-index
# hoặc: python3 scripts/embed.py --all --create-index
```

Embed server phải **đang chạy** (`python3 scripts/embed_server.py`).

---

## 7. Cấu trúc code chính

```
kínhsạch/
├── text/              # OCR kinh sách → nguồn RAG
├── scripts/
│   ├── ingest.py      # text → passages (DB)
│   ├── embed.py       # passages → vectors
│   └── embed_server.py # server embedding local (port 7997)
├── nestjs/
│   └── src/rag/
│       ├── chat.service.ts      # hybrid retrieval + LLM
│       ├── llm.service.ts       # Claude + system prompt
│       ├── embedding.service.ts   # gọi embed server
│       ├── citation-link.service.ts # link PDF theo trang
│       └── rag.constants.ts       # topK, disclaimer
└── schema.sql         # PostgreSQL + pgvector vector(384)
```

---

## 8. Lưu ý Flutter

- Base URL API: `PUBLIC_BASE_URL` (dev: `http://localhost:8000`, prod: domain VPS).
- Hiển thị **`disclaimer`** + **`citations[].quote`** — user tự kiểm chứng.
- Nút **"Mở tr.X"** dùng `citations[].pdf.openLabel` / `pdfUrl` khi đã upload PDF vào `pdf_files`.
- Không lưu chat lên server — chỉ `POST /api/rag/chat`, lưu local trên app.

---

## 9. Sự cố thường gặp

| Triệu chứng | Cách xử lý |
|-------------|------------|
| `500` / `Invalid token` | Kiểm tra `SHOPAIKEY_API_KEY`, nạp quota |
| `embeddingCount: 0` | Chạy `embed_server.py` + `embed.py` |
| Trả lời "Kiro / từ chối vai trò" | Đổi `CHAT_MODEL=claude-sonnet-4-6`, restart NestJS |
| Embed chậm lần đầu | Model ~220MB, tải 1 lần qua HuggingFace |
| `pdf: null` trong citation | Seed bảng `pdf_files` + copy PDF vào `data/pdf/` |
