# Nginx — tosuthien.net (4 domains)

| File | Domain | Upstream |
|------|--------|----------|
| `api.tosuthien.net.conf` | `api.tosuthien.net` | `127.0.0.1:8000` (Docker `api`) |
| `admin.tosuthien.net.conf` | `admin.tosuthien.net` | `127.0.0.1:5173` (Docker `admin`) |
| `app.tosuthien.net.conf` | `app.tosuthien.net` | `/opt/tosu-thien/www` (Flutter `build/web`) |
| `tosuthien.net.conf` | `tosuthien.net`, `www` | `/opt/tosu-thien/portal` (Vue 3 landing) |

DNS (A → VPS IP `168.144.120.72`): `@`, `www`, `app`, `api`, `admin`.

| URL | Nội dung |
|-----|----------|
| **https://tosuthien.net** | Cổng chính (Vue 3) |
| **https://app.tosuthien.net** | Ứng dụng Flutter web |

## Quick install on VPS

```bash
cd /opt/tosu-thien
git pull origin main

sudo apt install -y nginx certbot python3-certbot-nginx
chmod +x deploy/nginx/install-on-vps.sh
./deploy/nginx/install-on-vps.sh
```

## Flutter web → www

On dev machine:

```bash
cd flutter
flutter build web --dart-define=API_BASE_URL=https://api.tosuthien.net --release
rsync -avz build/web/ user@168.144.120.72:/opt/tosu-thien/www/
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
curl -I https://app.tosuthien.net   # Flutter web
curl -I https://tosuthien.net       # Vue 3 portal
```

## Portal (Vue 3) → /opt/tosu-thien/portal

**Only deploy `portal/dist/`.** Never rsync the Vite source tree into the web root.
If `/src/main.ts` is served, nginx’s default MIME is `video/mp2t` and the browser shows:

> Failed to load module script … MIME type of "video/mp2t"

```bash
./deploy/scripts/deploy-portal.sh
# or manually:
cd portal && npm ci && npm run build
rsync -avz --delete dist/ tosuthien-vps:/tmp/portal-dist/
ssh tosuthien-vps 'sudo rsync -a --delete /tmp/portal-dist/ /opt/tosu-thien/portal/'
```

After nginx config changes, reload on VPS (`nginx -t && systemctl reload nginx`).
