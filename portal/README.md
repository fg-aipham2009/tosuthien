# Tổ Sư Thiền — web app (Vue 3)

Ứng dụng web tại **https://tosuthien.net** (cùng API với Flutter `app.tosuthien.net`).

## Chức năng

| Tab | Route | API |
|-----|-------|-----|
| Hỏi đáp | `/` | `POST /api/rag/chat/stream` + `GET /api/rag/sources` |
| Kinh sách | `/kinh-sach` | `/api/pdfs`, `/api/text-books` |
| MP3 | `/mp3` | `/api/media/categories`, `/api/mp3/tracks` |
| Thiền đường | `/thien-duong` | `/api/centers` |

## Dev

```bash
cd portal
npm install
npm run dev   # http://localhost:5174
```

API mặc định: `https://api.tosuthien.net` — đổi bằng `VITE_API_BASE_URL`.

## Deploy

```bash
npm run build
rsync -avz --delete dist/ tosuthien-vps:/tmp/portal-dist/
ssh tosuthien-vps 'sudo rsync -a --delete /tmp/portal-dist/ /opt/tosu-thien/portal/'
```
