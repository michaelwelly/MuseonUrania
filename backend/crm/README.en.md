# crm

[Русский](README.md) · **English**

Leads, clients, deals, quotes, correspondence history, attachments and funnel
analytics. Written in-house, inside the portal — the decision comes from the
[owner brief](../../docs/architecture/vedal_portal_owner_brief.en.md).

Why keep this in-house rather than in a mailbox: «клиентская база не живёт
в почте», «сделки и КП ведутся в одном месте», «собственник видит управляемую
картину».

A lead arrives only from [gateway](../gateway/README.en.md). The module writes
outward only through [notifications](../notifications/README.en.md). It has no
public API and never will: the client base, commercial terms and correspondence
belong to the closed contour.

## The path

```
Заявка → lead ──разбор──→ client + deal ──→ quote ──→ решение клиента
             (статус,        (воронка,      (позиции,
              ответственный)  стадия)        сумма)
                    │
                    ├── interaction    история звонков и переписки
                    └── deal_document  вложения из согласованных документов
```

Every step writes to [audit](../audit/README.en.md); every change to a deal or
a quote emits an outbox event in the same `COMMIT`.

## Three pipelines

From [functional_requirements](../../docs/strategy/functional_requirements.md).
One `deal` table serves all three: they share the card, the owner, the history
and the analytics. They differ only in their set of stages.

| Pipeline | Stages | Success | Refusal |
| --- | --- | --- | --- |
| `sales` | `new` → `qualified` → `quoted` | `won` | `lost` |
| `dealer` | `new` → `talks` → `agreement` | `active` | `declined` |
| `service` | `new` → `diagnostics` → `repair` | `closed` | `declined` |

The outcome names differ because winning in the dealer pipeline means a
connected dealer, and in the service pipeline a closed request. Analytics
folds them into two states, and the names deliberately do not overlap between
pipelines: an overlap would break folding three pipelines into one report.

The rule lives in `Pipelines` and is duplicated by the `deal_stage_check`
constraint in the schema. In the domain it explains itself in words before the
click; in the schema it cannot be bypassed by editing a controller, by an
import, or by a console session.

The outcomes travel outwards together with the list of stages: `wonStages` and
`lostStages` are in `GET /deals/pipelines` and in the deal card alike. The
admin UI needs them to ask for the loss reason before the click rather than
after the portal refuses — and to avoid keeping a list of outcomes of its own,
which a fourth pipeline would silently put out of step with the domain.

## What is deliberately not automated

**Sending a quote does not move the deal to `quoted`, and an accepted quote
does not move it to `won`.** The temptation is real, but the funnel is what a
manager asserts about a deal, not a side effect of a click in a neighbouring
card. Automation nobody asked for pleases first, then lies in the report, and
unpicking it afterwards costs more than two clicks.

**Converting a lead does not look for an existing client.** Matching by name or
e-mail is a guess: «Городская больница №1» exists in three cities, and several
people from one organisation write from the same address. Two cards can be
merged later; wrongly merged ones cannot be split. Choosing an existing client
stays with the manager, who passes `clientId` into the conversion.

## Rules closed by the schema

- `deal_stage_check` — a stage must belong to its own pipeline;
- `deal_lead_idx` — a lead is converted once; a double click does not create
  two deals for one request;
- `client_inn_idx` — a second card with the same ИНН would split one
  organisation's history across two places;
- `client_external_id_idx` — two portal clients pointing at one external
  counterparty is a divergence that an exchange would spread to both systems;
- `quote_number_unique` — two quotes with one number is an argument about
  which one is in force;
- `quote_sent_has_date` — a sent quote must remember when it was sent:
  without the stamp there is nothing to count the validity period from;
- `quote_item_position_unique` — line order is unique. The constraint is
  **deferred** (`deferrable initially deferred`), and that is not a relaxation:
  lines are replaced wholesale, and in a single flush Hibernate inserts the new
  row before deleting the old one. Checking at `COMMIT` keeps the rule strict
  and removes the dependency on statement order inside the transaction;
- `interaction_has_subject` — a history entry is attached to a deal, a client
  or a lead. Correspondence hanging in the air is reachable from no card;
- the `version` column on client, deal and quote — two managers who opened the
  same card do not silently overwrite each other.

## What is editable and what is append-only

| Entity | Editable | Why |
| --- | --- | --- |
| `client`, `deal` | yes, with a version check | an ordinary card |
| `quote` | only while it is a draft | a sent quote is already in the client's mailbox; editing it after the fact would mean the portal and the client hold different versions of one offer |
| `interaction` | no, append-only | history that can be corrected after the fact stops being history exactly when it is needed — when settling an argument about what was promised |

## Personal data and commercial terms

From the brief, section «Не выносим наружу»: the client base, commercial terms,
contracts, invoices, margin, tokens, personal data.

Consequences in the code:

- client contacts and the text of correspondence never reach topics or the
  audit log — only the identifier and the kind of action go there;
- deal amounts and quote prices never reach events or the audit log: these are
  commercial terms, and a topic lives outside the card, so anything that lands
  there counts as having left;
- page size in the lists of clients, leads, deals and quotes is capped at two
  hundred: `?size=1000000` must not turn a list into a dump of the whole
  personal-data base in one request.

Prices in a quote are named by a manager. The «не выдумывать цены» rule from
section 9 of [PROJECT.md](../../docs/PROJECT.en.md) applies to the site, the
catalogue and Vedalina; a quote is an internal document a person composes and
signs, and its prices never go outward.

## Analytics

Four dimensions from the requirements: by product, source, language and
campaign. Counted **over leads** with a left join to the deal, not over deals.

The reason: attribution is a property of where the person came from. A lead
that never became a deal must appear in the report, otherwise conversion equals
one everywhere. A manually created deal does not enter the dimensions — nobody
brought it in, and crediting it to a campaign would overstate that campaign.

Language and campaign reach the lead from the site form (`language`, `campaign`
in `POST /api/forms/v1/leads`). An empty value is shown as the row `«—»` rather
than hidden: leads without a campaign are also an answer, and hiding them
overstates the share of those that have one.

## Doors

All in the admin group `/api/admin/v1/**`; none of them public.

| Route | What it does |
| --- | --- |
| `/leads` | leads by page, status and owner |
| `POST /leads/{id}/convert` | convert a lead into a client and a deal |
| `/leads/{id}/history` | history of a lead: read and append |
| `/clients` | client base: search, card, edit |
| `/clients/{id}/history` | history of a client |
| `/deals/pipelines` | pipelines, their stages and outcomes, so the form can draw a choice |
| `/deals` | deals by page, filtered by pipeline, stage and client |
| `POST /deals/{id}/stage` | move along the funnel; a loss requires a reason |
| `/deals/{id}/attachments` | attach and detach an approved document |
| `/deals/{id}/quotes` | quotes of a deal |
| `/deals/{id}/history` | history of a deal |
| `/quotes` | quotes: list, card, editing a draft |
| `POST /quotes/{id}/send` | mark as sent; after that it is frozen |
| `POST /quotes/{id}/decision` | the client's decision — only on a sent quote |
| `/analytics` | the funnel in one dimension over a period |

The full contract is in
[docs/api/vedal-admin-openapi.yaml](../../docs/api/vedal-admin-openapi.yaml).

## Events

Topic `vedal.deals.v1`, separate from `vedal.leads.v1`: deals have a different
life cycle and different consumers — a lead produces a letter to the client,
while a deal lives for weeks and matters to reporting.

| Action | payload |
| --- | --- |
| deal created | `action=created`, pipeline, stage, `fromLead` |
| stage changed | `action=stage`, from, to |
| quote sent | `action=quote.sent`, deal, number |
| decision on a quote | `action=quote.accepted` / `rejected` / `expired` |

These events have no consumer yet. A letter carrying the offer itself is the
next step, and it depends on Яндекс 360 SMTP, which is not in place.

## What is left outside the boundary

**Roles.** The CRM doors are closed by the same `portal-admin` and
`portal-editor` as the rest of the admin area. Separating "who may see a deal"
from "who may change it" is deliberately not introduced: who gets access to the
CRM in the first stage is open question 12.3 in
[PROJECT.md](../../docs/PROJECT.en.md), and inventing a hierarchy before the
answer means inventing one nobody uses. There is exactly one place it will
plug into — `SecurityConfig.adminApiBaseline`.

**Exchange with 1С.** A client carries `inn`, `kpp` and `external_id`; the
exchange itself does not exist — that is open question 12.4. The columns were
added up front on purpose: adding them later means a migration plus a change to
every form and every query, while adding them now costs almost nothing.

**Letters for quotes.** `MailSender` writes to the log; the "sent" mark records
the fact, not the delivery.

## Build module

`portal-crm` is a Maven module with its own `pom.xml` and its own `src/`.
It depends on: `common`, `audit`, `documents`.

The dependency on `documents` is `DocumentQuery`: deal attachments come only
from approved documents.

The boundary is enforced by the build rather than by discipline: importing
from a module that is not among the dependencies fails compilation. Previously
all the code sat in one heap under `backend/src/`, and the boundaries held
only as long as someone was paying attention.
