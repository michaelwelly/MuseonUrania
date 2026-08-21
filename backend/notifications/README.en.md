# notifications

[Русский](README.md) · **English**

Outgoing mail: confirmation to the customer, notification to the responsible
manager.

A constraint from the
[owner brief](../../docs/architecture/vedal_portal_owner_brief.en.md), the
"Reply to the customer" step: only a templated letter or an approved document
goes outside. Free-form text with commercial terms is not sent through this
module.

The transport is Yandex 360 corporate mail, which we buy. What lives here is
templates, the sending queue and delivery accounting.

The confirmation text comes from
[content_model.en.md](../../docs/frontend/content_model.en.md):
"Спасибо. Специалист VEDAL свяжется с вами."

## Build module

`portal-notifications` is a Maven module with its own `pom.xml` and its own `src/`.
It depends on: `common`, `crm`.

The dependency on `crm` is `LeadContacts`: the recipient address is fetched by
identifier so that personal data never reaches the topics.

The boundary is enforced by the build rather than by discipline: importing
from a module that is not among the dependencies fails compilation. Previously
all the code sat in one heap under `backend/src/`, and the boundaries held
only as long as someone was paying attention.

## Transport

The sender is chosen at startup in `MailSenderConfig` by the presence of a
`JavaMailSender` bean, and Spring Boot autoconfiguration creates that bean
exactly when `spring.mail.host` is set.

| What is set | What happens |
| --- | --- |
| `SPRING_MAIL_HOST` not set | the letter goes to the log and is marked sent; a warning is logged at startup |
| set together with username and password | the letter goes out over Yandex 360 SMTP |

Three variables, and from the environment only — a literal password in the
repository can be removed only by rewriting history:

```
SPRING_MAIL_HOST=smtp.yandex.ru
SPRING_MAIL_USERNAME=<full mailbox address on the domain>
SPRING_MAIL_PASSWORD=<application password>
```

An application password, not the account password: with the second factor
enabled Yandex 360 does not accept the account password over SMTP. The envelope
sender defaults to the username — Yandex 360 accepts a letter only from the
mailbox that authenticated.

Port 465 (implicit TLS) rather than 587 (STARTTLS): with STARTTLS the
connection starts in the clear, and an intermediary can strip the server's
offer to negotiate encryption.

## Queue and failures

A letter is not sent at the moment it is queued: `Mailer` puts it into
`outbound_mail`, and every five seconds `MailSchedule` asks `MailDispatch` to
walk the queue. Each letter is sent in its own transaction (`MailAttempt`).

Failures come in two kinds, and that distinction is the central one here:

| Kind | When | What happens |
| --- | --- | --- |
| `MailTransientFailure` | server unreachable, timeout, 4xx refusal, credentials not accepted | the letter stays queued, the next attempt follows a backoff |
| `MailPermanentFailure` | address rejected (5xx), control character in the address or subject, the message did not assemble | straight to `failed`, skipping the remaining attempts |

The backoff grows: 1 minute, 5, 15, 1 hour, 6 hours — five attempts fit into
roughly seven hours. Without it, a server being unreachable for twenty-five
seconds would exhaust every attempt and move the whole queue to `failed` at
once.

`failed` means manual review. The `vedal.mail.queued` and `vedal.mail.failed`
metrics report both figures.
