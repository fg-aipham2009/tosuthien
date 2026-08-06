# Nginx — tosuthien.net domains

| File | Domain | Upstream |
|------|--------|----------|
| `api.tosuthien.net.conf` | `api.tosuthien.net` | `127.0.0.1:8000` (Docker `api`) |
| `admin.tosuthien.net.conf` | `admin.tosuthien.net` | `127.0.0.1:5173` (Docker `admin`) |
| `app.tosuthien.net.conf` | `app.tosuthien.net` | `/opt/tosu-thien/www` (Flutter `build/web`) |
| `tosuthien.net.conf` | `tosuthien.net`, `www` | `/opt/tosu-thien/portal-dist` (built Vue portal) |
| `demo.tosuthien.net.conf` | `demo.tosuthien.net` | `127.0.0.1:5175` (Next `site/`) |

## Domain map (VPS)

| URL | App | Nginx upstream |
|-----|-----|----------------|
| **https://demo.tosuthien.net** | Next `site/` (preview **tosuthien.com**) | `127.0.0.1:5175` |
| **https://admin.tosuthien.net** | Vue admin (Docker) | `127.0.0.1:5173` |
| **https://api.tosuthien.net** | Nest API | `127.0.0.1:8000` |
| **https://tosuthien.net** | Vue portal `portal-dist` | static |
| **https://app.tosuthien.net** | Flutter web | `/opt/tosu-thien/www` |

DNS: `@`, `www`, `app`, `api`, `admin`, `demo` → cùng IP VPS (ví dụ `163.128.43.45`).  
**Không** trỏ admin lên demo. Cert riêng: `demo.tosuthien.net` vs SAN `tosuthien.net` (api, admin, app, www).

## Deploy / đồng bộ trên VPS

```bash
cd /opt/tosu-thien && git pull
chmod +x deploy/scripts/reconcile-vps-domains.sh
./deploy/scripts/reconcile-vps-domains.sh
```

Script trên: nginx (`sync-sites-on-vps.sh`), cert demo (nếu thiếu), build Next `:5175`, build portal → `portal-dist`.

Chỉ cập nhật nginx + quyền thư mục tĩnh (sau `git pull`):

```bash
chmod +x deploy/nginx/install-on-vps.sh
./deploy/nginx/install-on-vps.sh
```

## Flutter web → www

On dev machine:

```bash
cd flutter
flutter build web --dart-define=API_BASE_URL=https://api.tosuthien.net --release
rsync -avz build/web/ tosuthien-vps2:/opt/tosu-thien/www/
```

Or on VPS after copying `build/web`:

```bash
rsync -av /opt/tosu-thien/flutter/build/web/ /opt/tosu-thien/www/
```

## HTTPS

```bash
sudo certbot --nginx \
  -d tosuthien.net -d www.tosuthien.net \
  -d app.tosuthien.net \
  -d api.tosuthien.net -d admin.tosuthien.net
```

If apex/www already have certs, expand:

```bash
sudo certbot --nginx --expand \
  -d tosuthien.net -d www.tosuthien.net \
  -d app.tosuthien.net \
  -d api.tosuthien.net -d admin.tosuthien.net
```

Demo:

```bash
sudo certbot --nginx -d demo.tosuthien.net
```

Khi lên `tosuthien.com`: sửa `NEXT_PUBLIC_SITE_URL`, build lại site, thêm `server_name` + `certbot --expand`.

## `.env` on VPS

```env
PUBLIC_BASE_URL=https://api.tosuthien.net
```

```bash
docker compose up -d --force-recreate api
```

## Upload limit (MP3 / PDF)

Max **1 GiB per file** — configured in:

| Layer | Setting |
|-------|---------|
| Host nginx (`api`, `admin`) | `client_max_body_size 1G` |
| Admin container (`vuejs/nginx.conf`) | `client_max_body_size 1G` |
| NestJS multer | `limits.fileSize = 1 GiB` |
| Vue admin axios | `timeout: 600_000` (10 min) |

After `git pull`, rebuild admin if `vuejs/nginx.conf` changed:

```bash
docker compose up -d --build admin api
./deploy/nginx/install-on-vps.sh
```

## Verify

```bash
curl https://api.tosuthien.net/api/health
curl -I https://admin.tosuthien.net
curl -I https://app.tosuthien.net
curl -I https://tosuthien.net
curl -I https://demo.tosuthien.net
```

## Portal (Vue 3) → /opt/tosu-thien/portal-dist

**Only deploy `portal/dist/` into `portal-dist/`.**  
Do **not** use git-tracked `portal/` as the nginx root — `git pull` on the VPS restores Vite source (`/src/main.ts`) and the site breaks with 404 / `video/mp2t`.

```bash
./deploy/scripts/deploy-portal.sh
# or on VPS:
./deploy/scripts/deploy-portal-on-vps.sh
```

After nginx config changes, reload on VPS (`nginx -t && systemctl reload nginx`).
