# Personal Data Policy — Draft

[Русский](privacy_policy_draft.md) · **English**

> **This is a draft for legal review, not a published document.**
> §14.7 of the customer plan requires the final wording to be reviewed by a
> lawyer or the customer's responsible person before publication. This text is
> not on the site and will not be until that review is done.
>
> The draft follows the structure of the Ural CCI page on 152-FZ, which the
> customer picked as a reference, but does not copy its text: §14.3 forbids that
> outright, and the chamber's document describes the chamber's own processing —
> different operator, different purposes, different analytics. Applied to
> VEDAL LLC it would be wrong on the substance.
>
> Every factual item below is checked against the code and the database schema.
> Anything absent from the code is marked `awaiting clarification` — inventing
> retention periods and recipient lists in a document of this kind is doubly
> unacceptable.

## What the customer must decide before publication

The draft cannot be completed from the code — these are company decisions:

1. **Retention period for enquiries.** The code has the erasure-on-expiry
   mechanism (`PersonalData.Basis.RETENTION`) but no actual period.
2. **The person responsible for organizing personal data processing** — name,
   position, contact for data subject requests.
3. **Contractors the data is passed to**, if any, and on what basis.
4. **Roskomnadzor notification** of personal data processing — filed or not.
5. **Yandex Metrica** — do we connect it. There are no counters today, and both
   the analytics section and the cookie banner text depend on this.

## 1. General provisions

This policy defines how personal data of individuals who contact the company
through the `vedal-med.ru` website is processed and protected.

Processing is carried out under Federal Law No. 152-FZ of 27 July 2006 "On
Personal Data".

## 2. The operator

| Field | Value |
| --- | --- |
| Name | VEDAL Limited Liability Company |
| INN | 5406826069 |
| KPP | 540601001 |
| Address | 620135, Sverdlovsk Region, Yekaterinburg, Sovkhoznaya St., bld. 20V |
| Phone | 8 800 600 3449 |
| Email | sales@vedal-med.ru |
| Responsible for organizing processing | `awaiting clarification` |

## 3. What data is processed

Through the site forms ("Leave an enquiry", "Service request"):

| Data | Required | Stored in |
| --- | --- | --- |
| Contact person (name) | required | `lead.name` |
| Phone | required | `lead.phone` |
| Email | required | `lead.email` |
| Organization | optional | `lead.company` |
| Product of interest | optional | `lead.product_slug` |
| Enquiry text | required | `lead.message` |
| Enquiry topic and source | filled by the site | `lead.form`, `lead.source` |
| Consent record: date, time and text revision | filled by the site | `lead.consent_at`, `lead.consent_version` |

Information about an organization (name, INN, KPP) is not personal data and
falls outside the scope of this policy.

Special categories of personal data and biometric personal data are not
processed. The site is not intended for transmitting health information: there
is no need to include such information in the enquiry text.

## 4. Purposes of processing

- responding to an enquiry received through a form, by phone or by email;
- preparing a commercial quote;
- equipment selection and sending the catalog;
- receiving and handling service requests;
- reviewing partnership and dealership proposals.

The data is not used for marketing mailings: there are no mailings, and no
consent for them is requested.

## 5. Legal basis

The data subject's consent, given by ticking the checkbox in the site form.
Submitting a form without that tick is technically impossible.

The site stores not only the fact of consent but the revision of the text it was
given under, together with the date and time. This makes it possible to
establish what exactly a person agreed to if the consent text changes later.

## 6. Processing and retention period

`awaiting clarification` — the period is set by the company.

Once the period expires the data is erased automatically, and the basis is
recorded as "retention period expired".

## 7. Erasure and withdrawal of consent

A data subject may withdraw consent at any time and demand erasure by contacting
the company using the details in section 2.

Erasure is performed by de-identification rather than by deleting the record:

- **erased**: name, phone, email, enquiry text, and the subject and content of
  correspondence about the enquiry;
- **retained**: the form, source, language, campaign, status and timestamps —
  none of which identify a person;
- organization details are untouched, as they are not personal data.

After de-identification the record no longer allows identification and ceases to
be personal data. This approach was chosen because deleting the record itself
would break the linked deals, the analytics and the immutable audit log.

## 8. Data transfer

The data is processed inside the company by employees who need it to answer the
enquiry. Access is role-based; access to restricted sections and document
downloads are recorded in the audit log.

Transfer to third parties: `awaiting clarification` — the list of contractors
and the grounds are determined by the company.

The data is hosted on infrastructure located in the Russian Federation.

## 9. Cookies and analytics

The site uses technical cookies without which the pages do not work.

Web analytics counters are **not connected** on public pages. If Yandex Metrica
is connected, this section and the cookie banner text will be extended, and
consent for analytics will be requested separately from consent for form data.

## 10. Data protection

- enquiries are accessible only to employees after login, by role;
- restricted documents are neither published nor indexed;
- actions on enquiries and document downloads are recorded in the audit log;
- the audit log is immutable and contains no contact details or enquiry texts.

## 11. Rights of the data subject

A data subject may obtain information about the processing of their data, demand
its correction, blocking or erasure, withdraw consent, and appeal the operator's
actions to Roskomnadzor or in court.

Requests are accepted using the contact details in section 2.

## 12. Changes to the policy

The company may amend this policy. The current version is published on the site
at `/legal/privacy/`.

## Related documents

- [Compliance requirements](compliance_requirements_ru.md) — personal data,
  hosting, open and closed contours.
- [Content protection requirements](../strategy/content_protection_requirements.en.md).
- [Materials request to Nikolay Nikolaevich](../requests/nikolay_materials_request.en.md).
