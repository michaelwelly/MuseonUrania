# Mail setup

[Русский](mail_setup.md) · **English**

## Current state

The mechanism is written and tested: a lead puts a mail into the queue
(`outbound_mail`), `MailDispatch` walks the queue every five seconds and asks
`MailSender` to send. One thing is missing — the mailbox itself, and the
customer sets that up. While `SPRING_MAIL_HOST` is unset, the portal is
honest about it: the mail stays in the queue with status `queued` and waits
for mail to be configured, instead of being marked sent when nothing went
out (issue #46). A warning is logged at startup, and the
`vedal.mail.queued` metric climbs.

This means leads that arrive BEFORE you fill in the three variables below
are not lost. Once mail is configured, everything that piled up goes out in
one pass — late, but complete (covered by the test
`MailRetryTest.whenSmtpAppearsAllWaitingMailGoesOutInOneDrain`).

## What is needed from the customer

A mailbox on the `vedal-med.ru` domain (or whichever domain sending has been
agreed on) and an app password for it — not the account's main password.
Yandex 360 (the transport `SmtpMailSender` is written for) issues app
passwords in the account settings; they are revoked independently of the
main password and do not grant access to the whole account.

## Where to put it

On the machine, in `/opt/vedal-portal/backend/.env` (see
[`.env.example`](../../backend/.env.example), the "почта" section):

```
SPRING_MAIL_HOST=smtp.yandex.ru
SPRING_MAIL_USERNAME=<full mailbox address on the domain>
SPRING_MAIL_PASSWORD=<app password>
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
`SPRING_MAIL_USERNAME`. Usually not needed: Yandex 360 already accepts mail
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
sending domain, set up by whoever owns the domain (for Yandex 360, in the
domain management panel — see their documentation). The portal sends the
mail exactly as it hands it to the mail server, and cannot influence the
domain's reputation from inside the mail body.

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
