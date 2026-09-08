# Mail setup

[Русский](mail_setup.md) · **English**

## Current state

The mechanism is written and tested: a lead puts a mail into the queue
(`outbound_mail`), `MailDispatch` walks the queue every five seconds and asks
`MailSender` to send. While `SPRING_MAIL_HOST` is unset, the portal is
honest about it: the mail stays in the queue with status `queued` and waits
for mail to be configured, instead of being marked sent when nothing went
out (issue #46). A warning is logged at startup, and the
`vedal.mail.queued` metric climbs.

This means leads that arrive BEFORE you fill in the three variables below
are not lost. Once mail is configured, everything that piled up goes out in
one pass — late, but complete (covered by the test
`MailRetryTest.whenSmtpAppearsAllWaitingMailGoesOutInOneDrain`).

The customer handed over the mailbox on 8 September 2026. The transport
turned out not to be Yandex 360, as planned back in August, but the domain's
own mail server — `mail.vedal-med.ru` (Postcow/mailcow). Checked the same
day, from outside, without involving the portal:

- port 465 with implicit TLS is open and the Let's Encrypt certificate is
  issued for `mail.vedal-med.ru` — that is, the transport hard-wired into
  `application.properties` fits with no changes;
- ports 587 (STARTTLS) and 993 (IMAP) are open too, port 25 is closed from
  outside — which is normal and the portal does not need it;
- login with "full mailbox address + password" was accepted
  (`235 Authentication successful`).

One action is left, and it happens on the machine, not in the repository:
put the three variables below into `/opt/vedal-portal/backend/.env` and
recreate the portal container.

## What is needed from the customer

Received: a mailbox on the `vedal-med.ru` domain and its password.

The password here is the mailbox's own password: this server issues no app
passwords, and the mailbox has no second factor either. That makes the rule
stricter, not looser: the mailbox the portal sends leads from must hold
nothing but leads — no access to the domain control panel, no sharing with
a live person's mailbox. Such a password is revoked the only way there is,
by changing the mailbox password, so rotating the mail password also means
editing `.env` on the machine.

## Where to put it

On the machine, in `/opt/vedal-portal/backend/.env` (see
[`.env.example`](../../backend/.env.example), the "почта" section):

```
SPRING_MAIL_HOST=mail.vedal-med.ru
SPRING_MAIL_USERNAME=<full mailbox address on the domain>
SPRING_MAIL_PASSWORD=<mailbox password>
```

All three only together: the portal wires up the SMTP transport
automatically once `spring.mail.host` is present, but the server will reject
a mail on the first attempt if the login or password is empty.

Two optional ones:

```
vedal.notifications.from=
VEDAL_NOTIFICATIONS_MANAGER=
```

`vedal.notifications.from` is the reply address, only if it must differ from
`SPRING_MAIL_USERNAME`. Usually not needed: the server already accepts mail
only from the mailbox that logged in, so an empty value is correct almost
always.

`VEDAL_NOTIFICATIONS_MANAGER` is the address of the responsible manager who
gets notified about a new lead (without the client's name, phone or email —
only the form, the product and the case number; the client's contacts stay
in the portal). This is a DIFFERENT variable, unrelated to the transport: it
is needed even once the mailbox is configured, if no recipient has been
named yet. An empty value means the manager notice is not sent; the
confirmation to the client still goes out as usual.

The password is never written into the repository — not the real one, not
as an example. On the machine it stays only as plain text in `.env` with
owner-only file permissions; fixing that is a proper secrets manager, a
separate task.

## How to restart

Variables are read at container startup; a plain `restart` does not pick
them up — the portal container needs to be recreated:

```bash
cd /opt/vedal-portal
docker compose -f backend/compose.yaml -f backend/compose.prod.yaml \
  --profile app up -d portal
```

No image rebuild needed: only environment variables change.

## How to check delivery

On a real lead — submit one on the site and confirm the mail arrives.

From the portal's side — the queue and the log:

```bash
# status of recent mails: queued — not sent yet (or waiting), sent —
# delivered, failed — rejected, needs manual review (last_error names why)
docker exec vedal-db psql -U vedal_app -d vedal -c \
  "select id, template, to_address, status, attempts, last_error, sent_at
     from outbound_mail order by created_at desc limit 20;"

# warnings and the outcome of each send attempt
docker compose -f backend/compose.yaml -f backend/compose.prod.yaml \
  logs --tail 100 portal | grep -i mail
```

The line `почта: SMTP, обратный адрес <address>` in the startup log confirms
the portal chose the SMTP transport, not the log-only fallback. Seeing
`SMTP не настроен` instead means at least one of the three variables did not
reach the container (a typo in the name, the `.env` file in the wrong
place).

Separately from a manual check, `vedal-health.timer` checks every five
minutes ([monitoring.en.md](monitoring.en.md)): if the queue has piled up
past `VEDAL_HEALTH_QUEUE` (50 by default) or anything sits in `failed`, an
alert goes to `journalctl -u vedal-health` and, if `VEDAL_ALERT_WEBHOOK` is
set, out to it as well.

## If mail lands in spam

That is not the portal's concern. SPF and DKIM are DNS records for the
sending domain; the `vedal-med.ru` zone lives on `nic.ru` name servers and
is edited by whoever owns the domain. The portal sends the mail exactly as
it hands it to the mail server, and cannot influence the domain's reputation
from inside the mail body.

As of 8 September 2026 the zone already carries:

- `v=spf1 mx -all` — only the MX hosts, that is `mail.vedal-med.ru`, may
  send on the domain's behalf. The portal goes through that same host, so
  SPF will pass on the portal's mail. Sending "around" it — through a
  third-party bulk sender, should one be set up — will be rejected until
  that sender is added to this record;
- DKIM with the `dkim` selector (2048-bit key) — the mail server signs the
  message itself;
- `v=DMARC1; p=none` — an observe-only policy: the recipient rejects
  nothing, even when the checks fail. Tightening it (`quarantine`, then
  `reject`) makes sense once statistics accumulate, and that is the domain
  owner's call, not the portal's.

If mail does not arrive at all, rather than just landing in spam, that is
the section above: the `status` and `last_error` columns in `outbound_mail`
name the reason (a server rejection is permanent, unavailability is
temporary — see
[`backend/notifications/README.en.md`](../../backend/notifications/README.en.md)).

## Related documents

- [`backend/notifications/README.en.md`](../../backend/notifications/README.en.md) —
  how the queue, failures and backoff between attempts work.
- [Liveness checks](monitoring.en.md) — metrics and the alert threshold for
  the mail queue.
- [`backend/.env.example`](../../backend/.env.example) — the full list of
  stand variables.
