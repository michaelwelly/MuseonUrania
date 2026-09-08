# Personal data retention and automatic erasure

[Русский](data_retention.md) · **English**

The automatic erasure mechanism is written for all three carriers of personal
data and is **switched off**. It is switched on by three environment variables
on the day the customer names the retention term, and not a day earlier.

The task is issue #47, open technical question 12.2 in
[PROJECT.en.md](../PROJECT.en.md).

## Why it is off

Erasure is irreversible and there is nothing to restore from: the stand has no
backups (see [backups.en.md](backups.en.md)). A term set too short means the
client base of the quarter before last is wiped, discovered only when someone
comes looking for an old lead.

So the term is not picked "by common sense" and not hard-coded. Three years is
proposed; the customer has not confirmed it. While there is no number there is
no erasure at all: without the property — and with an empty value for it —
the portal does not create the sweep beans, and the startup log says nothing
about them.

## Three carriers, three terms

A lead, a conversation and a mail are kept for different reasons, so each has
its own term and is switched on separately. One shared term for all three
would be a decision nobody made.

| Carrier | Why it is kept | Variable | Property |
| --- | --- | --- | --- |
| lead | until the question behind the request is closed: deal, quote, a repeat request | `VEDAL_PRIVACY_RETENTION` | `vedal.privacy.retention` |
| conversation with Vedalina | a fact of communication that happened; a lead grows out of it | `VEDAL_PRIVACY_RETENTION_CHAT` | `vedal.privacy.retention.chat` |
| outbound mail | delivery forensics: did it leave, how many attempts, what SMTP answered | `VEDAL_PRIVACY_RETENTION_MAIL` | `vedal.privacy.retention.mail` |

The value is an ISO-8601 period, not a number of days: `P3Y` is three years,
`P18M` is eighteen months, `P6M` is six. A retention term is named in years,
and a year is not 365 days; writing it in days means missing by a leap day.
The string is parsed at startup — a typo brings the launch down instead of
staying silent until the first nightly pass.

## What exactly is erased

Not a row deletion but anonymisation: the record stays, the personal data
leaves it. Deleting the row would break the link from a deal, an analytics
breakdown and an entry in the immutable audit log.

| Carrier | Erased | Kept |
| --- | --- | --- |
| lead | name, phone, email, request text, subject and body of interaction records | form, source, language, campaign, status, time, number |
| conversation | message bodies, links to answer sources | the thread itself: that it happened, how long it ran, how it ended |
| mail | recipient address, subject, body | template, status, attempt count, `correlation_id`, time |

Erased values are replaced with the word `удалено` — the same marker in all
three places. `erased_at` and `erasure_basis` are set on the record; the basis
is `истёк срок хранения` for automatic erasure and `обращение субъекта` for a
data subject request.

**A mail still in the queue (`status = queued`) is never touched, at any
age:** the recipient address is needed by the delivery attempt itself, and
anonymising a mail that is about to leave would send `удалено` instead of the
real address.

## How to switch it on

1. Get the term from the customer — in writing, in the task thread or in an
   act. There may be three different terms: the properties are split for that.
2. Put the values into `backend/.env` on the server (the variables are already
   listed, empty, in [.env.example](../../backend/.env.example) and
   [.env.host.example](../../backend/.env.host.example)):

   ```
   VEDAL_PRIVACY_RETENTION=P3Y
   VEDAL_PRIVACY_RETENTION_CHAT=P3Y
   VEDAL_PRIVACY_RETENTION_MAIL=P3Y
   ```

3. Restart the portal. Three lines appear in the startup log:

   ```
   Срок хранения персональных данных заявок: P3Y. Обезличивание включено.
   Срок хранения персональных данных разговоров: P3Y. Обезличивание включено.
   Срок хранения персональных данных писем: P3Y. Обезличивание включено.
   ```

   No line means no erasure for that carrier. That is the check: silence means
   switched off, not "working quietly".

4. Update the term in the personal data policy on the site — the draft is in
   [privacy_policy_draft.en.md](../legal/privacy_policy_draft.en.md),
   section 6, and the `/legal/privacy/` page. Switching erasure on without
   writing the term into the policy means destroying data by a rule the person
   never saw.

## What happens on the first pass

Passes run on a schedule, once a day, in the portal process time zone: leads
at 3:30, conversations at 3:35, mail at 3:40. This is changed by the
`vedal.privacy.sweep-cron`, `.chat` and `.mail` properties.

One pass erases at most one batch — 500 records per carrier
(`vedal.privacy.batch`, `.chat`, `.mail`). This matters for the very first
pass after switching on: everything accumulated over years goes under the
knife, and doing it in one transaction means locking the table for minutes and
a bloated write-ahead log that Debezium will be draining all that time. If
more than a batch has accumulated, the remainder goes on the following nights.

Every pass that found something logs the number of records anonymised. Erasure
on a schedule is the one operation nobody ordered and nobody watches; done
silently, it is discovered only by the data being gone.

## The link with a data subject request

Automatic erasure is the second route to destruction. The first is a person's
request, executed by an employee through the admin panel:
`DELETE /api/admin/v1/leads/{id}/personal-data`, role `portal-admin`.

That entry point erases **all three carriers at once**: the lead, the
conversation it grew out of, and the confirmation mail sent for it. A person
files one request while their data sits in three places, and executing part of
it is not executing it. A repeat call changes nothing and answers `already`.

There is no public "delete me" entry point for any of the three, and there
will not be: it would let anyone who guessed an identifier erase someone
else's request.

## What is left

- **The term is not confirmed.** Three years is proposed. Until it is
  confirmed the three variables are set nowhere, production included.
- **The policy is not published on the site.** The `/legal/privacy/` page says
  honestly that the term is awaiting clarification; the policy draft is
  waiting for legal review (§14.7 of the customer plan).
- **There are no backups.** That is a separate task, but it is directly
  connected to this one: switching on irreversible destruction with nothing to
  restore from if the term is wrong is a decision to be made with open eyes.
