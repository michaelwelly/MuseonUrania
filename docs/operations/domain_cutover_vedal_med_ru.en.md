# vedal-med.ru Domain Cutover

[Русский](domain_cutover_vedal_med_ru.md) · **English**

## Purpose

This document closes the third part of item §1.5 of the customer plan dated
18 August 2026 — access to `vedal-med.ru` — and turns §13.3 into a procedure.

The target host map is already described in
[outputs/server/vedal_vm_deploy_plan_2026-08-18.md](../../outputs/server/vedal_vm_deploy_plan_2026-08-18.md)
(section 2) and is not repeated here: that document answers "where should the
domain point", this one answers "how do we move it there, and how do we move it
back".

The first two thirds of §1.5 live in
[docs/strategy/content_protection_requirements.en.md](../strategy/content_protection_requirements.en.md).

## What we do not have yet

The cutover does not start until all three rows are closed. This is not
paperwork: each one alone makes rollback impossible.

| What | From whom | Why |
| --- | --- | --- |
| Access to the `vedal-med.ru` DNS registrar | customer, §13.1 | without it the zone cannot be edited |
| Who administers the current site and hosting | customer, §13.2 | otherwise nobody can restore the old records |
| Access to the current site | customer, §13.3 | rollback is impossible without it |

Until access exists, the stand is shown by IP — which is what we do today. The
one other acceptable option before the cutover is a technical subdomain, if DNS
allows it. The production domain stays untouched meanwhile.

## The constraint that must not be forgotten

The same virtual machine hosts `c3ag.ru` — a third party's production site — and
its proxy holds ports 80/443. VEDAL currently answers on a separate port.

So the domain cutover is **not** a single DNS record edit. It first requires a
decision on which proxy holds 80/443 alongside the existing one, and that
decision touches a live third-party site. The order is mandatory: proxy first,
DNS second. The reverse order produces a domain already pointing at a machine
where nothing listens for it — and the outage length is then set by the record's
TTL, not by us.

## Cutover procedure

### Step 1. Preparation, domain still untouched

1. Capture the current `vedal-med.ru` DNS records verbatim — this is the
   rollback plan. Without a snapshot of "how it was", rollback becomes
   reconstruction from memory.
2. Lower the record TTL in advance, at least a day ahead. A high TTL does not
   block the cutover — it blocks the rollback: the domain keeps resolving to the
   new machine for everyone who already received an answer.
3. Configure a proxy on the VM that serves `vedal-med.ru` and
   `www.vedal-med.ru` alongside the `c3ag` hosts without changing their
   behaviour.
4. Verify the new host without switching the domain: a request to the proxy with
   the right `Host` header must return the VEDAL site, while `c3ag.ru` still
   returns its own.

### Step 2. Certificate

HTTPS is issued before the switch where the validation method allows it (DNS
challenge), or immediately after — but then the window between DNS and
certificate is visible to the customer as a browser warning. The second option is
acceptable only inside an agreed window.

### Step 3. The switch

1. Change the `vedal-med.ru` A/AAAA records to the VM address.
2. `www.vedal-med.ru` — CNAME to `vedal-med.ru`, with a server-side redirect to
   the non-www form. The redirect direction is fixed once: two hosts serving
   identical content are duplicates as far as search engines are concerned.
3. Verify: HTTP redirects to HTTPS, the certificate is valid for both names, and
   `c3ag.ru` is unaffected.

### Step 4. Afterwards

- Check forms, document delivery and the assistant on the production domain —
  all of them depend on the site address.
- Check that the restricted hosts (`admin.`, `api.`) did not become publicly
  reachable.

## Cutover window

Chosen by the customer and agreed in advance. Requirements for the window:

- working hours, so that somebody is there to roll back;
- does not coincide with a trade show, a mailing or an advertising launch;
- both the current hosting administrator and the VM administrator are available.

Rollback: restore the records saved in step 1.1. It works exactly as well as the
TTL from step 1.2 is low — which is the only reason step 1.2 comes before the
switch rather than next to it.

## Domains and accounts

§13.4 of the plan requires a separate registry: domain variants and defensive
spellings, a single handle across social networks and messengers, plus owner,
administrator, recovery mail and 2FA per account. The registry is kept outside
the repository — the handover procedure is described in
[docs/operations/credentials_handover.md](credentials_handover.md).

The site footer links only to confirmed official channels (§13.5). It currently
shows `awaiting clarification`, which is the correct state until confirmation
arrives, not an omission.

## Related documents

- [VM deploy plan](../../outputs/server/vedal_vm_deploy_plan_2026-08-18.md) —
  host map, placement, SSH.
- [Content protection requirements](../strategy/content_protection_requirements.en.md).
- [Credentials handover](credentials_handover.md).
