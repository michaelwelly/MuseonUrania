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
| `scripts/vedal-autodeploy.service` | `/etc/systemd/system/vedal-autodeploy.service` |
| `scripts/vedal-autodeploy.timer` | `/etc/systemd/system/vedal-autodeploy.timer` |

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
- `деплой упал с кодом N — отметка не обновлена, повторю в следующий раз`.

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

- [VM deploy plan](../../outputs/server/vedal_vm_deploy_plan_2026-08-18.md) —
  host map, placement, SSH.
- [vedal-med.ru domain cutover](domain_cutover_vedal_med_ru.en.md).
