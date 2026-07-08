#!/usr/bin/env bash
# Create swap file on SSD (virtual RAM). Safe to re-run — skips if swap already active.
#
# Usage on VPS:
#   chmod +x deploy/vps/setup-swap.sh
#   sudo SWAP_SIZE=10G ./deploy/vps/setup-swap.sh
#
# Defaults: 10G swap (2GB RAM VPS + 50GB SSD). Override: SWAP_SIZE=8G

set -euo pipefail

SWAP_SIZE="${SWAP_SIZE:-10G}"
SWAP_FILE="${SWAP_FILE:-/swapfile}"
SWAPPINESS="${SWAPPINESS:-10}"

if [[ "${EUID:-$(id -u)}" -ne 0 ]]; then
  echo "Run with sudo: sudo SWAP_SIZE=${SWAP_SIZE} $0"
  exit 1
fi

echo "==> Disk free (need ~${SWAP_SIZE} on root):"
df -h /

if swapon --show | grep -q .; then
  echo "==> Swap already enabled:"
  swapon --show
  free -h
  exit 0
fi

if [[ -f "$SWAP_FILE" ]]; then
  echo "==> $SWAP_FILE exists, enabling..."
  chmod 600 "$SWAP_FILE"
  mkswap "$SWAP_FILE" >/dev/null
  swapon "$SWAP_FILE"
else
  echo "==> Creating ${SWAP_SIZE} swap at ${SWAP_FILE}..."
  if ! fallocate -l "$SWAP_SIZE" "$SWAP_FILE" 2>/dev/null; then
    case "$SWAP_SIZE" in
      *G|*g) MB=$((${SWAP_SIZE%[Gg]} * 1024)) ;;
      *M|*m) MB=${SWAP_SIZE%[Mm]} ;;
      *) MB=4096 ;;
    esac
    dd if=/dev/zero of="$SWAP_FILE" bs=1M count="$MB" status=progress
  fi
  chmod 600 "$SWAP_FILE"
  mkswap "$SWAP_FILE"
  swapon "$SWAP_FILE"
fi

FSTAB_LINE="${SWAP_FILE} none swap sw 0 0"
if ! grep -qF "$SWAP_FILE" /etc/fstab; then
  echo "==> Persist in /etc/fstab"
  echo "$FSTAB_LINE" >> /etc/fstab
fi

SYSCTL_FILE=/etc/sysctl.d/99-tosu-swap.conf
cat > "$SYSCTL_FILE" <<EOF
# Prefer RAM on SSD VPS; use swap only when needed (upload / embed spikes)
vm.swappiness=${SWAPPINESS}
EOF
sysctl -p "$SYSCTL_FILE" >/dev/null

echo ""
echo "Done."
free -h
swapon --show
