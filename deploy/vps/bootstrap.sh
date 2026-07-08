#!/usr/bin/env bash
# Bootstrap VPS: Docker stack + host nginx (HTTP). Run SSL (certbot) after DNS works.
set -euo pipefail

REPO="${REPO_DIR:-/opt/tosu-thien}"
cd "$REPO"

echo "==> git pull"
git pull origin main

echo "==> Docker: db + api + admin"
docker compose up -d --build

echo "==> Wait for API health"
for i in $(seq 1 30); do
  if curl -sf http://127.0.0.1:8000/api/health >/dev/null; then
    echo "API OK"
    break
  fi
  sleep 2
  if [[ "$i" -eq 30 ]]; then
    echo "API health check failed — run: docker compose logs api"
    exit 1
  fi
done

echo "==> Embed server (systemd)"
if ! systemctl is-active --quiet tosu-embed 2>/dev/null; then
  if [[ -f deploy/vps/tosu-embed.service ]]; then
    sudo cp deploy/vps/tosu-embed.service /etc/systemd/system/
    sudo systemctl daemon-reload
    sudo systemctl enable --now tosu-embed
  else
    echo "Skip embed systemd — start manually: python3 scripts/embed_server.py"
  fi
fi
curl -sf http://127.0.0.1:7997/health && echo "Embed OK" || echo "WARN: embed not on :7997"

echo "==> Nginx"
sudo apt-get update -qq
sudo apt-get install -y nginx
chmod +x deploy/nginx/install-on-vps.sh
./deploy/nginx/install-on-vps.sh

echo "==> Flutter web (placeholder from repo)"
sudo mkdir -p www
if [[ -f www/index.html ]]; then
  sudo chown -R www-data:www-data www
  sudo chmod -R 755 www
fi

echo ""
echo "============================================"
echo "HTTP ready. Test (from VPS or your Mac):"
echo "  curl http://api.tosuthien.net/api/health"
echo "  curl -I http://admin.tosuthien.net"
echo "  curl -I http://tosuthien.net"
echo ""
echo "HTTPS (after DNS propagated):"
echo "  sudo certbot --nginx -d tosuthien.net -d www.tosuthien.net -d api.tosuthien.net -d admin.tosuthien.net"
echo ""
echo "Then .env:"
echo "  PUBLIC_BASE_URL=https://api.tosuthien.net"
echo "  docker compose up -d --force-recreate api"
echo "============================================"
docker compose ps
