# Credentials And Access Handover Procedure

[Русский](credentials_handover.md) · **English**

## Purpose

This procedure defines how VEDAL transfers temporary project access to the contractor and how the contractor transfers final access, documentation, and control back to VEDAL.

## Customer To Contractor: Initial Access

Recommended method:

- Create named accounts for contractor access where possible.
- Avoid sending permanent owner passwords in chats or email.
- Use temporary passwords and require password rotation after first login.
- Enable MFA and record who owns the MFA device.
- Transfer access through a password manager or signed access inventory.
- For cloud, domain, repository, analytics, CRM, and CMS, prefer role-based invitations instead of shared root credentials.

Minimum initial access inventory:

- Domain/DNS account or delegated DNS management.
- Yandex Cloud account/project access.
- Existing hosting/admin access, if any.
- Current website CMS/admin access, if any.
- Cloud folder with photos, videos, catalogs, certificates, and documentation.
- Email account/integration access for forms.
- CRM or chosen CRM workspace access.
- Yandex Metrica/Yandex Direct access, if existing.
- GitHub repository access.

## Contractor To Customer: Final Handover

At final handover, VEDAL should receive:

- GitHub repository ownership or confirmed collaborator/admin access.
- Production hosting/cloud project access.
- CMS/admin owner access.
- S3 buckets and storage policy overview.
- Domain/DNS control or deployment instructions.
- Yandex Metrica access.
- API documentation / Swagger URL.
- Environment variables inventory without exposing secrets in the repository.
- Backup and restore notes.
- Support contacts and monthly support terms.
- Known limitations and next-phase recommendations.

## Handover Act

The handover act should list:

- Access item.
- System URL.
- Owner account.
- Access role.
- Transfer method.
- MFA status.
- Date/time of transfer.
- Responsible person from contractor.
- Responsible person from VEDAL.
- Notes and restrictions.

## Security Rules

- Never commit passwords, tokens, `.env` files, API keys, private certificates, or database dumps to the repository.
- Rotate all temporary passwords after handover.
- Remove contractor access after acceptance if monthly support is not active.
- If monthly support is active, keep only the minimum required support roles.
- Keep separate public, admin, and infrastructure access groups.

