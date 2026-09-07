# Moving to the production contour

[Русский](production_move.md) · **English**

Issue [#45](https://github.com/michaelwelly/MuseonUrania/issues/45). The last,
eighth step of the implementation order from
[PROJECT.md](../PROJECT.md#13-порядок-работ): the platform, the database and
the private network. This is an analysis with a recommendation, not a list
of options — the owner still makes the final call.

## 1. Where we are now

Everything runs on one VM, `smart_soultion_mvp` (`51.250.31.97`), and on the
same machine `80` and `443` are held by **someone else's production site**,
`c3ag.ru`. This is not a nominal neighbor: grabbing those ports takes the
other site down immediately — details in
[stand_prod_perimeter.md](stand_prod_perimeter.md).

VEDAL runs as the `backend/compose.stand-prod.yaml` overlay on top of the
regular `compose.yaml`. Because of the shared machine it gets its own ports,
and both are bound to `0.0.0.0`, i.e. exposed to the whole internet:

| Port | What | Why it's open |
| --- | --- | --- |
| `18080` | gateway: site, API, admin, Swagger | the only entry point for visitors and staff |
| `18180` | Keycloak | the issuer address ends up in the employee's browser, and without a public address login can't complete |

The database is PostgreSQL 16 in the `vedal-db` container, a Docker volume on
the same machine, with no failover: if the VM goes down, the database goes
down with it.

Backups already exist. `scripts/backup.sh`, run by the `vedal-backup.timer`
timer, takes a `pg_dump -Fc` every night, **verifies it by restoring** into a
temporary database and counting tables, and rotates seven daily and four
weekly copies. A copy leaves the machine into the `vedal-backups` bucket if a
write-capable key is configured (`VEDAL_BACKUP_S3_BUCKET`,
`VEDAL_S3_ACCESS_KEY`) — details in [backups.md](backups.md). None of this
existed before; it is a minimum now, not the target scheme (that one is
continuous WAL shipping via `wal-g` into a bucket on a separate account, see
PROJECT.md §5.9).

Monitoring exists too, but one-sided. `scripts/healthcheck.sh`, via the
`vedal-health.timer` timer, checks the portal's liveness, containers, disk
and mail queue every five minutes **from inside the machine** — from the
outside the response is mixed up with the state of the network path (see
[monitoring.md](monitoring.md)). This means: if the VM itself goes down, the
watchdog goes silent with it, and that silence is indistinguishable from
"everything is fine." There is no external observer yet.

There is no domain and no HTTPS — that's
[#36](https://github.com/michaelwelly/MuseonUrania/issues/36), blocked on
access to the customer's DNS. An employee's password on admin login currently
travels over plain `http://`; this is a deliberate customer decision, made so
that login would work at all (see the comment in `compose.stand-prod.yaml`).

## 2. Three forks

### 2.1 Platform

| Option | What it gives | What it costs |
| --- | --- | --- |
| Stay on this VM | nothing to migrate | shares the machine and its failures with someone else's site; ports and memory constantly have to look over their shoulder at the neighbor; a "clean" install that has never actually been tested |
| Separate VM | no neighbor, `80`/`443` free from day one, `compose.prod.yaml` works as designed | one more machine on the bill, data and DNS migration |
| Fully managed services (PaaS/Kubernetes) | less operations of our own | a new architecture rather than a move: the project deliberately has no Kubernetes (PROJECT.md §5.9 — "memory is already scarce, feeding another consumer makes no sense"); this is a separate decision, not step 8 |

**Recommendation: a separate VM.** The neighbor, `c3ag.ru`, is not a
temporary inconvenience but a standing constraint: `compose.prod.yaml` cannot
be run as a whole while the neighbor is on the same machine (see section 4),
which means TLS, closed ports and a proper `admin` perimeter are simply
unattainable without a separate machine. Fully managed services would be a
change of architecture, not the execution of an already-made decision (the
owner's brief already names Yandex Cloud + VM + Managed PostgreSQL, see
PROJECT.md §11); reopening that question now would reopen a settled dispute.

### 2.2 Database: container or Managed PostgreSQL

**Managed PostgreSQL gives you:** provider-run backups with verified restore
(rather than a homegrown timer on the same machine that can go down entirely),
failover (a replica, automatic switchover on host failure), minor-version
updates without a manual `apt upgrade` on the live machine.

**Managed PostgreSQL costs:** per the owner's brief, 8,000–18,000 ₽/month
([vedal_portal_owner_brief.en.md](../architecture/vedal_portal_owner_brief.en.md),
the budget section) on top of the VM's own price; plus the migration itself —
moving data off the containerized database onto the managed one (dump/restore,
switching `VEDAL_DB_URL` from `db:5432` to the managed cluster's address,
downtime during the cutover).

**Must be checked: `wal_level=logical`.** The project already flags this as a
pitfall (PROJECT.md, item 8 of the §7 table): "Managed PostgreSQL puts logical
replication behind a separate flag, and without it the Debezium connector
will not start." Debezium in this project is not optional — it's the active
event-publishing mode (`vedal.events.publisher=debezium`, PROJECT.md §5.5):
without `wal_level=logical` there is no replication slot to create, and the
whole `outbox → WAL → Debezium → Kafka` chain does not start. **Yandex Cloud
Managed PostgreSQL does support logical replication** — it is enabled via the
`pg_config.wal_level=logical` cluster flag (through the console, the `yc` CLI,
or Terraform) and requires the instance to be recreated or restarted for the
change to take effect. This is not a blocker, but a mandatory configuration
step that is easy to forget — a forgotten flag won't show up when the cluster
comes up; it shows up silently, on the first event that should have reached
Kafka and didn't. The official cluster-parameters page is worth opening and
checking directly before the move — this is relayed from this project's own
experience with Debezium, not verified first-hand in the Yandex Cloud console.

**Recommendation: move to Managed PostgreSQL, but not as the first step.**
Failover and someone else's backups are worth it on production data that
includes a client base and deal amounts. But moving the database is a
migration with risk on live data, and it should happen **after** the move to
a separate platform, once there is somewhere to run a staging pass of the
migration — not while putting out fires for a neighbor on a shared VM.

### 2.3 Network

Right now: `18080` and `18180` are bound to `0.0.0.0` — open to the whole
internet, because on the shared VM there is no way to bring up `80`/`443`
with our own TLS without taking the neighbor down.

`compose.prod.yaml` already implements the target scheme, and this isn't a
proposal — it's working code already in the repository:

- exactly **one** container is exposed — `proxy` (Caddy) on `80`/`443` with
  Let's Encrypt TLS, which it obtains and renews by itself;
- every other service (`db`, `kafka`, `keycloak`, `connect`, `portal`,
  `api-gateway`, `site`) has `ports: !override []`: no ports published at
  all, services see each other by name inside the docker network;
- the `Caddyfile` additionally restricts `/admin`, `/admin/*`,
  `/api/admin/*` by IP: by default only private ranges
  (`VEDAL_ADMIN_ALLOW=private_ranges`), i.e. a VPN or a bastion, not the open
  internet backed by nothing but a token;
- Keycloak gets its own hostname (`VEDAL_KEYCLOAK_DOMAIN`), and media gets
  its own domain pointing straight at object storage, bypassing this machine
  entirely.

**Recommendation:** close everything that isn't the visitor-facing entry
point using that same `compose.prod.yaml` — but only on a separate platform
(see section 4 for why not on the current VM). Until the move — narrow what
can actually be narrowed without touching ports 80/443: restrict `18180` to
the team's IP list at the cloud firewall level (the way it is already done
for SSH on `2222`, see [egor_handoff_tasks.md](egor_handoff_tasks.en.md)),
not because it solves the problem, but because it's the only thing that can
be done without a move and without risk to the neighbor.

## 3. What is blocking right now, and in what order it comes off

```
domain vedal-med.ru (#36)
  → HTTPS (Caddy gets the certificate itself, but only for a domain, not an IP)
  → closing extra ports (18080, 18180 — the only thing keeping them open
    externally is the lack of an alternative: without HTTPS for staff,
    HTTP login is the only thing that works)
  → separating stand and prod (today it's the same machine: any check
    "on prod" runs against the same live data the visitor sees — there
    is no separate platform for staging)
```

The domain comes first because both following steps depend on it literally:
Let's Encrypt does not issue a certificate for a bare IP, and `KC_HOSTNAME` in
`compose.prod.yaml` has to match the address the employee's browser actually
reaches (otherwise the portal rejects the token on `issuer` — see the comment
in `compose.stand-prod.yaml`).

**Being honest about the "HTTPS" step on this same machine.** A domain alone
is not enough: the Caddy in `compose.prod.yaml` gets its certificate on its
own, but it needs `80` and `443` for that, and `c3ag.ru` holds those on this
VM. So HTTPS for VEDAL here can only happen one of two ways — either the VM
owner sets up a vhost for `vedal-med.ru` on their own web server, which gets
its own certificate and proxies to `18080` (our compose files stay
unchanged), or HTTPS waits for the separate platform from section 2.1, and
then the domain simply points at the new machine. The first path is faster
but depends on the neighbor's goodwill and configuration, which we don't
control; the second is slower but entirely in our own hands. Either way, the
domain itself can still be obtained as the first step regardless of the
platform question — repointing DNS to a new IP once one exists is cheaper
than waiting for the domain until after the move.

Separating stand and prod doesn't hinge on the domain, but on a separate
platform — the same decision as in section 2.1, and it cannot happen before
it: today the project physically has one machine, so there is nowhere to
stand up a second, isolated contour, and any check "on prod" runs against
the same data the visitor sees.

## 4. What must not be done

**Do not run `compose.prod.yaml` as a whole on the current VM.** It brings up
a `proxy` container (Caddy) on ports `80` and `443` — the exact same ports
that `c3ag.ru`, someone else's production site, holds right now. Trying to
bring up `proxy` on this machine will not just fail to work — it will
**immediately take down the other site** by seizing ports that already belong
to it. This is recorded in the project's memory (the machine `51.250.31.97`
is occupied by `c3ag.ru`, `80` and `443` are held by someone else's
production site, SSH is closed from the outside) and must stay that way until
the move to a separate platform. There is a safe option for this same
machine — `compose.host.yaml`: ports bound only to `127.0.0.1`, access
through an SSH tunnel, no Caddy and no `80`/`443` — but it is a lab setup, not
production (per the comment in the file itself), and real personal data has
no business being there.

## 5. Budget

From [PROJECT.md](../PROJECT.en.md), section 1: **50,000–80,000 ₽/month** for
the whole infrastructure, excluding development and support — Yandex 360 for
50 employees (≈27,450 ₽), the VM, Managed PostgreSQL, backups, object
storage, logs, monitoring, Lockbox/WAF, EDI. The line-item breakdown is in
[vedal_portal_owner_brief.en.md](../architecture/vedal_portal_owner_brief.en.md):
Managed PostgreSQL / hardened database — 8,000–18,000 ₽/month as its own
line. No numbers beyond these are invented here — the actual Yandex Cloud
pricing for a specific VM configuration and cluster needs to be checked in
the pricing calculator at order time; that isn't done here.

## Bottom line

| Fork | Recommendation | Why |
| --- | --- | --- |
| Platform | separate VM | `compose.prod.yaml` cannot be run on the shared machine without risk to the other site; fully managed services are a different architecture, not step 8 |
| Database | Managed PostgreSQL, but after the platform move | failover and someone else's backups are worth it; but data should not be migrated while putting out fires for a neighbor. `wal_level=logical` for Debezium is available and is enabled via a cluster flag |
| Network | the `compose.prod.yaml` scheme (one Caddy on `80`/`443`, everything else unpublished, `/admin` restricted by IP) | the code already exists, it just needs a platform where it can run without killing the neighbor |

Order per the issue: domain (#36) → HTTPS → closing extra ports → separating
stand and prod. In practice, the "HTTPS" step on this same machine depends on
the goodwill of `c3ag.ru`'s owner (see section 3) — without it, HTTPS and
port closure effectively merge into the move to a separate platform. Moving
the database to Managed PostgreSQL comes after the platform move, not before.
