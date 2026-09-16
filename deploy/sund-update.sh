#!/bin/bash
# Pull the latest Sund and restart it, but only if something actually changed
# and only if the new code comes up healthy. Run by sund-update.timer.
#
# Env: SUND_REPO (default /opt/sund), SUND_URL (default http://127.0.0.1:8080)
set -euo pipefail

REPO="${SUND_REPO:-/opt/sund}"
URL="${SUND_URL:-http://127.0.0.1:8080}"
# Remembers a revision that already failed here, so a bad push doesn't get
# retried — and the service restarted — every time the timer fires. Lives in
# .git/ because that is untracked, persistent and root-writable.
FAILED_MARK="$REPO/.git/sund-last-failed-rev"

cd "$REPO"

git fetch --quiet origin

local_rev=$(git rev-parse HEAD)
remote_rev=$(git rev-parse '@{u}')

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
if ! git merge --ff-only "$remote_rev" >/dev/null 2>&1; then
  echo "cannot fast-forward $REPO onto ${remote_rev:0:7} — local commits or edits are in the way" >&2
  exit 1
fi

echo "updating ${local_rev:0:7} -> ${remote_rev:0:7}"
systemctl restart sund

# Give it a moment to bind the port, then check it actually serves. Requests the
# static index rather than the API, which may be behind SUND_TOKEN.
healthy=false
for _ in $(seq 15); do
  if curl -fsS -o /dev/null --max-time 2 "$URL/"; then healthy=true; break; fi
  sleep 1
done

if [ "$healthy" = true ]; then
  rm -f "$FAILED_MARK"

  # New code can change what the public snapshot renders — a pool that has just
  # been given a position, say — but nothing tells the publisher that. Its path
  # unit watches for swims, and its timer is a six-hourly safety net, so the
  # public page can sit on a stale build for hours because nobody happened to go
  # swimming. Nudge the same trigger the app uses. A redundant run costs nothing:
  # the publisher fingerprints the built site and stops if it is unchanged.
  #
  # Written rather than touched. `touch` on an existing file is a utimensat, and
  # systemd's PathModified wants a write it can see closed — the same reason
  # serve.js writes this file in place instead of renaming onto it. Truncating
  # keeps the inode and the app's ownership of it, so the file this runs as root
  # over is still the file the service can write next time.
  #
  # Only where it already exists: creating it here would leave a root-owned file
  # that serve.js, under DynamicUser, could never write again — and it fails at
  # that silently. Both paths because the state directory is /var/lib/private/sund
  # with a symlink at /var/lib/sund under DynamicUser, and a plain directory
  # without it; duplicate triggers are harmless.
  for trigger in /var/lib/sund/publish-trigger /var/lib/private/sund/publish-trigger; do
    if [ -f "$trigger" ]; then
      printf 'deployed %s\n' "${remote_rev:0:7}" > "$trigger"
    fi
  done

  echo "updated to ${remote_rev:0:7} and healthy"
  exit 0
fi

echo "new revision ${remote_rev:0:7} failed its health check — rolling back to ${local_rev:0:7}" >&2
echo "$remote_rev" > "$FAILED_MARK"
git reset --hard "$local_rev" >/dev/null
systemctl restart sund
exit 1
