# Watchdog

[Русский](README.md) · **English**

Measures once a minute, speaks once per incident.

## Why it exists

The stand spent a week falling over and coming back, and the way anyone found
out was by opening it and looking. Health checks on the services existed before
the watchdog — but only `docker` sees them, only on that same machine, and only
if somebody asks. Nobody asked.

The second thing missing was an answer to **why**. It was obvious the stand was
down; there was nothing to say what had run out. So the watchdog does not only
raise alarms, it **keeps a record**: every check goes to the log as one line
with memory, disk and the state of each service.

```
2026-08-24T03:39:12Z память 14% диск 21% | все отвечают
2026-08-24T03:40:12Z память 6% диск 21% | все отвечают
2026-08-24T03:40:12Z ТРЕВОГА: память — доступно 6% при пороге 10%
2026-08-24T03:41:12Z память 4% диск 21% | НЕ ОТВЕЧАЮТ: portal site
```

Four lines answer a question that used to be answered by guessing. (The log
speaks Russian — it is read by the team, and the team is Russian-speaking.)

## What it cannot do

**The watchdog lives on the machine it watches.** If memory runs out, the
system kills it too. If the machine goes down, the silence is total and
indistinguishable from the silence of everything being fine.

Hence the rule: **silence from the watchdog is not proof that anything works.**
Noticing the death of the machine itself takes an observer on the outside — an
external probe that pulls the public address and complains when it goes quiet.
That does not fit inside this container by definition.

The second thing it does not see: **the outbox lag** — the very signal
`docs/PROJECT.en.md` calls the main one. The relay stopped: the application is
green, forms are accepted, the visitor sees "thank you", and leads pile up and
go nowhere. The metric is computed and, past five minutes, written to the
portal's log, but actuator exposes only `health` outward and without details —
the door that would show it does not exist. Simply adding an indicator will not
do: landing in the overall health, it would fail the container's health check,
and docker would start restarting the portal because leads are piling up. It
needs a separate health group, and that is backend work.

## Why not Prometheus and Grafana

They give graphs, history in a database and alerting rules, and on a fleet of
machines that pays for itself. Here there is one machine, and it is already
short on memory — short enough that memory is suspect number one in the
crashes. Putting another gigabyte of observer next to it is curing hunger with
another eater.

The watchdog takes a few megabytes, and its history is the same `docker` log
lines that are already written with 20 MB rotation. At one line per minute that
is roughly four months.

Same reason there is no Kubernetes in this project: the tool is justified by a
scale we do not have.

## What is checked

| Name | What it means |
| --- | --- |
| `память` | less than `MEM_FREE_MIN` percent available |
| `диск` | less than `DISK_FREE_MIN` percent free |
| `portal` | the application's `/actuator/health` |
| `gateway` | the gateway's `/actuator/health` |
| `site` | the site's home page |
| `keycloak` | `/health/ready` on management port 9000 |
| `connect` | Kafka Connect **and the state of its connectors** |

The addresses are internal, by service name: the watchdog checks that a service
works, not that it can be reached from outside. An outside check would also
cover DNS, TLS and the proxy — useful, but a different question, and "something
broke" is a worse answer to it than "this broke".

The `connect` check is double, and not out of caution. A dead Debezium
connector does not make Kafka Connect unhealthy: the service answers `200` and
reports the failure **in the response body**. A connector that stopped quietly
means the PostgreSQL write-ahead log stops being cleaned up, which means a disk
slowly filling — exactly what the second line catches.

## When mail arrives

Not on every failed check, but on a **change of state**.

- One or two failures in a row — a log line only. A container restart, a
  network hiccup and a deploy all look exactly like this, and mail for each of
  them teaches the reader not to open mail.
- `FAILS_TO_ALARM` failures in a row (three by default) — an alarm, one letter.
- While it stays broken — silence, except a reminder every `REMIND_HOURS`.
- Once it works again — one letter about the recovery.

If mail is not configured — `SPRING_MAIL_HOST` or `VEDAL_WATCH_MAIL_TO` empty —
the watchdog prints `ПОЧТА НЕ НАСТРОЕНА` at start, repeats it hourly, and says
the same in place of every letter it could not send. Setting up mail is
[SCRUM-27](https://egorkabercuk.atlassian.net/browse/SCRUM-27).

## How to read it

```bash
docker compose logs watchdog --tail 200
```

Alarms and recoveries only:

```bash
docker compose logs watchdog | grep -E "ТРЕВОГА|ВОССТАНОВИЛОСЬ|ВСЁ ЕЩЁ"
```

## Settings

| Variable | Default | What it does |
| --- | --- | --- |
| `VEDAL_WATCH_EVERY` | `60` | seconds between checks |
| `VEDAL_WATCH_FAILS` | `3` | failures in a row before an alarm |
| `VEDAL_WATCH_REMIND_HOURS` | `6` | how often to remind while still broken |
| `VEDAL_WATCH_MEM_MIN` | `10` | available memory threshold, percent |
| `VEDAL_WATCH_DISK_MIN` | `10` | free disk threshold, percent |
| `VEDAL_WATCH_MAIL_TO` | empty | where alarms go |

The watchdog has no mail variables of its own. It takes the portal's:
`SPRING_MAIL_HOST`, `SPRING_MAIL_USERNAME`, `SPRING_MAIL_PASSWORD` from
`backend/.env`. There is one mailbox, and giving it a second name would create
a second source of truth — one that drifts apart from the first, and gets found
out on the day an alarm fails to arrive.

The **recipient**, though, is its own, and that is not a detail: leads are read
by sales, alarms are read by whoever fixes things.

## Where it runs

Locally — on request, via the `watch` profile:

```bash
docker compose --profile watch up -d watchdog
```

In a deployed environment — always: `compose.prod.yaml` moves it into the `app`
profile. An environment with nobody watching is precisely the case it was
written for.
