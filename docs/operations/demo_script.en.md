# Customer demo script

[Русский](demo_script.md) · **English**

A 15–20 minute route through the live stand. Not a presentation — whoever
runs the demo follows it instead of deciding on the fly what to open next.
Source of facts: the end-to-end run protocol in
[issue #57](https://github.com/michaelwelly/MuseonUrania/issues/57) from
September 7 (after deploying `1ec291b`) and the
“work registry” (`docs/commercial/act2_work_registry.en.md` — moved out of the public repository, see [the 8 September cleanup](../security/public_repo_cleanup_2026-09-08.md)).

## Before the demo (five minutes)

Since 8 September the portal lives on its own name: `https://vedal-med.ru`.
Showing it by IP and port is no longer needed, and it is worth avoiding — an
address bar reading `51.250.31.97:18080` on the customer's screen looks like
unfinished work even when everything runs.

Check from outside, on the demo machine:

```bash
curl -s -o /dev/null -w '%{http_code}\n' https://vedal-med.ru/
```

Expect `200`. If there is no answer, before fixing anything check whether the
channel is at fault (issue #64): a timeout from outside with a healthy portal
has happened here before, and it is cured by changing the channel, not by
editing anything on the machine.

Admin login — from the demo machine, ahead of time, before the customer
arrives:

- open `https://vedal-med.ru/admin/`, log in as `asura`
  (role `portal-admin`);
- reach the dashboard and back to `/admin/` with no errors.

If login fails, see "If something goes wrong" below — before the demo, not
in front of the customer.

## Demo route

### 1. Public site

All addresses are under `https://vedal-med.ru`.

| Step | What to open | What to notice | One line to say |
| --- | --- | --- | --- |
| 1.1 | `/` | preloader, the live VEDAL mark, animations | "This is a static storefront — a backend outage doesn't take it down" |
| 1.2 | `/products` | categories and product cards — how many there are right now, check before the demo rather than trusting this line: the catalog is edited in the admin panel and changes without this document | "The catalog is built from the same database the editor sees in the admin panel" |
| 1.3 | `/products/[slug]` — open one card | tabs on the product page, specs | if a given spec says "awaiting clarification" — say so plainly: "we're waiting for this data from you, we don't make it up" |
| 1.4 | `/production` | production text | brief, no lingering |
| 1.5 | `/documents` | document listing | **do not click download** — see "What not to open" |
| 1.6 | `/contacts` | map, company details, hours 9:00–17:30 | the tax registration code (KPP) is fixed to 668601001 (issue #68 closed) — the details can be shown calmly now. The map appears after the visitor answers the consent notice: that is not a hitch but a requirement for a third-party frame, and it is worth saying so out loud |

### 2. Vedalina

Open the widget from any product page.

| Step | What to do | What to notice | One line to say |
| --- | --- | --- | --- |
| 2.1 | Ask about a published product, e.g. patient monitoring | the answer carries links to sources below the text | "The links come from the portal, not the model — this isn't a guess, it's a citation of a published page" |
| 2.2 | Ask about something not on the site (a model or task not in the catalog) | the assistant does not invent an answer, asks a clarifying question, offers handoff to a human | "No source, no answer — it hands off to a specialist instead" |
| 2.3 | Ask about price | the answer is "prices are not published, leave a request" — try it in English too, it replies in the language of the question | "Vedalina never states a price — that's a rule, not an oversight" |

### 3. Lead from the form

| Step | What to do | What to notice | One line to say |
| --- | --- | --- | --- |
| 3.1 | Fill in and submit the lead form (from any product page or the header) | confirmation on the site | "The lead was submitted with consent for personal data processing" |

### 4. Admin panel — working a lead

Open `/admin/` (already logged in during setup).

| Step | What to open | What to notice | One line to say |
| --- | --- | --- | --- |
| 4.1 | `/admin/leads` | the new lead in the list, same number that appeared in step 3 | "The lead landed in CRM immediately, no manual transfer" |
| 4.2 | open the lead, assign an owner | status, history | brief |
| 4.3 | convert the lead into a deal → `/admin/deals` | the deal appears in the right pipeline | "From here the lead lives as a deal — pipeline, stages, quote" |

### 5. Conversations

| Step | What to open | What to notice | One line to say |
| --- | --- | --- | --- |
| 5.1 | `/admin/chats` | list of conversations; the round widget icon on the site no longer overlaps content (issue #49, closed) | "This is where handoff requests from the chat land, when a visitor asks for a specialist" |

### 6. Audit log

| Step | What to open | What to notice | One line to say |
| --- | --- | --- | --- |
| 6.1 | `/admin/audit` | filters, the correlation chain for the lead from step 3 | "Every action in the system — from login to editing a card — is logged and chained" |

The route ends here, roughly 15–20 minutes including pauses for questions.

## What not to open, and why

**Document download.** The stand has 12 document cards, all with
`published = false` and an empty `storage_key` — none of them has an actual
file. This is not a portal defect, it's missing material from the customer
(issue #35). Do not click the download button on `/documents`.

If asked: "The upload, publish and delivery mechanics are written and
tested — a restricted document returns 404 and logs the access
(`document.access.denied`), that's confirmed by the run. What's missing is
material and publication permission from you; once they arrive, documents
go live the same way product cards do today."

**Lead notification emails.** The email about a new lead is not sent: no
mailbox is configured, SMTP isn't set up (issue #46). The lead is still in
the database and visible in `/admin/leads` — this doesn't affect step 4 of
the demo.

If asked: "The email isn't lost — it sits queued and goes out once a
mailbox exists; the sending itself is covered by a test, we're only waiting
on the mailbox from you."

## If something goes wrong

**A page won't load or hangs.** Most likely the channel (issue #64), not
the portal. The tell: the TCP connection is established but no data comes
back — `curl` hangs until timeout and returns `000`. It is cured by changing
the channel (a phone on a different carrier), not by editing anything on the
machine.

Checking from inside the VM goes like this:

```bash
ssh -p 2222 ubuntu@51.250.31.97
curl -s http://127.0.0.1:18080/actuator/health
```

But note: SSH only admits addresses listed in the security group, and the
external address changes along with the VPN. If port 22 does not answer at
all while 443 does, that is almost certainly why — and it is fixed in the
Yandex console by the machine's owner, not from your side.

**Admin login won't let you in.** Check which role is being used: `asura`
is `portal-admin`; `sales` and `production` have deliberately restricted
access (`/products` and `/audit` correctly return `403` for them — that's
by design, not a bug). Account setup details and a known Keycloak trap
(`invalid_grant: Account is not fully set up` when first/last name aren't
filled in) are in issue
[#43](https://github.com/michaelwelly/MuseonUrania/issues/43).

**Vedalina doesn't answer, or answers without sources where a source
exists.** Check the engine and the key:
[docs/operations/yandexgpt_activation.md](yandexgpt_activation.md) (Russian
only for now) — variables `VEDAL_ASSISTANT_ENGINE=yandexgpt`,
`VEDAL_YANDEXGPT_API_KEY`, the `curl` smoke test against
`/api/assistant/v1/ask` from that document.
