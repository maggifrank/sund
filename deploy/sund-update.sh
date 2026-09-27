#!/bin/bash
# Pull the latest Sund and restart it, but only if something actually changed
# and only if the new code comes up healthy. Run by sund-update.timer.
#
# This file in the repo is only the source. deploy/install-updater.sh copies it
# to /usr/local/sbin/sund-update, root-owned, and the unit runs that copy — so a
# push can change the app but never the script root runs. Edits here take effect
# only when the installer is re-run by hand. That is deliberate.
#
# Nothing that comes from the repo runs as root. Every git command runs as the
# sund-build user, which owns the checkout; root only restarts services and
# fetches the health check, and checks anything sund-build hands back first.
#
# Env: SUND_REPO (default /opt/sund), SUND_URL (default http://127.0.0.1:8080),
#      STATE_DIRECTORY (set by systemd from StateDirectory=sund-update)
set -euo pipefail

REPO="${SUND_REPO:-/opt/sund}"
URL="${SUND_URL:-http://127.0.0.1:8080}"
BUILD_USER=sund-build
BUILD_HOME=/var/lib/sund-build
STATE="${STATE_DIRECTORY:-/var/lib/sund-update}"

refuse() {
  echo "$1 — re-run deploy/install-updater.sh as root (see DEPLOY.md); not updating" >&2
  exit 1
}

# Fail closed while half-migrated. The old unit ran this file straight out of
# the checkout as root; if that is still what is happening, or the build user
# or its ownership of the checkout is missing, do nothing at all rather than
# deploy through a setup that still hands root to whoever can push.
case "$(readlink -f "$0")" in
  "$(readlink -f "$REPO")"/*) refuse "running from inside $REPO, not the installed copy" ;;
esac
id -u "$BUILD_USER" >/dev/null 2>&1 || refuse "user $BUILD_USER does not exist"
[ "$(stat -c %U "$REPO")" = "$BUILD_USER" ] || refuse "$REPO is not owned by $BUILD_USER"
[ "$(stat -c %U "$REPO/.git")" = "$BUILD_USER" ] || refuse "$REPO/.git is not owned by $BUILD_USER"
[ -d "$STATE" ] && [ "$(stat -c %U "$STATE")" = root ] || refuse "state directory $STATE is missing or not root's"

# The health check is the one request root makes. The URL comes from the unit,
# not the repo, but check its shape anyway before curl sees it.
[[ "$URL" =~ ^https?://[A-Za-z0-9.:-]+(/[A-Za-z0-9._/-]*)?$ ]] || refuse "SUND_URL is not a plain http(s) URL"

as_build() { runuser -u "$BUILD_USER" -- env HOME="$BUILD_HOME" "$@"; }

# Whatever sund-build prints is untrusted by the time root reads it.
rev_of() {
  local rev
  rev=$(as_build git -C "$REPO" rev-parse "$1")
  [[ "$rev" =~ ^[0-9a-f]{40}$ ]] || { echo "unexpected revision from git: ${rev:0:80}" >&2; exit 1; }
  printf '%s\n' "$rev"
}

# Remembers a revision that already failed here, so a bad push doesn't get
# retried — and the service restarted — every time the timer fires. In root's
# own StateDirectory, never in the checkout: a file root writes in a directory
# sund-build controls can be swapped for a symlink to anything on the box.
FAILED_MARK="$STATE/last-failed-rev"

as_build git -C "$REPO" fetch --quiet origin

local_rev=$(rev_of HEAD)
remote_rev=$(rev_of '@{u}')

if [ "$local_rev" = "$remote_rev" ]; then
  exit 0                              # nothing to do; stay quiet in the journal
fi

# Already tried this revision and it wouldn't start. Wait for a new push rather
# than thrashing the service every five minutes; the failure was logged then.
if [ -f "$FAILED_MARK" ] && [ "$(cat "$FAILED_MARK")" = "$remote_rev" ]; then
  exit 0
fi

# --ff-only rather than reset --hard: if someone edited files on the box, stop
# and say so instead of silently throwing their work away.
if ! as_build git -C "$REPO" merge --ff-only "$remote_rev" >/dev/null 2>&1; then
  echo "cannot fast-forward $REPO onto ${remote_rev:0:7} — local commits or edits are in the way" >&2
  exit 1
fi

echo "updating ${local_rev:0:7} -> ${remote_rev:0:7}"
systemctl restart sund

# Give it a moment to bind the port, then check it actually serves. Requests the
# static index rather than the API, which may be behind SUND_TOKEN.
healthy=false
for _ in $(seq 15); do
  if curl -fsS -o /dev/null --max-time 2 --proto =http,https "$URL/"; then healthy=true; break; fi
  sleep 1
done

if [ "$healthy" = true ]; then
  rm -f "$FAILED_MARK"

  # New code can change what the public snapshot renders — a pool that has just
  # been given a position, say — but nothing tells the publisher that. Its path
  # unit watches for swims, and its timer is a six-hourly safety net, so the
  # public page could sit on a stale build for hours. Start the publisher
  # directly, and only if it is installed. A redundant run costs nothing: it
  # fingerprints the built site and stops if it is unchanged.
  #
  # This used to write publish-trigger in the app's state directory instead.
  # That directory belongs to the app user, so root writing into it is the same
  # symlink hazard as the failed-revision mark; systemctl has no such problem.
  if systemctl is-enabled --quiet sund-publish.path 2>/dev/null ||
     systemctl is-enabled --quiet sund-publish.timer 2>/dev/null; then
    systemctl start --no-block sund-publish.service || true
  fi

  echo "updated to ${remote_rev:0:7} and healthy"
  exit 0
fi

echo "new revision ${remote_rev:0:7} failed its health check — rolling back to ${local_rev:0:7}" >&2
printf '%s\n' "$remote_rev" > "$FAILED_MARK"
as_build git -C "$REPO" reset --hard "$local_rev" >/dev/null
systemctl restart sund
exit 1
