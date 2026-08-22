# Equipment serial number in a service request

[Русский](2026-08-22-service-serial-number-design.md) · **English**

Date: 2026-08-22. Status: agreed in discussion, in progress.

## The task

The service request form gains a field for the equipment serial number. The same
pass fixes the field labels and three small things in the form markup that have
been accumulating since the first release.

## Decision: a field of its own, not a line in the text

The serial number becomes a separate field along the whole chain — the form, the
Forms API, the `lead` table, the manager's card, and the lead search.

The alternative considered was prepending the number to `message` on the
frontend. It is cheaper by exactly one migration, and it loses at the one thing
the number is collected for: finding a lead by it. A substring search over free
text also finds invoice numbers, ward numbers and phone numbers, and there is no
way at all to sort or to link requests about the same unit.

The field name is not translated: `serialNumber` in JSON and Java,
`serial_number` in the column.

### Where it is shown

In the service form only. In a quote, catalog or partnership request the person
does not own the equipment yet, and the field would be noise there.

On `/service/` the form arrives with `form="service"`, so the field is always
visible. On `/contacts/` the topic is chosen in a selector, so that selector
becomes controlled and the field appears and disappears with the choice.

This is an interface constraint, not a schema one. The database deliberately
carries no check for "`serial_number` only when `form = 'service'`": it would
forbid a manager from adding a number to a lead taken over the phone — a
legitimate case the schema has no business recognising.

### What is not validated, and why

The number's format is not validated. The shape of a VEDAL serial number is not
described in any approved material, and a mask invented in the code would reject
real numbers — meaning the request would not be sent at all, and the person would
not understand why. This follows directly from the "invent nothing" rule in
`CLAUDE.md`.

Only the length is bounded, at 100 characters. That is a storage boundary, and it
stands twice: `@Size` in `LeadSubmission` and a `check` in the schema. The
duplicate is not symmetry — a lead does not arrive by one path only: there is
mail parsing and the 1C exchange, and both bypass the controller's validation.

The field is optional: the number is not always at hand, and a request without it
is an ordinary request, not one with something missing.

### Search

The number is searched alongside name, company, phone and email — the same
case-insensitive `like '%…%'`. This is the main reason it became a column: the
customer calls and reads out the unit's number, not their own name.

No index is added. A leading wildcard in `like` cannot use a btree, and name,
phone and email are searched the same way and also without an index. Should it
become slow, the cure is a trigram index across all search fields at once, in a
migration of its own.

### Anonymisation

The serial number is **not** erased during anonymisation. It characterises the
unit, not the person, and stands alongside the organisation, which `PersonalData`
leaves alone for the same reason. After anonymisation the number still shows the
service history of the equipment, and no person can be identified from it.

The decision is pinned by a test in `PersonalDataTest`, not only by a comment:
without the test, the next person reading `eraseLead` sees a missed field rather
than a deliberate decision.

## Form fixes riding along

**One source of truth for the fields.** The focus order on validation failure and
the set of fields the backend may return errors for were two independent literals
in `LeadForm.tsx`. Adding any field meant remembering both, or focus silently
misses — and a focus miss is visible only to someone navigating by keyboard or
screen reader, which means no bug report will follow.

**Inline styles** `style={{marginTop: …}}` around the topic selector are replaced
with module classes.

**Consent.** The required-field asterisk and the separator before the policy link
sat flush against each other and read as noise. Fixed in both forms — `LeadForm`
and `HomeLeadForm` — otherwise the wording drifts apart.

## Field labels

| Was | Now | Why |
| --- | --- | --- |
| Email | Электронная почта | the only Latin script in a Russian row |
| Оборудование | Изделие | the project's term; the same word in the admin and the catalog |
| Опишите обращение | Суть обращения | the other labels are nouns |
| — | Серийный номер | the new field |

The hint under the serial number reads "Если знаете — ускорит разбор обращения".
Where to find the number on the unit is not stated: that would be a claim about
the equipment, and no approved material makes it.

The labels "Контактное лицо", "Организация" and "Телефон" do not change.

## Split across layers

The feature spreads over four branches, and none of them works on its own. It can
only be verified once all four are assembled in `dev`.

| Branch | What |
| --- | --- |
| `db` | `V26__lead_serial_number.sql` |
| `back` | `LeadSubmission`, `FormsController`, `LeadIntake.Draft`, `LeadService`, `Lead`, `LeadAdmin.LeadView`, `LeadRepository.filter` and tests |
| `front` | `LeadForm`, `HomeLeadForm`, `content/service.ts`, `lib/submit.ts`, `lib/admin.ts`, the lead card in the admin |
| `docs` | the form model in `content_model.en.md` and this spec |

The commits carry a `Feature: service-serial-number` trailer — every part can be
collected by it.

## What this work does not include

- The serial number is not added to the lead list (`LeadRow`): it belongs on the
  card, and the list is wide enough already.
- Mail is untouched. `LeadNotifier` sends the manager a link to the portal, not
  the lead's fields — there is nothing to add there.
- The short first-screen form (`HomeLeadForm`) does not get the field: it has
  neither a product selector nor a service topic.
- No phone input mask. It came up alongside, but it is a separate task: a mask
  changes how the number is stored and breaks the current phone search.
