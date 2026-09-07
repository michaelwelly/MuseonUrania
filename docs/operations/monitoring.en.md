# Health checks

[Русский](monitoring.md) · **English**

## What is checked

`scripts/healthcheck.sh`, run by `vedal-health.timer` every five minutes:

- the portal answers `UP` on `/actuator/health`;
- the home page returns 200;
- our own containers (`vedal-*`) are running and healthy;
- the disk is under 85% full;
- the mail queue has nothing stuck in manual review and no backlog piling up.

## Why from inside the machine

From outside, the portal's answer is mixed with the state of the network path.
On 7 September 2026 the same address answered and failed to answer a minute
apart, while the stack was healthy and served pages over `127.0.0.1:18080` in
six milliseconds. A check running from outside would wake people at night
because of someone else's router.

The trade-off: this check will not see the stand being unreachable for a
visitor. An external monitor will, and it arrives together with the domain —
over a domain and 443 the path behaves differently.

## Alerting

An alert is raised **on a state change**, not on every tick: otherwise alerts
turn into background noise that people stop reading. The state lives in
`/var/lib/vedal/health.state`.

The journal always gets it: `journalctl -u vedal-health`. Outside delivery
happens if `VEDAL_ALERT_WEBHOOK` is set in `backend/.env` — an address that
accepts `POST {"text": "..."}`. A Telegram bot, a messenger webhook, or
anything that takes JSON will do.

## Installing

```bash
sudo cp /opt/vedal-portal/scripts/vedal-health.service /etc/systemd/system/
sudo cp /opt/vedal-portal/scripts/vedal-health.timer /etc/systemd/system/
sudo mkdir -p /var/lib/vedal && sudo chown ubuntu:ubuntu /var/lib/vedal
sudo systemctl daemon-reload
sudo systemctl enable --now vedal-health.timer
```

To check immediately: `sudo systemctl start vedal-health.service`.

## Settings

| Variable | Default | What it does |
| --- | --- | --- |
| `VEDAL_HEALTH_URL` | `http://127.0.0.1:18080` | gateway address from inside the machine |
| `VEDAL_HEALTH_DISK_PERCENT` | `85` | disk usage that triggers an alert |
| `VEDAL_HEALTH_QUEUE` | `50` | queued mail count considered a backlog |
| `VEDAL_ALERT_WEBHOOK` | empty | where to send alerts outside |
