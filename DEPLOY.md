# Deploying Sund to an LXC container

Sund needs Node 18+ and nothing else — no `npm install`, no database, no reverse
proxy. A 512 MB container is generous.

Everything below is identical across LXC flavours once you have a shell in the
container; only steps 1 and 2 differ between Proxmox and LXD/Incus.

## 1. Create a container

Debian 12 or newer — its `nodejs` package is Node 18, which is what the code
needs. Debian 11 ships Node 12 and won't run this.

Proxmox:

```
pct create 110 local:vztmpl/debian-12-standard_12.7-1_amd64.tar.zst \
  --hostname sund --cores 1 --memory 512 --rootfs local-lvm:4 \
  --net0 name=eth0,bridge=vmbr0,ip=dhcp --unprivileged 1 \
  --features nesting=1 --start 1
```

LXD / Incus:

```
lxc launch images:debian/12 sund
```

## 2. Get a shell inside

```
pct enter 110          # Proxmox
lxc exec sund -- bash  # LXD / Incus
```

Everything from here runs **inside the container**.

## 3. Install Node and git

```
apt-get update && apt-get install -y nodejs git
```

Confirm the version and the binary path:

```
node --version && command -v node
```

If `node` is not at `/usr/bin/node`, change `ExecStart=` in the unit file in
step 5 to match.

## 4. Clone

```
git clone https://github.com/maggifrank/sund.git /opt/sund
```

The repo is public, so no keys or tokens are needed.

## 5. Install and start the service

```
cp /opt/sund/deploy/sund.service /etc/systemd/system/
systemctl daemon-reload
systemctl enable --now sund
systemctl status sund --no-pager
```

The unit runs as a `DynamicUser` with `ProtectSystem=strict`, so `/opt/sund`
stays read-only and the count is written to `/var/lib/sund/state.json` via
`StateDirectory`.

## 6. Check it

```
hostname -I
curl -s http://localhost:8080/api/state
```

The API should return `{"trips":[],"settings":{...},"rev":0}`.

Then open `http://<container-ip>:8080` on a laptop and a phone. Both should show
the same count, and a swim logged on one appears on the other within 15 seconds —
immediately if you switch to the app rather than leaving it in the background.

If `curl` works inside the container but nothing else on the LAN can reach it,
the problem is the host firewall, not Sund.

## 7. Access code (optional on a trusted LAN)

Uncomment and set `SUND_TOKEN` in `/etc/systemd/system/sund.service`:

```
systemctl daemon-reload && systemctl restart sund
```

Each device prompts for the code once and remembers it. Without it, anyone who
can reach the port can change the count — fine on a home LAN, not fine on a
public address.

**If the publish timer is installed, give it the code too**, or it will start
getting 401s and the public site will quietly stop updating with no visible
error on the page:

```
printf 'SUND_TOKEN=the-same-code\n' >> /etc/sund-publish.env
```

## 8. A hostname in front (optional)

Everything above leaves you with `http://<container-ip>:8080`, which is all
`serve.js` ever offers: plain HTTP on one port, no TLS, no name. A reverse proxy
in front is what turns that into an address worth typing.

Here that proxy is **Caddy**, on its own host, and the name is the same one the
published site answers to:

```
sund.talva.is  →  caddy.talva.is  →  <container-ip>:8080
```

The site block is nearly the whole of it — Caddy terminates TLS and passes the
request on unchanged, because Sund has no notion of being behind anything:

```
sund.talva.is {
	tls {
		dns cloudflare {env.CLOUDFLARE_API_TOKEN}
	}
	reverse_proxy <container-ip>:8080
}
```

The `tls` block is the wrinkle, and it is the one worth reading before you debug
it at midnight rather than after. A name that resolves only on the inside cannot
answer an HTTP challenge from the outside, so the certificate comes from a **DNS
challenge** instead: Caddy proves it controls the zone rather than the address,
which works regardless of where the name points.

That needs two things a default install does not give you:

- **A Caddy build carrying the Cloudflare DNS plugin.** The distribution package
  does not include it, and the failure is not obvious — the config is accepted
  and the renewal fails later. Build one with
  `xcaddy build --with github.com/caddy-dns/cloudflare`, or take it from Caddy's
  download page with that plugin ticked.
- **A Cloudflare API token with `Zone:DNS:Edit`** on the zone. It reaches Caddy
  through the environment, not the Caddyfile — `{env.CLOUDFLARE_API_TOKEN}`
  above is read at load time, so the file itself stays free of secrets and safe
  to copy around. Wire it up however the Caddy unit takes its environment; an
  `EnvironmentFile=` on the service, root-owned and `chmod 600`, is the same
  shape `/etc/sund-publish.env` uses for the Netlify token below.

### The split is in the name, not the path

The same hostname is the read-only site from anywhere else, and nothing about
the request distinguishes them — no port, no path, no prefix. **Split-horizon
DNS is the entire mechanism:**

```
internal resolver   sund.talva.is → caddy.talva.is → a private address → the container
public resolvers    sund.talva.is → the CDN → Netlify's static snapshot
```

Which means the public answer must never point at the container. That is the
property the whole arrangement rests on, so check it rather than assume it:

```
dig +short sund.talva.is
dig +short @1.1.1.1 sund.talva.is
```

The first should be a private address, the second should not be. If the public
one ever resolves to the container, the access code from step 7 becomes the only
thing standing between the internet and the count — and if you never set one,
there is nothing standing there at all.

## Updating

Manually:

```
cd /opt/sund && git pull && systemctl restart sund
```

**Code changes deploy themselves; unit files do not.** The updater pulls the
repo and restarts the service, but never touches `/etc/systemd/system`. After a
commit that changes anything under `deploy/`, copy it across by hand:

```
cp /opt/sund/deploy/<changed-unit> /etc/systemd/system/ && systemctl daemon-reload
```

### Automatically

`sund-update.timer` checks GitHub every 5 minutes and deploys anything new.
Install it once:

```
cp /opt/sund/deploy/sund-update.service /opt/sund/deploy/sund-update.timer /etc/systemd/system/
systemctl daemon-reload
systemctl enable --now sund-update.timer
```

From then on, pushing to `main` from your laptop puts the change on the
container within five minutes. The container polls GitHub rather than GitHub
pushing to it, so nothing needs to be exposed to the internet.

It only acts when the revision actually changed, so an unchanged check writes
nothing to the journal. After restarting it fetches `/` until the app answers,
up to 15 seconds. If it never does, the update is **rolled back** to the
previous revision and that revision is recorded as failed, so a bad push
restarts the service once rather than every five minutes forever — push a fix
and the next run picks it up and clears the mark.

A successful update also writes to `publish-trigger`, the file the publisher
watches, so a code change that alters what the **public** page renders reaches
it in seconds rather than waiting on the six-hourly safety net. New coordinates
in `lib/pools.js` are the case that showed this up: the public map went on
drawing the old survey until somebody happened to log a swim. If the publisher
is not installed, the write goes to a file nothing is watching and costs
nothing; the run itself is a no-op when the built site is genuinely unchanged.

If you have edited files directly in `/opt/sund`, the update refuses to
fast-forward and leaves both your changes and the running service alone. Commit
or discard them and it resumes.

Check on it:

```
systemctl list-timers sund-update.timer
```

```
journalctl -u sund-update -n 50 --no-pager
```

To pause automatic deploys: `systemctl disable --now sund-update.timer`.

## Publishing the public read-only site

The container can publish its own snapshot to Netlify on a timer. It reaches
*out* to Netlify, exactly like the GitHub poller — nothing new is exposed
inbound, and the LAN-only rule is unchanged.

First create a Netlify **personal access token** at
<https://app.netlify.com/user/applications#personal-access-tokens>. Then, on the
container, create the environment file with restrictive permissions *before*
putting the token in it, so it is never briefly world-readable and never lands
in your shell history:

```
install -m 600 /dev/null /etc/sund-publish.env
```

```
nano /etc/sund-publish.env
```

with a single line:

```
NETLIFY_AUTH_TOKEN=nfp_your_token_here
```

Then install the watcher and its safety-net timer:

```
cp /opt/sund/deploy/sund-publish.service /opt/sund/deploy/sund-publish.path /opt/sund/deploy/sund-publish.timer /etc/systemd/system/
systemctl daemon-reload
systemctl enable --now sund-publish.path sund-publish.timer
```

`sund-publish.path` does the real work: `serve.js` touches
`publish-trigger` in its state directory after every change, and the path unit
republishes within seconds. The timer is only a backstop for a trigger missed
while the publisher was down, and for the daily ECB rate when nobody has been
swimming — four no-op runs a day.

Check the watcher is armed:

```
systemctl status sund-publish.path --no-pager
```

`Active: active (waiting)` is what you want. Log a swim and
`journalctl -u sund-publish -n 5 --no-pager` should show a deploy within
seconds. If it never fires, the path unit is not seeing the file — the six-hour
timer still keeps the page current meanwhile, so nothing is broken while you
look into it.

Publish immediately rather than waiting for the first tick:

```
systemctl start sund-publish.service && journalctl -u sund-publish -n 5 --no-pager
```

A successful run logs `deployed <id> to https://... — no functions, verified`.
A run with no new trips logs `no change since rev N — nothing to publish` and
does not deploy at all. Publishing is event-driven, so this only happens on the
six-hourly safety net or a duplicate trigger.

The marker it compares is a fingerprint of the **built site**, not the revision
— despite what that message says — so a code change counts as a change and
deploys on its own; there is usually nothing to force. Clear the marker only
when the published snapshot is wrong for a reason the build cannot see, such as
a deploy that half-landed:

```
rm -f /var/lib/sund-publish/last.json && systemctl start sund-publish.service
```

The site id is set in the unit; only the token lives in the environment file.
Revoke it from the same Netlify page if the container is ever compromised —
it grants deploy access to your Netlify account, nothing on the container.

## Backups

The count lives in `/var/lib/sund/state.json`, **not** in `/opt/sund`. That
one file is the only thing not reproducible from git — everything else can be
thrown away and re-cloned.

A PVE container backup covers it along with everything else, and needs no
app-specific setup. `serve.js` writes the file via a temp file and `rename()`,
which is atomic on Linux, so a snapshot taken mid-write gets either the complete
old file or the complete new one — never a half-written one.

For a file-level copy, note that `/var/lib/sund` is a **symlink** into
`/var/lib/private/sund` because the unit uses `DynamicUser=true`. Reading
through the symlink is fine; restoring by replacing the symlink is not — see the
`STATE_DIRECTORY` entry under Troubleshooting.

## Bringing existing trips with you

If you have been counting on another machine, copy its state across once the
service is running:

```
curl -s http://<old-host>:8080/api/state | ssh root@<container-ip> \
  'systemctl stop sund && cat > /var/lib/sund/state.json &&
   chown --reference=/var/lib/private/sund /var/lib/private/sund/state.json &&
   systemctl start sund'
```

The `chown` is not optional. Written as root, the file lands owned by root while
the service runs as a dynamic user, so the count reads back correctly and then
every new trip fails to save — a failure that looks like nothing is wrong until
you tap **+**.

Or use **Export data** in the app's settings on the old machine and write that
file to the same path, with the same `chown` afterwards.

## Troubleshooting

**Service won't start, `DynamicUser` or `ProtectSystem` errors.** Older systemd
in an unprivileged container may not support the hardening options. Comment out
`DynamicUser=true`, `ProtectSystem=strict` and `ProtectHome=true`, add
`User=root`, then `systemctl daemon-reload && systemctl restart sund`. You lose
some isolation but it will run.

**`SyntaxError: Unexpected token` or `Cannot use import statement`.** Node is
too old — check `node --version` is 18 or newer.

**Count resets to zero after a restart.** The state file isn't writable. Check
`journalctl -u sund` for `write failed:` and confirm `/var/lib/sund` exists and
is owned by the service user.

**`status=238/STATE_DIRECTORY`, journal says `Failed to set up special
execution directory in /var/lib: File exists`.** Something is sitting where
systemd wants to manage its own state directory. Because the unit uses
`DynamicUser=true`, the real directory is `/var/lib/private/sund` and
`/var/lib/sund` is only a **symlink** to it — so moving or restoring
`/var/lib/sund` by hand leaves a stale entry systemd refuses to touch.

Fix it in `/var/lib/private`, not `/var/lib`:

```
systemctl stop sund
rm -f /var/lib/sund                 # a symlink, not your data
mv /var/lib/private/<old> /var/lib/private/sund
chown --reference=/var/lib/private/sund /var/lib/private/sund/state.json
systemctl start sund
```

Check the destination does not already exist before that `mv` — if it does, `mv`
puts the source *inside* it and the app starts on an empty state. The startup
log tells you which happened: `State file: ... (will be created)` means it is
not finding the file. The dynamic user's UID changes with the service name, so
the `chown` matters — without it the count reads correctly but new trips fail
to save.

**Logs:**

```
journalctl -u sund -f
```
