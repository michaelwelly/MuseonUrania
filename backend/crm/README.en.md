# crm

[Русский](README.md) · **English**

Leads, customers, deals, quotes, statuses. We write it ourselves, inside the
portal — a decision from the
[owner brief](../../docs/architecture/vedal_portal_owner_brief.en.md).

Requirements from
[functional_requirements.en.md](../../docs/strategy/functional_requirements.en.md):
lead intake from the website, product interest tagging, the quote funnel, dealer
and service funnels, owner assignment, correspondence and call history,
attachments from approved documents, analytics by product, source, language and
campaign.

The reason to keep this in-house rather than in mailboxes: "the customer base
does not live in email", "deals and quotes are handled in one place", "the owner
sees a managed picture".

A lead arrives only from [gateway](../gateway/README.en.md). It writes outside
only through [notifications](../notifications/README.en.md).
