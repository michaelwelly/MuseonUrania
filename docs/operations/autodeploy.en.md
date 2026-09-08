# Stand autodeploy from main

[Русский](autodeploy.md) · **English**

## What this is

The machine checks whether `main` has moved and redeploys the stand when it
has. The trigger is the same as a normal CI deploy — a push to `main` — but the
direction is reversed: GitHub does not reach the server, the server asks GitHub.

## Why not deploy from GitHub Actions

The usual path is a workflow on a GitHub runner that SSHes into the server. It
does not fit here for two reasons, and either one alone would be enough.

**The repository is public.** GitHub explicitly advises against self-hosted
runners on public repositories: a workflow from a fork executes on the machine,
and a pull request from anyone at all turns into someone else's code running —
on the same machine that hosts the live `c3ag.ru`.

**The runner address range is huge and keeps changing.** Deploying from GitHub
runners means opening SSH to that whole pool. For a machine hosting a third
party's production site that is a disproportionate price for convenience.

Reversing the direction removes both problems at once:

- no additional port is exposed;
- no secret and no server key is stored in GitHub;
- no foreign code runs on the machine — the script compares two hashes and
  calls the existing `deploy-stand-prod.sh`.

The cost: a change reaches the stand within two minutes rather than instantly,
and the deploy log lives on the machine rather than in a GitHub tab.

## What gets installed

| File in the repository | Destination on the machine |
| --- | --- |
| `scripts/autodeploy.sh` | `/opt/vedal-portal/scripts/autodeploy.sh` |
| `scripts/deploy-stand-prod.sh` | `/opt/vedal-portal/scripts/deploy-stand-prod.sh` |
| `scripts/vedal-autodeploy.service` | `/etc/systemd/system/vedal-autodeploy.service` |
| `scripts/vedal-autodeploy.timer` | `/etc/systemd/system/vedal-autodeploy.timer` |

The deploy itself — `deploy-stand-prod.sh` — lived only on the machine until
September 2026, as an untracked file. The very part of the system that took the
site down for minutes on every deploy could not be read, reviewed or rolled
back: finding out what it did meant an SSH session. It is in the repository now,
and `/opt/vedal-portal` is the same working tree the deploy runs
`git reset --hard` in. So it needs no separate installation: the machine picks
the new script up together with the code.

One subtlety follows from that, and it is why the script re-executes itself from
a copy in a temporary directory: `git reset --hard` rewrites the very file being
executed. bash reads a script by offset, and replacing it mid-run means running
the middle of the new file from the middle of the old one. The script copies
itself into `/tmp` first and works from there, so rewriting is safe.

## Installation

Once, as a user with `sudo`:

```bash
cd /opt/vedal-portal
git fetch origin main && git checkout main && git pull

sudo install -m 755 scripts/autodeploy.sh /opt/vedal-portal/scripts/autodeploy.sh
sudo install -m 644 scripts/vedal-autodeploy.service /etc/systemd/system/
sudo install -m 644 scripts/vedal-autodeploy.timer   /etc/systemd/system/

sudo mkdir -p /var/lib/vedal-autodeploy
sudo chown ubuntu:ubuntu /var/lib/vedal-autodeploy

sudo systemctl daemon-reload
sudo systemctl enable --now vedal-autodeploy.timer
```

## Verification

```bash
# the timer is on, and when it fires next
systemctl list-timers vedal-autodeploy.timer

# run it right now without waiting for the timer
sudo systemctl start vedal-autodeploy.service

# what happened
journalctl -u vedal-autodeploy -n 50 --no-pager
```

Each run leaves exactly one of these lines:

- `main не менялся (abc12345) — деплой не нужен`;
- `новый main: abc12345 → def67890, разворачиваю` followed by `готово`;
- `предыдущий деплой ещё идёт — пропускаю`;
- `выкатка заморожена с <when> (<reason>) — пропускаю`;
- `деплой упал с кодом N — отметка не обновлена, повторю в следующий раз`.

## Freezing deploys during a demo

```bash
echo "customer demo" > /opt/vedal-portal/var/deploy-freeze   # before
rm /opt/vedal-portal/var/deploy-freeze                        # after
```

While the file exists the autodeploy deploys nothing and logs since when and
why. The recorded commit is not updated: a freeze postpones a deploy, it does
not cancel it — remove the file and the accumulated `main` arrives on its own.

Why a switch when there is already an agreement not to deploy during a demo.
Because it is not a person who deploys, it is a timer, and the timer knows
nothing about the demo. An agreement that lives only in someone's head does not
hold during a demo: it is enough for somebody in another room to merge their
branch into `main`.

Running `deploy-stand-prod.sh` by hand ignores the freeze, deliberately: the
switch stops the automation, not a person who knows what they are doing.

## How the deploy stopped taking the site down

The domain is served by the neighbour's external nginx; its upstream is
`172.17.0.1:18080`, the port published by the gateway container. While that
container is being recreated nobody holds the port, so the neighbour gets
`connection refused` on every request and returns 502 to the visitor.

The previous version of the deploy did everything in one command:

```bash
docker compose ... up -d --build --remove-orphans
```

and the window was not "while the gateway is recreated" but "while the whole
stack comes up".

The cause is the order in which compose performs the two halves of a
recreation. It removes the old container IMMEDIATELY, at the start of `up`, and
starts the new one in dependency order — that is, the gateway starts only once
the portal is `healthy`, and the portal applies migrations and boots Spring
first. Between those two moments nobody holds port 18080. Minutes, not seconds —
on 8 September the portal owner hit exactly this window and spent half an hour
looking for a breakage that did not exist.

Measured on a model (docker compose v5, two services, the dependent one
publishes a port, the dependency takes ten-odd seconds to become healthy):

| How it is deployed | Window with no answer on the port |
| --- | --- |
| one `up -d` command | 11 s — the whole `up` |
| step by step with `--no-deps`, as now | 1 s — its own recreation only |
| step by step, dependent service unchanged | no window, container untouched |

The same run confirmed that recreating a dependency does not by itself touch the
dependent: while only the portal changes, the gateway stands as it stood.

The order is now spelled out by hand, and every step uses `--no-deps`, that is,
no cascade:

| Step | What it does | Port 18080 |
| --- | --- | --- |
| 1 | builds images | held by the old gateway |
| 2 | brings up infrastructure (`db`, `kafka`, `keycloak`, `connect`) | held by the old gateway |
| 3 | recreates `portal`, waits for `healthy` | held by the old gateway |
| 4 | recreates `site`, waits for `healthy` | held by the old gateway |
| 5 | touches `api-gateway` — and not always | here and only here a window is possible |

Step 5 is the only one that can release the port. `up -d` recreates a container
only when the image or the service configuration changed; a change in
`backend/app` or `frontend/` does not touch the gateway, and compose honestly
does nothing. That is, **on a typical deploy port 18080 is never released**, and
the log says so: `шлюз не менялся — порт 18080 не освобождался`.

The build is a separate step ahead of everything else. It ran first before as
well (`up --build` builds and then recreates), but now a failed build says so in
words: `стек не тронут, работает прежняя версия`.

What this does not fix, honestly:

- when `api-gateway` itself changes, the window remains. One port cannot be
  handed to two containers at once, and a seamless swap needs our own proxy in
  front of the gateway. But the window is one Spring Boot start — tens of
  seconds, not minutes;
- while `site` is being recreated (step 4) the home page is not served. The
  difference is that the gateway answers with its own error rather than the
  connection being refused: the neighbour proxies our response instead of
  synthesizing a 502.

## What is left to the external nginx

A maintenance page instead of an error. While a window exists — short as it is —
a visitor who hits it sees an error, not an "update in progress" page. We cannot
provide that page on our side: the domain is served by the neighbour's nginx and
that is their configuration. The lines to add to the `vedal-med.ru` `server`
block are these:

```nginx
error_page 502 503 504 /maintenance.html;
location = /maintenance.html {
    root /var/www/vedal;
    internal;
}
```

plus the `maintenance.html` file itself. This is for the machine owner to do: we
do not touch someone else's config.

Without that change our part still delivers the main thing — the window went
from minutes to tens of seconds, and on a typical deploy it disappeared
entirely.

## Behaviour under failure

Verified by a dry run before installation, all four cases:

**The deploy failed.** The recorded hash is not updated, so the next run retries.
This is the key property: record the hash before the build and a failed deploy
would count as successful — the stand would stay on the old code while the log
claimed everything was fine.

**GitHub is unreachable.** The script exits with an error and touches nothing;
the stand keeps running whatever is deployed.

**Runs overlapped.** A build takes minutes, the timer fires more often. The
second run sees the lock held and skips its turn — that is a "busy" line in the
log, not a failure.

**The build failed.** No container is touched: the build runs as a separate step
ahead of any recreation. The log says `стек не тронут, работает прежняя версия`.

**A container did not become healthy.** The deploy stops at that step, dumps the
last 60 lines of that container's log and exits with an error. The safety catch
takes over from there: three consecutive failures on the same commit and the
autodeploy stops trying, instead of rebuilding the stand every two minutes.

**`flock` is missing.** Checked separately before anything else, because without
that check `if ! flock -n 9` cannot tell "lock held" from "command absent": the
script would log "previous deploy still running", exit zero, and stop deploying
forever while reporting success every minute.

## What stays manual

Rollback. The script deploys whatever is in `main` and cannot go back. Rolling
back means `git revert` on `main`: two minutes later the stand returns to the
previous state on its own. That way the rollback leaves a trace in history,
which switching branches by hand on the machine does not.

## Related documents

- [vedal-med.ru domain cutover](domain_cutover_vedal_med_ru.en.md).
- The detailed host map, SSH settings and credentials are stored outside the
  public repository in the official project package.
