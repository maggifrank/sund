#!/bin/bash
# Install or refresh Sund's auto-updater. Run by hand, as root, from the
# checkout — and read it first: this is the one point where something from the
# repo runs as root, which is why nothing runs it automatically.
#
#   /opt/sund/deploy/install-updater.sh
#
# Safe to re-run. It:
#   1. creates the sund-build system user and hands it the checkout,
#   2. copies sund-update.sh to /usr/local/sbin/sund-update (root, 755),
#   3. installs sund-update.service and .timer and enables the timer.
set -euo pipefail

REPO="${SUND_REPO:-/opt/sund}"
BUILD_USER=sund-build
BUILD_HOME=/var/lib/sund-build

[ "$(id -u)" = 0 ] || { echo "run this as root" >&2; exit 1; }
[ -d "$REPO/.git" ] || { echo "$REPO is not a git checkout" >&2; exit 1; }
SRC=$(cd "$(dirname "$0")" && pwd)

# 1. A build user that owns the checkout. Not the app's user: the app should
# not be able to rewrite its own code, and the build user should not be able to
# read the app's state or secrets.
if ! id -u "$BUILD_USER" >/dev/null 2>&1; then
  useradd --system --home-dir "$BUILD_HOME" --no-create-home \
    --shell /usr/sbin/nologin "$BUILD_USER"
fi
install -d -m 750 -o "$BUILD_USER" -g "$BUILD_USER" "$BUILD_HOME"
chown -R -h "$BUILD_USER:$BUILD_USER" "$REPO"
# World-readable, so sund.service and sund-publish.service can still run it.
chmod 755 "$REPO"

# 2. The updater, out of the repo's control. Staged and renamed so a running
# timer never sees a half-copied script.
install -m 755 -o root -g root "$SRC/sund-update.sh" /usr/local/sbin/sund-update.new
mv -f /usr/local/sbin/sund-update.new /usr/local/sbin/sund-update

# 3. The units.
install -m 644 -o root -g root "$SRC/sund-update.service" "$SRC/sund-update.timer" \
  /etc/systemd/system/
systemctl daemon-reload
systemctl enable --now sund-update.timer

# The old updater kept its failed-revision mark in the checkout; it now lives
# in /var/lib/sund-update, so the old one is just clutter.
rm -f "$REPO/.git/sund-last-failed-rev"

echo "installed /usr/local/sbin/sund-update; $REPO is owned by $BUILD_USER"
echo "check it with: systemctl start sund-update && journalctl -u sund-update -n 20 --no-pager"
